import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useRedeVendasCache } from '@/pages/Operacao/hooks/useRedeVendasCache'
import { todayLocal } from '@/lib/period'
import { weekdayIndices, diasOperacaoProxy } from '@/lib/projection'

/**
 * Índices SAZONAIS (dia-da-semana) da Central, POR POSTO+setor e POR SETOR na
 * rede, a partir de 6 meses de histórico do cache (`useRedeVendasCache`). O
 * ProjecoesPainel e a BenchmarkSetor consomem o MESMO índice per-posto e somam
 * por posto → painel e tabela batem número a número. `indicesSetor` (rede-wide)
 * alimenta só o gráfico de oscilação (agregado por setor). Ramo linear (<90d de
 * operação) devolve `{}` → `weekdayMonthEndFactor` recai no `monthEndFactor`.
 * Ver docs/SPEC-projecao-sazonal.md e [[project_projecao_sazonal]].
 */

type SetorId = 'combustivel' | 'automotivos' | 'conveniencia'
const SETORES: SetorId[] = ['combustivel', 'automotivos', 'conveniencia']
const EMPTY: Record<number, number> = {}

const monthsBackFirst = (iso: string, n: number): string => {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(y, m - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const prevDay = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export interface CentralSazonal {
  isLoading: boolean
  /** Índice de dia-da-semana (faturamento) do POSTO+setor. `{}` = linear. */
  indicesDe: (empresaCodigo: number, setor: SetorId) => Record<number, number>
  /** Índice de dia-da-semana (faturamento) do SETOR na rede (gráfico de oscilação). */
  indicesSetor: (setor: SetorId) => Record<number, number>
}

const useCentralSazonal = (): CentralSazonal => {
  const { empresaCodigos, dataInicial } = useFilterStore()
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const permitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const permittedCodes = useMemo(() => new Set(permitidas.map((e) => e.codigo)), [permitidas])

  const monthStart = `${(dataInicial || todayLocal()).slice(0, 7)}-01`
  const histIni = monthsBackFirst(monthStart, 6)
  const histEnd = prevDay(monthStart)
  const { data: histRows = [], isLoading } = useRedeVendasCache(histIni, histEnd)

  return useMemo(() => {
    const match = (code: number) => (empresaCodigos.length === 0 ? permittedCodes.has(code) : empresaCodigos.includes(code))
    // Série diária de FATURAMENTO por posto+setor (+ 1ª venda p/ dias_operação) e por setor.
    const byPosto = new Map<string, Map<string, number>>()
    const firstByPosto = new Map<string, string>()
    const bySetor = new Map<SetorId, Map<string, number>>(SETORES.map((s) => [s, new Map<string, number>()]))
    for (const r of histRows) {
      const setor = r.setor as SetorId
      if (!SETORES.includes(setor) || !match(r.empresa_codigo) || r.total_venda <= 0) continue
      const pk = `${r.empresa_codigo}|${setor}`
      let dm = byPosto.get(pk)
      if (!dm) { dm = new Map(); byPosto.set(pk, dm) }
      dm.set(r.data, (dm.get(r.data) ?? 0) + r.total_venda)
      const f = firstByPosto.get(pk)
      if (!f || r.data < f) firstByPosto.set(pk, r.data)
      const sm = bySetor.get(setor)!
      sm.set(r.data, (sm.get(r.data) ?? 0) + r.total_venda)
    }
    const serie = (m: Map<string, number>) =>
      [...m.entries()].map(([data, value]) => ({ data, value })).sort((a, b) => a.data.localeCompare(b.data))
    const today = todayLocal()
    const idxPosto = new Map<string, Record<number, number>>()
    for (const [pk, dm] of byPosto) {
      // <90d de operação → linear (índice vazio → weekdayMonthEndFactor = monthEndFactor).
      const diasOp = diasOperacaoProxy(firstByPosto.get(pk) ?? null, today)
      idxPosto.set(pk, diasOp < 90 ? EMPTY : weekdayIndices(serie(dm)))
    }
    const idxSetor = new Map<SetorId, Record<number, number>>()
    for (const s of SETORES) idxSetor.set(s, weekdayIndices(serie(bySetor.get(s)!)))

    return {
      isLoading,
      indicesDe: (emp: number, setor: SetorId) => idxPosto.get(`${emp}|${setor}`) ?? EMPTY,
      indicesSetor: (setor: SetorId) => idxSetor.get(setor) ?? EMPTY,
    }
  }, [histRows, isLoading, empresaCodigos, permittedCodes])
}

export default useCentralSazonal
