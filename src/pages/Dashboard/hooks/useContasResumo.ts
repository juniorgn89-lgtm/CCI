import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchTitulosReceber, fetchTitulosPagar, fetchCartao, fetchAdministradoras } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { TituloReceber, TituloPagar, Cartao } from '@/api/types/financeiro'
import { isApp } from '@/pages/Financeiro/lib/instrumentos'
import useScopedEmpresaCodes from '@/pages/Financeiro/hooks/useScopedEmpresaCodes'
import { fetchEmpresas } from '@/api/endpoints/empresas'

/**
 * Resumo de contas a pagar × a receber pra Central (Visão Geral): faixas de
 * vencimento (vencidas / hoje / 7 dias / 8–30 dias / depois) e categorias, dos
 * dois lados. Reusa as MESMAS chaves e parâmetros de busca do useFinanceData
 * (snapshots de pendentes), então o cache é compartilhado com a aba Financeiro
 * e a Central não paga a busca duas vezes.
 */

export type Bucket = 'vencidas' | 'hoje' | 'd7' | 'd30'
export type Horizonte = Bucket | 'depois'

/** Um título/cartão em aberto, com o que o modal precisa listar (sem nova busca). */
export interface ContaItem {
  id: string
  lado: 'receber' | 'pagar'
  /** Vencimento yyyy-MM-dd. */
  venc: string
  /** Valor em aberto (cartão: líquido de taxa; pagar: saldo). */
  valor: number
  cat: string
  catLabel: string
  /** Fornecedor, cliente ou administradora. */
  nome: string
  empresaCodigo: number
  posto: string
  /** Número do título, documento ou NSU. */
  documento: string
  /** Linha secundária (descrição, tipo, bandeira/parcela). */
  detalhe: string
  /** Cartões: valor bruto antes da taxa. */
  bruto?: number
  horizonte: Horizonte
}
export interface Faixa { total: number; count: number }
export interface Categoria {
  id: string
  label: string
  dot: string
  vencidas: number
  hoje: number
  aVencer: number
  total: number
  count: number
}
export interface LadoResumo {
  buckets: Record<Bucket, Faixa>
  depois30: Faixa
  categorias: Categoria[]
  /** Tudo em aberto (janela + depois de 30 dias). */
  tudo: Faixa
}

const FRESH_SNAPSHOT = {
  staleTime: 30_000,
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
  placeholderData: keepPreviousData,
} as const

const todayISO = () => new Date().toISOString().split('T')[0]
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const onlyDate = (s: string) => (s ?? '').split('T')[0]

const RECEBER_CATS: { id: string; label: string; dot: string }[] = [
  { id: 'cartoes', label: 'Cartões', dot: 'bg-blue-500' },
  { id: 'apps', label: 'Apps e PIX', dot: 'bg-teal-500' },
  { id: 'notas', label: 'Notas a prazo', dot: 'bg-emerald-500' },
  { id: 'faturas', label: 'Faturas', dot: 'bg-violet-500' },
  { id: 'outros', label: 'Outros', dot: 'bg-gray-400' },
]
const PAGAR_CATS: { id: string; label: string; dot: string }[] = [
  { id: 'boleto', label: 'Boleto', dot: 'bg-violet-500' },
  { id: 'tributo', label: 'Tributo', dot: 'bg-red-500' },
  { id: 'pix', label: 'PIX', dot: 'bg-emerald-500' },
  { id: 'transferencia', label: 'Transferência', dot: 'bg-blue-500' },
  { id: 'convenio', label: 'Convênio', dot: 'bg-amber-500' },
  { id: 'outros', label: 'Outros', dot: 'bg-gray-400' },
]

const catPagar = (tipoLancamento: string | undefined): string => {
  const tl = (tipoLancamento ?? '').toUpperCase()
  if (tl === 'BOLETO') return 'boleto'
  if (tl === 'TRIBUTO') return 'tributo'
  if (tl === 'PIX') return 'pix'
  if (tl === 'TED' || tl === 'DOC' || tl === 'CREDITO_CONTA') return 'transferencia'
  if (tl === 'CONVENIO') return 'convenio'
  return 'outros'
}

type Item = ContaItem

/** Faixa de vencimento de uma data em relação a hoje. */
export const horizonteDe = (venc: string, hoje: string): Horizonte => {
  if (!venc) return 'depois'
  if (venc < hoje) return 'vencidas'
  if (venc === hoje) return 'hoje'
  if (venc <= addDays(hoje, 7)) return 'd7'
  if (venc <= addDays(hoje, 30)) return 'd30'
  return 'depois'
}

const resumir = (itens: Item[], cats: { id: string; label: string; dot: string }[], hoje: string): LadoResumo => {
  const d7 = addDays(hoje, 7)
  const d30 = addDays(hoje, 30)
  const faixa = (): Faixa => ({ total: 0, count: 0 })
  const buckets: Record<Bucket, Faixa> = { vencidas: faixa(), hoje: faixa(), d7: faixa(), d30: faixa() }
  const depois30 = faixa()
  const porCat = new Map<string, Categoria>(cats.map((c) => [c.id, { ...c, vencidas: 0, hoje: 0, aVencer: 0, total: 0, count: 0 }]))
  for (const it of itens) {
    if (!it.venc || it.valor <= 0) continue
    let b: Bucket | 'depois'
    if (it.venc < hoje) b = 'vencidas'
    else if (it.venc === hoje) b = 'hoje'
    else if (it.venc <= d7) b = 'd7'
    else if (it.venc <= d30) b = 'd30'
    else b = 'depois'
    const alvo = b === 'depois' ? depois30 : buckets[b]
    alvo.total += it.valor
    alvo.count++
    if (b === 'depois') continue
    const c = porCat.get(it.cat) ?? porCat.get('outros')!
    c.total += it.valor
    c.count++
    if (b === 'vencidas') c.vencidas += it.valor
    else if (b === 'hoje') c.hoje += it.valor
    else c.aVencer += it.valor
  }
  const tudo: Faixa = { total: depois30.total, count: depois30.count }
  for (const b of Object.values(buckets)) { tudo.total += b.total; tudo.count += b.count }
  return { buckets, depois30, categorias: Array.from(porCat.values()).sort((a, b) => b.total - a.total), tudo }
}

const useContasResumo = () => {
  const scoped = useScopedEmpresaCodes()
  const hojeStr = todayISO()
  const SNAPSHOT_INICIO = '2015-01-01'
  const SNAPSHOT_FIM = '2045-12-31'
  const cartaoSnapInicio = addDays(hojeStr, -1095)
  const parcialInicio = addDays(hojeStr, -730)
  // Nome dos postos (mesma chave do resto do app → cache compartilhado).
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const nomePosto = useMemo(() => {
    const m = new Map<number, string>()
    for (const e of empresasData?.resultados ?? []) m.set(e.codigo, e.fantasia || e.razao || `Posto ${e.codigo}`)
    return m
  }, [empresasData])

  // Mesmas chaves/params do useFinanceData → cache compartilhado.
  const receberQ = useQuery({
    queryKey: ['titulosReceberPend', 'rede'],
    ...FRESH_SNAPSHOT,
    queryFn: () => fetchAllPages(
      (p) => fetchTitulosReceber({ dataInicial: SNAPSHOT_INICIO, dataFinal: SNAPSHOT_FIM, apenasPendente: true, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
  })
  const pagarQ = useQuery({
    queryKey: ['titulosPagarPend', 'rede'],
    ...FRESH_SNAPSHOT,
    queryFn: () => fetchAllPages(
      (p) => fetchTitulosPagar({ dataInicial: SNAPSHOT_INICIO, dataFinal: SNAPSHOT_FIM, apenasPendente: true, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 30,
    ),
    staleTime: 5 * 60 * 1000,
  })
  const parciaisQ = useQuery({
    queryKey: ['titulosPagarParciais', 'rede'],
    queryFn: async () => {
      const all = await fetchAllPages(
        (p) => fetchTitulosPagar({ dataInicial: parcialInicio, dataFinal: SNAPSHOT_FIM, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000, 60,
      )
      return all.filter((t) => (t.situacao ?? '').toUpperCase() === 'PARCIAL')
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })
  // Tipo real da administradora (/ADMINISTRADORA) separa App de Cartão — a mesma
  // regra (e o mesmo cache) da aba Receber, pra Central e Financeiro baterem.
  const admQ = useQuery({ queryKey: ['administradoras'], queryFn: () => fetchAdministradoras({ limite: 2000 }), staleTime: 30 * 60 * 1000 })
  const cartoesQ = useQuery({
    queryKey: ['cartaoPend', 'rede'],
    ...FRESH_SNAPSHOT,
    queryFn: () => fetchAllPages(
      (p) => fetchCartao({ dataInicial: cartaoSnapInicio, dataFinal: hojeStr, apenasPendente: true, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
  })

  return useMemo(() => {
    const noEscopo = (e: number) => scoped.length === 0 || scoped.includes(e)
    const hoje = todayISO()
    const posto = (c: number) => nomePosto.get(c) ?? `Posto ${c}`
    const labelDe = (cats: { id: string; label: string }[], id: string) => cats.find((c) => c.id === id)?.label ?? 'Outros'
    const receber: Item[] = []
    const adminTipo = new Map<string, string>()
    for (const a of admQ.data?.resultados ?? []) adminTipo.set(`${a.empresaCodigo}-${a.administradoraCodigo}`, a.tipo || '')
    for (const t of (receberQ.data ?? []) as TituloReceber[]) {
      if (!t.pendente || !noEscopo(t.empresaCodigo)) continue
      const cat = t.convertido === true ? 'faturas' : (t.tipo || '').toLowerCase().includes('nota') ? 'notas' : 'outros'
      const venc = onlyDate(t.dataVencimento)
      receber.push({
        id: `r-${t.codigo}`, lado: 'receber', venc, valor: t.valor ?? 0, cat, catLabel: labelDe(RECEBER_CATS, cat),
        nome: t.nomeCliente?.trim() || `Cliente ${t.clienteCodigo}`, empresaCodigo: t.empresaCodigo, posto: posto(t.empresaCodigo),
        documento: t.documento?.trim() || (t.tituloNumero ? `#${t.tituloNumero}` : `#${t.tituloCodigo}`),
        detalhe: t.convertido === true ? 'Fatura' : (t.tipo || '').trim() || 'Título',
        horizonte: horizonteDe(venc, hoje),
      })
    }
    // Cartões/apps: líquido de taxa; guarda bruto e vencidos pro aviso do card.
    const cartoes = { bruto: 0, liquido: 0, vencidoLiquido: 0 }
    for (const c of (cartoesQ.data ?? []) as Cartao[]) {
      if (!c.pendente || !noEscopo(c.empresaCodigo)) continue
      const taxa = c.taxaPercentual ?? 0
      const liquido = Math.round((c.valor ?? 0) * (1 - taxa / 100) * 100) / 100
      const venc = onlyDate(c.vencimento)
      cartoes.bruto += c.valor ?? 0
      cartoes.liquido += liquido
      if (venc && venc < hoje) cartoes.vencidoLiquido += liquido
      const cat = isApp(adminTipo.get(`${c.empresaCodigo}-${c.administradoraCodigo}`) || c.adiministradoraDescricao || '') ? 'apps' : 'cartoes'
      receber.push({
        id: `c-${c.empresaCodigo}-${c.cartaoCodigo}-${c.parcela ?? 0}`, lado: 'receber', venc, valor: liquido, cat, catLabel: labelDe(RECEBER_CATS, cat),
        nome: (c.adiministradoraDescricao ?? '').trim() || 'Administradora', empresaCodigo: c.empresaCodigo, posto: posto(c.empresaCodigo),
        documento: c.nsu?.trim() ? `NSU ${c.nsu.trim()}` : `#${c.cartaoCodigo}`,
        detalhe: `${c.parcela ? `Parcela ${c.parcela} · ` : ''}taxa ${(taxa).toFixed(2).replace('.', ',')}%${c.clienteRazao?.trim() ? ` · ${c.clienteRazao.trim()}` : ''}`,
        bruto: c.valor ?? 0,
        horizonte: horizonteDe(venc, hoje),
      })
    }
    const pagar: Item[] = []
    const addPagar = (t: TituloPagar) => {
      if (!noEscopo(t.empresaCodigo)) return
      const sit = (t.situacao ?? '').toUpperCase()
      if (sit === 'CANCELADO' || sit === 'PAGO') return
      const saldo = Math.max(0, (t.valor ?? 0) + (t.acrescimo ?? 0) - (t.desconto ?? 0) - (t.valorPago ?? 0))
      if (saldo <= 0) return
      const venc = onlyDate(t.vencimento)
      const cat = catPagar(t.tipoLancamento)
      const parc = t.quantidadeParcelas > 1 ? ` · parcela ${t.parcela}/${t.quantidadeParcelas}` : ''
      pagar.push({
        id: `p-${t.codigo}`, lado: 'pagar', venc, valor: saldo, cat, catLabel: labelDe(PAGAR_CATS, cat),
        nome: t.nomeFornecedor?.trim() || `Fornecedor ${t.fornecedorCodigo}`, empresaCodigo: t.empresaCodigo, posto: posto(t.empresaCodigo),
        documento: t.numeroTitulo?.trim() || `#${t.tituloPagarCodigo}`,
        detalhe: `${(t.planoContaGerencialDescricao ?? '').trim() || (t.descricao ?? '').trim() || (t.tipoLancamento ?? '').trim() || 'Título'}${parc}${sit === 'PARCIAL' ? ' · parcial' : ''}`,
        horizonte: horizonteDe(venc, hoje),
      })
    }
    const vistos = new Set<number>()
    for (const t of (pagarQ.data ?? []) as TituloPagar[]) { vistos.add(t.codigo); addPagar(t) }
    for (const t of (parciaisQ.data ?? []) as TituloPagar[]) { if (!vistos.has(t.codigo)) addPagar(t) }

    const temDados = receber.length > 0 || pagar.length > 0
    return {
      receber: resumir(receber, RECEBER_CATS, hoje),
      pagar: resumir(pagar, PAGAR_CATS, hoje),
      cartoes,
      /** Títulos em aberto, um a um — base dos modais (filtrar por horizonte/categoria). */
      itens: { receber, pagar },
      temDados,
      isLoading: (receberQ.isLoading || pagarQ.isLoading) && !temDados,
      /** Cada lado ainda chegando — pra UI não mostrar R$ 0 como se fosse zero de verdade. */
      carregando: { receber: receberQ.isLoading || cartoesQ.isLoading, pagar: pagarQ.isLoading },
    }
  }, [receberQ.data, receberQ.isLoading, pagarQ.data, pagarQ.isLoading, parciaisQ.data, cartoesQ.data, cartoesQ.isLoading, admQ.data, scoped, nomePosto])
}

export default useContasResumo
