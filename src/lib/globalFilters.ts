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

/**
 * Rotas onde o comparativo "vs mês ant. / vs ano ant." realmente altera os
 * dados exibidos. Fora dessas, o toggle seria um controle morto (a tela não
 * compara, ou ignora o modo), então é escondido. Allowlist explícita pra não
 * voltar a vazar o botão em telas novas que não consomem `comparisonMode`.
 */
const ROTAS_COM_COMPARATIVO = ['/dashboard', '/comercial/vendas', '/caixas-turnos']

export const showsComparison = (pathname: string): boolean =>
  ROTAS_COM_COMPARATIVO.includes(pathname)

/**
 * Rotas onde o escopo "Em andamento / Apurado / Completo" NÃO se aplica e seria
 * um controle morto. Estoque é sempre o saldo ATUAL (não tem versão "apurada"),
 * então o seletor de escopo fica escondido lá. Reabastecimento segue a mesma
 * lógica: trabalha com o snapshot do estoque ATUAL dos tanques + a "última
 * compra", logo o intervalo/escopo de período não faz sentido.
 */
const ROTAS_SEM_ESCOPO = ['/estoques', '/reabastecimento']

export const showsDataScope = (pathname: string): boolean =>
  !ROTAS_SEM_ESCOPO.includes(pathname)

/**
 * Rotas onde o escopo só faz sentido em "Completo" (sem a opção "Apurado").
 * Financeiro trabalha com snapshot do que está em aberto + fluxo do mês inteiro;
 * o recorte "só dias fechados" confunde mais do que ajuda, então só "Completo".
 */
const ROTAS_SO_COMPLETO = ['/financeiro']

export const showsOnlyCompletoScope = (pathname: string): boolean =>
  ROTAS_SO_COMPLETO.includes(pathname)
