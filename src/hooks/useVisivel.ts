import { useMemo } from 'react'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { usePersonalizationStore } from '@/store/personalization'
import { MODULOS } from '@/lib/modulos'
import { tabKey } from '@/lib/appStructure'
import { normalizePlano, moduloAllowedByPlano, tabAllowedByPlano } from '@/lib/access'
import { useEscopoSegmento, abaOcultaPorSegmento, moduloOcultoPorSegmento } from '@/hooks/useEscopoSegmento'
import { useOcultosCCI } from '@/hooks/useOcultosCCI'

const moduloIdByPath = new Map(MODULOS.map((m) => [m.path, m.id]))

export interface Visivel {
  /** O módulo aparece para esta pessoa (permissão, plano, ocultos da CCI, personalização, segmento)? */
  modulo: (path: string) => boolean
  /** A aba aparece (módulo visível + aba não oculta por nenhuma das camadas)? */
  aba: (path: string, tabId: string) => boolean
}

/**
 * Regra ÚNICA de "isto está à vista?" — a mesma soma de camadas do menu lateral
 * (Sidebar) e das abas (usePersonalizedTabs). Use em todo pedaço de tela que
 * mostra ou leva para OUTRO módulo/aba (atalho, cartão, botão, link): se o
 * destino foi ocultado, o pedaço some junto, sem deixar pista do que foi escondido.
 */
export const useVisivel = (): Visivel => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const modulosPermitidos = useAuthStore((s) => s.modulosPermitidos)
  const rede = useTenantStore((s) => s.rede)
  const hidden = usePersonalizationStore((s) => s.hidden)
  const segmento = useEscopoSegmento()
  const ocultosCCI = useOcultosCCI()

  return useMemo(() => {
    const plano = isMaster ? null : normalizePlano(rede?.plano)
    const ocultos = new Set(hidden)
    const modulo = (path: string) => {
      if (path === '/gestao' && !rede?.gestao_habilitado) return false
      if (path === '/compras' && !rede?.compras_habilitado) return false
      if (!isMaster) {
        const id = moduloIdByPath.get(path)
        if (id && modulosPermitidos && modulosPermitidos.length > 0 && !modulosPermitidos.includes(id)) return false
        if (!moduloAllowedByPlano(path, plano)) return false
      }
      return !ocultos.has(path) && !moduloOcultoPorSegmento(path, segmento) && !ocultosCCI.modulo(path)
    }
    const aba = (path: string, tabId: string) =>
      modulo(path)
      && tabAllowedByPlano(path, tabId, plano)
      && !abaOcultaPorSegmento(path, tabId, segmento)
      && !ocultosCCI.aba(path, tabId)
      && !ocultos.has(tabKey(path, tabId))
    return { modulo, aba }
  }, [isMaster, modulosPermitidos, rede, hidden, segmento, ocultosCCI])
}

export default useVisivel
