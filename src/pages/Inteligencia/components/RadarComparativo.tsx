import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Radar, TrendingDown, TrendingUp, Minus, Info, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatLiters } from '@/lib/formatters'
import type { PostoData } from '../hooks/useNetworkData'

/** Ícone "?" com tooltip via portal (fixed) — não é cortado por overflow e vira
 * pra baixo quando não há espaço acima. Aparece no hover e no foco. */
const HelpTip = ({ text }: { text: string }) => {
  const ref = useRef<HTMLSpanElement>(null)
  const [tip, setTip] = useState<{ top: number; left: number; below: boolean } | null>(null)
  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const below = r.top < 96
    const left = Math.min(Math.max(r.left + r.width / 2, 116), window.innerWidth - 116)
    setTip({ top: below ? r.bottom + 8 : r.top - 8, left, below })
  }
  const hide = () => setTip(null)
  return (
    <span
      ref={ref}
      tabIndex={0}
      aria-label={text}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="ml-1 inline-flex cursor-help align-middle"
    >
      <HelpCircle className="h-3 w-3 shrink-0 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
      {tip &&
        createPortal(
          <span
            style={{ position: 'fixed', top: tip.top, left: tip.left, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})` }}
            className="pointer-events-none z-[60] w-56 rounded-md bg-gray-900 px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-white shadow-xl dark:bg-gray-800"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  )
}

interface RadarComparativoProps {
  postos: PostoData[]
  networkAvg: { precoLitro: number }
}

const moneyL = (v: number) => `R$ ${v.toFixed(3).replace('.', ',')}`

const scoreTone = (s: number): 'emerald' | 'amber' | 'red' => (s >= 66 ? 'emerald' : s >= 40 ? 'amber' : 'red')
const TONE_TEXT: Record<'emerald' | 'amber' | 'red', string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
}
const TONE_BAR: Record<'emerald' | 'amber' | 'red', string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
}

/**
 * Radar de Preços — versão RESUMIDA/COMPARATIVA entre os postos selecionados.
 * Compara preço médio/L de cada posto vs. a média da rede (barra com linha de
 * CORTE na média), com participação de volume, ticket, custo, margem (quando há
 * custo apurado) e um ÍNDICE de competitividade 0–100 por posto.
 */
const RadarComparativo = ({ postos, networkAvg }: RadarComparativoProps) => {
  const ativos = useMemo(() => postos.filter((p) => p.litros > 0), [postos])

  const stats = useMemo(() => {
    const precos = ativos.map((p) => p.precoLitro)
    const margens = ativos.map((p) => p.margem)
    return {
      maxPreco: Math.max(...precos, 0),
      minPreco: Math.min(...precos, Infinity),
      maxLitros: Math.max(...ativos.map((p) => p.litros), 0),
      maxMargem: Math.max(...margens, 0),
      totLitros: ativos.reduce((s, p) => s + p.litros, 0),
      showMargem: ativos.some((p) => p.comCustoPct >= 50),
    }
  }, [ativos])

  // Índice de competitividade 0–100 por posto: preço (mais barato = melhor),
  // participação de volume e margem (quando há custo). Sem margem, o peso é
  // redistribuído entre preço e volume.
  const ordenados = useMemo(() => {
    const range = stats.maxPreco - stats.minPreco
    return ativos
      .map((p) => {
        const priceScore = range > 0 ? (stats.maxPreco - p.precoLitro) / range : 1
        const volScore = stats.maxLitros > 0 ? p.litros / stats.maxLitros : 0
        const margScore = stats.showMargem && stats.maxMargem > 0 ? p.margem / stats.maxMargem : 0
        const score = stats.showMargem
          ? Math.round(100 * (0.4 * priceScore + 0.25 * volScore + 0.35 * margScore))
          : Math.round(100 * (0.6 * priceScore + 0.4 * volScore))
        return { ...p, score }
      })
      .sort((a, b) => a.precoLitro - b.precoLitro)
  }, [ativos, stats])

  if (ordenados.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500">
        Sem litros de combustível no período pra comparar.
      </div>
    )
  }

  const maisBarato = ordenados[0]
  const maisCaro = ordenados[ordenados.length - 1]
  const cortePct = stats.maxPreco > 0 ? (networkAvg.precoLitro / stats.maxPreco) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard tone="emerald" Icon={TrendingDown} label="Mais competitivo" posto={maisBarato.fantasia} value={moneyL(maisBarato.precoLitro)} hint="menor preço médio/L" help="Posto com o MENOR preço médio de venda por litro no período — o mais competitivo da rede." />
        <SummaryCard tone="slate" Icon={Minus} label="Preço médio da rede" posto={`${ordenados.length} postos`} value={moneyL(networkAvg.precoLitro)} hint="ponderado por volume" help="Preço médio de venda por litro de toda a rede, ponderado pelo volume de cada posto (Σ faturamento ÷ Σ litros). É a linha de corte das barras." />
        <SummaryCard tone="red" Icon={TrendingUp} label="Mais caro" posto={maisCaro.fantasia} value={moneyL(maisCaro.precoLitro)} hint="maior preço médio/L" help="Posto com o MAIOR preço médio de venda por litro no período." />
      </div>

      {/* Tabela comparativa */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
          <Radar className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Radar de Preços · comparativo</h4>
          <span className="text-[11px] text-gray-400">— preço médio de venda por litro, do mais barato ao mais caro</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Posto<HelpTip text="Nome do posto (unidade) e cidade/UF." /></th>
                <th className="px-4 py-2 text-right font-medium">Litros<HelpTip text="Total de litros de combustível vendidos no período." /></th>
                <th className="px-4 py-2 text-right font-medium">Part. %<HelpTip text="Participação do posto no volume total da rede (litros do posto ÷ litros da rede)." /></th>
                <th className="px-4 py-2 text-right font-medium">Faturamento<HelpTip text="Faturamento de combustível do posto no período (soma do valor dos abastecimentos)." /></th>
                <th className="px-4 py-2 text-right font-medium">Ticket méd.<HelpTip text="Valor médio por abastecimento (faturamento ÷ nº de abastecimentos)." /></th>
                {stats.showMargem && <th className="px-4 py-2 text-right font-medium">Custo / L<HelpTip text="Custo médio por litro, calculado só sobre o volume com custo apurado nos abastecimentos." /></th>}
                <th className="px-4 py-2 text-right font-medium">Preço médio / L<HelpTip text="Preço médio de venda por litro (faturamento ÷ litros) — média ponderada de todos os combustíveis. A barra é proporcional ao maior preço; a linha vertical marca a média da rede (corte)." /></th>
                <th className="px-4 py-2 text-right font-medium">vs. rede<HelpTip text="Diferença do preço médio/L do posto vs. a média da rede (ponderada por volume). Negativo = mais barato; positivo = mais caro." /></th>
                {stats.showMargem && <th className="px-4 py-2 text-right font-medium">Margem<HelpTip text="Margem percentual por litro (lucro ÷ faturamento), só sobre o volume com custo apurado." /></th>}
                <th className="px-4 py-2 text-right font-medium">Índice<HelpTip text="Índice de competitividade 0–100: combina preço (mais barato = melhor), participação de volume e margem (quando há custo apurado). Maior = mais competitivo." /></th>
                <th className="px-4 py-2 text-left font-medium">Posição<HelpTip text="Classificação do preço vs. a média da rede: Competitivo (abaixo da média), Na média, ou Acima da rede." /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {ordenados.map((p) => {
                const diff = networkAvg.precoLitro > 0 ? p.precoLitro / networkAvg.precoLitro - 1 : 0
                const competitivo = diff < -0.003
                const caro = diff > 0.003
                const barWidth = stats.maxPreco > 0 ? (p.precoLitro / stats.maxPreco) * 100 : 0
                const part = stats.totLitros > 0 ? (p.litros / stats.totLitros) * 100 : 0
                const st = scoreTone(p.score)
                return (
                  <tr key={p.empresaCodigo} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{p.fantasia}</span>
                      <span className="ml-1.5 text-[10px] text-gray-400">{p.cidade}/{p.estado}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatLiters(p.litros)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{part.toFixed(0).replace('.', ',')}%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(p.fatCombustivel)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(p.ticketMedio)}</td>
                    {stats.showMargem && (
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{p.comCustoPct >= 50 ? moneyL(p.custoLitro) : '—'}</td>
                    )}
                    <td className="px-2 py-2.5">
                      {/* Barra proporcional ao maior preço + linha de CORTE na média da rede */}
                      <div className="flex items-center justify-end gap-2">
                        <div className="relative hidden h-2 w-24 overflow-visible rounded-full bg-gray-100 dark:bg-gray-800 sm:block">
                          <div
                            className={cn('h-full rounded-full', competitivo ? 'bg-emerald-500' : caro ? 'bg-red-500' : 'bg-gray-400')}
                            style={{ width: `${Math.max(6, barWidth)}%` }}
                          />
                          {/* Linha de corte = preço médio da rede */}
                          <div
                            className="absolute -top-0.5 bottom-[-2px] w-px bg-gray-600 dark:bg-gray-300"
                            style={{ left: `${cortePct}%` }}
                            title={`Corte = média da rede (${moneyL(networkAvg.precoLitro)})`}
                          />
                        </div>
                        <span className="w-20 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{moneyL(p.precoLitro)}</span>
                      </div>
                    </td>
                    <td className={cn('px-4 py-2.5 text-right font-medium tabular-nums', competitivo ? TONE_TEXT.emerald : caro ? TONE_TEXT.red : 'text-gray-400')}>
                      {diff >= 0 ? '+' : ''}{(diff * 100).toFixed(0).replace('.', ',')}%
                    </td>
                    {stats.showMargem && (
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{p.comCustoPct >= 50 ? `${p.margem.toFixed(0).replace('.', ',')}%` : '—'}</td>
                    )}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 md:block">
                          <div className={cn('h-full rounded-full', TONE_BAR[st])} style={{ width: `${Math.max(4, p.score)}%` }} />
                        </div>
                        <span className={cn('w-7 text-right text-sm font-bold tabular-nums', TONE_TEXT[st])}>{p.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                        competitivo
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30'
                          : caro
                          ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30'
                          : 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-700/40 dark:text-gray-300 dark:ring-gray-600/40',
                      )}>
                        {competitivo ? 'Competitivo' : caro ? 'Acima da rede' : 'Na média'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="flex items-start gap-1.5 border-t border-gray-100 px-4 py-2 text-[10px] leading-snug text-gray-400 dark:border-gray-800">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          A linha de corte na barra de preço marca a média da rede ({moneyL(networkAvg.precoLitro)}) — à esquerda = mais barato. O Índice (0–100) combina preço {stats.showMargem ? '(40%), volume (25%) e margem (35%)' : '(60%) e volume (40%)'}; maior = mais competitivo. Preço médio/L é a média ponderada de todos os combustíveis. {stats.showMargem ? 'Margem só sobre o volume com custo apurado.' : 'Margem/custo indisponíveis — sem custo apurado nos abastecimentos do período.'}
        </p>
      </div>
    </div>
  )
}

const SummaryCard = ({ tone, Icon, label, posto, value, hint, help }: {
  tone: 'emerald' | 'red' | 'slate'
  Icon: typeof TrendingDown
  label: string
  posto: string
  value: string
  hint: string
  help: string
}) => {
  const cls =
    tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'red' ? 'text-red-600 dark:text-red-400'
    : 'text-gray-500 dark:text-gray-400'
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-4 w-4', cls)} />
        <span className="inline-flex items-center text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}<HelpTip text={help} /></span>
      </div>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', cls)}>{value}</p>
      <p className="truncate text-[11px] text-gray-600 dark:text-gray-300" title={posto}>{posto}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{hint}</p>
    </div>
  )
}

export default RadarComparativo
