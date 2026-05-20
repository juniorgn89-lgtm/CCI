/**
 * Decide se os filtros globais (seletor de posto, período/datas, escopo
 * "Em andamento/Apurado/Completo" e comparativo) devem aparecer numa rota.
 *
 * Escondidos onde não fazem sentido: Inteligência (tem seus próprios
 * controles) e telas de nível de rede (Admin, Configurações, Selecionar rede).
 * Usado pelo AppLayout (sub-bar) e pelo Header (controles) — fonte única pra
 * os dois não dessincronizarem.
 */
const ROTAS_SEM_FILTROS = ['/inteligencia', '/configuracoes', '/selecionar-rede']

export const showsGlobalFilters = (pathname: string): boolean =>
  !ROTAS_SEM_FILTROS.includes(pathname) && !pathname.startsWith('/admin/')
