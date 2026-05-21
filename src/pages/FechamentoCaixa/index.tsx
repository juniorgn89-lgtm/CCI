import { lazy, Suspense, useMemo, useState } from 'react'
import { Receipt, ChevronDown, FileText, HandCoins, Scale, Fuel } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
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
  { id: '20260519-1-conv', data: '19/05/2026', turno: '1º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:18', fechamento: '23:59' },
  { id: '20260519-2-conv', data: '19/05/2026', turno: '2º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:18', fechamento: '23:59' },
  { id: '20260518-1-conv', data: '18/05/2026', turno: '1º TURNO', pdv: 'PDV CONVENIÊNCIA', abertura: '00:14', fechamento: '23:58' },
  { id: '20260518-1-pista', data: '18/05/2026', turno: '1º TURNO', pdv: 'PDV PISTA', abertura: '00:00', fechamento: '23:55' },
]

// Mock — fator de escala por caixa. Quando o backend chegar, vira fetch real.
const caixaFator: Record<string, number> = {
  '20260519-1-conv': 1,
  '20260519-2-conv': 0.65,
  '20260518-1-conv': 0.82,
  '20260518-1-pista': 1.4,
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

  const [selectedIds, setSelectedIds] = useState<string[]>(() => [caixas[0].id])
  const [activeTab, setActiveTab] = useState<TabId>('geral')

  const selectedCaixas = caixas.filter((c) => selectedIds.includes(c.id))
  const allSelected = selectedIds.length === caixas.length
  const noneSelected = selectedIds.length === 0

  const toggleCaixa = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const selectAll = () => setSelectedIds(caixas.map((c) => c.id))
  const clearAll = () => setSelectedIds([])

  const triggerLabel = noneSelected
    ? 'Selecione um caixa'
    : allSelected
      ? `Todos os caixas (${caixas.length})`
      : selectedIds.length === 1
        ? formatCaixaShort(selectedCaixas[0])
        : `${selectedIds.length} caixas selecionados`

  const metaLine = noneSelected
    ? 'Nenhum caixa selecionado'
    : `Caixas: ${selectedCaixas.map(formatCaixaFull).join(' • ')}`

  const fator = useMemo(
    () => selectedIds.reduce((acc, id) => acc + (caixaFator[id] ?? 0), 0),
    [selectedIds],
  )

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
    }
  }, [fator])

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-gray-900 dark:text-gray-100">
              Fechamento de Caixa
            </h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              Relatório de movimentação e vendas por caixa
            </p>
          </div>
        </div>
      </PageHeaderTitle>

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
              <DropdownMenuContent align="start" className="w-[340px]">
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
                {caixas.map((c) => {
                  const r = resumoCaixa(c.id)
                  return (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={selectedIds.includes(c.id)}
                      onCheckedChange={() => toggleCaixa(c.id)}
                      onSelect={(e) => e.preventDefault()}
                      className="text-xs"
                    >
                      <div className="flex w-full flex-col gap-1">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {c.data} · {c.turno}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {c.pdv} · A: {c.abertura} F: {c.fechamento}
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
              </DropdownMenuContent>
            </DropdownMenu>
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
            {activeTab === 'geral' && <CaixaGeral dados={dados} metaLine={metaLine} />}
            {activeTab === 'sangria' && <Sangria fator={fator} />}
            {activeTab === 'sobras' && <SobrasFaltas fator={fator} />}
            {activeTab === 'encerrantes' && <DiferencaEncerrantes fator={fator} />}
          </Suspense>
        </>
      )}
    </div>
  )
}

export default FechamentoCaixa
