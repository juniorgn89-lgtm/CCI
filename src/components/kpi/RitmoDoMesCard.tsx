import { CalendarRange, Gauge, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import ProjecaoModoAviso from '@/components/kpi/ProjecaoModoAviso'
import type { Confiabilidade } from '@/lib/projection'
import type { ProjecaoModo } from '@/lib/projecaoModo'

/**
 * "Ritmo do mês" (navy): o que não cabe em cada card de KPI, uma vez só —
 * quanto do lucro do mês já entrou, dias fechados e restantes, "Fecha em",
 * comparação com o mês INTEIRO anterior e com os mesmos dias, falta por dia,
 * confiança e método. Mesmo desenho do painel da Central, para as abas de
 * Vendas (Combustível, Automotivo, Conveniência). Período fechado → "Fechou em".
 */
interface RitmoDoMesCardProps {
  /** Lucro bruto realizado no período. */
  realizado: number
  /** Lucro bruto projetado para o fim do mês. */
  projetado: number
  diasFechados: number
  diasRestantes: number
  /** yyyy-MM-dd do fim do mês projetado. */
  dataFinal: string
  /** Lucro bruto do mês comparativo INTEIRO. null/0 = sem base. */
  cheioAnterior: number | null
  cheioLabel: string
  /** Lucro bruto do período comparativo com os MESMOS dias (selo dos cards). */
  parcialAnterior?: number
  parcialLabel: string
  confiabilidade: Confiabilidade
  confiabilidadePct: number
  modo?: ProjecaoModo
  contexto?: string
  loading?: boolean
  /** "Ver detalhes" (aba Combustível): abre a quebra por combustível nos KPIs. */
  expanded?: boolean
  onToggleExpanded?: () => void
  className?: string
}

const Pct = ({ v }: { v: number | null }) => v === null
  ? <span className="text-white/50">sem base</span>
  : <span className={cn('font-bold tabular-nums', v >= 0 ? 'text-emerald-300' : 'text-red-300')}>{v >= 0 ? '▲ +' : '▼ '}{v.toFixed(1).replace('.', ',')}%</span>

const RitmoDoMesCard = ({
  realizado, projetado, diasFechados, diasRestantes, dataFinal, cheioAnterior, cheioLabel, parcialAnterior, parcialLabel,
  confiabilidade, confiabilidadePct, modo, contexto, loading, expanded, onToggleExpanded, className,
}: RitmoDoMesCardProps) => {
  const fechado = diasRestantes <= 0
  const entregue = projetado > 0 ? Math.min(100, (realizado / projetado) * 100) : 0
  const falta = Math.max(0, projetado - realizado)
  const porDia = diasRestantes > 0 ? falta / diasRestantes : 0
  const fechaValor = fechado ? realizado : projetado
  const vsCheio = cheioAnterior && cheioAnterior > 0 ? ((fechaValor - cheioAnterior) / cheioAnterior) * 100 : null
  const vsParcial = parcialAnterior && parcialAnterior > 0 ? ((realizado - parcialAnterior) / parcialAnterior) * 100 : null
  const fimMes = dataFinal.split('-').reverse().slice(0, 2).join('/')
  const DOT = { alta: 'bg-emerald-400', media: 'bg-amber-400', baixa: 'bg-red-400' } as const
  const hintCls = 'text-white/50 hover:text-white dark:text-white/50 dark:hover:text-white'

  return (
    <div className={cn('flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#27496f] text-white shadow-lg', className)}>
      <div className="flex items-start justify-between gap-2 px-5 pb-3 pt-[18px]">
        <div className="min-w-0">
          <p className="inline-flex flex-wrap items-center gap-1.5 text-[15px] font-bold">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.14)]', DOT[confiabilidade])} />
            Ritmo do mês
            <InfoHint className={hintCls} text="Projeção de fechamento do lucro bruto pela sazonalidade de dia da semana da rede (ramo linear quando falta histórico). Mesma conta dos cards acima e do painel da Central: os números batem. É estimativa, não valor fechado." />
            {modo && <ProjecaoModoAviso modo={modo} contexto={contexto} tone="navy" />}
          </p>
          <p className="mt-0.5 text-[11px] text-white/60">Como o mês está indo · lucro bruto{contexto ? ` de ${contexto}` : ''}</p>
        </div>
        {onToggleExpanded && (
          <button
            type="button"
            onClick={onToggleExpanded}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-white/15 bg-white/[0.06] px-2.5 text-[11px] font-medium text-white/80 hover:bg-white/10 hover:text-white"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center px-5 pb-6">
          <div className="h-16 w-full animate-pulse rounded-xl bg-white/10" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[28px] font-extrabold tabular-nums leading-none">{fechado ? '100' : Math.round(entregue)}%</span>
              <span className="text-[11px] text-white/70">{fechado ? 'mês fechado' : 'do lucro do mês já entrou'}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#34d399]" style={{ width: `${fechado ? 100 : Math.max(2, entregue)}%` }} />
            </div>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-white/70">
              <CalendarRange className="h-3.5 w-3.5" />
              {fechado ? 'Período fechado: projeção = realizado.' : `${diasFechados} dias fechados · ${diasRestantes} restantes · fecha em ${fimMes}`}
            </p>
          </div>

          <div className="rounded-xl bg-white/[0.07] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/55">{fechado ? 'Fechou em' : 'Fecha em'}</p>
            <p className="text-[20px] font-extrabold tabular-nums leading-tight">{formatCurrencyInt(fechaValor)}</p>
            <div className="mt-2 space-y-1 text-[11px] text-white/80">
              <p className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1">vs {cheioLabel} inteiro <InfoHint className={hintCls} text={`${fechado ? 'Fechamento' : 'Projeção de fechamento'} contra o lucro bruto do mês INTEIRO de ${cheioLabel}${cheioAnterior ? ` (${formatCurrencyInt(cheioAnterior)})` : ''}. A pergunta que importa: vou fechar melhor que ${cheioLabel}?`} /></span>
                <Pct v={vsCheio} />
              </p>
              <p className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1">vs {parcialLabel}, mesmos dias <InfoHint className={hintCls} text="Realizado até agora contra o mesmo número de dias do período comparativo. É o mesmo selo dos cards." /></span>
                <Pct v={vsParcial} />
              </p>
              {!fechado && (
                <p className="flex items-center justify-between gap-2 border-t border-white/10 pt-1">
                  <span>faltam {formatCurrencyInt(falta)}</span>
                  <span className="tabular-nums">{formatCurrencyInt(porDia)}/dia</span>
                </p>
              )}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/70">
            <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" /> confiança <span className={cn('font-semibold capitalize', confiabilidade === 'alta' ? 'text-emerald-300' : confiabilidade === 'media' ? 'text-amber-300' : 'text-red-300')}>{confiabilidade}</span> ({Math.round(confiabilidadePct)}%)</span>
            <span>· {modo?.linear ? 'ritmo linear (pouco histórico)' : 'sazonal por dia da semana'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default RitmoDoMesCard
