import { create } from 'zustand'
import type { TopBarTab } from '@/components/layout/TopBarTabs'
import { navItems, type NavItem } from '@/components/layout/navConfig'

/**
 * Telas (abas) do módulo aberto, publicadas pela própria página (ModuloAbas)
 * para o menu lateral em árvore e a trilha "Módulo › Tela" do topo. A página
 * continua dona da lista (permissões, plano, ocultos, segmento): o menu só
 * mostra o que ela publicou. `sidebarFixo` = menu lateral expandido fixo; com
 * ele recolhido as abas voltam a aparecer no topo da página.
 */
interface ModuloAbasState {
  path: string | null
  tabs: TopBarTab[]
  active: string
  onChange: ((id: string) => void) | null
  sidebarFixo: boolean
  publicar: (p: { path: string; tabs: TopBarTab[]; active: string; onChange: (id: string) => void }) => void
  limpar: (path: string) => void
  setSidebarFixo: (v: boolean) => void
}

export const useModuloAbas = create<ModuloAbasState>((set) => ({
  path: null,
  tabs: [],
  active: '',
  onChange: null,
  sidebarFixo: true,
  publicar: (p) => set(p),
  limpar: (path) => set((s) => (s.path === path ? { path: null, tabs: [], active: '', onChange: null } : s)),
  setSidebarFixo: (v) => set({ sidebarFixo: v }),
}))

/** Módulo do menu a que a rota pertence (ex.: /financeiro → Financeiro). */
export const moduloDaRota = (pathname: string): NavItem | null =>
  [...navItems].sort((a, b) => b.path.length - a.path.length)
    .find((i) => pathname === i.path || pathname.startsWith(`${i.path}/`)) ?? null
