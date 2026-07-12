import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Config de notificação por posto (Cartões · Parâmetros).
 *
 * ⚠️ FASE 1: aqui só se SALVA a configuração. Nada é disparado — o envio real do
 * WhatsApp e a geração/assinatura do "link do dia" são fase posterior. Persistido
 * em localStorage; read-only em relação à API.
 */
export interface PostoNotifConfig {
  enabled: boolean
  gerente: string
  whatsapp: string
}

const emptyConfig: PostoNotifConfig = { enabled: false, gerente: '', whatsapp: '' }

interface CartoesParamsState {
  /** empresaCodigo → config de notificação. */
  byPosto: Record<number, PostoNotifConfig>
  setConfig: (empresaCodigo: number, config: PostoNotifConfig) => void
}

export const useCartoesParams = create<CartoesParamsState>()(
  persist(
    (set) => ({
      byPosto: {},
      setConfig: (empresaCodigo, config) =>
        set((s) => ({ byPosto: { ...s.byPosto, [empresaCodigo]: config } })),
    }),
    { name: 'visor360-cartoes-params', storage: createJSONStorage(() => localStorage) },
  ),
)

/** Lê a config de um posto (default vazio). */
export const getPostoConfig = (byPosto: Record<number, PostoNotifConfig>, empresaCodigo: number): PostoNotifConfig =>
  byPosto[empresaCodigo] ?? emptyConfig
