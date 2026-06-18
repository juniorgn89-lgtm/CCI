import { FileText, ReceiptText, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import type { OpenBalanceCard } from '@/pages/Financeiro/hooks/useFinanceData'

interface Props {
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
    <section className={cn('rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-900', st.ring)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
        </div>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', st.iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className={cn('mt-3 text-2xl font-bold tabular-nums', st.value)}>{formatCurrency(data.total)}</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {data.count} {data.count === 1 ? 'título em aberto' : 'títulos em aberto'}
      </p>
    </section>
  )
}

/**
 * Os 3 indicadores de ênfase da Visão Geral, todos por SALDO EM ABERTO:
 *  (a) Notas a prazo NÃO faturadas (TITULO_RECEBER convertido=false)
 *  (b) Duplicatas em aberto (/DUPLICATA não baixadas)
 *  (c) A pagar em aberto (TITULO_PAGAR não baixado)
 */
const SaldoAbertoCards = ({ notasNaoFaturadas, duplicatasAberto, pagarAberto }: Props) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <Card
      title="Notas a prazo não faturadas"
      subtitle="A receber não convertidas (convertido = não)"
      Icon={FileText}
      tone="indigo"
      data={notasNaoFaturadas}
    />
    <Card
      title="Duplicatas em aberto"
      subtitle="Duplicatas não baixadas"
      Icon={ReceiptText}
      tone="blue"
      data={duplicatasAberto}
    />
    <Card
      title="A pagar em aberto"
      subtitle="Títulos a pagar não baixados"
      Icon={CreditCard}
      tone="red"
      data={pagarAberto}
    />
  </div>
)

export default SaldoAbertoCards
