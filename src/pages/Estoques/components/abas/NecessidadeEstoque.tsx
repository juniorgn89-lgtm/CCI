import { useMemo, useState } from 'react'
import { Search, AlertTriangle, AlertCircle, CheckCircle2, AlertOctagon } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import InfoHint from '@/components/ui/InfoHint'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'

interface Props {
  data: ProductAnalyticsRow[]
  categorias: string[]
  coberturaDias: number
  janelaDias: number
  onCoberturaChange: (dias: number) => void
}

const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)

type StatusFilter = 'todos' | 'comprar' | 'negativo' | 'critico' | 'baixo' | 'ok' | 'sem_movimento'

const STATUS_META: Record<ProductAnalyticsRow['necessidadeStatus'], { label: string; color: string; bg: string }> = {
  negativo: { label: 'Negativo', color: 'text-red-100', bg: 'bg-red-900 dark:bg-red-950' },
  critico: { label: 'Crítico', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  baixo: { label: 'Baixo', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  ok: { label: 'OK', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  sem_movimento: { label: 'Sem movimento', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
}

const buildColumns = (coberturaDias: number): Column<ProductAnalyticsRow>[] => [
  { key: 'codigoSku', label: 'Ref.', sortable: true, render: (r) => <span className="font-mono text-xs text-gray-500">{r.codigoSku}</span> },
  { key: 'produtoNome', label: 'Produto', sortable: true, render: (r) => <span className="font-medium">{r.produtoNome}</span> },
  { key: 'categoria', label: 'Categoria', sortable: true, render: (r) => <span className="text-xs text-gray-500">{r.categoria}</span> },
  { key: 'codigoBarras', label: 'Cód. Barras', sortable: true, render: (r) => <span className="font-mono text-xs text-gray-500">{r.codigoBarras || '—'}</span> },
  {
    key: 'saldoAtual',
    label: 'Saldo atual',
    align: 'right',
    sortable: true,
    render: (r) => (
      <span
        className={cn(
          'tabular-nums',
          r.saldoAtual < 0 ? 'font-bold text-red-800 dark:text-red-300'
            : r.saldoAtual === 0 ? 'text-red-600 dark:text-red-400'
            : '',
        )}
      >
        {fmtUnidades(r.saldoAtual)}
      </span>
    ),
  },
  { key: 'estoqueMinimo', label: 'Qtd. Mín.', align: 'right', sortable: true, render: (r) => <span className="tabular-nums text-gray-500">{r.estoqueMinimo > 0 ? fmtUnidades(r.estoqueMinimo) : '—'}</span> },
  {
    key: 'mediaMensalJanela',
    label: 'Média mensal',
    align: 'right',
    sortable: true,
    render: (r) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{fmtUnidades(r.mediaMensalJanela)}</span>,
  },
  {
    key: 'diasCobertura',
    label: 'Cobertura',
    align: 'right',
    sortable: true,
    render: (r) => {
      if (r.mediaDiariaVendas === 0) return <span className="text-gray-400">—</span>
      const dias = r.diasCobertura
      const color = dias < coberturaDias / 2 ? 'text-red-600 dark:text-red-400'
        : dias < coberturaDias ? 'text-amber-600 dark:text-amber-400'
        : 'text-green-600 dark:text-green-400'
      return <span className={cn('tabular-nums font-medium', color)}>{Math.round(dias)} dias</span>
    },
  },
  {
    key: 'necessidadeUnidades',
    label: 'Comprar',
    align: 'right',
    sortable: true,
    render: (r) => {
      if (r.necessidadeUnidades <= 0) return <span className="text-gray-400">—</span>
      const valor = r.necessidadeUnidades * r.custoMedio
      return (
        <div className="text-right">
          <p className="tabular-nums font-bold text-blue-700 dark:text-blue-400">{fmtUnidades(r.necessidadeUnidades)}</p>
          {valor > 0 && <p className="tabular-nums text-[10px] text-gray-400">{formatCurrencyInt(valor)}</p>}
        </div>
      )
    },
  },
  {
    key: 'necessidadeStatus',
    label: 'Status',
    align: 'center',
    sortable: true,
    render: (r) => {
      const meta = STATUS_META[r.necessidadeStatus]
      return (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', meta.bg, meta.color)}>
          {meta.label}
        </span>
      )
    },
  },
]

const NecessidadeEstoque = ({ data, categorias, coberturaDias, janelaDias, onCoberturaChange }: Props) => {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusFilter>('comprar')
  const [coberturaInput, setCoberturaInput] = useState(String(coberturaDias))

  const filtered = useMemo(() => {
    const result = data.filter((r) => {
      if (categoria && r.categoria !== categoria) return false
      if (busca && !r.produtoNome.toLowerCase().includes(busca.toLowerCase()) && !r.codigoSku.toLowerCase().includes(busca.toLowerCase())) return false
      if (filtroStatus === 'comprar' && r.necessidadeUnidades <= 0) return false
      if (filtroStatus !== 'todos' && filtroStatus !== 'comprar' && r.necessidadeStatus !== filtroStatus) return false
      return true
    })
    // Quando vendo negativos, ordena pelo mais negativo (saldo crescente).
    // Para os outros filtros, prioriza maior necessidade de compra.
    if (filtroStatus === 'negativo') {
      return result.sort((a, b) => a.saldoAtual - b.saldoAtual)
    }
    return result.sort((a, b) => b.necessidadeUnidades - a.necessidadeUnidades)
  }, [data, busca, categoria, filtroStatus])

  const totals = useMemo(() => {
    const aComprar = data.filter((r) => r.necessidadeUnidades > 0)
    const totalUnidades = aComprar.reduce((s, r) => s + r.necessidadeUnidades, 0)
    const valorEstimado = aComprar.reduce((s, r) => s + r.necessidadeUnidades * r.custoMedio, 0)
    const negativos = data.filter((r) => r.necessidadeStatus === 'negativo').length
    const criticos = data.filter((r) => r.necessidadeStatus === 'critico').length
    const baixos = data.filter((r) => r.necessidadeStatus === 'baixo').length
    const oks = data.filter((r) => r.necessidadeStatus === 'ok').length
    return { aComprar: aComprar.length, totalUnidades, valorEstimado, negativos, criticos, baixos, oks }
  }, [data])

  const columns = useMemo(() => buildColumns(coberturaDias), [coberturaDias])

  const applyCobertura = () => {
    const n = Number(coberturaInput)
    if (n > 0) onCoberturaChange(n)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setFiltroStatus('negativo')}
          className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-left transition-all hover:shadow-md dark:border-red-800/60 dark:bg-red-900/20"
        >
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-red-800 dark:text-red-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Negativos</span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-800 dark:text-red-400">
            {totals.negativos}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">precisa investigar</p>
        </button>
        <button
          type="button"
          onClick={() => setFiltroStatus('critico')}
          className="rounded-xl border border-red-200 bg-red-50/40 p-4 text-left transition-all hover:shadow-md dark:border-red-800/40 dark:bg-red-900/10"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Críticos</span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">{totals.criticos}</p>
        </button>
        <button
          type="button"
          onClick={() => setFiltroStatus('baixo')}
          className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-left transition-all hover:shadow-md dark:border-amber-800/40 dark:bg-amber-900/10"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Baixos</span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{totals.baixos}</p>
        </button>
        <button
          type="button"
          onClick={() => setFiltroStatus('ok')}
          className="rounded-xl border border-green-200 bg-green-50/40 p-4 text-left transition-all hover:shadow-md dark:border-green-800/40 dark:bg-green-900/10"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">OK</span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">{totals.oks}</p>
        </button>
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-800/40 dark:bg-blue-900/10">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Custo estimado da compra</span>
          <p className="mt-1 text-xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
            {formatCurrency(totals.valorEstimado)}
          </p>
          <p className="text-[10px] text-gray-500">{totals.aComprar} produtos · {fmtUnidades(totals.totalUnidades)} unidades</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h3 className="flex items-center gap-1.5 text-base font-semibold text-gray-900 dark:text-gray-100">
              Necessidade de estoque
              <InfoHint text={`Compara o saldo atual com a média de venda dos últimos ${janelaDias} dias pra sugerir quanto comprar (cobertura de ${coberturaDias} dias). 'Comprar' = unidades sugeridas; 'Cobertura' = quantos dias o saldo atual dura no ritmo de venda. Status: Negativo (saldo < 0), Crítico, Baixo, OK ou Sem movimento.`} />
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Compara o saldo atual com a média de venda dos últimos {janelaDias} dias para sugerir compra de cobertura de {coberturaDias} dias
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              Cobertura:
              <input
                type="number"
                min={1}
                max={365}
                value={coberturaInput}
                onChange={(e) => setCoberturaInput(e.target.value)}
                onBlur={applyCobertura}
                onKeyDown={(e) => { if (e.key === 'Enter') applyCobertura() }}
                className="h-8 w-16 rounded-md border border-gray-200 bg-white px-2 text-center text-xs tabular-nums text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              dias
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar produto ou Ref..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8 w-48 rounded-md border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="">Todas categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50">
          {([
            { v: 'comprar', l: 'Precisam comprar' },
            { v: 'negativo', l: 'Negativos' },
            { v: 'critico', l: 'Críticos' },
            { v: 'baixo', l: 'Baixos' },
            { v: 'ok', l: 'OK' },
            { v: 'sem_movimento', l: 'Sem movimento' },
            { v: 'todos', l: 'Todos' },
          ] as { v: StatusFilter; l: string }[]).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setFiltroStatus(opt.v)}
              className={cn(
                'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                filtroStatus === opt.v
                  ? 'bg-[#1e3a5f] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              )}
            >
              {opt.l}
            </button>
          ))}
        </div>

        <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.produtoCodigo} enableRowHighlight />
      </div>
    </div>
  )
}

export default NecessidadeEstoque
