import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useFilterStore, type ComparisonMode } from '@/store/filters'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const VALID_COMPARISON: ComparisonMode[] = ['prevMonth', 'prevYear']

/**
 * Mantém o filter store sincronizado com a query string da URL.
 *
 * Fluxo:
 *  1. No primeiro mount, lê `?empresa=N` (ou `?empresas=N,M`), `?inicio=YYYY-MM-DD`
 *     e `?fim=YYYY-MM-DD` e popula a store. URL sempre vence localStorage —
 *     se o user colou um link específico, é porque quer aquela visão exata.
 *  2. Depois disso, qualquer mudança nos filtros (empresa/período) atualiza
 *     a URL via `history.replaceState` (sem navegar, sem rerender React Router).
 *
 * Resultado: usuários podem mandar links tipo
 * `/operacao?empresa=42&inicio=2026-04-01&fim=2026-04-30` e quem clica cai
 * na mesma visão. Bookmarks também funcionam.
 */
const useFiltersUrlSync = () => {
  const { pathname } = useLocation()
  const setEmpresas = useFilterStore((s) => s.setEmpresas)
  const setPeriodo = useFilterStore((s) => s.setPeriodo)
  const setComparisonMode = useFilterStore((s) => s.setComparisonMode)
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const comparisonMode = useFilterStore((s) => s.comparisonMode)

  const hydrated = useRef(false)

  // Hidratação one-shot a partir da URL inicial.
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true

    const sp = new URLSearchParams(window.location.search)
    const empresaRaw = sp.get('empresas') ?? sp.get('empresa')
    const inicio = sp.get('inicio')
    const fim = sp.get('fim')
    const cmp = sp.get('cmp') as ComparisonMode | null

    if (empresaRaw) {
      const codigos = empresaRaw
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
      if (codigos.length > 0) setEmpresas(codigos)
    }
    if (inicio && fim && DATE_RE.test(inicio) && DATE_RE.test(fim) && inicio <= fim) {
      setPeriodo(inicio, fim)
    }
    if (cmp && VALID_COMPARISON.includes(cmp)) {
      setComparisonMode(cmp)
    }
  }, [setEmpresas, setPeriodo, setComparisonMode])

  // Push de mudanças do store pra URL. replaceState evita poluir o histórico
  // de navegação — botão "voltar" continua trocando rota, não filtros.
  useEffect(() => {
    if (!hydrated.current) return

    const sp = new URLSearchParams(window.location.search)

    if (empresaCodigos.length === 0) {
      sp.delete('empresa')
      sp.delete('empresas')
    } else if (empresaCodigos.length === 1) {
      sp.set('empresa', String(empresaCodigos[0]))
      sp.delete('empresas')
    } else {
      sp.delete('empresa')
      sp.set('empresas', empresaCodigos.join(','))
    }
    sp.set('inicio', dataInicial)
    sp.set('fim', dataFinal)
    // Só serializa cmp quando difere do default (prevYear) — URL mais limpa.
    if (comparisonMode === 'prevYear') sp.delete('cmp')
    else sp.set('cmp', comparisonMode)

    const query = sp.toString()
    const url = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname
    window.history.replaceState(null, '', url)
    // pathname incluso de propósito: ao navegar entre módulos, React Router
    // descarta a query string — reaplicamos pra preservar a visão filtrada.
  }, [empresaCodigos, dataInicial, dataFinal, comparisonMode, pathname])
}

export default useFiltersUrlSync
