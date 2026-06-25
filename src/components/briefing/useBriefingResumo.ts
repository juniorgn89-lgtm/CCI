import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchApuracaoDiaria } from '@/api/supabase/apuracao'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { todayLocal } from '@/lib/period'

/**
 * Digest do Briefing Matinal: apurado de ONTEM (rede-wide, postos permitidos) —
 * Lucro Bruto, Margem e Litros de combustível — comparado ao MESMO DIA da semana
 * passada (ontem − 7d). Tudo FATO, do cache `apuracao_diaria`. Read-only.
 */

const isoMinusDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const weekdayName = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]
}

export interface BriefingResumo {
  isLoading: boolean
  hasData: boolean
  ontem: string
  diaSemana: string
  lb: number
  litros: number
  margem: number
  /** Δ% LB e litros vs mesmo dia da semana passada; Δ p.p. da margem. */
  deltaLB: number | null
  deltaLitros: number | null
  deltaMargemPp: number | null
}

const useBriefingResumo = (enabled: boolean): BriefingResumo => {
  const hoje = todayLocal()
  const ontem = useMemo(() => isoMinusDays(hoje, 1), [hoje])
  const semanaPassada = useMemo(() => isoMinusDays(ontem, 7), [ontem])

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
    enabled,
  })
  const permitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const codes = useMemo(() => permitidas.map((e) => e.codigo), [permitidas])
  const codesKey = codes.join(',')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['briefing-resumo', codesKey, semanaPassada, ontem],
    queryFn: () => fetchApuracaoDiaria({ empresaCodigos: codes, dataInicial: semanaPassada, dataFinal: ontem }),
    enabled: enabled && codes.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  return useMemo(() => {
    const agg = (data: string) => {
      let lb = 0, litros = 0, fat = 0
      for (const r of rows) {
        if (r.data !== data) continue
        lb += r.fuel_lucro_bruto
        litros += r.fuel_litros
        fat += r.fuel_faturamento
      }
      return { lb, litros, fat, margem: fat > 0 ? (lb / fat) * 100 : 0 }
    }
    const cur = agg(ontem)
    const prev = agg(semanaPassada)
    const pctDelta = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : null)
    return {
      isLoading,
      hasData: cur.litros > 0 || cur.lb !== 0,
      ontem,
      diaSemana: weekdayName(ontem),
      lb: cur.lb,
      litros: cur.litros,
      margem: cur.margem,
      deltaLB: pctDelta(cur.lb, prev.lb),
      deltaLitros: pctDelta(cur.litros, prev.litros),
      deltaMargemPp: prev.margem > 0 ? cur.margem - prev.margem : null,
    }
  }, [rows, ontem, semanaPassada, isLoading])
}

export default useBriefingResumo
