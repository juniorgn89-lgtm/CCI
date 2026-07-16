import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import BarCell from '@/components/tables/BarCell'
import { formatCurrency, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { CatalogProduct } from '@/pages/Conveniencias/hooks/useConvenienceData'

interface CurvaABCProps {
  products: CatalogProduct[]
}

type Classe = 'A' | 'B' | 'C'

interface ABCRow {
  produtoCodigo: number
  referencia: string
  nome: string
  faturamento: number
  participacao: number
  acumulado: number
  classe: Classe
  [key: string]: unknown
}

// Limites clássicos da Curva ABC (faturamento acumulado):
//  A = vital few até 80% · B = 80–95% · C = cauda (95–100%).
const LIMITE_A = 80
const LIMITE_B = 95

const classeStyle: Record<Classe, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  B: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  C: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const buildCols = (maxFat: number): Column<ABCRow>[] => [
  {
    key: 'classe', label: 'Classe', align: 'center', sortable: true,
    help: 'Classe ABC pelo faturamento acumulado: A até 80%, B 80–95%, C 95–100%.',
    render: (r) => (
      <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold', classeStyle[r.classe])}>
        {r.classe}
      </span>
    ),
  },
  { key: 'referencia', label: 'Ref.', sortable: true, help: 'Código de referência (SKU) do produto.', render: (r) => <span className="font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">{r.referencia || '—'}</span> },
  { key: 'nome', label: 'Produto', sortable: true, help: 'Nome do produto.' },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, help: 'Receita total do produto no período (R$).', render: (r) => <BarCell value={r.faturamento} max={maxFat} formatted={formatCurrencyInt(r.faturamento)} color="blue" /> },
  { key: 'participacao', label: 'Participação', align: 'right', sortable: true, help: '% do faturamento total que este produto representa.', render: (r) => `${r.participacao.toFixed(2)}%` },
  { key: 'acumulado', label: 'Acumulado', align: 'right', sortable: true, help: 'Faturamento acumulado (%), do maior pro menor — base da classe ABC.', render: (r) => `${r.acumulado.toFixed(2)}%` },
]

const CurvaABC = ({ products }: CurvaABCProps) => {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  // Faturamento por grupo (pro gráfico clicável).
  const grupos = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      if (p.faturamento <= 0) continue
      map.set(p.grupo, (map.get(p.grupo) ?? 0) + p.faturamento)
    }
    return [...map.entries()]
      .map(([nome, faturamento]) => ({ nome, faturamento }))
      .sort((a, b) => b.faturamento - a.faturamento)
  }, [products])
  const maxFat = grupos[0]?.faturamento ?? 0

  // ABC recalculada dentro do grupo selecionado (ou geral).
  const { rows, resumo } = useMemo(() => {
    const base = selectedGroup ? products.filter((p) => p.grupo === selectedGroup) : products
    const vendidos = base.filter((p) => p.faturamento > 0)
    const totalFat = vendidos.reduce((s, p) => s + p.faturamento, 0)
    const sorted = [...vendidos].sort((a, b) => b.faturamento - a.faturamento)

    const rows: ABCRow[] = []
    let acum = 0
    for (const p of sorted) {
      const cumBefore = totalFat > 0 ? (acum / totalFat) * 100 : 0
      const classe: Classe = cumBefore < LIMITE_A ? 'A' : cumBefore < LIMITE_B ? 'B' : 'C'
      acum += p.faturamento
      rows.push({
        produtoCodigo: p.produtoCodigo,
        referencia: p.referencia,
        nome: p.nome,
        faturamento: p.faturamento,
        participacao: totalFat > 0 ? (p.faturamento / totalFat) * 100 : 0,
        acumulado: totalFat > 0 ? (acum / totalFat) * 100 : 0,
        classe,
      })
    }

    const resumo = (['A', 'B', 'C'] as Classe[]).map((c) => {
      const itens = rows.filter((r) => r.classe === c)
      const fat = itens.reduce((s, r) => s + r.faturamento, 0)
      return {
        classe: c,
        produtos: itens.length,
        faturamento: fat,
        pctProdutos: rows.length > 0 ? (itens.length / rows.length) * 100 : 0,
        pctFat: totalFat > 0 ? (fat / totalFat) * 100 : 0,
      }
    })

    return { rows, resumo }
  }, [products, selectedGroup])

  const cols = useMemo(
    () => buildCols(rows.reduce((m, r) => Math.max(m, r.faturamento), 0)),
    [rows],
  )

  return (
    <div className="space-y-4">
      {/* Resumo A / B / C */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {resumo.map((r) => (
          <div key={r.classe} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
            <div className="flex items-center gap-2">
              <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold', classeStyle[r.classe])}>
                {r.classe}
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {r.classe === 'A' ? 'Vitais (até 80%)' : r.classe === 'B' ? 'Intermediários (80–95%)' : 'Cauda (95–100%)'}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(r.faturamento)}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formatNumber(r.produtos)} produtos ({r.pctProdutos.toFixed(2)}%) · {r.pctFat.toFixed(2)}% do faturamento
            </p>
          </div>
        ))}
      </div>

      {/* Gráfico de grupos (clicável) + tabela classificada */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Faturamento por grupo */}
        <div className="flex h-[640px] flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black xl:col-span-1">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Faturamento - Por grupo de produto</h3>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">Clique num grupo pra filtrar a curva ABC.</p>
          <div className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-auto pr-1">
            {grupos.map((g) => {
              const pct = maxFat > 0 ? (g.faturamento / maxFat) * 100 : 0
              const isSel = selectedGroup === g.nome
              return (
                <button
                  key={g.nome}
                  onClick={() => setSelectedGroup((prev) => (prev === g.nome ? null : g.nome))}
                  className="grid w-full grid-cols-[120px_1fr_auto] items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  title={g.nome}
                >
                  <span className={cn('truncate text-right text-[11px]', isSel ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400')}>
                    {g.nome}
                  </span>
                  <span className="h-5 rounded-sm bg-gray-100 dark:bg-gray-800">
                    <span
                      className="block h-5 rounded-sm transition-all"
                      style={{ width: `${Math.max(2, pct)}%`, backgroundColor: isSel ? '#1e3a5f' : '#93c5fd' }}
                    />
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                    {formatCurrency(g.faturamento)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tabela classificada */}
        <div className="flex h-[640px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black xl:col-span-2">
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Produtos por classe{selectedGroup ? ` · ${selectedGroup}` : ''}
            </span>
            {selectedGroup && (
              <button
                onClick={() => setSelectedGroup(null)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <X className="h-3 w-3" /> Limpar filtro
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <DataTable
              columns={cols}
              data={rows}
              keyExtractor={(r) => r.produtoCodigo}
              enableRowHighlight
              groups={[
                { label: '', span: 3 },             // Classe · Ref · Produto
                { label: 'Financeiro', span: 1 },   // Faturamento
                { label: 'Distribuição', span: 2 }, // Participação · Acumulado
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CurvaABC
