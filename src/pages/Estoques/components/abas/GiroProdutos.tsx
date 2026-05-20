import { useMemo, useState } from 'react'
import { Search, HelpCircle } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import { cn } from '@/lib/utils'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'

interface Props {
  data: ProductAnalyticsRow[]
  categorias: string[]
}

const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)
const fmtGiro = (v: number) => v.toFixed(2)

const columns: Column<ProductAnalyticsRow>[] = [
  { key: 'produtoNome', label: 'Produto', sortable: true, render: (r) => <span className="font-medium">{r.produtoNome}</span> },
  { key: 'categoria', label: 'Categoria', sortable: true, render: (r) => <span className="text-xs text-gray-500">{r.categoria}</span> },
  { key: 'vendasUltimos6m', label: 'Vendas 6m', align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{fmtUnidades(r.vendasUltimos6m)}</span> },
  { key: 'estoqueMedio', label: 'Estoque médio', align: 'right', sortable: true, render: (r) => <span className="tabular-nums">{fmtUnidades(r.estoqueMedio)}</span> },
  { key: 'saldoAtual', label: 'Saldo atual', align: 'right', sortable: true, render: (r) => <span className={cn('tabular-nums', r.saldoAtual <= 0 && 'text-red-600 dark:text-red-400')}>{fmtUnidades(r.saldoAtual)}</span> },
  {
    key: 'giro',
    label: 'Giro (6m)',
    align: 'right',
    sortable: true,
    render: (r) => (
      <HeatmapCell
        value={r.giro}
        min={0}
        max={6}
        formatted={r.giro > 0 ? fmtGiro(r.giro) + 'x' : '—'}
      />
    ),
  },
]

const GiroProdutos = ({ data, categorias }: Props) => {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  const filtered = useMemo(() => {
    return data
      .filter((r) => {
        if (categoria && r.categoria !== categoria) return false
        if (busca && !r.produtoNome.toLowerCase().includes(busca.toLowerCase())) return false
        return true
      })
      .sort((a, b) => b.giro - a.giro)
  }, [data, busca, categoria])

  const totals = useMemo(() => {
    const comGiro = filtered.filter((r) => r.giro > 0)
    const giroMedio = comGiro.length > 0 ? comGiro.reduce((s, r) => s + r.giro, 0) / comGiro.length : 0
    const semGiro = filtered.length - comGiro.length
    return { giroMedio, comGiro: comGiro.length, semGiro }
  }, [filtered])

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Giro dos produtos</h3>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              aria-expanded={showHelp}
              aria-label="O que é giro de estoque"
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full transition-colors',
                showHelp
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400',
              )}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Quantas vezes o estoque "girou" nos últimos 6 meses (vendas ÷ estoque médio)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produto..."
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
      {showHelp && (
        <div className="border-b border-blue-200 bg-blue-50/60 px-6 py-4 dark:border-blue-800/40 dark:bg-blue-900/20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            O que é giro de estoque
          </p>
          <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
            <span className="font-semibold text-gray-900 dark:text-gray-100">Giro</span> mede quantas vezes o estoque inteiro de um produto saiu (e foi reposto) num período. É um indicador de eficiência — produto com giro alto está rodando, produto com giro baixo está empacando capital na prateleira.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
            <span className="font-semibold text-gray-900 dark:text-gray-100">Fórmula:</span>{' '}
            <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-900 dark:text-gray-300">
              Giro = Quantidade vendida ÷ Estoque médio
            </span>
          </p>

          <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            Exemplos
          </p>
          <ul className="ml-4 list-disc space-y-1 text-xs text-gray-700 dark:text-gray-300">
            <li>
              Coca-Cola lata: vendeu <span className="tabular-nums">1.200</span> em 6 meses, estoque médio <span className="tabular-nums">200</span> →{' '}
              <span className="font-semibold text-green-700 dark:text-green-400">giro = 6x</span> (saudável, gira uma vez por mês)
            </li>
            <li>
              Amaciante: vendeu <span className="tabular-nums">20</span> em 6 meses, estoque médio <span className="tabular-nums">40</span> →{' '}
              <span className="font-semibold text-red-700 dark:text-red-400">giro = 0,5x</span> (capital parado — leva 12 meses pra esvaziar)
            </li>
          </ul>

          <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            Como interpretar (em 6 meses)
          </p>
          <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white text-xs dark:border-blue-800/40 dark:bg-gray-900">
            <table className="w-full">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left">Faixa</th>
                  <th className="px-3 py-2 text-left">Significado</th>
                  <th className="px-3 py-2 text-left">Ação sugerida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700 dark:divide-gray-700 dark:text-gray-300">
                <tr>
                  <td className="px-3 py-2 font-semibold text-green-700 dark:text-green-400">&gt; 4x</td>
                  <td className="px-3 py-2">Produto-estrela, gira rápido</td>
                  <td className="px-3 py-2">Não deixar faltar — risco de ruptura</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold text-emerald-600 dark:text-emerald-400">2x – 4x</td>
                  <td className="px-3 py-2">Saudável</td>
                  <td className="px-3 py-2">OK, manter</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold text-amber-600 dark:text-amber-400">0,5x – 2x</td>
                  <td className="px-3 py-2">Empacando</td>
                  <td className="px-3 py-2">Reduzir compra ou promover</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-semibold text-red-700 dark:text-red-400">&lt; 0,5x</td>
                  <td className="px-3 py-2">Quase parado</td>
                  <td className="px-3 py-2">Considerar tirar do mix ou liquidar</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50">
          <span className="text-[13px] text-gray-700 dark:text-gray-300">
            Produtos com giro: <span className="font-medium tabular-nums">{totals.comGiro}</span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
          <span className="text-[13px] text-gray-500 dark:text-gray-400">
            Sem movimento: <span className="font-medium tabular-nums">{totals.semGiro}</span>
          </span>
          <span className="text-[13px] text-gray-300 dark:text-gray-600">·</span>
          <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
            Giro médio: <span className="tabular-nums">{fmtGiro(totals.giroMedio)}x</span>
          </span>
        </div>
      )}
      <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.produtoCodigo} />
    </div>
  )
}

export default GiroProdutos
