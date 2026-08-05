/**
 * Decide se os filtros globais (seletor de posto, período/datas e comparativo)
 * devem aparecer numa rota.
 *
 * Escondidos onde não fazem sentido: Inteligência (tem seus próprios
 * controles) e telas de nível de rede (o Painel de gestão inteiro — Usuários,
 * Redes, Configurações, Apuração, Selecionar rede, IA — e o legado /admin/*).
 * Usado pelo AppLayout (sub-bar) e pelo Header (controles) — fonte única pra
 * os dois não dessincronizarem.
 */
const ROTAS_SEM_FILTROS = ['/inteligencia', '/configuracoes', '/selecionar-rede']

export const showsGlobalFilters = (pathname: string): boolean =>
  !ROTAS_SEM_FILTROS.includes(pathname)
  && !pathname.startsWith('/admin/')
  // O Painel de gestão (rotas /painel/*) é nível de rede/conta — sem filtro de
  // posto/período. As rotas migraram pra cá, mas a checagem ainda olhava os
  // caminhos antigos (/configuracoes etc.), então a barra vazava no Painel.
  && !pathname.startsWith('/painel')

/**
 * Rotas onde o comparativo "vs mês ant. / vs ano ant." realmente altera os
 * dados exibidos. Fora dessas, o toggle seria um controle morto (a tela não
 * compara, ou ignora o modo), então é escondido. Allowlist explícita pra não
 * voltar a vazar o botão em telas novas que não consomem `comparisonMode`.
 */
const ROTAS_COM_COMPARATIVO = ['/dashboard']

export const showsComparison = (pathname: string): boolean =>
  ROTAS_COM_COMPARATIVO.includes(pathname)
