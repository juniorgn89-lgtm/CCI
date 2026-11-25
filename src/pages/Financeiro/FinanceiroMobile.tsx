import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, AlertTriangle, TrendingUp, Landmark } from 'lucide-react'
import useFinanceData from '@/pages/Financeiro/hooks/useFinanceData'
import { cn } from '@/lib/utils'
import { KpiCard, Section, Segmented, Badge, type Tone } from '@/components/mobile/primitives'
import { AreaChartMobile } from '@/components/mobile/charts'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brl, brlShort, variacaoPct } from '@/components/mobile/format'

const TABS = [
  { id: 'geral', label: 'Visão Financeira' },
  { id: 'receber', label: 'A Receber' },
  { id: 'pagar', label: 'A Pagar' },
  { id: 'fluxo', label: 'Fluxo' },
]

const fmtDia = (iso: string): string => (iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '—')

const statusTone: Record<string, Tone> = {
  vencido: 'rose',
  'a-vencer': 'amber',
  pago: 'emerald',
  cancelado: 'navy',
}
const statusLabel: Record<string, string> = {
  vencido: 'Vencido',
  'a-vencer': 'A vencer',
  pago: 'Pago',
  cancelado: 'Cancelado',
}

type FiltroStatus = 'todos' | 'vencido' | 'a-vencer'

/** Lista de títulos (receber/pagar) com filtro por status. */
const TitulosList = <T extends { statusTag: string; diasAtraso: number }>({
  rows, nome, valorDe, dataDe, vazio,
}: {
  rows: T[]
  nome: (r: T) => string
  valorDe: (r: T) => number
  dataDe: (r: T) => string
  vazio: string
}) => {
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')
  const filtered = useMemo(() => {
    const base = filtro === 'todos' ? rows : rows.filter((r) => r.statusTag === filtro)
    // Vencidos primeiro, depois a vencer; dentro, por data.
    const ord: Record<string, number> = { vencido: 0, 'a-vencer': 1, pago: 2, cancelado: 3 }
    return [...base].sort((a, b) => (ord[a.statusTag] ?? 9) - (ord[b.statusTag] ?? 9) || dataDe(a).localeCompare(dataDe(b)))
  }, [rows, filtro, dataDe])

  return (
    <div className="space-y-3">
      <Segmented
        scroll
        value={filtro}
        onChange={(v) => setFiltro(v as FiltroStatus)}
        options={[
          { value: 'todos', label: `Todos (${rows.length})` },
          { value: 'vencido', label: 'Vencidos' },
          { value: 'a-vencer', label: 'A vencer' },
        ]}
      />
      {filtered.length === 0 ? (
        <EmptyCard title={vazio} desc="Nenhum título para este filtro." />
      ) : (
        <Section Icon={Landmark} title={`${filtered.length} ${filtered.length === 1 ? 'título' : 'títulos'}`} flush>
          <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
            {filtered.slice(0, 200).map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-gray-900 dark:text-gray-100">{nome(r)}</p>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500">
                    venc. {fmtDia(dataDe(r))}{r.statusTag === 'vencido' && r.diasAtraso > 0 && ` · ${r.diasAtraso}d atraso`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[14px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brl(valorDe(r))}</span>
                  <Badge tone={statusTone[r.statusTag] ?? 'navy'}>{statusLabel[r.statusTag] ?? r.statusTag}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

/**
 * Financeiro — versão mobile. Reusa useFinanceData. Abas: Visão Geral (KPIs +
 * vencidos + fluxo resumido), A Receber, A Pagar (listas filtráveis) e Fluxo.
 */
const FinanceiroMobile = () => {
  const { kpis, receivablesData, payablesData, cashFlowData, cashFlowTotals, cashFlowPrevTotals, isLoading } = useFinanceData()
  const [tab, setTab] = useState('geral')

  const fluxoChart = useMemo(
    () => cashFlowData.map((d) => ({ label: d.data.slice(8, 10), saldo: d.saldoAcumulado })),
    [cashFlowData],
  )

  if (isLoading || !kpis) return <LoadingScreen message="Carregando financeiro…" />

  const resultadoTone: Tone = cashFlowTotals.saldo < 0 ? 'rose' : 'emerald'

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[26px] font-bold leading-tight text-gray-900 dark:text-gray-100">Financeiro</h1>
      <div className="flex overflow-x-auto rounded-2xl border border-gray-200 bg-white px-1 [scrollbar-width:none] dark:border-[#2f3b4f] dark:bg-[#1e293b]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'relative shrink-0 whitespace-nowrap px-3 py-3.5 text-[14.5px] transition-colors',
              tab === t.id
                ? 'font-semibold text-[#0f766e] after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[#0d9488] dark:text-[#5eead4] dark:after:bg-[#5eead4]/80'
                : 'font-medium text-gray-500 dark:text-[#94a3b8]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'geral' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <KpiCard span2 big label="Saldo líquido" tone="navy" Icon={Landmark}
              value={brl(kpis.saldoLiquido)} sub="A receber − a pagar" />
            <KpiCard label="A receber" tone="emerald" Icon={ArrowDownCircle}
              value={brlShort(kpis.totalReceber)} sub={`${brlShort(kpis.totalVencidosReceber)} vencido`} />
            <KpiCard label="A pagar" tone="rose" Icon={ArrowUpCircle}
              value={brlShort(kpis.totalPagar)} sub={kpis.totalVencidosPagar > 0 ? `${brlShort(kpis.totalVencidosPagar)} vencido` : 'em dia'} />
            <KpiCard span2 label="Resultado do período" tone={resultadoTone} Icon={TrendingUp}
              value={brl(cashFlowTotals.saldo)} delta={variacaoPct(cashFlowTotals.saldo, cashFlowPrevTotals.saldo)} deltaLabel="período ant." />
          </div>

          <Section Icon={AlertTriangle} title="Vencidos" accent="rose">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-950/20">
                <p className="text-[12px] text-gray-500 dark:text-gray-400">A receber</p>
                <p className="text-[16px] font-bold tabular-nums text-rose-600 dark:text-rose-400">{brlShort(kpis.totalVencidosReceber)}</p>
                <p className="text-[11px] text-gray-400">{kpis.countVencidosReceber} títulos</p>
              </div>
              <div className="rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-950/20">
                <p className="text-[12px] text-gray-500 dark:text-gray-400">A pagar</p>
                <p className="text-[16px] font-bold tabular-nums text-rose-600 dark:text-rose-400">{brlShort(kpis.totalVencidosPagar)}</p>
                <p className="text-[11px] text-gray-400">{kpis.countVencidosPagar} contas</p>
              </div>
            </div>
          </Section>

          {fluxoChart.length > 0 && (
            <Section Icon={TrendingUp} title="Saldo acumulado" accent="blue"
              right={<Badge tone={cashFlowTotals.saldo >= 0 ? 'emerald' : 'rose'}>{brlShort(cashFlowTotals.saldo)}</Badge>}>
              <AreaChartMobile data={fluxoChart} valueKey="saldo" labelKey="label" />
            </Section>
          )}
        </div>
      )}

      {tab === 'receber' && (
        <TitulosList
          rows={receivablesData}
          nome={(r) => r.nomeCliente || 'Cliente'}
          valorDe={(r) => r.valor}
          dataDe={(r) => r.dataVencimento}
          vazio="Sem títulos a receber"
        />
      )}

      {tab === 'pagar' && (
        <TitulosList
          rows={payablesData}
          nome={(r) => r.nomeFornecedor || 'Fornecedor'}
          valorDe={(r) => r.saldoRestante}
          dataDe={(r) => r.vencimento}
          vazio="Sem contas a pagar"
        />
      )}

      {tab === 'fluxo' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <KpiCard label="Entradas" tone="emerald" value={brlShort(cashFlowTotals.entradas)} />
            <KpiCard label="Saídas" tone="rose" value={brlShort(cashFlowTotals.saidas)} />
            <KpiCard label="Saldo" tone={cashFlowTotals.saldo >= 0 ? 'blue' : 'rose'} value={brlShort(cashFlowTotals.saldo)} />
          </div>
          {fluxoChart.length > 0 ? (
            <Section Icon={TrendingUp} title="Saldo acumulado por dia" accent="blue">
              <AreaChartMobile data={fluxoChart} valueKey="saldo" labelKey="label" height={170} />
            </Section>
          ) : (
            <EmptyCard title="Sem movimento" desc="Sem fluxo de caixa no período." />
          )}
        </div>
      )}
    </div>
  )
}

export default FinanceiroMobile
