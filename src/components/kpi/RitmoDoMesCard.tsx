import { Link } from 'react-router-dom'
import { CalendarRange, Gauge, ArrowRight } from 'lucide-react'
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
  /** Atalho "o que fazer": link (ex.: Radar de Preços) ou clique (ex.: abrir a janela de kits). */
  acao?: { label: string; to?: string; onClick?: () => void }
  className?: string
}

/** "▼ 5,2% abaixo de out/26 inteiro" — comparação em frase. */
const Variacao = ({ v, sufixo }: { v: number | null; sufixo: string }) => v === null
  ? <span className="text-white/50">sem base para comparar</span>
  : <span><b className={cn('font-semibold tabular-nums', v >= 0 ? 'text-emerald-300' : 'text-red-300')}>{v >= 0 ? '▲' : '▼'} {Math.abs(v).toFixed(1).replace('.', ',')}% {v >= 0 ? 'acima' : 'abaixo'}</b> {sufixo}</span>

const RitmoDoMesCard = ({
  realizado, projetado, diasFechados, diasRestantes, dataFinal, cheioAnterior, cheioLabel, parcialAnterior, parcialLabel,
  confiabilidade, confiabilidadePct, modo, contexto, loading, acao, className,
}: RitmoDoMesCardProps) => {
  const fechado = diasRestantes <= 0
  const entregue = projetado > 0 ? Math.min(100, (realizado / projetado) * 100) : 0
  const falta = Math.max(0, projetado - realizado)
  const porDia = diasRestantes > 0 ? falta / diasRestantes : 0
  const fechaValor = fechado ? realizado : projetado
  const vsCheio = cheioAnterior && cheioAnterior > 0 ? ((fechaValor - cheioAnterior) / cheioAnterior) * 100 : null
  const vsParcial = parcialAnterior && parcialAnterior > 0 ? ((realizado - parcialAnterior) / parcialAnterior) * 100 : null
  const fimMes = dataFinal.split('-').reverse().slice(0, 2).join('/')
  // R$/dia para empatar com o mês de referência inteiro nos dias que faltam.
  const paraEmpatar = cheioAnterior && cheioAnterior > 0 && diasRestantes > 0 ? Math.max(0, cheioAnterior - realizado) / diasRestantes : null
  const DOT = { alta: 'bg-emerald-400', media: 'bg-amber-400', baixa: 'bg-red-400' } as const
  const hintCls = 'text-white/50 hover:text-white dark:text-white/50 dark:hover:text-white'

  return (
    <div className={cn('flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#27496f] text-white shadow-lg dark:border dark:border-[#2f3b4f] dark:border-t-2 dark:border-t-[#0d9488] dark:bg-none dark:bg-[#1b2b35] dark:shadow-none', className)}>
      <div className="flex items-start justify-between gap-2 px-5 pb-3 pt-[18px]">
        <div className="min-w-0">
          <p className="inline-flex flex-wrap items-center gap-1.5 text-[15px] font-bold">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.14)]', DOT[confiabilidade])} />
            Como o mês vai fechar
            <InfoHint className={hintCls} text="Projeção de fechamento do lucro bruto pela sazonalidade de dia da semana da rede (ramo linear quando falta histórico). Mesma conta dos cards acima e do painel da Central: os números batem. É estimativa, não valor fechado." />
            {modo && <ProjecaoModoAviso modo={modo} contexto={contexto} tone="navy" />}
          </p>
          <p className="mt-0.5 text-[11px] text-white/60">Previsão do lucro bruto{contexto ? ` de ${contexto}` : ''} até o fim do mês</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center px-5 pb-6">
          <div className="h-16 w-full animate-pulse rounded-xl bg-white/10" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
          {/* 1. Já entrou × deve fechar */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/55">Já entrou</p>
              <p className="text-[19px] font-bold tabular-nums leading-tight">{formatCurrencyInt(realizado)}</p>
              <p className="text-[11px] text-white/60">em {diasFechados} {diasFechados === 1 ? 'dia' : 'dias'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/55">{fechado ? 'Fechou em' : 'Deve fechar em'}</p>
              <p className="text-[19px] font-bold tabular-nums leading-tight text-[#6ee7b7] dark:text-[#86c5aa]">{formatCurrencyInt(fechaValor)}</p>
              <p className="text-[11px] text-white/60">{fechado ? 'mês fechado' : `até ${fimMes}`}</p>
            </div>
          </div>

          {/* 2. Barra com legenda */}
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#34d399]" style={{ width: `${fechado ? 100 : Math.max(2, entregue)}%` }} />
            </div>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-white/70">
              <CalendarRange className="h-3.5 w-3.5" />
              {fechado ? 'Período fechado: a previsão é o realizado.' : `${Math.round(entregue)}% da previsão já entrou · faltam ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`}
            </p>
          </div>

          {/* 3. Comparações em frase + o que precisa por dia */}
          <div className="space-y-1.5 rounded-xl bg-white/[0.07] p-3 text-[12px] leading-snug text-white/85">
            <p className="flex items-start justify-between gap-2">
              <span><Variacao v={vsCheio} sufixo={`de ${cheioLabel} inteiro${cheioAnterior ? ` (${formatCurrencyInt(cheioAnterior)})` : ''}`} /></span>
              <InfoHint className={cn('mt-0.5 shrink-0', hintCls)} text={`${fechado ? 'Fechamento' : 'Previsão de fechamento'} contra o lucro bruto do mês INTEIRO de ${cheioLabel}. A pergunta que importa: vou fechar melhor que ${cheioLabel}?`} />
            </p>
            <p className="flex items-start justify-between gap-2">
              <span>Até aqui: <Variacao v={vsParcial} sufixo={`de ${parcialLabel} nos mesmos dias`} /></span>
              <InfoHint className={cn('mt-0.5 shrink-0', hintCls)} text="O que já entrou contra o mesmo número de dias do período de comparação. É o mesmo selo dos cartões ao lado." />
            </p>
            {!fechado && paraEmpatar !== null && vsCheio !== null && vsCheio < 0 ? (
              <p className="border-t border-white/10 pt-1.5 text-white">
                Para empatar com {cheioLabel}: <b className="font-semibold tabular-nums">{formatCurrencyInt(paraEmpatar)}/dia</b> nos {diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'} que faltam
                <span className="text-white/60"> (o ritmo previsto é {formatCurrencyInt(porDia)}/dia)</span>
              </p>
            ) : !fechado ? (
              <p className="border-t border-white/10 pt-1.5 text-white/80">
                Faltam {formatCurrencyInt(falta)} para a previsão: <b className="font-semibold tabular-nums text-white">{formatCurrencyInt(porDia)}/dia</b>
              </p>
            ) : null}
          </div>

          {/* 4. Próximo passo */}
          {!fechado && acao && (() => {
            const cls = 'group inline-flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-left text-[12px] font-semibold text-white transition-colors hover:border-[#5eead4]/50 hover:bg-white/[0.1]'
            const miolo = (
              <>
                <span>{vsCheio !== null && vsCheio < 0 ? `Como virar o jogo nos ${diasRestantes} dias?` : 'Como fechar ainda melhor?'}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[#5eead4]">{acao.label} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
              </>
            )
            return acao.onClick
              ? <button type="button" onClick={acao.onClick} className={cls}>{miolo}</button>
              : <Link to={acao.to ?? '#'} className={cls}>{miolo}</Link>
          })()}

          {/* 5. Quanto confiar */}
          <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-white/70">
            <Gauge className="h-3.5 w-3.5" /> Confiança da previsão: <span className={cn('font-semibold', confiabilidade === 'alta' ? 'text-emerald-300' : confiabilidade === 'media' ? 'text-amber-300' : 'text-red-300')}>{confiabilidade === 'media' ? 'média' : confiabilidade}</span> ({Math.round(confiabilidadePct)}%)
            <span>· {modo?.linear ? 'média simples (pouco histórico)' : 'conta o ritmo de cada dia da semana'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default RitmoDoMesCard
