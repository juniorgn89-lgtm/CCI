/**
 * Classificação de setor — fonte ÚNICA da verdade da aplicação.
 *
 *   combustível  = produto.tipoProduto === "C"          (qualquer grupo)
 *   automotivos  = grupo.tipoGrupo === "Pista" e ≠ "C"
 *   conveniência = grupo.tipoGrupo === "Conveniência"
 *   outros       = resto → FORA dos setores (não soma em lugar nenhum)
 *
 * Antes cada hook reclassificava ao vivo com regras próprias (flag `combustivel`,
 * nome do grupo começando com "PS -", "o resto" = conveniência) — o que causava
 * deriva entre telas. Use SEMPRE estes helpers pra manter os dados coerentes.
 */
export type Setor = 'combustivel' | 'automotivos' | 'conveniencia' | 'outros'

export const classifySetor = (
  tipoProduto: string | undefined,
  tipoGrupo: string | undefined,
): Setor =>
  tipoProduto === 'C'
    ? 'combustivel'
    : tipoGrupo === 'Pista'
      ? 'automotivos'
      : tipoGrupo === 'Conveniência'
        ? 'conveniencia'
        : 'outros'

/** Item de venda cancelado? Conta-se só `cancelada = "N"`. */
export const isVendaCancelada = (it: { cancelada?: string }): boolean => it.cancelada === 'S'

interface ProdutoLike { produtoCodigo: number; tipoProduto: string; grupoCodigo: number }
interface GrupoLike { grupoCodigo: number; tipoGrupo: string }

/** Mapa `produtoCodigo → Setor` a partir do catálogo + grupos. */
export const buildSetorMap = (
  produtos: ProdutoLike[],
  grupos: GrupoLike[],
): Map<number, Setor> => {
  const grupoTipo = new Map(grupos.map((g) => [g.grupoCodigo, g.tipoGrupo]))
  const m = new Map<number, Setor>()
  for (const p of produtos) {
    m.set(p.produtoCodigo, classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)))
  }
  return m
}
