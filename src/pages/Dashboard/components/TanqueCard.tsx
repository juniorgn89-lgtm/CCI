import { ShoppingCart, TrendingDown, Info } from 'lucide-react'
import { formatCurrency, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'

/** dd/MM/yy compacto pra a data da última compra. */
const fmtDateShort = (iso: string): string => {
  if (!iso || iso.length < 10) return iso
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/** Nº aproximado de entregas: sugestão ÷ capacidade do tanque. */
const calcEntregas = (sugestao: number, capacidade: number): number =>
  sugestao > 0 && capacidade > 0 ? Math.ceil(sugestao / capacidade) : 0

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
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
      {/* Header: tanque + produto + badge */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">
            {t.tanqueNome}
          </p>
          <p className="truncate text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {subtitle ?? t.produtoNome}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
            badge.bg,
          )}
        >
          {badge.label}
        </span>
      </div>

      {/* Nível: barra + % em destaque (hero do card) */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={cn('h-2 rounded-full transition-all', barColor)}
            style={{ width: `${Math.max(2, Math.min(100, t.nivelPct))}%` }}
          />
        </div>
        <span className={cn('shrink-0 text-xl font-bold tabular-nums', textColor)}>
          {t.nivelPct.toFixed(0)}%
        </span>
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {formatLiters(t.estoqueAtual)} de {formatLiters(t.capacidade)}
      </p>

      {/* Rodapé: última compra + necessidade — fixado embaixo (mt-auto) pra
          os cards ficarem alinhados mesmo com conteúdos diferentes. */}
      <div className="mt-auto flex flex-col gap-1.5 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
        {t.ultimaCompra ? (
          <span className="inline-flex items-start gap-1 text-gray-600 dark:text-gray-400">
            <ShoppingCart className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
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
        ) : (
          <span
            className="inline-flex items-start gap-1 italic text-gray-400 dark:text-gray-500"
            title="Não houve entrada de nota fiscal pra esse produto/posto no período selecionado."
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Sem compras no período
          </span>
        )}
        {t.necessidadeFimDoMes > 0 ? (() => {
            const entregas = calcEntregas(t.necessidadeFimDoMes, t.capacidade)
            return (
              <span
                className="inline-flex items-start gap-1 text-blue-700 dark:text-blue-400"
                title="Projeção: consumo médio diário × dias restantes do mês − estoque atual"
              >
                <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Comprar até fim do mês:{' '}
                  <span className="whitespace-nowrap font-semibold tabular-nums">
                    {formatLiters(t.necessidadeFimDoMes)}
                  </span>
                  {entregas > 0 && (
                    <> · <span className="tabular-nums" title="Nº aproximado de entregas (sugestão ÷ capacidade do tanque)">
                      {entregas} {entregas === 1 ? 'entrega' : 'entregas'}
                    </span></>
                  )}
                  {t.diasRestantes != null && (
                    <span className="mt-0.5 block text-[11px] text-blue-600/70 dark:text-blue-400/70">
                      (estoque cobre ~{t.diasRestantes} {t.diasRestantes === 1 ? 'dia' : 'dias'})
                    </span>
                  )}
                </span>
              </span>
            )
          })() : (
            <span
              className="inline-flex items-start gap-1 italic text-gray-400 dark:text-gray-500"
              title="Sem consumo registrado no período — sistema não consegue projetar necessidade."
            >
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Sem movimentação no período
            </span>
          )}
        </div>
    </div>
  )
}

export default TanqueCard
