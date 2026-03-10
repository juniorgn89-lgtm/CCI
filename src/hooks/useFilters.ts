import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'

export const useFilters = () => {
  const { empresaCodigos, dataInicial, dataFinal, setEmpresas, setPeriodo } = useFilterStore()
  const queryClient = useQueryClient()

  const empresaCodigo = empresaCodigos[0] ?? null

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

  const handleSetEmpresas = useCallback((codigos: number[]) => {
    setEmpresas(codigos)
    queryClient.invalidateQueries()
  }, [setEmpresas, queryClient])

  const handleSetPeriodo = useCallback((dataInicial: string, dataFinal: string) => {
    setPeriodo(dataInicial, dataFinal)
    queryClient.invalidateQueries()
  }, [setPeriodo, queryClient])

  return {
    empresaCodigos,
    empresaCodigo,
    dataInicial,
    dataFinal,
    queryParams,
    periodoFormatado,
    setEmpresas: handleSetEmpresas,
    setPeriodo: handleSetPeriodo,
  }
}
