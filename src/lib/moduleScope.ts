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

/**
 * Módulos REDE-WIDE por natureza: as análises COMPARAM postos entre si (ranking,
 * "vs média da rede", oportunidades priorizadas). Filtrar 1 posto quebra a
 * comparação, então estes IGNORAM o filtro de empresa (sempre todos os postos) e
 * ESCONDEM o seletor de posto — sem tocar na seleção global do usuário (ela fica
 * preservada pros outros módulos). Abas que precisam de 1 posto (Concorrência,
 * Radar) têm seletor PRÓPRIO dentro da aba.
 */
const REDE_WIDE_PREFIXES = ['/comercial']

/** True se a rota é rede-wide por natureza (ignora o filtro de empresa). */
export const moduloRedeWide = (pathname: string): boolean =>
  REDE_WIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
