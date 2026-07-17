import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRedeSetorDiaria } from '@/pages/Operacao/hooks/useRedeVendasCache'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { todayLocal } from '@/lib/period'
import { weekdayIndices, diasOperacaoProxy } from '@/lib/projection'

/**
 * Índices SAZONAIS (dia-da-semana) da Central, POR SETOR na rede e POR MÉTRICA
 * (faturamento / qtd / lucro), a partir de 6 meses de histórico do cache
 * (`useRedeVendasCache`). É o MESMO índice rede-wide que as abas Combustível/
 * Pista/Conveniência usam (via `useProjecaoSazonalPiloto`), pra o painel de
 * Projeção e a tabela por posto baterem com as abas. Ramo linear (<90d de
 * histórico do setor) devolve `{}` → `projecaoSazonal`/`weekdayMonthEndFactor`
 * recaem no método linear. Ver docs/SPEC-projecao-sazonal.md e
 * [[project_projecao_sazonal]].
 */

type SetorId = 'combustivel' | 'automotivos' | 'conveniencia'
type Metrica = 'faturamento' | 'qtd' | 'lucro'
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
  /** Índice de dia-da-semana do SETOR na rede, por métrica. `{}` = linear. */
  indice: (setor: SetorId, metrica: Metrica) => Record<number, number>
}

const useCentralSazonal = (): CentralSazonal => {
  const { empresaCodigos, dataInicial } = useFilterStore()
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const permitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const permittedCodes = useMemo(() => new Set(permitidas.map((e) => e.codigo)), [permitidas])
  const monthStart = `${(dataInicial || todayLocal()).slice(0, 7)}-01`
  const histIni = monthsBackFirst(monthStart, 6)
  const histEnd = prevDay(monthStart)
  // Agregado leve por setor/dia (view) — a sazonal só precisa da série por
  // setor, então trocamos o read granular por produto pela view (675 páginas → 1–3).
  const { data: histRows = [], isLoading } = useRedeSetorDiaria(histIni, histEnd)

  return useMemo(() => {
    // Escopo: "Todos" ([]) = postos PERMITIDOS (igual às abas e ao useRedeSetores).
    const match = (code: number) => (empresaCodigos.length === 0 ? permittedCodes.has(code) : empresaCodigos.includes(code))
    // Série diária por setor × métrica (+ 1ª venda p/ dias_operação do setor).
    const byDay = new Map<SetorId, Map<string, { fat: number; qtd: number; luc: number }>>(
      SETORES.map((s) => [s, new Map<string, { fat: number; qtd: number; luc: number }>()]),
    )
    const first = new Map<SetorId, string>()
    for (const r of histRows) {
      const setor = r.setor as SetorId
      if (!SETORES.includes(setor) || !match(r.empresa_codigo) || r.quantidade <= 0) continue
      const dm = byDay.get(setor)!
      const e = dm.get(r.data) ?? { fat: 0, qtd: 0, luc: 0 }
      e.fat += r.total_venda; e.qtd += r.quantidade; e.luc += r.total_venda - r.total_custo
      dm.set(r.data, e)
      const f = first.get(setor)
      if (!f || r.data < f) first.set(setor, r.data)
    }
    const today = todayLocal()
    const serie = (dm: Map<string, { fat: number; qtd: number; luc: number }>, k: 'fat' | 'qtd' | 'luc') =>
      [...dm.entries()].map(([data, v]) => ({ data, value: v[k] })).sort((a, b) => a.data.localeCompare(b.data))

    const idx = new Map<string, Record<number, number>>()
    for (const s of SETORES) {
      const dm = byDay.get(s)!
      // <90d de histórico do setor → linear (índice vazio).
      const linear = diasOperacaoProxy(first.get(s) ?? null, today) < 90
      idx.set(`${s}|faturamento`, linear ? EMPTY : weekdayIndices(serie(dm, 'fat')))
      idx.set(`${s}|qtd`, linear ? EMPTY : weekdayIndices(serie(dm, 'qtd')))
      idx.set(`${s}|lucro`, linear ? EMPTY : weekdayIndices(serie(dm, 'luc')))
    }

    return {
      isLoading,
      indice: (setor: SetorId, metrica: Metrica) => idx.get(`${setor}|${metrica}`) ?? EMPTY,
    }
  }, [histRows, isLoading, empresaCodigos, permittedCodes])
}

export default useCentralSazonal
