import { Fragment, useMemo, useState } from 'react'
import { Users, Droplets, Activity, CircleDollarSign, ChevronDown, ChevronUp, ChevronRight, LineChart, Trophy, TrendingDown, Fuel, ShoppingBag, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLiters, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { Skeleton } from '@/components/ui/skeleton'
import BarCell from '@/components/tables/BarCell'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { PostoOption } from '@/components/filters/PostoLocalSelect'
import useProdutividadeRede from '@/pages/Produtividade/hooks/useProdutividadeRede'

type SortKey = 'nome' | 'frentistas' | 'litros' | 'lpf' | 'abastecimentos' | 'faturamento'
type DetailTab = 'frentistas' | 'vendedores' | 'metas'

interface VgRow {
  codigo: number
  nome: string
  frentistas: number
  litros: number
  lpf: number
  abastecimentos: number
  faturamento: number
}

interface Props {
  postos: PostoOption[]
  onOpenPosto: (codigo: number, tab: DetailTab) => void
}

/**
 * Visão Geral da Produtividade — rede inteira no estilo Central: cards de rede +
 * tabela por posto RANQUEADA por litros/frentista (heatmap, "Destaque"/"Menor"),
 * linha expansível com o ranking de frentistas do posto (drill) e menu Analisar
 * que leva ao detalhe (Frentistas/Vendedores/Metas). Só leitura; sem apuração no
 * período = "—".
 */
const VisaoGeralProdutividade = ({ postos, onOpenPosto }: Props) => {
  const { byPosto, frentistasByPosto, isLoading, hasCache } = useProdutividadeRede(postos)

  const rows: VgRow[] = useMemo(() => postos.map((p) => {
    const d = byPosto.get(p.codigo)
    return {
      codigo: p.codigo,
      nome: p.fantasia,
      frentistas: d?.frentistas ?? 0,
      litros: d?.litros ?? 0,
      lpf: d?.litrosPorFrentista ?? 0,
      abastecimentos: d?.abastecimentos ?? 0,
      faturamento: d?.faturamento ?? 0,
    }
  }), [postos, byPosto])

  const totais = useMemo(() => {
    const litros = rows.reduce((s, r) => s + r.litros, 0)
    const frentistas = rows.reduce((s, r) => s + r.frentistas, 0)
    return {
      litros,
      frentistas,
      abastecimentos: rows.reduce((s, r) => s + r.abastecimentos, 0),
      faturamento: rows.reduce((s, r) => s + r.faturamento, 0),
      lpf: frentistas > 0 ? litros / frentistas : 0,
    }
  }, [rows])

  const maxLpf = useMemo(() => Math.max(1, ...rows.map((r) => r.lpf)), [rows])
  const comFrentista = useMemo(() => rows.filter((r) => r.frentistas > 0), [rows])
  const topLpf = useMemo(() => comFrentista.reduce((mx, r) => Math.max(mx, r.lpf), 0), [comFrentista])
  const bottomLpf = useMemo(() => (comFrentista.length > 1 ? comFrentista.reduce((mn, r) => Math.min(mn, r.lpf), Infinity) : -1), [comFrentista])

  const [sortKey, setSortKey] = useState<SortKey>('lpf')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(k); setSortDir(k === 'nome' ? 'asc' : 'desc') }
  }
  const rowsSorted = useMemo(() => {
    const arr = [...rows]
    const dir = sortDir === 'desc' ? -1 : 1
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'nome': return dir * a.nome.localeCompare(b.nome)
        case 'frentistas': return dir * (a.frentistas - b.frentistas)
        case 'litros': return dir * (a.litros - b.litros)
        case 'abastecimentos': return dir * (a.abastecimentos - b.abastecimentos)
        case 'faturamento': return dir * (a.faturamento - b.faturamento)
        default: return dir * (a.lpf - b.lpf)
      }
    })
    return arr
  }, [rows, sortKey, sortDir])

  const [aberto, setAberto] = useState<Set<number>>(new Set())
  const toggleAberto = (cod: number) => setAberto((prev) => {
    const next = new Set(prev)
    if (next.has(cod)) next.delete(cod)
    else next.add(cod)
    return next
  })

  const loading = isLoading && rows.every((r) => r.litros === 0)
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const COLS = 7

  return (
    <div className="space-y-4">
      {/* Cards de rede — resposta primeiro */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RedeCard label="Frentistas ativos" hint="Frentistas distintos que fizeram pelo menos um abastecimento no período (não usa a flag 'ativo' do cadastro, que a API ignora)."
          value={hasCache ? formatNumber(totais.frentistas) : '—'} Icon={Users}
          tint="from-indigo-50/60 to-white dark:from-indigo-950/20 dark:to-gray-900" iconCls="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" />
        <RedeCard label="Litros vendidos" hint="Litros abastecidos na pista de toda a rede no período (base de apuração)."
          value={hasCache ? formatLiters(totais.litros) : '—'} Icon={Droplets}
          tint="from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900" iconCls="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <RedeCard label="Litros / frentista" hint="Litros ÷ frentistas ativos da rede — quanto cada frentista movimenta, em média. É a medida de produtividade da pista."
          value={hasCache ? formatLiters(totais.lpf) : '—'} Icon={Activity}
          tint="from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900" iconCls="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <RedeCard label="Faturamento pista" hint="Venda de combustível na pista da rede no período."
          value={hasCache ? formatCurrencyInt(totais.faturamento) : '—'} Icon={CircleDollarSign}
          tint="from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900" iconCls="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
      </div>

      {!hasCache && (
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
          <TrendingDown className="h-3.5 w-3.5 shrink-0" />
          Sem produtividade de combustível por frentista apurada neste período — rode a apuração pra ver litros, frentistas e produtividade por posto.
        </p>
      )}

      {/* Tabela por posto — estilo Central (heatmap + drill) */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Produtividade por posto</h3>
          <InfoHint text="Cada linha = um posto, ranqueado por litros/frentista (produtividade da pista). Clique na linha pra ver o ranking de frentistas; use Analisar pra ir ao detalhe do posto." />
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr>
              <th className="py-1.5" />
              <GroupTh first label="Produtividade da pista" colSpan={4} />
              <GroupTh label="Financeiro" colSpan={1} />
              <th className="py-1.5" />
            </tr>
            <tr className="border-b border-gray-200 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:text-gray-500">
              <SortTh label="Posto" k="nome" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="py-2 pl-4 pr-3" />
              <SortTh label="Frentistas" k="frentistas" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="border-l border-gray-200 py-2 px-3 dark:border-gray-700" />
              <SortTh label="Litros" k="litros" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="py-2 px-3" />
              <SortTh label="Litros/frentista" k="lpf" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="py-2 px-3" />
              <SortTh label="Abastec." k="abastecimentos" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="py-2 px-3" />
              <SortTh label="Faturamento" k="faturamento" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="border-l border-gray-200 py-2 px-3 dark:border-gray-700" />
              <th className="py-2 pl-3 pr-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rowsSorted.map((r) => {
              const isOpen = aberto.has(r.codigo)
              const frentistas = frentistasByPosto.get(r.codigo) ?? []
              const semDado = r.frentistas === 0
              return (
                <Fragment key={r.codigo}>
                  <tr onClick={() => toggleAberto(r.codigo)}
                    className="group cursor-pointer border-b border-gray-100 transition-colors hover:bg-blue-50/40 dark:border-gray-800 dark:hover:bg-blue-950/20">
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex items-center gap-2">
                        <ChevronRight className={cn('h-4 w-4 shrink-0 text-gray-300 transition-transform dark:text-gray-600', isOpen && 'rotate-90 text-[#2563eb] dark:text-blue-400')} />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{r.nome}</span>
                        {!semDado && r.lpf === topLpf && r.lpf > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <Trophy className="h-3 w-3" />Destaque
                          </span>
                        )}
                        {!semDado && r.lpf === bottomLpf && bottomLpf >= 0 && r.lpf !== topLpf && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">
                            <TrendingDown className="h-3 w-3" />Menor
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border-l border-gray-100 px-3 py-2.5 text-right tabular-nums text-gray-700 dark:border-gray-800 dark:text-gray-200">{semDado ? '—' : formatNumber(r.frentistas)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{semDado ? '—' : formatLiters(r.litros)}</td>
                    <td className="px-2 py-1.5">
                      {semDado
                        ? <span className="block px-1.5 text-right text-gray-400">—</span>
                        : <BarCell value={r.lpf} max={maxLpf} formatted={formatLiters(r.lpf)} color="green" align="near" maxWidthPct={70} />}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{semDado ? '—' : formatNumber(r.abastecimentos)}</td>
                    <td className="border-l border-gray-100 px-3 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:border-gray-800 dark:text-gray-100">{semDado ? '—' : formatCurrencyInt(r.faturamento)}</td>
                    <td className="py-2.5 pl-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:border-[#2563eb] hover:text-[#2563eb] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-300">
                            <LineChart className="h-3.5 w-3.5" />Analisar<ChevronDown className="h-3 w-3 opacity-70" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2 text-[13px]" onSelect={() => onOpenPosto(r.codigo, 'frentistas')}>
                            <Fuel className="h-3.5 w-3.5 text-gray-500" />Frentistas
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-[13px]" onSelect={() => onOpenPosto(r.codigo, 'vendedores')}>
                            <ShoppingBag className="h-3.5 w-3.5 text-gray-500" />Vendedores
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-[13px]" onSelect={() => onOpenPosto(r.codigo, 'metas')}>
                            <Target className="h-3.5 w-3.5 text-gray-500" />Metas
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-gray-50/50 dark:bg-gray-800/20">
                      <td colSpan={COLS} className="px-4 py-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            <Users className="h-3.5 w-3.5" />Ranking de frentistas · {r.nome}
                          </p>
                          <button type="button" onClick={() => onOpenPosto(r.codigo, 'frentistas')}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#2563eb] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2563eb] transition-colors hover:bg-blue-50 dark:border-blue-500 dark:bg-transparent dark:text-blue-300 dark:hover:bg-blue-950/30">
                            <LineChart className="h-3.5 w-3.5" />Analisar em Frentistas
                          </button>
                        </div>
                        {frentistas.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-[12px] text-gray-400 dark:border-gray-700">Sem abastecimentos de frentista neste posto no período.</p>
                        ) : (
                          <FrentistaRanking rows={frentistas} />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr className="border-t border-gray-200 text-[13px] font-semibold dark:border-gray-700">
                <td className="py-2.5 pl-4 pr-3 text-gray-500 dark:text-gray-400">Rede · {rows.length} postos</td>
                <td className="border-l border-gray-100 px-3 py-2.5 text-right tabular-nums text-gray-900 dark:border-gray-800 dark:text-gray-100">{hasCache ? formatNumber(totais.frentistas) : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{hasCache ? formatLiters(totais.litros) : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{hasCache ? formatLiters(totais.lpf) : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{hasCache ? formatNumber(totais.abastecimentos) : '—'}</td>
                <td className="border-l border-gray-100 px-3 py-2.5 text-right tabular-nums text-gray-900 dark:border-gray-800 dark:text-gray-100">{hasCache ? formatCurrencyInt(totais.faturamento) : '—'}</td>
                <td className="py-2.5" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

/** Ranking de frentistas de um posto (drill) — litros, abast. e litros/abast. */
const FrentistaRanking = ({ rows }: { rows: { codigo: number; nome: string; litros: number; abastecimentos: number }[] }) => {
  const maxLitros = Math.max(1, ...rows.map((r) => r.litros))
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-transparent dark:text-gray-400">
          <tr>
            <th className="px-3 py-2 text-left font-medium">#</th>
            <th className="px-3 py-2 text-left font-medium">Frentista</th>
            <th className="px-3 py-2 text-right font-medium">Litros</th>
            <th className="px-3 py-2 text-right font-medium">Abastec.</th>
            <th className="px-3 py-2 text-right font-medium">Litros/abast.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((r, i) => (
            <tr key={r.codigo} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
              <td className="px-3 py-2 tabular-nums text-gray-400">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{r.nome}</td>
              <td className="px-2 py-1.5">
                <BarCell value={r.litros} max={maxLitros} formatted={formatLiters(r.litros)} color="green" align="near" maxWidthPct={60} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(r.abastecimentos)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{r.abastecimentos > 0 ? formatLiters(r.litros / r.abastecimentos) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th colSpan={colSpan} className={cn('bg-gray-100/60 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-transparent dark:text-gray-500', !first && 'border-l border-gray-200 dark:border-gray-700')}>
    {label}
  </th>
)

const RedeCard = ({ label, value, hint, Icon, tint, iconCls }: {
  label: string; value: string; hint: string; Icon: typeof Users; tint: string; iconCls: string
}) => (
  <div className={cn('rounded-xl border border-gray-200 bg-gradient-to-br p-4 shadow-sm dark:border-gray-700', tint)}>
    <div className="flex items-center justify-between">
      <p className="flex items-center gap-1 text-[12px] font-medium text-gray-600 dark:text-gray-400">{label}<InfoHint text={hint} /></p>
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconCls)}><Icon className="h-4 w-4" /></div>
    </div>
    <p className="mt-2 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
  </div>
)

const SortTh = ({ label, k, sortKey, sortDir, onSort, align, className }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc'; onSort: (k: SortKey) => void; align?: 'right'; className?: string
}) => {
  const active = sortKey === k
  return (
    <th className={cn(className, align === 'right' && 'text-right')}>
      <button type="button" onClick={() => onSort(k)}
        className={cn('inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-gray-600 dark:hover:text-gray-300',
          align === 'right' && 'flex-row-reverse', active ? 'text-[#2563eb] dark:text-blue-300' : '')}>
        {label}
        {active && (sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
      </button>
    </th>
  )
}

export default VisaoGeralProdutividade
