import { Percent, TrendingUp, ShieldCheck, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import { Skeleton } from '@/components/ui/skeleton'
import InfoHint from '@/components/ui/InfoHint'
import type { TaxaBandeira } from '@/pages/Cartoes/hooks/useCartoesConciliacao'

/** Tolerância de "confere": abaixo disso (R$) tratamos como arredondamento. */
const TOL = 1.0
const fmtPct = (v: number) => `${v.toFixed(3).replace('.', ',')}%`
const signed = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${formatCurrencyInt(Math.abs(v))}`

interface Props {
  taxas: TaxaBandeira[]
  temRemessa: boolean
  isLoading: boolean
}

/**
 * Detector de sobrecobrança de adquirência. Cruza a taxa EFETIVA (o que o
 * adquirente descontou = Σ taxasDespesas ÷ Σ valorRemessa do repasse) com a taxa
 * de CONTRATO (percentualComissao + tarifa fixa/transação do cadastro), por
 * bandeira. Δ > 0 = você pagou mais do que o contrato prevê. Read-only.
 */
const TaxasTab = ({ taxas, temRemessa, isLoading }: Props) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (!temRemessa || taxas.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
        Sem repasse do adquirente (EDI) no período — sem base pra calcular a taxa efetiva.
      </div>
    )
  }

  const totalBruto = taxas.reduce((s, t) => s + t.bruto, 0)
  const totalPaga = taxas.reduce((s, t) => s + t.taxaPaga, 0)
  const totalAcima = taxas.reduce((s, t) => s + Math.max(0, t.deltaRs), 0)
  const nAcima = taxas.filter((t) => t.deltaRs > TOL).length
  const efetivaMedia = totalBruto > 0 ? (totalPaga / totalBruto) * 100 : 0
  const acimaDoContrato = totalAcima > TOL

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Hero — custo total de adquirência */}
        <div className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#27496f] p-5 text-white shadow-lg">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/70">
            <Percent className="h-3.5 w-3.5" /> Custo de adquirência
          </p>
          <p className="mt-2 text-[32px] font-extrabold tabular-nums leading-none">{formatCurrencyInt(totalPaga)}</p>
          <p className="mt-2 text-[13px] text-white/75">
            sobre <span className="tabular-nums">{formatCurrencyInt(totalBruto)}</span> repassados · taxa média <span className="font-semibold tabular-nums text-emerald-300">{fmtPct(efetivaMedia)}</span>
          </p>
        </div>

        {/* vs contrato */}
        <div className={cn('rounded-2xl border p-5', acimaDoContrato
          ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
          : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20')}>
          <p className={cn('inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider',
            acimaDoContrato ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
            {acimaDoContrato ? <TrendingUp className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {acimaDoContrato ? 'Acima do contrato' : 'Dentro do contrato'}
          </p>
          <p className={cn('mt-2 text-[32px] font-extrabold tabular-nums leading-none',
            acimaDoContrato ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300')}>
            {acimaDoContrato ? signed(totalAcima) : 'R$ 0'}
          </p>
          <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
            {acimaDoContrato
              ? <>pago a mais do que o contrato em <strong>{nAcima}</strong> bandeira{nAcima === 1 ? '' : 's'}</>
              : 'a taxa efetiva bate com o contratado'}
          </p>
        </div>

        {/* Bandeiras */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Bandeiras repassadas
          </p>
          <p className="mt-2 text-[32px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-gray-100">{taxas.length}</p>
          <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
            {taxas.length - nAcima} conferem · {nAcima} acima
          </p>
        </div>
      </div>

      {/* Tabela por bandeira */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:text-gray-500">
                <th className="px-4 py-2.5 font-semibold">Bandeira</th>
                <th className="px-3 py-2.5 text-right font-semibold">Bruto repassado</th>
                <th className="px-3 py-2.5 text-right font-semibold">Taxa paga</th>
                <th className="px-3 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center justify-end gap-1">Efetiva<InfoHint text="Taxa que o adquirente realmente descontou = soma das despesas do repasse ÷ bruto repassado no período." /></span>
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center justify-end gap-1">Contrato<InfoHint text="Taxa contratada da bandeira (percentualComissao do cadastro) + tarifa fixa por transação, quando houver." /></span>
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center justify-end gap-1">Δ vs contrato<InfoHint text="Taxa paga − custo esperado pelo contrato. Positivo (vermelho) = você pagou a mais do que o contratado no período." /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {taxas.map((t) => {
                const acima = t.deltaRs > TOL
                const abaixo = t.deltaRs < -TOL
                return (
                  <tr key={t.administradoraCodigo} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-800 dark:text-gray-100">{t.bandeira}</span>
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">{t.tipo || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatCurrencyInt(t.bruto)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatCurrencyInt(t.taxaPaga)}</td>
                    <td className={cn('px-3 py-2.5 text-right font-semibold tabular-nums',
                      acima ? 'text-red-600 dark:text-red-400' : abaixo ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200')}>
                      {fmtPct(t.efetivaPct)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{fmtPct(t.contratoPct)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums',
                        acima ? 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300'
                        : abaixo ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300')}>
                        {acima ? signed(t.deltaRs) : abaixo ? signed(t.deltaRs) : 'confere'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nota honesta */}
      <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-gray-400 dark:text-gray-500">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span>
          A taxa efetiva vem do repasse real do adquirente (EDI). O contrato é o cadastro do posto. Um Δ positivo no <strong>crédito</strong>
          {' '}pode ser antecipação ou parcelamento (que têm taxa maior que a base à vista) — vale conferir o extrato da bandeira antes de cobrar o adquirente. No <strong>débito</strong> o Δ é praticamente definitivo.
        </span>
      </p>
    </div>
  )
}

export default TaxasTab
