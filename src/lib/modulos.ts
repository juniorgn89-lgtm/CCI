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
export interface ModuloInfo {
  id: string
  label: string
  path: string
}

export const MODULOS: ModuloInfo[] = [
  { id: 'dashboard', label: 'Central da Rede', path: '/dashboard' },
  { id: 'operacao', label: 'Operação', path: '/operacao' },
  { id: 'conveniencias', label: 'Conveniências', path: '/conveniencias' },
  { id: 'estoques', label: 'Estoques', path: '/estoques' },
  { id: 'financeiro', label: 'Financeiro', path: '/financeiro' },
  { id: 'fechamento-caixa', label: 'Fechamento de Caixa', path: '/fechamento-caixa' },
  { id: 'inteligencia', label: 'Inteligência', path: '/inteligencia' },
]

/** Encontra qual módulo do catálogo corresponde a um pathname. */
const findModuloForPath = (pathname: string): ModuloInfo | undefined =>
  MODULOS.find((m) => pathname === m.path || pathname.startsWith(m.path + '/'))

/**
 * Verifica se um pathname é acessível pelo usuário.
 * Rotas não mapeadas (ex: /configuracoes, /admin/*) sempre passam.
 */
export const isPathAllowed = (
  pathname: string,
  modulosPermitidos: string[] | null,
  isMaster: boolean,
): boolean => {
  if (isMaster) return true
  if (!modulosPermitidos || modulosPermitidos.length === 0) return true
  const mod = findModuloForPath(pathname)
  if (!mod) return true
  return modulosPermitidos.includes(mod.id)
}

/**
 * Primeira rota permitida para o usuário. Usada como destino de redirect
 * quando ele tenta acessar um módulo bloqueado ou ao carregar a raiz.
 * Fallback: /configuracoes (sempre acessível).
 */
export const firstAllowedPath = (
  modulosPermitidos: string[] | null,
  isMaster: boolean,
): string => {
  if (isMaster || !modulosPermitidos || modulosPermitidos.length === 0) {
    return '/dashboard'
  }
  const first = MODULOS.find((m) => modulosPermitidos.includes(m.id))
  return first?.path ?? '/configuracoes'
}
