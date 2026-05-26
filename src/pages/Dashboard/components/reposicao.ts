import type { ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'

export interface ReposicaoLinha {
  produtoCodigo: number
  produto: string
  estoque: number
  capacidade: number
  ritmoDia: number
  sugestao: number
  tanques: number
}

/** Consolida tanques por combustível (produto), ordenado por maior sugestão. */
export const aggregarPorProduto = (tanques: ReabastTanque[]): ReposicaoLinha[] => {
  const map = new Map<number, ReposicaoLinha>()
  for (const t of tanques) {
    let l = map.get(t.produtoCodigo)
    if (!l) {
      l = { produtoCodigo: t.produtoCodigo, produto: t.produtoNome, estoque: 0, capacidade: 0, ritmoDia: 0, sugestao: 0, tanques: 0 }
      map.set(t.produtoCodigo, l)
    }
    l.estoque += t.estoqueAtual
    l.capacidade += t.capacidade
    l.ritmoDia += t.consumoDiarioMedio
    l.sugestao += t.necessidadeFimDoMes
    l.tanques += 1
  }
  return Array.from(map.values()).sort((a, b) => b.sugestao - a.sugestao)
}

/** Máximos por coluna — para escala compartilhada entre múltiplas tabelas. */
export interface ReposicaoMaxes {
  estoque: number
  capacidade: number
  ritmoDia: number
  sugestao: number
}

export const calcularMaxes = (postos: { linhas: ReposicaoLinha[] }[]): ReposicaoMaxes => {
  const linhas = postos.flatMap((p) => p.linhas)
  return {
    estoque: linhas.reduce((m, l) => Math.max(m, l.estoque), 0),
    capacidade: linhas.reduce((m, l) => Math.max(m, l.capacidade), 0),
    ritmoDia: linhas.reduce((m, l) => Math.max(m, l.ritmoDia), 0),
    sugestao: linhas.reduce((m, l) => Math.max(m, l.sugestao), 0),
  }
}
