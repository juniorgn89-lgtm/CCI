import { FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt, formatLiters } from '@/lib/formatters'
import type { ProjecaoSazonalPiloto as Piloto } from '@/pages/Comercial/Vendas/useProjecaoSazonalPiloto'

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface Props {
  piloto: Piloto
  /** Esperado da projeção ATUAL (projecaoAvancada) por métrica, pra comparar. */
  atual: { faturamento: number; litros: number; lucro: number }
}

const Linha = ({ label, atual, sazonal, fmt }: { label: string; atual: number; sazonal: number; fmt: (v: number) => string }) => {
  const delta = atual > 0 ? (sazonal / atual - 1) * 100 : 0
  return (
    <tr className="border-t border-gray-100 dark:border-gray-800">
      <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{label}</td>
      <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{fmt(atual)}</td>
      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-800 dark:text-gray-100">{fmt(sazonal)}</td>
      <td className={cn('px-3 py-1.5 text-right tabular-nums', Math.abs(delta) < 0.05 ? 'text-gray-400' : delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
        {delta >= 0 ? '+' : ''}{delta.toFixed(1).replace('.', ',')}%
      </td>
    </tr>
  )
}

/**
 * Painel de PILOTO (Fase 2) — compara a projeção ATUAL × SAZONAL no combustível.
 * Só aparece com a flag ligada; é ferramenta de validação, não vai pra produção.
 */
const ProjecaoSazonalPiloto = ({ piloto, atual }: Props) => {
  const idx = piloto.indices.faturamento
  if (piloto.isLoading) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-violet-300 bg-violet-50/40 px-4 py-3 text-[12px] text-violet-700 dark:border-violet-700/50 dark:bg-violet-950/15 dark:text-violet-300">
        Carregando histórico de 6 meses pra comparação…
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-xl border border-dashed border-violet-300 bg-violet-50/40 p-4 dark:border-violet-700/50 dark:bg-violet-950/15">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet-700 dark:text-violet-300">
          <FlaskConical className="h-3.5 w-3.5" /> Piloto · projeção sazonal
        </span>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
          piloto.linear ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300')}>
          {piloto.linear ? 'ramo linear (<90d)' : 'ramo ponderado'}
        </span>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          dias_operação ≈ {piloto.diasOperacao} · histórico {piloto.histDias} dias
        </span>
      </div>

      <div className="mt-2.5 overflow-hidden rounded-lg border border-violet-200/70 bg-white dark:border-violet-800/40 dark:bg-gray-900">
        <table className="w-full text-[12.5px]">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400 dark:bg-gray-800 dark:text-gray-500">
            <tr>
              <th className="px-3 py-1.5 text-left font-semibold">Métrica</th>
              <th className="px-3 py-1.5 text-right font-semibold">Atual (linear)</th>
              <th className="px-3 py-1.5 text-right font-semibold">Sazonal (proposto)</th>
              <th className="px-3 py-1.5 text-right font-semibold">Δ</th>
            </tr>
          </thead>
          <tbody>
            <Linha label="Faturamento" atual={atual.faturamento} sazonal={piloto.sazonal.faturamento.esperado} fmt={formatCurrencyInt} />
            <Linha label="Litros" atual={atual.litros} sazonal={piloto.sazonal.litros.esperado} fmt={(v) => `${formatLiters(v)}`} />
            <Linha label="Lucro bruto" atual={atual.lucro} sazonal={piloto.sazonal.lucro.esperado} fmt={formatCurrencyInt} />
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-gray-500 dark:text-gray-400">
        <span className="font-semibold text-gray-600 dark:text-gray-300">Índice (faturamento):</span>
        {DOW.map((d, w) => (
          <span key={d} className="tabular-nums">{d} {idx[w].toFixed(2).replace('.', ',')}</span>
        ))}
      </div>
    </div>
  )
}

export default ProjecaoSazonalPiloto
