import { Droplets, Wrench, Store, Globe, LineChart, HelpCircle } from 'lucide-react'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'

const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`

/** Fator de extrapolação linear até o fim do mês (dias decorridos → dias totais). */
const projFactor = (dataInicial: string, dataFinal: string): number => {
  if (!dataInicial) return 1
  const [y, m] = dataInicial.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const monthEndISO = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const now = new Date()
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const dia = (s: string) => { const [yy, mm, dd] = s.split('-').map(Number); return Date.UTC(yy, mm - 1, dd) }
  const fimProj = dataFinal > monthEndISO ? dataFinal : monthEndISO
  const fimReal = todayISO < dataFinal ? todayISO : dataFinal
  const decorridos = Math.max(1, Math.round((dia(fimReal) - dia(dataInicial)) / 86_400_000) + 1)
  const totais = Math.max(decorridos, Math.round((dia(fimProj) - dia(dataInicial)) / 86_400_000) + 1)
  return totais / decorridos
}

interface SegmentCardProps {
  label: string
  Icon: typeof Droplets
  cardBg: string
  iconBg: string
  iconColor: string
  loading: boolean
  lucroBruto: number
  primary: { label: string; value: string }
  secondary: { label: string; value: string }
}

const SegmentCard = ({ label, Icon, cardBg, iconBg, iconColor, loading, lucroBruto, primary, secondary }: SegmentCardProps) => (
  <div className={cn('flex w-full flex-col rounded-xl border border-gray-200 p-5 text-left shadow-sm dark:border-gray-700', cardBg)}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        <p className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
          Lucro bruto
          <span className="group relative inline-flex cursor-help" tabIndex={0} aria-label="O que é Lucro bruto?">
            <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-60 -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-[11px] font-normal normal-case leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 dark:bg-gray-700">
              <strong>Faturamento − Custo</strong> dos produtos vendidos, somando todos os postos da rede. Não inclui despesas operacionais.
            </span>
          </span>
        </p>
      </div>
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
    </div>
    {loading ? (
      <div className="mt-3 h-8 w-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
    ) : (
      <p className="mt-3 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(lucroBruto)}</p>
    )}
    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
      <div>
        <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{primary.value}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{primary.label}</p>
      </div>
      <div>
        <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{secondary.value}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{secondary.label}</p>
      </div>
    </div>
  </div>
)

const ProjecoesPainel = () => {
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const { combustivel, automotivos, conveniencia, global, isLoading } = useRedeSetores()

  // Projeção fim do mês — extrapolação linear simples (rede-wide) por setor.
  const f = projFactor(dataInicial, dataFinal)
  const projLinhas = [
    { setor: 'Combustível', faturamento: combustivel.faturamento * f, lucroBruto: combustivel.lucroBruto * f, margem: combustivel.margem },
    { setor: 'Automotivos', faturamento: automotivos.faturamento * f, lucroBruto: automotivos.lucroBruto * f, margem: automotivos.margem },
    { setor: 'Conveniência', faturamento: conveniencia.faturamento * f, lucroBruto: conveniencia.lucroBruto * f, margem: conveniencia.margem },
  ]
  const projTotal = {
    faturamento: projLinhas.reduce((s, r) => s + r.faturamento, 0),
    lucroBruto: projLinhas.reduce((s, r) => s + r.lucroBruto, 0),
    margem: global.margem,
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <SegmentCard
        label="Combustível"
        Icon={Droplets}
        cardBg="bg-white dark:bg-gray-900"
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        loading={isLoading}
        lucroBruto={combustivel.lucroBruto}
        primary={{ label: 'Margem', value: fmtPct(combustivel.margem) }}
        secondary={{ label: 'L. bruto / litro', value: formatCurrency(combustivel.lucroPorUnidade) }}
      />
      <SegmentCard
        label="Automotivos"
        Icon={Wrench}
        cardBg="bg-white dark:bg-gray-900"
        iconBg="bg-amber-100 dark:bg-amber-900/30"
        iconColor="text-amber-600 dark:text-amber-400"
        loading={isLoading}
        lucroBruto={automotivos.lucroBruto}
        primary={{ label: 'Faturamento', value: formatCurrencyInt(automotivos.faturamento) }}
        secondary={{ label: 'Margem', value: fmtPct(automotivos.margem) }}
      />
      <SegmentCard
        label="Conveniência"
        Icon={Store}
        cardBg="bg-white dark:bg-gray-900"
        iconBg="bg-emerald-100 dark:bg-emerald-900/30"
        iconColor="text-emerald-600 dark:text-emerald-400"
        loading={isLoading}
        lucroBruto={conveniencia.lucroBruto}
        primary={{ label: 'Faturamento', value: formatCurrencyInt(conveniencia.faturamento) }}
        secondary={{ label: 'Margem', value: fmtPct(conveniencia.margem) }}
      />
      <SegmentCard
        label="Global"
        Icon={Globe}
        cardBg="bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900"
        iconBg="bg-violet-100 dark:bg-violet-900/30"
        iconColor="text-violet-600 dark:text-violet-400"
        loading={isLoading}
        lucroBruto={global.lucroBruto}
        primary={{ label: 'Faturamento', value: formatCurrencyInt(global.faturamento) }}
        secondary={{ label: 'Margem', value: fmtPct(global.margem) }}
      />

      {/* Projeção — tabela compacta (extrapolação linear até fim do mês) */}
      <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Projeção
              <span title="Estimativa de fechamento do mês por setor: extrapolação linear do realizado (dias decorridos → dias totais do mês). É uma projeção, não o valor final." className="cursor-help text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <HelpCircle className="h-3 w-3" />
              </span>
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Fim do mês</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
            <LineChart className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </div>
        </div>
        <table className="mt-3 w-full text-[11px]">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="py-1 font-medium">Setor</th>
              <th className="py-1 text-right font-medium">Faturamento</th>
              <th className="py-1 text-right font-medium">Lucro bruto</th>
              <th className="py-1 text-right font-medium">Margem</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 dark:text-gray-200">
            {projLinhas.map((r) => (
              <tr key={r.setor} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                <td className="py-1">{r.setor}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrencyInt(r.faturamento)}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrencyInt(r.lucroBruto)}</td>
                <td className="py-1 text-right tabular-nums">{fmtPct(r.margem)}</td>
              </tr>
            ))}
            <tr className="font-semibold text-gray-900 dark:text-gray-100">
              <td className="pt-1.5">Total</td>
              <td className="pt-1.5 text-right tabular-nums">{formatCurrencyInt(projTotal.faturamento)}</td>
              <td className="pt-1.5 text-right tabular-nums">{formatCurrencyInt(projTotal.lucroBruto)}</td>
              <td className="pt-1.5 text-right tabular-nums">{fmtPct(projTotal.margem)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ProjecoesPainel
