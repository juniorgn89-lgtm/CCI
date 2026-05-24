import { Fragment, useMemo, useState } from 'react'
import { Fuel, Wrench, Store, Layers, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Trophy } from 'lucide-react'
import BarCell from '@/components/tables/BarCell'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/formatters'

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

/* ─── Mock — números do print pra Combustíveis ─── */
const mockData: Record<SetorId, SetorData> = {
  combustiveis: {
    unidadeLabel: 'Litros',
    lbLabel: 'L.B. por litro',
    postos: [
      {
        posto: 'POSTO TREVISO',
        produtos: [
          { produto: 'GASOLINA COMUM',              qtd: 131003, qtdAnoAnterior: 128400, lucroBruto: 110358, lucroBrutoAnoAnterior: 108200, margem: 13.47, acrescimos: 0, descontos: 8806.18, precoVenda: 6.26, precoCusto: 5.41, lbPorUnidade: 0.84 },
          { produto: 'GASOLINA ADITIVADA',          qtd: 390,    qtdAnoAnterior: 410,    lucroBruto: 391,    lucroBrutoAnoAnterior: 420,    margem: 15.27, acrescimos: 0, descontos: 8.34,    precoVenda: 6.56, precoCusto: 5.56, lbPorUnidade: 1.00 },
          { produto: 'ETANOL ADITIVADO IPIMAX',     qtd: 25234,  qtdAnoAnterior: 24800,  lucroBruto: 9966,   lucroBrutoAnoAnterior: 9500,   margem: 8.76,  acrescimos: 0, descontos: 2044.01, precoVenda: 4.51, precoCusto: 4.11, lbPorUnidade: 0.39 },
          { produto: 'DIESEL S-10 ADITIVADO IPIMAX', qtd: 21323, qtdAnoAnterior: 22500,  lucroBruto: 7721,   lucroBrutoAnoAnterior: 8100,   margem: 6.06,  acrescimos: 0, descontos: 0,       precoVenda: 5.98, precoCusto: 5.62, lbPorUnidade: 0.36 },
        ],
      },
      {
        posto: 'POSTO ITAPOA',
        produtos: [
          { produto: 'GASOLINA COMUM',     qtd: 122193, qtdAnoAnterior: 120000, lucroBruto: 99085,  lucroBrutoAnoAnterior: 95400,  margem: 13.03, acrescimos: 0, descontos: 14837.86, precoVenda: 6.22, precoCusto: 5.41, lbPorUnidade: 0.81 },
          { produto: 'GASOLINA ADITIVADA', qtd: 10597,  qtdAnoAnterior: 10100,  lucroBruto: 10172,  lucroBrutoAnoAnterior: 9700,   margem: 14.74, acrescimos: 0, descontos: 1006.14,  precoVenda: 6.51, precoCusto: 5.55, lbPorUnidade: 0.96 },
          { produto: 'ETANOL COMUM.',      qtd: 33616,  qtdAnoAnterior: 32000,  lucroBruto: 10801,  lucroBrutoAnoAnterior: 10200,  margem: 7.25,  acrescimos: 0, descontos: 5211.41,  precoVenda: 4.43, precoCusto: 4.11, lbPorUnidade: 0.32 },
          { produto: 'DIESEL S-10',        qtd: 16388,  qtdAnoAnterior: 17500,  lucroBruto: 5949,   lucroBrutoAnoAnterior: 6300,   margem: 6.07,  acrescimos: 0, descontos: 14.74,    precoVenda: 5.98, precoCusto: 5.62, lbPorUnidade: 0.36 },
        ],
      },
      {
        posto: 'POSTO DIVINO',
        produtos: [
          { produto: 'GASOLINA COMUM', qtd: 123462, qtdAnoAnterior: 121000, lucroBruto: 101584, lucroBrutoAnoAnterior: 97800, margem: 13.19, acrescimos: 0, descontos: 6474.41, precoVenda: 6.24, precoCusto: 5.41, lbPorUnidade: 0.82 },
        ],
      },
    ],
  },
  automotivos: {
    unidadeLabel: 'Quantidade',
    lbLabel: 'L.B. por unidade',
    postos: [
      {
        posto: 'POSTO TREVISO',
        produtos: [
          { produto: 'LUBRIFICANTE 1L',           qtd: 120, qtdAnoAnterior: 110, lucroBruto: 3840,  lucroBrutoAnoAnterior: 3500, margem: 58.20, acrescimos: 0, descontos: 0, precoVenda: 55.00, precoCusto: 23.00, lbPorUnidade: 32.00 },
          { produto: 'ADITIVO RADIADOR',          qtd: 85,  qtdAnoAnterior: 80,  lucroBruto: 2210,  lucroBrutoAnoAnterior: 2050, margem: 65.00, acrescimos: 0, descontos: 0, precoVenda: 40.00, precoCusto: 14.00, lbPorUnidade: 26.00 },
          { produto: 'PALHETA LIMPADOR',          qtd: 42,  qtdAnoAnterior: 38,  lucroBruto: 1260,  lucroBrutoAnoAnterior: 1100, margem: 60.00, acrescimos: 0, descontos: 0, precoVenda: 50.00, precoCusto: 20.00, lbPorUnidade: 30.00 },
        ],
      },
      {
        posto: 'POSTO ITAPOA',
        produtos: [
          { produto: 'LUBRIFICANTE 1L',           qtd: 95,  qtdAnoAnterior: 92,  lucroBruto: 3040,  lucroBrutoAnoAnterior: 2900, margem: 58.20, acrescimos: 0, descontos: 0, precoVenda: 55.00, precoCusto: 23.00, lbPorUnidade: 32.00 },
          { produto: 'ARLA 32',                   qtd: 60,  qtdAnoAnterior: 55,  lucroBruto: 1800,  lucroBrutoAnoAnterior: 1600, margem: 62.00, acrescimos: 0, descontos: 0, precoVenda: 48.00, precoCusto: 18.00, lbPorUnidade: 30.00 },
        ],
      },
      {
        posto: 'POSTO DIVINO',
        produtos: [
          { produto: 'LUBRIFICANTE SINTÉTICO 1L', qtd: 70,  qtdAnoAnterior: 65,  lucroBruto: 3500,  lucroBrutoAnoAnterior: 3200, margem: 64.81, acrescimos: 0, descontos: 0, precoVenda: 77.00, precoCusto: 27.00, lbPorUnidade: 50.00 },
        ],
      },
    ],
  },
  conveniencias: {
    unidadeLabel: 'Quantidade',
    lbLabel: 'L.B. por unidade',
    postos: [
      {
        posto: 'POSTO TREVISO',
        produtos: [
          { produto: 'COCA COLA 600ML', qtd: 220, qtdAnoAnterior: 210, lucroBruto: 1320, lucroBrutoAnoAnterior: 1240, margem: 49.50, acrescimos: 0, descontos: 0, precoVenda: 12.00, precoCusto: 6.06, lbPorUnidade: 6.00 },
          { produto: 'CIGARRO MARLBORO', qtd: 180, qtdAnoAnterior: 175, lucroBruto: 1620, lucroBrutoAnoAnterior: 1530, margem: 30.00, acrescimos: 0, descontos: 0, precoVenda: 30.00, precoCusto: 21.00, lbPorUnidade: 9.00 },
        ],
      },
      {
        posto: 'POSTO ITAPOA',
        produtos: [
          { produto: 'CERVEJA LATA',  qtd: 320, qtdAnoAnterior: 300, lucroBruto: 1920, lucroBrutoAnoAnterior: 1780, margem: 50.00, acrescimos: 0, descontos: 0, precoVenda: 12.00, precoCusto: 6.00, lbPorUnidade: 6.00 },
          { produto: 'SANDUICHE NAT', qtd: 90,  qtdAnoAnterior: 80,  lucroBruto: 720,  lucroBrutoAnoAnterior: 640,  margem: 53.33, acrescimos: 0, descontos: 0, precoVenda: 15.00, precoCusto: 7.00, lbPorUnidade: 8.00 },
        ],
      },
      {
        posto: 'POSTO DIVINO',
        produtos: [
          { produto: 'CAFÉ EXPRESSO', qtd: 280, qtdAnoAnterior: 260, lucroBruto: 1400, lucroBrutoAnoAnterior: 1290, margem: 55.55, acrescimos: 0, descontos: 0, precoVenda: 9.00,  precoCusto: 4.00,  lbPorUnidade: 5.00 },
        ],
      },
    ],
  },
}

const setorTabs: { id: SetorId; label: string; Icon: typeof Fuel }[] = [
  { id: 'combustiveis', label: 'COMBUSTÍVEIS', Icon: Fuel },
  { id: 'automotivos', label: 'AUTOMOTIVOS', Icon: Wrench },
  { id: 'conveniencias', label: 'CONVENIÊNCIAS', Icon: Store },
]

const fmtPct = (v: number) => `${v.toFixed(2).replace('.', ',')}%`

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
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set(mockData.combustiveis.postos.map((p) => p.posto)))
  // Linha destacada — uma única por vez. Útil pra comparar visualmente
  // valores entre colunas sem perder de vista qual é a linha de interesse.
  const [selected, setSelected] = useState<string | null>(null)

  const toggleSelected = (key: string) => {
    setSelected((curr) => (curr === key ? null : key))
  }

  const data = mockData[setor]

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

  // Máximos pra calibrar barras
  const allRows = aggregated.postos.flatMap((p) => p.produtos)
  const maxQtd = allRows.reduce((m, r) => Math.max(m, r.qtd), 0)
  const maxLucro = allRows.reduce((m, r) => Math.max(m, r.lucroBruto), 0)
  const maxMargem = Math.max(...allRows.map((r) => r.margem), 0)

  const togglePosto = (posto: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(posto)) next.delete(posto)
      else next.add(posto)
      return next
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-gray-700 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Detalhamento de informações por setor
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
              <th className="px-3 py-2 text-left">Empresa</th>
              <th className="px-3 py-2 text-right">{data.unidadeLabel}</th>
              <th className="px-3 py-2 text-right">Ano anterior</th>
              <th className="px-3 py-2 text-right">Variação</th>
              <th className="px-3 py-2 text-right">Lucro Bruto</th>
              <th className="px-3 py-2 text-right">Ano anterior</th>
              <th className="px-3 py-2 text-right">Variação</th>
              <th className="px-3 py-2 text-right">Margem</th>
              <th className="px-3 py-2 text-right">Acréscimos</th>
              <th className="px-3 py-2 text-right">Descontos</th>
              <th className="px-3 py-2 text-right">Preço venda</th>
              <th className="px-3 py-2 text-right">Preço custo</th>
              <th className="px-3 py-2 text-right">{data.lbLabel}</th>
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
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(p.qtd)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatNumber(p.qtdAnoAnterior)}</td>
                    <td className="px-3 py-2 text-right"><VariacaoBadge value={qtdVar} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.lucroBruto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatCurrency(p.lucroBrutoAnoAnterior)}</td>
                    <td className="px-3 py-2 text-right"><VariacaoBadge value={lucroVar} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(p.margem)}</td>
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
                          <BarCell value={prod.qtd} max={maxQtd} formatted={formatNumber(prod.qtd)} color="blue" align="near" maxWidthPct={60} />
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs tabular-nums text-gray-400">{formatNumber(prod.qtdAnoAnterior)}</td>
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
              <td className="px-3 py-2 text-right tabular-nums">{formatNumber(aggregated.totals.qtd)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatNumber(aggregated.totals.qtdAnoAnterior)}</td>
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
