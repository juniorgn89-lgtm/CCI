import { useMemo, useState } from 'react'
import { Users, Receipt, Gauge, Trophy } from 'lucide-react'
import useOperacaoData, { type AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import { buildScoreInputs, computeScores } from '@/lib/frentistaScore'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { KpiCard, Section, Segmented, Badge, ProgressBar } from '@/components/mobile/primitives'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brl, brlShort, liters, variacaoPct } from '@/components/mobile/format'

/** Abast/hora ativa — mede utilização durante o expediente real (= desktop). */
const ritmoPorHoraAtiva = (rows: AbastecimentoRow[]): number => {
  if (rows.length === 0) return 0
  const horas = new Set<number>()
  for (const a of rows) {
    const h = parseInt(a.dataHora?.substring(11, 13) || '', 10)
    if (!isNaN(h)) horas.add(h)
  }
  return horas.size === 0 ? 0 : rows.length / horas.size
}

const scoreTone = (s: number) => (s >= 70 ? 'emerald' : s >= 40 ? 'amber' : 'rose')

type SortKey = 'litros' | 'score' | 'faturamento'

/**
 * Produtividade — versão mobile. Reusa useOperacaoData (frentistaRows) +
 * useAbastecimentosAnalytics (custo p/ score). KPIs + ranking de frentistas
 * ordenável (litros / score / faturamento). Mesmos números do desktop.
 */
const ProdutividadeMobile = () => {
  const { kpis, frentistaRows, abastecimentoRows, isLoading, hasEmpresa } = useOperacaoData()
  const { rows: abastComCusto } = useAbastecimentosAnalytics()
  const [sort, setSort] = useState<SortKey>('litros')

  const scores = useMemo(() => computeScores(buildScoreInputs(abastComCusto)), [abastComCusto])
  const ritmo = useMemo(() => ritmoPorHoraAtiva(abastecimentoRows), [abastecimentoRows])

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

  if (!hasEmpresa) return <EmptyCard title="Selecione um posto" desc="Escolha um posto no filtro pra ver a produtividade dos frentistas." />
  if (isLoading || !kpis) return <LoadingScreen message="Carregando produtividade…" />
  if (ranking.length === 0) return <EmptyCard title="Sem abastecimentos" desc="Não há abastecimentos no período e posto selecionados." />

  const maxLitros = Math.max(...ranking.map((r) => r.litros), 0)
  const top = ranking[0]

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Produtividade</h1>

      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Frentistas ativos" tone="blue" Icon={Users} value={formatNumber(kpis.frentistasAtivos)} />
        <KpiCard label="Abastecimentos" tone="navy" Icon={Receipt}
          value={formatNumber(kpis.totalAbastecimentos)} delta={variacaoPct(kpis.totalAbastecimentos, kpis.prevTotalAbastecimentos)} deltaLabel="mês ant." />
        <KpiCard label="Ritmo (abast/h ativa)" tone="violet" Icon={Gauge} value={ritmo.toFixed(1).replace('.', ',')} />
        <KpiCard label="Top frentista" tone="amber" Icon={Trophy}
          value={top ? liters(top.litros) : '—'} sub={top?.nome} />
      </div>

      <Section
        Icon={Trophy}
        title="Ranking de frentistas"
        right={<Badge tone="navy">{ranking.length}</Badge>}
      >
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
    </div>
  )
}

export default ProdutividadeMobile
