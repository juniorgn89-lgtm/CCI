/** Formata CNPJ (14 dígitos) em 00.000.000/0000-00; devolve como veio se não bater. */
export const formatCnpj = (raw: string | null | undefined) => {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length !== 14) return raw ?? ''
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** Rótulos das etapas do funil do Prospecção360 (espelham lá). */
export const PROSPECCAO_STATUS_LABEL: Record<string, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  visitado: 'Visitado',
  negociacao: 'Em negociação',
  fechado: 'Cliente fechado',
  perdido: 'Perdido',
}

/** Cor da etapa (chips). Fechado = verde (conquistado). */
export const PROSPECCAO_STATUS_TONE: Record<string, string> = {
  novo: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  contatado: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  visitado: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  negociacao: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  fechado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  perdido: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
}

export const prospeccaoStatusLabel = (s: string) => PROSPECCAO_STATUS_LABEL[s] ?? s
export const prospeccaoStatusTone = (s: string) =>
  PROSPECCAO_STATUS_TONE[s] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'

/** Ordem canônica das etapas (mapa/legenda). */
export const PROSPECCAO_STATUS_ORDER = ['novo', 'contatado', 'visitado', 'negociacao', 'fechado', 'perdido'] as const

/** Cor sólida (hex) de cada etapa — pinos do mapa e bolinhas da legenda. */
export const PROSPECCAO_STATUS_COR: Record<string, string> = {
  novo: '#64748b',
  contatado: '#0ea5e9',
  visitado: '#6366f1',
  negociacao: '#f59e0b',
  fechado: '#10b981',
  perdido: '#f43f5e',
}

/** Posto sem vínculo de prospecção — cinza-chumbo neutro (visível no mapa, sem
 *  se confundir com as cores de status). */
export const SEM_VINCULO_COR = '#334155'

export const prospeccaoStatusCor = (s: string) => PROSPECCAO_STATUS_COR[s] ?? SEM_VINCULO_COR

/** Endereço em uma linha a partir dos campos da empresa Quality. */
export const enderecoLinha = (p: {
  tipoLogradouro?: string
  logradouro?: string
  numero?: string
  bairro?: string
}) =>
  [
    [p.tipoLogradouro, p.logradouro].filter(Boolean).join(' '),
    p.numero,
    p.bairro,
  ]
    .filter((s) => s && String(s).trim())
    .join(', ')
