import { ShieldCheck, Fuel, Info } from 'lucide-react'
import useComplianceVisaoGeral from '@/pages/Compliance/hooks/useComplianceVisaoGeral'
import type { StatusFaixa } from '@/pages/Compliance/hooks/useComplianceMargens'
import { Section } from '@/components/mobile/primitives'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

/**
 * Compliance ANP — versão mobile (overview). Reusa `useComplianceVisaoGeral`
 * (mesmas queryKeys do desktop → cache compartilhado). Mostra o resumo
 * semaforizado do panorama + a margem regulatória por posto/combustível em
 * cards. O detalhe (CMP, placa vigente, histórico 365d, log de troca) e as
 * justificativas de reajuste ficam no desktop — igual QualidadeMobile.
 */

// Mesmas cores do semáforo do desktop (STATUS_META em Compliance/index).
const STATUS_META: Record<StatusFaixa, { label: string; dot: string; rank: number }> = {
  verde: { label: 'Verde', dot: 'bg-emerald-500', rank: 0 },
  amarelo: { label: 'Amarelo', dot: 'bg-amber-500', rank: 1 },
  laranja: { label: 'Laranja', dot: 'bg-orange-500', rank: 2 },
  vermelho: { label: 'Vermelho', dot: 'bg-red-500', rank: 3 },
}
const FAIXAS: StatusFaixa[] = ['vermelho', 'laranja', 'amarelo', 'verde']
const pct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`

const ComplianceMobile = () => {
  const { postos, resumo, isLoading, error } = useComplianceVisaoGeral()

  const Header = (
    <div>
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Compliance ANP</h1>
      <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">Margem regulatória (placa − CMP) por posto e combustível.</p>
    </div>
  )

  if (isLoading) return <div className="space-y-3 pb-2">{Header}<LoadingScreen message="Calculando margens…" /></div>
  if (error) return <div className="space-y-3 pb-2">{Header}<EmptyCard title="Erro" desc="Não foi possível carregar o compliance." /></div>

  const postosComDado = postos.filter((p) => [...p.fuels.values()].some((c) => c.margem !== null || c.status !== null))
  if (postosComDado.length === 0) {
    return <div className="space-y-3 pb-2">{Header}<EmptyCard title="Sem dados no período" desc="Sem compras ou trocas de preço no período e escopo selecionados." /></div>
  }

  return (
    <div className="space-y-3 pb-2">
      {Header}

      {/* Disclaimer — mesma postura do desktop (não é número oficial). */}
      <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] leading-snug text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Estimativa (não é número oficial): placa = preço à vista da última troca; margem = placa − CMP do período.
      </p>

      {/* Resumo — panorama semaforizado (answer-first). */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          <ShieldCheck className="h-3.5 w-3.5" /> Panorama · {resumo.total} {resumo.total === 1 ? 'célula' : 'células'}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {FAIXAS.map((s) => (
            <div key={s} className="flex flex-col items-center gap-1 rounded-lg bg-gray-50 py-2 dark:bg-gray-800/40">
              <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_META[s].dot)} />
              <span className="text-[16px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{resumo[s]}</span>
              <span className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{STATUS_META[s].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Por posto — células por combustível, pior status primeiro. */}
      {postosComDado.map((posto) => {
        const cells = [...posto.fuels.values()]
          .filter((c) => c.margem !== null || c.status !== null)
          .sort((a, b) =>
            (b.status ? STATUS_META[b.status].rank : -1) - (a.status ? STATUS_META[a.status].rank : -1)
            || a.nome.localeCompare(b.nome),
          )
        return (
          <Section key={posto.empresaCodigo} Icon={Fuel} title={posto.nome} flush>
            <div className="divide-y divide-gray-100 dark:divide-[#303030]">
              {cells.map((c) => (
                <div key={c.produtoCodigo} className="flex items-center gap-2 px-3.5 py-2.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', c.status ? STATUS_META[c.status].dot : 'bg-gray-300 dark:bg-gray-600')} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{c.nome}</span>
                  <div className="shrink-0 text-right">
                    <div className="text-[13px] font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {c.margem !== null ? `${formatCurrency(c.margem)}/L` : '—'}
                    </div>
                    <div className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                      {c.margemPct !== null ? `margem ${pct(c.margemPct)}` : 'sem placa/CMP'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )
      })}

      <p className="px-1 text-center text-[10px] text-gray-400 dark:text-gray-500">
        CMP, placa vigente, histórico 365d e justificativas de reajuste na versão desktop.
      </p>
    </div>
  )
}

export default ComplianceMobile
