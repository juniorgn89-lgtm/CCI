import { Droplets, Wrench, Store, Globe, LineChart } from 'lucide-react'
import { formatCurrency, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import InfoHint from '@/components/ui/InfoHint'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import { monthEndFactor } from '@/lib/projection'

const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`

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
          <InfoHint text="Faturamento − Custo dos produtos vendidos, somando todos os postos da rede. Não inclui despesas operacionais." />
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
    <div className="mt-3 flex items-start justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{primary.value}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{primary.label}</p>
      </div>
      <div className="min-w-0 text-right">
        <p className="truncate text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{secondary.value}</p>
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
  // `volume` = litros no Combustível e quantidade (unidades) em Automotivos/Conveniência.
  const f = monthEndFactor(dataInicial, dataFinal)
  const projLinhas = [
    { setor: 'Combustível', volume: combustivel.qtd * f, faturamento: combustivel.faturamento * f, lucroBruto: combustivel.lucroBruto * f, margem: combustivel.margem },
    { setor: 'Automotivos', volume: automotivos.qtd * f, faturamento: automotivos.faturamento * f, lucroBruto: automotivos.lucroBruto * f, margem: automotivos.margem },
    { setor: 'Conveniência', volume: conveniencia.qtd * f, faturamento: conveniencia.faturamento * f, lucroBruto: conveniencia.lucroBruto * f, margem: conveniencia.margem },
  ]
  const projTotal = {
    // Total de volume é misto (litros + unidades) → não soma (mostra "—").
    faturamento: projLinhas.reduce((s, r) => s + r.faturamento, 0),
    lucroBruto: projLinhas.reduce((s, r) => s + r.lucroBruto, 0),
    margem: global.margem,
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
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

      {/* Projeção — tabela compacta (extrapolação linear até fim do mês).
          Mais larga (2 colunas) e no gradiente navy→azul da Projeção de Vendas. */}
      <div className="flex flex-col rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] p-5 text-left shadow-sm xl:col-span-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-white">
              Projeção
              <InfoHint
                text="Estimativa de fechamento do mês por setor: extrapolação linear do realizado (dias decorridos → dias totais do mês). É uma projeção, não o valor final."
                className="text-white/60 hover:text-white dark:text-white/60 dark:hover:text-white"
              />
            </p>
            <p className="text-[11px] text-white/70">Fim do mês</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <LineChart className="h-5 w-5 text-white" />
          </div>
        </div>
        <table className="mt-3 w-full text-[11px]">
          <thead>
            <tr className="border-b border-white/20 text-left text-white/60">
              <th className="py-1 font-medium">Setor</th>
              <th className="py-1 text-right font-medium">Litros/Qtde</th>
              <th className="py-1 text-right font-medium">Faturamento</th>
              <th className="py-1 text-right font-medium">Lucro bruto</th>
              <th className="py-1 text-right font-medium">Margem</th>
            </tr>
          </thead>
          <tbody className="text-white/90">
            {projLinhas.map((r) => (
              <tr key={r.setor} className="border-b border-white/10 last:border-b-0">
                <td className="py-1">{r.setor}</td>
                <td className="py-1 text-right tabular-nums">{formatNumber(Math.round(r.volume))}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrencyInt(r.faturamento)}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrencyInt(r.lucroBruto)}</td>
                <td className="py-1 text-right tabular-nums">{fmtPct(r.margem)}</td>
              </tr>
            ))}
            <tr className="font-semibold text-white">
              <td className="pt-1.5">Total</td>
              <td className="pt-1.5 text-right tabular-nums text-white/50">—</td>
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
