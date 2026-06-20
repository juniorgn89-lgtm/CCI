import { useMemo, useState } from 'react'
import { ClipboardCheck, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import useCartaoBreakdown from '@/pages/FechamentoCaixa/hooks/useCartaoBreakdown'
import CartaoDetalheModal from '@/pages/FechamentoCaixa/components/CartaoDetalheModal'
import type { ConferenciaCaixa } from '@/pages/Operacao/hooks/useOperacaoData'

interface ConferenciaPdvProps {
  conferencia: ConferenciaCaixa[]
}

const fmtDate = (iso: string): string => (iso ? iso.split('-').reverse().join('/') : '-')

const pdvTone = (label: string): string =>
  label === 'Pista'
    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
    : label === 'Conveniência'
      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'

const diffClass = (v: number): string =>
  v < -0.005 ? 'text-red-600 dark:text-red-400' : v > 0.005 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'

const fmtDiff = (v: number): string => (Math.abs(v) < 0.005 ? '—' : `${v > 0 ? '+' : ''}${formatCurrencyInt(v)}`)

/** Larguras fixas compartilhadas entre a tabela de formas e o rodapé de total —
 *  garante que as colunas (e os totais) fiquem alinhados entre os cards. */
const Cols = () => (
  <colgroup>
    <col className="w-[34%]" />
    <col className="w-[22%]" />
    <col className="w-[22%]" />
    <col className="w-[22%]" />
  </colgroup>
)

const isCartao = (nome: string) => nome.toUpperCase().includes('CART')

/**
 * Conferência por PDV — espelha o "Fechamento de Caixa Apresentado" do webPosto:
 * por caixa/PDV, cada forma com Apresentado × Apurado × Diferença (tudo do mesmo
 * /CAIXA_APRESENTADO, então fecha por subtração). Clicar em "Cartão" abre o
 * detalhe por bandeira/débito/crédito (mesmo modal do Fechamento).
 */
const ConferenciaPdv = ({ conferencia }: ConferenciaPdvProps) => {
  const [cartaoCaixa, setCartaoCaixa] = useState<ConferenciaCaixa | null>(null)
  const pdvByCaixa = useMemo(
    () => (cartaoCaixa ? new Map([[cartaoCaixa.caixaCodigo, cartaoCaixa.pdvLabel]]) : new Map<number, string>()),
    [cartaoCaixa],
  )
  const cartao = useCartaoBreakdown(cartaoCaixa ? [cartaoCaixa.caixaCodigo] : [], pdvByCaixa, cartaoCaixa !== null)

  // Filtro por tipo de PDV (Pista / Conveniência) — igual à aba Turnos de Caixa.
  const [filterPdv, setFilterPdv] = useState<'todos' | 'pista' | 'conveniencia'>('todos')
  const lista = useMemo(
    () => conferencia.filter((c) =>
      filterPdv === 'todos'
        ? true
        : filterPdv === 'pista'
        ? c.pdvLabel === 'Pista'
        : c.pdvLabel === 'Conveniência',
    ),
    [conferencia, filterPdv],
  )

  if (conferencia.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-20 text-center dark:border-gray-700 dark:bg-gray-900">
        <ClipboardCheck className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sem dados de conferência no período</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          A conferência usa o apresentado por caixa (/CAIXA_APRESENTADO) — disponível em caixas fechados.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Filtro centralizado de tipo de turno: Pista × Conveniência */}
      <div className="mb-4 flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
          {([
            { id: 'todos', label: 'Todos' },
            { id: 'pista', label: 'Pista' },
            { id: 'conveniencia', label: 'Conveniência' },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterPdv(t.id)}
              className={cn(
                'rounded-lg px-5 py-1.5 text-xs font-medium transition-colors',
                filterPdv === t.id
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-900">
          Nenhum caixa de {filterPdv === 'pista' ? 'Pista' : 'Conveniência'} no período.
        </p>
      ) : (
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
        {lista.map((c) => (
          <section key={`${c.caixaCodigo}-${c.dataMovimento}`} className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.turno}</span>
              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', pdvTone(c.pdvLabel))}>
                {c.pdvLabel}
              </span>
              <span className="text-[11px] text-gray-400">#{c.caixaCodigo}</span>
              <span className="text-[11px] text-gray-400">· {fmtDate(c.dataMovimento)}</span>
              {c.responsavel && <span className="ml-auto truncate text-[11px] text-gray-500 dark:text-gray-400" title={c.responsavel}>{c.responsavel}</span>}
            </div>

            {/* Tabela de formas (cresce pra empurrar o total pro rodapé). */}
            <div className="flex-1 overflow-x-auto">
              <table className="w-full table-fixed text-xs">
                <Cols />
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Forma</th>
                    <th className="px-3 py-2 text-right font-medium">Apresentado</th>
                    <th className="px-3 py-2 text-right font-medium">Apurado</th>
                    <th className="px-3 py-2 text-right font-medium">Diferença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {c.formas.map((f) => {
                    const clickable = isCartao(f.nome)
                    return (
                      <tr
                        key={f.nome}
                        onClick={clickable ? () => setCartaoCaixa(c) : undefined}
                        className={cn('hover:bg-gray-50 dark:hover:bg-gray-800/50', clickable && 'cursor-pointer')}
                        title={clickable ? 'Ver débito/crédito por bandeira' : undefined}
                      >
                        <td className="truncate px-3 py-1.5 font-medium text-gray-900 dark:text-gray-100">
                          <span className="inline-flex items-center gap-1">
                            {f.nome}
                            {clickable && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-[9px] font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                                detalhar <ChevronRight className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(f.apresentado)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(f.apurado)}</td>
                        <td className={cn('px-3 py-1.5 text-right font-semibold tabular-nums', diffClass(f.diferenca))}>{fmtDiff(f.diferenca)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Rodapé de total — fixado no fim do card (alinha entre os cards). */}
            <table className="w-full table-fixed border-t-2 border-gray-200 text-xs dark:border-gray-700">
              <Cols />
              <tbody>
                <tr className="bg-gray-50 font-semibold dark:bg-gray-800/50">
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-200">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(c.totalApresentado)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(c.totalApurado)}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums', diffClass(c.totalDiferenca))}>{fmtDiff(c.totalDiferenca)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        ))}
      </div>
      )}

      <CartaoDetalheModal
        open={cartaoCaixa !== null}
        onClose={() => setCartaoCaixa(null)}
        linhas={cartao.linhas}
        total={cartao.total}
        pdvs={cartao.pdvs}
        isLoading={cartao.isLoading}
      />
    </>
  )
}

export default ConferenciaPdv
