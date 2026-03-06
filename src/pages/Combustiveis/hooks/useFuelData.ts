import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchAbastecimentos } from '@/api/endpoints/combustiveis'
import { formatCurrency, formatLiters } from '@/lib/formatters'

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const useFuelData = () => {
  const { empresaCodigo, dataInicial, dataFinal } = useFilterStore()

  const filterParams = {
    empresaCodigo: empresaCodigo ?? undefined,
    dataInicial,
    dataFinal,
  }

  const {
    data: abastecimentosData,
    isLoading,
  } = useQuery({
    queryKey: ['abastecimentos', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAbastecimentos(filterParams),
  })

  const abastecimentos = abastecimentosData?.resultados ?? []

  const computed = useMemo(() => {
    const totalLitros = abastecimentos.reduce((acc, a) => acc + a.quantidade, 0)
    const totalFaturamento = abastecimentos.reduce((acc, a) => acc + a.valorTotal, 0)
    const totalCusto = abastecimentos.reduce((acc, a) => acc + a.quantidade * a.precoCadastro, 0)
    const margemTotal = totalFaturamento - totalCusto
    const margemPercent = totalFaturamento > 0 ? (margemTotal / totalFaturamento) * 100 : 0
    const precoMedioVenda = totalLitros > 0 ? totalFaturamento / totalLitros : 0

    const kpis = {
      litros: { value: formatLiters(totalLitros) },
      faturamento: { value: formatCurrency(totalFaturamento) },
      margem: { value: `${margemPercent.toFixed(1)}%` },
      precoMedio: { value: formatCurrency(precoMedioVenda) },
    }

    // --- Group by day ---
    const byDay = new Map<string, { litros: number; faturamento: number; custo: number }>()
    for (const a of abastecimentos) {
      const day = a.dataHoraAbastecimento.split('T')[0]
      const prev = byDay.get(day) ?? { litros: 0, faturamento: 0, custo: 0 }
      byDay.set(day, {
        litros: prev.litros + a.quantidade,
        faturamento: prev.faturamento + a.valorTotal,
        custo: prev.custo + a.quantidade * a.precoCadastro,
      })
    }

    const dailyData = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, values]) => {
        const margemRs = values.faturamento - values.custo
        const margemPct = values.faturamento > 0 ? (margemRs / values.faturamento) * 100 : 0
        return {
          data,
          litros: values.litros,
          faturamento: values.faturamento,
          custo: values.custo,
          margemRs,
          margemPct,
        }
      })

    // --- Group by fuel type (produtoCodigo) ---
    const byFuelType = new Map<number, { litros: number; faturamento: number; custo: number }>()
    for (const a of abastecimentos) {
      const prev = byFuelType.get(a.codigoProduto) ?? { litros: 0, faturamento: 0, custo: 0 }
      byFuelType.set(a.codigoProduto, {
        litros: prev.litros + a.quantidade,
        faturamento: prev.faturamento + a.valorTotal,
        custo: prev.custo + a.quantidade * a.precoCadastro,
      })
    }

    const fuelTypeData = Array.from(byFuelType.entries())
      .map(([produtoCodigo, values]) => {
        const precoMedio = values.litros > 0 ? values.faturamento / values.litros : 0
        const margem = values.faturamento > 0
          ? ((values.faturamento - values.custo) / values.faturamento) * 100
          : 0
        return {
          produtoCodigo,
          tipo: `Combustível ${produtoCodigo}`,
          litros: values.litros,
          faturamento: values.faturamento,
          precoMedio,
          margem,
        }
      })
      .sort((a, b) => b.faturamento - a.faturamento)

    // --- Monthly evolution (group by yyyy-MM) ---
    const byMonth = new Map<string, { litros: number; faturamento: number }>()
    for (const a of abastecimentos) {
      const month = a.dataHoraAbastecimento.substring(0, 7)
      const prev = byMonth.get(month) ?? { litros: 0, faturamento: 0 }
      byMonth.set(month, {
        litros: prev.litros + a.quantidade,
        faturamento: prev.faturamento + a.valorTotal,
      })
    }

    const monthlyEvolution = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, values]) => ({
        mes,
        litros: values.litros,
        faturamento: values.faturamento,
      }))

    // --- Weekly analysis (group by day of week) ---
    const byWeekday = Array.from({ length: 7 }, () => ({ litros: 0, faturamento: 0, count: 0 }))
    for (const a of abastecimentos) {
      const dayOfWeek = new Date(a.dataHoraAbastecimento).getDay()
      byWeekday[dayOfWeek].litros += a.quantidade
      byWeekday[dayOfWeek].faturamento += a.valorTotal
      byWeekday[dayOfWeek].count += 1
    }

    const weeklyAnalysis = byWeekday.map((values, index) => ({
      dia: WEEKDAY_LABELS[index],
      litros: values.litros,
      faturamento: values.faturamento,
      mediaLitros: values.count > 0 ? values.litros / values.count : 0,
      mediaFaturamento: values.count > 0 ? values.faturamento / values.count : 0,
    }))

    return { kpis, dailyData, fuelTypeData, monthlyEvolution, weeklyAnalysis }
  }, [abastecimentos])

  return {
    ...computed,
    isLoading,
  }
}

export default useFuelData
