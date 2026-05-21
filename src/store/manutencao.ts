import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ManutencaoMode = 'auto' | 'manual'

export interface BombaManutencaoRecord {
  /** YYYY-MM-DD */
  dataUltima: string
  /** Litros bombeados acumulados no momento da última manutenção (somente modo manual) */
  litrosUltima: number
}

export interface ManutencaoConfig {
  /** Intervalo de manutenção em litros */
  intervaloLitros: number
  /** Avisar quando atingir esse percentual */
  avisarAoAtingirPct: number
  /** Responsável pelo alerta (usuário do sistema) */
  responsavel: string
}

/** Quantas manutenções manter por bomba (FIFO — descarta mais antigas) */
export const MAX_MANUTENCAO_HISTORY = 4

interface ManutencaoState {
  mode: ManutencaoMode
  /** key: `${empresaCodigo}_${bombaCodigo}` → histórico (mais recente primeiro, máx 4) */
  manutencoes: Record<string, BombaManutencaoRecord[]>
  /** key: empresaCodigo → config de alerta da empresa */
  configs: Record<number, ManutencaoConfig>

  setMode: (m: ManutencaoMode) => void
  setManutencao: (
    empresaCodigo: number,
    bombaCodigo: number,
    record: BombaManutencaoRecord,
  ) => void
  clearManutencao: (empresaCodigo: number, bombaCodigo: number) => void
  setConfig: (empresaCodigo: number, config: ManutencaoConfig) => void
  clearConfig: (empresaCodigo: number) => void
}

const key = (empresaCodigo: number, bombaCodigo: number) => `manutencao_${empresaCodigo}_${bombaCodigo}`

export const useManutencaoStore = create<ManutencaoState>()(
  persist(
    (set) => ({
      mode: 'auto',
      manutencoes: {},
      configs: {},

      setMode: (mode) => set({ mode }),
      setManutencao: (empresaCodigo, bombaCodigo, record) =>
        set((state) => {
          const k = key(empresaCodigo, bombaCodigo)
          const previous = state.manutencoes[k] ?? []
          // Prepend nova manutenção, descarta mais antigas se passar do limite
          const next = [record, ...previous].slice(0, MAX_MANUTENCAO_HISTORY)
          return {
            manutencoes: { ...state.manutencoes, [k]: next },
          }
        }),
      clearManutencao: (empresaCodigo, bombaCodigo) =>
        set((state) => {
          const next = { ...state.manutencoes }
          delete next[key(empresaCodigo, bombaCodigo)]
          return { manutencoes: next }
        }),
      setConfig: (empresaCodigo, config) =>
        set((state) => ({
          configs: { ...state.configs, [empresaCodigo]: config },
        })),
      clearConfig: (empresaCodigo) =>
        set((state) => {
          const next = { ...state.configs }
          delete next[empresaCodigo]
          return { configs: next }
        }),
    }),
    { name: 'visor360-manutencao', version: 2 }
  )
)

/** Default fallback when there's no config for the empresa */
export const DEFAULT_CONFIG: ManutencaoConfig = {
  intervaloLitros: 100_000,
  avisarAoAtingirPct: 80,
  responsavel: '',
}

export const getConfigOrDefault = (
  configs: Record<number, ManutencaoConfig>,
  empresaCodigo: number | null,
): ManutencaoConfig => {
  if (empresaCodigo && configs[empresaCodigo]) return configs[empresaCodigo]
  return DEFAULT_CONFIG
}

/** Retorna a última manutenção registrada (mais recente do array) ou null. */
export const getManutencao = (
  manutencoes: Record<string, BombaManutencaoRecord[]>,
  empresaCodigo: number | null,
  bombaCodigo: number,
): BombaManutencaoRecord | null => {
  if (!empresaCodigo) return null
  const arr = manutencoes[key(empresaCodigo, bombaCodigo)]
  return arr && arr.length > 0 ? arr[0] : null
}

/** Retorna o histórico completo (até 4 entradas) ou array vazio. */
export const getManutencaoHistory = (
  manutencoes: Record<string, BombaManutencaoRecord[]>,
  empresaCodigo: number | null,
  bombaCodigo: number,
): BombaManutencaoRecord[] => {
  if (!empresaCodigo) return []
  return manutencoes[key(empresaCodigo, bombaCodigo)] ?? []
}
