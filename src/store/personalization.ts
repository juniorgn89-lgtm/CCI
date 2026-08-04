import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlanoId } from '@/lib/planos'
import {
  APP_STRUCTURE,
  tabKey,
  incluidoNoPlano,
  moduleByPath,
} from '@/lib/appStructure'

/**
 * Personalização do app (por navegador): quais MÓDULOS e ABAS o dono mostra,
 * em que ORDEM, e um preset de PLANO opcional.
 *
 * Modelo MATERIALIZADO: o store guarda o conjunto REAL de itens ocultos e a
 * ordem atual — não um diff. Assim a leitura (Sidebar, páginas, tela de
 * Configurações) é direta e o "Aplicar plano" só reescreve o estado.
 *
 * Preset de plano é REVERSÍVEL (decisão de produto): aplicar um plano marca as
 * peças daquele plano como visíveis e as de cima como ocultas — o dono ainda
 * mostra/oculta o que quiser depois. Nada trava de vez. A trava REAL de acesso
 * continua na permissão (`profiles.modulos_permitidos`), que é o teto — a
 * personalização só esconde/reordena DENTRO do que a permissão libera.
 *
 * Chaves: módulo = `path`; aba = `${path}::${tabId}` (ver appStructure.tabKey).
 */

interface PersonalizationState {
  /** Itens ocultos (paths de módulo + chaves de aba). */
  hidden: string[]
  /** Ordem dos módulos (paths). */
  moduleOrder: string[]
  /** Ordem das abas por módulo (path → tabIds). */
  tabOrder: Record<string, string[]>
  /** Último plano aplicado como preset (só p/ UI destacar). null = manual. */
  planoApplied: PlanoId | null

  toggleModule: (path: string) => void
  toggleTab: (path: string, tabId: string) => void
  moveModule: (path: string, dir: 'up' | 'down') => void
  moveTab: (path: string, tabId: string, dir: 'up' | 'down') => void
  applyPlano: (plano: PlanoId) => void
  /** Restaura só as abas de um módulo (visibilidade + ordem) ao padrão. */
  resetModuleTabs: (path: string) => void
  reset: () => void
}

/* ─── Defaults derivados da estrutura ─── */

const defaultModuleOrder = (): string[] => APP_STRUCTURE.map((m) => m.path)

const defaultTabOrder = (): Record<string, string[]> =>
  Object.fromEntries(APP_STRUCTURE.map((m) => [m.path, m.tabs.map((t) => t.id)]))

/** Sem plano: tudo visível, menos as abas marcadas `defaultHidden`. */
const defaultHidden = (): string[] =>
  APP_STRUCTURE.flatMap((m) => m.tabs.filter((t) => t.defaultHidden).map((t) => tabKey(m.path, t.id)))

/** Ocultos de um preset de plano: módulos e abas acima do tier + os defaultHidden. */
const hiddenForPlano = (plano: PlanoId): string[] => {
  const out: string[] = []
  for (const m of APP_STRUCTURE) {
    if (!incluidoNoPlano(m.plano, plano)) {
      out.push(m.path)
      continue
    }
    for (const t of m.tabs) {
      if (t.defaultHidden || !incluidoNoPlano(t.plano, plano)) out.push(tabKey(m.path, t.id))
    }
  }
  return out
}

const move = <T,>(arr: T[], item: T, dir: 'up' | 'down'): T[] => {
  const i = arr.indexOf(item)
  if (i < 0) return arr
  const j = dir === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= arr.length) return arr
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export const usePersonalizationStore = create<PersonalizationState>()(
  persist(
    (set) => ({
      hidden: defaultHidden(),
      moduleOrder: defaultModuleOrder(),
      tabOrder: defaultTabOrder(),
      planoApplied: null,

      toggleModule: (path) =>
        set((s) => ({
          planoApplied: null,
          hidden: s.hidden.includes(path)
            ? s.hidden.filter((h) => h !== path)
            : [...s.hidden, path],
        })),

      toggleTab: (path, tabId) =>
        set((s) => {
          const key = tabKey(path, tabId)
          return {
            planoApplied: null,
            hidden: s.hidden.includes(key)
              ? s.hidden.filter((h) => h !== key)
              : [...s.hidden, key],
          }
        }),

      // Reordena DENTRO do grupo do módulo (o Sidebar mantém as seções). Troca
      // a posição do módulo com o vizinho do MESMO grupo na ordem global.
      moveModule: (path, dir) =>
        set((s) => {
          const grp = moduleByPath(path)?.group
          if (!grp) return s
          const groupPaths = s.moduleOrder.filter((p) => moduleByPath(p)?.group === grp)
          const gi = groupPaths.indexOf(path)
          const gj = dir === 'up' ? gi - 1 : gi + 1
          if (gj < 0 || gj >= groupPaths.length) return s
          const neighbor = groupPaths[gj]
          const next = [...s.moduleOrder]
          const pi = next.indexOf(path)
          const ni = next.indexOf(neighbor)
          ;[next[pi], next[ni]] = [next[ni], next[pi]]
          return { planoApplied: null, moduleOrder: next }
        }),

      moveTab: (path, tabId, dir) =>
        set((s) => ({
          planoApplied: null,
          tabOrder: { ...s.tabOrder, [path]: move(s.tabOrder[path] ?? defaultTabOrder()[path] ?? [], tabId, dir) },
        })),

      applyPlano: (plano) =>
        set({
          hidden: hiddenForPlano(plano),
          moduleOrder: defaultModuleOrder(),
          tabOrder: defaultTabOrder(),
          planoApplied: plano,
        }),

      resetModuleTabs: (path) =>
        set((s) => {
          const mod = moduleByPath(path)
          if (!mod) return s
          const tabIds = new Set(mod.tabs.map((t) => t.id))
          // Remove qualquer chave de aba deste módulo do hidden…
          const cleared = s.hidden.filter((h) => {
            const [p, id] = h.split('::')
            return !(p === path && id && tabIds.has(id))
          })
          // …e reinsere só as defaultHidden. Ordem das abas volta ao padrão.
          const reAdd = mod.tabs.filter((t) => t.defaultHidden).map((t) => tabKey(path, t.id))
          return {
            planoApplied: null,
            hidden: [...cleared, ...reAdd],
            tabOrder: { ...s.tabOrder, [path]: mod.tabs.map((t) => t.id) },
          }
        }),

      reset: () =>
        set({
          hidden: defaultHidden(),
          moduleOrder: defaultModuleOrder(),
          tabOrder: defaultTabOrder(),
          planoApplied: null,
        }),
    }),
    {
      name: 'visor360-personalization-v1',
      version: 1,
      // Re-sincroniza ordens com a estrutura atual (adiciona módulos/abas novos
      // no fim, remove os que sumiram) preservando a customização do usuário.
      migrate: (persisted) => {
        if (!persisted) return persisted as PersonalizationState
        const s = persisted as PersonalizationState
        const knownPaths = new Set(APP_STRUCTURE.map((m) => m.path))
        const mergedModules = [
          ...s.moduleOrder.filter((p) => knownPaths.has(p)),
          ...APP_STRUCTURE.map((m) => m.path).filter((p) => !s.moduleOrder.includes(p)),
        ]
        const mergedTabs: Record<string, string[]> = {}
        for (const m of APP_STRUCTURE) {
          const prev = s.tabOrder?.[m.path] ?? []
          const known = new Set(m.tabs.map((t) => t.id))
          mergedTabs[m.path] = [
            ...prev.filter((id) => known.has(id)),
            ...m.tabs.map((t) => t.id).filter((id) => !prev.includes(id)),
          ]
        }
        return { ...s, moduleOrder: mergedModules, tabOrder: mergedTabs }
      },
    },
  ),
)

/* ─── Selectors / helpers (puros, recebem os slices — evita recomputo instável) ─── */

/** Módulos (paths) visíveis, na ordem personalizada. NÃO aplica permissão —
 * o chamador (Sidebar) intersecta com o gate de permissão. */
export const orderedVisibleModulePaths = (hidden: string[], moduleOrder: string[]): string[] =>
  moduleOrder.filter((path) => moduleByPath(path) && !hidden.includes(path))

/**
 * Abas visíveis de um módulo, na ordem personalizada, RESTRITAS às abas que a
 * página realmente tem (`availableIds` — ex.: Reabastecimento some sem permissão).
 * Retorna os ids na ordem final; o chamador reindexa suas próprias defs.
 */
export const orderedVisibleTabIds = (
  hidden: string[],
  tabOrder: Record<string, string[]>,
  path: string,
  availableIds: string[],
): string[] => {
  const order = tabOrder[path] ?? availableIds
  const avail = new Set(availableIds)
  return order.filter((id) => avail.has(id) && !hidden.includes(tabKey(path, id)))
}
