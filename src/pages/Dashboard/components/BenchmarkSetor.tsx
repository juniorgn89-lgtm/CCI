import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { Fuel, Wrench, Store, Layers, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Trophy, Globe, LineChart, CalendarClock } from 'lucide-react'
import BarCell from '@/components/tables/BarCell'
import HeaderHint from '@/components/tables/HeaderHint'
import InfoHint from '@/components/ui/InfoHint'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import { monthEndFactor, projecaoSazonal, fimDoMesIso } from '@/lib/projection'
import { todayLocal } from '@/lib/period'
import { GROUP_TINT } from '@/lib/groupTint'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import useCentralSazonal from '@/pages/Dashboard/hooks/useCentralSazonal'

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

const fmtPct = (v: number) => `${v.toFixed(2).replace('.', ',')}%`

/** Cabeçalho de GRUPO (linha superior do thead) — agrupa colunas por tema. */
const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th colSpan={colSpan} className={cn('bg-gray-100/60 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-transparent dark:text-gray-500', !first && 'border-l border-gray-200 dark:border-gray-700')}>
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
  const antCls = cn('px-2 text-right tabular-nums', pad, small ? 'text-xs text-gray-400' : 'text-gray-500')
  const trailCls = cn('px-2 text-right tabular-nums', pad, txt)
  const numCls = cn('px-2 text-right tabular-nums', pad)
  const gStart = 'border-l border-gray-200 dark:border-gray-700'  // divisor entre grupos
  return (
    <tr onClick={onClick} aria-selected={selected} className={rowClass}>
      {label}
      {/* Operação */}
      {plain
        ? <td className={cn(numCls, 'pl-7')}>{formatNumber(Math.round(vals.qtd))}</td>
        : <td className={cn('px-1.5 py-1 pl-7')}><BarCell value={vals.qtd} max={maxes.qtd} formatted={formatNumber(Math.round(vals.qtd))} color="blue" align="near" maxWidthPct={barPct} /></td>}
      {/* Financeiro */}
      {showFaturamento && (plain
        ? <td className={cn(numCls, gStart)}>{formatCurrencyInt(vals.faturamento)}</td>
        : <td className={cn('px-1.5 py-1', gStart)}><BarCell value={vals.faturamento} max={maxes.fat} formatted={formatCurrencyInt(vals.faturamento)} color="blue" align="near" maxWidthPct={barPct} /></td>)}
      {plain
        ? <td className={cn(numCls, !showFaturamento && gStart)}>{formatCurrencyInt(vals.lucroBruto)}</td>
        : <td className={cn('px-1.5 py-1', !showFaturamento && gStart)}><BarCell value={vals.lucroBruto} max={maxes.lucro} formatted={formatCurrencyInt(vals.lucroBruto)} color="green" align="near" maxWidthPct={barPct} /></td>}
      {plain
        ? <td className={numCls}>{fmtPct(vals.margem)}</td>
        : <td className="px-1.5 py-1"><BarCell value={vals.margem} max={maxes.margem} formatted={fmtPct(vals.margem)} color="slate" align="near" maxWidthPct={barPct} /></td>}
      {/* Comparativo */}
      <td className={cn(antCls, gStart)}>{showFaturamento ? formatCurrencyInt(vals.faturamentoAnoAnterior) : formatNumber(Math.round(vals.qtdAnoAnterior))}</td>
      <td className={cn('px-2 text-right', pad)}><VariacaoBadge value={showFaturamento ? fatVar : qtdVar} /></td>
      <td className={antCls}>{formatCurrencyInt(vals.lucroBrutoAnoAnterior)}</td>
      <td className={cn('px-2 text-right', pad)}><VariacaoBadge value={lucroVar} /></td>
      {/* Eficiência */}
      {isComb ? (
        <>
          <td className={cn(trailCls, gStart)}>{formatCurrency(vals.precoVenda)}</td>
          <td className={trailCls}>{formatCurrency(vals.precoCusto)}</td>
          <td className={cn(trailCls, 'font-semibold text-emerald-700 dark:text-emerald-400')}>{formatCurrency(vals.lbPorUnidade)}</td>
        </>
      ) : (
        <>
          <td className={cn(trailCls, gStart)}>{formatCurrency(vals.precoVenda)}</td>
          <td className={trailCls}>{formatCurrency(vals.precoCusto)}</td>
          <td className={cn(trailCls, ticket == null ? 'text-gray-400' : 'font-semibold text-emerald-700 dark:text-emerald-400')}>{ticket != null && ticket > 0 ? formatCurrency(ticket) : '—'}</td>
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

/* ─────────────────────────── Projeções por empresa ─────────────────────────── */

type ViewMode = 'realizado' | 'projecoes'

interface ProjPostoRow {
  posto: string
  realLB: number; realFat: number; realLitros: number
  /** Projetados JÁ somados por posto (Σ realizado_setor × fator sazonal do posto). */
  projLB: number; projFat: number; projLit: number
  lbAnt: number
}

/** Segmento genérico (toggle) — reusado pelo seletor de setor/escopo. */
const Segmented = ({ tabs, active, onSelect }: {
  tabs: { id: string; label: string; Icon: typeof Fuel }[]
  active: string
  onSelect: (id: string) => void
}) => (
  <div className="inline-flex items-center gap-0.5 self-start rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
    {tabs.map((s) => {
      const Icon = s.Icon
      const isActive = active === s.id
      return (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors',
            isActive ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {s.label}
        </button>
      )
    })}
  </div>
)

/**
 * Tabela de PROJEÇÃO por empresa. Projeção SAZONAL POR POSTO (realizado × fator
 * fim-de-mês ponderado por dia-da-semana do próprio posto; ramo linear quando
 * <90d de operação), o MESMO índice per-posto do painel de Projeção da rede →
 * painel e tabela somam por posto e batem número a número. Coluna-chave: "vs mês
 * ant." compara o PROJETADO com o período anterior. Margem projetada = margem
 * realizada (proporcional), por isso não há coluna de margem.
 */
const ProjecaoEmpresaTable = ({ rows, isProjetando, showQtd, qtdLabel, cmpShort, fimProjLabel, compact }: {
  rows: ProjPostoRow[]
  isProjetando: boolean
  /** Mostra a coluna de quantidade (Litros p/ combustível, Qtd p/ auto/conv). */
  showQtd: boolean
  /** Rótulo da quantidade: "Litros" | "Qtd". */
  qtdLabel: string
  cmpShort: string
  fimProjLabel: string
  compact?: boolean // empilhado: banner/rodapé/margem-topo vêm do pai (uma vez só).
}) => {
  const total = rows.reduce(
    (a, r) => ({
      realLB: a.realLB + r.realLB, realFat: a.realFat + r.realFat, realLitros: a.realLitros + r.realLitros,
      projLB: a.projLB + r.projLB, projFat: a.projFat + r.projFat, projLit: a.projLit + r.projLit,
      lbAnt: a.lbAnt + r.lbAnt,
    }),
    { realLB: 0, realFat: 0, realLitros: 0, projLB: 0, projFat: 0, projLit: 0, lbAnt: 0 },
  )

  const Linha = ({ posto, realLB, realFat, realLitros, projLB, projFat, projLit, lbAnt, bold }: ProjPostoRow & { bold?: boolean }) => {
    const aRealizar = projLB - realLB
    const num = 'px-2 py-2 text-right tabular-nums'
    const real = cn(num, bold ? '' : 'text-gray-500 dark:text-gray-400')
    const gl = 'border-l border-gray-200 dark:border-gray-700'
    return (
      <tr className={cn('border-b border-gray-100 dark:border-gray-800', bold && 'border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100')}>
        <td className={cn('px-3 py-2 text-left', bold ? 'font-bold' : 'font-medium text-gray-800 dark:text-gray-200')}>{posto}</td>
        {showQtd && (
          <>
            <td className={cn(real, gl)}>{formatNumber(Math.round(realLitros))}</td>
            <td className={cn(num, 'font-semibold text-sky-700 dark:text-sky-300')}>{formatNumber(Math.round(projLit))}</td>
          </>
        )}
        <td className={cn(real, gl)}>{formatCurrencyInt(realFat)}</td>
        <td className={cn(num, 'font-semibold text-amber-700 dark:text-amber-300')}>{formatCurrencyInt(projFat)}</td>
        <td className={cn(real, gl)}>{formatCurrencyInt(realLB)}</td>
        <td className={cn(num, 'font-semibold text-emerald-700 dark:text-emerald-400')}>{formatCurrencyInt(projLB)}</td>
        <td className={cn(num, bold ? '' : 'text-gray-600 dark:text-gray-300')}>{formatCurrencyInt(aRealizar)}</td>
        <td className={cn(real, gl)}>{formatCurrencyInt(lbAnt)}</td>
        <td className={num}><VariacaoBadge value={variacaoPct(realLB, lbAnt)} /></td>
      </tr>
    )
  }

  return (
    <div className={cn('overflow-x-auto', !compact && 'mt-4')}>
      {!compact && !isProjetando && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          <CalendarClock className="h-4 w-4 shrink-0" />
          Período sem dias futuros — a projeção é igual ao realizado (nada a projetar).
        </div>
      )}
      <table className="w-full text-sm">
        {/* Fundo levíssimo, uma cor por grupo de coluna. */}
        <colgroup>
          <col /> {/* Empresa */}
          {showQtd && <col span={2} className={GROUP_TINT.operacao} />} {/* Litros/Qtd */}
          <col span={2} className={GROUP_TINT.financeiro} /> {/* Faturamento */}
          <col span={3} className={GROUP_TINT.eficiencia} /> {/* Lucro bruto */}
          <col span={2} className={GROUP_TINT.comparativo} /> {/* vs período anterior */}
        </colgroup>
        <thead>
          <tr className="text-gray-400 dark:text-gray-500">
            <th className="px-3 py-1.5" />
            {showQtd && <GroupTh first label={qtdLabel} colSpan={2} />}
            <GroupTh first={!showQtd} label="Faturamento" colSpan={2} />
            <GroupTh label="Lucro bruto" colSpan={3} />
            <GroupTh label={`vs ${cmpShort}`} colSpan={2} />
          </tr>
          <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <HeaderHint align="left" label="Empresa" help="Posto da rede." />
            {showQtd && (
              <>
                <HeaderHint groupStart label={<>{qtdLabel}<br />realiz.</>} help={`${qtdLabel === 'Litros' ? 'Litros vendidos' : 'Quantidade vendida'} no período (realizado).`} />
                <HeaderHint label={<>{qtdLabel}<br />projet.</>} help={`${qtdLabel} projetado(s) pro fim do mês — projeção sazonal por posto (índice de dia-da-semana, 6 meses).`} />
              </>
            )}
            <HeaderHint groupStart label={<>Fat.<br />realiz.</>} help="Faturamento realizado no período." />
            <HeaderHint label={<>Fat.<br />projet.</>} help="Faturamento projetado pro fim do mês — projeção sazonal por posto (índice de dia-da-semana, 6 meses)." />
            <HeaderHint groupStart label={<>LB<br />realiz.</>} help="Lucro bruto realizado no período." />
            <HeaderHint label={<>LB<br />projet.</>} help={`Lucro bruto projetado pro fim do mês — projeção sazonal por posto (índice de dia-da-semana ponderado, 6 meses de histórico; ramo linear quando <90d de operação), até ${fimProjLabel}.`} />
            <HeaderHint label={<>A<br />realizar</>} help="Lucro bruto que ainda falta realizar até o fim do mês (projetado − realizado)." />
            <HeaderHint groupStart label={`LB ${cmpShort}`} help={`Lucro bruto no mesmo período do ${cmpShort}.`} />
            <HeaderHint label="Var." help={`Variação do lucro bruto REALIZADO vs o ${cmpShort}: (LB realizado ÷ LB ${cmpShort} − 1) × 100.`} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => <Linha key={r.posto} {...r} />)}
          <Linha posto="Total" realLB={total.realLB} realFat={total.realFat} realLitros={total.realLitros} projLB={total.projLB} projFat={total.projFat} projLit={total.projLit} lbAnt={total.lbAnt} bold />
        </tbody>
      </table>
      {!compact && (
        <p className="mt-2 text-[11px] text-gray-400">
          Projeção sazonal por posto: realizado × fator fim-de-mês ponderado pelo dia-da-semana (índice de 6 meses; ramo linear quando &lt;90d de operação) até {fimProjLabel}. Margem projetada = margem realizada.
        </p>
      )}
    </div>
  )
}

/** Bloco de REALIZADO de UM setor — título + tabela (posto → grupos → produtos).
 *  Cada bloco tem seu PRÓPRIO estado de expansão/seleção (tabelas independentes),
 *  pra os 3 setores aparecerem empilhados sem interferir um no outro. */
const SetorRealizadoBloco = ({ data, setorId, titulo, Icon, cmpWord, cmpShort }: {
  data: SetorData
  setorId: SetorId
  titulo: string
  Icon: typeof Fuel
  cmpWord: string
  cmpShort: string
}) => {
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

  // Agrega cada posto, seus grupos (tipo de produto) e o total geral.
  const aggregated = useMemo(() => {
    const postos = data.postos.map((p) => {
      const totals = aggProdutos(p.produtos)
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

  const postoDestaque = useMemo(() => {
    if (aggregated.postos.length < 2) return null
    const top = [...aggregated.postos].sort((a, b) => b.lucroBruto - a.lucroBruto)[0]
    return top && top.lucroBruto > 0 ? top.posto : null
  }, [aggregated])

  const showFaturamento = setorId !== 'combustiveis'
  const isComb = setorId === 'combustiveis'

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

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h4 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">{titulo}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Fundo levíssimo, uma cor por grupo de coluna. */}
          <colgroup>
            <col /> {/* Empresa */}
            <col className={GROUP_TINT.operacao} /> {/* Operação */}
            {showFaturamento && <col className={GROUP_TINT.financeiro} />} {/* Faturamento */}
            <col className={GROUP_TINT.financeiro} /> {/* Lucro bruto */}
            <col className={GROUP_TINT.financeiro} /> {/* Margem */}
            <col span={4} className={GROUP_TINT.comparativo} /> {/* Comparativo */}
            <col span={3} className={GROUP_TINT.eficiencia} /> {/* Eficiência */}
          </colgroup>
          <thead>
            {/* Linha de GRUPOS — Operação · Financeiro · Comparativo · Eficiência */}
            <tr className="text-gray-400 dark:text-gray-500">
              <th className="px-3 py-1.5" />
              <GroupTh first label="Operação" colSpan={1} />
              <GroupTh label="Financeiro" colSpan={2 + (showFaturamento ? 1 : 0)} />
              <GroupTh label="Comparativo" colSpan={4} />
              <GroupTh label="Eficiência" colSpan={3} />
            </tr>
            <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <HeaderHint align="left" label="Empresa" help="Posto da rede. Clique pra expandir os grupos de produtos." />
              {/* Operação */}
              <HeaderHint className="pl-7" label={data.unidadeLabel} help={data.unidadeLabel === 'Litros' ? 'Volume vendido no período (L).' : 'Unidades vendidas no período.'} />
              {/* Financeiro */}
              {showFaturamento && (
                <HeaderHint groupStart label="Faturamento" help="Faturamento bruto no período (R$): Σ preço de venda × quantidade." />
              )}
              <HeaderHint groupStart={!showFaturamento} label={<>Lucro<br />Bruto</>} help="Faturamento − custo (CMV) no período (R$)." />
              <HeaderHint label="Margem" help="(Lucro bruto ÷ faturamento) × 100." />
              {/* Comparativo — métrica explícita na 1ª linha, "(mês/ano ant.)" na 2ª */}
              <HeaderHint groupStart label={showFaturamento ? 'Faturamento' : data.unidadeLabel} sub={`(${cmpShort})`} help={showFaturamento ? `Faturamento no mesmo período do ${cmpWord} (R$).` : `${data.unidadeLabel} no mesmo período do ${cmpWord}.`} />
              <HeaderHint label={<>Var.<br />{showFaturamento ? 'faturamento' : data.unidadeLabel.toLowerCase()}</>} help={showFaturamento ? `Variação % do faturamento vs o ${cmpWord}.` : `Variação % do volume vs o ${cmpWord}.`} />
              <HeaderHint label="Lucro bruto" sub={`(${cmpShort})`} help={`Lucro bruto no mesmo período do ${cmpWord} (R$).`} />
              <HeaderHint label={<>Var. lucro<br />bruto</>} help={`Variação % do lucro bruto vs o ${cmpWord}.`} />
              {/* Eficiência */}
              {isComb ? (
                <>
                  <HeaderHint groupStart label={<>Preço<br />venda</>} help="Preço médio de venda por unidade: faturamento ÷ quantidade." />
                  <HeaderHint label={<>Preço<br />custo</>} help="Custo médio por unidade: custo ÷ quantidade." />
                  <HeaderHint label={data.lbLabel} help="Lucro bruto por unidade: lucro ÷ quantidade." />
                </>
              ) : (
                <>
                  <HeaderHint groupStart label={<>Preço<br />médio</>} help="Preço médio de venda por unidade: faturamento ÷ quantidade." />
                  <HeaderHint label={<>Custo<br />médio</>} help="Custo médio por unidade: custo ÷ quantidade." />
                  <HeaderHint label={<>Ticket<br />médio</>} help="Faturamento ÷ nº de cupons (vendas)." />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {aggregated.postos.map((p) => {
              const postoKey = `${setorId}:posto:${p.posto}`
              const expanded = expandidos.has(postoKey)
              const postoLabel = (
                <td className="px-3 py-2 text-left">
                  <span className="inline-flex items-center gap-1.5">
                    {expanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                    {p.posto}
                    {postoDestaque === p.posto && (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          <Trophy className="h-3 w-3" />
                          Destaque
                        </span>
                        <InfoHint text={`Maior Lucro Bruto do setor (${formatCurrency(p.lucroBruto)})`} />
                      </>
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
                      onClick={(e) => { e.stopPropagation(); toggleSelected(`${setorId}:prod:${p.posto}:${prod.produto}`) }}
                      selected={selected === `${setorId}:prod:${p.posto}:${prod.produto}`}
                      rowClass={cn(
                        'cursor-pointer border-b border-gray-100 text-gray-700 transition-colors dark:border-gray-800 dark:text-gray-300',
                        selected === `${setorId}:prod:${p.posto}:${prod.produto}`
                          ? 'bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-900/20 dark:hover:bg-amber-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                      )}
                    />
                  ))}

                  {expanded && !isComb && p.grupos.map((g) => {
                    const grupoKey = `${setorId}:grupo:${p.posto}:${g.grupo}`
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
                            onClick={(e) => { e.stopPropagation(); toggleSelected(`${setorId}:prod:${p.posto}:${prod.produto}`) }}
                            selected={selected === `${setorId}:prod:${p.posto}:${prod.produto}`}
                            rowClass={cn(
                              'cursor-pointer border-b border-gray-100 text-gray-600 transition-colors dark:border-gray-800 dark:text-gray-400',
                              selected === `${setorId}:prod:${p.posto}:${prod.produto}`
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

const BenchmarkSetor = () => {
  const [view, setView] = useState<ViewMode>('realizado')

  const rede = useRedeSetores()
  // Rótulos do bloco "Comparativo" seguem o modo escolhido no filtro global.
  const cmpWord = rede.comparisonMode === 'prevYear' ? 'ano anterior' : 'mês anterior'
  // Sufixo curto pros títulos do Comparativo (cabe junto da métrica).
  const cmpShort = rede.comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'

  // ── Projeções por empresa (view 'projecoes') ──
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  // Índice sazonal per-posto (mesma fonte do painel de Projeção → tabelas batem).
  const sazonal = useCentralSazonal()
  const isProjetando = monthEndFactor(dataInicial, dataFinal) > 1.0001
  const fimProjLabel = useMemo(() => {
    const [y, m] = (dataInicial || '').split('-').map(Number)
    if (!y || !m) return '—'
    const lastDay = new Date(y, m, 0).getDate()
    const fim = dataFinal && dataFinal > `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}` ? dataFinal : `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const [, mm, dd] = fim.split('-')
    return `${dd}/${mm}`
  }, [dataInicial, dataFinal])

  // Projeções empilhadas: Global (soma dos 3) + cada setor, um bloco embaixo do
  // outro (mesma ideia do Realizado). Realizado por posto no escopo escolhido.
  const projBlocos = useMemo(() => {
    // Fatores EFETIVOS por setor: a projeção do setor (MESMO `projecaoSazonal` do
    // painel, sobre a série diária da rede) ÷ realizado do setor. Cada posto é
    // projetado por realizado × fator → a soma dos postos = projeção do painel
    // (painel = tabela = abas). Fica proporcional ao realizado do posto.
    const monthEnd = fimDoMesIso(dataInicial || todayLocal())
    const projToday = todayLocal()
    const fatoresDe = (setorObj: typeof rede.combustivel, singular: 'combustivel' | 'automotivos' | 'conveniencia') => {
      const esp = (value: (d: { faturamento: number; lucroBruto: number; qtd: number }) => number, metrica: 'faturamento' | 'qtd' | 'lucro') =>
        projecaoSazonal({
          dailySeries: setorObj.daily.map((d) => ({ data: d.data, value: value(d) })),
          today: projToday,
          dataFinal: monthEnd,
          indices: sazonal.indice(singular, metrica),
        }).esperado
      return {
        fFat: setorObj.faturamento > 0 ? esp((d) => d.faturamento, 'faturamento') / setorObj.faturamento : 1,
        fLuc: setorObj.lucroBruto > 0 ? esp((d) => d.lucroBruto, 'lucro') / setorObj.lucroBruto : 1,
        fQtd: setorObj.qtd > 0 ? esp((d) => d.qtd, 'qtd') / setorObj.qtd : 1,
      }
    }
    const fatores: Record<'combustivel' | 'automotivos' | 'conveniencia', { fFat: number; fLuc: number; fQtd: number }> = {
      combustivel: fatoresDe(rede.combustivel, 'combustivel'),
      automotivos: fatoresDe(rede.automotivos, 'automotivos'),
      conveniencia: fatoresDe(rede.conveniencia, 'conveniencia'),
    }
    const build = (scopes: SetorId[]): ProjPostoRow[] => {
      const map = new Map<string, ProjPostoRow>()
      for (const sc of scopes) {
        const setorObj = sc === 'combustiveis' ? rede.combustivel : sc === 'automotivos' ? rede.automotivos : rede.conveniencia
        const singular: 'combustivel' | 'automotivos' | 'conveniencia' =
          sc === 'combustiveis' ? 'combustivel' : sc === 'automotivos' ? 'automotivos' : 'conveniencia'
        const { fFat, fLuc, fQtd } = fatores[singular]
        for (const p of setorObj.postos) {
          const e = map.get(p.posto) ?? { posto: p.posto, realLB: 0, realFat: 0, realLitros: 0, projLB: 0, projFat: 0, projLit: 0, lbAnt: 0 }
          e.realLB += p.lucroBruto; e.projLB += p.lucroBruto * fLuc
          e.realFat += p.faturamento; e.projFat += p.faturamento * fFat
          // Quantidade (litros p/ combustível, unidades p/ auto/conv). No bloco
          // Global (multi-setor) não faz sentido somar litros + unidades → só nos
          // blocos de um setor só (a coluna fica escondida no Global).
          e.realLitros += p.qtd; e.projLit += p.qtd * fQtd
          e.lbAnt += p.lucroBrutoAnoAnterior
          map.set(p.posto, e)
        }
      }
      return [...map.values()].sort((a, b) => b.realLB - a.realLB)
    }
    return [
      { id: 'global', titulo: 'Global (rede consolidada)', Icon: Globe, showQtd: false, qtdLabel: 'Qtd', rows: build(['combustiveis', 'automotivos', 'conveniencias']) },
      { id: 'combustiveis', titulo: 'Combustíveis', Icon: Fuel, showQtd: true, qtdLabel: 'Litros', rows: build(['combustiveis']) },
      { id: 'automotivos', titulo: 'Automotivos', Icon: Wrench, showQtd: true, qtdLabel: 'Qtd', rows: build(['automotivos']) },
      { id: 'conveniencias', titulo: 'Conveniências', Icon: Store, showQtd: true, qtdLabel: 'Qtd', rows: build(['conveniencias']) },
    ]
  }, [rede, dataInicial, sazonal])

  // Setores (na ordem exibida, um bloco embaixo do outro).
  const setorBlocos: { id: SetorId; titulo: string; Icon: typeof Fuel; obj: SetorData }[] = [
    { id: 'combustiveis', titulo: 'Combustíveis', Icon: Fuel, obj: rede.combustivel },
    { id: 'automotivos', titulo: 'Automotivos', Icon: Wrench, obj: rede.automotivos },
    { id: 'conveniencias', titulo: 'Conveniências', Icon: Store, obj: rede.conveniencia },
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
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
            {view === 'realizado'
              ? 'Aqui temos todas as vendas setorizadas com maior nível de detalhes'
              : 'Projeção de fechamento do mês por posto, no ritmo atual dos dias decorridos'}
          </p>
          {/* Sub-aba: Realizado · Projeções */}
          <div className="mt-3">
            <Segmented
              tabs={[{ id: 'realizado', label: 'REALIZADO', Icon: Layers }, { id: 'projecoes', label: 'PROJEÇÕES', Icon: LineChart }]}
              active={view}
              onSelect={(id) => setView(id as ViewMode)}
            />
          </div>
        </div>
        {/* Realizado e Projeções mostram os setores empilhados — sem seletor de escopo. */}
      </div>

      {view === 'realizado' && (
        <div className="mt-4 space-y-10">
          {setorBlocos.map((s) => (
            <SetorRealizadoBloco
              key={s.id}
              data={s.obj}
              setorId={s.id}
              titulo={s.titulo}
              Icon={s.Icon}
              cmpWord={cmpWord}
              cmpShort={cmpShort}
            />
          ))}
        </div>
      )}

      {view === 'projecoes' && (
        <div className="mt-4">
          {!isProjetando && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              <CalendarClock className="h-4 w-4 shrink-0" />
              Período sem dias futuros — a projeção é igual ao realizado (nada a projetar).
            </div>
          )}
          <div className="space-y-8">
            {projBlocos.map((b) => (
              <div key={b.id}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    <b.Icon className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">{b.titulo}</h4>
                </div>
                <ProjecaoEmpresaTable
                  rows={b.rows}
                  isProjetando={isProjetando}
                  showQtd={b.showQtd}
                  qtdLabel={b.qtdLabel}
                  cmpShort={cmpShort}
                  fimProjLabel={fimProjLabel}
                  compact
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-gray-400">
            Projeção sazonal por posto: realizado × fator fim-de-mês ponderado pelo dia-da-semana (índice de 6 meses; ramo linear quando &lt;90d de operação) até {fimProjLabel}. Margem projetada = margem realizada.
          </p>
        </div>
      )}
    </div>
  )
}

export default BenchmarkSetor
