/**
 * Decide se os filtros globais (seletor de posto, período/datas e comparativo)
 * devem aparecer numa rota.
 *
 * Escondidos onde não fazem sentido: Inteligência (tem seus próprios
 * controles) e telas de nível de rede (Admin, Configurações, Selecionar rede).
 * Usado pelo AppLayout (sub-bar) e pelo Header (controles) — fonte única pra
 * os dois não dessincronizarem.
 */
const ROTAS_SEM_FILTROS = ['/inteligencia', '/configuracoes', '/selecionar-rede']

export const showsGlobalFilters = (pathname: string): boolean =>
  !ROTAS_SEM_FILTROS.includes(pathname) && !pathname.startsWith('/admin/')

/**
 * Rotas onde o comparativo "vs mês ant. / vs ano ant." realmente altera os
 * dados exibidos. Fora dessas, o toggle seria um controle morto (a tela não
 * compara, ou ignora o modo), então é escondido. Allowlist explícita pra não
 * voltar a vazar o botão em telas novas que não consomem `comparisonMode`.
 */
const ROTAS_COM_COMPARATIVO = ['/dashboard', '/caixas-turnos']

export const showsComparison = (pathname: string): boolean =>
  ROTAS_COM_COMPARATIVO.includes(pathname)
