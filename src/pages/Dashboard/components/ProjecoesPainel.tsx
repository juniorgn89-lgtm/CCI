import { Droplets, Wrench, Store, Globe, LineChart } from 'lucide-react'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { cn } from '@/lib/utils'

/* ─── Mock por segmento ────────────────────────────────────
 * Automotivos = produtos com tipo != C e centro de custo = PISTA.
 * Valores mockados — quando o backend fornecer breakdown por segmento, é só
 * trocar os literais por dados reais (a estrutura dos cards continua igual).
 * ────────────────────────────────────────────────────────── */
const segments = {
  combustivel: { lucroBruto: 562225, margem: 11.35, lucroPorLitro: 0.67 },
  automotivos: { lucroBruto: 103385, faturamento: 162613, margem: 63.58 },
  conveniencia: { lucroBruto: 166254, faturamento: 334167, margem: 49.75 },
  global: { lucroBruto: 831864, faturamento: 5450987, margem: 15.26 },
}

const projecaoLinhas = [
  { setor: 'Automotivos', faturamento: 210042, lucroBruto: 133539, margem: 63.58 },
  { setor: 'Combustível', faturamento: 6399183, lucroBruto: 726207, margem: 11.35 },
  { setor: 'Conveniência', faturamento: 431633, lucroBruto: 214745, margem: 49.75 },
]
const projecaoTotal = {
  faturamento: projecaoLinhas.reduce((s, r) => s + r.faturamento, 0),
  lucroBruto: projecaoLinhas.reduce((s, r) => s + r.lucroBruto, 0),
  margem: 15.26,
}

const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`

interface SegmentCardProps {
  label: string
  Icon: typeof Droplets
  cardBg: string
  iconBg: string
  iconColor: string
  lucroBruto: number
  primary?: { label: string; value: string }
  secondary?: { label: string; value: string }
}

const SegmentCard = ({ label, Icon, cardBg, iconBg, iconColor, lucroBruto, primary, secondary }: SegmentCardProps) => (
  <div
    className={cn(
      'flex flex-col rounded-xl border border-gray-200 p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-700',
      cardBg,
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">Lucro bruto</p>
      </div>
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
    </div>
    <p className="mt-3 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
      {formatCurrencyInt(lucroBruto)}
    </p>
    {(primary || secondary) && (
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        {primary && (
          <div>
            <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{primary.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{primary.label}</p>
          </div>
        )}
        {secondary && (
          <div>
            <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{secondary.value}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{secondary.label}</p>
          </div>
        )}
      </div>
    )}
  </div>
)

const ProjecoesPainel = () => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      <SegmentCard
        label="Combustível"
        Icon={Droplets}
        cardBg="bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        iconColor="text-blue-600 dark:text-blue-400"
        lucroBruto={segments.combustivel.lucroBruto}
        primary={{ label: 'Margem', value: fmtPct(segments.combustivel.margem) }}
        secondary={{ label: 'L. bruto / litro', value: formatCurrency(segments.combustivel.lucroPorLitro) }}
      />

      <SegmentCard
        label="Automotivos"
        Icon={Wrench}
        cardBg="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
        iconBg="bg-amber-100 dark:bg-amber-900/30"
        iconColor="text-amber-600 dark:text-amber-400"
        lucroBruto={segments.automotivos.lucroBruto}
        primary={{ label: 'Faturamento', value: formatCurrencyInt(segments.automotivos.faturamento) }}
        secondary={{ label: 'Margem', value: fmtPct(segments.automotivos.margem) }}
      />

      <SegmentCard
        label="Conveniência"
        Icon={Store}
        cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
        iconBg="bg-emerald-100 dark:bg-emerald-900/30"
        iconColor="text-emerald-600 dark:text-emerald-400"
        lucroBruto={segments.conveniencia.lucroBruto}
        primary={{ label: 'Faturamento', value: formatCurrencyInt(segments.conveniencia.faturamento) }}
        secondary={{ label: 'Margem', value: fmtPct(segments.conveniencia.margem) }}
      />

      <SegmentCard
        label="Global"
        Icon={Globe}
        cardBg="bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900"
        iconBg="bg-violet-100 dark:bg-violet-900/30"
        iconColor="text-violet-600 dark:text-violet-400"
        lucroBruto={segments.global.lucroBruto}
        primary={{ label: 'Faturamento', value: formatCurrencyInt(segments.global.faturamento) }}
        secondary={{ label: 'Margem', value: fmtPct(segments.global.margem) }}
      />

      {/* Projeção — tabela compacta */}
      <div className="flex flex-col rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50/60 to-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:from-slate-900/40 dark:to-gray-900">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Projeção</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Fim do período</p>
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
            {projecaoLinhas.map((r) => (
              <tr key={r.setor} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                <td className="py-1">{r.setor}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrencyInt(r.faturamento)}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrencyInt(r.lucroBruto)}</td>
                <td className="py-1 text-right tabular-nums">{fmtPct(r.margem)}</td>
              </tr>
            ))}
            <tr className="font-semibold text-gray-900 dark:text-gray-100">
              <td className="pt-1.5">Total</td>
              <td className="pt-1.5 text-right tabular-nums">{formatCurrencyInt(projecaoTotal.faturamento)}</td>
              <td className="pt-1.5 text-right tabular-nums">{formatCurrencyInt(projecaoTotal.lucroBruto)}</td>
              <td className="pt-1.5 text-right tabular-nums">{fmtPct(projecaoTotal.margem)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ProjecoesPainel
