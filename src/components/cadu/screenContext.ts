import { useLocation } from 'react-router-dom'

/**
 * Glossário GLOBAL (vale em qualquer tela) — termos que aparecem em vários
 * módulos. Alimenta o "Suporte Cadu iA" pra explicar campos sem alucinar.
 */
const GLOSSARIO_GLOBAL = `Termos comuns do Visor360:
- Projeção (cenários): a projeção do fim do período tem 3 cenários — "Conservador" = estimativa cautelosa (realizado + dias faltantes × ritmo recente DESCONTANDO a volatilidade/banda); "Esperado" = projeção central (ritmo recente × fator do dia da semana); "Otimista" = ritmo recente acrescido da banda de variação. Quanto mais volátil a venda, mais distantes ficam conservador e otimista.
- Margem %: (faturamento − custo) ÷ faturamento × 100.
- Markup %: (preço de venda − custo) ÷ custo × 100.
- Lucro bruto: faturamento − custo (CMV).
- Ticket médio: faturamento ÷ nº de cupons (atendimentos).
- "vs mês/ano anterior": comparação com o mesmo período anterior.
- Apurado vs Completo: ao abrir, o período já vem "apurado" (1º → ontem, só dias fechados, do cache de apuração). Quando a data final alcança o dia de hoje (ou adiante), o dia corrente entra ao vivo da API ("completo") — não há mais botão de escopo; é definido pela data final.`

interface ScreenInfo {
  /** Prefixo da rota (startsWith). */
  path: string
  label: string
  glossario: string
}

const SCREENS: ScreenInfo[] = [
  {
    path: '/estoques',
    label: 'Estoques',
    glossario: `Abas: Visão Geral, Estoque geral, Giro, Estoque médio, Média de venda (6m), Necessidade.
- Saldo/Qtd: saldo ATUAL do produto (não muda com a data). Não inclui combustível.
- P. Custo / P. Venda: médias REALIZADAS dos últimos 6 meses (podem divergir do cadastro).
- Markup %, Marg. Luc.: margem sobre custo / lucro por unidade.
- Giro (6m): vezes que o estoque girou = vendas ÷ estoque médio. Alto = rodando; baixo = capital parado.
- Cobertura / Necessidade: dias que o saldo dura no ritmo de venda; "Comprar" = unidades sugeridas pra cobrir X dias. Status: Negativo, Crítico, Baixo, OK, Sem movimento.`,
  },
  {
    path: '/financeiro',
    label: 'Financeiro',
    glossario: `Abas: Visão Geral, Receber, Pagar, Cartões, Agenda.
- Receber/Pagar mostram o SNAPSHOT de tudo em aberto (em atraso + a vencer), não só o período.
- PMR (atraso médio): média de dias entre vencimento e pagamento dos títulos pagos (90 dias). Negativo = paga adiantado.
- Inadimplência: valor vencido ÷ carteira em aberto. Meta da empresa: até 5%.
- Recuperação de crédito: recebido nos últimos 30 dias vs 30 dias anteriores.
- Score de risco (cliente): 0–100, de atraso atual + histórico de pontualidade + recorrência. Verde ≥70, amarelo 40–69, vermelho <40.
- Cartões: Em atraso/Hoje/Em aberto + Taxa média; "Valor taxa" = valor × taxa%, "Valor líquido" = bruto − taxa, "Taxa efetiva" = taxa ÷ bruto.
- Agenda: calendário de entradas (recebíveis por vencimento) e saídas (contas a pagar por vencimento) do dia.
- Impacto no caixa (Pagar): saldo atual das contas − contas a pagar = saldo projetado.`,
  },
  {
    path: '/produtividade',
    label: 'Produtividade',
    glossario: `Desempenho de frentistas/vendedores: litros, faturamento, ticket médio, mix de produtos. Há alternador Frentistas/Vendedores e detalhamento por dia/turno.`,
  },
  {
    path: '/reabastecimento',
    label: 'Reabastecimento',
    glossario: `Nível dos tanques: % da capacidade (Crítico <20%, Alerta 20–30%, OK >30%). Última compra mostra volume, data, custo total e custo unitário (R$/L). Necessidade até o fim do mês = projeção pelo consumo médio diário.`,
  },
  {
    path: '/caixas-turnos',
    label: 'Fechamento de Caixa',
    glossario: `Conferência de caixa por turno/PDV: comparação entre o apresentado (conferido) e o apurado (sistema) por forma de pagamento; "Diferença" = sobra/falta.`,
  },
  {
    path: '/operacao',
    label: 'Operação',
    glossario: `Módulo Operação com duas abas. Bombas: abastecimentos por bomba/bico (litros, preço unitário, frentista) e desgaste/manutenção. Reabastecimento: nível dos tanques (% da capacidade — Crítico <20%, Alerta 20–30%, OK >30%), última compra e necessidade até o fim do mês.`,
  },
  {
    path: '/qualidade-dados',
    label: 'Qualidade de Dados',
    glossario: `Inconsistências nos dados: preço unitário anormal (Z-score = desvios-padrão vs média do combustível), abastecimento sem frentista, cupons com múltiplos abastecimentos (montagem de cupom / "Sherlock Holmes"). Forma pgto na tabela = como a venda foi paga.`,
  },
  {
    path: '/dashboard',
    label: 'Central da Rede',
    glossario: `Hub da rede. Abas: Visão Geral (consolidado rede-wide: faturamento, margem, comparativos, ranking de postos), Combustível, Automotivo e Conveniência (consolidados rede-wide, respeitando o filtro de posto).
- Automotivo = produtos automotivos (lubrificantes, aditivos); Conveniência = loja.
- Card "Projeção fim do período": faturamento estimado até o fim do mês (ver cenários no glossário global).`,
  },
  {
    path: '/ao-vivo',
    label: 'Ao Vivo Rede',
    glossario: `Módulo "ao vivo" (separado da Central): caixas ABERTOS agora e faturamento fiscal de HOJE, posto a posto. SEM filtros — é sempre o agora (hoje, rede inteira) e atualiza sozinho a cada 60s. "Parcial" = faturamento do dia em curso.`,
  },
  {
    path: '/pessoas',
    label: 'Pessoas',
    glossario: `Funcionários da rede e vínculos.`,
  },
]

/** Monta o texto de contexto da tela atual pro system prompt do Cadu. */
export const getScreenContext = (pathname: string, tab?: string | null): string => {
  const screen = SCREENS.find((s) => pathname.startsWith(s.path))
  const local = screen
    ? `O usuário está na tela "${screen.label}"${tab ? ` (aba "${tab}")` : ''}.\n${screen.glossario}`
    : `O usuário está na rota "${pathname}".`
  return `${local}\n\n${GLOSSARIO_GLOBAL}`
}

/** Hook: contexto da tela atual (rota + aba do ?tab=). */
export const useScreenContext = (): string => {
  const { pathname, search } = useLocation()
  const tab = new URLSearchParams(search).get('tab')
  return getScreenContext(pathname, tab)
}
