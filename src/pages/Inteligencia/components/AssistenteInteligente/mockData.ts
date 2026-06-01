/**
 * Sugestões de pergunta (chips) exibidas no estado vazio do Chat do Cadu IA.
 * São apenas textos de partida — clicar dispara uma pergunta REAL às tools.
 *
 * Os antigos mocks desta tela (MOCK_INSIGHTS, MOCK_HISTORY, MOCK_TOOL_CALLS,
 * askMockAssistant, PERGUNTAS_AVANCADAS) foram removidos: exibiam números
 * fabricados. Insights/Histórico/Monitor agora usam dados reais (stores e tools).
 */
export const SUGGESTED_PROMPTS = [
  'Qual foi o faturamento do primeiro trimestre de 2026?',
  'Qual frentista teve maior conversão este mês?',
  'Quanto foi vendido de Diesel S10 nos últimos 30 dias?',
  'Qual posto possui melhor ticket médio?',
  'Qual produto mais vendido da conveniência?',
  'Compare a margem de gasolina entre as 3 unidades.',
]
