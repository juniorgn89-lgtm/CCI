import { useMemo, useState } from 'react'
import {
  Wallet, Scale, Clock, Flame, TrendingUp, CreditCard,
  Banknote, Smartphone, Users, ChevronDown,
} from 'lucide-react'
import useOperacaoData, {
  type TurnoGroup, type OperacaoKpiData, type CaixaResumo, type PagamentoBreakdown, type ApuradoPorDia,
} from '@/pages/Operacao/hooks/useOperacaoData'
import { useFilterStore } from '@/store/filters'
import { todayLocal } from '@/lib/period'
import { isPastPeriod, cn } from '@/lib/utils'
import { formatNumber, formatLiters } from '@/lib/formatters'
import { KpiCard, Section, ScrollTabs, Segmented, Badge } from '@/components/mobile/primitives'
import { BarChartMobile, DonutMobile } from '@/components/mobile/charts'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brl, brlShort, pct } from '@/components/mobile/format'

const TABS = [
  { id: 'visao', label: 'Visão Geral' },
  { id: 'turnos', label: 'Turnos de Caixa' },
]

const paymentIcon = (tipo: string) => {
  const t = tipo.toUpperCase()
  if (t.includes('DINHEIRO') || t.includes('ESPECIE')) return Banknote
  if (t.includes('PIX')) return Smartphone
  if (t.includes('CARTAO') || t.includes('CREDITO') || t.includes('DEBITO')) return CreditCard
  return Wallet
}

const isoTime = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  if (iso.includes('T')) return iso.split('T')[1]?.substring(0, 5) ?? '-'
  if (iso.includes(' ')) return iso.split(' ')[1]?.substring(0, 5) ?? '-'
  return iso.substring(0, 5)
}

/** Apurado efetivo: fechado = definitivo; aberto = max(apurado, combustível parcial). */
const apuradoEfetivo = (g: TurnoGroup): { value: number; isPartial: boolean } => {
  if (g.fechado) return { value: g.apuradoTotal, isPartial: false }
  const combParcial = g.frentistas.reduce((s, f) => s + f.faturamento, 0)
  return { value: Math.max(g.apuradoTotal, combParcial), isPartial: true }
}

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</span>
  </div>
)

/* ── Card de turno (tap pra expandir) ── */
const TurnoCard = ({ g, periodIsPast }: { g: TurnoGroup; periodIsPast: boolean }) => {
  const [open, setOpen] = useState(false)
  const eff = apuradoEfetivo(g)
  const dataFmt = g.dataMovimento ? g.dataMovimento.slice(0, 10).split('-').reverse().join('/') : '-'
  const responsaveis = g.responsaveis.length <= 2
    ? g.responsaveis.join(' · ')
    : `${g.responsaveis.slice(0, 2).join(' · ')} (+${g.responsaveis.length - 2})`
  const temDif = g.fechado && Math.abs(g.diferencaTotal) > 0.005
  const difPos = g.diferencaTotal > 0.005

  const totalComb = g.frentistas.reduce((s, f) => s + f.faturamento, 0)
  const conveniencia = Math.max(0, g.apuradoTotal - totalComb)
  const totalLitros = g.frentistas.reduce((s, f) => s + f.litros, 0)
  const totalAbast = g.frentistas.reduce((s, f) => s + f.atendimentos, 0)
  const esperado = g.apuradoTotal - g.diferencaTotal
  const totalPgto = g.pagamentos.reduce((s, p) => s + p.valor, 0)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left active:bg-gray-50 dark:active:bg-white/5"
      >
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">{g.turno}</span>
            {!g.fechado && !periodIsPast && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-green-500" />
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
            {dataFmt} · {isoTime(g.abertura)}–{g.fechado ? isoTime(g.fechamento) : 'aberto'}
            {responsaveis && ` · ${responsaveis}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {brlShort(eff.value)}
            {eff.isPartial && <span className="ml-1 text-[9px] font-medium text-amber-600 dark:text-amber-400">parcial</span>}
          </span>
          {temDif ? (
            <Badge tone={difPos ? 'emerald' : 'rose'}>
              {g.diferencaTotal > 0 ? '+' : ''}{brl(g.diferencaTotal)}
            </Badge>
          ) : g.fechado ? (
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">s/ diferença</span>
          ) : null}
        </div>
      </button>

      {open && (
        <div className="space-y-3 bg-gray-50 px-3.5 pb-3.5 pt-1 dark:bg-[#1c1c1c]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px]">
            <Detail label="Apurado" value={brl(g.apuradoTotal)} />
            {g.fechado && <Detail label="Esperado" value={brl(esperado)} />}
            <Detail label="Combustível" value={brl(totalComb)} />
            {conveniencia > 0 && <Detail label="Conveniência" value={brl(conveniencia)} />}
            <Detail label="Abastecimentos" value={formatNumber(totalAbast)} />
            <Detail label="Litros" value={formatLiters(totalLitros)} />
          </div>

          {g.frentistas.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                <Users className="h-3 w-3" /> Frentistas
              </p>
              <div className="space-y-1.5">
                {g.frentistas.slice().sort((a, b) => b.faturamento - a.faturamento).map((f) => (
                  <div key={f.nome} className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{f.nome}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{formatLiters(f.litros)}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(f.faturamento)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {g.pagamentos.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                <Wallet className="h-3 w-3" /> Formas de pagamento
              </p>
              <div className="space-y-1.5">
                {g.pagamentos.slice().sort((a, b) => b.valor - a.valor).map((p) => {
                  const Icon = paymentIcon(p.tipo)
                  const ptc = totalPgto > 0 ? (p.valor / totalPgto) * 100 : 0
                  return (
                    <div key={p.tipo} className="flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-gray-700 dark:text-gray-300">
                        <Icon className="h-3 w-3 shrink-0 text-gray-400" />
                        <span className="truncate">{p.nome}</span>
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{pct(ptc)}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(p.valor)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Aba Visão Geral ── */
interface VisaoGeralTabProps {
  kpis: OperacaoKpiData | undefined
  caixaResumo: CaixaResumo
  pagamentoBreakdown: PagamentoBreakdown[]
  apuradoPorDia: ApuradoPorDia[]
}
const VisaoGeralTab = ({ kpis, caixaResumo, pagamentoBreakdown, apuradoPorDia }: VisaoGeralTabProps) => {
  // Projeção do apurado — média dos últimos 7 dias × dias restantes (= método desktop).
  const projData = useMemo(() => {
    const todayStr = todayLocal()
    const realPast = apuradoPorDia.filter((d) => d.data <= todayStr)
    const last7 = realPast.slice(-7)
    const last7Avg = last7.length > 0 ? last7.reduce((s, d) => s + d.apurado, 0) / last7.length : 0
    const futureCount = apuradoPorDia.filter((d) => d.data > todayStr).length
    const realSum = realPast.reduce((s, d) => s + d.apurado, 0)
    return {
      realSum,
      monthProj: realSum + last7Avg * futureCount,
      showProjection: futureCount > 0 && last7Avg > 0,
      decorridoPct: apuradoPorDia.length > 0 ? Math.round((realPast.length / apuradoPorDia.length) * 100) : 100,
      chart: realPast.map((d) => ({ label: d.data.slice(8, 10), v: d.apurado })),
    }
  }, [apuradoPorDia])

  if (!kpis) return <EmptyCard />

  const dif = kpis.totalDiferenca
  const difTone = dif < -0.005 ? 'rose' : dif > 0.005 ? 'amber' : 'navy'
  const totalTurnos = caixaResumo.caixasAbertos + caixaResumo.caixasFechados
  const donut = (() => {
    const top = pagamentoBreakdown.slice(0, 5).map((p) => ({ nome: p.nome, valor: p.valor }))
    const resto = pagamentoBreakdown.slice(5).reduce((s, p) => s + p.valor, 0)
    if (resto > 0) top.push({ nome: 'Outros', valor: resto })
    return top
  })()
  const totalPgto = pagamentoBreakdown.reduce((s, p) => s + p.valor, 0)
  const totalTransacoes = pagamentoBreakdown.reduce((s, p) => s + p.quantidade, 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiCard span2 big label="Total apurado" tone="navy" Icon={Wallet}
          value={brlShort(kpis.totalApurado)} sub={`${formatNumber(totalTurnos)} turnos`} />
        {projData.showProjection && (
          <KpiCard span2 label="Projeção do período" tone="amber" Icon={Flame}
            value={brlShort(projData.monthProj)} sub={`fim do mês · ~${projData.decorridoPct}% decorrido`} />
        )}
        <KpiCard label="Diferença" tone={difTone} Icon={Scale}
          value={`${dif > 0 ? '+' : ''}${brlShort(dif)}`} sub="conferido vs sistema" />
        <KpiCard label="Turnos abertos" tone="blue" Icon={Clock}
          value={formatNumber(caixaResumo.caixasAbertos)} sub={`de ${formatNumber(totalTurnos)}`} />
      </div>

      {donut.length > 0 && (
        <Section Icon={CreditCard} title="Formas de pagamento" accent="blue">
          <DonutMobile data={donut} centerTop={brlShort(totalPgto)} centerSub={`${formatNumber(totalTransacoes)} transações`} />
        </Section>
      )}

      {projData.chart.length > 0 && (
        <Section Icon={TrendingUp} title="Apurado por dia" accent="navy">
          <BarChartMobile data={projData.chart} valueKey="v" labelKey="label" />
        </Section>
      )}
    </div>
  )
}

/* ── Aba Turnos ── */
const TurnosTab = ({ turnoGroups }: { turnoGroups: TurnoGroup[] }) => {
  const { dataFinal } = useFilterStore()
  const periodIsPast = isPastPeriod(dataFinal)
  const [filter, setFilter] = useState<string>(periodIsPast ? 'todos' : 'aberto')

  const abertos = turnoGroups.filter((g) => !g.fechado).length

  const filtered = useMemo(() => {
    return turnoGroups
      .filter((g) => {
        if (filter === 'aberto') return !g.fechado
        if (filter === 'fechado') return g.fechado
        if (filter === 'com') return g.fechado && Math.abs(g.diferencaTotal) > 0.005
        return true
      })
      .sort((a, b) => {
        if (a.fechado !== b.fechado) return a.fechado ? 1 : -1
        return b.dataMovimento.localeCompare(a.dataMovimento) || b.abertura.localeCompare(a.abertura)
      })
  }, [turnoGroups, filter])

  return (
    <div className="space-y-3">
      <Segmented
        scroll
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'aberto', label: 'Abertos' },
          { value: 'fechado', label: 'Fechados' },
          { value: 'com', label: 'Com diferença' },
          { value: 'todos', label: 'Todos' },
        ]}
      />

      <Section
        Icon={Wallet}
        title="Turnos de caixa"
        right={!periodIsPast && abertos > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-green-500" />
            </span>
            {abertos} ao vivo
          </span>
        ) : (
          <Badge tone="navy">{filtered.length}</Badge>
        )}
        flush
      >
        {filtered.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[12px] text-gray-400 dark:text-gray-500">
            {turnoGroups.length === 0 ? 'Nenhum turno no período.' : 'Nenhum turno para este filtro.'}
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-[#303030]">
            {filtered.map((g) => <TurnoCard key={g.groupKey} g={g} periodIsPast={periodIsPast} />)}
          </div>
        )}
      </Section>
    </div>
  )
}

/**
 * Caixas & Turnos — versão mobile. Reusa useOperacaoData (mesmos números do
 * desktop). Abas: Visão Geral (KPIs + projeção do apurado + formas + apurado/dia)
 * e Turnos de Caixa (lista de turnos expansíveis, com turno ao vivo).
 */
const CaixasMobile = () => {
  const { kpis, caixaResumo, pagamentoBreakdown, apuradoPorDia, turnoGroups, isLoading, hasEmpresa } = useOperacaoData()
  const [tab, setTab] = useState('visao')

  if (!hasEmpresa) {
    return (
      <div className="space-y-3 pb-2">
        <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Caixas &amp; Turnos</h1>
        <EmptyCard title="Selecione um posto" desc="Escolha um posto no filtro pra ver caixas e turnos." />
      </div>
    )
  }
  if (isLoading) return <LoadingScreen message="Carregando caixas…" />

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Caixas &amp; Turnos</h1>
      <ScrollTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'visao'
        ? <VisaoGeralTab kpis={kpis} caixaResumo={caixaResumo} pagamentoBreakdown={pagamentoBreakdown} apuradoPorDia={apuradoPorDia} />
        : <TurnosTab turnoGroups={turnoGroups} />}
    </div>
  )
}

export default CaixasMobile
