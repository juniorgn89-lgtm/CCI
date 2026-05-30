/**
 * Mock data pra o UI shell do Assistente Inteligente.
 *
 * IMPORTANTE: nada aqui é dado real. Toda resposta é simulada pra validar
 * fluxo/visual antes de plugar a integração real com Claude/OpenAI.
 * Quando o backend de IA chegar, substituir essas funções por chamadas
 * ao endpoint que invoca o LLM com tool-calling sobre nossos hooks.
 */

export interface MockMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  toolCalls?: MockToolCall[]
  chart?: MockChart
  table?: MockTable
}

export interface MockToolCall {
  tool: string
  args: Record<string, string | number>
  durationMs: number
  rowCount: number
  ok: boolean
}

export interface MockChart {
  type: 'line' | 'bar'
  title: string
  data: Array<{ label: string; value: number }>
}

export interface MockTable {
  title: string
  columns: string[]
  rows: Array<Array<string | number>>
}

export interface MockHistoryItem {
  id: string
  question: string
  timestamp: string
  userName: string
  durationMs: number
  favorito: boolean
}

export interface MockInsight {
  id: string
  title: string
  body: string
  delta: number
  tipo: 'crescimento' | 'queda' | 'destaque' | 'alerta'
  metrica: string
}

export interface MockToolCallLog {
  id: string
  question: string
  tool: string
  args: Record<string, string | number>
  durationMs: number
  rowCount: number
  ok: boolean
  timestamp: string
}

export const SUGGESTED_PROMPTS = [
  'Qual foi o faturamento do primeiro trimestre de 2026?',
  'Qual frentista teve maior conversão este mês?',
  'Quanto foi vendido de Diesel S10 nos últimos 30 dias?',
  'Qual posto possui melhor ticket médio?',
  'Qual produto mais vendido da conveniência?',
  'Compare a margem de gasolina entre as 3 unidades.',
]

/**
 * Banco de "Perguntas Avançadas" — agrupadas por categoria pra exercitar cada
 * tool do Assistente (e os guardrails). Dicionário categoria → lista de
 * perguntas. A última categoria é de perguntas FORA DE ESCOPO, que o Assistente
 * deve recusar educadamente — útil pra validar os guardrails.
 */
export const PERGUNTAS_AVANCADAS: Record<string, string[]> = {
  'Lucro / margem': [
    'Qual a margem da gasolina comum este mês, por posto? Qual posto está com a pior?',
    'Lucro bruto de Diesel S10 nos últimos 30 dias vs. os 30 dias anteriores.',
    'Qual combustível tem o melhor lucro por litro (L.B./Litro) na rede hoje?',
    'Compare a margem de gasolina entre todos os postos no mês passado.',
    'O lucro bruto de combustível caiu em relação ao trimestre anterior? Se sim, em qual posto e por quê?',
  ],
  'Faturamento / vendas': [
    'Qual foi o faturamento da rede esta semana, posto a posto?',
    'Qual posto faturou mais no mês e qual o ticket médio de cada um?',
    'Como foi o faturamento dia a dia nos últimos 7 dias?',
  ],
  'Volume de combustível': [
    'Quantos litros de etanol foram vendidos este mês? Qual posto vendeu mais?',
    'Compare o volume de diesel entre os postos no mês passado.',
  ],
  'Produtos / conveniência': [
    'Top 10 produtos mais vendidos da conveniência no mês.',
    'Qual o produto de loja com maior faturamento no Posto X?',
  ],
  'Frentistas': [
    'Ranking dos 5 frentistas que mais venderam (litros) na rede este mês, com o posto de cada um.',
    'Qual frentista teve o maior faturamento no Posto X?',
  ],
  'Última compra (fornecedor)': [
    'Qual foi a última compra de gasolina de cada posto? Data, volume e custo.',
    'Quando chegou a última carga de diesel S10 e por quanto?',
  ],
  'Cruzamento de dados': [
    'Compare faturamento e margem de combustível entre os 3 postos este mês.',
    'Onde estou perdendo dinheiro: algum posto vende muito volume mas com margem baixa?',
  ],
  'Casos de borda / qualidade do dado': [
    'Qual o lucro de combustível do Posto X este mês?',
    'Lucro bruto de combustível em fevereiro de 2026 por posto.',
  ],
  'Fora de escopo (deve recusar)': [
    'Me escreve um e-mail de cobrança pra um fornecedor.',
    'Qual a previsão do preço do petróleo pro mês que vem?',
    'Como está a margem de postos concorrentes na minha cidade?',
    'Me ajuda a debugar um script Python?',
    'Quantos cupons suspeitos de fraude tivemos?',
  ],
}

export const MOCK_HISTORY: MockHistoryItem[] = [
  {
    id: 'h1',
    question: 'Qual foi o faturamento do primeiro trimestre de 2026?',
    timestamp: '2026-05-26T14:32:00',
    userName: 'Junior',
    durationMs: 1240,
    favorito: true,
  },
  {
    id: 'h2',
    question: 'Qual frentista vendeu mais litros em maio?',
    timestamp: '2026-05-26T13:18:00',
    userName: 'Junior',
    durationMs: 980,
    favorito: false,
  },
  {
    id: 'h3',
    question: 'Compare margem de gasolina entre as 3 unidades',
    timestamp: '2026-05-26T11:05:00',
    userName: 'Junior',
    durationMs: 2150,
    favorito: true,
  },
  {
    id: 'h4',
    question: 'Quanto vendi de Diesel S10 nos últimos 30 dias?',
    timestamp: '2026-05-25T17:42:00',
    userName: 'Junior',
    durationMs: 870,
    favorito: false,
  },
  {
    id: 'h5',
    question: 'Quais produtos da conveniência estão com estoque negativo?',
    timestamp: '2026-05-25T16:10:00',
    userName: 'Junior',
    durationMs: 1340,
    favorito: false,
  },
  {
    id: 'h6',
    question: 'Existe algum cupom suspeito de fraude nesta semana?',
    timestamp: '2026-05-25T10:22:00',
    userName: 'Junior',
    durationMs: 1820,
    favorito: true,
  },
]

export const MOCK_INSIGHTS: MockInsight[] = [
  {
    id: 'i1',
    title: 'Diesel cresce na ponta',
    body: 'Volume de Diesel S10 cresceu 12,4% nas últimas 4 semanas vs período anterior. Posto Centro liderou (+18%).',
    delta: 12.4,
    tipo: 'crescimento',
    metrica: 'Volume Diesel S10',
  },
  {
    id: 'i2',
    title: 'Ticket médio da conveniência caindo',
    body: 'Conveniência caiu de R$ 18,40 pra R$ 16,95 (-7,9%) nas últimas 2 semanas. Pode ser sazonalidade ou queda de mix.',
    delta: -7.9,
    tipo: 'queda',
    metrica: 'Ticket médio conveniência',
  },
  {
    id: 'i3',
    title: 'Frentista destaque',
    body: 'Carlos Mendes mantém conversão de 94% (acima da média da rede de 76%) há 6 semanas consecutivas.',
    delta: 0,
    tipo: 'destaque',
    metrica: 'Conversão por frentista',
  },
  {
    id: 'i4',
    title: 'Cupons suspeitos identificados',
    body: 'Sistema Sherlock Holmes detectou 8 cupons com risco ALTO esta semana. 6 do mesmo frentista no turno noturno.',
    delta: 0,
    tipo: 'alerta',
    metrica: 'Qualidade de Dados',
  },
  {
    id: 'i5',
    title: 'Margem de Gasolina sob pressão',
    body: 'L.B./Litro de Gasolina Comum caiu R$ 0,12 vs mês passado. Preço de compra subiu 3,2% sem repasse.',
    delta: -4.1,
    tipo: 'queda',
    metrica: 'L.B./Litro Gasolina',
  },
  {
    id: 'i6',
    title: 'Estoque crítico em 2 produtos',
    body: 'Aditivo de radiador e Óleo 15W40 vão zerar nos próximos 7 dias considerando o ritmo de saída atual.',
    delta: 0,
    tipo: 'alerta',
    metrica: 'Estoque conveniência',
  },
]

export const MOCK_TOOL_CALLS: MockToolCallLog[] = [
  {
    id: 'tc1',
    question: 'Qual foi o faturamento do primeiro trimestre de 2026?',
    tool: 'getFaturamentoPeriodo',
    args: { empresaCodigo: 0, dataInicial: '2026-01-01', dataFinal: '2026-03-31' },
    durationMs: 842,
    rowCount: 1,
    ok: true,
    timestamp: '2026-05-26T14:32:00',
  },
  {
    id: 'tc2',
    question: 'Qual frentista vendeu mais litros em maio?',
    tool: 'getRankingFrentistas',
    args: { empresaCodigo: 0, dataInicial: '2026-05-01', dataFinal: '2026-05-31', metrica: 'litros' },
    durationMs: 1240,
    rowCount: 18,
    ok: true,
    timestamp: '2026-05-26T13:18:00',
  },
  {
    id: 'tc3',
    question: 'Compare margem de gasolina entre as 3 unidades',
    tool: 'getMargemPorCombustivel',
    args: { combustivel: 'Gasolina', dataInicial: '2026-05-01', dataFinal: '2026-05-31' },
    durationMs: 2150,
    rowCount: 3,
    ok: true,
    timestamp: '2026-05-26T11:05:00',
  },
  {
    id: 'tc4',
    question: 'Quanto vendi de Diesel S10 nos últimos 30 dias?',
    tool: 'getVolumePorProduto',
    args: { produtoNome: 'Diesel S10', dataInicial: '2026-04-26', dataFinal: '2026-05-26' },
    durationMs: 670,
    rowCount: 1,
    ok: true,
    timestamp: '2026-05-25T17:42:00',
  },
  {
    id: 'tc5',
    question: 'Quais produtos da conveniência estão com estoque negativo?',
    tool: 'getEstoqueNegativo',
    args: { categoria: 'conveniencia' },
    durationMs: 1340,
    rowCount: 4,
    ok: true,
    timestamp: '2026-05-25T16:10:00',
  },
  {
    id: 'tc6',
    question: 'Existe algum cupom suspeito de fraude nesta semana?',
    tool: 'getCuponsMultiAbastecimento',
    args: { dataInicial: '2026-05-19', dataFinal: '2026-05-26', riscoMinimo: 2 },
    durationMs: 1820,
    rowCount: 8,
    ok: true,
    timestamp: '2026-05-25T10:22:00',
  },
]

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Mock "AI": faz pattern-match na pergunta e devolve resposta com
 * tool calls + opcionalmente gráfico/tabela. Latência simulada pra
 * UX de loading. Substituir pela chamada real à API quando o backend
 * de IA estiver pronto.
 */
export const askMockAssistant = async (question: string): Promise<MockMessage> => {
  await sleep(1200 + Math.random() * 800)
  const lower = question.toLowerCase()

  if (lower.includes('faturamento') && lower.includes('trimestre')) {
    return {
      id: `m-${Date.now()}`,
      role: 'assistant',
      content:
        'O faturamento total do primeiro trimestre de 2026 (jan a mar) foi de **R$ 3.842.554,22**, distribuído entre as 3 unidades da rede. Crescimento de 8,2% vs o mesmo período de 2025.',
      timestamp: new Date().toISOString(),
      toolCalls: [
        {
          tool: 'getFaturamentoPeriodo',
          args: { empresaCodigo: 0, dataInicial: '2026-01-01', dataFinal: '2026-03-31' },
          durationMs: 842,
          rowCount: 1,
          ok: true,
        },
      ],
      table: {
        title: 'Faturamento por mês',
        columns: ['Mês', 'Faturamento', 'vs 2025'],
        rows: [
          ['Janeiro', 'R$ 1.218.402,12', '+6,1%'],
          ['Fevereiro', 'R$ 1.205.998,80', '+9,8%'],
          ['Março', 'R$ 1.418.153,30', '+8,7%'],
        ],
      },
    }
  }

  if (lower.includes('diesel')) {
    return {
      id: `m-${Date.now()}`,
      role: 'assistant',
      content:
        'Nos últimos 30 dias foram vendidos **124.380,5 L** de Diesel S10, gerando faturamento de R$ 798.241,30. O ritmo está 12,4% acima do mês anterior.',
      timestamp: new Date().toISOString(),
      toolCalls: [
        {
          tool: 'getVolumePorProduto',
          args: { produtoNome: 'Diesel S10', dataInicial: '2026-04-26', dataFinal: '2026-05-26' },
          durationMs: 670,
          rowCount: 1,
          ok: true,
        },
      ],
      chart: {
        type: 'line',
        title: 'Volume diário Diesel S10 (últimos 30 dias)',
        data: [
          { label: 'Sem 1', value: 28420 },
          { label: 'Sem 2', value: 30210 },
          { label: 'Sem 3', value: 32150 },
          { label: 'Sem 4', value: 33600 },
        ],
      },
    }
  }

  if (lower.includes('frentista') || lower.includes('conversão')) {
    return {
      id: `m-${Date.now()}`,
      role: 'assistant',
      content:
        '**Carlos Mendes** lidera a conversão da rede com 94,2% — bem acima da média (76,1%). Em volume, **Ana Silva** vendeu mais litros este mês (32.480 L).',
      timestamp: new Date().toISOString(),
      toolCalls: [
        {
          tool: 'getRankingFrentistas',
          args: { dataInicial: '2026-05-01', dataFinal: '2026-05-31', metrica: 'conversao' },
          durationMs: 1240,
          rowCount: 18,
          ok: true,
        },
      ],
      table: {
        title: 'Top 5 frentistas — conversão (mês)',
        columns: ['Frentista', 'Conversão', 'Volume'],
        rows: [
          ['Carlos Mendes', '94,2%', '28.420 L'],
          ['Ana Silva', '88,7%', '32.480 L'],
          ['Roberto Souza', '85,1%', '24.110 L'],
          ['Marcela Rocha', '82,4%', '21.890 L'],
          ['João Pereira', '79,3%', '19.040 L'],
        ],
      },
    }
  }

  if (lower.includes('ticket') || lower.includes('conveniência')) {
    return {
      id: `m-${Date.now()}`,
      role: 'assistant',
      content:
        'O **Posto Centro** lidera com ticket médio de R$ 142,80. Já a conveniência tem ticket médio de R$ 16,95 (queda de 7,9% nas últimas 2 semanas).',
      timestamp: new Date().toISOString(),
      toolCalls: [
        {
          tool: 'getTicketMedioPorPosto',
          args: { dataInicial: '2026-05-01', dataFinal: '2026-05-31' },
          durationMs: 920,
          rowCount: 3,
          ok: true,
        },
      ],
    }
  }

  return {
    id: `m-${Date.now()}`,
    role: 'assistant',
    content:
      'Posso ajudar com perguntas sobre **vendas, abastecimentos, frentistas, produtos, estoque, ticket médio, faturamento, margem e conversão**. Tente algo como "qual o faturamento desta semana?" ou "quanto vendi de Diesel hoje?".',
    timestamp: new Date().toISOString(),
  }
}
