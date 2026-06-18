import { useMemo } from 'react'
import { Fuel, Droplets, DollarSign, TrendingUp, Receipt, Percent, Wallet, Users, Gauge, Clock, Calendar, LineChart as LineChartIcon } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatDate, formatNumber } from '@/lib/formatters'
import { projecaoAvancada, PROJECAO_TOOLTIP_EXECUTIVA } from '@/lib/projection'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import type { FuelVendaFuelType } from '@/pages/Operacao/hooks/useFuelVendaAnalytics'

interface FuelDetalheModalProps {
  open: boolean
  onClose: () => void
  /** Resumo de VALOR do combustível (venda fiscal). O detalhe operacional
   *  (frentistas/bombas/hora) vem dos abastecimentos em `rows`. */
  fuel: FuelVendaFuelType | null
  /** Todos os abastecimentos do período — o modal filtra pelo `fuel.nome` internamente. */
  rows: AbastecimentoRow[]
  /** Data inicial do período (ISO yyyy-mm-dd) — exibida no header de contexto. */
  dataInicial: string
  /** Data final do período (ISO yyyy-mm-dd). */
  dataFinal: string
  fuelColor: (nome: string) => string
}

const FuelDetalheModal = ({ open, onClose, fuel, rows, dataInicial, dataFinal, fuelColor }: FuelDetalheModalProps) => {
  // Filtra rows desse combustível
  const filtered = useMemo(
    () => (fuel ? rows.filter((r) => r.combustivelNome === fuel.nome) : []),
    [rows, fuel],
  )

  // Top 5 frentistas que mais venderam esse combustível
  const topFrentistas = useMemo(() => {
    interface FrentistaAgg {
      nome: string
      litros: number
      faturamento: number
      abastecimentos: number
    }
    const map = new Map<string, FrentistaAgg>()
    for (const r of filtered) {
      const prev = map.get(r.frentistaNome) ?? {
        nome: r.frentistaNome,
        litros: 0,
        faturamento: 0,
        abastecimentos: 0,
      }
      prev.litros += r.litros
      prev.faturamento += r.valorTotal
      prev.abastecimentos += 1
      map.set(r.frentistaNome, prev)
    }
    return Array.from(map.values())
      .sort((a, b) => b.litros - a.litros)
      .slice(0, 5)
  }, [filtered])

  // Top 5 bombas com mais saída desse combustível
  const topBombas = useMemo(() => {
    interface BombaAgg {
      nome: string
      litros: number
      abastecimentos: number
    }
    const map = new Map<string, BombaAgg>()
    for (const r of filtered) {
      const prev = map.get(r.bombaDescricao) ?? {
        nome: r.bombaDescricao,
        litros: 0,
        abastecimentos: 0,
      }
      prev.litros += r.litros
      prev.abastecimentos += 1
      map.set(r.bombaDescricao, prev)
    }
    return Array.from(map.values())
      .sort((a, b) => b.litros - a.litros)
      .slice(0, 5)
  }, [filtered])

  // Distribuição horária — agrega litros por hora do dia (00h..23h)
  const porHora = useMemo(() => {
    const slots = Array.from({ length: 24 }, (_, i) => ({ h: i, litros: 0 }))
    for (const r of filtered) {
      const h = parseInt(r.dataHora?.substring(11, 13) ?? '0', 10)
      if (!isNaN(h) && h >= 0 && h < 24) slots[h].litros += r.litros
    }
    return slots
      .filter((s) => s.litros > 0)
      .map((s) => ({ hora: `${String(s.h).padStart(2, '0')}h`, litros: s.litros }))
  }, [filtered])

  // Projeção de fechamento do combustível. Usa `projecaoAvancada` projetando
  // SEMPRE até o fim do mês do período (mesma metodologia dos cards de
  // Combustível e da tabela), pra não zerar quando o período termina antes de hoje.
  const projecao = useMemo(() => {
    if (!fuel) return null
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const [yy, mm] = (dataInicial || todayISO).split('-').map(Number)
    const lastDay = new Date(yy, mm, 0).getDate()
    const monthEnd = `${yy}-${String(mm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Séries diárias de faturamento, litros e lucro bruto deste combustível
    const fatMap = new Map<string, number>()
    const litrosMap = new Map<string, number>()
    const lucroMap = new Map<string, number>()
    for (const r of filtered) {
      const day = r.dataHora?.substring(0, 10)
      if (!day) continue
      fatMap.set(day, (fatMap.get(day) ?? 0) + r.valorTotal)
      litrosMap.set(day, (litrosMap.get(day) ?? 0) + r.litros)
      lucroMap.set(day, (lucroMap.get(day) ?? 0) + r.lucroBruto)
    }
    const toSeries = (m: Map<string, number>) =>
      Array.from(m.entries()).map(([data, value]) => ({ data, value }))

    const fatProj = projecaoAvancada({ dailySeries: toSeries(fatMap), today: todayISO, dataFinal: monthEnd })
    const litrosProj = projecaoAvancada({ dailySeries: toSeries(litrosMap), today: todayISO, dataFinal: monthEnd })
    const lucroProj = projecaoAvancada({ dailySeries: toSeries(lucroMap), today: todayISO, dataFinal: monthEnd })
    return {
      projetado: fatProj.esperado,
      projetadoLitros: litrosProj.esperado,
      projetadoLucro: lucroProj.esperado,
      projetadoMargem: fatProj.esperado > 0 ? (lucroProj.esperado / fatProj.esperado) * 100 : 0,
      isProjetada: fatProj.diasRestantes > 0,
      diasRestantes: fatProj.diasRestantes,
    }
  }, [fuel, filtered, dataInicial])

  if (!fuel) return null

  const ticketPorLitro = fuel.litros > 0 ? fuel.faturamento / fuel.litros : 0
  const maxFrentistaLitros = Math.max(...topFrentistas.map((f) => f.litros), 0)
  const maxBombaLitros = Math.max(...topBombas.map((b) => b.litros), 0)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <span className={cn('h-3 w-3 rounded-full', fuelColor(fuel.nome))} aria-hidden="true" />
              {fuel.nome}
            </span>
          </DialogTitle>
          <DialogDescription>
            Indicadores, frentistas, bombas e perfil horário
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-auto">
          {/* Faixa com participação no mix + período visualizado */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/50">
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Calendar className="h-3.5 w-3.5" />
              {dataInicial === dataFinal
                ? formatDate(dataInicial)
                : `${formatDate(dataInicial)} – ${formatDate(dataFinal)}`}
            </span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Fuel className="h-3.5 w-3.5" />
              {fuel.participacao.toFixed(2).replace('.', ',')}% do mix
            </span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="text-gray-600 dark:text-gray-400">
              {formatNumber(filtered.length)} abastecimento{filtered.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Seção 1: Indicadores */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Indicadores
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
              <Kpi Icon={Droplets} label="Litros" value={formatNumber(Math.round(fuel.litros))} />
              <Kpi Icon={DollarSign} label="Faturamento" value={formatCurrencyInt(fuel.faturamento)} />
              <Kpi Icon={TrendingUp} label="Lucro bruto" value={formatCurrencyInt(fuel.lucroBruto)} />
              <Kpi Icon={Percent} label="Margem" value={`${fuel.margem.toFixed(2).replace('.', ',')}%`} />
              <Kpi Icon={Receipt} label="Ticket / litro" value={formatCurrency(ticketPorLitro)} />
              <Kpi Icon={DollarSign} label="L.B./Litro" value={formatCurrency(fuel.lbPorLitro)} />
              <Kpi Icon={Wallet} label="Custo méd." value={formatCurrency(fuel.precoCustoMedio)} />
            </div>
          </section>

          {/* Projeção fim do mês — só quando o período ainda tem dias futuros */}
          {projecao?.isProjetada && (
            <section className="rounded-lg border border-blue-200 dark:border-blue-900/50" title={PROJECAO_TOOLTIP_EXECUTIVA}>
              <div className="flex items-center gap-1.5 border-b border-blue-200 bg-blue-50/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                <LineChartIcon className="h-3.5 w-3.5" />
                Projeção fim do mês
                <span className="ml-auto normal-case font-normal text-blue-600/80 dark:text-blue-400/70">
                  Faltam {projecao.diasRestantes} dia{projecao.diasRestantes === 1 ? '' : 's'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                <Kpi Icon={Droplets} label="Litros" value={formatNumber(Math.round(projecao.projetadoLitros))} tone="projecao" />
                <Kpi Icon={DollarSign} label="Faturamento" value={formatCurrencyInt(projecao.projetado)} tone="projecao" />
                <Kpi Icon={TrendingUp} label="Lucro bruto" value={formatCurrencyInt(projecao.projetadoLucro)} tone="projecao" />
                <Kpi Icon={Percent} label="Margem" value={`${projecao.projetadoMargem.toFixed(2).replace('.', ',')}%`} tone="projecao" />
              </div>
            </section>
          )}

          {/* Seções 2 e 3: Top frentistas + Top bombas (lado a lado em md+) */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <section className="rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <Users className="h-3.5 w-3.5" />
                Top frentistas
              </div>
              {topFrentistas.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-gray-400">Sem dados.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {topFrentistas.map((f) => {
                    const barWidth = maxFrentistaLitros > 0 ? (f.litros / maxFrentistaLitros) * 100 : 0
                    return (
                      <li key={f.nome} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-gray-900 dark:text-gray-100" title={f.nome}>
                            {f.nome}
                          </span>
                          <span className="shrink-0 tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                            {formatNumber(Math.round(f.litros))} L
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className="h-1 rounded-full bg-blue-400 dark:bg-blue-500" style={{ width: `${Math.max(2, barWidth)}%` }} />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                          <span>{formatCurrencyInt(f.faturamento)}</span>
                          <span>{f.abastecimentos} abastec.</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <Gauge className="h-3.5 w-3.5" />
                Top bombas
              </div>
              {topBombas.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-gray-400">Sem dados.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {topBombas.map((b) => {
                    const barWidth = maxBombaLitros > 0 ? (b.litros / maxBombaLitros) * 100 : 0
                    return (
                      <li key={b.nome} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-gray-900 dark:text-gray-100" title={b.nome}>
                            {b.nome}
                          </span>
                          <span className="shrink-0 tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                            {formatNumber(Math.round(b.litros))} L
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className="h-1 rounded-full bg-emerald-400 dark:bg-emerald-500" style={{ width: `${Math.max(2, barWidth)}%` }} />
                        </div>
                        <div className="mt-1 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                          {b.abastecimentos} abastec.
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Seção 4: Distribuição por hora */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              Distribuição horária — litros vendidos por hora do dia
            </div>
            {porHora.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-gray-400">Sem dados.</p>
            ) : (
              <div className="p-3">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={porHora} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                    <XAxis dataKey="hora" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
                    <Tooltip
                      formatter={((value: number) => [formatNumber(value), 'Litros']) as never}
                      contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    />
                    <Bar dataKey="litros" fill="#2563eb" radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="litros" position="top" formatter={((v: number) => formatNumber(Math.round(v))) as never} style={{ fontSize: 9, fill: '#374151' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Kpi = ({
  Icon,
  label,
  value,
  tone,
  hint,
  tooltip,
}: {
  Icon: typeof Wallet
  label: string
  value: string
  tone?: 'projecao'
  hint?: string
  /** Tooltip nativo do navegador no card inteiro — usado pra explicar a métrica. */
  tooltip?: string
}) => (
  <div
    title={tooltip}
    className={cn(
      'rounded-lg border p-2.5',
      tone === 'projecao'
        ? 'border-blue-200 bg-gradient-to-br from-blue-50/70 to-white dark:border-blue-900/50 dark:from-blue-950/30 dark:to-gray-900'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
      tooltip && 'cursor-help',
    )}
  >
    <div className="flex items-center justify-between">
      <p
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wider',
          tone === 'projecao' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400',
        )}
      >
        {label}
      </p>
      <Icon className={cn('h-3.5 w-3.5', tone === 'projecao' ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400')} />
    </div>
    <p
      className={cn(
        'mt-1 text-sm font-bold tabular-nums',
        tone === 'projecao' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100',
      )}
    >
      {value}
    </p>
    {hint && (
      <p className="mt-0.5 text-[10px] text-blue-600/80 dark:text-blue-400/70">{hint}</p>
    )}
  </div>
)

export default FuelDetalheModal
