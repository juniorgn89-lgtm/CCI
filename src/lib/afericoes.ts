import type { AfericaoRow } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'

/**
 * Resumo de aferições (afericao=true) — saída física de teste de bomba que NÃO
 * é venda. Agrega "quando e quanto" por frentista/dia/posto e realça o atípico.
 * Compartilhado entre Qualidade de Dados e Operação·Bombas.
 */

/** Grupo agregado de aferições (por frentista, dia ou posto). */
export interface AfericoesGrupo {
  chave: string
  nome: string
  count: number
  litros: number
  valor: number
  /** Realce: contém aferição de volume fora do padrão ou concentração alta. */
  atipico: boolean
}

export interface AfericoesResumo {
  count: number
  litros: number
  valor: number
  porFrentista: AfericoesGrupo[]
  porDia: AfericoesGrupo[]
  porPosto: AfericoesGrupo[]
  nAtipicos: number
  /** Códigos das aferições individuais marcadas atípicas (badge no detalhe). */
  atipicaSet: Set<number>
}

/** Limites de concentração por FRENTISTA·DIA (sinal forte de abuso). */
export const CONC_LITROS = 200
export const CONC_COUNT = 8

/** Volume atípico = litros longe de um múltiplo de 10 (INMETRO usa ~20/40L). */
export const volumeAtipico = (litros: number): boolean => Math.abs(litros - Math.round(litros / 10) * 10) > 0.5

/** Chave de identidade "frentista|dia" — eixo da concentração. */
const fdKey = (a: AfericaoRow) => `${a.frentistaCodigo}|${a.dataFiscal}`

export const buildAfericoesResumo = (list: AfericaoRow[]): AfericoesResumo => {
  const litros = list.reduce((s, a) => s + a.litros, 0)
  const valor = list.reduce((s, a) => s + a.valorEstimado, 0)

  // Concentração por frentista·dia — um frentista puxando muita "aferição" num
  // único dia (≥ 200L ou ≥ 8 testes) é o sinal que merece revisão.
  const fdLitros = new Map<string, number>()
  const fdCount = new Map<string, number>()
  for (const a of list) {
    fdLitros.set(fdKey(a), (fdLitros.get(fdKey(a)) ?? 0) + a.litros)
    fdCount.set(fdKey(a), (fdCount.get(fdKey(a)) ?? 0) + 1)
  }
  const rowAtipica = (a: AfericaoRow) =>
    volumeAtipico(a.litros) || (fdLitros.get(fdKey(a)) ?? 0) >= CONC_LITROS || (fdCount.get(fdKey(a)) ?? 0) >= CONC_COUNT

  const atipicaSet = new Set<number>()
  for (const a of list) if (rowAtipica(a)) atipicaSet.add(a.codigo)

  const agrupa = (keyFn: (a: AfericaoRow) => string, nomeFn: (a: AfericaoRow) => string): AfericoesGrupo[] => {
    const m = new Map<string, AfericoesGrupo>()
    for (const a of list) {
      const chave = keyFn(a)
      const e = m.get(chave) ?? { chave, nome: nomeFn(a), count: 0, litros: 0, valor: 0, atipico: false }
      e.count += 1; e.litros += a.litros; e.valor += a.valorEstimado
      if (atipicaSet.has(a.codigo)) e.atipico = true
      m.set(chave, e)
    }
    return [...m.values()]
  }

  const porFrentista = agrupa((a) => String(a.frentistaCodigo || a.frentistaNome), (a) => a.frentistaNome).sort((x, y) => y.litros - x.litros)
  const porDia = agrupa((a) => a.dataFiscal, (a) => a.dataFiscal).sort((x, y) => y.chave.localeCompare(x.chave))
  const porPosto = agrupa((a) => String(a.empresaCodigo), (a) => a.empresaNome).sort((x, y) => y.litros - x.litros)
  const nAtipicos = porFrentista.filter((g) => g.atipico).length

  return { count: list.length, litros, valor, porFrentista, porDia, porPosto, nAtipicos, atipicaSet }
}

/** Chave de grupo pra casar uma linha ao grupo clicado no card. */
export const grupoDaLinha = (a: AfericaoRow, eixo: 'frentista' | 'dia' | 'posto'): string =>
  eixo === 'frentista' ? String(a.frentistaCodigo || a.frentistaNome) : eixo === 'dia' ? a.dataFiscal : String(a.empresaCodigo)
