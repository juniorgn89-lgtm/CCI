import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchTitulosReceber, fetchTitulosPagar, fetchMovimentosConta, fetchCartao, fetchContas, fetchDuplicatas } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { MovimentoConta, TituloReceber, TituloPagar, Duplicata } from '@/api/types/financeiro'

/**
 * Filtro de período LOCAL (independente do filtro global) aplicado aos snapshots
 * de pendências. Quando `allPeriod` é true, ignora datas e considera TUDO em
 * aberto. Caso contrário, recorta o snapshot pela `dataMovimento` no intervalo.
 */
export interface LocalPeriodFilter {
  allPeriod: boolean
  dataInicial: string
  dataFinal: string
}

/** Resumo de "saldo em aberto" pros cards de ênfase da Visão Geral. */
export interface OpenBalanceCard {
  total: number
  count: number
  /** Parte VENCIDA (vencimento < hoje) do saldo em aberto. */
  vencidoTotal: number
  vencidoCount: number
  /** Parte A VENCER (vencimento >= hoje) do saldo em aberto. */
  aVencerTotal: number
  aVencerCount: number
}

/**
 * Quebra um conjunto de linhas (com `statusTag` e um valor em aberto) em
 * vencido × a vencer, montando o OpenBalanceCard completo.
 */
const buildOpenBalanceCard = <T extends { statusTag: string }>(
  rows: T[],
  valueOf: (r: T) => number,
): OpenBalanceCard => {
  let total = 0, vencidoTotal = 0, vencidoCount = 0, aVencerTotal = 0, aVencerCount = 0
  for (const r of rows) {
    const v = valueOf(r)
    total += v
    if (r.statusTag === 'vencido') { vencidoTotal += v; vencidoCount++ }
    else if (r.statusTag === 'a-vencer') { aVencerTotal += v; aVencerCount++ }
  }
  return { total, count: rows.length, vencidoTotal, vencidoCount, aVencerTotal, aVencerCount }
}

export interface FinanceKpiData {
  totalReceber: number
  totalPagar: number
  saldoLiquido: number
  inadimplencia: number
  inadimplenciaPercent: number
  totalVencidosReceber: number
  totalVencidosPagar: number
  countReceber: number
  countPagar: number
  countVencidosReceber: number
  countVencidosPagar: number
}

export interface ReceivableRow {
  codigo: number
  empresaCodigo: number
  tituloCodigo: number
  clienteCodigo: number
  nomeCliente: string
  cpfCnpjCliente: string
  dataMovimento: string
  dataVencimento: string
  valor: number
  pendente: boolean
  tipo: string
  documento: string
  situacaoLabel: string
  statusTag: 'vencido' | 'a-vencer' | 'pago'
  diasAtraso: number
  [key: string]: unknown
}

export interface PayableRow {
  codigo: number
  empresaCodigo: number
  tituloPagarCodigo: number
  fornecedorCodigo: number
  nomeFornecedor: string
  cpfCnpjFornecedor: string
  dataMovimento: string
  vencimento: string
  valor: number
  valorPago: number
  situacao: string
  tipo: string
  descricao: string
  parcela: number
  quantidadeParcelas: number
  situacaoLabel: string
  statusTag: 'vencido' | 'a-vencer' | 'pago' | 'cancelado'
  diasAtraso: number
  saldoRestante: number
  [key: string]: unknown
}

export interface DuplicataRow extends Duplicata {
  /** Saldo em aberto = valorDuplicata − valorPago (nunca negativo). */
  saldoRestante: number
  statusTag: 'vencido' | 'a-vencer' | 'pago'
  diasAtraso: number
  [key: string]: unknown
}

export interface CashFlowRow {
  data: string
  /** Entradas REALIZADAS (movimento_conta) — passado/presente. */
  entradas: number
  /** Saídas REALIZADAS (movimento_conta) — passado/presente. */
  saidas: number
  /** Entradas PROJETADAS (titulos a receber pendentes com vencimento neste dia). */
  entradasPrevistas: number
  /** Saídas PROJETADAS (titulos a pagar pendentes com vencimento neste dia). */
  saidasPrevistas: number
  saldo: number
  /** Saldo acumulado incluindo previstas — mostra trajetória do caixa. */
  saldoAcumulado: number
  /** True quando o dia é >= hoje (mostra projeção). Front usa pra estilo tracejado. */
  isFuturo: boolean
}

export interface CashFlowTotals {
  entradas: number
  saidas: number
  saldo: number
}

export type CartaoModalidade = 'Crédito' | 'Débito' | 'PIX' | 'Carteira Digital'

/** Linha da tabela "Carteira de cartões e Apps — A vencer" (apps pendentes). */
export interface CarteiraDigitalItem {
  tipo: 'Carteira Digital'
  descricao: string
  valor: number
}

/** Soma de recebíveis de cartão por modalidade ("Modo recebimento"). */
export interface ModoRecebimentoItem {
  modalidade: CartaoModalidade
  valor: number
}

/**
 * Classifica um movimento de conta como entrada ou saída.
 *
 * A API Quality `/MOVIMENTO_CONTA` retorna o campo `tipo` em formato variável
 * (CREDITO/DEBITO, C/D, ou ENTRADA/SAIDA, dependendo do cliente). O `valor`
 * costuma vir sempre positivo, com o sinal lógico embutido em `tipo`.
 *
 * Estratégia (mais robusta que a versão anterior, que confiava em `valor > 0`
 * como fallback e classificava tudo como entrada):
 *   1. Olha a primeira letra de `tipo` (case-insensitive): C → crédito, D → débito.
 *   2. Se `tipo` for desconhecido, usa o sinal de `valor` como fallback.
 */
const classifyMovimento = (m: MovimentoConta): 'entrada' | 'saida' => {
  const tipo = (m.tipo ?? '').toUpperCase().trim()
  if (tipo.startsWith('C') || tipo === 'ENTRADA') return 'entrada'
  if (tipo.startsWith('D') || tipo === 'SAIDA' || tipo === 'SAÍDA') return 'saida'
  return m.valor >= 0 ? 'entrada' : 'saida'
}

/**
 * Subtrai N dias de uma data yyyy-MM-dd e devolve outra data yyyy-MM-dd.
 * Usado para calcular o período de comparação dos KPIs do fluxo de caixa.
 */
const offsetDateByDays = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const daysBetween = (start: string, end: string): number => {
  const ms = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1)
}

const sumMovimentos = (data: MovimentoConta[]): CashFlowTotals => {
  let entradas = 0
  let saidas = 0
  for (const m of data) {
    const cls = classifyMovimento(m)
    if (cls === 'entrada') entradas += Math.abs(m.valor)
    else saidas += Math.abs(m.valor)
  }
  return { entradas, saidas, saldo: entradas - saidas }
}

/** Mapeia um título a receber pra linha de tabela (com status/dias de atraso). */
const toReceivableRow = (t: TituloReceber, hoje: string): ReceivableRow => {
  const isOverdue = t.pendente && t.dataVencimento < hoje
  const diasAtraso = isOverdue
    ? Math.floor((new Date(hoje).getTime() - new Date(t.dataVencimento).getTime()) / (1000 * 60 * 60 * 24))
    : 0
  let statusTag: ReceivableRow['statusTag'] = 'pago'
  if (t.pendente) statusTag = isOverdue ? 'vencido' : 'a-vencer'
  return {
    ...t,
    situacaoLabel: t.pendente ? (isOverdue ? 'Vencido' : 'A Vencer') : 'Pago',
    statusTag,
    diasAtraso,
  }
}

/**
 * Mapeia um título a pagar pra linha de tabela (com status/dias de atraso).
 *
 * A API retorna `situacao` em Title Case ("Pago"/"Aberto"/"Parcial"/"Cancelado")
 * — comparamos em maiúsculo pra não errar. Conta como pendência só o que tem
 * SALDO em aberto e não está pago/cancelado, então "Aberto" E "Parcial" entram
 * (espelhando o "A pagar" do webPosto); títulos "Pago" com resíduo de valor
 * (juros/multa não baixados) NÃO entram.
 */
const toPayableRow = (t: TituloPagar, hoje: string): PayableRow => {
  const sit = (t.situacao ?? '').toUpperCase()
  // Saldo igual ao webPosto: valor + acréscimo (juros/multa) − desconto − pago.
  const saldoRestante = Math.max(0, (t.valor ?? 0) + (t.acrescimo ?? 0) - (t.desconto ?? 0) - (t.valorPago ?? 0))
  const isCancelado = sit === 'CANCELADO'
  const isPending = !isCancelado && sit !== 'PAGO' && saldoRestante > 0
  const venc = (t.vencimento ?? '').split('T')[0]
  const isOverdue = isPending && venc < hoje
  const diasAtraso = isOverdue
    ? Math.floor((new Date(hoje).getTime() - new Date(venc).getTime()) / (1000 * 60 * 60 * 24))
    : 0
  let statusTag: PayableRow['statusTag'] = 'pago'
  if (isCancelado) statusTag = 'cancelado'
  else if (isPending) statusTag = isOverdue ? 'vencido' : 'a-vencer'
  return {
    ...t,
    situacaoLabel: isCancelado ? 'Cancelado' : !isPending ? 'Pago' : isOverdue ? 'Vencido' : 'A Vencer',
    statusTag,
    diasAtraso,
    saldoRestante,
  }
}

/** Mapeia uma duplicata pra linha de tabela (com status/dias de atraso/saldo). */
const toDuplicataRow = (d: Duplicata, hoje: string): DuplicataRow => {
  const venc = (d.vencimento ?? '').split('T')[0]
  const isOverdue = d.pendente && venc < hoje
  const diasAtraso = isOverdue
    ? Math.floor((new Date(hoje).getTime() - new Date(venc).getTime()) / (1000 * 60 * 60 * 24))
    : 0
  let statusTag: DuplicataRow['statusTag'] = 'pago'
  if (d.pendente) statusTag = isOverdue ? 'vencido' : 'a-vencer'
  return {
    ...d,
    saldoRestante: Math.max(0, (d.valorDuplicata ?? 0) - (d.valorPago ?? 0)),
    statusTag,
    diasAtraso,
  }
}

/**
 * Filtra um dataset rede-wide pelo subconjunto de postos do filtro. `[]` = Todos
 * (rede inteira); subconjunto = só os selecionados. Memoizado pra estabilidade
 * das deps a jusante. Como a busca é rede-wide (keyed por período), trocar de
 * posto re-agrega no cliente sem refetch.
 */
const useSubset = <T extends { empresaCodigo: number }>(arr: T[], codes: number[]): T[] =>
  useMemo(
    () => (codes.length === 0 ? arr : arr.filter((r) => codes.includes(r.empresaCodigo))),
    [arr, codes],
  )

const useFinanceData = (localPeriod?: LocalPeriodFilter) => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0

  // Primitivos do filtro local pra dependências estáveis do useMemo (evita
  // recomputar a cada render por causa de objeto recriado no componente pai).
  const lpAll = localPeriod?.allPeriod ?? true
  const lpInicio = localPeriod?.dataInicial ?? ''
  const lpFim = localPeriod?.dataFinal ?? ''

  // Sem empresaCodigo → a Quality retorna a REDE inteira (confirmado). Filtramos
  // o subconjunto no cliente (useSubset). queries keyed por período/'rede'.
  const filterParams = {
    dataInicial,
    dataFinal,
  }

  // Período de comparação: mesmo número de dias do período atual, deslocado pra trás.
  const diasNoPeriodo = daysBetween(dataInicial, dataFinal)
  const prevDataFinal = offsetDateByDays(dataInicial, 1)
  const prevDataInicial = offsetDateByDays(prevDataFinal, diasNoPeriodo - 1)

  // Todas as queries paginadas via `fetchAllPages` — Quality API tem cap default
  // baixo (~100/1000); sem paginação postos com volume médio perdiam a maior
  // parte do período no fluxo de caixa (só os primeiros N movimentos voltavam).
  const {
    data: titulosReceberRaw = [],
    isLoading: isLoadingReceber,
  } = useQuery({
    queryKey: ['titulosReceber', 'rede', dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchTitulosReceber({ ...filterParams, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
    enabled: true,
  })

  const {
    data: titulosPagarRaw = [],
    isLoading: isLoadingPagar,
  } = useQuery({
    queryKey: ['titulosPagar', 'rede', dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchTitulosPagar({ ...filterParams, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
    enabled: true,
  })

  const {
    data: movimentosRaw = [],
    isLoading: isLoadingMovimentos,
  } = useQuery({
    queryKey: ['movimentosConta', 'rede', dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchMovimentosConta({ ...filterParams, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
    enabled: true,
  })

  // Período anterior — só pros KPIs comparativos, paginado igual.
  const { data: movimentosPrevRaw = [] } = useQuery({
    queryKey: ['movimentosConta', 'rede', prevDataInicial, prevDataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchMovimentosConta({
        dataInicial: prevDataInicial,
        dataFinal: prevDataFinal,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 20,
    ),
    enabled: true,
  })

  // Recebíveis de cartão (/CARTAO) DO PERÍODO — alimenta o "Modo recebimento".
  const { data: cartoesRaw = [] } = useQuery({
    queryKey: ['cartao', 'rede', dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchCartao({ ...filterParams, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
    enabled: true,
  })

  // --- Snapshot de PENDENTES (independe do período selecionado) ---
  // A Visão Geral espelha o webPosto: mostra TODOS os títulos/cartões em aberto
  // (em atraso / a vencer), não só os do período. Por isso queries dedicadas com
  // janela ampla + apenasPendente. Títulos podem estar vencidos há anos (ex.:
  // tributos), então a janela começa em 2015; cartões pendentes são recentes (1 ano).
  const hojeStr = new Date().toISOString().split('T')[0]
  const SNAPSHOT_INICIO = '2015-01-01'
  // Fim no FUTURO distante: o snapshot precisa incluir os títulos A VENCER (com
  // vencimento/movimento à frente de hoje). Cortar em "hoje" descartava parte do
  // "a vencer" (parcelamentos longos, lançamentos com data futura).
  const SNAPSHOT_FIM = '2045-12-31'
  // 3 anos pra trás: recebíveis de cartão vencidos e não baixados podem ser
  // antigos (parcelados/atrasos da administradora). Cobre o "a receber" do webPosto.
  const cartaoSnapInicio = offsetDateByDays(hojeStr, 1095)

  const { data: titulosReceberPendRaw = [], isLoading: isLoadingReceberPend } = useQuery({
    queryKey: ['titulosReceberPend', 'rede'],
    queryFn: () => fetchAllPages(
      (p) => fetchTitulosReceber({
        dataInicial: SNAPSHOT_INICIO,
        dataFinal: SNAPSHOT_FIM,
        apenasPendente: true,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 20,
    ),
    enabled: true,
  })

  // Sem `apenasPendente`: esse flag da Quality retorna SÓ situação "Aberto" e
  // descarta os "Parcial" (com pagamento parcial e saldo em aberto), que o
  // webPosto soma em "A pagar". Trazemos tudo na janela e filtramos por saldo no
  // toPayableRow. staleTime alto porque o payload é grande (todos os títulos do
  // período, não só os abertos).
  const { data: titulosPagarPendRaw = [], isLoading: isLoadingPagarPend } = useQuery({
    queryKey: ['titulosPagarPend', 'rede'],
    queryFn: () => fetchAllPages(
      (p) => fetchTitulosPagar({
        dataInicial: SNAPSHOT_INICIO,
        dataFinal: SNAPSHOT_FIM,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 30,
    ),
    enabled: true,
    staleTime: 5 * 60 * 1000,
  })

  // Duplicatas EM ABERTO (snapshot) — /DUPLICATA não baixadas (pendente=true).
  // Mesma janela ampla dos demais pendentes (podem estar vencidas há tempo).
  const { data: duplicatasPendRaw = [], isLoading: isLoadingDuplicatasPend } = useQuery({
    queryKey: ['duplicatasPend', 'rede'],
    queryFn: () => fetchAllPages(
      (p) => fetchDuplicatas({
        dataInicial: SNAPSHOT_INICIO,
        dataFinal: SNAPSHOT_FIM,
        apenasPendente: true,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 20,
    ),
    enabled: true,
  })

  const { data: cartoesPendRaw = [] } = useQuery({
    queryKey: ['cartaoPend', 'rede'],
    queryFn: () => fetchAllPages(
      (p) => fetchCartao({
        dataInicial: cartaoSnapInicio,
        dataFinal: hojeStr,
        apenasPendente: true,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 20,
    ),
    enabled: true,
  })

  // Títulos a receber PAGOS nos últimos 6 meses (filtro por data de pagamento) —
  // base pro PMR (prazo médio de recebimento = pagamento − movimento).
  const pmrInicio = offsetDateByDays(hojeStr, 180)
  const { data: titulosReceberPagosRaw = [] } = useQuery({
    queryKey: ['titulosReceberPagos', 'rede'],
    queryFn: () => fetchAllPages(
      (p) => fetchTitulosReceber({
        dataInicial: pmrInicio,
        dataFinal: hojeStr,
        dataFiltro: 'PAGAMENTO',
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 20,
    ),
    enabled: true,
  })

  // Saldo em caixa/banco (/CONTA) — pro card "Impacto no Caixa" da aba Pagar.
  const { data: contasRaw = [] } = useQuery({
    queryKey: ['contas', 'rede'],
    queryFn: () => fetchAllPages(
      (p) => fetchContas({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
    enabled: true,
  })

  // Recorta cada dataset rede-wide pelo subconjunto de postos do filtro (`[]`=Todos).
  const titulosReceber = useSubset(titulosReceberRaw, empresaCodigos)
  const titulosPagar = useSubset(titulosPagarRaw, empresaCodigos)
  const movimentos = useSubset(movimentosRaw, empresaCodigos)
  const movimentosPrev = useSubset(movimentosPrevRaw, empresaCodigos)
  const cartoes = useSubset(cartoesRaw, empresaCodigos)
  const titulosReceberPend = useSubset(titulosReceberPendRaw, empresaCodigos)
  const titulosPagarPend = useSubset(titulosPagarPendRaw, empresaCodigos)
  const duplicatasPend = useSubset(duplicatasPendRaw, empresaCodigos)
  const cartoesPend = useSubset(cartoesPendRaw, empresaCodigos)
  const titulosReceberPagos = useSubset(titulosReceberPagosRaw, empresaCodigos)
  const contas = useSubset(contasRaw, empresaCodigos)
  const saldoEmCaixa = contas.filter((c) => c.ativo).reduce((s, c) => s + (c.saldoAtual ?? 0), 0)

  const isLoading = isLoadingReceber || isLoadingPagar || isLoadingMovimentos
    || isLoadingReceberPend || isLoadingPagarPend || isLoadingDuplicatasPend

  const computed = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0]

    // --- KPI computations ---
    const pendentesReceber = titulosReceber.filter((t) => t.pendente)
    const totalReceber = pendentesReceber.reduce((acc, t) => acc + t.valor, 0)

    const isPagarPendente = (t: TituloPagar): boolean => {
      const sit = (t.situacao ?? '').toUpperCase()
      const saldo = (t.valor ?? 0) + (t.acrescimo ?? 0) - (t.desconto ?? 0) - (t.valorPago ?? 0)
      return sit !== 'PAGO' && sit !== 'CANCELADO' && saldo > 0
    }
    const saldoPagar = (t: TituloPagar): number =>
      Math.max(0, (t.valor ?? 0) + (t.acrescimo ?? 0) - (t.desconto ?? 0) - (t.valorPago ?? 0))
    const pendentesPagar = titulosPagar.filter(isPagarPendente)
    const totalPagar = pendentesPagar.reduce((acc, t) => acc + saldoPagar(t), 0)

    const saldoLiquido = totalReceber - totalPagar

    const vencidosReceber = pendentesReceber.filter((t) => t.dataVencimento < hoje)
    const inadimplencia = vencidosReceber.reduce((acc, t) => acc + t.valor, 0)
    const inadimplenciaPercent = totalReceber > 0 ? (inadimplencia / totalReceber) * 100 : 0

    const vencidosPagar = pendentesPagar.filter((t) => t.vencimento < hoje)
    const totalVencidosPagar = vencidosPagar.reduce((acc, t) => acc + saldoPagar(t), 0)

    const kpis: FinanceKpiData = {
      totalReceber,
      totalPagar,
      saldoLiquido,
      inadimplencia,
      inadimplenciaPercent,
      totalVencidosReceber: inadimplencia,
      totalVencidosPagar,
      countReceber: pendentesReceber.length,
      countPagar: pendentesPagar.length,
      countVencidosReceber: vencidosReceber.length,
      countVencidosPagar: vencidosPagar.length,
    }

    // --- Receivables / Payables tables (DO PERÍODO, pras abas Receber/Pagar) ---
    const receivablesData: ReceivableRow[] = titulosReceber.map((t) => toReceivableRow(t, hoje))
    const payablesData: PayableRow[] = titulosPagar.map((t) => toPayableRow(t, hoje))

    // --- Snapshot de TODOS os pendentes (pros widgets de atraso da Visão Geral) ---
    // Filtro de período LOCAL: quando `allPeriod` é falso, recorta o snapshot pela
    // data de movimento dentro do intervalo. Snapshot completo é o default (são
    // pendências — interessa o saldo total em aberto).
    const inRange = (iso: string): boolean => {
      if (lpAll) return true
      const d = (iso ?? '').split('T')[0]
      if (!d) return false
      return d >= lpInicio && d <= lpFim
    }

    const receivablesAtraso: ReceivableRow[] = titulosReceberPend
      .map((t) => toReceivableRow(t, hoje))
      .filter((r) => inRange(r.dataMovimento))
    const payablesAtraso: PayableRow[] = titulosPagarPend
      .map((t) => toPayableRow(t, hoje))
      .filter((r) => inRange(r.dataMovimento))
    const duplicatasAberto: DuplicataRow[] = duplicatasPend
      .map((d) => toDuplicataRow(d, hoje))
      .filter((d) => d.pendente && inRange(d.dataMovimento))

    // --- 3 cards de ênfase da Visão Geral (saldo EM ABERTO) ---
    // (a) Notas a prazo NÃO faturadas: títulos a receber em aberto, convertido=false.
    //     Soma o VALOR EM ABERTO (título a receber não tem pagamento parcial → valor).
    const notasNaoFaturadasRows = receivablesAtraso.filter((r) => r.pendente && r.convertido === false)
    const cardNotasNaoFaturadas = buildOpenBalanceCard(notasNaoFaturadasRows, (r) => r.valor)
    // (b) Duplicatas em aberto (/DUPLICATA não baixadas) — saldo restante.
    const cardDuplicatasAberto = buildOpenBalanceCard(duplicatasAberto, (d) => d.saldoRestante)
    // (c) A pagar em aberto (/TITULO_PAGAR não baixado) — saldo restante.
    const pagarAbertoRows = payablesAtraso.filter((r) => r.statusTag === 'vencido' || r.statusTag === 'a-vencer')
    const cardPagarAberto = buildOpenBalanceCard(pagarAbertoRows, (r) => r.saldoRestante)

    // --- Cash flow chart data ---
    const byDay = new Map<string, { entradas: number; saidas: number }>()
    for (const m of movimentos) {
      const day = m.dataMovimento.split('T')[0]
      const prev = byDay.get(day) ?? { entradas: 0, saidas: 0 }
      const cls = classifyMovimento(m)
      if (cls === 'entrada') prev.entradas += Math.abs(m.valor)
      else prev.saidas += Math.abs(m.valor)
      byDay.set(day, prev)
    }

    // --- Projeção: títulos PENDENTES agrupados pela data de vencimento ---
    // Receber pendente → entrada prevista naquele dia.
    // Pagar pendente   → saída prevista naquele dia.
    // Considera só vencimentos >= hoje (atrasados ficam fora — já são histórico).
    const previstoPorDia = new Map<string, { entradas: number; saidas: number }>()
    for (const t of titulosReceber) {
      if (!t.pendente) continue
      const dia = (t.dataVencimento ?? '').split('T')[0]
      if (!dia || dia < hoje) continue
      const cur = previstoPorDia.get(dia) ?? { entradas: 0, saidas: 0 }
      cur.entradas += t.valor
      previstoPorDia.set(dia, cur)
    }
    for (const t of titulosPagar) {
      if (!isPagarPendente(t)) continue
      const dia = (t.vencimento ?? '').split('T')[0]
      if (!dia || dia < hoje) continue
      const cur = previstoPorDia.get(dia) ?? { entradas: 0, saidas: 0 }
      cur.saidas += saldoPagar(t)
      previstoPorDia.set(dia, cur)
    }

    // Última data com projeção — extende o eixo X pra cobrir todo o pipeline futuro.
    const latestVencimento = Array.from(previstoPorDia.keys()).reduce(
      (max, d) => (d > max ? d : max),
      dataFinal ?? hoje,
    )

    // Enumera TODOS os dias do período (dataInicial → MAX(dataFinal, latestVencimento)).
    // Preenche dias sem movimento com 0. Sem isso o chart só mostra dias que tiveram
    // transação, dando a impressão de período curto.
    const allDays: string[] = []
    if (dataInicial) {
      const addDays = (yyyymmdd: string, n: number): string => {
        const [y, m, d] = yyyymmdd.split('-').map(Number)
        const date = new Date(y, m - 1, d + n)
        const yy = date.getFullYear()
        const mm = String(date.getMonth() + 1).padStart(2, '0')
        const dd = String(date.getDate()).padStart(2, '0')
        return `${yy}-${mm}-${dd}`
      }
      const fim = latestVencimento > (dataFinal ?? hoje) ? latestVencimento : dataFinal ?? hoje
      let cursor = dataInicial
      // Safety cap: 3 anos pra evitar loop infinito em range malformado
      for (let i = 0; i < 1100 && cursor <= fim; i++) {
        allDays.push(cursor)
        cursor = addDays(cursor, 1)
      }
    }

    // Reduce em vez de mutar `let saldoAcumulado` (regra de pureza).
    const cashFlowData: CashFlowRow[] = allDays.reduce<{ rows: CashFlowRow[]; acum: number }>(
      (acc, data) => {
        const values = byDay.get(data) ?? { entradas: 0, saidas: 0 }
        const proj = previstoPorDia.get(data) ?? { entradas: 0, saidas: 0 }
        // Saldo acumulado considera real + projetado, dando a trajetória futura.
        const acum = acc.acum + values.entradas - values.saidas + proj.entradas - proj.saidas
        acc.rows.push({
          data,
          entradas: values.entradas,
          saidas: values.saidas,
          entradasPrevistas: proj.entradas,
          saidasPrevistas: proj.saidas,
          saldo: values.entradas - values.saidas + proj.entradas - proj.saidas,
          saldoAcumulado: acum,
          isFuturo: data >= hoje,
        })
        return { rows: acc.rows, acum }
      },
      { rows: [], acum: 0 },
    ).rows

    // --- Comparativo período anterior (totais do fluxo) ---
    const cashFlowTotals: CashFlowTotals = {
      entradas: cashFlowData.reduce((acc, r) => acc + r.entradas, 0),
      saidas: cashFlowData.reduce((acc, r) => acc + r.saidas, 0),
      saldo: 0,
    }
    cashFlowTotals.saldo = cashFlowTotals.entradas - cashFlowTotals.saidas

    const cashFlowPrevTotals = sumMovimentos(movimentosPrev)

    // --- PMR (atraso médio de recebimento) ---
    // Média de dias entre VENCIMENTO e pagamento dos títulos pagos nos últimos 6
    // meses (negativo = pago adiantado). Bate com a definição do webPosto.
    // Sem dado pago suficiente → null (não inventa).
    const diasPagamento: number[] = []
    for (const t of titulosReceberPagos) {
      const pag = (t.dataPagamento ?? '').split('T')[0]
      const venc = (t.dataVencimento ?? '').split('T')[0]
      if (!pag || !venc) continue
      const dias = Math.round((new Date(pag).getTime() - new Date(venc).getTime()) / (1000 * 60 * 60 * 24))
      if (dias >= -3650 && dias <= 3650) diasPagamento.push(dias)
    }
    const pmr = diasPagamento.length > 0
      ? Math.round(diasPagamento.reduce((s, d) => s + d, 0) / diasPagamento.length)
      : null

    // --- PMP (atraso médio de pagamento) — análogo ao PMR, nos pagáveis ---
    // Reusa o snapshot `titulosPagarPend` (que já traz os PAGOS), sem fetch novo:
    // média de (dataPagamento − vencimento) dos títulos pagos nos últimos 180d.
    // Mesma base do PMR (dias vs vencimento; negativo = pago adiantado).
    const diasPagamentoPagar: number[] = []
    for (const t of titulosPagarPend) {
      if ((t.situacao ?? '').toUpperCase() !== 'PAGO') continue
      const pag = (t.dataPagamento ?? '').split('T')[0]
      const venc = (t.vencimento ?? '').split('T')[0]
      if (!pag || !venc || pag < pmrInicio || pag > hoje) continue
      const dias = Math.round((new Date(pag).getTime() - new Date(venc).getTime()) / (1000 * 60 * 60 * 24))
      if (dias >= -3650 && dias <= 3650) diasPagamentoPagar.push(dias)
    }
    const pmp = diasPagamentoPagar.length > 0
      ? Math.round(diasPagamentoPagar.reduce((s, d) => s + d, 0) / diasPagamentoPagar.length)
      : null

    // --- Cartão / Apps (/CARTAO) ---
    // Modalidade derivada da administradora (a API não traz um "tipo" explícito):
    //  - contém CREDITO/DEBITO/PIX → adquirente direto
    //  - marca de cartão (VISA/MASTER/ELO/AMEX…) sem credito/debito explícito →
    //    crédito (ex.: "AMERICAN EXPRESS (GETNET)")
    //  - o resto (PREMMIA, ABASTECE AI, SEM PARAR…) → "Carteira Digital" (apps),
    //    que é o que o webPosto chama de "Cartões e Apps a vencer".
    const CARD_BRAND_RE = /VISA|MASTERCARD|MASTER|ELO|MAESTRO|AMERICAN EXPRESS|AMEX|HIPERCARD|HIPER|DINERS|CABAL|SOROCRED|BANESCARD/
    const modalidadeCartao = (admin: string): CartaoModalidade => {
      const u = (admin ?? '').toUpperCase()
      if (u.includes('CRED')) return 'Crédito'
      if (u.includes('DEB') || u.includes('MAESTRO')) return 'Débito'
      if (u.includes('PIX')) return 'PIX'
      if (CARD_BRAND_RE.test(u)) return 'Crédito'
      return 'Carteira Digital'
    }

    // "Carteira de cartões e Apps — A vencer": só apps pendentes, por administradora.
    // Usa o snapshot de pendentes (cartoesPend), não o período.
    const carteiraMap = new Map<string, number>()
    for (const c of cartoesPend) {
      if (!c.pendente) continue
      if (modalidadeCartao(c.adiministradoraDescricao) !== 'Carteira Digital') continue
      const nome = (c.adiministradoraDescricao ?? '').trim() || 'Outros'
      carteiraMap.set(nome, (carteiraMap.get(nome) ?? 0) + c.valor)
    }
    const carteiraDigitalItems: CarteiraDigitalItem[] = Array.from(carteiraMap, ([descricao, valor]) => ({
      tipo: 'Carteira Digital' as const,
      descricao,
      valor,
    })).sort((a, b) => b.valor - a.valor)
    const cartoesAppsAVencer = carteiraDigitalItems.reduce((s, i) => s + i.valor, 0)

    // KPI "Cartões e Apps a receber": TODOS os recebíveis pendentes já vencidos
    // (venc < hoje) — todas as modalidades (crédito/débito/PIX/apps), espelhando
    // o relatório do webPosto. Líquido = valor − taxa da administradora (a API
    // não traz o líquido pronto; só `taxaPercentual`).
    let cartoesReceberBruto = 0
    let cartoesReceberLiquido = 0
    let cartoesReceberCount = 0
    for (const c of cartoesPend) {
      if (!c.pendente) continue
      const vencCartao = (c.vencimento ?? '').split('T')[0]
      if (!vencCartao || vencCartao >= hoje) continue
      // Líquido igual ao webPosto: desconta a taxa ARREDONDADA a 2 casas por
      // linha (valor − round(valor × taxa%)), não a taxa cheia — assim o total
      // bate centavo a centavo em vez de acumular o erro de arredondamento.
      const valorCartao = c.valor ?? 0
      const taxaValor = Math.round((valorCartao * (c.taxaPercentual ?? 0) / 100) * 100) / 100
      cartoesReceberBruto += valorCartao
      cartoesReceberLiquido += valorCartao - taxaValor
      cartoesReceberCount += 1
    }

    // "Modo recebimento": todos os cartões do período somados por modalidade.
    const modoMap = new Map<CartaoModalidade, number>()
    for (const c of cartoes) {
      const mod = modalidadeCartao(c.adiministradoraDescricao)
      modoMap.set(mod, (modoMap.get(mod) ?? 0) + c.valor)
    }
    const MODALIDADES: CartaoModalidade[] = ['Crédito', 'Débito', 'PIX', 'Carteira Digital']
    const modoRecebimento: ModoRecebimentoItem[] = MODALIDADES
      .map((modalidade) => ({ modalidade, valor: modoMap.get(modalidade) ?? 0 }))
      .filter((m) => m.valor > 0)

    return {
      kpis,
      receivablesData,
      payablesData,
      receivablesAtraso,
      payablesAtraso,
      duplicatasAberto,
      notasNaoFaturadasRows,
      cardNotasNaoFaturadas,
      cardDuplicatasAberto,
      cardPagarAberto,
      cashFlowData,
      cashFlowTotals,
      cashFlowPrevTotals,
      cashFlowPrevPeriod: { dataInicial: prevDataInicial, dataFinal: prevDataFinal },
      diasNoPeriodo,
      cartoesAppsAVencer,
      cartoesReceberBruto,
      cartoesReceberLiquido,
      cartoesReceberCount,
      carteiraDigitalItems,
      modoRecebimento,
      cartoesAVencer: cartoesPend,
      pmr,
      pmp,
    }
  }, [titulosReceber, titulosPagar, titulosReceberPend, titulosPagarPend, duplicatasPend, titulosReceberPagos, movimentos, movimentosPrev, cartoes, cartoesPend, prevDataInicial, prevDataFinal, diasNoPeriodo, dataInicial, dataFinal, lpAll, lpInicio, lpFim, pmrInicio])

  return {
    ...computed,
    // Títulos pagos (6m) — base pro score de risco/recuperação na aba Receber.
    receivablesPagos: titulosReceberPagos,
    // Saldo em caixa/banco (contas ativas) — pro "Impacto no Caixa" da aba Pagar.
    saldoEmCaixa,
    isLoading,
    hasEmpresa,
  }
}

export default useFinanceData
