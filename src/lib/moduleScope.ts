/**
 * Escopo de empresa por módulo.
 *
 * Módulos GATEADOS (operacionais por-posto) exigem um posto específico e NÃO
 * permitem "Todos os postos" (rede consolidada) — se o filtro estiver em Todos,
 * a tela mostra o gate `SelectCompanyState`. Os demais (Central, Comercial,
 * Financeiro, Qualidade, Pessoas, Inteligência, …) permitem a rede consolidada.
 */
// /produtividade saiu do gate: virou rede-wide (Resumos somam o filtro; pódios
// cross-posto). Precisa oferecer "Todos os postos" no seletor — senão, depois de
// filtrar 1 posto, não havia como voltar pra rede consolidada de dentro do módulo.
// /operacao e /estoques saíram do gate (18/10/2026): as duas abrem na Visão Geral
// da rede inteira e as abas de detalhe têm seletor de posto PRÓPRIO (pílulas).
// No gate, o cabeçalho escondia "Todos os postos" e mostrava "Selecione um
// posto" com a tela exibindo a rede toda — seletor diferente da Central.
// /estoques voltou ao gate (18/10/2026): a Visão Geral virou o painel de UM posto
// e a pílula própria saiu — o posto vem só do seletor do cabeçalho.
const GATED_PREFIXES = ['/caixas-turnos', '/estoques']

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
const REDE_WIDE_PREFIXES = ['/comercial', '/rede']

/** True se a rota é rede-wide por natureza (ignora o filtro de empresa). */
export const moduloRedeWide = (pathname: string): boolean =>
  REDE_WIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
