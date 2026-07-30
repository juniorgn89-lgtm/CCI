import { useMemo, useState } from 'react'
import { Search, Wrench, Droplet, Fuel, Gauge, Receipt, TrendingUp, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import BarCell from '@/components/tables/BarCell'
import InfoHint from '@/components/ui/InfoHint'
import type { FrentistaProdData, FuncProdRow } from '@/pages/Produtividade/hooks/useFrentistaProdutividade'
import useAutomotivos12m, { type MesValor } from '@/pages/Produtividade/hooks/useAutomotivos12m'
import useGruposFuncionario, { type GrupoVenda, type EvolucaoFunc, type DiaEvol } from '@/pages/Produtividade/hooks/useGruposFuncionario'
import AnaliseSemanalLineCard from '@/pages/Comercial/Vendas/AnaliseSemanalLineCard'

interface Props {
  data: FrentistaProdData
  /** Posto selecionado — pro histórico de 12 meses (cache por posto). */
  postoCodigo?: number | null
  /** Funcionário selecionado (controlado pelo index — clique no Dash abre aqui). */
  selId: number | null
  onSelect: (codigo: number) => void
}

/* ── Gráfico de barras de série (evolução) com destaque de melhor/pior ── */
interface SeriePonto { label: string; valor: number }
interface BarPalette { base: string; best: string; bestText: string }
const WORST_BAR = 'bg-amber-400 dark:bg-amber-500'
const WORST_TEXT = 'text-amber-600 dark:text-amber-400'

const MiniBars = ({ title, Icon, hint, data, format, palette, xMode, emptyText, loading }: {
  title: string
  Icon: typeof Wrench
  hint?: string
  data?: SeriePonto[]
  format: (v: number) => string
  palette: BarPalette
  /** 'each' = rótulo sob cada barra (meses); 'ends' = só os extremos (dias). */
  xMode: 'each' | 'ends'
  emptyText: string
  loading?: boolean
}) => {
  const pts = data ?? []
  const max = Math.max(1, ...pts.map((p) => p.valor))
  const total = pts.reduce((s, p) => s + p.valor, 0)
  const vazio = pts.length === 0 || pts.every((p) => p.valor === 0)

  // Melhor = maior valor; pior = menor valor > 0 (dias/meses sem venda não contam).
  let bestI = -1, worstI = -1, bestV = -Infinity, worstV = Infinity
  pts.forEach((p, i) => {
    if (p.valor > bestV) { bestV = p.valor; bestI = i }
    if (p.valor > 0 && p.valor < worstV) { worstV = p.valor; worstI = i }
  })
  const showWorst = worstI !== -1 && worstI !== bestI

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="mb-3 flex items-center gap-1.5">
        <Icon className="h-4 w-4 text-gray-400" />
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        {hint && <InfoHint text={hint} />}
        {!loading && !vazio && <span className="ml-auto text-[11px] font-medium tabular-nums text-gray-400">{format(total)}</span>}
      </div>
      {loading ? (
        <div className="min-h-[7rem] flex-1 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      ) : vazio ? (
        <div className="flex flex-1 items-center justify-center py-10">
          <p className="text-center text-[12px] text-gray-400">{emptyText}</p>
        </div>
      ) : (
        <>
          {/* Área das barras — flex-1 (preenche a altura do card) com uma camada
              absoluta interna pra o % das barras resolver contra altura definida. */}
          <div className="relative min-h-[7rem] flex-1">
            <div className="absolute inset-0 flex items-end gap-1 pt-3">
              {pts.map((p, i) => {
                const h = (p.valor / max) * 82
                const isBest = i === bestI && p.valor > 0
                const isWorst = showWorst && i === worstI
                return (
                  <div key={i} className="relative flex h-full min-w-0 flex-1 items-end" title={`${p.label}: ${format(p.valor)}`}>
                    {(isBest || isWorst) && (
                      <span
                        className={cn('pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[8.5px] font-bold leading-none tabular-nums', isBest ? palette.bestText : WORST_TEXT)}
                        style={{ bottom: `calc(${h}% + 3px)` }}
                      >
                        {format(p.valor)}
                      </span>
                    )}
                    <div className={cn('w-full rounded-t transition-all', isBest ? palette.best : isWorst ? WORST_BAR : palette.base)} style={{ height: `${Math.max(2, h)}%` }} />
                  </div>
                )
              })}
            </div>
          </div>
          {xMode === 'each' ? (
            <div className="mt-1 flex gap-1">
              {pts.map((p, i) => (
                <span key={i} className={cn('flex-1 truncate text-center text-[9px]', i === bestI ? 'font-semibold text-gray-500 dark:text-gray-300' : 'text-gray-400')}>{p.label}</span>
              ))}
            </div>
          ) : (
            <div className="mt-1.5 flex justify-between text-[9px] tabular-nums text-gray-400">
              <span>{pts[0]?.label}</span>
              <span>{pts[pts.length - 1]?.label}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const fmtR = (v: number) => formatCurrency(v)
const fmtRi = (v: number) => formatCurrencyInt(v)
const fmtL = (v: number) => formatLiters(v)
const fmtN = (v: number) => formatNumber(v)

const PAL_AUTO: BarPalette = { base: 'bg-emerald-200 dark:bg-emerald-500/30', best: 'bg-emerald-500', bestText: 'text-emerald-600 dark:text-emerald-300' }

/* Grupos de produto automotivo vendidos (barras horizontais, ao vivo). */
const GruposPanel = ({ grupos, loading }: { grupos?: GrupoVenda[]; loading?: boolean }) => {
  const top = (grupos ?? []).slice(0, 8)
  const max = Math.max(1, ...top.map((g) => g.faturamento))
  const total = (grupos ?? []).reduce((s, g) => s + g.faturamento, 0)
  const vazio = top.length === 0
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="mb-3 flex items-center gap-1.5">
        <Package className="h-4 w-4 text-gray-400" />
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Grupos de produto vendidos</h3>
        <InfoHint text="Faturamento de produtos automotivos de loja (setor Pista) do funcionário no período, quebrado por grupo de produto. Ao vivo do /VENDA_ITEM, só vendas autorizadas — o total bate com o card Automotivos." />
        {!loading && !vazio && <span className="ml-auto text-[11px] font-medium tabular-nums text-gray-400">{fmtRi(total)}</span>}
      </div>
      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-7 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />)}
        </div>
      ) : vazio ? (
        <p className="py-8 text-center text-[12px] text-gray-400">Sem produtos automotivos no período.</p>
      ) : (
        <div className="space-y-2">
          {top.map((g, i) => {
            const best = i === 0
            const nome = g.grupo.replace(/^PS\s*-\s*/i, '')
            return (
              <div key={g.grupo} className="flex items-center gap-3">
                <span className={cn('w-48 shrink-0 truncate text-[12px]', best ? 'font-bold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-600 dark:text-gray-300')} title={nome}>{nome}</span>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-gray-100/80 dark:bg-gray-800/60">
                  <div
                    className={cn('h-full rounded-md bg-gradient-to-r transition-all', best ? 'from-emerald-400 to-emerald-500 dark:from-emerald-500 dark:to-emerald-400' : 'from-emerald-300 to-emerald-400 dark:from-emerald-700/60 dark:to-emerald-500/50')}
                    style={{ width: `${Math.max(3, (g.faturamento / max) * 100)}%` }}
                  />
                </div>
                <span className={cn('w-24 shrink-0 text-right text-[12.5px] font-bold tabular-nums', best ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300')}>{fmtRi(g.faturamento)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* Um KPI do detalhe (valor + tendência opcional). */
const Stat = ({ label, value, tend, Icon, tint }: { label: string; value: string; tend?: string; Icon: typeof Wrench; tint: string }) => (
  <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-white/[0.02]">
    <div className="flex items-center gap-1.5">
      <Icon className={cn('h-3.5 w-3.5', tint)} />
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
    </div>
    <p className="mt-1 text-[17px] font-bold leading-none tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    {tend && (
      <p className="mt-1 inline-flex items-center gap-0.5 text-[10.5px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
        <TrendingUp className="h-3 w-3" />{tend}
      </p>
    )}
  </div>
)

/* Evolução diária premium — reaproveita o card da rede (AnaliseSemanalLineCard),
 * com guarda pra séries curtas (o funcionário pode ter só 1 dia com movimento). */
const EvolucaoCard = ({ title, serie, plotFaturamento, unit, noun, accent, chartType, loading }: {
  title: string; serie?: DiaEvol[]; plotFaturamento?: boolean; unit: string; noun: string; accent?: string; chartType?: 'line' | 'bar'; loading?: boolean
}) => {
  if (loading) return <div className="h-[318px] animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]" />
  if (!serie || serie.length < 2) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        <p className="py-12 text-center text-[12px] text-gray-400">Poucos dias com movimento pra traçar a evolução.</p>
      </div>
    )
  }
  return (
    <AnaliseSemanalLineCard
      data={serie}
      title={title}
      noun={noun}
      unit={unit}
      plotFaturamento={plotFaturamento}
      accent={accent}
      chartType={chartType}
      scope=""
      height={250}
      cardBg="bg-white dark:bg-white/[0.02]"
    />
  )
}

const DetailPanel = ({ row, serie12m, loading12m, grupos, evolucao, loadingGrupos }: {
  row: FuncProdRow; serie12m?: MesValor[]; loading12m?: boolean; grupos?: GrupoVenda[]; evolucao?: EvolucaoFunc; loadingGrupos?: boolean
}) => {
  const maxComb = Math.max(1, ...row.combustiveis.map((c) => c.litros))
  return (
    <div className="min-w-0 flex-1 space-y-4">
      <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{row.nome}</h2>

      {/* KPIs do funcionário */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Automotivos" value={fmtR(row.automotivo)} tend={fmtR(row.automotivoTend)} Icon={Wrench} tint="text-emerald-500" />
        <Stat label="Litros aditivada" value={fmtL(row.aditivadaLitros)} tend={fmtL(row.aditivadaTend)} Icon={Droplet} tint="text-violet-500" />
        <Stat label="Mix aditivada" value={`${row.mixPct.toFixed(1).replace('.', ',')}%`} Icon={Gauge} tint="text-blue-500" />
        <Stat label="Abastecimentos" value={fmtN(row.abastecimentos)} tend={fmtN(row.abastTend)} Icon={Fuel} tint="text-amber-500" />
        <Stat label="Ticket automotivos" value={fmtR(row.ticket)} Icon={Receipt} tint="text-gray-400" />
      </div>

      {/* Quebra por combustível (no período) */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.02]">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
          <Fuel className="h-4 w-4 text-gray-400" />
          <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Combustíveis vendidos</h3>
          <InfoHint text="Quebra dos abastecimentos do funcionário por combustível no período: litros, nº de abastecimentos e faturamento." />
          <span className="ml-auto text-[11px] text-gray-400">{row.combustiveis.length} {row.combustiveis.length === 1 ? 'produto' : 'produtos'}</span>
        </div>
        {row.combustiveis.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-gray-400">Sem abastecimentos no período.</p>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="border-b border-gray-100 dark:border-gray-800">
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                <th className="px-4 py-1.5 text-left">Combustível</th>
                <th className="px-2 py-1.5 text-right">Litros</th>
                <th className="px-2 py-1.5 text-right">Abast.</th>
                <th className="px-4 py-1.5 text-right">Faturamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {row.combustiveis.map((c) => (
                <tr key={c.produtoCodigo} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-1.5 font-medium text-gray-800 dark:text-gray-200">{c.nome}</td>
                  <td className="px-2 py-1.5"><BarCell value={c.litros} max={maxComb} formatted={fmtL(c.litros)} color="violet" align="near" /></td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{fmtN(c.abastecimentos)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtRi(c.faturamento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Grupos de produto (ao vivo, 2/3) + histórico de 12 meses (cache, 1/3). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GruposPanel grupos={grupos} loading={loadingGrupos} />
        </div>
        <MiniBars title="Automotivos · 12 meses" Icon={TrendingUp} data={serie12m} format={fmtRi} palette={PAL_AUTO} xMode="each" emptyText="Sem histórico apurado." loading={loading12m} />
      </div>

      {/* Evolução diária no período (ao vivo, do /VENDA_ITEM) — card premium.
          Só dias COM movimento: a linha é dos turnos do funcionário, não do mês. */}
      <EvolucaoCard title="Litros por dia" serie={evolucao?.litros} unit="litros" noun="volume" accent="#2563eb" loading={loadingGrupos} />
      <EvolucaoCard title="Aditivada por dia" serie={evolucao?.aditivada} unit="litros" noun="volume" accent="#7c3aed" chartType="bar" loading={loadingGrupos} />
      <EvolucaoCard title="Automotivos por dia" serie={evolucao?.automotivos} unit="itens" noun="faturamento" plotFaturamento accent="#059669" chartType="bar" loading={loadingGrupos} />

      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Mix de aditivada (histórico de 12 meses) chega numa próxima etapa.
      </p>
    </div>
  )
}

const ProdutividadeFuncionarios = ({ data, postoCodigo, selId, onSelect }: Props) => {
  const { rows } = data
  const { byFunc: auto12m, isLoading: loading12m } = useAutomotivos12m(postoCodigo)
  const { byFunc: gruposByFunc, evolucaoByFunc, isLoading: loadingGrupos } = useGruposFuncionario(postoCodigo)
  const [busca, setBusca] = useState('')

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return q ? rows.filter((r) => r.nome.toLowerCase().includes(q)) : rows
  }, [rows, busca])

  const sel = useMemo(
    () => rows.find((r) => r.funcionarioCodigo === selId) ?? filtered[0] ?? rows[0] ?? null,
    [rows, filtered, selId],
  )
  const maxAuto = Math.max(1, ...rows.map((r) => r.automotivo))

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Lateral — lista de funcionários */}
      <div className="w-full shrink-0 space-y-2 lg:w-72">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar funcionário…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-200"
          />
        </div>
        <div className="max-h-[72vh] space-y-1 overflow-auto rounded-2xl border border-gray-200 bg-white p-1.5 dark:border-gray-800 dark:bg-white/[0.02]">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-gray-400">Nenhum funcionário.</p>
          ) : filtered.map((r) => {
            const active = sel?.funcionarioCodigo === r.funcionarioCodigo
            return (
              <button
                key={r.funcionarioCodigo}
                type="button"
                onClick={() => onSelect(r.funcionarioCodigo)}
                className={cn('w-full rounded-xl px-3 py-2 text-left transition-colors',
                  active ? 'bg-blue-50 ring-1 ring-[#2563eb] dark:bg-blue-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40')}
              >
                <p className={cn('truncate text-[12.5px] font-semibold', active ? 'text-[#1e3a5f] dark:text-blue-300' : 'text-gray-800 dark:text-gray-200')}>{r.nome}</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full bg-emerald-400 dark:bg-emerald-500" style={{ width: `${Math.round((r.automotivo / maxAuto) * 100)}%` }} />
                </div>
                <p className="mt-1 text-[10.5px] tabular-nums text-gray-400">{fmtR(r.automotivo)} · {fmtN(r.abastecimentos)} abast.</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detalhe */}
      {sel ? (
        <DetailPanel
          row={sel}
          serie12m={auto12m.get(sel.funcionarioCodigo)}
          loading12m={loading12m}
          grupos={gruposByFunc.get(sel.funcionarioCodigo)}
          evolucao={evolucaoByFunc.get(sel.funcionarioCodigo)}
          loadingGrupos={loadingGrupos}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-center text-[13px] text-gray-400 dark:border-gray-800">
          Nenhum funcionário no período.
        </div>
      )}
    </div>
  )
}

export default ProdutividadeFuncionarios
