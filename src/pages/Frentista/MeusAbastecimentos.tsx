import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Fuel, Droplets, DollarSign, Receipt, RefreshCw, Package } from 'lucide-react'
import { useFreentistaStore } from '@/store/frentista'
import { useFilterStore } from '@/store/filters'
import { fetchAbastecimentos, fetchBicos } from '@/api/endpoints/combustiveis'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { formatCurrency, formatLiters, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import PeriodSelect from '@/components/filters/PeriodSelect'
import DateRangePicker from '@/components/filters/DateRangePicker'

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

const MeusAbastecimentos = () => {
  const { session } = useFreentistaStore()
  const { dataInicial, dataFinal } = useFilterStore()

  const { data: abastData, isFetching } = useQuery({
    queryKey: ['abastecimentos-frentista', dataInicial, dataFinal],
    queryFn: () => fetchAllPages((p) => fetchAbastecimentos({ dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
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

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <PeriodSelect />
        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
        <DateRangePicker />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border-l-4 border-blue-500 bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-blue-500" />
            <p className="text-xs text-gray-400">Abastecimentos</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(computed?.total ?? 0)}</p>
        </div>
        <div className="rounded-xl border-l-4 border-cyan-500 bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-cyan-500" />
            <p className="text-xs text-gray-400">Litros</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(computed?.totalLitros ?? 0)}</p>
        </div>
        <div className="rounded-xl border-l-4 border-emerald-500 bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <p className="text-xs text-gray-400">Faturamento</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(computed?.totalValor ?? 0)}</p>
        </div>
        <div className="rounded-xl border-l-4 border-amber-500 bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-amber-500" />
            <p className="text-xs text-gray-400">Ticket Médio</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(computed?.ticketMedio ?? 0)}</p>
        </div>
      </div>

      {/* Products breakdown */}
      {(computed?.productData ?? []).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Package className="h-4 w-4 text-violet-500" />
              Por Produto
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {(computed?.productData ?? []).map((p, i) => {
              const maxLitros = computed!.productData[0]?.litros || 1
              const pct = (p.litros / maxLitros) * 100
              return (
                <div key={p.nome} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{p.nome}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(p.litros)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                  </div>
                  <p className="mt-1 text-[10px] tabular-nums text-gray-400">
                    {p.count} abast. &middot; {formatCurrency(p.valor)} &middot; {formatCurrency(p.litros > 0 ? p.valor / p.litros : 0)}/L
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Daily breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dia a Dia</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {(computed?.dailyData ?? []).map((day) => (
            <div key={day.data} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {day.data.split('-').reverse().join('/')}
                </p>
                <p className="text-[10px] text-gray-400">{day.count} abast. &middot; {formatLiters(day.litros)}</p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(day.valor)}
              </p>
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
