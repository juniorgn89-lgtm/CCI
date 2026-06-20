import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Fuel, Wrench, Store, Layers, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Trophy } from 'lucide-react'
import BarCell from '@/components/tables/BarCell'
import HeaderHint from '@/components/tables/HeaderHint'
import InfoHint from '@/components/ui/InfoHint'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'

type SetorId = 'combustiveis' | 'automotivos' | 'conveniencias'

interface ProdutoRow {
  produto: string
  grupo: string
  qtd: number
  qtdAnoAnterior: number
  lucroBruto: number
  lucroBrutoAnoAnterior: number
  faturamentoAnoAnterior: number
  margem: number
  acrescimos: number
  descontos: number
  precoVenda: number
  precoCusto: number
  lbPorUnidade: number
  cupons: number
  cuponsGrupo: number
  ticketMedio: number
}

interface PostoRow {
  posto: string
  cupons: number
  ticketMedio: number
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

/** Cabeçalho de GRUPO (linha superior do thead) — agrupa colunas por tema. */
const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th colSpan={colSpan} className={cn('bg-gray-100/60 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-gray-800/60 dark:text-gray-500', !first && 'border-l border-gray-200 dark:border-gray-700')}>
    {label}
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
      {up ? '+' : ''}{value.toFixed(2).replace('.', ',')}%
    </span>
  )
}

/** Métricas agregadas comuns a posto/grupo/produto (sem o nº de cupons). */
interface RowVals {
  qtd: number
  qtdAnoAnterior: number
  faturamento: number
  faturamentoAnoAnterior: number
  lucroBruto: number
  lucroBrutoAnoAnterior: number
  margem: number
  acrescimos: number
  descontos: number
  precoVenda: number
  precoCusto: number
  lbPorUnidade: number
}

interface Maxes { qtd: number; fat: number; lucro: number; margem: number }

/** Linha de dados (posto/grupo/produto) — células de métricas + trailing por setor. */
const DataRow = ({
  label, vals, isComb, showFaturamento, maxes, barPct, ticket, small, plain, onClick, selected, rowClass,
}: {
  label: ReactNode
  vals: RowVals
  isComb: boolean
  showFaturamento: boolean
  maxes: Maxes
  barPct?: number
  /** Ticket médio (posto). null → "—" (grupo/produto não têm cupons próprios). */
  ticket: number | null
  small?: boolean
  /** Total: números puros, sem barra. */
  plain?: boolean
  onClick?: (e: React.MouseEvent) => void
  selected?: boolean
  rowClass?: string
}) => {
  const qtdVar = variacaoPct(vals.qtd, vals.qtdAnoAnterior)
  const fatVar = variacaoPct(vals.faturamento, vals.faturamentoAnoAnterior)
  const lucroVar = variacaoPct(vals.lucroBruto, vals.lucroBrutoAnoAnterior)
  const txt = small ? 'text-xs ' : ''
  const pad = small ? 'py-1.5' : 'py-2'
  const antCls = cn('px-3 text-right tabular-nums', pad, small ? 'text-xs text-gray-400' : 'text-gray-500')
  const trailCls = cn('px-3 text-right tabular-nums', pad, txt)
  const numCls = cn('px-3 text-right tabular-nums', pad)
  const gStart = 'border-l border-gray-200 dark:border-gray-700'  // divisor entre grupos
  return (
    <tr onClick={onClick} aria-selected={selected} className={rowClass}>
      {label}
      {/* Operação */}
      {plain
        ? <td className={numCls}>{formatNumber(Math.round(vals.qtd))}</td>
        : <td className="px-2 py-1"><BarCell value={vals.qtd} max={maxes.qtd} formatted={formatNumber(Math.round(vals.qtd))} color="blue" align="near" maxWidthPct={barPct} /></td>}
      {/* Financeiro */}
      {showFaturamento && (plain
        ? <td className={cn(numCls, gStart)}>{formatCurrency(vals.faturamento)}</td>
        : <td className={cn('px-2 py-1', gStart)}><BarCell value={vals.faturamento} max={maxes.fat} formatted={formatCurrency(vals.faturamento)} color="blue" align="near" maxWidthPct={barPct} /></td>)}
      {plain
        ? <td className={cn(numCls, !showFaturamento && gStart)}>{formatCurrency(vals.lucroBruto)}</td>
        : <td className={cn('px-2 py-1', !showFaturamento && gStart)}><BarCell value={vals.lucroBruto} max={maxes.lucro} formatted={formatCurrency(vals.lucroBruto)} color="green" align="near" maxWidthPct={barPct} /></td>}
      {plain
        ? <td className={numCls}>{fmtPct(vals.margem)}</td>
        : <td className="px-2 py-1"><BarCell value={vals.margem} max={maxes.margem} formatted={fmtPct(vals.margem)} color="red" align="near" maxWidthPct={barPct} /></td>}
      {isComb && <td className={antCls}>{formatCurrency(vals.acrescimos)}</td>}
      {isComb && <td className={antCls}>{formatCurrency(vals.descontos)}</td>}
      {/* Comparativo */}
      <td className={cn(antCls, gStart)}>{showFaturamento ? formatCurrency(vals.faturamentoAnoAnterior) : formatNumber(Math.round(vals.qtdAnoAnterior))}</td>
      <td className={cn('px-3 text-right', pad)}><VariacaoBadge value={showFaturamento ? fatVar : qtdVar} /></td>
      <td className={antCls}>{formatCurrency(vals.lucroBrutoAnoAnterior)}</td>
      <td className={cn('px-3 text-right', pad)}><VariacaoBadge value={lucroVar} /></td>
      {/* Eficiência */}
      {isComb ? (
        <>
          <td className={cn(trailCls, gStart)}>{formatCurrency(vals.precoVenda)}</td>
          <td className={trailCls}>{formatCurrency(vals.precoCusto)}</td>
          <td className={trailCls}>{formatCurrency(vals.lbPorUnidade)}</td>
        </>
      ) : (
        <>
          <td className={cn(trailCls, gStart)}>{formatCurrency(vals.precoVenda)}</td>
          <td className={trailCls}>{formatCurrency(vals.precoCusto)}</td>
          <td className={cn(trailCls, ticket == null && 'text-gray-400')}>{ticket != null && ticket > 0 ? formatCurrency(ticket) : '—'}</td>
        </>
      )}
    </tr>
  )
}

/** Agrega uma lista de produtos numa linha (posto ou grupo). */
const aggProdutos = (prods: ProdutoRow[]): RowVals => {
  const a = prods.reduce((acc, p) => ({
    qtd: acc.qtd + p.qtd,
    qtdAnoAnterior: acc.qtdAnoAnterior + p.qtdAnoAnterior,
    lucroBruto: acc.lucroBruto + p.lucroBruto,
    lucroBrutoAnoAnterior: acc.lucroBrutoAnoAnterior + p.lucroBrutoAnoAnterior,
    faturamentoAnoAnterior: acc.faturamentoAnoAnterior + p.faturamentoAnoAnterior,
    acrescimos: acc.acrescimos + p.acrescimos,
    descontos: acc.descontos + p.descontos,
  }), { qtd: 0, qtdAnoAnterior: 0, lucroBruto: 0, lucroBrutoAnoAnterior: 0, faturamentoAnoAnterior: 0, acrescimos: 0, descontos: 0 })
  const faturamento = prods.reduce((s, p) => s + p.precoVenda * p.qtd, 0)
  const custoTotal = prods.reduce((s, p) => s + p.precoCusto * p.qtd, 0)
  return {
    ...a,
    faturamento,
    margem: faturamento > 0 ? (a.lucroBruto / faturamento) * 100 : 0,
    precoVenda: a.qtd > 0 ? faturamento / a.qtd : 0,
    precoCusto: a.qtd > 0 ? custoTotal / a.qtd : 0,
    lbPorUnidade: a.qtd > 0 ? a.lucroBruto / a.qtd : 0,
  }
}

const BenchmarkSetor = () => {
  const [setor, setSetor] = useState<SetorId>('combustiveis')
  // Chaves expandidas: `posto:NOME` e `grupo:POSTO:GRUPO`.
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set())
  const [selected, setSelected] = useState<string | null>(null)

  const toggleSelected = (key: string) => setSelected((curr) => (curr === key ? null : key))
  const toggleExpand = (key: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const rede = useRedeSetores()
  // Rótulos do bloco "Comparativo" seguem o modo escolhido no filtro global.
  const cmpLabel = rede.comparisonMode === 'prevYear' ? 'Ano anterior' : 'Mês anterior'
  const cmpWord = rede.comparisonMode === 'prevYear' ? 'ano anterior' : 'mês anterior'
  const setorReal = setor === 'combustiveis' ? rede.combustivel : setor === 'automotivos' ? rede.automotivos : rede.conveniencia
  const data = useMemo<SetorData>(() => ({
    unidadeLabel: setorReal.unidadeLabel,
    lbLabel: setorReal.lbLabel,
    postos: setorReal.postos.map((p) => ({ posto: p.posto, cupons: p.cupons, ticketMedio: p.ticketMedio, produtos: p.produtos })),
  }), [setorReal])

  // Agrega cada posto, seus grupos (tipo de produto) e o total geral.
  const aggregated = useMemo(() => {
    const postos = data.postos.map((p) => {
      const totals = aggProdutos(p.produtos)
      // Grupos (tipo de produto) dentro do posto — nível intermediário.
      const byGrupo = new Map<string, ProdutoRow[]>()
      for (const prod of p.produtos) {
        const g = prod.grupo || 'Sem grupo'
        const list = byGrupo.get(g)
        if (list) list.push(prod)
        else byGrupo.set(g, [prod])
      }
      const grupos = Array.from(byGrupo.entries())
        .map(([grupo, produtos]) => {
          const agg = aggProdutos(produtos)
          // Cupons do grupo são iguais em todos os produtos do grupo (desnormalizado).
          const cuponsGrupo = produtos[0]?.cuponsGrupo ?? 0
          return { grupo, produtos, ...agg, ticketMedio: cuponsGrupo > 0 ? agg.faturamento / cuponsGrupo : 0 }
        })
        .sort((a, b) => b.faturamento - a.faturamento)
      return { ...p, ...totals, grupos }
    })

    const totals = postos.reduce((acc, p) => ({
      qtd: acc.qtd + p.qtd,
      qtdAnoAnterior: acc.qtdAnoAnterior + p.qtdAnoAnterior,
      lucroBruto: acc.lucroBruto + p.lucroBruto,
      lucroBrutoAnoAnterior: acc.lucroBrutoAnoAnterior + p.lucroBrutoAnoAnterior,
      faturamentoAnoAnterior: acc.faturamentoAnoAnterior + p.faturamentoAnoAnterior,
      acrescimos: acc.acrescimos + p.acrescimos,
      descontos: acc.descontos + p.descontos,
      faturamento: acc.faturamento + p.faturamento,
      cupons: acc.cupons + p.cupons,
    }), { qtd: 0, qtdAnoAnterior: 0, lucroBruto: 0, lucroBrutoAnoAnterior: 0, faturamentoAnoAnterior: 0, acrescimos: 0, descontos: 0, faturamento: 0, cupons: 0 })

    const totalVals: RowVals = {
      ...totals,
      margem: totals.faturamento > 0 ? (totals.lucroBruto / totals.faturamento) * 100 : 0,
      precoVenda: totals.qtd > 0 ? totals.faturamento / totals.qtd : 0,
      precoCusto: totals.qtd > 0 ? (totals.faturamento - totals.lucroBruto) / totals.qtd : 0,
      lbPorUnidade: totals.qtd > 0 ? totals.lucroBruto / totals.qtd : 0,
    }
    const ticketMedio = totals.cupons > 0 ? totals.faturamento / totals.cupons : 0

    return { postos, totals: totalVals, ticketMedio }
  }, [data])

  // Posto que está "se destacando" — maior Lucro Bruto absoluto (≥ 2 postos).
  const postoDestaque = useMemo(() => {
    if (aggregated.postos.length < 2) return null
    const top = [...aggregated.postos].sort((a, b) => b.lucroBruto - a.lucroBruto)[0]
    return top && top.lucroBruto > 0 ? top.posto : null
  }, [aggregated])

  const showFaturamento = setor !== 'combustiveis'
  // Combustíveis mantém colunas próprias; Automotivos/Conveniências seguem a régua padrão.
  const isComb = setor === 'combustiveis'

  // Máximos pra calibrar as barras em cada nível (escalas próprias).
  const allProds = aggregated.postos.flatMap((p) => p.produtos)
  const allGrupos = aggregated.postos.flatMap((p) => p.grupos)
  const fatProd = (r: { precoVenda: number; qtd: number }) => r.precoVenda * r.qtd
  const maxPosto: Maxes = {
    qtd: aggregated.postos.reduce((m, p) => Math.max(m, p.qtd), 0),
    fat: aggregated.postos.reduce((m, p) => Math.max(m, p.faturamento), 0),
    lucro: aggregated.postos.reduce((m, p) => Math.max(m, p.lucroBruto), 0),
    margem: Math.max(...aggregated.postos.map((p) => p.margem), 0),
  }
  const maxGrupo: Maxes = {
    qtd: allGrupos.reduce((m, g) => Math.max(m, g.qtd), 0),
    fat: allGrupos.reduce((m, g) => Math.max(m, g.faturamento), 0),
    lucro: allGrupos.reduce((m, g) => Math.max(m, g.lucroBruto), 0),
    margem: Math.max(...allGrupos.map((g) => g.margem), 0),
  }
  const maxProd: Maxes = {
    qtd: allProds.reduce((m, r) => Math.max(m, r.qtd), 0),
    fat: allProds.reduce((m, r) => Math.max(m, fatProd(r)), 0),
    lucro: allProds.reduce((m, r) => Math.max(m, r.lucroBruto), 0),
    margem: Math.max(...allProds.map((r) => r.margem), 0),
  }

  // Converte um ProdutoRow no shape de RowVals (faturamento = preço × qtd).
  const prodVals = (prod: ProdutoRow): RowVals => ({
    qtd: prod.qtd,
    qtdAnoAnterior: prod.qtdAnoAnterior,
    faturamento: fatProd(prod),
    faturamentoAnoAnterior: prod.faturamentoAnoAnterior,
    lucroBruto: prod.lucroBruto,
    lucroBrutoAnoAnterior: prod.lucroBrutoAnoAnterior,
    margem: prod.margem,
    acrescimos: prod.acrescimos,
    descontos: prod.descontos,
    precoVenda: prod.precoVenda,
    precoCusto: prod.precoCusto,
    lbPorUnidade: prod.lbPorUnidade,
  })

  // Nº de colunas (pra colspan de eventuais estados vazios) — não usado, mantido simples.
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-gray-700 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gray-500" />
            <h3 className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Detalhamento de informações por setor
              <InfoHint text={`Vendas da rede inteira por setor (Combustíveis / Automotivos / Conveniências), com cada posto e seus grupos/produtos. Clique no posto pra expandir os grupos, e no grupo pra ver os produtos. Compara com o mesmo período do ${cmpWord}.`} />
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
            {/* Linha de GRUPOS — Operação · Financeiro · Comparativo · Eficiência */}
            <tr className="text-gray-400 dark:text-gray-500">
              <th className="px-3 py-1.5" />
              <GroupTh first label="Operação" colSpan={1} />
              <GroupTh label="Financeiro" colSpan={showFaturamento ? 3 : 4} />
              <GroupTh label="Comparativo" colSpan={4} />
              <GroupTh label="Eficiência" colSpan={3} />
            </tr>
            <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <HeaderHint align="left" label="Empresa" help="Posto da rede. Clique pra expandir os grupos de produtos." />
              {/* Operação */}
              <HeaderHint label={data.unidadeLabel} help={data.unidadeLabel === 'Litros' ? 'Volume vendido no período (L).' : 'Unidades vendidas no período.'} />
              {/* Financeiro */}
              {showFaturamento && (
                <HeaderHint groupStart label="Faturamento" help="Faturamento bruto no período (R$): Σ preço de venda × quantidade." />
              )}
              <HeaderHint groupStart={!showFaturamento} label="Lucro Bruto" help="Faturamento − custo (CMV) no período (R$)." />
              <HeaderHint label="Margem" help="(Lucro bruto ÷ faturamento) × 100." />
              {isComb && <HeaderHint label="Acréscimos" help="Σ dos acréscimos aplicados nas vendas no período (R$)." />}
              {isComb && <HeaderHint label="Descontos" help="Σ dos descontos concedidos nas vendas no período (R$)." />}
              {/* Comparativo */}
              <HeaderHint groupStart label={cmpLabel} help={showFaturamento ? `Faturamento no mesmo período do ${cmpWord} (R$).` : `Mesmo período do ${cmpWord} (volume).`} />
              <HeaderHint label="Variação" help={showFaturamento ? `Variação % do faturamento vs o ${cmpWord}.` : `Variação % do volume vs o ${cmpWord}.`} />
              <HeaderHint label={cmpLabel} help={`Lucro bruto no mesmo período do ${cmpWord} (R$).`} />
              <HeaderHint label="Variação" help={`Variação % do lucro bruto vs o ${cmpWord}.`} />
              {/* Eficiência */}
              {isComb ? (
                <>
                  <HeaderHint groupStart label="Preço venda" help="Preço médio de venda por unidade: faturamento ÷ quantidade." />
                  <HeaderHint label="Preço custo" help="Custo médio por unidade: custo ÷ quantidade." />
                  <HeaderHint label={data.lbLabel} help="Lucro bruto por unidade: lucro ÷ quantidade." />
                </>
              ) : (
                <>
                  <HeaderHint groupStart label="Preço médio" help="Preço médio de venda por unidade: faturamento ÷ quantidade." />
                  <HeaderHint label="Custo médio" help="Custo médio por unidade: custo ÷ quantidade." />
                  <HeaderHint label="Ticket médio" help="Faturamento ÷ nº de cupons (vendas)." />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {aggregated.postos.map((p) => {
              const postoKey = `posto:${p.posto}`
              const expanded = expandidos.has(postoKey)
              const postoLabel = (
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
              )
              return (
                <Fragment key={p.posto}>
                  <DataRow
                    label={postoLabel}
                    vals={p}
                    isComb={isComb}
                    showFaturamento={showFaturamento}
                    maxes={maxPosto}
                    ticket={isComb ? null : p.ticketMedio}
                    onClick={() => { toggleExpand(postoKey); toggleSelected(postoKey) }}
                    selected={selected === postoKey}
                    rowClass={cn(
                      'cursor-pointer border-b border-gray-100 font-semibold text-gray-900 transition-colors dark:border-gray-800 dark:text-gray-100',
                      selected === postoKey
                        ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/40 dark:hover:bg-amber-900/50'
                        : 'bg-gray-50/40 hover:bg-blue-50/60 dark:bg-gray-800/30 dark:hover:bg-blue-900/20',
                    )}
                  />

                  {/* Combustíveis: posto → produtos. Demais: posto → grupos → produtos. */}
                  {expanded && isComb && p.produtos.map((prod) => (
                    <DataRow
                      key={`${p.posto}-${prod.produto}`}
                      small
                      label={<td className="px-3 py-1.5 pl-9 text-left text-xs">{prod.produto}</td>}
                      vals={prodVals(prod)}
                      isComb={isComb}
                      showFaturamento={showFaturamento}
                      maxes={maxProd}
                      barPct={60}
                      ticket={null}
                      onClick={(e) => { e.stopPropagation(); toggleSelected(`prod:${p.posto}:${prod.produto}`) }}
                      selected={selected === `prod:${p.posto}:${prod.produto}`}
                      rowClass={cn(
                        'cursor-pointer border-b border-gray-100 text-gray-700 transition-colors dark:border-gray-800 dark:text-gray-300',
                        selected === `prod:${p.posto}:${prod.produto}`
                          ? 'bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-900/20 dark:hover:bg-amber-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                      )}
                    />
                  ))}

                  {expanded && !isComb && p.grupos.map((g) => {
                    const grupoKey = `grupo:${p.posto}:${g.grupo}`
                    const gExpanded = expandidos.has(grupoKey)
                    const grupoLabel = (
                      <td className="px-3 py-1.5 pl-7 text-left text-[13px]">
                        <span className="inline-flex items-center gap-1.5">
                          {gExpanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                          {g.grupo}
                        </span>
                      </td>
                    )
                    return (
                      <Fragment key={grupoKey}>
                        <DataRow
                          label={grupoLabel}
                          vals={g}
                          isComb={isComb}
                          showFaturamento={showFaturamento}
                          maxes={maxGrupo}
                          ticket={isComb ? null : g.ticketMedio}
                          onClick={() => { toggleExpand(grupoKey); toggleSelected(grupoKey) }}
                          selected={selected === grupoKey}
                          rowClass={cn(
                            'cursor-pointer border-b border-gray-100 font-medium text-gray-800 transition-colors dark:border-gray-800 dark:text-gray-200',
                            selected === grupoKey
                              ? 'bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-900/25 dark:hover:bg-amber-900/35'
                              : 'bg-gray-50/30 hover:bg-blue-50/40 dark:bg-gray-800/20 dark:hover:bg-blue-900/15',
                          )}
                        />
                        {gExpanded && g.produtos.map((prod) => (
                          <DataRow
                            key={`${grupoKey}-${prod.produto}`}
                            small
                            label={<td className="px-3 py-1.5 pl-[3.25rem] text-left text-xs text-gray-500 dark:text-gray-400">{prod.produto}</td>}
                            vals={prodVals(prod)}
                            isComb={isComb}
                            showFaturamento={showFaturamento}
                            maxes={maxProd}
                            barPct={55}
                            ticket={isComb ? null : prod.ticketMedio}
                            onClick={(e) => { e.stopPropagation(); toggleSelected(`prod:${p.posto}:${prod.produto}`) }}
                            selected={selected === `prod:${p.posto}:${prod.produto}`}
                            rowClass={cn(
                              'cursor-pointer border-b border-gray-100 text-gray-600 transition-colors dark:border-gray-800 dark:text-gray-400',
                              selected === `prod:${p.posto}:${prod.produto}`
                                ? 'bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-900/20 dark:hover:bg-amber-900/30'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                            )}
                          />
                        ))}
                      </Fragment>
                    )
                  })}
                </Fragment>
              )
            })}
            <DataRow
              label={<td className="px-3 py-2 text-left">Total</td>}
              vals={aggregated.totals}
              isComb={isComb}
              showFaturamento={showFaturamento}
              maxes={maxPosto}
              ticket={isComb ? null : aggregated.ticketMedio}
              plain
              rowClass="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BenchmarkSetor
