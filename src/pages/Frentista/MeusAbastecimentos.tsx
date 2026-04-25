import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Fuel, Droplets, DollarSign, Receipt, RefreshCw } from 'lucide-react'
import { useFreentistaStore } from '@/store/frentista'
import { useFilterStore } from '@/store/filters'
import { fetchBicos } from '@/api/endpoints/combustiveis'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { formatCurrency, formatLiters, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import InsightBanner from '@/components/kpi/InsightBanner'
import FrentistaPeriodBadges from '@/pages/Frentista/components/FrentistaPeriodBadges'

const PRODUCT_STYLES = [
  { dot: '#93a8c4', bar: '#93a8c4' },       // slate blue
  { dot: '#6ba5a0', bar: '#6ba5a0' },       // sage green
  { dot: '#c4a260', bar: '#c4a260' },       // warm gold
  { dot: '#b07d8e', bar: '#b07d8e' },       // dusty rose
  { dot: '#8b8bbf', bar: '#8b8bbf' },       // soft lavender
  { dot: '#6b9fb8', bar: '#6b9fb8' },       // muted teal
  { dot: '#a88b6e', bar: '#a88b6e' },       // warm taupe
]

const MeusAbastecimentos = () => {
  const { session } = useFreentistaStore()
  const { dataInicial, dataFinal } = useFilterStore()

  const { data: abastData, isFetching } = useQuery({
    queryKey: ['abastecimentos-frentista', dataInicial, dataFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial, dataFinal }),
    enabled: !!session,
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  })

  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  // Lookup real funcionarioCodigo by name if needed
  const { data: bicosData } = useQuery({
    queryKey: ['bicos'],
    queryFn: () => fetchAllPages((p) => fetchBicos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    staleTime: 30 * 60 * 1000,
  })

  const { data: funcData } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: () => fetchFuncionarios({ limite: 1000 }),
    enabled: !!session,
    staleTime: 30 * 60 * 1000,
  })

  const computed = useMemo(() => {
    if (!session || !abastData) return null

    // Build product name map (multiple keys for matching)
    const prodMap = new Map<number, string>()
    for (const p of produtosData ?? []) {
      prodMap.set(p.produtoCodigo, p.nome)
      if (p.produtoLmcCodigo) prodMap.set(p.produtoLmcCodigo, p.nome)
      if (p.codigo) prodMap.set(p.codigo, p.nome)
    }

    // Bico → product mapping
    const bicoProduto = new Map<number, number>()
    for (const b of bicosData ?? []) {
      bicoProduto.set(b.bicoCodigo, b.produtoCodigo)
    }

    const resolveProdutoNome = (codigoProduto: number, codigoBico: number): string => {
      const direct = prodMap.get(codigoProduto)
      if (direct) return direct
      const viaBico = bicoProduto.get(codigoBico)
      if (viaBico) {
        const nome = prodMap.get(viaBico)
        if (nome) return nome
      }
      return `Produto ${codigoProduto}`
    }

    // Find real funcionarioCodigo by name
    const funcionarios = funcData?.resultados ?? []
    const funcMatch = funcionarios.find((f) => f.nome.toUpperCase() === session.nome.toUpperCase())
    const meuCodigo = funcMatch?.funcionarioCodigo ?? session.funcionarioCodigo

    // Filter abastecimentos — try by funcionarioCodigo, fallback to all from empresa
    const meus = meuCodigo > 0
      ? abastData.filter((a) => a.codigoFrentista === meuCodigo)
      : []
    const totalLitros = meus.reduce((s, a) => s + a.quantidade, 0)
    const totalValor = meus.reduce((s, a) => s + a.valorTotal, 0)
    const ticketMedio = meus.length > 0 ? totalValor / meus.length : 0

    // Group by product
    const byProduct = new Map<string, { litros: number; valor: number; count: number }>()
    for (const a of meus) {
      const nome = resolveProdutoNome(a.codigoProduto, a.codigoBico)
      const prev = byProduct.get(nome) ?? { litros: 0, valor: 0, count: 0 }
      byProduct.set(nome, { litros: prev.litros + a.quantidade, valor: prev.valor + a.valorTotal, count: prev.count + 1 })
    }
    const productData = Array.from(byProduct.entries())
      .map(([nome, d]) => ({ nome, ...d }))
      .sort((a, b) => b.litros - a.litros)

    // Group by day
    const byDay = new Map<string, { litros: number; valor: number; count: number }>()
    for (const a of meus) {
      const day = (a.dataFiscal || a.dataHoraAbastecimento?.substring(0, 10)) ?? ''
      const prev = byDay.get(day) ?? { litros: 0, valor: 0, count: 0 }
      byDay.set(day, { litros: prev.litros + a.quantidade, valor: prev.valor + a.valorTotal, count: prev.count + 1 })
    }
    const dailyData = Array.from(byDay.entries())
      .map(([data, d]) => ({ data, ...d }))
      .sort((a, b) => b.data.localeCompare(a.data))

    return { total: meus.length, totalLitros, totalValor, ticketMedio, productData, dailyData }
  }, [session, abastData, produtosData, bicosData, funcData])

  if (!session) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Meus Abastecimentos</h2>
        {isFetching && (
          <div className="flex items-center gap-1.5 text-xs text-blue-500">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Atualizando...
          </div>
        )}
      </div>

      <FrentistaPeriodBadges />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-blue-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-blue-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Abastecimentos</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
              <Fuel className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(computed?.total ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-cyan-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-cyan-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Litros</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-100 dark:bg-cyan-900/30">
              <Droplets className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            </div>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(computed?.totalLitros ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-emerald-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-emerald-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Faturamento</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/30">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(computed?.totalValor ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-amber-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-amber-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Ticket Médio</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30">
              <Receipt className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(computed?.ticketMedio ?? 0)}</p>
        </div>
      </div>

      {/* Insight banner */}
      {computed && computed.total > 0 && (() => {
        const avgTicket = computed.ticketMedio
        if (computed.total >= 20) return <InsightBanner type="success" message={`Excelente ritmo! Você já realizou ${formatNumber(computed.total)} abastecimentos no período com ticket médio de ${formatCurrency(avgTicket)}.`} />
        if (computed.total >= 10) return <InsightBanner type="motivate" message={`Bom trabalho! ${formatNumber(computed.total)} abastecimentos realizados. Continue assim para alcançar o topo do ranking!`} />
        return <InsightBanner type="tip" message={`Você realizou ${formatNumber(computed.total)} abastecimentos até agora. Cada atendimento conta para o seu ranking!`} />
      })()}

      {/* Products breakdown — table style */}
      {(computed?.productData ?? []).length > 0 && (() => {
        const totalLitrosProd = computed!.productData.reduce((s, p) => s + p.litros, 0)
        return (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Por Produto</h3>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Detalhamento por combustível e participação</p>
            </div>
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_90px_70px] gap-2 border-b border-gray-100 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:text-gray-500">
              <span>Combustível</span>
              <span className="text-right">Litros</span>
              <span className="text-right">Faturamento</span>
              <span className="text-right">Part.</span>
            </div>
            {/* Rows */}
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {computed!.productData.map((p, i) => {
                const pct = totalLitrosProd > 0 ? (p.litros / totalLitrosProd) * 100 : 0
                const style = PRODUCT_STYLES[i % PRODUCT_STYLES.length]
                const precoLitro = p.litros > 0 ? p.valor / p.litros : 0
                return (
                  <div key={p.nome} className={cn('grid grid-cols-[1fr_80px_90px_70px] items-center gap-2 px-4 py-3', i % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}>
                    {/* Product name + bar */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: style.dot }} />
                        <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{p.nome}</span>
                      </div>
                      <div className="ml-[18px] mt-1.5">
                        <div className="h-[3px] w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                          <div className="h-[3px] rounded-full" style={{ width: `${pct}%`, backgroundColor: style.bar, opacity: 0.5 }} />
                        </div>
                      </div>
                      <p className="ml-[18px] mt-0.5 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                        {p.count} abast. &middot; {formatCurrency(precoLitro)}/L
                      </p>
                    </div>
                    {/* Litros */}
                    <span className="text-right text-[13px] font-medium tabular-nums text-gray-700 dark:text-gray-300">{formatLiters(p.litros)}</span>
                    {/* Faturamento */}
                    <span className="text-right text-[13px] font-medium tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(p.valor)}</span>
                    {/* Participação */}
                    <span className="inline-flex justify-end">
                      <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        {pct.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Daily breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dia a Dia</h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Resumo diário de abastecimentos</p>
        </div>
        {/* Header */}
        <div className="grid grid-cols-[1fr_70px_80px_90px] gap-2 border-b border-gray-100 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:text-gray-500">
          <span>Data</span>
          <span className="text-right">Abast.</span>
          <span className="text-right">Litros</span>
          <span className="text-right">Valor</span>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {(computed?.dailyData ?? []).map((day, idx) => (
            <div key={day.data} className={cn('grid grid-cols-[1fr_70px_80px_90px] items-center gap-2 px-4 py-2.5', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {day.data.split('-').reverse().join('/')}
              </span>
              <span className="text-right text-[13px] tabular-nums text-gray-500 dark:text-gray-400">{formatNumber(day.count)}</span>
              <span className="text-right text-[13px] font-medium tabular-nums text-gray-700 dark:text-gray-300">{formatLiters(day.litros)}</span>
              <span className="text-right text-[13px] font-medium tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(day.valor)}</span>
            </div>
          ))}
          {(computed?.dailyData ?? []).length === 0 && (
            <div className="flex h-32 items-center justify-center text-sm text-gray-400">Sem abastecimentos no período.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MeusAbastecimentos
