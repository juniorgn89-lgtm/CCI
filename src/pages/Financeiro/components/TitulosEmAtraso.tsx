import { useMemo } from 'react'
import { Users, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import type { ReceivableRow, PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'

interface Props {
  receivablesData: ReceivableRow[]
  payablesData: PayableRow[]
  /** Quantos itens mostrar (top N por valor). */
  top?: number
}

interface BarItem {
  nome: string
  valor: number
}

/**
 * Títulos a receber / pagar EM ATRASO — espelha os dois primeiros blocos do
 * dashboard financeiro do webPosto: ranking (barras) dos clientes/fornecedores
 * com maior valor vencido.
 */
const TitulosEmAtraso = ({ receivablesData, payablesData, top = 8 }: Props) => {
  const receber = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of receivablesData) {
      if (r.statusTag !== 'vencido') continue
      const nome = r.nomeCliente?.trim() || `Cliente ${r.clienteCodigo}`
      m.set(nome, (m.get(nome) ?? 0) + r.valor)
    }
    return Array.from(m, ([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, top)
  }, [receivablesData, top])

  const pagar = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of payablesData) {
      if (p.statusTag !== 'vencido') continue
      const nome = p.nomeFornecedor?.trim() || `Fornecedor ${p.fornecedorCodigo}`
      m.set(nome, (m.get(nome) ?? 0) + p.saldoRestante)
    }
    return Array.from(m, ([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, top)
  }, [payablesData, top])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AtrasoCard
        title="Títulos a receber em atraso"
        subtitle="Clientes com débitos vencidos ou parcelas em aberto"
        Icon={Users}
        items={receber}
        color="blue"
        emptyText="Nenhum título a receber vencido. 🎉"
      />
      <AtrasoCard
        title="Títulos a pagar em atraso"
        subtitle="Fornecedores com contas vencidas"
        Icon={Truck}
        items={pagar}
        color="red"
        emptyText="Nenhuma conta a pagar vencida. 🎉"
      />
    </div>
  )
}

const AtrasoCard = ({
  title, subtitle, Icon, items, color, emptyText,
}: {
  title: string
  subtitle: string
  Icon: typeof Users
  items: BarItem[]
  color: 'blue' | 'red'
  emptyText: string
}) => {
  const max = Math.max(...items.map((i) => i.valor), 0)
  const total = items.reduce((s, i) => s + i.valor, 0)
  const barColor = color === 'blue' ? 'bg-blue-500/70' : 'bg-red-500/70'
  const iconBg = color === 'blue'
    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'

  return (
    <section className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-400">{emptyText}</p>
      ) : (
        <>
          <ul className="flex-1 divide-y divide-gray-100 px-5 dark:divide-gray-800">
            {items.map((it) => {
              const width = max > 0 ? (it.valor / max) * 100 : 0
              return (
                <li key={it.nome} className="py-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-gray-700 dark:text-gray-300" title={it.nome}>
                      {it.nome}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(it.valor)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className={cn('h-full rounded-full', barColor)} style={{ width: `${width}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-gray-200 px-5 py-2.5 text-right text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Top {items.length} · <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(total)}</span>
          </div>
        </>
      )}
    </section>
  )
}

export default TitulosEmAtraso
