import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchCartao, fetchCartaoRemessa, fetchAdministradoras } from '@/api/endpoints/financeiro'
import { fetchVendas } from '@/api/endpoints/vendas'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { todayLocal } from '@/lib/period'
import type { Cartao, CartaoRemessa } from '@/api/types/financeiro'

/**
 * Conciliação de cartão (Fase 1) — DETERMINÍSTICA, read-only.
 *
 * Cruza o RECEBÍVEL do sistema (/CARTAO por `dataFiltro='PAGAMENTO'`) com o
 * REPASSE do adquirente (/CARTAO_REMESSA por `dataRemessa`), agregando por
 * **POSTO × administradora × dia de LIQUIDAÇÃO** — igual ao WebPosto. Agregar a
 * REDE inteira inventaria divergência quando um posto tem lote deslocado; por
 * isso a chave inclui a empresa.
 *
 * Classifica (não recalcula valor): Conciliado / Valor divergente (nível LOTE) /
 * Sem repasse (vencido | não localizado) / Aguardando. EDI vazio → aguardando.
 *
 * `revisao` (opt-in): 2ª passada determinística — casa um "sem repasse" com um
 * LOTE LIVRE da mesma bandeira/posto e mesmo bruto até ±7 dias (lote postado no
 * dia errado pelo EDI) → "conciliado · lote deslocado". Não altera valor.
 */

const TOL = 1.0
const REV_JANELA = 7 // dias — casa lote deslocado dentro dessa distância.

export type StatusKind = 'conciliado' | 'a_creditar' | 'valor_divergente' | 'sem_repasse' | 'aguardando'
export type MotivoKind = 'sem_repasse_vencido' | 'sem_repasse_nao_localizado'

export interface AdminDiaRow {
  key: string
  empresaCodigo: number
  bandeira: string
  tipo: string
  dia: string
  brutoSistema: number
  brutoRepasse: number
  delta: number
  taxaPct: number
  liquido: number
  status: StatusKind
  revisao?: boolean
}

/** Item por VENDA (grupo "sem repasse" — cada venda pode precisar de lançamento). */
export interface DetalheItem {
  empresaCodigo: number
  vendaCodigo: number
  valor: number
  bandeira: string
  vendedor: string
  dia: string
  diaLiq: string
  aut: string
  nsu: string
  motivo: MotivoKind
  motivoTexto: string
}

/** Divergência de LOTE (bandeira×dia×posto) — não se atribui a uma venda só. */
export interface DivergenciaLote {
  key: string
  empresaCodigo: number
  bandeira: string
  diaLiq: string
  sistema: number
  repasse: number
  delta: number
  registros: number
}

export interface CartoesView {
  adminDia: AdminDiaRow[]
  kpis: {
    conciliado: { valor: number; registros: number }
    semConciliar: { valor: number; registros: number }
    aguardando: { valor: number; registros: number }
    conciliavelTotal: number
    pctConciliavel: number
  }
  semRepasse: DetalheItem[]
  divergencias: DivergenciaLote[]
  vendasPendentes: number[]
}

export interface CartoesResult {
  coverage: { ediUpTo: string | null; pctPeriodo: number; diasCobertos: number; diasTotal: number }
  base: CartoesView
  revisao: CartoesView & { recuperados: { n: number; valor: number } }
  temRemessa: boolean
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const diffDays = (a: string, b: string): number => {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

const normalizeRemessa = (r: CartaoRemessa) => ({
  empresaCodigo: r.empresaCodigo,
  administradoraCodigo: r.administradoraCodigo,
  descricao: r.administradora ?? '',
  // Casamos pelo BOM-PARA (dataPagamento = dia do crédito), NÃO por dataRemessa
  // (dia de processamento do EDI). O sistema (/CARTAO) usa o mesmo dataPagamento;
  // dataRemessa pode ser dias antes (lote processado adiantado) e causava falso
  // "sem repasse". Igual à conciliação do WebPosto (por bom-para).
  data: (r.dataPagamento ?? r.dataRemessa ?? '').slice(0, 10),
  bruto: r.valorRemessa ?? 0,
  liquido: r.valorLiquido ?? 0,
  taxaRs: r.taxasDespesas ?? 0,
})

const diaLiquidacao = (c: Cartao) => (c.dataPagamento || c.vencimento || '').slice(0, 10)
const diaVenda = (c: Cartao) => (c.dataMovimento || c.dataFiscal || '').slice(0, 10)

interface Cell {
  key: string
  empresaCodigo: number
  bandeira: string
  tipo: string
  dia: string
  brutoSistema: number
  brutoRepasse: number
  liquido: number
  taxaRsAcc: number
  rows: Cartao[]
  revBruto?: number
  revLiquido?: number
  revTaxaRs?: number
}

const useCartoesConciliacao = () => {
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  const empresas = useMemo(
    () => (empresasData?.resultados ?? []).map((e) => ({ codigo: e.empresaCodigo, nome: e.fantasia || e.razao || `Posto ${e.empresaCodigo}` })),
    [empresasData],
  )
  const permitidas = useEmpresasPermitidas(empresas)
  const scopeCodes = useMemo(() => {
    const base = permitidas.map((e) => e.codigo)
    return empresaCodigos.length > 0 ? base.filter((c) => empresaCodigos.includes(c)) : base
  }, [permitidas, empresaCodigos])

  const query = useQuery<CartoesResult>({
    queryKey: ['cartoes-concil', scopeCodes.join(','), dataInicial, dataFinal],
    enabled: scopeCodes.length > 0 && !!dataInicial && !!dataFinal,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [cartaoAll, remessaAll, admAll] = await Promise.all([
        Promise.all(scopeCodes.map((ec) =>
          fetchAllPages((p) => fetchCartao({ empresaCodigo: ec, dataInicial, dataFinal, dataFiltro: 'PAGAMENTO', ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 2000, 30),
        )).then((r) => r.flat()),
        Promise.all(scopeCodes.map((ec) =>
          fetchAllPages((p) => fetchCartaoRemessa({ empresaCodigo: ec, dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 2000, 30),
        )).then((r) => r.flat()).catch(() => [] as CartaoRemessa[]),
        Promise.all(scopeCodes.map((ec) =>
          fetchAllPages((p) => fetchAdministradoras({ empresaCodigo: ec, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 5),
        )).then((r) => r.flat()),
      ])

      const tipoOfCode = new Map<number, string>()
      const descOfCode = new Map<number, string>()
      for (const a of admAll) {
        tipoOfCode.set(a.administradoraCodigo, a.tipo || '')
        if (a.descricao) descOfCode.set(a.administradoraCodigo, a.descricao)
      }
      for (const c of cartaoAll) {
        if (!descOfCode.has(c.administradoraCodigo) && c.adiministradoraDescricao) descOfCode.set(c.administradoraCodigo, c.adiministradoraDescricao)
      }
      const descOf = (code: number, fallback?: string) => descOfCode.get(code) || fallback || `Adm ${code}`

      const remessa = remessaAll.map(normalizeRemessa).filter((r) => r.data)
      const hoje = todayLocal()
      const fimEfetivo = dataFinal > hoje ? hoje : dataFinal
      const ediUpTo = remessa.length ? remessa.reduce((mx, r) => (r.data > mx ? r.data : mx), remessa[0].data) : null
      // Cobertura do EDI POR POSTO — cada posto tem seu próprio carregamento; usar
      // o máximo da rede faria um posto "pegar carona" na cobertura de outro e
      // virar "sem repasse" um dia que, pra ele, ainda está aguardando.
      const ediUpToByEmp = new Map<number, string>()
      for (const r of remessa) {
        const cur = ediUpToByEmp.get(r.empresaCodigo)
        if (!cur || r.data > cur) ediUpToByEmp.set(r.empresaCodigo, r.data)
      }
      const diasTotal = Math.max(1, diffDays(dataInicial, fimEfetivo) + 1)
      const diasCobertos = ediUpTo ? Math.max(0, Math.min(diasTotal, diffDays(dataInicial, ediUpTo) + 1)) : 0
      const pctPeriodo = Math.round((diasCobertos / diasTotal) * 100)
      // Bandeiras (por posto) que tiveram QUALQUER repasse — separa "não
      // localizado no EDI" de "vencido sem nenhum repasse".
      const bandeirasComRepasse = new Set(remessa.map((r) => `${r.empresaCodigo}||${descOf(r.administradoraCodigo, r.descricao)}`))

      // Agrega por POSTO × bandeira × dia de liquidação.
      const cells = new Map<string, Cell>()
      const getCell = (empresaCodigo: number, bandeira: string, tipo: string, dia: string): Cell => {
        const key = `${empresaCodigo}||${bandeira}||${dia}`
        let c = cells.get(key)
        if (!c) { c = { key, empresaCodigo, bandeira, tipo, dia, brutoSistema: 0, brutoRepasse: 0, liquido: 0, taxaRsAcc: 0, rows: [] }; cells.set(key, c) }
        return c
      }
      for (const c of cartaoAll) {
        const dia = diaLiquidacao(c)
        if (!dia) continue
        const bandeira = descOf(c.administradoraCodigo, c.adiministradoraDescricao)
        const cell = getCell(c.empresaCodigo, bandeira, tipoOfCode.get(c.administradoraCodigo) || '', dia)
        cell.brutoSistema += c.valor
        cell.rows.push(c)
      }
      for (const r of remessa) {
        const bandeira = descOf(r.administradoraCodigo, r.descricao)
        const cell = getCell(r.empresaCodigo, bandeira, tipoOfCode.get(r.administradoraCodigo) || '', r.data)
        cell.brutoRepasse += r.bruto
        cell.liquido += r.liquido
        cell.taxaRsAcc += r.taxaRs
      }

      const classify = (cell: Cell): { status: StatusKind; motivo?: MotivoKind } => {
        if (cell.brutoRepasse > 0) {
          if (Math.abs(cell.brutoSistema - cell.brutoRepasse) > TOL) return { status: 'valor_divergente' }
          // Espelha o WebPosto: lote vinculado E o bom-para (dia de crédito) já
          // passou = CONCILIADO; se o crédito ainda é futuro = VINCULADO (a creditar).
          return { status: cell.dia > hoje ? 'a_creditar' : 'conciliado' }
        }
        const ediPosto = ediUpToByEmp.get(cell.empresaCodigo) ?? null
        if (!ediPosto || cell.dia > ediPosto) return { status: 'aguardando' }
        return { status: 'sem_repasse', motivo: bandeirasComRepasse.has(`${cell.empresaCodigo}||${cell.bandeira}`) ? 'sem_repasse_nao_localizado' : 'sem_repasse_vencido' }
      }

      // ── Revisão automática (lote deslocado, ±REV_JANELA dias, mesmo posto) ──
      const recoveredKeys = new Set<string>()
      const consumedKeys = new Set<string>()
      const recuperados = { n: 0, valor: 0 }
      {
        const livres = [...cells.values()].filter((c) => c.brutoRepasse > 0 && c.brutoSistema === 0)
        const need = [...cells.values()].filter((c) => classify(c).status === 'sem_repasse').sort((a, b) => a.dia.localeCompare(b.dia))
        for (const nc of need) {
          const lote = livres.find((l) => !consumedKeys.has(l.key) && l.empresaCodigo === nc.empresaCodigo && l.bandeira === nc.bandeira && Math.abs(diffDays(nc.dia, l.dia)) <= REV_JANELA && Math.abs(l.brutoRepasse - nc.brutoSistema) <= TOL)
          if (!lote) continue
          consumedKeys.add(lote.key); recoveredKeys.add(nc.key)
          nc.revBruto = lote.brutoRepasse; nc.revLiquido = lote.liquido; nc.revTaxaRs = lote.taxaRsAcc
          recuperados.n++; recuperados.valor += nc.brutoSistema
        }
      }

      // Vendedor das vendas em "sem repasse" na BASE (superset das duas views).
      const baseSemRepasse = [...cells.values()].filter((c) => classify(c).status === 'sem_repasse')
      const vendaCodigosPorEmpresa = new Map<number, Set<number>>()
      for (const cell of baseSemRepasse) for (const c of cell.rows) {
        const set = vendaCodigosPorEmpresa.get(c.empresaCodigo) ?? new Set<number>()
        set.add(c.vendaCodigo); vendaCodigosPorEmpresa.set(c.empresaCodigo, set)
      }
      const vendedorPorVenda = new Map<number, string>()
      if (vendaCodigosPorEmpresa.size > 0) {
        const [vendas, funcs] = await Promise.all([
          // /VENDA por vendaCodigo SEM datas (a venda foi emitida antes da liquidação), em lotes.
          Promise.all([...vendaCodigosPorEmpresa.entries()].flatMap(([ec, set]) => {
            const codes = [...set]
            const chunks: number[][] = []
            for (let i = 0; i < codes.length; i += 150) chunks.push(codes.slice(i, i + 150))
            return chunks.map((ch) => fetchVendas({ empresaCodigo: ec, vendaCodigo: ch, limite: 2000 }).then((r) => r.resultados).catch(() => []))
          })).then((r) => r.flat()),
          Promise.all(scopeCodes.map((ec) =>
            fetchAllPages((p) => fetchFuncionarios({ empresaCodigo: ec, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 5),
          )).then((r) => r.flat()).catch(() => []),
        ])
        const nomeFunc = new Map<number, string>()
        for (const f of funcs) nomeFunc.set(f.funcionarioCodigo, f.nome)
        for (const v of vendas) vendedorPorVenda.set(v.vendaCodigo, nomeFunc.get(v.funcionarioCodigo) || '—')
      }

      const buildView = (revisado: boolean): CartoesView => {
        const adminDia: AdminDiaRow[] = []
        const kpis = { conciliado: { valor: 0, registros: 0 }, semConciliar: { valor: 0, registros: 0 }, aguardando: { valor: 0, registros: 0 }, conciliavelTotal: 0, pctConciliavel: 0 }
        const semRepasse: DetalheItem[] = []
        const divergencias: DivergenciaLote[] = []
        const vendasPendentes = new Set<number>()

        for (const cell of cells.values()) {
          let status: StatusKind, motivo: MotivoKind | undefined, rev = false
          let bruto = cell.brutoRepasse, liquido = cell.liquido, taxaRs = cell.taxaRsAcc
          if (revisado && consumedKeys.has(cell.key)) continue
          if (revisado && recoveredKeys.has(cell.key)) {
            status = 'conciliado'; rev = true
            bruto = cell.revBruto ?? 0; liquido = cell.revLiquido ?? 0; taxaRs = cell.revTaxaRs ?? 0
          } else {
            const c = classify(cell); status = c.status; motivo = c.motivo
          }
          adminDia.push({
            key: cell.key, empresaCodigo: cell.empresaCodigo, bandeira: cell.bandeira, tipo: cell.tipo, dia: cell.dia,
            brutoSistema: cell.brutoSistema, brutoRepasse: bruto, delta: cell.brutoSistema - bruto,
            taxaPct: bruto > 0 ? (taxaRs / bruto) * 100 : 0, liquido, status, revisao: rev,
          })
          if (status === 'conciliado') { kpis.conciliado.valor += cell.brutoSistema; kpis.conciliado.registros += cell.rows.length }
          else if (status === 'aguardando' || status === 'a_creditar') { kpis.aguardando.valor += cell.brutoSistema; kpis.aguardando.registros += cell.rows.length }
          else if (status === 'sem_repasse' && motivo) {
            kpis.semConciliar.valor += cell.brutoSistema; kpis.semConciliar.registros += cell.rows.length
            const texto = motivo === 'sem_repasse_nao_localizado' ? 'repasse vencido, não localizado no EDI' : `sem repasse do adquirente (vencido em ${ddmm(cell.dia)})`
            for (const c of cell.rows) {
              vendasPendentes.add(c.vendaCodigo)
              semRepasse.push({
                empresaCodigo: c.empresaCodigo, vendaCodigo: c.vendaCodigo, valor: c.valor, bandeira: cell.bandeira,
                vendedor: vendedorPorVenda.get(c.vendaCodigo) || '—', dia: diaVenda(c), diaLiq: cell.dia,
                aut: c.autorizacao || '—', nsu: c.nsu || c.nsuTef || '—', motivo, motivoTexto: texto,
              })
            }
          } else if (status === 'valor_divergente') {
            const delta = cell.brutoSistema - cell.brutoRepasse
            kpis.semConciliar.valor += Math.abs(delta); kpis.semConciliar.registros += 1
            divergencias.push({
              key: cell.key, empresaCodigo: cell.empresaCodigo, bandeira: cell.bandeira, diaLiq: cell.dia,
              sistema: cell.brutoSistema, repasse: cell.brutoRepasse, delta, registros: cell.rows.length,
            })
          }
        }
        kpis.conciliavelTotal = kpis.conciliado.valor + kpis.semConciliar.valor
        kpis.pctConciliavel = kpis.conciliavelTotal > 0 ? (kpis.conciliado.valor / kpis.conciliavelTotal) * 100 : 0
        adminDia.sort((a, b) => (a.dia === b.dia ? b.brutoSistema - a.brutoSistema : b.dia.localeCompare(a.dia)))
        semRepasse.sort((a, b) => b.diaLiq.localeCompare(a.diaLiq))
        divergencias.sort((a, b) => b.diaLiq.localeCompare(a.diaLiq))
        return { adminDia, kpis, semRepasse, divergencias, vendasPendentes: [...vendasPendentes] }
      }

      return {
        coverage: { ediUpTo, pctPeriodo, diasCobertos, diasTotal },
        base: buildView(false),
        revisao: { ...buildView(true), recuperados },
        temRemessa: remessa.length > 0,
      }
    },
  })

  return { ...query, scopeCodes }
}

export default useCartoesConciliacao
