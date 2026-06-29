// @ts-nocheck — Deno. Estoque dos produtos de loja por posto (saldo ATUAL, como
// a Quality). Determinístico por (posto, produto). Um saldo negativo plantado
// (Aurora Centro · cigarro) pro detector "saldo negativo" da Qualidade + tela de
// Estoques terem o que mostrar.

import { STORE_PRICE, STORE_CODES, POSTO_CODES } from './catalogs.ts'
import { rngFor, intBetween } from './generator.ts'

const r2 = (n: number) => Math.round(n * 100) / 100

export const produtoEstoque = (empresaCodigo: number): any[] =>
  STORE_CODES.map((produtoCodigo) => {
    const rng = rngFor(empresaCodigo, 'estoque', produtoCodigo)
    let saldo = intBetween(rng, 8, 240)
    if (empresaCodigo === 9001 && produtoCodigo === 9207) saldo = -8 // negativo plantado
    return {
      codigo: empresaCodigo * 1000 + (produtoCodigo - 9200),
      empresaCodigo,
      produtoCodigo,
      saldo,
      estoqueCodigo: 1,
      saldoEstoque: null,
    }
  })

export const produtoEstoqueExtrato = (empresaCodigo: number): any[] =>
  STORE_CODES.map((produtoCodigo) => {
    const rng = rngFor(empresaCodigo, 'estoque', produtoCodigo)
    let saldoAtual = intBetween(rng, 8, 240)
    if (empresaCodigo === 9001 && produtoCodigo === 9207) saldoAtual = -8
    const pr = STORE_PRICE[produtoCodigo]
    return {
      produtoCodigo,
      empresaCodigo,
      saldoAtual,
      estoqueMinimo: intBetween(rng, 10, 30),
      estoqueMaximo: intBetween(rng, 200, 400),
      precoVenda: r2(pr.venda),
      precoCusto: r2(pr.custo),
    }
  })

export const ESTOQUE_POSTOS = POSTO_CODES
