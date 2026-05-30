import { create } from 'zustand'
import type { UiChatMessage } from './ai/types'

/**
 * Estado da conversa ATUAL do Cadu, fora do componente do chat.
 *
 * Mora num store (e não no useState do ChatPanel) por dois motivos:
 *  1) trocar de aba (Chat ↔ Histórico) não desmonta/perde a conversa;
 *  2) o Histórico consegue CARREGAR uma conversa salva direto no chat.
 *
 * A persistência em si fica no Supabase (caduConversas) — aqui é só o estado vivo.
 */
interface CaduChatState {
  /** id da conversa salva (null = conversa nova, ainda não persistida). */
  conversaId: string | null
  messages: UiChatMessage[]
  setConversaId: (id: string | null) => void
  setMessages: (
    updater: UiChatMessage[] | ((curr: UiChatMessage[]) => UiChatMessage[]),
  ) => void
  /** Carrega uma conversa salva (ao abrir do Histórico). */
  loadConversa: (id: string, messages: UiChatMessage[]) => void
  /** Zera pra uma conversa nova. */
  newConversa: () => void
}

export const useCaduChat = create<CaduChatState>((set) => ({
  conversaId: null,
  messages: [],
  setConversaId: (conversaId) => set({ conversaId }),
  setMessages: (updater) =>
    set((s) => ({ messages: typeof updater === 'function' ? updater(s.messages) : updater })),
  loadConversa: (conversaId, messages) => set({ conversaId, messages }),
  newConversa: () => set({ conversaId: null, messages: [] }),
}))
