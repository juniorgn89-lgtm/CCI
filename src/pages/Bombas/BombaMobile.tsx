import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gauge, Droplets, Activity, Trophy, ChevronDown } from 'lucide-react'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import PostoLocalSelect from '@/components/filters/PostoLocalSelect'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { KpiCard, Section, ProgressBar, Badge } from '@/components/mobile/primitives'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brl, brlShort, liters, litersShort, variacaoPct } from '@/components/mobile/format'

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</span>
  </div>
)

/**
 * Bombas — versão mobile. Reusa useOperacaoData (bombaRows). KPIs + ranking de
 * bombas por volume, com expand mostrando o detalhe por combustível e a ficha
 * (ilha/fabricante/modelo). Mesmos números do desktop.
 */
const BombaMobile = () => {
  // Bomba é por-posto → um posto por vez, com seletor quando o filtro tem mais.
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))
  const [activeCodigo, setActiveCodigo] = useState<number | null>(null)
  const postoCodes = postos.map((p) => p.codigo)
  const selectedCodigo = activeCodigo != null && postoCodes.includes(activeCodigo)
    ? activeCodigo
    : (postos[0]?.codigo ?? null)

  const { bombaRows, bombaRowsPrev, isLoading } = useOperacaoData(selectedCodigo)
  const [open, setOpen] = useState<number | null>(null)

  const stats = useMemo(() => {
    const ativas = [...bombaRows].filter((b) => b.abastecimentos > 0).sort((a, b) => b.litrosVendidos - a.litrosVendidos)
    const totalLitros = ativas.reduce((s, b) => s + b.litrosVendidos, 0)
    const totalAbast = ativas.reduce((s, b) => s + b.abastecimentos, 0)
    const totalLitrosPrev = bombaRowsPrev.reduce((s, b) => s + b.litrosVendidos, 0)
    const totalAbastPrev = bombaRowsPrev.reduce((s, b) => s + b.abastecimentos, 0)
    const maxLitros = Math.max(...ativas.map((b) => b.litrosVendidos), 0)
    return { ativas, totalLitros, totalAbast, totalLitrosPrev, totalAbastPrev, maxLitros, top: ativas[0] ?? null }
  }, [bombaRows, bombaRowsPrev])

  const postoTabs = postos.length > 1 ? (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      <PostoLocalSelect postos={postos} value={selectedCodigo} onChange={setActiveCodigo} />
    </div>
  ) : null

  if (postos.length === 0) return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Bombas</h1>
      <EmptyCard title="Sem posto" desc="Nenhum posto disponível." />
    </div>
  )
  if (isLoading) return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Bombas</h1>
      {postoTabs}
      <LoadingScreen message="Carregando bombas…" />
    </div>
  )
  if (stats.ativas.length === 0) return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Bombas</h1>
      {postoTabs}
      <EmptyCard title="Sem bombeamento" desc="Nenhuma bomba com abastecimentos no período." />
    </div>
  )

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Bombas</h1>
      {postoTabs}

      <div className="grid grid-cols-2 gap-2">
        <KpiCard span2 big label="Litros bombeados" tone="blue" Icon={Droplets}
          value={litersShort(stats.totalLitros)} delta={variacaoPct(stats.totalLitros, stats.totalLitrosPrev)} deltaLabel="mês ant." />
        <KpiCard label="Abastecimentos" tone="navy" Icon={Activity}
          value={formatNumber(stats.totalAbast)} delta={variacaoPct(stats.totalAbast, stats.totalAbastPrev)} deltaLabel="mês ant." />
        <KpiCard label="Bombas ativas" tone="emerald" Icon={Gauge} value={formatNumber(stats.ativas.length)} />
        {stats.top && (
          <KpiCard span2 label="Bomba destaque" tone="amber" Icon={Trophy}
            value={stats.top.descricao} sub={`${liters(stats.top.litrosVendidos)} · ${formatNumber(stats.top.abastecimentos)} abast.`} />
        )}
      </div>

      <Section Icon={Gauge} title="Ranking de bombas" right={<Badge tone="navy">{stats.ativas.length}</Badge>} flush>
        <div className="divide-y divide-gray-100 dark:divide-[#303030]">
          {stats.ativas.map((b, i) => {
            const expanded = open === b.bombaCodigo
            return (
              <div key={b.bombaCodigo}>
                <button type="button" onClick={() => setOpen(expanded ? null : b.bombaCodigo)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left active:bg-gray-50 dark:active:bg-white/5">
                  <span className="w-4 shrink-0 text-center text-[12px] font-bold text-gray-400 dark:text-gray-500">{i + 1}</span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', expanded && 'rotate-180')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{b.descricao}</p>
                    <p className="truncate text-[10.5px] text-gray-400 dark:text-gray-500">
                      {b.combustiveis.join(' · ') || `${b.quantidadeBicos} bicos`} · {formatNumber(b.abastecimentos)} abast.
                    </p>
                    <div className="mt-1"><ProgressBar pct={stats.maxLitros > 0 ? (b.litrosVendidos / stats.maxLitros) * 100 : 0} /></div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[12.5px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{litersShort(b.litrosVendidos)}</span>
                    <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">{brlShort(b.faturamento)}</span>
                  </div>
                </button>
                {expanded && (
                  <div className="space-y-3 bg-gray-50 px-3.5 pb-3.5 pt-1 dark:bg-[#1c1c1c]">
                    {b.combustiveisDetalhes.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Por combustível</p>
                        <div className="space-y-1.5">
                          {b.combustiveisDetalhes.map((c) => (
                            <div key={c.nome} className="flex items-center justify-between gap-2 text-[11.5px]">
                              <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{c.nome}</span>
                              <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{liters(c.litros)}</span>
                              <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{brl(c.faturamento)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px]">
                      <Detail label="Ilha" value={b.ilha ? String(b.ilha) : '—'} />
                      <Detail label="Bicos" value={String(b.quantidadeBicos)} />
                      <Detail label="Fabricante" value={b.fabricante || '—'} />
                      <Detail label="Modelo" value={b.modelo || '—'} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

export default BombaMobile
