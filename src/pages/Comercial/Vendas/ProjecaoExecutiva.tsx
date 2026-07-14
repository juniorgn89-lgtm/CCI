import { useState } from 'react'
import { LineChart, TrendingUp, TrendingDown, CalendarCheck, CalendarClock, Gauge, ShieldCheck, ChevronDown, ChevronUp, TriangleAlert } from 'lucide-react'
import { ResponsiveContainer, ComposedChart, Area, Line } from 'recharts'
import InfoHint from '@/components/ui/InfoHint'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatDate, formatNumber } from '@/lib/formatters'
import { PROJECAO_TOOLTIP_EXECUTIVA, type ProjecaoAvancadaResult, type Confiabilidade } from '@/lib/projection'

interface ProjecaoExecutivaProps {
  /** Projeção avançada da MÉTRICA PRINCIPAL (faturamento OU litros — ver `metrica`):
   * cenários, tendência, sparkline, confiabilidade. */
  fat: ProjecaoAvancadaResult
  /** Lucro bruto projetado (sempre em R$). */
  projetadoLucro: number
  dataFinal: string
  /** Comparativo vs período anterior — valor FECHADO do período de referência
   * na MESMA métrica de `fat` + rótulo curto. Omitido/≤0 → sem badge. */
  comparativo?: { anterior: number; label: string }
  /** Métrica principal do card: 'reais' (default, faturamento) ou 'litros'. */
  metrica?: 'reais' | 'litros'
  /** L.B. por litro (R$/L) — mostrado no rodapé no lugar da margem% quando
   * `metrica='litros'` (a margem% precisa do faturamento, que não é o principal). */
  lbPorUnidade?: number
  /** Mostra o mini-gráfico (sparkline) no expandido. Default true. */
  sparkline?: boolean
  /** Mostra as células de cenário (conservador/esperado/otimista). Default true. */
  cenarios?: boolean
  /** Médias (ritmo/dia, média/dia) como número INTEIRO em vez de compacto. */
  mediasInteiras?: boolean
  loading?: boolean
  /** Expansão controlada por fora (toggle global que também abre os detalhes
   * por combustível nos KPIs). Se omitido, usa estado interno. */
  expanded?: boolean
  onToggleExpanded?: () => void
}

/** Formato compacto pros números densos do card — cabe em telas estreitas sem
 *  perder a distinção entre os cenários (R$ 1,53 mi vs 1,56 vs 1,59 mi). */
const compact = (v: number): string => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace('.', ',')} mi`
  if (a >= 1_000) return `R$ ${Math.round(v / 1_000)} mil`
  return formatCurrencyInt(v)
}

const CONFIA: Record<Confiabilidade, { label: string; cls: string }> = {
  alta: { label: 'Confiança alta', cls: 'bg-emerald-400/20 text-emerald-100 ring-emerald-300/30' },
  media: { label: 'Confiança média', cls: 'bg-amber-400/20 text-amber-100 ring-amber-300/30' },
  baixa: { label: 'Confiança baixa', cls: 'bg-red-400/20 text-red-100 ring-red-300/30' },
}

const Chip = ({ icon: Icon, label, value, valueClass }: {
  icon: typeof Gauge
  label: string
  value: string
  valueClass?: string
}) => (
  <div className="flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5">
    <Icon className="h-3.5 w-3.5 shrink-0 text-white/60" />
    <div className="min-w-0 leading-tight">
      <p className="truncate text-[9px] uppercase tracking-wide text-white/55">{label}</p>
      <p className={cn('truncate text-xs font-semibold tabular-nums text-white', valueClass)}>{value}</p>
    </div>
  </div>
)

/** Célula de cenário com tooltip no hover explicando o que fazer pra atingi-lo
 * (quanto falta e a média/dia necessária nos dias restantes). */
const ScenarioCell = ({ label, value, valueClass, highlight, align, tip }: {
  label: string
  value: string
  valueClass?: string
  highlight?: boolean
  align: 'left' | 'center' | 'right'
  tip: string
}) => (
  <div
    className={cn(
      'group/cen relative min-w-0 cursor-help rounded-lg px-1.5 py-1.5 text-center',
      highlight ? 'bg-white/20 ring-1 ring-white/30' : 'bg-white/10',
    )}
    tabIndex={0}
  >
    <p className={cn('truncate text-[9px] uppercase tracking-wide', highlight ? 'text-white/70' : 'text-white/55')}>{label}</p>
    <p className={cn('truncate text-xs tabular-nums', highlight ? 'font-bold text-white' : 'font-semibold text-white/90', valueClass)}>{value}</p>
    <span
      className={cn(
        'pointer-events-none absolute bottom-full z-50 mb-2 w-56 rounded-md bg-gray-900 px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover/cen:opacity-100 group-focus/cen:opacity-100 dark:bg-gray-800',
        align === 'left' && 'left-0',
        align === 'center' && 'left-1/2 -translate-x-1/2',
        align === 'right' && 'right-0',
      )}
    >
      {tip}
    </span>
  </div>
)

/**
 * Card de Projeção EXECUTIVA (aba Combustível) — projeção multifator com
 * cenários, contexto (dias/ritmo/tendência/confiabilidade) e mini-sparkline.
 * Estilo dashboard financeiro premium sobre gradiente navy→azul.
 */
const ProjecaoExecutiva = ({
  fat,
  projetadoLucro,
  dataFinal,
  comparativo,
  metrica = 'reais',
  lbPorUnidade,
  sparkline = true,
  cenarios = true,
  mediasInteiras = false,
  loading = false,
  expanded: expandedProp,
  onToggleExpanded,
}: ProjecaoExecutivaProps) => {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = expandedProp ?? internalExpanded
  const toggleExpanded = onToggleExpanded ?? (() => setInternalExpanded((v) => !v))
  const isProjetada = fat.diasRestantes > 0
  const deltaFat = fat.esperado - fat.realizado
  const margemPct = fat.esperado > 0 ? (projetadoLucro / fat.esperado) * 100 : 0
  // Formatação da métrica principal — R$ (faturamento) ou litros.
  const isLitros = metrica === 'litros'
  const fmtFull = (v: number): string => (isLitros ? `${formatNumber(Math.round(v))} L` : formatCurrencyInt(v))
  const fmtCompact = (v: number): string => {
    if (!isLitros) return compact(v)
    const a = Math.abs(v)
    if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(2).replace('.', ',')} mi L`
    if (a >= 1_000) return `${Math.round(v / 1_000)} mil L`
    return `${formatNumber(Math.round(v))} L`
  }
  const principalNoun = isLitros ? 'Litros estimados' : 'Faturamento estimado'
  // Médias (ritmo/dia, média/dia): inteiro quando pedido; e a MÉDIA/DIA é a
  // média PROJETADA (esperado ÷ dias do mês) — calculada na própria projeção,
  // então média × dias = projeção (consistente).
  const fmtMedia = (v: number): string => (mediasInteiras ? fmtFull(v) : fmtCompact(v))
  const diasDoMes = Number((dataFinal || '').slice(8, 10)) || (fat.diasFechados + fat.diasRestantes)
  const mediaDiaProjetada = diasDoMes > 0 ? fat.esperado / diasDoMes : fat.mediaDiaria
  const up = fat.tendenciaPct >= 0
  const confia = CONFIA[fat.confiabilidade]
  const baixaConfianca = isProjetada && fat.confiabilidade === 'baixa'
  // Ritmo necessário/dia pra manter o esperado nos dias que faltam — promovido
  // do hover pra linha principal (é a informação que vira ação).
  const ritmoNecessario = fat.diasRestantes > 0 ? deltaFat / fat.diasRestantes : 0
  // Comparativo do projetado vs o fechamento do período anterior.
  const cmpPct = comparativo && comparativo.anterior > 0
    ? ((fat.esperado - comparativo.anterior) / comparativo.anterior) * 100
    : null
  const cmpUp = (cmpPct ?? 0) >= 0
  const DOT: Record<Confiabilidade, string> = {
    alta: 'bg-emerald-400',
    media: 'bg-amber-400',
    baixa: 'bg-red-400',
  }

  // "O que fazer pra alcançar cada cenário": quanto falta e a média/dia
  // necessária nos dias restantes — mostrado no hover de cada cenário.
  const mediaNecessaria = (alvo: number) =>
    fat.diasRestantes > 0 ? (alvo - fat.realizado) / fat.diasRestantes : 0
  const tipConservador = `Cenário mais cauteloso (ritmo em queda). Pra fechar em ${fmtFull(fat.conservador)}, faltam ${fmtFull(fat.conservador - fat.realizado)} em ${fat.diasRestantes} dia(s) — cerca de ${fmtFull(mediaNecessaria(fat.conservador))}/dia, abaixo da sua média de ${fmtFull(fat.mediaDiaria)}/dia.`
  const tipEsperado = `Mantendo o ritmo recente (${fmtFull(fat.mediaRecente)}/dia) com a tendência atual. Pra fechar em ${fmtFull(fat.esperado)}, faltam ${fmtFull(fat.esperado - fat.realizado)} em ${fat.diasRestantes} dia(s) — cerca de ${fmtFull(mediaNecessaria(fat.esperado))}/dia.`
  const tipOtimista = `Cenário de aceleração (ritmo acima da média). Pra fechar em ${fmtFull(fat.otimista)}, faltam ${fmtFull(fat.otimista - fat.realizado)} em ${fat.diasRestantes} dia(s) — cerca de ${fmtFull(mediaNecessaria(fat.otimista))}/dia, acima da sua média de ${fmtFull(fat.mediaDiaria)}/dia.`

  return (
    <div className="flex h-full flex-col rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#27496f] p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Sinal de confiança sempre visível — não precisa expandir pra saber
              o quanto confiar no número. Detalhe (%) fica no chip do expandido. */}
          <span
            className={cn('h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.14)]', DOT[fat.confiabilidade])}
            title={`${confia.label} · ${fat.confiabilidadePct}%`}
          />
          <p className="text-sm font-medium text-white/90">Projeção fim do período</p>
          <InfoHint
            text={PROJECAO_TOOLTIP_EXECUTIVA}
            align="start"
            className="text-white/60 hover:text-white dark:text-white/60 dark:hover:text-white"
          />
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
          <LineChart className="h-4 w-4 text-white" />
        </div>
      </div>

      {loading ? (
        <Skeleton className="mt-2 h-8 w-32 bg-white/20" />
      ) : (
        <>
          {/* Esperado (número grande) + comparativo vs período anterior */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={cn('text-2xl font-bold tabular-nums', baixaConfianca ? 'text-white/50' : 'text-white')}>
              {fmtFull(fat.esperado)}
            </p>
            {cmpPct !== null && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                  cmpUp ? 'bg-emerald-400/20 text-emerald-100' : 'bg-red-400/20 text-red-100',
                )}
                title={`Projeção vs fechamento do ${comparativo!.label} (${fmtFull(comparativo!.anterior)})`}
              >
                {cmpUp ? '▲' : '▼'} {cmpUp ? '+' : ''}{cmpPct.toFixed(1).replace('.', ',')}% vs {comparativo!.label}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/70">{principalNoun} até {formatDate(dataFinal)}</p>

          {/* Ritmo necessário/dia + dias restantes — acionável, sempre visível. */}
          {isProjetada && (
            <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11.5px] text-white/90">
              <Gauge className="h-3.5 w-3.5 shrink-0 text-white/60" />
              <span>Ritmo p/ manter: <span className="font-semibold tabular-nums">{fmtMedia(ritmoNecessario)}</span>/dia</span>
              <span className="text-white/45">·</span>
              <span>faltam <span className="font-semibold tabular-nums">{fat.diasRestantes}d</span></span>
            </div>
          )}

          {/* Baixa confiança: número esmaecido acima + aviso honesto aqui. */}
          {baixaConfianca && (
            <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-snug text-amber-200/90">
              <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
              Só {fat.diasFechados} dia{fat.diasFechados === 1 ? '' : 's'} apurado{fat.diasFechados === 1 ? '' : 's'} — projeção pouco confiável. Trate como referência, não valor fechado.
            </p>
          )}

          {/* ── Detalhes (só quando expandido) ── */}
          {expanded && (
            <>
              <div className="mt-2">
                <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1', confia.cls)}>
                  <ShieldCheck className="h-2.5 w-2.5" />
                  {confia.label} · {fat.confiabilidadePct}%
                </span>
              </div>

              {/* Mini-sparkline (real sólido + cauda projetada tracejada) */}
              {sparkline && fat.sparkline.length > 1 && (
                <div className="mt-3 h-12 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={fat.sparkline} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                      <defs>
                        <linearGradient id="projExecReal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#ffffff" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="real" stroke="#ffffff" strokeWidth={2} fill="url(#projExecReal)" dot={false} isAnimationActive={false} connectNulls />
                      <Line type="monotone" dataKey="projetado" stroke="#fcd34d" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Cenários — hover mostra o que fazer pra atingir cada um */}
              {cenarios && isProjetada && (
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <ScenarioCell
                    label="Conservador"
                    value={fmtCompact(fat.conservador)}
                    align="left"
                    tip={tipConservador}
                  />
                  <ScenarioCell
                    label="Esperado"
                    value={fmtCompact(fat.esperado)}
                    highlight
                    align="center"
                    tip={tipEsperado}
                  />
                  <ScenarioCell
                    label="Otimista"
                    value={fmtCompact(fat.otimista)}
                    valueClass="text-emerald-200"
                    align="right"
                    tip={tipOtimista}
                  />
                </div>
              )}

              {/* Chips de contexto */}
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <Chip icon={CalendarCheck} label="Dias fechados" value={String(fat.diasFechados)} />
                <Chip icon={CalendarClock} label="Dias restantes" value={String(fat.diasRestantes)} />
                <Chip icon={Gauge} label="Média / dia" value={fmtMedia(mediaDiaProjetada)} />
                <Chip
                  icon={up ? TrendingUp : TrendingDown}
                  label="Tendência"
                  value={`${up ? '+' : ''}${(fat.tendenciaPct * 100).toFixed(2).replace('.', ',')}%`}
                  valueClass={up ? 'text-emerald-200' : 'text-red-200'}
                />
              </div>
            </>
          )}

          {/* Lucro estimado — mt-auto ancora no rodapé pra preencher a altura
              quando o card estica até a altura dos KPIs. */}
          <div className="mt-auto border-t border-white/15 pt-2">
            <p className="text-[11px] text-white/70">Lucro bruto estimado</p>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-base font-semibold tabular-nums text-white">
                {formatCurrencyInt(projetadoLucro)}
              </p>
              <p className="text-[11px] tabular-nums text-white/70">
                {isLitros
                  ? (lbPorUnidade != null ? `${formatCurrency(lbPorUnidade)}/L` : '—')
                  : (fat.esperado > 0 ? `${margemPct.toFixed(2).replace('.', ',')}% margem` : '—')}
              </p>
            </div>
          </div>

          {!isProjetada && (
            <p className="mt-2 text-[10px] leading-snug text-white/70">
              Sem dias futuros — valor = realizado.
            </p>
          )}

          {/* Toggle ver mais / menos detalhes */}
          <button
            type="button"
            onClick={toggleExpanded}
            className="mt-3 inline-flex items-center gap-1 self-start rounded-md px-1.5 py-1 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {expanded ? (
              <>Ver menos <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>Ver detalhes <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </button>
        </>
      )}
    </div>
  )
}

export default ProjecaoExecutiva
