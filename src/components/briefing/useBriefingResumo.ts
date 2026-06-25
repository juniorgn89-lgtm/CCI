import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchApuracaoDiaria } from '@/api/supabase/apuracao'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { todayLocal } from '@/lib/period'

/**
 * Digest do Briefing Matinal: apurado de ONTEM (rede-wide, postos permitidos) —
 * Lucro Bruto, Litros e Lucro/litro (LB÷litros) — comparado ao MESMO DIA da
 * semana passada (ontem − 7d). Tudo FATO, do cache `apuracao_diaria`. Read-only.
 *
 * NÃO expõe margem% (era frágil: inflava p/ ~88-100% quando o custo do dia vinha
 * incompleto). O setor lê Lucro/litro. Também expõe a decomposição volume×margem
 * (efeito de cada um na variação de LB) p/ a frase de leitura determinística.
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
  /** Lucro por litro (R$/L) = LB ÷ litros — métrica que o setor lê. */
  lbPorLitro: number
  /** Δ% vs mesmo dia da semana passada. */
  deltaLB: number | null
  deltaLitros: number | null
  deltaLbPorLitroPct: number | null
  /** Δ absoluto do lucro/litro (R$/L) — usado na frase de leitura. */
  deltaLbPorLitroAbs: number | null
  /** Decomposição da ΔLB: efeito volume (Δlitros × R$/L ant.) + efeito margem
   *  (ΔR$/L × litros atual). A soma = ΔLB. */
  volumeEffect: number
  marginEffect: number
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
      let lb = 0, litros = 0
      for (const r of rows) {
        if (r.data !== data) continue
        lb += r.fuel_lucro_bruto
        litros += r.fuel_litros
      }
      return { lb, litros, lbPorLitro: litros > 0 ? lb / litros : 0 }
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
      lbPorLitro: cur.lbPorLitro,
      deltaLB: pctDelta(cur.lb, prev.lb),
      deltaLitros: pctDelta(cur.litros, prev.litros),
      deltaLbPorLitroPct: prev.lbPorLitro > 0 ? ((cur.lbPorLitro - prev.lbPorLitro) / prev.lbPorLitro) * 100 : null,
      deltaLbPorLitroAbs: prev.litros > 0 ? cur.lbPorLitro - prev.lbPorLitro : null,
      volumeEffect: (cur.litros - prev.litros) * prev.lbPorLitro,
      marginEffect: (cur.lbPorLitro - prev.lbPorLitro) * cur.litros,
    }
  }, [rows, ontem, semanaPassada, isLoading])
}

export default useBriefingResumo
