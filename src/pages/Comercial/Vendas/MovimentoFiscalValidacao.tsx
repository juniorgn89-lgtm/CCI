import { useState } from 'react'
import { CheckCircle2, AlertTriangle, ChevronDown, GitCompareArrows } from 'lucide-react'
import useFuelMovimentoValidacao from '@/pages/Operacao/hooks/useFuelMovimentoValidacao'
import { formatNumber, formatCurrencyInt } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { cn } from '@/lib/utils'

/** Tolerância só pra ruído de ponto flutuante — NÃO é banda. Modo rigoroso:
 *  qualquer litro real não-fiscal (≥ 1 mL) já acende o alerta. */
const EPS = 0.001

const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`
const litrosFmt = (v: number): string => `${formatNumber(Math.round(v))} L`

interface MetricProps {
  label: string
  mov: number
  fis: number
  format: (v: number) => string
}

const Metric = ({ label, mov, fis, format }: MetricProps) => {
  const diff = mov - fis
  const pct = mov > 0 ? (diff / mov) * 100 : 0
  const hasGap = diff >= EPS
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-1.5 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">Movimento</span>
          <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{format(mov)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">Fiscal</span>
          <span className="text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-300">{format(fis)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-t border-gray-100 pt-1 dark:border-gray-800">
          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">Δ não-fiscal</span>
          <span className={cn('text-sm font-bold tabular-nums', hasGap ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500')}>
            {format(diff)} <span className="text-[11px] font-medium">({fmtPct(pct)})</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Selo de SAÚDE FISCAL do combustível (ao vivo, por posto). Colapsado mostra,
 * numa linha só, se TODO o movimento de venda (não-cancelado) virou documento
 * fiscal (autorizado). Modo rigoroso: verde só com gap zero; qualquer litro
 * não-fiscal acende vermelho e libera o detalhe (tabela por combustível).
 *
 * Fonte: `useFuelMovimentoValidacao` (live `/VENDA_ITEM` + `/VENDA` A e C). NÃO
 * usa cache — por isso exige 1 posto selecionado (rede-wide ao vivo seria pesado).
 */
const MovimentoFiscalValidacao = () => {
  const { hasEmpresa, isLoading, movimento, fiscal, porFuel } = useFuelMovimentoValidacao()
  const [expanded, setExpanded] = useState(false)

  // Só aparece com EXATAMENTE 1 posto (hasEmpresa já = length === 1). Com a rede
  // toda ou mais de um posto, some por completo (sem o aviso "selecione 1 posto").
  if (!hasEmpresa) return null

  const gapLitros = movimento.litros - fiscal.litros
  const gapPct = movimento.litros > 0 ? (gapLitros / movimento.litros) * 100 : 0
  const hasGap = gapLitros >= EPS
  const ready = hasEmpresa && !isLoading
  const canExpand = ready // verde também abre, se quiser conferir o detalhe

  // ── Linha-selo (sempre visível) ──
  const seal = (() => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <GitCompareArrows className="h-4 w-4 shrink-0 animate-pulse" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Movimento × Fiscal</span>
          <span className="text-sm">· Verificando ao vivo…</span>
        </div>
      )
    }
    if (hasGap) {
      return (
        <div className="flex w-full items-center gap-2 text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <span className="text-sm font-medium">Movimento × Fiscal</span>
          <span className="text-sm font-semibold">
            · {litrosFmt(gapLitros)} ({fmtPct(gapPct)}) não viraram documento fiscal
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium">
            ver detalhes
            <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
          </span>
        </div>
      )
    }
    return (
      <div className="flex w-full items-center gap-2 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm font-medium">Movimento × Fiscal</span>
        <span className="text-sm">· Tudo que movimentou virou documento fiscal</span>
        <ChevronDown className={cn('ml-auto h-4 w-4 text-gray-400 transition-transform dark:text-gray-500', expanded && 'rotate-180')} />
      </div>
    )
  })()

  const borderTone = !ready
    ? 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30'
    : hasGap
      ? 'border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20'
      : 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20'

  return (
    <section className={cn('rounded-xl border', borderTone)}>
      <div className="flex items-center px-4 py-2.5">
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center text-left"
            aria-expanded={expanded}
          >
            {seal}
          </button>
        ) : (
          <div className="flex w-full items-center">{seal}</div>
        )}
        <InfoHint
          side="left"
          className="ml-2 shrink-0"
          text="Movimento = vendas de combustível NÃO-canceladas (autorizadas + pendentes/contingência). Fiscal = só as autorizadas (situação A). Verde rigoroso = gap exatamente zero. Cálculo ao vivo (não usa cache) para o posto selecionado."
        />
      </div>

      {expanded && ready && (
        <div className="border-t border-gray-200/70 px-4 py-4 dark:border-gray-700/70">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric label="Litros" mov={movimento.litros} fis={fiscal.litros} format={litrosFmt} />
            <Metric label="Faturamento" mov={movimento.faturamento} fis={fiscal.faturamento} format={formatCurrencyInt} />
            <Metric label="Cupons" mov={movimento.cupons} fis={fiscal.cupons} format={(v) => formatNumber(Math.round(v))} />
          </div>

          {porFuel.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="px-2 py-1.5 text-left font-medium">Combustível</th>
                    <th className="px-2 py-1.5 text-right font-medium">Movimento (L)</th>
                    <th className="px-2 py-1.5 text-right font-medium">Fiscal (L)</th>
                    <th className="px-2 py-1.5 text-right font-medium">Δ (L)</th>
                    <th className="px-2 py-1.5 text-right font-medium">Δ %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {porFuel.map((f) => {
                    const diff = f.movLitros - f.fisLitros
                    const pct = f.movLitros > 0 ? (diff / f.movLitros) * 100 : 0
                    const rowGap = diff >= EPS
                    return (
                      <tr key={f.nome}>
                        <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{f.nome}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(Math.round(f.movLitros))}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatNumber(Math.round(f.fisLitros))}</td>
                        <td className={cn('px-2 py-1.5 text-right tabular-nums font-medium', rowGap ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500')}>{formatNumber(Math.round(diff))}</td>
                        <td className={cn('px-2 py-1.5 text-right tabular-nums', rowGap ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500')}>{fmtPct(pct)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
            Conferência ao vivo do posto selecionado · base fiscal = vendas autorizadas (situação A).
          </p>
        </div>
      )}
    </section>
  )
}

export default MovimentoFiscalValidacao
