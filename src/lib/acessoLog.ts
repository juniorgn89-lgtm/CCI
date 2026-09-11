import { supabase } from '@/lib/supabase'
import { useTenantStore } from '@/store/tenant'
import { navItems } from '@/components/layout/navConfig'

/**
 * Registro de uso (aba "Controle de acesso"). Grava cada visita de tela numa
 * tabela interna do Supabase (`acesso_log`) — NUNCA toca a API Quality. É
 * fire-and-forget e engole erros: telemetria jamais pode quebrar a navegação.
 */

const labelByPath = new Map(navItems.map((i) => [i.path, i.label]))

/** Rótulo amigável do módulo a partir da rota (pra "telas mais acessadas"). */
export const moduloLabel = (path: string): string => {
  const clean = path.split('?')[0]
  if (labelByPath.has(clean)) return labelByPath.get(clean)!
  const hit = navItems.find((i) => clean === i.path || clean.startsWith(i.path + '/'))
  if (hit) return hit.label
  if (clean.startsWith('/painel')) return 'Painel'
  if (clean === '/mobile') return 'App Gerente'
  if (clean.startsWith('/frentista')) return 'Frentista'
  return clean
}

// Anti-duplicata: StrictMode e re-renders disparam a mesma rota em sequência.
let last = { path: '', at: 0 }

/** Grava uma visita de tela. Silencioso se não houver rede/sessão. */
export const logAcesso = (path: string): void => {
  if (!supabase) return
  const rede = useTenantStore.getState().rede
  if (!rede?.id) return
  const clean = path.split('?')[0]
  const now = Date.now()
  if (last.path === clean && now - last.at < 3000) return
  last = { path: clean, at: now }
  supabase
    .from('acesso_log')
    .insert({ rede_id: rede.id, path: clean, modulo: moduloLabel(clean) })
    .then(() => {}, () => {}) // telemetria não quebra o app
}
