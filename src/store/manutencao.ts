import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ManutencaoConfig {
  /** Intervalo de manutenção em litros */
  intervaloLitros: number
  /** Avisar quando atingir esse percentual */
  avisarAoAtingirPct: number
  /** Responsável pelo alerta (usuário do sistema) */
  responsavel: string
}

interface ManutencaoState {
  /** key: empresaCodigo → config de manutenção da empresa */
  configs: Record<number, ManutencaoConfig>

  setConfig: (empresaCodigo: number, config: ManutencaoConfig) => void
  clearConfig: (empresaCodigo: number) => void
}

/**
 * Config de manutenção por posto (intervalo de litros + % de aviso). O controle
 * de manutenção é 100% automático: desgaste = litros vendidos no período ÷
 * intervalo configurado. (O antigo modo manual + histórico foi removido.)
 */
export const useManutencaoStore = create<ManutencaoState>()(
  persist(
    (set) => ({
      configs: {},

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
