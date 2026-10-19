import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCartao, fetchAdministradoras } from '@/api/endpoints/financeiro'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useFilterStore } from '@/store/filters'
import type { Cartao, Administradora } from '@/api/types/financeiro'

/**
 * Carteira de CARTÕES E APPS a receber (recebíveis pendentes do /CARTAO), por
 * posto do escopo. Busca POR EMPRESA (o /CARTAO honra empresaCodigo e o
 * rede-wide trunca os meses recentes no teto de paginação — ver memória).
 * Líquido = bruto − taxa arredondada por linha (igual ao WebPosto). O tipo
 * real (Crédito/Débito/PIX/Carteira) vem do /ADMINISTRADORA; a descrição da
 * administradora é o fallback.
 *
 * Snapshot: independe do filtro de data da tela (é "o que está pendente agora").
 */

export type Modalidade = 'Crédito' | 'Débito' | 'PIX' | 'Carteira Digital' | 'Vale' | 'Outros'

export interface CartaoPend {
  id: string
  empresaCodigo: number
  administradoraCodigo: number
  administradora: string
  modalidade: Modalidade
  vencimento: string
  movimento: string
  bruto: number
  taxaPct: number
  taxaValor: number
  liquido: number
  diasAtraso: number
  /** vencido = antes de hoje e ainda pendente. */
  vencido: boolean
  cliente: string
  nsu: string
  parcela: number
}

export interface AdminAgg {
  chave: string
  administradora: string
  modalidade: Modalidade
  empresas: Set<number>
  qtd: number
  bruto: number
  taxaValor: number
  liquido: number
  vencidoQtd: number
  vencidoLiquido: number
  maisAntigoDias: number
  /** Taxa praticada média ponderada (%). */
  taxaPraticada: number
  /** Taxa contratada no cadastro (%), quando houver. */
  taxaContrato: number | null
  /** Prazo médio real: vencimento − movimento (dias). */
  prazoMedio: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const addDays = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(y, m - 1, d + n); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` }
const onlyDate = (s: string) => (s ?? '').split('T')[0]
const diffDays = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000)

const CARD_BRAND_RE = /VISA|MASTERCARD|MASTER|ELO|MAESTRO|AMERICAN EXPRESS|AMEX|HIPERCARD|HIPER|DINERS|CABAL|SOROCRED|BANESCARD/
/** Modalidade pelo cadastro (/ADMINISTRADORA.tipo) ou, sem cadastro, pela descrição. */
const modalidadeDe = (tipoCadastro: string | undefined, descricao: string): Modalidade => {
  const t = (tipoCadastro ?? '').toUpperCase()
  if (t.includes('CRED')) return 'Crédito'
  if (t.includes('DEB')) return 'Débito'
  if (t.includes('PIX')) return 'PIX'
  if (t.includes('CARTEIRA') || t.includes('DIGITAL')) return 'Carteira Digital'
  if (t.includes('VALE')) return 'Vale'
  const u = (descricao ?? '').toUpperCase()
  if (u.includes('CRED')) return 'Crédito'
  if (u.includes('DEB') || u.includes('MAESTRO')) return 'Débito'
  if (u.includes('PIX')) return 'PIX'
  if (CARD_BRAND_RE.test(u)) return 'Crédito'
  if (u.includes('VALE') || u.includes('TICKET') || u.includes('ALELO') || u.includes('SODEXO')) return 'Vale'
  if (u.includes('DIGITAL') || u.includes('CARTEIRA') || u.includes('APP') || u.includes('PAY')) return 'Carteira Digital'
  return 'Outros'
}

const PAGINA = 2000
const MAX_PAGINAS = 30

const useCartoesAReceber = () => {
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const permitidas = useEmpresasPermitidas(
    useMemo(() => (empresasData?.resultados ?? []).map((e) => ({ codigo: e.empresaCodigo, nome: e.fantasia || e.razao || `Posto ${e.empresaCodigo}` })), [empresasData]),
  )
  const scopeCodes = useMemo(() => {
    const base = permitidas.map((e) => e.codigo)
    return empresaCodigos.length > 0 ? base.filter((c) => empresaCodigos.includes(c)) : base
  }, [permitidas, empresaCodigos])
  const empresaNome = useMemo(() => new Map(permitidas.map((e) => [e.codigo, e.nome])), [permitidas])

  const hoje = todayISO()
  const inicio = addDays(hoje, -1095)

  const q = useQuery({
    queryKey: ['cartoes-a-receber', scopeCodes.join(','), hoje],
    enabled: scopeCodes.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const porEmpresa = await Promise.all(scopeCodes.map(async (ec) => {
        const [cartoes, admins] = await Promise.all([
          fetchAllPages<Cartao>((p) => fetchCartao({ empresaCodigo: ec, dataInicial: inicio, dataFinal: hoje, apenasPendente: true, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), PAGINA, MAX_PAGINAS),
          fetchAllPages<Administradora>((p) => fetchAdministradoras({ empresaCodigo: ec, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 5),
        ])
        // Honestidade: se encheu todas as páginas, pode ter ficado recebível de fora.
        const truncado = cartoes.length >= PAGINA * MAX_PAGINAS
        return { ec, cartoes, admins, truncado }
      }))
      return porEmpresa
    },
  })

  const resultado = useMemo(() => {
    const dados = q.data ?? []
    const adminTipo = new Map<string, Administradora>()
    for (const d of dados) for (const a of d.admins) adminTipo.set(`${d.ec}-${a.administradoraCodigo}`, a)

    const itens: CartaoPend[] = []
    let truncadas: number[] = []
    for (const d of dados) {
      if (d.truncado) truncadas = [...truncadas, d.ec]
      for (const c of d.cartoes) {
        if (!c.pendente) continue
        const venc = onlyDate(c.vencimento)
        const mov = onlyDate(c.dataMovimento)
        const adm = adminTipo.get(`${c.empresaCodigo}-${c.administradoraCodigo}`)
        const bruto = c.valor ?? 0
        const taxaPct = c.taxaPercentual ?? 0
        const taxaValor = Math.round((bruto * taxaPct / 100) * 100) / 100
        const vencido = !!venc && venc < hoje
        itens.push({
          id: `${c.empresaCodigo}-${c.codigo}`,
          empresaCodigo: c.empresaCodigo,
          administradoraCodigo: c.administradoraCodigo,
          administradora: (adm?.descricao || c.adiministradoraDescricao || 'Administradora').trim(),
          modalidade: modalidadeDe(adm?.tipo, c.adiministradoraDescricao),
          vencimento: venc,
          movimento: mov,
          bruto,
          taxaPct,
          taxaValor,
          liquido: bruto - taxaValor,
          diasAtraso: vencido ? diffDays(venc, hoje) : 0,
          vencido,
          cliente: (c.clienteRazao || c.clienteReferencia || '').trim(),
          nsu: c.nsu || c.autorizacao || '',
          parcela: c.parcela ?? 1,
        })
      }
    }

    // Por administradora (modalidade junto, pra não misturar débito e crédito da mesma bandeira).
    const porAdmin = new Map<string, AdminAgg & { somaPrazo: number; somaTaxaPonderada: number }>()
    for (const it of itens) {
      const chave = `${it.administradora}|${it.modalidade}`
      const adm = adminTipo.get(`${it.empresaCodigo}-${it.administradoraCodigo}`)
      const g = porAdmin.get(chave) ?? {
        chave, administradora: it.administradora, modalidade: it.modalidade, empresas: new Set<number>(),
        qtd: 0, bruto: 0, taxaValor: 0, liquido: 0, vencidoQtd: 0, vencidoLiquido: 0, maisAntigoDias: 0,
        taxaPraticada: 0, taxaContrato: adm ? adm.percentualComissao : null, prazoMedio: 0, somaPrazo: 0, somaTaxaPonderada: 0,
      }
      g.empresas.add(it.empresaCodigo)
      g.qtd++; g.bruto += it.bruto; g.taxaValor += it.taxaValor; g.liquido += it.liquido
      g.somaTaxaPonderada += it.taxaPct * it.bruto
      if (it.movimento && it.vencimento) g.somaPrazo += Math.max(0, diffDays(it.movimento, it.vencimento))
      if (it.vencido) { g.vencidoQtd++; g.vencidoLiquido += it.liquido; g.maisAntigoDias = Math.max(g.maisAntigoDias, it.diasAtraso) }
      if (g.taxaContrato === null && adm) g.taxaContrato = adm.percentualComissao
      porAdmin.set(chave, g)
    }
    const administradoras: AdminAgg[] = Array.from(porAdmin.values()).map((g) => ({
      ...g,
      taxaPraticada: g.bruto > 0 ? g.somaTaxaPonderada / g.bruto : 0,
      prazoMedio: g.qtd > 0 ? g.somaPrazo / g.qtd : 0,
    })).sort((a, b) => b.liquido - a.liquido)

    const porModalidade = new Map<Modalidade, { qtd: number; bruto: number; liquido: number; vencidoLiquido: number }>()
    for (const it of itens) {
      const m = porModalidade.get(it.modalidade) ?? { qtd: 0, bruto: 0, liquido: 0, vencidoLiquido: 0 }
      m.qtd++; m.bruto += it.bruto; m.liquido += it.liquido; if (it.vencido) m.vencidoLiquido += it.liquido
      porModalidade.set(it.modalidade, m)
    }

    const totais = itens.reduce((s, it) => ({
      qtd: s.qtd + 1, bruto: s.bruto + it.bruto, taxa: s.taxa + it.taxaValor, liquido: s.liquido + it.liquido,
      vencidoQtd: s.vencidoQtd + (it.vencido ? 1 : 0), vencidoLiquido: s.vencidoLiquido + (it.vencido ? it.liquido : 0),
      hojeLiquido: s.hojeLiquido + (it.vencimento === hoje ? it.liquido : 0),
      d7Liquido: s.d7Liquido + (it.vencimento > hoje && it.vencimento <= addDays(hoje, 7) ? it.liquido : 0),
    }), { qtd: 0, bruto: 0, taxa: 0, liquido: 0, vencidoQtd: 0, vencidoLiquido: 0, hojeLiquido: 0, d7Liquido: 0 })

    return { itens, administradoras, porModalidade, totais, truncadas, empresaNome, hoje }
  }, [q.data, hoje, empresaNome])

  return { ...resultado, isLoading: q.isLoading, isError: q.isError, erro: q.error instanceof Error ? q.error.message : null, scopeCodes }
}

export default useCartoesAReceber
