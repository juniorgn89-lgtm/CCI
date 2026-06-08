import { LineChart, Info } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/formatters'

interface ProjecaoCardProps {
  /** Faturamento já realizado no período — usado pra calcular o "pra fechar". */
  realizadoFaturamento: number
  /** Faturamento projetado pro fim do período (saída do smoothedProjection). */
  projetadoFaturamento: number
  /** Lucro bruto realizado no período. Opcional — quando undefined, a seção
   * de lucro é omitida. */
  realizadoLucro?: number
  /** Lucro bruto projetado pro fim do período. Opcional — omite a seção. */
  projetadoLucro?: number
  /** Data final do período (ISO yyyy-mm-dd) pra exibir no hint. */
  dataFinal: string
  /** True quando o período tem dias futuros — quando false, valores ficam
   * riscados e mostramos info badge "valor = realizado". */
  isProjetada: boolean
  loading?: boolean
  /** Quando passado, renderiza como botão clicável (efeito hover sutil). */
  onClick?: () => void
}

/**
 * Card de Projeção fim do período — padrão visual único pra todas as telas
 * do módulo Comercial · Vendas (Visão Geral, Combustível, Pista, Conveniência).
 *
 * Layout:
 *   Projeção fim do período                            [📈]
 *   R$ X,XX                                                  ← faturamento projetado
 *   Faturamento estimado até DD/MM/AAAA
 *   + R$ Y pra fechar                                        ← delta verde (opcional)
 *   ─────────────
 *   Lucro bruto estimado                                     ← seção opcional
 *   R$ Z,ZZ                                M% margem
 *
 * Quando não há dias futuros (período fechado), valores ficam riscados e
 * aparece info badge no rodapé sinalizando que o valor é o realizado.
 */
const ProjecaoCard = ({
  realizadoFaturamento,
  projetadoFaturamento,
  realizadoLucro,
  projetadoLucro,
  dataFinal,
  isProjetada,
  loading = false,
  onClick,
}: ProjecaoCardProps) => {
  const showLucro = realizadoLucro !== undefined && projetadoLucro !== undefined
  const margemPct =
    projetadoFaturamento > 0 && projetadoLucro !== undefined
      ? (projetadoLucro / projetadoFaturamento) * 100
      : 0
  const deltaFat = projetadoFaturamento - realizadoFaturamento

  const Container = onClick ? 'button' : 'div'
  const containerProps = onClick
    ? { type: 'button' as const, onClick, className: cn(
        'block w-full text-left rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5',
      ) }
    : { className: 'rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] p-5 shadow-sm' }

  return (
    <Container {...containerProps}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/90">Projeção fim do período</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
          <LineChart className="h-5 w-5 text-white" />
        </div>
      </div>

      {loading ? (
        <Skeleton className="mt-2 h-8 w-32 bg-white/20" />
      ) : (
        <p className="mt-2 text-2xl font-bold tabular-nums text-white">
          {formatCurrency(projetadoFaturamento)}
        </p>
      )}

      <p className="mt-1 text-[11px] text-white/70">
        Faturamento estimado até {formatDate(dataFinal)}
      </p>

      {!loading && isProjetada && deltaFat > 0 && (
        <p className="mt-1 text-[11px] tabular-nums text-emerald-300">
          + {formatCurrency(deltaFat)} pra fechar
        </p>
      )}

      {showLucro && !loading && (
        <div className="mt-3 border-t border-white/15 pt-2">
          <p className="text-[11px] text-white/70">Lucro bruto estimado</p>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-base font-semibold tabular-nums text-white">
              {formatCurrency(projetadoLucro)}
            </p>
            <p className="text-[11px] tabular-nums text-white/70">
              {projetadoFaturamento > 0 ? `${margemPct.toFixed(0).replace('.', ',')}% margem` : '—'}
            </p>
          </div>
        </div>
      )}

      {!loading && !isProjetada && (
        <p className="mt-2 flex items-start gap-1 text-[10px] leading-snug text-white/70">
          <Info className="mt-px h-3 w-3 shrink-0" />
          Sem dias futuros — valor = realizado.
        </p>
      )}
    </Container>
  )
}

export default ProjecaoCard
