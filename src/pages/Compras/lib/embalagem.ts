/**
 * Embalagem do item do pedido de compra. A base do pedido é sempre a UNIDADE
 * (qtd_solicitada em unidades); a embalagem só muda como se pede ao fornecedor:
 * caixa/fardo/pacote/display = número inteiro de embalagens com N unidades;
 * quilo/litro = quantidade quebrada permitida.
 */
export interface Embalagem {
  id: string
  nome: string
  /** Abreviação no texto do pedido (cx, fd…). */
  curto: string
  /** Tem "quantas unidades vêm" (caixa, fardo…). */
  comFator: boolean
  /** Aceita quantidade quebrada (quilo, litro). */
  fracionavel: boolean
}

export const EMBALAGENS: Embalagem[] = [
  { id: 'UN', nome: 'Unidade', curto: 'un', comFator: false, fracionavel: false },
  { id: 'CX', nome: 'Caixa', curto: 'cx', comFator: true, fracionavel: false },
  { id: 'FD', nome: 'Fardo', curto: 'fd', comFator: true, fracionavel: false },
  { id: 'PCT', nome: 'Pacote', curto: 'pct', comFator: true, fracionavel: false },
  { id: 'DP', nome: 'Display', curto: 'dp', comFator: true, fracionavel: false },
  { id: 'KG', nome: 'Quilo', curto: 'kg', comFator: false, fracionavel: true },
  { id: 'L', nome: 'Litro', curto: 'L', comFator: false, fracionavel: true },
]
const POR_ID = new Map(EMBALAGENS.map((e) => [e.id, e]))
export const embalagemDe = (id: string | null | undefined): Embalagem => POR_ID.get(id ?? 'UN') ?? EMBALAGENS[0]

/** Item com embalagem "de verdade" (caixa/fardo… com N unidades informado). */
export const temFator = (embalagem: string | null | undefined, fator: number | null | undefined) =>
  embalagemDe(embalagem).comFator && !!fator && fator > 0

/** Unidades arredondadas para embalagens inteiras (sempre para cima, para não faltar). */
export const arredondarUnidades = (unidades: number, embalagem: string | null | undefined, fator: number | null | undefined) => {
  const e = embalagemDe(embalagem)
  if (temFator(embalagem, fator)) return Math.ceil(unidades / fator! - 1e-9) * fator!
  if (e.fracionavel) return Math.round(unidades * 1000) / 1000
  return Math.ceil(unidades - 1e-9)
}

/** Quantas embalagens dão estas unidades (só com fator). */
export const qtdEmbalagens = (unidades: number, fator: number) => Math.round((unidades / fator) * 1000) / 1000

const n = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

/** Texto do pedido para o fornecedor: "12 cx de 12 un (144 un)" ou "144 un" / "3,5 kg". */
export const textoQtd = (unidades: number, embalagem: string | null | undefined, fator: number | null | undefined, unidadeBase?: string | null) => {
  const e = embalagemDe(embalagem)
  if (temFator(embalagem, fator)) return `${n(qtdEmbalagens(unidades, fator!))} ${e.curto} de ${n(fator!)} un (${n(unidades)} un)`
  if (e.fracionavel) return `${n(unidades)} ${e.curto}`
  return `${n(unidades)} ${(unidadeBase ?? 'un').toLowerCase()}`
}
