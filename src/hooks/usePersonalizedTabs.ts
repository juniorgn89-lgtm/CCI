import { useMemo } from 'react'
import { usePersonalizationStore, orderedVisibleTabIds } from '@/store/personalization'
import { moduleByPath, tabKey } from '@/lib/appStructure'
import { normalizePlano, tabAllowedByPlano } from '@/lib/access'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'

/** Teto do plano da rede pra abas (null = sem trava; master ignora). */
const useTabPlano = (): ReturnType<typeof normalizePlano> => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const redePlano = useTenantStore((s) => s.rede)?.plano
  return isMaster ? null : normalizePlano(redePlano)
}

/**
 * Filtra as abas de uma página pela personalização (visibilidade + ordem).
 *
 * `path` = rota do módulo (chave no store). `allTabs` = as abas que a página
 * pode mostrar AGORA (já contando permissões locais, ex.: Reabastecimento). O
 * retorno preserva os objetos originais da página (id/label/Icon/etc.), só
 * reordenados e filtrados. Se sobrar vazio (dono ocultou tudo), o chamador deve
 * cair na 1ª aba disponível.
 */
export function usePersonalizedTabs<T extends { id: string }>(path: string, allTabs: T[]): T[] {
  const hidden = usePersonalizationStore((s) => s.hidden)
  const tabOrder = usePersonalizationStore((s) => s.tabOrder)
  const plano = useTabPlano()
  return useMemo(() => {
    // Teto do plano primeiro (abas acima do plano nem existem), depois personalização.
    const planoTabs = allTabs.filter((t) => tabAllowedByPlano(path, t.id, plano))
    const ids = orderedVisibleTabIds(hidden, tabOrder, path, planoTabs.map((t) => t.id))
    const byId = new Map(planoTabs.map((t) => [t.id, t]))
    return ids.map((id) => byId.get(id)).filter((t): t is T => Boolean(t))
  }, [path, allTabs, hidden, tabOrder, plano])
}

interface ModuleTabSetting {
  id: string
  label: string
  visible: boolean
}

/**
 * Adaptador pro `<ModuleSettings>` (engrenagem in-context) escrever no MESMO
 * store de personalização. Retorna as abas do módulo (do registro appStructure)
 * na ordem personalizada, com visibilidade, + as ações no formato que a
 * engrenagem já espera. Assim a engrenagem e a tela central de Configurações
 * compartilham a fonte única — sem stores paralelas conflitando.
 */
export function useModuleTabSettings(path: string): {
  tabs: ModuleTabSetting[]
  toggleVisibility: (id: string) => void
  moveUp: (id: string) => void
  moveDown: (id: string) => void
  reset: () => void
} {
  const hidden = usePersonalizationStore((s) => s.hidden)
  const tabOrder = usePersonalizationStore((s) => s.tabOrder)
  const toggleTab = usePersonalizationStore((s) => s.toggleTab)
  const moveTab = usePersonalizationStore((s) => s.moveTab)
  const resetModuleTabs = usePersonalizationStore((s) => s.resetModuleTabs)
  const plano = useTabPlano()

  const tabs = useMemo<ModuleTabSetting[]>(() => {
    // Só as abas dentro do plano são personalizáveis.
    const defs = (moduleByPath(path)?.tabs ?? []).filter((t) => tabAllowedByPlano(path, t.id, plano))
    const order = tabOrder[path] ?? defs.map((t) => t.id)
    const byId = new Map(defs.map((t) => [t.id, t]))
    return order
      .map((id) => byId.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => ({ id: t.id, label: t.label, visible: !hidden.includes(tabKey(path, t.id)) }))
  }, [path, tabOrder, hidden, plano])

  return {
    tabs,
    toggleVisibility: (id) => toggleTab(path, id),
    moveUp: (id) => moveTab(path, id, 'up'),
    moveDown: (id) => moveTab(path, id, 'down'),
    reset: () => resetModuleTabs(path),
  }
}
