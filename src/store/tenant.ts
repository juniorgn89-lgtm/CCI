import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { PlanoId } from '@/lib/planos'

/**
 * Tenant atual — rede de postos cuja CHAVE Quality e base URL o app está
 * usando para todas as requisições. Persiste no localStorage pra que master
 * não precise reescolher a rede a cada reload.
 *
 * Para gerente (master): valor é populado pela tela /selecionar-rede.
 * Para supervisor/frentista: populado pelo bootstrap em App.tsx a partir
 * do rede_id do profile/frentistas (rede deles é fixa).
 *
 * Fallback: enquanto não houver `rede`, o client interceptor usa
 * VITE_API_KEY do env (compat durante migração).
 */
export interface Rede {
  id: string
  nome: string
  chave: string
  api_base_url: string
  /**
   * Plano comercial da rede (Basic/Premium/Pro). Opcional: redes lidas antes da
   * migration `supabase-redes-plano.sql` (ou sem plano definido) vêm sem ele —
   * a UI cai num estado neutro ("Não definido"). Ver src/lib/planos.ts.
   */
  plano?: PlanoId | null
}

interface TenantState {
  rede: Rede | null
  isLoading: boolean
  setRede: (rede: Rede | null) => void
  setLoading: (v: boolean) => void
  clear: () => void
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      rede: null,
      isLoading: false,
      setRede: (rede) => set({ rede, isLoading: false }),
      setLoading: (v) => set({ isLoading: v }),
      clear: () => set({ rede: null, isLoading: false }),
    }),
    {
      name: 'visor360-tenant',
      storage: createJSONStorage(() => localStorage),
      // isLoading não vale a pena persistir
      partialize: (state) => ({ rede: state.rede }),
    }
  )
)

/**
 * Rede de DEMONSTRAÇÃO = aquela cujo `api_base_url` aponta pra Edge Function
 * `mock-quality` (dados fictícios determinísticos, postos Aurora). Detecção por
 * URL evita hardcode de id e cobre qualquer rede-demo futura. Usada pra fixar o
 * período no mês atual (o cron mantém apurado) — a demo "só traz os dados",
 * sem depender do mês escolhido.
 */
export const isDemoRede = (rede: Rede | null | undefined): boolean =>
  !!rede?.api_base_url && rede.api_base_url.includes('mock-quality')

/** Hook de conveniência: a rede atual é a de demonstração? */
export const useIsDemo = (): boolean => useTenantStore((s) => isDemoRede(s.rede))

/**
 * Escape hatch de GRAVAÇÃO: por padrão a demo fixa o período no mês atual e
 * esconde o calendário (chip "Mês atual"). Pra gravar o vídeo de treino (cena do
 * período), quem grava liga o calendário de volta sem afetar os usuários — via
 * `?cal=1` na URL ou `localStorage['visor360.demoperiodo']='on'`. Recarregue a
 * página depois de setar. Não-reativo de propósito (lido no render).
 */
export const demoPeriodUnlocked = (): boolean => {
  try {
    if (new URLSearchParams(window.location.search).get('cal') === '1') return true
    return localStorage.getItem('visor360.demoperiodo') === 'on'
  } catch {
    return false
  }
}

/** Demo COM o período travado (chip + pin) — falso quando o escape hatch está on. */
export const useIsDemoPeriodLocked = (): boolean =>
  useTenantStore((s) => isDemoRede(s.rede)) && !demoPeriodUnlocked()
