/**
 * Escopo de empresa por módulo.
 *
 * Módulos GATEADOS (operacionais por-posto) exigem um posto específico e NÃO
 * permitem "Todos os postos" (rede consolidada) — se o filtro estiver em Todos,
 * a tela mostra o gate `SelectCompanyState`. Os demais (Central, Comercial,
 * Financeiro, Qualidade, Pessoas, Inteligência, …) permitem a rede consolidada.
 */
const GATED_PREFIXES = ['/operacao', '/estoques', '/produtividade', '/caixas-turnos']

/** True se a rota permite "Todos os postos" ([]). False = exige posto específico. */
export const moduloPermiteTodos = (pathname: string): boolean =>
  !GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
