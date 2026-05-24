import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Receipt, ChevronDown, FileText, HandCoins, Scale, Fuel, HelpCircle, DollarSign, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFilterStore } from '@/store/filters'
import { useEmpresaAtual } from '@/hooks/useEmpresaAtual'
import { cn } from '@/lib/utils'

const CaixaGeral = lazy(() => import('@/pages/FechamentoCaixa/components/CaixaGeral'))
const Sangria = lazy(() => import('@/pages/FechamentoCaixa/components/Sangria'))
const SobrasFaltas = lazy(() => import('@/pages/FechamentoCaixa/components/SobrasFaltas'))
const DiferencaEncerrantes = lazy(() => import('@/pages/FechamentoCaixa/components/DiferencaEncerrantes'))

interface Caixa {
  id: string
  data: string
  turno: string
  pdv: string
  abertura: string
  fechamento: string
  /** Caixa fechado pelo operador. Abertos não aparecem no relatório de fechamento. */
  fechado: boolean
}

interface GrupoRow {
  grupo: string
  quantidade: number
  total: number
  margemBruta: number
}

interface MovimentacaoRow {
  label: string
  valor: number
}

const caixas: Caixa[] = [
  // 19/05/2026 — turnos do dia "corrente" ainda abertos (sem fechamento ainda)
  { id: '20260519-1-conv', data: '19/05/2026', turno: '1º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:18', fechamento: '23:59', fechado: false },
  { id: '20260519-2-conv', data: '19/05/2026', turno: '2º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:18', fechamento: '23:59', fechado: false },
  { id: '20260519-1-pista', data: '19/05/2026', turno: '1º TURNO', pdv: 'PDV PISTA', abertura: '00:05', fechamento: '23:55', fechado: false },
  { id: '20260519-2-pista', data: '19/05/2026', turno: '2º TURNO', pdv: 'PDV PISTA', abertura: '00:05', fechamento: '23:55', fechado: false },
  // 18/05/2026 — todos fechados
  { id: '20260518-1-conv', data: '18/05/2026', turno: '1º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:14', fechamento: '23:58', fechado: true },
  { id: '20260518-2-conv', data: '18/05/2026', turno: '2º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:14', fechamento: '23:58', fechado: true },
  { id: '20260518-1-pista', data: '18/05/2026', turno: '1º TURNO', pdv: 'PDV PISTA', abertura: '00:00', fechamento: '23:55', fechado: true },
  { id: '20260518-2-pista', data: '18/05/2026', turno: '2º TURNO', pdv: 'PDV PISTA', abertura: '00:00', fechamento: '23:55', fechado: true },
  // 17/05/2026 — todos fechados
  { id: '20260517-1-conv', data: '17/05/2026', turno: '1º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:10', fechamento: '23:57', fechado: true },
  { id: '20260517-2-conv', data: '17/05/2026', turno: '2º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:10', fechamento: '23:57', fechado: true },
  { id: '20260517-1-pista', data: '17/05/2026', turno: '1º TURNO', pdv: 'PDV PISTA', abertura: '00:02', fechamento: '23:58', fechado: true },
  { id: '20260517-2-pista', data: '17/05/2026', turno: '2º TURNO', pdv: 'PDV PISTA', abertura: '00:02', fechamento: '23:58', fechado: true },
  // 16/05/2026 — todos fechados
  { id: '20260516-1-conv', data: '16/05/2026', turno: '1º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:20', fechamento: '23:55', fechado: true },
  { id: '20260516-2-conv', data: '16/05/2026', turno: '2º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:20', fechamento: '23:55', fechado: true },
  { id: '20260516-1-pista', data: '16/05/2026', turno: '1º TURNO', pdv: 'PDV PISTA', abertura: '00:08', fechamento: '23:50', fechado: true },
  { id: '20260516-2-pista', data: '16/05/2026', turno: '2º TURNO', pdv: 'PDV PISTA', abertura: '00:08', fechamento: '23:50', fechado: true },
]

// Mock — fator de escala por caixa. Quando o backend chegar, vira fetch real.
const caixaFator: Record<string, number> = {
  '20260519-1-conv': 1,
  '20260519-2-conv': 0.65,
  '20260519-1-pista': 1.6,
  '20260519-2-pista': 1.2,
  '20260518-1-conv': 0.82,
  '20260518-2-conv': 0.7,
  '20260518-1-pista': 1.4,
  '20260518-2-pista': 1.1,
  '20260517-1-conv': 0.95,
  '20260517-2-conv': 0.75,
  '20260517-1-pista': 1.5,
  '20260517-2-pista': 1.3,
  '20260516-1-conv': 0.88,
  '20260516-2-conv': 0.68,
  '20260516-1-pista': 1.45,
  '20260516-2-pista': 1.15,
}

const baseGrupos: GrupoRow[] = [
  { grupo: 'LJ - BEBIDAS ALCOOLICAS', quantidade: 1, total: 12.9, margemBruta: 8.814 },
  { grupo: 'LJ - BEBIDAS NAO ALCOOLICAS', quantidade: 60, total: 498.04, margemBruta: 305.113 },
  { grupo: 'LJ - BOMBONIERE', quantidade: 81, total: 365.34, margemBruta: 128.837 },
  { grupo: 'LJ - CERVEJAS', quantidade: 26, total: 282.78, margemBruta: 150.022 },
  { grupo: 'LJ - CONGELADOS', quantidade: 1, total: 13.5, margemBruta: 4.788 },
  { grupo: 'LJ - CORTESIA', quantidade: 63, total: 0.63, margemBruta: -36.24 },
  { grupo: 'LJ - ELETRONICOS', quantidade: 1, total: 29.9, margemBruta: 11.9 },
  { grupo: 'LJ - ENERGETICO E ISOTONICOS', quantidade: 13, total: 231.05, margemBruta: 114.524 },
  { grupo: 'LJ - FAST-FOOD', quantidade: 746, total: 1210.66, margemBruta: 793.218 },
  { grupo: 'LJ - MINI MERCADO', quantidade: 7, total: 68.46, margemBruta: 24.923 },
  { grupo: 'LJ - SNACKS', quantidade: 14, total: 106.48, margemBruta: 45.278 },
  { grupo: 'LJ - SORVETES', quantidade: 6, total: 74.8, margemBruta: 22.726 },
  { grupo: 'LJ - TABACARIA', quantidade: 66, total: 994.55, margemBruta: 304.958 },
  { grupo: 'LJ - TABACARIA ACESSÓRIOS', quantidade: 4, total: 31.6, margemBruta: 18.567 },
]

const baseEntradas: MovimentacaoRow[] = [
  { label: 'Combustível (R$)', valor: 0 },
  { label: 'Produto (R$)', valor: 3920.69 },
  { label: 'Vale (R$)', valor: 0 },
  { label: 'Suprimento (R$)', valor: 0 },
  { label: 'Recebimento (R$)', valor: 0 },
  { label: 'Cheque Troco (R$)', valor: 0 },
  { label: 'Serviço (R$)', valor: 0 },
  { label: 'Pré Pago Créd. (R$)', valor: 0 },
  { label: 'Fundo Cx Créd. (R$)', valor: 0 },
  { label: 'Ordem Pagto. (R$)', valor: 0 },
  { label: 'Pagamento (-) (R$)', valor: 0 },
  { label: 'Saída Troca V. (-) (R$)', valor: 0 },
  { label: 'Serviço Troca V. (-) (R$)', valor: 0 },
]

const baseSaidas: MovimentacaoRow[] = [
  { label: 'Cartão', valor: 2383.61 },
  { label: 'Dinheiro', valor: 674 },
  { label: 'Transferência Bancária Crédito', valor: 866.72 },
]

// Mock de produtos por grupo — drill-down ao clicar numa linha do grupo.
const baseProdutosPorGrupo: Record<string, Array<{ nome: string; quantidade: number; total: number; margemBruta: number }>> = {
  'LJ - BEBIDAS ALCOOLICAS': [
    { nome: 'CERVEJA SKOL LATA 350ML', quantidade: 1, total: 12.9, margemBruta: 8.814 },
  ],
  'LJ - BEBIDAS NAO ALCOOLICAS': [
    { nome: 'COCA COLA 600ML', quantidade: 22, total: 198.0, margemBruta: 121.5 },
    { nome: 'GUARANA ANT. 600ML', quantidade: 18, total: 156.0, margemBruta: 96.2 },
    { nome: 'AGUA MINERAL 500ML', quantidade: 12, total: 84.04, margemBruta: 51.8 },
    { nome: 'SUCO DEL VALLE 300ML', quantidade: 8, total: 60.0, margemBruta: 35.613 },
  ],
  'LJ - BOMBONIERE': [
    { nome: 'BALA 7 BELO', quantidade: 35, total: 105.0, margemBruta: 42.5 },
    { nome: 'CHOCOLATE LACTA', quantidade: 28, total: 168.34, margemBruta: 58.337 },
    { nome: 'TRIDENT TUTTI-FRUTTI', quantidade: 18, total: 92.0, margemBruta: 28.0 },
  ],
  'LJ - CERVEJAS': [
    { nome: 'CERVEJA BRAHMA LONG NECK', quantidade: 12, total: 132.0, margemBruta: 70.0 },
    { nome: 'CERVEJA HEINEKEN 330ML', quantidade: 8, total: 96.78, margemBruta: 52.022 },
    { nome: 'CERVEJA CORONA 355ML', quantidade: 6, total: 54.0, margemBruta: 28.0 },
  ],
  'LJ - CONGELADOS': [
    { nome: 'AÇAI SAMBAZON 100G', quantidade: 1, total: 13.5, margemBruta: 4.788 },
  ],
  'LJ - CORTESIA': [
    { nome: 'CAFÉ DOAÇÃO CORTESIA', quantidade: 50, total: 0.5, margemBruta: -28.0 },
    { nome: 'ÁGUA CORTESIA', quantidade: 13, total: 0.13, margemBruta: -8.24 },
  ],
  'LJ - ELETRONICOS': [
    { nome: 'CABO USB-C 1M', quantidade: 1, total: 29.9, margemBruta: 11.9 },
  ],
  'LJ - ENERGETICO E ISOTONICOS': [
    { nome: 'RED BULL 250ML', quantidade: 8, total: 144.0, margemBruta: 72.5 },
    { nome: 'GATORADE 500ML', quantidade: 5, total: 60.05, margemBruta: 28.024 },
    { nome: 'MONSTER ENERGY 473ML', quantidade: 0, total: 27.0, margemBruta: 14.0 },
  ],
  'LJ - FAST-FOOD': [
    { nome: 'COXINHA UNID.', quantidade: 280, total: 420.0, margemBruta: 280.0 },
    { nome: 'PÃO DE QUEIJO UNID.', quantidade: 210, total: 315.0, margemBruta: 210.0 },
    { nome: 'KIBE UNID.', quantidade: 120, total: 240.0, margemBruta: 155.0 },
    { nome: 'EMPADA FRANGO UNID.', quantidade: 80, total: 160.0, margemBruta: 100.0 },
    { nome: 'SANDUICHE NATURAL', quantidade: 56, total: 75.66, margemBruta: 48.218 },
  ],
  'LJ - MINI MERCADO': [
    { nome: 'ARROZ 1KG', quantidade: 3, total: 30.0, margemBruta: 10.0 },
    { nome: 'FEIJÃO 1KG', quantidade: 2, total: 22.0, margemBruta: 8.0 },
    { nome: 'AÇUCAR 1KG', quantidade: 2, total: 16.46, margemBruta: 6.923 },
  ],
  'LJ - SNACKS': [
    { nome: 'BATATA PRINGLES ORIGINAL', quantidade: 6, total: 60.0, margemBruta: 24.0 },
    { nome: 'DORITOS COOL RANCH', quantidade: 5, total: 32.48, margemBruta: 14.278 },
    { nome: 'CHEETOS LUA', quantidade: 3, total: 14.0, margemBruta: 7.0 },
  ],
  'LJ - SORVETES': [
    { nome: 'CORNETTO CHOCOLATE', quantidade: 4, total: 48.0, margemBruta: 14.5 },
    { nome: 'MAGNUM CLASSIC', quantidade: 2, total: 26.8, margemBruta: 8.226 },
  ],
  'LJ - TABACARIA': [
    { nome: 'CIGARRO MARLBORO RED', quantidade: 30, total: 450.0, margemBruta: 138.0 },
    { nome: 'CIGARRO CARLTON SUAVE', quantidade: 22, total: 330.0, margemBruta: 101.0 },
    { nome: 'CIGARRO LUCKY STRIKE', quantidade: 14, total: 214.55, margemBruta: 65.958 },
  ],
  'LJ - TABACARIA ACESSÓRIOS': [
    { nome: 'ISQUEIRO BIC', quantidade: 3, total: 21.0, margemBruta: 12.5 },
    { nome: 'SEDA SMOKING KING', quantidade: 1, total: 10.6, margemBruta: 6.067 },
  ],
}

const formatCaixaFull = (c: Caixa) =>
  `${c.data} ${c.turno} ${c.pdv} A: ${c.abertura} F: ${c.fechamento}`

const formatCaixaShort = (c: Caixa) =>
  `${c.data} · ${c.turno} · ${c.pdv}`

// Indicadores-resumo de cada caixa, para preview rápido no dropdown.
// Valores-base escalados pelo caixaFator (mesma lógica das tabelas).
const baseResumoCaixa = {
  vendas: 3920.69,
  sangria: 8231.0,
  diferenca: -68.44,
}

const resumoCaixa = (id: string) => {
  const f = caixaFator[id] ?? 0
  return {
    vendas: baseResumoCaixa.vendas * f,
    sangria: baseResumoCaixa.sangria * f,
    diferenca: baseResumoCaixa.diferenca * f,
  }
}

const fmtMoney = (value: number): string => {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1000) {
    const k = (abs / 1000).toFixed(1).replace('.', ',')
    return `${sign}R$ ${k}K`
  }
  return `${sign}R$ ${abs.toFixed(0)}`
}

// dd/mm/yyyy → 'yyyymmdd' para ordenar
const dataKey = (data: string) => data.split('/').reverse().join('')

/**
 * Mock — todos os 16 caixas (4 dias × 4 turnos/PDV) disponíveis pra cada
 * empresa. Status (fechado/aberto) controlado pela flag "Incluir abertos"
 * no componente. A diferenciação visual entre postos vem do `postoScale`
 * aplicado no fator (mesmos caixas, números diferentes por posto).
 * Quando o backend chegar, vira fetch real filtrado por empresaCodigo.
 */
const caixasPorEmpresa = (empresaCodigo: number | null | undefined): Caixa[] => {
  if (empresaCodigo == null) return []
  return caixas
}

const agruparCaixasPorData = (lista: Caixa[]): { data: string; lista: Caixa[] }[] => {
  const map = new Map<string, Caixa[]>()
  for (const c of lista) {
    if (!map.has(c.data)) map.set(c.data, [])
    map.get(c.data)!.push(c)
  }
  return [...map.entries()]
    .sort((a, b) => dataKey(b[0]).localeCompare(dataKey(a[0])))
    .map(([data, lista]) => ({ data, lista }))
}

type TabId = 'geral' | 'sangria' | 'sobras' | 'encerrantes'

const TABS: { id: TabId; label: string; icon: typeof Receipt }[] = [
  { id: 'geral', label: 'Caixa Geral', icon: FileText },
  { id: 'sangria', label: 'Sangria', icon: HandCoins },
  { id: 'sobras', label: 'Sobras e Faltas', icon: Scale },
  { id: 'encerrantes', label: 'Diferença Encerrantes', icon: Fuel },
]

const TabSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

const FechamentoCaixa = () => {
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const hasEmpresa = empresaCodigos.length > 0
  const empresaKey = empresaCodigos.join(',')
  const empresa = useEmpresaAtual()
  const empresaNome = empresa?.nome ?? ''
  const empresaCnpj = empresa?.cnpj ?? ''

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<TabId>('geral')
  const [includeAbertos, setIncludeAbertos] = useState(false)

  // Caixas filtrados pelo posto selecionado (mock — 2 lotes por par/ímpar).
  // Default: só fechados. Flag "Incluir abertos" mostra também os abertos.
  const caixasDoPosto = useMemo(() => {
    const all = caixasPorEmpresa(empresaCodigos[0])
    return includeAbertos ? all : all.filter((c) => c.fechado)
  }, [empresaCodigos, includeAbertos])
  const caixasPorData = useMemo(() => agruparCaixasPorData(caixasDoPosto), [caixasDoPosto])

  // Quando desliga "incluir abertos", deseleciona caixas abertos que tinham
  // sido marcados (evita seleção fantasma com caixa que sumiu da dropdown).
  useEffect(() => {
    if (includeAbertos) return
    setSelectedIds((prev) => prev.filter((id) => caixas.find((c) => c.id === id)?.fechado))
  }, [includeAbertos])

  // Reset da seleção de caixas quando o posto muda — caixas pertencem a um
  // posto específico, então misturar seleções entre postos não faz sentido.
  useEffect(() => {
    setSelectedIds([])
  }, [empresaKey])

  const selectedCaixas = caixasDoPosto.filter((c) => selectedIds.includes(c.id))
  const allSelected = caixasDoPosto.length > 0 && selectedIds.length === caixasDoPosto.length
  const noneSelected = selectedIds.length === 0

  const toggleCaixa = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const selectAll = () => setSelectedIds(caixasDoPosto.map((c) => c.id))
  const clearAll = () => setSelectedIds([])

  const triggerLabel = noneSelected
    ? 'Selecione um caixa'
    : allSelected
      ? `Todos os caixas (${caixasDoPosto.length})`
      : selectedIds.length === 1
        ? formatCaixaShort(selectedCaixas[0])
        : `${selectedIds.length} caixas selecionados`

  const metaLine = noneSelected
    ? 'Nenhum caixa selecionado'
    : `Caixas: ${selectedCaixas.map(formatCaixaFull).join(' • ')}`

  // PostoScale isolado — usado pela aba Sobras e Faltas, que tem dados por
  // caixa (não escala por quantidade de caixas selecionados).
  const postoScale = useMemo(() => {
    const codigo = empresaCodigos[0] ?? 0
    return codigo ? (((codigo * 73) % 40) + 10) / 25 : 1 // 0.4..2.0
  }, [empresaCodigos])

  // Fator combinando caixa × posto. Usado pelas abas Caixa Geral, Sangria e
  // Diferença Encerrantes (que escalam um template "global" pelo total de
  // caixas selecionados).
  const fator = useMemo(() => {
    const caixaScale = selectedIds.reduce((acc, id) => acc + (caixaFator[id] ?? 0), 0)
    return caixaScale * postoScale
  }, [selectedIds, postoScale])

  const dados = useMemo(() => {
    const grupos = baseGrupos.map((g) => ({
      ...g,
      quantidade: g.quantidade * fator,
      total: g.total * fator,
      margemBruta: g.margemBruta * fator,
    }))

    const gruposTotal = grupos.reduce(
      (acc, g) => ({
        quantidade: acc.quantidade + g.quantidade,
        total: acc.total + g.total,
        margemBruta: acc.margemBruta + g.margemBruta,
      }),
      { quantidade: 0, total: 0, margemBruta: 0 },
    )

    const entradas = baseEntradas.map((e) => ({ ...e, valor: e.valor * fator }))
    const entradasTotal = entradas.reduce((acc, e) => acc + e.valor, 0)

    const saidas = baseSaidas.map((s) => ({ ...s, valor: s.valor * fator }))
    const saidasTotal = saidas.reduce((acc, s) => acc + s.valor, 0)

    const maxTotal = grupos.reduce((m, g) => Math.max(m, g.total), 0)
    const maxMargemAbs = grupos.reduce((m, g) => Math.max(m, Math.abs(g.margemBruta)), 0)
    const maxEntrada = entradas.reduce((m, e) => Math.max(m, e.valor), 0)
    const maxSaida = saidas.reduce((m, s) => Math.max(m, s.valor), 0)

    const produtosPorGrupo = Object.fromEntries(
      Object.entries(baseProdutosPorGrupo).map(([grupo, lista]) => [
        grupo,
        lista.map((p) => ({
          ...p,
          quantidade: p.quantidade * fator,
          total: p.total * fator,
          margemBruta: p.margemBruta * fator,
        })),
      ]),
    )

    return {
      grupos,
      gruposTotal,
      entradas,
      entradasTotal,
      saidas,
      saidasTotal,
      maxTotal,
      maxMargemAbs,
      maxEntrada,
      maxSaida,
      produtosPorGrupo,
    }
  }, [fator])

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/30">
            <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Fechamento de Caixa{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Relatório de movimentação e vendas por caixa
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <>
          {/* Filtro de caixas */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Caixas
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-9 min-w-[280px] items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
                    'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800',
                  )}
                >
                  <span className="truncate">{triggerLabel}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[70vh] w-[340px] overflow-y-auto">
                <DropdownMenuLabel className="flex items-center justify-between gap-3 text-xs">
                  <span>Selecionar caixas</span>
                  <div className="flex items-center gap-2 text-[11px] font-normal">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Todos
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-gray-500 hover:underline dark:text-gray-400"
                    >
                      Limpar
                    </button>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {caixasPorData.map(({ data, lista }, gi) => {
                  const allDaySelected = lista.every((c) => selectedIds.includes(c.id))
                  const toggleDay = () => {
                    const dayIds = lista.map((c) => c.id)
                    setSelectedIds((prev) =>
                      allDaySelected
                        ? prev.filter((id) => !dayIds.includes(id))
                        : [...new Set([...prev, ...dayIds])],
                    )
                  }
                  return (
                    <div key={data} className={cn(gi > 0 && 'mt-1 border-t border-gray-100 pt-1 dark:border-gray-800')}>
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          {data}
                        </span>
                        <button
                          type="button"
                          onClick={toggleDay}
                          className="text-[10px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {allDaySelected ? 'Desmarcar dia' : 'Selecionar dia'}
                        </button>
                      </div>
                      {lista.map((c) => {
                        const r = resumoCaixa(c.id)
                        return (
                          <DropdownMenuCheckboxItem
                            key={c.id}
                            checked={selectedIds.includes(c.id)}
                            onCheckedChange={() => toggleCaixa(c.id)}
                            onSelect={(e) => e.preventDefault()}
                            className={cn(
                              'text-xs',
                              !c.fechado && 'border-l-2 border-amber-400 bg-amber-50/40 dark:border-amber-500/70 dark:bg-amber-900/10',
                            )}
                          >
                            <div className="flex w-full flex-col gap-1">
                              <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                                <span>{c.turno} · {c.pdv}</span>
                                {!c.fechado && (
                                  <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                    Em aberto
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                A: {c.abertura} F: {c.fechamento}
                              </span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  <span className="opacity-70">Vendas</span>
                                  <span className="tabular-nums">{fmtMoney(r.vendas)}</span>
                                </span>
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  <span className="opacity-70">Sangria</span>
                                  <span className="tabular-nums">{fmtMoney(r.sangria)}</span>
                                </span>
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
                                    r.diferenca < 0
                                      ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                                  )}
                                >
                                  <span className="opacity-70">Dif.</span>
                                  <span className="tabular-nums">{fmtMoney(r.diferenca)}</span>
                                </span>
                              </div>
                            </div>
                          </DropdownMenuCheckboxItem>
                        )
                      })}
                    </div>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={includeAbertos}
                onChange={(e) => setIncludeAbertos(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
              />
              Incluir caixas abertos
            </label>
            <span
              className="group relative inline-flex cursor-help"
              tabIndex={0}
              aria-label="Por que alguns caixas não aparecem aqui?"
            >
              <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 w-72 -translate-y-1/2 rounded-md bg-gray-900 px-3 py-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 dark:bg-gray-700">
                Por padrão, só <strong>caixas fechados</strong> aparecem aqui. Turnos ainda
                abertos (em andamento) só entram no relatório depois que o operador encerra o caixa.
                Marque "Incluir abertos" pra ver os dois tipos.
              </span>
            </span>
          </div>

          {/* KPIs principais — agregam os caixas selecionados (mock escala
              pelo fator caixa × posto). Sempre visíveis acima das abas. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setActiveTab('geral')}
              className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-blue-950/20 dark:to-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Vendas</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(dados.gruposTotal.total)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {selectedIds.length} {selectedIds.length === 1 ? 'caixa selecionado' : 'caixas selecionados'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('geral')}
              className="rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-emerald-950/20 dark:to-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Margem Bruta</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(dados.gruposTotal.margemBruta)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {dados.gruposTotal.total > 0
                  ? `${((dados.gruposTotal.margemBruta / dados.gruposTotal.total) * 100).toFixed(1).replace('.', ',')}% sobre vendas`
                  : '—'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sangria')}
              className="rounded-xl border border-gray-200 bg-gradient-to-br from-amber-50/60 to-white p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-amber-950/20 dark:to-gray-900"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sangria</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <HandCoins className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(dados.saidasTotal)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Total de saídas do caixa
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('encerrantes')}
              className={cn(
                'rounded-xl border border-gray-200 bg-gradient-to-br p-5 text-left shadow-sm transition-all hover:shadow-md dark:border-gray-700',
                baseResumoCaixa.diferenca * fator >= 0
                  ? 'from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900'
                  : 'from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900',
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Diferença</p>
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    baseResumoCaixa.diferenca * fator >= 0
                      ? 'bg-emerald-100 dark:bg-emerald-900/30'
                      : 'bg-red-100 dark:bg-red-900/30',
                  )}
                >
                  <Scale
                    className={cn(
                      'h-5 w-5',
                      baseResumoCaixa.diferenca * fator >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400',
                    )}
                  />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(baseResumoCaixa.diferenca * fator)}
              </p>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Conferência caixa × sistema
              </p>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex w-fit items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
                    activeTab === tab.id
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <Suspense fallback={<TabSkeleton />}>
            {activeTab === 'geral' && <CaixaGeral dados={dados} metaLine={metaLine} empresaNome={empresaNome} empresaCnpj={empresaCnpj} />}
            {activeTab === 'sangria' && <Sangria fator={fator} empresaNome={empresaNome} empresaCnpj={empresaCnpj} />}
            {activeTab === 'sobras' && <SobrasFaltas postoScale={postoScale} empresaNome={empresaNome} empresaCnpj={empresaCnpj} selectedCaixas={selectedCaixas} />}
            {activeTab === 'encerrantes' && <DiferencaEncerrantes fator={fator} empresaNome={empresaNome} empresaCnpj={empresaCnpj} />}
          </Suspense>
        </>
      )}
    </div>
  )
}

export default FechamentoCaixa
