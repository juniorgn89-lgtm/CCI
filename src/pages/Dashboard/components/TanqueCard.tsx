import { ShoppingCart, TrendingDown } from 'lucide-react'
import { formatCurrency, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'

/** dd/MM/yy compacto pra a data da última compra. */
const fmtDateShort = (iso: string): string => {
  if (!iso || iso.length < 10) return iso
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/**
 * Card de um tanque: nível + última compra + projeção de necessidade.
 * Borda cinza neutra (mesma dos cards de bomba) — a severidade aparece no
 * badge e na cor da barra. Usa `h-full` pra alinhar alturas em grid/carrossel.
 */
const TanqueCard = ({ t, subtitle }: { t: ReabastTanque; subtitle?: string }) => {
  const barColor =
    t.nivel === 'critico' ? 'bg-red-500' :
    t.nivel === 'alerta' ? 'bg-amber-500' :
    'bg-emerald-500'
  const textColor =
    t.nivel === 'critico' ? 'text-red-600 dark:text-red-400' :
    t.nivel === 'alerta' ? 'text-amber-700 dark:text-amber-400' :
    'text-emerald-700 dark:text-emerald-400'
  const badge =
    t.nivel === 'critico' ? { label: 'Crítico', bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' } :
    t.nivel === 'alerta' ? { label: 'Alerta', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' } :
    { label: 'OK', bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' }

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
      {/* Header: tanque + produto + badge */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
            {t.tanqueNome}
          </p>
          <p className="truncate text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {subtitle ?? t.produtoNome}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
            badge.bg,
          )}
        >
          {badge.label}
        </span>
      </div>

      {/* Nível: barra + % */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={cn('h-1.5 rounded-full transition-all', barColor)}
            style={{ width: `${Math.max(2, Math.min(100, t.nivelPct))}%` }}
          />
        </div>
        <span className={cn('shrink-0 text-xs font-semibold tabular-nums', textColor)}>
          {t.nivelPct.toFixed(0)}%
        </span>
      </div>
      <p className="mt-1 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
        {formatLiters(t.estoqueAtual)} de {formatLiters(t.capacidade)}
      </p>

      {/* Rodapé: última compra + necessidade — fixado embaixo (mt-auto) pra
          os cards ficarem alinhados mesmo com conteúdos diferentes. */}
      {(t.ultimaCompra || t.necessidadeFimDoMes > 0) && (
        <div className="mt-auto flex flex-col gap-1.5 border-t border-gray-100 pt-2.5 text-[11px] dark:border-gray-800">
          {t.ultimaCompra && (
            <span className="inline-flex items-start gap-1 text-gray-600 dark:text-gray-400">
              <ShoppingCart className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" />
              <span>
                Última compra:{' '}
                <span className="whitespace-nowrap font-medium tabular-nums text-gray-800 dark:text-gray-200">
                  {formatLiters(t.ultimaCompra.volume)}
                </span>
                {' '}em{' '}
                <span className="tabular-nums">{fmtDateShort(t.ultimaCompra.data)}</span>
                {t.ultimaCompra.valorEstimado > 0 && (
                  <> · <span className="tabular-nums" title="Estimado: volume × preço de custo do dia">
                    {formatCurrency(t.ultimaCompra.valorEstimado)}
                  </span></>
                )}
              </span>
            </span>
          )}
          {t.necessidadeFimDoMes > 0 && (
            <span
              className="inline-flex items-start gap-1 text-blue-700 dark:text-blue-400"
              title="Projeção: consumo médio diário × dias restantes do mês − estoque atual"
            >
              <TrendingDown className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                Comprar até fim do mês:{' '}
                <span className="whitespace-nowrap font-semibold tabular-nums">
                  {formatLiters(t.necessidadeFimDoMes)}
                </span>
                {t.diasRestantes != null && (
                  <span className="mt-0.5 block text-[10px] text-blue-600/70 dark:text-blue-400/70">
                    (estoque cobre ~{t.diasRestantes} {t.diasRestantes === 1 ? 'dia' : 'dias'})
                  </span>
                )}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default TanqueCard
