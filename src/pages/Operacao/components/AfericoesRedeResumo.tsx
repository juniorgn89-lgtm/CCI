import { useMemo } from 'react'
import { FlaskConical, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLiters, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { buildAfericoesResumo } from '@/lib/afericoes'
import type { AfericaoRow } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'

interface Props {
  afericoes: AfericaoRow[]
  onOpenPosto: (codigo: number) => void
}

/**
 * Resumo rede-wide de aferições (teste de bomba) — quais postos tiveram saída de
 * teste no período, de relance, com realce âmbar no atípico. Cada posto é um chip
 * clicável que abre o modal daquele posto (detalhe por frentista/dia). Se esconde
 * sozinho quando não há aferição no período.
 */
const AfericoesRedeResumo = ({ afericoes, onOpenPosto }: Props) => {
  const resumo = useMemo(() => buildAfericoesResumo(afericoes), [afericoes])
  if (resumo.count === 0) return null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
          <FlaskConical className="h-4 w-4" />
        </span>
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Aferições · rede
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">informativo</span>
          {resumo.nAtipicos > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <TriangleAlert className="h-3 w-3" /> {resumo.nAtipicos} p/ revisar
            </span>
          )}
          <InfoHint text="Teste de bomba (INMETRO) — combustível que sai e não é venda. Vem do cache da apuração (só períodos re-apurados). Clique num posto pra ver o detalhe por frentista/dia. O realce âmbar é volume fora do padrão ou concentração alta." />
        </p>
        <span className="ml-auto text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
          {formatNumber(resumo.count)} aferições · {formatLiters(resumo.litros)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {resumo.porPosto.map((p) => (
          <button
            key={p.chave}
            type="button"
            onClick={() => onOpenPosto(Number(p.chave))}
            title="Abrir o detalhe deste posto"
            className={cn(
              'group inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-colors',
              p.atipico
                ? 'border-amber-300 bg-amber-50/60 hover:border-amber-400 dark:border-amber-500/40 dark:bg-amber-950/20 dark:hover:border-amber-400'
                : 'border-gray-200 bg-gray-50/60 hover:border-[#2563eb] dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-blue-500',
            )}
          >
            {p.atipico && <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-gray-800 group-hover:text-[#2563eb] dark:text-gray-200 dark:group-hover:text-blue-300">{p.nome}</span>
              <span className="block text-[10.5px] tabular-nums text-gray-400 dark:text-gray-500">
                {p.count} aferiç{p.count === 1 ? 'ão' : 'ões'} · {formatLiters(p.litros)}
                {p.atipico && <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">· revisar</span>}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default AfericoesRedeResumo
