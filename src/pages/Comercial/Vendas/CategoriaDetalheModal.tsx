import { useMemo } from 'react'
import { Calendar, Package, Layers, DollarSign, TrendingUp, Receipt, Percent, Wallet, Clock, LineChart as LineChartIcon } from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ReferenceLine, Legend,
} from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters'
import CoberturaBadge, { diasEntreDatas } from '@/components/badges/CoberturaBadge'
import { smoothedProjection, PROJECAO_TOOLTIP } from '@/lib/projection'
import type { VendaItem } from '@/api/types/venda'

export interface CategoriaData {
  nome: string
  qtdProdutos: number
  qtdVendida: number
  faturamento: number
  custo: number
}

interface CategoriaDetalheModalProps {
  open: boolean
  onClose: () => void
  categoria: CategoriaData | null
  /** Produtos da categoria com agregados — já filtrados (Pista). */
  produtos: Array<{
    produtoCodigo: number
    nome: string
    quantidade: number
    faturamento: number
    custo: number
  }>
  /** Vendas brutas (VendaItem) filtradas pra produtos dessa categoria.
   * Usado pra computar a distribuição diária e validar contagens. */
  vendasDaCategoria: VendaItem[]
  /** Saldo atual de estoque por produtoCodigo. Vazio = sem dados de estoque
   * (serviços, categorias sem reposição) → badge não é exibido. */
  estoquePorProduto: Map<number, number>
  dataInicial: string
  dataFinal: string
  /** Classe do badge colorido da categoria (mesma paleta da Pista). */
  categoriaColorClass: string
}


const CategoriaDetalheModal = ({
  open,
  onClose,
  categoria,
  produtos,
  vendasDaCategoria,
  estoquePorProduto,
  dataInicial,
  dataFinal,
  categoriaColorClass,
}: CategoriaDetalheModalProps) => {
  // Tamanho do período em dias — usado pra calcular venda diária média
  // (cobertura = saldo × dias / quantidade vendida no período).
  const diasPeriodo = useMemo(() => diasEntreDatas(dataInicial, dataFinal), [dataInicial, dataFinal])
  // Top 5 produtos por faturamento
  const topProdutos = useMemo(
    () => [...produtos].sort((a, b) => b.faturamento - a.faturamento).slice(0, 5),
    [produtos],
  )

  // Distribuição diária — soma faturamento por dataMovimento (yyyy-mm-dd)
  const porDia = useMemo(() => {
    const map = new Map<string, { qtd: number; fat: number }>()
    for (const v of vendasDaCategoria) {
      const date = v.dataMovimento?.substring(0, 10)
      if (!date) continue
      const prev = map.get(date) ?? { qtd: 0, fat: 0 }
      prev.qtd += v.quantidade
      prev.fat += v.totalVenda
      map.set(date, prev)
    }
    return Array.from(map.entries())
      .map(([data, agg]) => ({ data, dataFmt: formatDate(data), ...agg }))
      .sort((a, b) => a.data.localeCompare(b.data))
  }, [vendasDaCategoria])

  // Projeção de fechamento da categoria. Usa smoothedProjection com média
  // móvel dos últimos dias fechados e os dias que ainda faltam até dataFinal.
  const projecao = useMemo(() => {
    if (!categoria) return null
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const endTs = new Date(`${dataFinal}T00:00:00`).getTime()
    const todayTs = new Date(`${todayISO}T00:00:00`).getTime()
    const diasRestantes = Math.max(0, Math.floor((endTs - todayTs) / 86_400_000))

    const result = smoothedProjection({
      realizado: categoria.faturamento,
      dailySeries: porDia.map((d) => ({ data: d.data, value: d.fat })),
      diasRestantes,
      today: todayISO,
    })
    return {
      projetado: result.projetado,
      dailyRate: result.dailyRate,
      isProjetada: diasRestantes > 0,
      diasRestantes,
    }
  }, [categoria, porDia, dataFinal])

  if (!categoria) return null

  const lucro = categoria.faturamento - categoria.custo
  const margemPct = categoria.faturamento > 0 ? (lucro / categoria.faturamento) * 100 : 0
  const ticketMedio = categoria.qtdVendida > 0 ? categoria.faturamento / categoria.qtdVendida : 0
  const precoMedioCusto = categoria.qtdVendida > 0 ? categoria.custo / categoria.qtdVendida : 0
  const maxFat = Math.max(...topProdutos.map((p) => p.faturamento), 0)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                categoriaColorClass,
              )}
            >
              {categoria.nome}
            </span>
          </DialogTitle>
          <DialogDescription>
            Indicadores, produtos e distribuição diária da categoria
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-auto">
          {/* Faixa de contexto */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/50">
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Calendar className="h-3.5 w-3.5" />
              {dataInicial === dataFinal
                ? formatDate(dataInicial)
                : `${formatDate(dataInicial)} – ${formatDate(dataFinal)}`}
            </span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Package className="h-3.5 w-3.5" />
              {formatNumber(categoria.qtdProdutos)} SKU{categoria.qtdProdutos === 1 ? '' : 's'}
            </span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <span className="text-gray-600 dark:text-gray-400">
              {formatNumber(categoria.qtdVendida)} unidade{categoria.qtdVendida === 1 ? '' : 's'} no período
            </span>
          </div>

          {/* Indicadores */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Indicadores
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
              <Kpi Icon={Layers} label="Unidades" value={formatNumber(categoria.qtdVendida)} />
              <Kpi Icon={DollarSign} label="Faturamento" value={formatCurrency(categoria.faturamento)} />
              <Kpi
                Icon={LineChartIcon}
                label={projecao?.isProjetada ? 'Projeção fim do mês' : 'Projeção'}
                value={formatCurrency(projecao?.projetado ?? categoria.faturamento)}
                tone={projecao?.isProjetada ? 'projecao' : undefined}
                hint={projecao?.isProjetada ? `Faltam ${projecao.diasRestantes} dia${projecao.diasRestantes === 1 ? '' : 's'}` : undefined}
                tooltip={PROJECAO_TOOLTIP}
              />
              <Kpi Icon={TrendingUp} label="Lucro bruto" value={formatCurrency(lucro)} />
              <Kpi Icon={Percent} label="Margem" value={`${margemPct.toFixed(1).replace('.', ',')}%`} />
              <Kpi Icon={Receipt} label="Ticket / unid." value={formatCurrency(ticketMedio)} />
              <Kpi Icon={Wallet} label="Custo méd." value={formatCurrency(precoMedioCusto)} />
              <Kpi Icon={Package} label="SKUs ativos" value={formatNumber(categoria.qtdProdutos)} />
            </div>
          </section>

          {/* Top produtos */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <Package className="h-3.5 w-3.5" />
              Top produtos da categoria
            </div>
            {topProdutos.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-gray-400">Sem produtos no período.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {topProdutos.map((p) => {
                  const barWidth = maxFat > 0 ? (p.faturamento / maxFat) * 100 : 0
                  const margemP = p.faturamento > 0 ? ((p.faturamento - p.custo) / p.faturamento) * 100 : 0
                  return (
                    <li key={p.produtoCodigo} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-gray-900 dark:text-gray-100" title={p.nome}>
                          {p.nome}
                        </span>
                        <span className="shrink-0 tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(p.faturamento)}
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-1 rounded-full bg-amber-400 dark:bg-amber-500" style={{ width: `${Math.max(2, barWidth)}%` }} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                          <span>{formatNumber(p.quantidade)} unid.</span>
                          <span>margem {margemP.toFixed(1).replace('.', ',')}%</span>
                        </span>
                        <CoberturaBadge
                          saldo={estoquePorProduto.get(p.produtoCodigo)}
                          quantidade={p.quantidade}
                          diasPeriodo={diasPeriodo}
                          fallback=""
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Distribuição diária */}
          {porDia.length >= 2 && (
            <section className="rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  <Clock className="h-3.5 w-3.5" />
                  Faturamento diário da categoria
                </span>
                {projecao?.isProjetada && projecao.dailyRate > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 dark:text-blue-400">
                    <LineChartIcon className="h-3 w-3" />
                    Ritmo projetado: {formatCurrency(projecao.dailyRate)}/dia
                  </span>
                )}
              </div>
              <div className="p-3">
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={porDia} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                    <XAxis dataKey="dataFmt" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v).replace('R$ ', '')} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === 'projecaoLine' ? 'Ritmo projetado' : 'Faturamento',
                      ]}
                      contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    />
                    {projecao?.isProjetada && projecao.dailyRate > 0 && (
                      <Legend wrapperStyle={{ fontSize: 10 }} iconType="line" formatter={(v) => v === 'projecaoLine' ? 'Ritmo projetado' : 'Faturamento'} />
                    )}
                    <Bar dataKey="fat" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Faturamento">
                      <LabelList dataKey="fat" position="top" formatter={(v: number) => formatCurrency(v).replace('R$ ', '')} style={{ fontSize: 9, fill: '#374151' }} />
                    </Bar>
                    {projecao?.isProjetada && projecao.dailyRate > 0 && (
                      <ReferenceLine
                        y={projecao.dailyRate}
                        stroke="#2563eb"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: 'Ritmo projetado',
                          position: 'insideTopLeft',
                          fontSize: 9,
                          fill: '#2563eb',
                        }}
                      />
                    )}
                    {/* Adiciona Line vazio só pra entrar na Legend acima */}
                    {projecao?.isProjetada && projecao.dailyRate > 0 && (
                      <Line dataKey={() => null} stroke="#2563eb" strokeDasharray="4 4" name="projecaoLine" dot={false} legendType="line" />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
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

export default CategoriaDetalheModal
