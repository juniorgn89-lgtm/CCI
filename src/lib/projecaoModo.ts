/**
 * Modo efetivo da projeção — o que a tela DEVE dizer sobre como projetou.
 *
 * A projeção sazonal (índice de dia-da-semana) cai silenciosamente no ramo
 * LINEAR (média dos dias decorridos) quando o histórico do setor não chega:
 * menos de 90 dias de operação OU leitura vazia (não apurado, erro, timeout —
 * foi o caso de 28/09/2026, quando a RLS por linha estourava o statement
 * timeout). Regra anti-enganação: o número continua honesto (é uma projeção
 * válida), mas a UI não pode afirmar "por dia-da-semana" quando não foi.
 */
export type ProjecaoMotivo = 'sazonal' | 'carregando' | 'sem-historico' | 'historico-curto'

export interface ProjecaoModo {
  linear: boolean
  motivo: ProjecaoMotivo
  /** Dias desde a 1ª venda conhecida do setor (proxy de dias de operação). */
  diasOperacao: number
  /** Dias com venda no histórico lido. */
  histDias: number
}

export const MIN_DIAS_SAZONAL = 90

export const modoProjecao = (p: { isLoading: boolean; histDias: number; diasOperacao: number }): ProjecaoModo => {
  const linear = p.diasOperacao < MIN_DIAS_SAZONAL
  const motivo: ProjecaoMotivo = !linear
    ? 'sazonal'
    : p.isLoading
      ? 'carregando'
      : p.histDias === 0
        ? 'sem-historico'
        : 'historico-curto'
  return { linear, motivo, diasOperacao: p.diasOperacao, histDias: p.histDias }
}

export const SAZONAL_MODO: ProjecaoModo = { linear: false, motivo: 'sazonal', diasOperacao: MIN_DIAS_SAZONAL, histDias: 0 }

/** Texto curto (chip) e longo (tooltip) — `null` quando é sazonal (nada a avisar). */
export const descreverProjecaoModo = (m: ProjecaoModo): { curto: string; longo: string } | null => {
  if (!m.linear) return null
  if (m.motivo === 'carregando') {
    return { curto: 'Carregando histórico', longo: 'O histórico do setor ainda está sendo lido. Até chegar, a projeção usa a média simples dos dias já decorridos.' }
  }
  if (m.motivo === 'sem-historico') {
    return {
      curto: 'Projeção linear',
      longo:
        'Não foi possível ler o histórico deste setor (ainda não apurado ou falha na leitura). A projeção usa a média simples dos dias já decorridos, sem o peso de cada dia da semana. Recarregue a tela; se persistir, avise o suporte.',
    }
  }
  return {
    curto: 'Projeção linear',
    longo: `Este setor tem ${m.diasOperacao} dias de histórico (mínimo ${MIN_DIAS_SAZONAL} para o peso por dia da semana). Até lá, a projeção usa a média simples dos dias já decorridos.`,
  }
}
