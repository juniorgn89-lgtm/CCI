import { Fragment, useMemo, useState } from 'react'
import { Fuel, Wrench, Store, Layers, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Trophy, HelpCircle } from 'lucide-react'
import BarCell from '@/components/tables/BarCell'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'

type SetorId = 'combustiveis' | 'automotivos' | 'conveniencias'

interface ProdutoRow {
  produto: string
  qtd: number
  qtdAnoAnterior: number
  lucroBruto: number
  lucroBrutoAnoAnterior: number
  margem: number
  acrescimos: number
  descontos: number
  precoVenda: number
  precoCusto: number
  lbPorUnidade: number
}

interface PostoRow {
  posto: string
  produtos: ProdutoRow[]
}

interface SetorData {
  unidadeLabel: string // "Litros", "Quantidade"
  lbLabel: string      // "L.B. por litro", "L.B. por unidade"
  postos: PostoRow[]
}

const setorTabs: { id: SetorId; label: string; Icon: typeof Fuel }[] = [
  { id: 'combustiveis', label: 'COMBUSTÍVEIS', Icon: Fuel },
  { id: 'automotivos', label: 'AUTOMOTIVOS', Icon: Wrench },
  { id: 'conveniencias', label: 'CONVENIÊNCIAS', Icon: Store },
]

const fmtPct = (v: number) => `${v.toFixed(2).replace('.', ',')}%`

/** Cabeçalho de coluna com "?" (tooltip nativo). */
const ThHelp = ({ label, help, align = 'right' }: { label: string; help: string; align?: 'left' | 'right' }) => (
  <th className={cn('px-3 py-2', align === 'right' ? 'text-right' : 'text-left')}>
    <span className={cn('inline-flex items-center gap-1', align === 'right' && 'justify-end')}>
      {label}
      <span title={help} className="cursor-help text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        <HelpCircle className="h-3 w-3" />
      </span>
    </span>
  </th>
)

const variacaoPct = (atual: number, anterior: number): number =>
  anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0

const VariacaoBadge = ({ value }: { value: number }) => {
  if (!isFinite(value) || value === 0) {
    return <span className="text-xs text-gray-400">—</span>
  }
  const up = value > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
      up ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
    )}>
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}{value.toFixed(1).replace('.', ',')}%
    </span>
  )
}

const BenchmarkSetor = () => {
  const [setor, setSetor] = useState<SetorId>('combustiveis')
  // Postos EXPANDIDOS (default = todos minimizados; abre ao clicar no posto).
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set())
  // Linha destacada — uma única por vez. Útil pra comparar visualmente
  // valores entre colunas sem perder de vista qual é a linha de interesse.
  const [selected, setSelected] = useState<string | null>(null)

  const toggleSelected = (key: string) => {
    setSelected((curr) => (curr === key ? null : key))
  }

  const rede = useRedeSetores()
  const setorReal = setor === 'combustiveis' ? rede.combustivel : setor === 'automotivos' ? rede.automotivos : rede.conveniencia
  const data = useMemo<SetorData>(() => ({
    unidadeLabel: setorReal.unidadeLabel,
    lbLabel: setorReal.lbLabel,
    postos: setorReal.postos.map((p) => ({ posto: p.posto, produtos: p.produtos })),
  }), [setorReal])

  // Agrega cada posto e o total geral.
  const aggregated = useMemo(() => {
    const postos = data.postos.map((p) => {
      const agg = p.produtos.reduce((acc, prod) => ({
        qtd: acc.qtd + prod.qtd,
        qtdAnoAnterior: acc.qtdAnoAnterior + prod.qtdAnoAnterior,
        lucroBruto: acc.lucroBruto + prod.lucroBruto,
        lucroBrutoAnoAnterior: acc.lucroBrutoAnoAnterior + prod.lucroBrutoAnoAnterior,
        acrescimos: acc.acrescimos + prod.acrescimos,
        descontos: acc.descontos + prod.descontos,
      }), { qtd: 0, qtdAnoAnterior: 0, lucroBruto: 0, lucroBrutoAnoAnterior: 0, acrescimos: 0, descontos: 0 })

      // Médias ponderadas pra preço venda/custo/L.B.
      const precoVenda = agg.qtd > 0
        ? p.produtos.reduce((s, prod) => s + prod.precoVenda * prod.qtd, 0) / agg.qtd
        : 0
      const precoCusto = agg.qtd > 0
        ? p.produtos.reduce((s, prod) => s + prod.precoCusto * prod.qtd, 0) / agg.qtd
        : 0
      const totalVenda = p.produtos.reduce((s, prod) => s + prod.precoVenda * prod.qtd, 0)
      const margem = totalVenda > 0 ? (agg.lucroBruto / totalVenda) * 100 : 0
      const lbPorUnidade = agg.qtd > 0 ? agg.lucroBruto / agg.qtd : 0
      return { ...p, ...agg, precoVenda, precoCusto, margem, lbPorUnidade }
    })

    const totals = postos.reduce((acc, p) => ({
      qtd: acc.qtd + p.qtd,
      qtdAnoAnterior: acc.qtdAnoAnterior + p.qtdAnoAnterior,
      lucroBruto: acc.lucroBruto + p.lucroBruto,
      lucroBrutoAnoAnterior: acc.lucroBrutoAnoAnterior + p.lucroBrutoAnoAnterior,
      acrescimos: acc.acrescimos + p.acrescimos,
      descontos: acc.descontos + p.descontos,
      totalVenda: acc.totalVenda + p.precoVenda * p.qtd,
    }), { qtd: 0, qtdAnoAnterior: 0, lucroBruto: 0, lucroBrutoAnoAnterior: 0, acrescimos: 0, descontos: 0, totalVenda: 0 })

    const totalMargem = totals.totalVenda > 0 ? (totals.lucroBruto / totals.totalVenda) * 100 : 0
    const totalPrecoVenda = totals.qtd > 0 ? totals.totalVenda / totals.qtd : 0
    const totalPrecoCusto = totals.qtd > 0 ? (totals.totalVenda - totals.lucroBruto) / totals.qtd : 0
    const totalLb = totals.qtd > 0 ? totals.lucroBruto / totals.qtd : 0

    return { postos, totals: { ...totals, margem: totalMargem, precoVenda: totalPrecoVenda, precoCusto: totalPrecoCusto, lbPorUnidade: totalLb } }
  }, [data])

  // Posto que está "se destacando" no setor ativo — maior Lucro Bruto absoluto.
  // Só destaca se houver mais de 1 posto e o vencedor tiver lucro > 0 (evita
  // troféu inútil quando todos zerados ou só tem 1 posto pra comparar).
  const postoDestaque = useMemo(() => {
    if (aggregated.postos.length < 2) return null
    const top = [...aggregated.postos].sort((a, b) => b.lucroBruto - a.lucroBruto)[0]
    return top && top.lucroBruto > 0 ? top.posto : null
  }, [aggregated])

  // Máximos pra calibrar barras — produtos (linhas filhas) e postos (agrupadores)
  // têm escalas próprias (totais de posto >> valores por produto).
  const allRows = aggregated.postos.flatMap((p) => p.produtos)
  const maxQtd = allRows.reduce((m, r) => Math.max(m, r.qtd), 0)
  const maxLucro = allRows.reduce((m, r) => Math.max(m, r.lucroBruto), 0)
  const maxMargem = Math.max(...allRows.map((r) => r.margem), 0)
  const maxQtdPosto = aggregated.postos.reduce((m, p) => Math.max(m, p.qtd), 0)
  const maxLucroPosto = aggregated.postos.reduce((m, p) => Math.max(m, p.lucroBruto), 0)
  const maxMargemPosto = Math.max(...aggregated.postos.map((p) => p.margem), 0)

  const togglePosto = (posto: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(posto)) next.delete(posto)
      else next.add(posto)
      return next
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900 [mask-image:linear-gradient(to_bottom,black_calc(100%-14px),transparent_100%)]">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-gray-700 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gray-500" />
            <h3 className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Detalhamento de informações por setor
              <span title="Vendas da rede inteira por setor (Combustíveis / Automotivos / Conveniências), com cada posto e seus produtos. Clique no posto pra expandir. Compara com o mesmo período do ano anterior." className="cursor-help text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <HelpCircle className="h-3.5 w-3.5" />
              </span>
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Aqui temos todas as vendas setorizadas com maior nível de detalhes
          </p>
        </div>
        <div className="inline-flex items-center gap-0.5 self-start rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          {setorTabs.map((s) => {
            const Icon = s.Icon
            const isActive = setor === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSetor(s.id)}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                  isActive
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <ThHelp align="left" label="Empresa" help="Posto da rede. Clique pra expandir os produtos do setor." />
              <ThHelp label={data.unidadeLabel} help={data.unidadeLabel === 'Litros' ? 'Volume vendido no período (L).' : 'Unidades vendidas no período.'} />
              <ThHelp label="Ano anterior" help="Mesmo período do ano anterior (volume)." />
              <ThHelp label="Variação" help="Variação % do volume vs o ano anterior." />
              <ThHelp label="Lucro Bruto" help="Faturamento − custo (CMV) no período (R$)." />
              <ThHelp label="Ano anterior" help="Lucro bruto no mesmo período do ano anterior (R$)." />
              <ThHelp label="Variação" help="Variação % do lucro bruto vs o ano anterior." />
              <ThHelp label="Margem" help="(Lucro bruto ÷ faturamento) × 100." />
              <ThHelp label="Acréscimos" help="Σ dos acréscimos aplicados nas vendas no período (R$)." />
              <ThHelp label="Descontos" help="Σ dos descontos concedidos nas vendas no período (R$)." />
              <ThHelp label="Preço venda" help="Preço médio de venda por unidade: faturamento ÷ quantidade." />
              <ThHelp label="Preço custo" help="Custo médio por unidade: custo ÷ quantidade." />
              <ThHelp label={data.lbLabel} help="Lucro bruto por unidade: lucro ÷ quantidade." />
            </tr>
          </thead>
          <tbody>
            {aggregated.postos.map((p) => {
              const expanded = expandidos.has(p.posto)
              const qtdVar = variacaoPct(p.qtd, p.qtdAnoAnterior)
              const lucroVar = variacaoPct(p.lucroBruto, p.lucroBrutoAnoAnterior)
              const postoKey = `posto:${p.posto}`
              const postoSelected = selected === postoKey
              return (
                <Fragment key={p.posto}>
                  <tr
                    onClick={() => { togglePosto(p.posto); toggleSelected(postoKey) }}
                    aria-selected={postoSelected}
                    className={cn(
                      'cursor-pointer border-b border-gray-100 font-semibold text-gray-900 transition-colors dark:border-gray-800 dark:text-gray-100',
                      postoSelected
                        ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/40 dark:hover:bg-amber-900/50'
                        : 'bg-gray-50/40 hover:bg-blue-50/60 dark:bg-gray-800/30 dark:hover:bg-blue-900/20',
                    )}
                  >
                    <td className="px-3 py-2 text-left">
                      <span className="inline-flex items-center gap-1.5">
                        {expanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                        {p.posto}
                        {postoDestaque === p.posto && (
                          <span
                            title={`Maior Lucro Bruto do setor (${formatCurrency(p.lucroBruto)})`}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          >
                            <Trophy className="h-3 w-3" />
                            Destaque
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <BarCell value={p.qtd} max={maxQtdPosto} formatted={formatNumber(Math.round(p.qtd))} color="blue" align="near" />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatNumber(Math.round(p.qtdAnoAnterior))}</td>
                    <td className="px-3 py-2 text-right"><VariacaoBadge value={qtdVar} /></td>
                    <td className="px-2 py-1">
                      <BarCell value={p.lucroBruto} max={maxLucroPosto} formatted={formatCurrency(p.lucroBruto)} color="green" align="near" />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatCurrency(p.lucroBrutoAnoAnterior)}</td>
                    <td className="px-3 py-2 text-right"><VariacaoBadge value={lucroVar} /></td>
                    <td className="px-2 py-1">
                      <BarCell value={p.margem} max={maxMargemPosto} formatted={fmtPct(p.margem)} color="red" align="near" />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatCurrency(p.acrescimos)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatCurrency(p.descontos)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.precoVenda)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.precoCusto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.lbPorUnidade)}</td>
                  </tr>
                  {expanded && p.produtos.map((prod) => {
                    const qVar = variacaoPct(prod.qtd, prod.qtdAnoAnterior)
                    const lVar = variacaoPct(prod.lucroBruto, prod.lucroBrutoAnoAnterior)
                    const prodKey = `prod:${p.posto}:${prod.produto}`
                    const prodSelected = selected === prodKey
                    return (
                      <tr
                        key={`${p.posto}-${prod.produto}`}
                        onClick={(e) => { e.stopPropagation(); toggleSelected(prodKey) }}
                        aria-selected={prodSelected}
                        className={cn(
                          'cursor-pointer border-b border-gray-100 text-gray-700 transition-colors dark:border-gray-800 dark:text-gray-300',
                          prodSelected
                            ? 'bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-900/20 dark:hover:bg-amber-900/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                        )}
                      >
                        <td className="px-3 py-1.5 pl-9 text-left text-xs">{prod.produto}</td>
                        <td className="px-2 py-1">
                          <BarCell value={prod.qtd} max={maxQtd} formatted={formatNumber(Math.round(prod.qtd))} color="blue" align="near" maxWidthPct={60} />
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs tabular-nums text-gray-400">{formatNumber(Math.round(prod.qtdAnoAnterior))}</td>
                        <td className="px-3 py-1.5 text-right"><VariacaoBadge value={qVar} /></td>
                        <td className="px-2 py-1">
                          <BarCell value={prod.lucroBruto} max={maxLucro} formatted={formatCurrency(prod.lucroBruto)} color="green" align="near" maxWidthPct={60} />
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs tabular-nums text-gray-400">{formatCurrency(prod.lucroBrutoAnoAnterior)}</td>
                        <td className="px-3 py-1.5 text-right"><VariacaoBadge value={lVar} /></td>
                        <td className="px-2 py-1">
                          <BarCell value={prod.margem} max={maxMargem} formatted={fmtPct(prod.margem)} color="red" align="near" maxWidthPct={60} />
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs tabular-nums text-gray-400">{formatCurrency(prod.acrescimos)}</td>
                        <td className="px-3 py-1.5 text-right text-xs tabular-nums text-gray-400">{formatCurrency(prod.descontos)}</td>
                        <td className="px-3 py-1.5 text-right text-xs tabular-nums">{formatCurrency(prod.precoVenda)}</td>
                        <td className="px-3 py-1.5 text-right text-xs tabular-nums">{formatCurrency(prod.precoCusto)}</td>
                        <td className="px-3 py-1.5 text-right text-xs tabular-nums">{formatCurrency(prod.lbPorUnidade)}</td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
              <td className="px-3 py-2 text-left">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(Math.round(aggregated.totals.qtd))}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatNumber(Math.round(aggregated.totals.qtdAnoAnterior))}</td>
              <td className="px-3 py-2 text-right"><VariacaoBadge value={variacaoPct(aggregated.totals.qtd, aggregated.totals.qtdAnoAnterior)} /></td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(aggregated.totals.lucroBruto)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatCurrency(aggregated.totals.lucroBrutoAnoAnterior)}</td>
              <td className="px-3 py-2 text-right"><VariacaoBadge value={variacaoPct(aggregated.totals.lucroBruto, aggregated.totals.lucroBrutoAnoAnterior)} /></td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtPct(aggregated.totals.margem)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatCurrency(aggregated.totals.acrescimos)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatCurrency(aggregated.totals.descontos)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(aggregated.totals.precoVenda)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(aggregated.totals.precoCusto)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(aggregated.totals.lbPorUnidade)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BenchmarkSetor
