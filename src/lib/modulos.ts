/**
 * Catálogo de módulos da aplicação web (gerente/supervisor/user).
 *
 * Cada usuário pode ter um subconjunto desses módulos liberados via
 * `profiles.modulos_permitidos` (array de ids). Regras:
 *   - master (is_master=true) sempre vê tudo, ignora a coluna
 *   - null/[] = sem restrição (vê todos)
 *   - lista com ids = vê apenas os marcados
 *
 * Rotas fora desse catálogo (Configurações, /admin/*) são sempre acessíveis —
 * o gate é apenas pra módulos analíticos.
 */
import type { PlanoId } from '@/lib/planos'
import { pathAllowedByPlano, moduloAllowedByPlano } from '@/lib/access'

export interface ModuloInfo {
  id: string
  label: string
  path: string
}

export const MODULOS: ModuloInfo[] = [
  { id: 'dashboard', label: 'Central da Rede', path: '/dashboard' },
  // id mantido como 'bombas' (chave de permissão em profiles.modulos_permitidos)
  // pra não quebrar grants existentes — o módulo virou "Operação" (Bombas + Reabastecimento).
  { id: 'bombas', label: 'Operação', path: '/operacao' },
  { id: 'produtividade', label: 'Produtividade', path: '/produtividade' },
  { id: 'estoques', label: 'Estoques', path: '/estoques' },
  { id: 'financeiro', label: 'Financeiro', path: '/financeiro' },
  { id: 'qualidade-dados', label: 'Qualidade de Dados', path: '/qualidade-dados' },
  { id: 'pessoas', label: 'Pessoas', path: '/pessoas' },
  { id: 'comercial', label: 'Comercial · Lucro', path: '/comercial' },
  { id: 'inteligencia', label: 'Inteligência', path: '/inteligencia' },
  // Compliance ANP entra no gate de permissão (antes furava — sempre visível).
  { id: 'compliance', label: 'Compliance ANP', path: '/compliance' },
]

/** Encontra qual módulo do catálogo corresponde a um pathname. */
const findModuloForPath = (pathname: string): ModuloInfo | undefined =>
  MODULOS.find((m) => pathname === m.path || pathname.startsWith(m.path + '/'))

/**
 * Verifica se um pathname é acessível pelo usuário.
 *
 * Acesso efetivo = permissão por usuário (`modulosPermitidos`) ∩ teto do PLANO
 * da rede (`plano`, fail-open se null). Rotas não mapeadas (ex: /configuracoes,
 * /admin/*) sempre passam. Master ignora tudo.
 */
export const isPathAllowed = (
  pathname: string,
  modulosPermitidos: string[] | null,
  isMaster: boolean,
  plano: PlanoId | null = null,
): boolean => {
  if (isMaster) return true
  // Teto do plano (independente da permissão).
  if (!pathAllowedByPlano(pathname, plano)) return false
  if (!modulosPermitidos || modulosPermitidos.length === 0) return true
  const mod = findModuloForPath(pathname)
  if (!mod) return true
  return modulosPermitidos.includes(mod.id)
}

/**
 * Primeira rota permitida para o usuário. Usada como destino de redirect
 * quando ele tenta acessar um módulo bloqueado ou ao carregar a raiz. Respeita
 * permissão E plano. Fallback: /configuracoes (sempre acessível).
 */
export const firstAllowedPath = (
  modulosPermitidos: string[] | null,
  isMaster: boolean,
  plano: PlanoId | null = null,
): string => {
  if (isMaster) return '/dashboard'
  const semRestricaoPermissao = !modulosPermitidos || modulosPermitidos.length === 0
  const candidatos = semRestricaoPermissao
    ? MODULOS
    : MODULOS.filter((m) => modulosPermitidos!.includes(m.id))
  // Central da Rede (basic) sempre passa no plano → é o destino natural quando
  // não há restrição de permissão.
  const first = candidatos.find((m) => moduloAllowedByPlano(m.path, plano))
  return first?.path ?? '/configuracoes'
}
