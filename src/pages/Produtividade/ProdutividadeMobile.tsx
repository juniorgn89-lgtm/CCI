import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Receipt, Trophy, Target } from 'lucide-react'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useMetasStore } from '@/store/metas'
import PostoLocalSelect from '@/components/filters/PostoLocalSelect'
import { buildScoreInputs, computeScores } from '@/lib/frentistaScore'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { KpiCard, Section, ScrollTabs, Segmented, Badge, ProgressBar, type Tone } from '@/components/mobile/primitives'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brl, brlShort, liters, variacaoPct } from '@/components/mobile/format'

const scoreTone = (s: number): Tone => (s >= 70 ? 'emerald' : s >= 40 ? 'amber' : 'rose')
const metaTone = (pct: number): Tone => (pct >= 100 ? 'emerald' : pct >= 70 ? 'amber' : 'rose')

type SortKey = 'litros' | 'score' | 'faturamento'

const TABS = [{ id: 'ranking', label: 'Ranking' }, { id: 'metas', label: 'Metas' }]

/**
 * Produtividade — versão mobile. Reusa useOperacaoData + useAbastecimentosAnalytics
 * (score) + useMetasStore. Abas: Ranking (frentistas ordenáveis) e Metas (meta vs
 * realizado por frentista — mês anterior ou manual). Mesmos números do desktop.
 */
const ProdutividadeMobile = () => {
  // Produtividade de frentista é por-posto → um posto por vez, com seletor.
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))
  const [activeCodigo, setActiveCodigo] = useState<number | null>(null)
  const postoCodes = postos.map((p) => p.codigo)
  const selectedCodigo = activeCodigo != null && postoCodes.includes(activeCodigo)
    ? activeCodigo
    : (postos[0]?.codigo ?? null)

  const { kpis, frentistaRows, frentistaRowsPrev, isLoading } = useOperacaoData(selectedCodigo)
  const { rows: abastComCusto } = useAbastecimentosAnalytics(selectedCodigo)
  const { manualMode, metas, setManualMode, setMeta } = useMetasStore()
  const [tab, setTab] = useState('ranking')
  const [sort, setSort] = useState<SortKey>('litros')

  const scores = useMemo(() => computeScores(buildScoreInputs(abastComCusto)), [abastComCusto])

  const ranking = useMemo(() => {
    const rows = frentistaRows
      .filter((f) => f.litrosVendidos > 0 || f.atendimentos > 0)
      .map((f) => ({
        codigo: f.funcionarioCodigo,
        nome: f.nome,
        ativo: f.ativo,
        litros: f.litrosVendidos,
        atendimentos: f.atendimentos,
        faturamento: f.faturamento,
        ticket: f.ticketMedio,
        score: scores.get(f.funcionarioCodigo)?.score ?? null,
      }))
    rows.sort((a, b) => {
      if (sort === 'score') return (b.score ?? -1) - (a.score ?? -1)
      if (sort === 'faturamento') return b.faturamento - a.faturamento
      return b.litros - a.litros
    })
    return rows
  }, [frentistaRows, scores, sort])

  // Metas: meta = mês anterior (auto) ou manual (store). pct = realizado ÷ meta.
  const prevByCodigo = useMemo(() => {
    const m = new Map<number, number>()
    for (const f of frentistaRowsPrev) m.set(f.funcionarioCodigo, f.litrosVendidos)
    return m
  }, [frentistaRowsPrev])

  const metasRows = useMemo(() => {
    return frentistaRows
      .filter((f) => f.ativo && (f.litrosVendidos > 0 || (prevByCodigo.get(f.funcionarioCodigo) ?? 0) > 0))
      .map((f) => {
        const metaAuto = prevByCodigo.get(f.funcionarioCodigo) ?? 0
        const metaAtual = manualMode ? (metas[f.funcionarioCodigo] ?? 0) : metaAuto
        const pct = metaAtual > 0 ? (f.litrosVendidos / metaAtual) * 100 : 0
        return { codigo: f.funcionarioCodigo, nome: f.nome, litros: f.litrosVendidos, metaAuto, metaAtual, pct }
      })
      .sort((a, b) => b.litros - a.litros)
  }, [frentistaRows, prevByCodigo, manualMode, metas])

  const postoTabs = postos.length > 1 ? (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      <PostoLocalSelect postos={postos} value={selectedCodigo} onChange={setActiveCodigo} />
    </div>
  ) : null

  const wrap = (inner: ReactNode) => (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Produtividade</h1>
      {postoTabs}
      {inner}
    </div>
  )

  if (postos.length === 0) return wrap(<EmptyCard title="Sem posto" desc="Nenhum posto disponível." />)
  if (isLoading || !kpis) return wrap(<LoadingScreen message="Carregando produtividade…" />)
  if (ranking.length === 0) return wrap(<EmptyCard title="Sem abastecimentos" desc="Não há abastecimentos no período e posto selecionados." />)

  const maxLitros = Math.max(...ranking.map((r) => r.litros), 0)
  const top = ranking[0]

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Produtividade</h1>
      {postoTabs}

      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Frentistas ativos" tone="blue" Icon={Users} value={formatNumber(kpis.frentistasAtivos)} />
        <KpiCard label="Abastecimentos" tone="navy" Icon={Receipt}
          value={formatNumber(kpis.totalAbastecimentos)} delta={variacaoPct(kpis.totalAbastecimentos, kpis.prevTotalAbastecimentos)} deltaLabel="mês ant." />
        <KpiCard label="Top frentista" tone="amber" Icon={Trophy} value={top ? liters(top.litros) : '—'} sub={top?.nome} />
      </div>

      <ScrollTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'ranking' ? (
        <>
          <Section Icon={Trophy} title="Ranking de frentistas" right={<Badge tone="navy">{ranking.length}</Badge>}>
            <Segmented
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: 'litros', label: 'Litros' },
                { value: 'faturamento', label: 'Faturamento' },
                { value: 'score', label: 'Score' },
              ]}
            />
          </Section>

          <Section Icon={Users} title="Frentistas" flush>
            <div className="divide-y divide-gray-100 dark:divide-[#303030]">
              {ranking.map((f, i) => (
                <div key={f.codigo} className="px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-center text-[12px] font-bold text-gray-400 dark:text-gray-500">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">
                        <span className="truncate">{f.nome}</span>
                        {!f.ativo && <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-gray-400 dark:bg-[#303030] dark:text-gray-500">inativo</span>}
                      </p>
                      <p className="text-[10.5px] tabular-nums text-gray-400 dark:text-gray-500">
                        {formatNumber(f.atendimentos)} abast. · {brlShort(f.faturamento)} · tkt {brl(f.ticket)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{liters(f.litros)}</span>
                      {f.score != null && <Badge tone={scoreTone(f.score)}>{Math.round(f.score)}</Badge>}
                    </div>
                  </div>
                  <div className={cn('mt-1.5', sort !== 'litros' && 'opacity-60')}>
                    <ProgressBar pct={maxLitros > 0 ? (f.litros / maxLitros) * 100 : 0} />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <p className="px-1 text-center text-[10px] text-gray-400 dark:text-gray-500">
            Score 0–100 combina lucro, automotivo, mix aditivada, ticket e nº de abastecimentos do período.
          </p>
        </>
      ) : (
        <>
          <Section Icon={Target} title="Origem das metas">
            <Segmented
              value={manualMode ? 'manual' : 'auto'}
              onChange={(v) => setManualMode(v === 'manual')}
              options={[
                { value: 'auto', label: 'Mês anterior' },
                { value: 'manual', label: 'Manual' },
              ]}
            />
            <p className="mt-2 text-[10.5px] text-gray-400 dark:text-gray-500">
              {manualMode ? 'Defina a meta de litros de cada frentista (salva neste aparelho).' : 'Meta = litros do mês anterior de cada frentista.'}
            </p>
          </Section>

          <Section Icon={Users} title="Metas por frentista" flush>
            <div className="divide-y divide-gray-100 dark:divide-[#303030]">
              {metasRows.map((m) => (
                <div key={m.codigo} className="px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{m.nome}</span>
                    {m.metaAtual > 0 ? <Badge tone={metaTone(m.pct)}>{m.pct.toFixed(2)}%</Badge> : <span className="text-[10px] text-gray-400">sem meta</span>}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                    <span>realizado <strong className="text-gray-900 dark:text-gray-100">{liters(m.litros)}</strong></span>
                    {manualMode ? (
                      <span className="inline-flex items-center gap-1">
                        meta
                        <input
                          type="number"
                          inputMode="numeric"
                          value={metas[m.codigo] ?? ''}
                          onChange={(e) => setMeta(m.codigo, Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-[12px] text-gray-900 focus:border-[#2563eb] focus:outline-none dark:border-[#3a3a3a] dark:bg-[#242424] dark:text-gray-100"
                        />
                        L
                      </span>
                    ) : (
                      <span>meta <strong className="text-gray-900 dark:text-gray-100">{m.metaAuto > 0 ? liters(m.metaAuto) : '—'}</strong></span>
                    )}
                  </div>
                  {m.metaAtual > 0 && (
                    <div className="mt-1.5"><ProgressBar pct={Math.min(100, m.pct)} color={m.pct >= 100 ? '#059669' : m.pct >= 70 ? '#d97706' : '#e11d48'} /></div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

export default ProdutividadeMobile
