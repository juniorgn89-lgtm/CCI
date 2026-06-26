import { useMemo, useState } from 'react'
import {
  Percent, Trophy, TrendingDown, ArrowUpRight, ChevronDown, Fuel,
  ShieldCheck, AlertTriangle, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatLitersShort } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { Skeleton } from '@/components/ui/skeleton'
import useComercialData, { type ComercialPostoRow } from '@/pages/Comercial/hooks/useComercialData'

type SortKey = 'margemL' | 'lucroBruto' | 'litros'

const fmtDM = (iso: string | null): string => {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** R$/L com 2 casas + sufixo. */
const margemL = (v: number) => `${formatCurrency(v)}/L`

/** Selo de frescor do custo de reposição. Verde discreto quando fresco; escala
 *  pra âmbar/vermelho conforme envelhece (mecanismo armado, dormente com dado
 *  fresco). É o que sustenta "a margem é fato" — custo velho = margem errada na
 *  virada de preço. */
const frescorTone = (staleDays: number | null) => {
  if (staleDays == null) return { cls: 'text-gray-400', Icon: AlertTriangle, label: 'sem custo' }
  if (staleDays <= 2) return { cls: 'text-emerald-600 dark:text-emerald-400', Icon: ShieldCheck, label: `custo ${''}` }
  if (staleDays <= 7) return { cls: 'text-amber-600 dark:text-amber-400', Icon: AlertTriangle, label: 'custo' }
  return { cls: 'text-red-600 dark:text-red-400', Icon: AlertTriangle, label: 'custo defasado' }
}

const KpiCard = ({
  label, sub, value, foot, tone = 'plain', Icon, help,
}: {
  label: string; sub?: string; value: React.ReactNode; foot?: React.ReactNode
  tone?: 'plain' | 'navy' | 'green' | 'red' | 'amber'; Icon: typeof Percent; help?: string
}) => {
  const navy = tone === 'navy'
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 shadow-sm',
        navy
          ? 'border-transparent bg-gradient-to-br from-[#1e3a5f] to-[#27496f] text-white'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className={cn('text-[11px] font-semibold uppercase tracking-wide', navy ? 'text-white/70' : 'text-gray-400')}>{label}</p>
            {help && <InfoHint className={navy ? 'text-white/60 hover:text-white' : undefined} text={help} />}
          </div>
          {sub && <p className={cn('text-[10px]', navy ? 'text-white/50' : 'text-gray-400')}>{sub}</p>}
        </div>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', navy ? 'bg-white/10' : 'bg-gray-100 dark:bg-gray-800')}>
          <Icon className={cn('h-4 w-4', navy ? 'text-white' : 'text-gray-500 dark:text-gray-400')} />
        </span>
      </div>
      <p className={cn(
        'mt-2 text-2xl font-bold tabular-nums',
        navy ? 'text-white' : tone === 'green' ? 'text-emerald-600 dark:text-emerald-400'
          : tone === 'red' ? 'text-red-600 dark:text-red-400'
          : tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
          : 'text-gray-900 dark:text-gray-100',
      )}>
        {value}
      </p>
      {foot && <div className={cn('mt-1 text-[11px]', navy ? 'text-white/60' : 'text-gray-500 dark:text-gray-400')}>{foot}</div>}
    </div>
  )
}

const FuelDrill = ({ posto, redeMargemL }: { posto: ComercialPostoRow; redeMargemL: number }) => (
  <div className="bg-gray-50 px-4 py-3 dark:bg-[#161616]">
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {posto.produtos.map((f) => {
        const vs = redeMargemL > 0 ? ((f.margemL - redeMargemL) / redeMargemL) * 100 : 0
        return (
          <div key={f.produtoCodigo} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 dark:bg-gray-900">
            <Fuel className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-800 dark:text-gray-200">{f.nome}</span>
            {!f.comCusto && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500 dark:bg-gray-800">sem custo</span>}
            <span className="text-[11px] tabular-nums text-gray-400">{formatLitersShort(f.litros)}</span>
            <span className={cn('w-16 text-right text-[12px] font-bold tabular-nums',
              f.margemL >= redeMargemL ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100')}>
              {f.comCusto ? margemL(f.margemL) : '—'}
            </span>
            <span className={cn('w-12 text-right text-[10px] tabular-nums', vs >= 0 ? 'text-emerald-500' : 'text-red-500')}>
              {f.comCusto ? `${vs >= 0 ? '+' : ''}${vs.toFixed(0)}%` : ''}
            </span>
          </div>
        )
      })}
    </div>
  </div>
)

const MargemPosto = () => {
  const data = useComercialData()
  const [sort, setSort] = useState<SortKey>('margemL')
  const [open, setOpen] = useState<number | null>(null)

  const rows = useMemo(() => {
    const arr = [...data.postos]
    arr.sort((a, b) => b[sort] - a[sort])
    return arr
  }, [data.postos, sort])

  // Leitura do especialista — determinística, ancorada no dado (sem inventar).
  const leitura = useMemo(() => {
    const { best, worst, redeMargemL } = data
    if (!best || !worst || redeMargemL <= 0) return null
    const dispersaoPct = best.margemL > 0 ? ((best.margemL - worst.margemL) / best.margemL) * 100 : 0
    const piorFuel = [...worst.produtos].filter((f) => f.comCusto).sort((a, b) => a.margemL - b.margemL)[0]
    const acontecendo: string[] = [
      `Margem da rede a ${margemL(redeMargemL)}, mas dispersa: de ${margemL(worst.margemL)} (${worst.posto}) a ${margemL(best.margemL)} (${best.posto}) — variação de ${dispersaoPct.toFixed(0)}%, sinal de precificação por feeling.`,
    ]
    if (worst.vsRedePct < -10) {
      acontecendo.push(
        `${worst.posto} está ${Math.abs(worst.vsRedePct).toFixed(0)}% abaixo da rede${piorFuel ? `, puxado pelo ${piorFuel.nome} (${margemL(piorFuel.margemL)})` : ''}.`,
      )
    }
    const fazer: string[] = [
      `Priorizar os 3 piores postos: alinhá-los à média da rede vale uma estimativa de ${formatCurrencyInt(data.ganhoPotencial3Piores)} no período — sem vender 1 litro a mais.`,
      'Atacar o custo onde a margem é baixa (renegociar bonificação) antes do preço — evita perder volume/frota.',
      'Definir uma régua de preço por praça (aba Concorrência) pra fechar a dispersão.',
    ]
    return { acontecendo, fazer }
  }, [data])

  if (data.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }
  if (!data.hasRede || data.postos.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
        Sem dados de combustível no período selecionado.
      </div>
    )
  }

  const stale = data.custoStaleDaysMax
  const frescorOk = stale != null && stale <= 2
  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => setSort(k)}
      className={cn(
        'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
        sort === k ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
      )}
    >
      {children}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          tone="navy" Icon={Percent}
          label="Margem média da rede" sub={`ponderada por volume · ${data.postos.length} unidades`}
          value={margemL(data.redeMargemL)}
          foot={<>LB total {formatCurrencyInt(data.redeLucroBruto)} · {formatLitersShort(data.redeLitros)}</>}
          help="Margem média da rede em R$/L, ponderada pelo volume de cada posto (lucro bruto total ÷ litros totais). Usa o custo de reposição da última carga (LMC)."
        />
        <KpiCard
          Icon={Trophy} label="Maior margem" sub="melhor posto" tone="green"
          value={data.best ? margemL(data.best.margemL) : '—'}
          foot={data.best?.posto}
          help="Posto com a maior margem por litro no período."
        />
        <KpiCard
          Icon={TrendingDown} label="Menor margem" sub="requer atenção" tone="red"
          value={data.worst ? margemL(data.worst.margemL) : '—'}
          foot={data.worst ? `${data.worst.posto} · ${data.worst.vsRedePct.toFixed(0)}% vs rede` : ''}
          help="Posto com a menor margem por litro — o que mais puxa a média da rede pra baixo."
        />
        <KpiCard
          Icon={ArrowUpRight} label="Ganho potencial" sub="estimativa · teto" tone="amber"
          value={`+${formatCurrencyInt(data.ganhoPotencial3Piores)}`}
          foot="no período · 3 piores → média (volume constante)"
          help="Estimativa (teto) do lucro adicional no período se os 3 piores postos subissem até a média da rede, com volume constante. Não pressupõe vender mais litros."
        />
      </div>

      {/* Selo de frescor do custo (verde/discreto quando fresco; escala se velho) */}
      <div className={cn(
        'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[12px]',
        frescorOk
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
      )}>
        {frescorOk ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
        <span className="font-medium">
          {frescorOk
            ? `Custo de reposição atualizado — última carga ${fmtDM(data.custoDateMaisAntiga)} (${stale}d). A margem é fato sólido.`
            : `Custo de reposição defasado em algum posto — carga mais antiga ${fmtDM(data.custoDateMaisAntiga)} (${stale}d). A margem pode errar na virada de preço.`}
        </span>
        <InfoHint
          className="ml-auto"
          text="A margem usa o custo de reposição da última carga (LMC). Quando esse custo envelhece além do último reajuste, a margem exibida fica imprecisa. O selo escala de verde → âmbar → vermelho conforme a defasagem."
        />
      </div>

      {/* Leitura do especialista (determinística) */}
      {leitura && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/30 dark:bg-indigo-950/10">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#4f46e5] text-white">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Leitura do especialista</h3>
            <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-gray-900 dark:text-indigo-300">IA · read-only</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">O que está acontecendo</p>
              <ul className="space-y-1.5">
                {leitura.acontecendo.map((t, i) => (
                  <li key={i} className="text-[12.5px] leading-snug text-gray-700 dark:text-gray-300">• {t}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">O que fazer</p>
              <ol className="space-y-1.5">
                {leitura.fazer.map((t, i) => (
                  <li key={i} className="text-[12.5px] leading-snug text-gray-700 dark:text-gray-300">{i + 1}. {t}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Ranking */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Ranking de margem por posto</h3>
              <InfoHint text="Postos ordenados por margem/L (ou lucro bruto/volume, conforme o botão). Colunas: volume vendido, lucro bruto, margem/L e variação vs a média da rede. Clique numa unidade pra abrir o detalhe por combustível." />
            </div>
            <p className="text-[11px] text-gray-400">Clique numa unidade pra abrir o drill por combustível</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-gray-50 p-0.5 dark:bg-gray-800">
            <SortBtn k="margemL">Margem/L</SortBtn>
            <SortBtn k="lucroBruto">Lucro bruto</SortBtn>
            <SortBtn k="litros">Volume</SortBtn>
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((p, i) => {
            const fr = frescorTone(p.custoStaleDays)
            const isOpen = open === p.empresaCodigo
            return (
              <div key={p.empresaCodigo}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : p.empresaCodigo)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <span className="w-5 text-center text-[12px] font-bold text-gray-400">{i + 1}</span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-300 transition-transform', isOpen && 'rotate-180')} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-800 dark:text-gray-200">{p.posto}</span>

                  {/* selo de frescor por posto */}
                  <span className={cn('hidden items-center gap-1 text-[10px] font-medium sm:inline-flex', fr.cls)}>
                    <fr.Icon className="h-3 w-3" />
                    {p.custoStaleDays != null ? fmtDM(p.custoDate) : 'sem custo'}
                  </span>
                  {p.coberturaCustoPct < 99.5 && (
                    <span className="hidden rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 md:inline">
                      custo {p.coberturaCustoPct.toFixed(0)}%
                    </span>
                  )}

                  <span className="hidden w-24 text-right text-[12px] tabular-nums text-gray-500 dark:text-gray-400 md:inline">{formatLitersShort(p.litros)}</span>
                  <span className="hidden w-24 text-right text-[12px] tabular-nums text-gray-500 dark:text-gray-400 lg:inline">{formatCurrencyInt(p.lucroBruto)}</span>

                  <span className={cn('w-20 text-right text-[13px] font-bold tabular-nums',
                    p.margemL >= data.redeMargemL ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100')}>
                    {margemL(p.margemL)}
                  </span>
                  <span className={cn('w-14 text-right text-[11px] font-semibold tabular-nums',
                    p.vsRedePct >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                    {p.vsRedePct >= 0 ? '+' : ''}{p.vsRedePct.toFixed(0)}%
                  </span>
                </button>
                {isOpen && <FuelDrill posto={p} redeMargemL={data.redeMargemL} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default MargemPosto
