import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency, formatDate, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'

interface AlertaDataFuturaProps {
  inconsistencias: AbastecimentoRow[]
}

/**
 * Banner expansível que reporta abastecimentos com data fiscal futura.
 * Esses registros são erro de digitação no Quality (ex: alguém cria abast
 * com dataFiscal='2026-05-28' enquanto hoje é 17/05) — não entram nos
 * KPIs/agregados, mas aparecem separados pro consultor identificar e
 * corrigir na fonte.
 */
const AlertaDataFutura = ({ inconsistencias }: AlertaDataFuturaProps) => {
  const [expanded, setExpanded] = useState(false)

  if (inconsistencias.length === 0) return null

  const totalValor = inconsistencias.reduce((s, r) => s + r.valorTotal, 0)
  const totalLitros = inconsistencias.reduce((s, r) => s + r.litros, 0)

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/60 dark:border-amber-700/60 dark:bg-amber-900/20">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {inconsistencias.length} {inconsistencias.length === 1 ? 'abastecimento' : 'abastecimentos'} com data futura
          </p>
          <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-400/80">
            Provável erro de digitação no Quality · {formatLiters(totalLitros)} ·{' '}
            {formatCurrency(totalValor)} · não inclusos nos totais
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-amber-200 dark:border-amber-800/40">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-amber-100/40 dark:bg-amber-900/20">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-amber-900 dark:text-amber-200">Data</th>
                  <th className="px-3 py-2 text-left font-medium text-amber-900 dark:text-amber-200">Posto</th>
                  <th className="px-3 py-2 text-left font-medium text-amber-900 dark:text-amber-200">Frentista</th>
                  <th className="px-3 py-2 text-left font-medium text-amber-900 dark:text-amber-200">Bomba/Bico</th>
                  <th className="px-3 py-2 text-left font-medium text-amber-900 dark:text-amber-200">Combustível</th>
                  <th className="px-3 py-2 text-right font-medium text-amber-900 dark:text-amber-200">Litros</th>
                  <th className="px-3 py-2 text-right font-medium text-amber-900 dark:text-amber-200">Valor</th>
                  <th className="px-3 py-2 text-left font-medium text-amber-900 dark:text-amber-200">Placa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200/60 dark:divide-amber-800/30">
                {inconsistencias
                  .slice()
                  .sort((a, b) => b.dataHora.localeCompare(a.dataHora))
                  .map((r) => {
                    const day = r.dataHora.split('T')[0] || r.dataHora.slice(0, 10)
                    return (
                      <tr key={r.codigo} className={cn('hover:bg-amber-100/30 dark:hover:bg-amber-900/20')}>
                        <td className="px-3 py-2 font-medium tabular-nums text-amber-900 dark:text-amber-200">{formatDate(day)}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{r.empresaNome}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{r.frentistaNome}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{r.bombaDescricao}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{r.combustivelNome}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(r.litros)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(r.valorTotal)}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{r.placa}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-[11px] text-amber-700/70 dark:text-amber-400/70">
            Corrija na origem (Quality) — registros são reagregados na próxima apuração.
          </p>
        </div>
      )}
    </div>
  )
}

export default AlertaDataFutura
