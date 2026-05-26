import type {
  AbastecimentoRow,
  AbastecimentoPrecoSuspeito,
  CaixaAbertoDetalhe,
  Caixa,
  ProdutoEstoqueNegativo,
  VendaItem,
  TituloReceber,
  TituloPagar,
  CupomMultiAbast,
} from '@/pages/QualidadeDados/hooks/useQualidadeDados'

/**
 * Identidade canônica de cada lançamento sinalizado pela Qualidade de Dados.
 * Usada pra arquivamento — `tipo_issue + registro_codigo` é a chave que vai
 * pro Supabase.
 *
 * Pra tipos com identificador composto (ex: venda+produto, titulo+kind),
 * geramos string única e estável.
 */

export interface ArquivadoIdentity {
  codigo: string
  /** Rótulo curto pra a aba "Arquivados" não precisar re-buscar da API. */
  rotulo: string
}

/* ─── Abastecimento (cobre data-futura, sem-frentista, litros-suspeito) ─── */
export const identityAbastecimento = (r: AbastecimentoRow): ArquivadoIdentity => ({
  codigo: String(r.codigo),
  rotulo: `Abastecimento #${r.codigo} · ${r.empresaNome}`,
})

/* ─── Preço suspeito — mesmo "tipo" abastecimento, sem mudar ─── */
export const identityPrecoSuspeito = (r: AbastecimentoPrecoSuspeito): ArquivadoIdentity => ({
  codigo: String(r.codigo),
  rotulo: `Abastecimento #${r.codigo} · ${r.combustivelNome}`,
})

/* ─── VendaItem sem produto cadastrado ─── */
export const identityVendaItem = (r: VendaItem): ArquivadoIdentity => ({
  // venda+produto formam a chave composta
  codigo: `${r.vendaCodigo}:${r.produtoCodigo}`,
  rotulo: `Venda #${r.vendaCodigo} · produto ${r.produtoCodigo}`,
})

/* ─── Caixa aberto há muito ─── */
export const identityCaixaAberto = (c: CaixaAbertoDetalhe): ArquivadoIdentity => ({
  codigo: String(c.codigo),
  rotulo: `Caixa #${c.codigo} · ${c.dataMovimento.substring(0, 10)}`,
})

/* ─── Caixa com diferença anormal ─── */
export const identityCaixaDiferenca = (c: Caixa): ArquivadoIdentity => ({
  codigo: String(c.codigo),
  rotulo: `Caixa #${c.codigo} · ${c.dataMovimento.substring(0, 10)}`,
})

/* ─── Estoque negativo ─── */
export const identityEstoqueNegativo = (e: ProdutoEstoqueNegativo): ArquivadoIdentity => ({
  codigo: String(e.produtoCodigo),
  rotulo: `Produto ${e.produtoCodigo} · ${e.nome}`,
})

/* ─── Cupom com múltiplos abastecimentos (fraude) ─── */
export const identityCupomMultiAbast = (c: CupomMultiAbast): ArquivadoIdentity => ({
  codigo: String(c.vendaCodigo),
  rotulo: `Venda #${c.vendaCodigo} · ${c.funcionarioNome} · ${c.abastecimentos.length} abastecimentos`,
})

/* ─── Título (recebíveis OU pagáveis) ─── */
export const identityTitulo = (
  t: (TituloReceber | TituloPagar) & { _tipo: 'receber' | 'pagar' },
): ArquivadoIdentity => ({
  // Prefixa pra evitar colisão entre titulo a receber e a pagar com mesmo código
  codigo: `${t._tipo}:${t.codigo}`,
  rotulo: `Título ${t._tipo === 'receber' ? 'a receber' : 'a pagar'} #${t.codigo}`,
})
