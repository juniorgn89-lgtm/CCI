import { CreditCard, Wallet, Ban, ArrowDownUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import type { CarteiraDigitalItem, ModoRecebimentoItem } from '@/pages/Financeiro/hooks/useFinanceData'

interface Props {
  cartoesAppsAVencer: number
  carteiraDigitalItems: CarteiraDigitalItem[]
  modoRecebimento: ModoRecebimentoItem[]
}

const MODALIDADE_COR: Record<string, string> = {
  'Crédito': 'bg-blue-500/70',
  'Débito': 'bg-emerald-500/70',
  'PIX': 'bg-teal-500/70',
  'Carteira Digital': 'bg-violet-500/70',
}

/**
 * Bloco de cartões da Visão Geral do Financeiro — espelha o webPosto:
 *  - KPI "Cartões e Apps · A vencer" (soma dos apps/carteira digital pendentes)
 *  - KPI "Cheques devolvidos" (indisponível na integração Quality — só PUT)
 *  - Tabela "Carteira de cartões e Apps — A vencer" (apps pendentes por administradora)
 *  - "Modo recebimento" (recebíveis do período por modalidade)
 */
const CartoesEModo = ({ cartoesAppsAVencer, carteiraDigitalItems, modoRecebimento }: Props) => {
  const maxModo = Math.max(...modoRecebimento.map((m) => m.valor), 0)

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          title="Cartões e Apps · A vencer"
          value={formatCurrency(cartoesAppsAVencer)}
          Icon={Wallet}
          color="violet"
        />
        <KpiCard
          title="Cheques devolvidos"
          value="—"
          hint="Indisponível na integração Quality (sem GET)"
          Icon={Ban}
          color="gray"
        />
      </div>

      {/* Carteira + Modo recebimento */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Carteira de cartões e Apps — A vencer */}
        <section className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Carteira de cartões e Apps — A vencer</h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Saldos de apps/carteira digital a receber</p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>

          {carteiraDigitalItems.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400">Nenhum saldo de carteira digital a vencer.</p>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="px-5 py-2 font-medium">Tipo</th>
                    <th className="px-5 py-2 font-medium">Descrição</th>
                    <th className="px-5 py-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {carteiraDigitalItems.map((it) => (
                    <tr key={it.descricao}>
                      <td className="px-5 py-2.5 text-gray-500 dark:text-gray-400">{it.tipo}</td>
                      <td className="px-5 py-2.5 font-medium text-gray-700 dark:text-gray-300">{it.descricao}</td>
                      <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrency(it.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-5 py-2.5 font-medium text-gray-500 dark:text-gray-400" colSpan={2}>Total</td>
                    <td className="px-5 py-2.5 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(cartoesAppsAVencer)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Modo recebimento */}
        <section className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Modo recebimento</h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Recebíveis de cartão do período por modalidade</p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <ArrowDownUp className="h-4 w-4" />
            </div>
          </div>

          {modoRecebimento.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400">Sem recebíveis de cartão no período.</p>
          ) : (
            <ul className="flex-1 space-y-3 px-5 py-4">
              {modoRecebimento.map((m) => {
                const width = maxModo > 0 ? (m.valor / maxModo) * 100 : 0
                return (
                  <li key={m.modalidade}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{m.modalidade}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrency(m.valor)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={cn('h-full rounded-full', MODALIDADE_COR[m.modalidade] ?? 'bg-gray-400')}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

const KpiCard = ({
  title, value, hint, Icon, color,
}: {
  title: string
  value: string
  hint?: string
  Icon: typeof Wallet
  color: 'violet' | 'gray'
}) => {
  const iconBg = color === 'violet'
    ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
    : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'

  return (
    <section className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
      </div>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className="h-5 w-5" />
      </div>
    </section>
  )
}

export default CartoesEModo
