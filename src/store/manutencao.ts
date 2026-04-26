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

interface ManutencaoState {
  mode: ManutencaoMode
  /** key: `${empresaCodigo}_${bombaCodigo}` → última manutenção registrada */
  manutencoes: Record<string, BombaManutencaoRecord>
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
        set((state) => ({
          manutencoes: { ...state.manutencoes, [key(empresaCodigo, bombaCodigo)]: record },
        })),
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
    { name: 'ccisga-manutencao' }
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

export const getManutencao = (
  manutencoes: Record<string, BombaManutencaoRecord>,
  empresaCodigo: number | null,
  bombaCodigo: number,
): BombaManutencaoRecord | null => {
  if (!empresaCodigo) return null
  return manutencoes[key(empresaCodigo, bombaCodigo)] ?? null
}
