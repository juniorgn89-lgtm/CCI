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
 * Cruza o RECEBÍVEL do sistema (/CARTAO, buscado por `dataFiltro='PAGAMENTO'`,
 * agregado por administradora × dia de LIQUIDAÇÃO = `dataPagamento`) com o
 * REPASSE do adquirente/EDI (/CARTAO_REMESSA, por administradora × `dataRemessa`).
 * Eixo validado em sondagem ao vivo: Σ valorRemessa == Σ /CARTAO.valor por
 * administradora×dia (Δ 0,00 em todas as bandeiras).
 *
 * A IA CLASSIFICA (não recalcula valor):
 *  - Conciliado         → existe lote e o valor bate (tolerância TOL).
 *  - Valor divergente    → existe lote, mas o valor diverge (> TOL). [sem conciliar]
 *  - Sem repasse         → o EDI já cobre o dia e o lote NÃO está lá. [sem conciliar]
 *  - Aguardando repasse  → o EDI ainda não foi carregado até aquele dia. NUNCA
 *                          divergência — EDI vazio degrada tudo pra aguardando.
 *
 * Divergência de TAXA (cobrada ≠ contratada) fica FORA da Fase 1 — a taxa
 * contratada não está na API. A taxa exibida é a APLICADA (taxasDespesas do EDI).
 */

const TOL = 1.0 // tolerância de valor por administradora×dia (R$).

export type StatusKind = 'conciliado' | 'valor_divergente' | 'sem_repasse' | 'aguardando'
export type MotivoKind = 'sem_repasse_vencido' | 'sem_repasse_nao_localizado' | 'valor_divergente'

export interface AdminDiaRow {
  key: string
  bandeira: string
  tipo: string
  dia: string
  brutoSistema: number
  brutoRepasse: number
  delta: number
  taxaPct: number
  liquido: number
  status: StatusKind
}

export interface DetalheItem {
  vendaCodigo: number
  valor: number
  bandeira: string
  vendedor: string
  dia: string
  aut: string
  nsu: string
  motivoTexto: string
}

export interface DetalheGrupo {
  grupo: 'sem_repasse' | 'valor_divergente'
  label: string
  itens: DetalheItem[]
}

export interface CartoesResult {
  coverage: { ediUpTo: string | null; pctPeriodo: number; diasCobertos: number; diasTotal: number }
  kpis: {
    conciliado: { valor: number; registros: number }
    semConciliar: { valor: number; registros: number }
    aguardando: { valor: number; registros: number }
    conciliavelTotal: number
    pctConciliavel: number
  }
  adminDia: AdminDiaRow[]
  detalhe: DetalheGrupo[]
  temRemessa: boolean
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const diffDays = (a: string, b: string): number => {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

/** Normaliza uma linha do /CARTAO_REMESSA (campos confirmados em sondagem). */
const normalizeRemessa = (r: CartaoRemessa) => ({
  empresaCodigo: r.empresaCodigo,
  administradoraCodigo: r.administradoraCodigo,
  descricao: r.administradora ?? '',
  data: (r.dataRemessa ?? '').slice(0, 10),
  bruto: r.valorRemessa ?? 0,
  liquido: r.valorLiquido ?? 0,
  taxaRs: r.taxasDespesas ?? 0,
})

/** Dia de LIQUIDAÇÃO do recebível (casa com dataRemessa do EDI). */
const diaLiquidacao = (c: Cartao) => (c.dataPagamento || c.vencimento || '').slice(0, 10)
/** Dia da VENDA (pra identificar a venda no detalhe/ERP). */
const diaVenda = (c: Cartao) => (c.dataMovimento || c.dataFiscal || '').slice(0, 10)

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
      // ── 1. Leituras reais (GET), por empresa (padrão do /CARTAO, alto volume) ──
      const [cartaoAll, remessaAll, admAll] = await Promise.all([
        // Recebível pelo dia de LIQUIDAÇÃO (dataPagamento) — eixo da conciliação.
        Promise.all(scopeCodes.map((ec) =>
          fetchAllPages((p) => fetchCartao({ empresaCodigo: ec, dataInicial, dataFinal, dataFiltro: 'PAGAMENTO', ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 2000, 30),
        )).then((r) => r.flat()),
        // Repasse do EDI (default filtra por dataRemessa). Falha → degrada honesto.
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

      // ── 2. Cobertura do EDI (max dataRemessa vs período) ──
      const remessa = remessaAll.map(normalizeRemessa).filter((r) => r.data)
      const hoje = todayLocal()
      const fimEfetivo = dataFinal > hoje ? hoje : dataFinal
      const ediUpTo = remessa.length ? remessa.reduce((mx, r) => (r.data > mx ? r.data : mx), remessa[0].data) : null
      const diasTotal = Math.max(1, diffDays(dataInicial, fimEfetivo) + 1)
      const diasCobertos = ediUpTo ? Math.max(0, Math.min(diasTotal, diffDays(dataInicial, ediUpTo) + 1)) : 0
      const pctPeriodo = Math.round((diasCobertos / diasTotal) * 100)
      // Bandeiras que tiveram QUALQUER repasse no período (pra separar "não
      // localizado no EDI" de "vencido sem repasse").
      const bandeirasComRepasse = new Set(remessa.map((r) => descOf(r.administradoraCodigo, r.descricao)))

      // ── 3. Agrega SISTEMA e REPASSE por bandeira × dia de liquidação ──
      interface Cell {
        bandeira: string
        tipo: string
        dia: string
        brutoSistema: number
        brutoRepasse: number
        liquido: number
        taxaRsAcc: number
        rows: Cartao[]
      }
      const cells = new Map<string, Cell>()
      const getCell = (bandeira: string, tipo: string, dia: string): Cell => {
        const key = `${bandeira}||${dia}`
        let c = cells.get(key)
        if (!c) { c = { bandeira, tipo, dia, brutoSistema: 0, brutoRepasse: 0, liquido: 0, taxaRsAcc: 0, rows: [] }; cells.set(key, c) }
        return c
      }
      for (const c of cartaoAll) {
        const dia = diaLiquidacao(c)
        if (!dia) continue
        const bandeira = descOf(c.administradoraCodigo, c.adiministradoraDescricao)
        const tipo = tipoOfCode.get(c.administradoraCodigo) || ''
        const cell = getCell(bandeira, tipo, dia)
        cell.brutoSistema += c.valor
        if (!cell.tipo && tipo) cell.tipo = tipo
        cell.rows.push(c)
      }
      for (const r of remessa) {
        const bandeira = descOf(r.administradoraCodigo, r.descricao)
        const tipo = tipoOfCode.get(r.administradoraCodigo) || ''
        const cell = getCell(bandeira, tipo, r.data)
        cell.brutoRepasse += r.bruto
        cell.liquido += r.liquido
        cell.taxaRsAcc += r.taxaRs
      }

      // ── 4. Classificação determinística ──
      const classify = (cell: Cell): { status: StatusKind; motivo?: MotivoKind } => {
        if (cell.brutoRepasse > 0) {
          return Math.abs(cell.brutoSistema - cell.brutoRepasse) <= TOL
            ? { status: 'conciliado' }
            : { status: 'valor_divergente', motivo: 'valor_divergente' }
        }
        // Sem lote: o EDI já foi carregado até este dia?
        if (!ediUpTo || cell.dia > ediUpTo) return { status: 'aguardando' } // EDI não chegou → nunca divergência
        // EDI cobre o dia e o lote não está: se a bandeira teve outros repasses, é
        // "não localizado no EDI"; senão, "sem repasse (vencido)".
        return { status: 'sem_repasse', motivo: bandeirasComRepasse.has(cell.bandeira) ? 'sem_repasse_nao_localizado' : 'sem_repasse_vencido' }
      }

      const adminDia: AdminDiaRow[] = []
      const kpis = {
        conciliado: { valor: 0, registros: 0 },
        semConciliar: { valor: 0, registros: 0 },
        aguardando: { valor: 0, registros: 0 },
        conciliavelTotal: 0,
        pctConciliavel: 0,
      }
      const semRepasse: DetalheItem[] = []
      const valorDiv: DetalheItem[] = []
      const vendaCodigosPorEmpresa = new Map<number, Set<number>>()
      const pendentesRows: { c: Cartao; bandeira: string; grupo: 'sem_repasse' | 'valor_divergente'; motivoTexto: string }[] = []

      for (const cell of cells.values()) {
        const { status, motivo } = classify(cell)
        adminDia.push({
          key: `${cell.bandeira}||${cell.dia}`,
          bandeira: cell.bandeira,
          tipo: cell.tipo,
          dia: cell.dia,
          brutoSistema: cell.brutoSistema,
          brutoRepasse: cell.brutoRepasse,
          delta: cell.brutoSistema - cell.brutoRepasse,
          taxaPct: cell.brutoRepasse > 0 ? (cell.taxaRsAcc / cell.brutoRepasse) * 100 : 0,
          liquido: cell.liquido,
          status,
        })

        if (status === 'conciliado') {
          kpis.conciliado.valor += cell.brutoSistema
          kpis.conciliado.registros += cell.rows.length
        } else if (status === 'aguardando') {
          kpis.aguardando.valor += cell.brutoSistema
          kpis.aguardando.registros += cell.rows.length
        } else {
          kpis.semConciliar.valor += cell.brutoSistema
          kpis.semConciliar.registros += cell.rows.length
          const motivoTexto =
            motivo === 'valor_divergente'
              ? `valor do lote divergente (Δ ${fmtSigned(cell.brutoSistema - cell.brutoRepasse)} no dia)`
              : motivo === 'sem_repasse_nao_localizado'
                ? 'repasse vencido, não localizado no EDI'
                : `sem repasse do adquirente (vencido em ${ddmm(cell.dia)})`
          const grupo = motivo === 'valor_divergente' ? 'valor_divergente' : 'sem_repasse'
          for (const c of cell.rows) {
            pendentesRows.push({ c, bandeira: cell.bandeira, grupo, motivoTexto })
            const set = vendaCodigosPorEmpresa.get(c.empresaCodigo) ?? new Set<number>()
            set.add(c.vendaCodigo)
            vendaCodigosPorEmpresa.set(c.empresaCodigo, set)
          }
        }
      }
      kpis.conciliavelTotal = kpis.conciliado.valor + kpis.semConciliar.valor
      kpis.pctConciliavel = kpis.conciliavelTotal > 0 ? (kpis.conciliado.valor / kpis.conciliavelTotal) * 100 : 0

      // ── 5. Vendedor das vendas não conciliadas (join /VENDA + /FUNCIONARIO) ──
      const vendedorPorVenda = new Map<number, string>()
      if (vendaCodigosPorEmpresa.size > 0) {
        const [vendas, funcs] = await Promise.all([
          Promise.all([...vendaCodigosPorEmpresa.entries()].map(([ec, set]) =>
            fetchVendas({ empresaCodigo: ec, dataInicial, dataFinal, vendaCodigo: [...set], limite: 2000 }).then((r) => r.resultados).catch(() => []),
          )).then((r) => r.flat()),
          Promise.all(scopeCodes.map((ec) =>
            fetchAllPages((p) => fetchFuncionarios({ empresaCodigo: ec, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 5),
          )).then((r) => r.flat()).catch(() => []),
        ])
        const nomeFunc = new Map<number, string>()
        for (const f of funcs) nomeFunc.set(f.funcionarioCodigo, f.nome)
        for (const v of vendas) vendedorPorVenda.set(v.vendaCodigo, nomeFunc.get(v.funcionarioCodigo) || '—')
      }

      for (const p of pendentesRows) {
        const item: DetalheItem = {
          vendaCodigo: p.c.vendaCodigo,
          valor: p.c.valor,
          bandeira: p.bandeira,
          vendedor: vendedorPorVenda.get(p.c.vendaCodigo) || '—',
          dia: diaVenda(p.c),
          aut: p.c.autorizacao || '—',
          nsu: p.c.nsu || p.c.nsuTef || '—',
          motivoTexto: p.motivoTexto,
        }
        if (p.grupo === 'valor_divergente') valorDiv.push(item)
        else semRepasse.push(item)
      }

      adminDia.sort((a, b) => (a.dia === b.dia ? b.brutoSistema - a.brutoSistema : b.dia.localeCompare(a.dia)))
      const detalhe: DetalheGrupo[] = []
      if (semRepasse.length) detalhe.push({ grupo: 'sem_repasse', label: 'Sem repasse (vencido)', itens: semRepasse.sort((a, b) => b.dia.localeCompare(a.dia)) })
      if (valorDiv.length) detalhe.push({ grupo: 'valor_divergente', label: 'Valor divergente', itens: valorDiv.sort((a, b) => b.dia.localeCompare(a.dia)) })

      return {
        coverage: { ediUpTo, pctPeriodo, diasCobertos, diasTotal },
        kpis,
        adminDia,
        detalhe,
        temRemessa: remessa.length > 0,
      }
    },
  })

  return { ...query, scopeCodes }
}

/** "+R$ 12,34" / "−R$ 12,34" (sinal explícito). */
const fmtSigned = (v: number): string => {
  const abs = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${v < 0 ? '−' : '+'}R$ ${abs}`
}

export default useCartoesConciliacao
