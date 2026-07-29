/**
 * Tipos e rótulos do relatório de compartilhamento. Fica SEPARADO do builder
 * (reportPdf.ts) de propósito: as telas importam só isto (leve, estático), e o
 * gerador + o jsPDF ficam num chunk que só baixa no clique de "Compartilhar".
 */

export type Tone = 'pos' | 'neg' | 'neutral'

export interface ReportKpi {
  label: string
  value: string
  tone?: Tone
}
export interface ReportRow {
  label: string
  value: string
  /** Linha secundária (contagem, detalhe) abaixo do label. */
  sub?: string
  /** Destaque (negrito no label) — ex.: linha de total. */
  strong?: boolean
}
export interface ReportSection {
  title: string
  rows: ReportRow[]
  /** Observação em itálico no fim da seção. */
  note?: string
}
export interface ReportPayload {
  title: string
  subtitle?: string
  kpis: ReportKpi[]
  sections: ReportSection[]
  /** Rodapé (frescor/somente-leitura). Repetido em todas as páginas. */
  footnote?: string
  /** Marca no topo (default "Visor360"). */
  brand?: string
}

/* ─── Rótulos compartilhados (escopo/período) — usados por todas as abas ─── */

export const escopoLabel = (scopedCount: number): string =>
  scopedCount === 0 ? 'Todos os postos' : `${scopedCount} ${scopedCount === 1 ? 'posto' : 'postos'}`

export const periodoLabel = (p?: { allPeriod?: boolean; dataInicial?: string; dataFinal?: string }): string => {
  if (!p || p.allPeriod) return 'Todo o período'
  const br = (iso?: string) => (iso ?? '').split('-').reverse().join('/')
  return `${br(p.dataInicial)} a ${br(p.dataFinal)}`
}
