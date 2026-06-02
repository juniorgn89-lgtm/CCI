import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Scale, AlertTriangle, TrendingUp, Landmark } from 'lucide-react'
import useFinanceData from '@/pages/Financeiro/hooks/useFinanceData'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { KpiCard, Section, Segmented, Badge, type Tone } from '@/components/mobile/primitives'
import { AreaChartMobile } from '@/components/mobile/charts'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brl, brlShort, pct } from '@/components/mobile/format'

const TABS = [
  { id: 'geral', label: 'Visão Geral' },
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
          <div className="divide-y divide-gray-100 dark:divide-[#303030]">
            {filtered.slice(0, 200).map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{nome(r)}</p>
                  <p className="text-[10.5px] text-gray-400 dark:text-gray-500">
                    venc. {fmtDia(dataDe(r))}{r.statusTag === 'vencido' && r.diasAtraso > 0 && ` · ${r.diasAtraso}d atraso`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[12.5px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brl(valorDe(r))}</span>
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
  const { kpis, receivablesData, payablesData, cashFlowData, cashFlowTotals, isLoading, hasEmpresa } = useFinanceData()
  const [tab, setTab] = useState('geral')

  const fluxoChart = useMemo(
    () => cashFlowData.map((d) => ({ label: d.data.slice(8, 10), saldo: d.saldoAcumulado })),
    [cashFlowData],
  )

  if (!hasEmpresa) {
    return (
      <div className="space-y-3 pb-2">
        <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Financeiro</h1>
        <EmptyCard title="Selecione um posto" desc="Escolha um posto no filtro pra ver o financeiro." />
      </div>
    )
  }
  if (isLoading || !kpis) return <LoadingScreen message="Carregando financeiro…" />

  const saldoTone: Tone = kpis.saldoLiquido < 0 ? 'rose' : 'emerald'

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Financeiro</h1>
      <div className="-mx-3.5 flex gap-1 overflow-x-auto border-b border-gray-200 px-3.5 [scrollbar-width:none] dark:border-[#3a3a3a]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px shrink-0 whitespace-nowrap border-b-2 px-1.5 pb-2.5 pt-3 text-[13px]',
              tab === t.id
                ? 'border-[#2563eb] font-semibold text-[#2563eb] dark:border-[#60a5fa] dark:text-[#60a5fa]'
                : 'border-transparent font-medium text-gray-400 dark:text-gray-500',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'geral' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="A receber" tone="emerald" Icon={ArrowDownCircle} value={brlShort(kpis.totalReceber)} sub={`${formatNumber(kpis.countReceber)} títulos`} />
            <KpiCard label="A pagar" tone="rose" Icon={ArrowUpCircle} value={brlShort(kpis.totalPagar)} sub={`${formatNumber(kpis.countPagar)} títulos`} />
            <KpiCard span2 big label="Saldo líquido" tone={saldoTone} Icon={Scale} value={brl(kpis.saldoLiquido)} sub="A receber − a pagar" />
            <KpiCard span2 label="Inadimplência" tone="amber" Icon={AlertTriangle} value={pct(kpis.inadimplenciaPercent)} sub={`${brlShort(kpis.inadimplencia)} vencidos a receber`} />
          </div>

          <Section Icon={AlertTriangle} title="Vencidos" accent="rose">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-950/20">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">A receber</p>
                <p className="text-[16px] font-bold tabular-nums text-rose-600 dark:text-rose-400">{brlShort(kpis.totalVencidosReceber)}</p>
                <p className="text-[10px] text-gray-400">{kpis.countVencidosReceber} títulos</p>
              </div>
              <div className="rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-950/20">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">A pagar</p>
                <p className="text-[16px] font-bold tabular-nums text-rose-600 dark:text-rose-400">{brlShort(kpis.totalVencidosPagar)}</p>
                <p className="text-[10px] text-gray-400">{kpis.countVencidosPagar} contas</p>
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
