import { FileText, ReceiptText, CreditCard, ArrowDownUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import type { OpenBalanceCard } from '@/pages/Financeiro/hooks/useFinanceData'

/** Resumo da posição líquida pro hero (calculado no index). */
export interface PosicaoLiquida {
  posicao: number
  aReceber: number
  aPagar: number
  vencidoTotal: number
}

interface Props {
  posicao: PosicaoLiquida
  notasNaoFaturadas: OpenBalanceCard
  duplicatasAberto: OpenBalanceCard
  pagarAberto: OpenBalanceCard
}

type Tone = 'indigo' | 'blue' | 'red'

const TONE_STYLE: Record<Tone, { ring: string; iconBg: string; value: string }> = {
  indigo: {
    ring: 'border-indigo-200 dark:border-indigo-900/50',
    iconBg: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    value: 'text-indigo-700 dark:text-indigo-300',
  },
  blue: {
    ring: 'border-blue-200 dark:border-blue-900/50',
    iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    value: 'text-blue-700 dark:text-blue-300',
  },
  red: {
    ring: 'border-red-200 dark:border-red-900/50',
    iconBg: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    value: 'text-red-700 dark:text-red-300',
  },
}

const Card = ({
  title, subtitle, Icon, tone, data,
}: {
  title: string
  subtitle: string
  Icon: typeof FileText
  tone: Tone
  data: OpenBalanceCard
}) => {
  const st = TONE_STYLE[tone]
  return (
    <section className={cn('flex flex-col rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900', st.ring)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{title}</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400">{subtitle}</p>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', st.iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={cn('mt-3 text-[22px] font-bold tabular-nums', st.value)}>{formatCurrencyInt(data.total)}</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {data.count} {data.count === 1 ? 'título em aberto' : 'títulos em aberto'}
      </p>
      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <div>
          <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Vencidas
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">{formatCurrencyInt(data.vencidoTotal)}</p>
          <p className="text-[10px] text-gray-400">{data.vencidoCount} {data.vencidoCount === 1 ? 'título' : 'títulos'}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> A vencer
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrencyInt(data.aVencerTotal)}</p>
          <p className="text-[10px] text-gray-400">{data.aVencerCount} {data.aVencerCount === 1 ? 'título' : 'títulos'}</p>
        </div>
      </div>
    </section>
  )
}

/**
 * Posição líquida (hero navy) + os 3 indicadores de saldo EM ABERTO:
 *  (a) Notas a prazo NÃO faturadas · (b) Duplicatas em aberto · (c) A pagar em aberto.
 * Sem pill de variação: o `useFinanceData` não guarda snapshot histórico do
 * saldo em aberto, então não há base honesta de "vs mês anterior".
 */
const SaldoAbertoCards = ({ posicao, notasNaoFaturadas, duplicatasAberto, pagarAberto }: Props) => {
  const pos = posicao.posicao
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Hero — posição líquida */}
      <section className="flex flex-col rounded-2xl border border-[#1e3a5f]/30 bg-gradient-to-br from-[#1e3a5f] to-[#27496f] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">Posição líquida</p>
            <p className="text-[11px] uppercase tracking-wide text-white/60">A receber − a pagar</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <ArrowDownUp className="h-4 w-4 text-white/90" />
          </div>
        </div>
        <p className={cn('mt-3 text-[28px] font-bold leading-tight tabular-nums', pos >= 0 ? 'text-[#6ee7b7]' : 'text-red-300')}>
          {pos >= 0 ? '+' : ''}{formatCurrencyInt(pos)}
        </p>
        <div className="mt-3 space-y-1.5 border-t border-white/15 pt-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-white/60">A receber em aberto</span>
            <span className="font-semibold tabular-nums text-white">{formatCurrencyInt(posicao.aReceber)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-white/60">A pagar em aberto</span>
            <span className="font-semibold tabular-nums text-white">{formatCurrencyInt(posicao.aPagar)}</span>
          </div>
        </div>
        <div className="mt-auto pt-3">
          <span className="text-[11px] text-white/50">{formatCurrencyInt(posicao.vencidoTotal)} vencidos no total</span>
        </div>
      </section>

      <Card
        title="Notas a prazo não faturadas"
        subtitle="A receber não convertidas"
        Icon={FileText}
        tone="indigo"
        data={notasNaoFaturadas}
      />
      <Card
        title="Duplicatas em aberto"
        subtitle="Não baixadas"
        Icon={ReceiptText}
        tone="blue"
        data={duplicatasAberto}
      />
      <Card
        title="A pagar em aberto"
        subtitle="Títulos não baixados"
        Icon={CreditCard}
        tone="red"
        data={pagarAberto}
      />
    </div>
  )
}

export default SaldoAbertoCards
