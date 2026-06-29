// @ts-nocheck — Deno. Estoque dos produtos de loja por posto (saldo ATUAL, como
// a Quality). Determinístico por (posto, produto). Um saldo negativo plantado
// (Aurora Centro · cigarro) pro detector "saldo negativo" da Qualidade + tela de
// Estoques terem o que mostrar.

import { STORE_PRICE, STORE_CODES, POSTO_CODES, FUEL_PRICE } from './catalogs.ts'
import { rngFor, intBetween, between } from './generator.ts'

const r2 = (n: number) => Math.round(n * 100) / 100

/* ─── Tanques de combustível (nível atual) — alimenta o Reabastecimento ─── */
// 1 tanque por combustível por posto. tanqueCodigo casa com o dos bicos
// (empresaCodigo*100 + produtoCodigo-9100). estoqueEscritural = nível ATUAL.
const TANK_CAP: Record<number, number> = { 9101: 30000, 9102: 15000, 9103: 20000, 9104: 30000, 9105: 20000 }
export const tanquesDoPosto = (empresaCodigo: number, hoje: string): any[] =>
  Object.keys(FUEL_PRICE).map(Number).map((produtoCodigo) => {
    const rng = rngFor(empresaCodigo, 'tanque', produtoCodigo)
    const capacidade = TANK_CAP[produtoCodigo] ?? 20000
    // Nível 15%–85%; um crítico plantado (Aurora Serra · gasolina comum).
    let pct = between(rng, 0.15, 0.85)
    if (empresaCodigo === 9004 && produtoCodigo === 9101) pct = 0.12
    const tanqueCodigo = empresaCodigo * 100 + (produtoCodigo - 9100)
    return {
      codigo: tanqueCodigo,
      empresaCodigo,
      tanqueCodigo,
      tanqueCodigoExterno: '',
      name: `TQ ${produtoCodigo - 9100}`,
      produtoCodigo,
      capacidade,
      ultimoUsuarioAlteracao: '',
      lastro: 500,
      estoqueEscritural: Math.round(capacidade * pct),
      produtoLmcCodigo: produtoCodigo,
      dataHoraMedidor: `${hoje}T08:00:00`,
    }
  })

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
