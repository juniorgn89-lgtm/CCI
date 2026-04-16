import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTitulosReceber, fetchTitulosPagar } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

const useGerenteFinanceiroData = (empresaCodigo: number | undefined) => {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const enabled = !!empresaCodigo

  const { data: titulosReceber = [], isLoading: isLoadingReceber } = useQuery({
    queryKey: ['titulosReceber', empresaCodigo],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchTitulosReceber({
          empresaCodigo,
          apenasPendente: true,
          ultimoCodigo: p.ultimoCodigo,
          limite: p.limite,
        }),
        500, 50
      ),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  const { data: titulosPagar = [], isLoading: isLoadingPagar } = useQuery({
    queryKey: ['titulosPagar', empresaCodigo],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchTitulosPagar({
          empresaCodigo,
          apenasPendente: true,
          ultimoCodigo: p.ultimoCodigo,
          limite: p.limite,
        }),
        500, 50
      ),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  const isLoading = isLoadingReceber || isLoadingPagar

  const computed = useMemo(() => {
    const totalReceber = titulosReceber.reduce((acc, t) => acc + t.valor, 0)
    const vencidosReceber = titulosReceber.filter((t) => t.dataVencimento < todayStr)
    const totalVencidosReceber = vencidosReceber.reduce((acc, t) => acc + t.valor, 0)

    // Sort by vencimento and take next 5
    const proximosReceber = [...titulosReceber]
      .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
      .slice(0, 5)

    const totalPagar = titulosPagar.reduce((acc, t) => acc + t.valor, 0)
    const vencidosPagar = titulosPagar.filter((t) => t.vencimento < todayStr)
    const totalVencidosPagar = vencidosPagar.reduce((acc, t) => acc + t.valor, 0)

    const proximosPagar = [...titulosPagar]
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .slice(0, 5)

    return {
      receber: {
        total: totalReceber,
        count: titulosReceber.length,
        vencidos: vencidosReceber.length,
        totalVencidos: totalVencidosReceber,
        proximos: proximosReceber,
      },
      pagar: {
        total: totalPagar,
        count: titulosPagar.length,
        vencidos: vencidosPagar.length,
        totalVencidos: totalVencidosPagar,
        proximos: proximosPagar,
      },
    }
  }, [titulosReceber, titulosPagar, todayStr])

  return { ...computed, isLoading }
}

export default useGerenteFinanceiroData
