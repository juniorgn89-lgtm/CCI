import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'

export const useFilters = () => {
  const { empresaCodigo, dataInicial, dataFinal, setEmpresa, setPeriodo } = useFilterStore()
  const queryClient = useQueryClient()

  const queryParams = {
    empresaCodigo: empresaCodigo ?? undefined,
    dataInicial,
    dataFinal,
  }

  const periodoFormatado = (() => {
    const ini = dataInicial.split('-')
    const fim = dataFinal.split('-')
    return `${ini[2]}/${ini[1]}/${ini[0]} — ${fim[2]}/${fim[1]}/${fim[0]}`
  })()

  const handleSetEmpresa = useCallback((codigo: number | null) => {
    setEmpresa(codigo)
    queryClient.invalidateQueries()
  }, [setEmpresa, queryClient])

  const handleSetPeriodo = useCallback((dataInicial: string, dataFinal: string) => {
    setPeriodo(dataInicial, dataFinal)
    queryClient.invalidateQueries()
  }, [setPeriodo, queryClient])

  return {
    empresaCodigo,
    dataInicial,
    dataFinal,
    queryParams,
    periodoFormatado,
    setEmpresa: handleSetEmpresa,
    setPeriodo: handleSetPeriodo,
  }
}
