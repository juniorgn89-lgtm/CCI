// @ts-nocheck — Deno. Gerador determinístico de UM dia de combustível por posto.
//
// Tudo de um dia (abastecimentos, itens de venda, vendas, formas de pagamento)
// sai DESTA função → litros = faturamento = pagamento batem entre telas, e o
// mesmo (posto, data) sempre produz o mesmo resultado.

import { FUEL_PRICE, FRENTISTAS, FORMAS_MIX, POSTO_CODES, bicosDoPosto } from './catalogs.ts'
import { rngFor, between, intBetween, pick, weightedIndex } from './generator.ts'

/* ─── Fatores ─── */
const EPOCH = Date.UTC(2020, 0, 1)
export const dayOrdinal = (dateISO: string): number => {
  const [y, m, d] = dateISO.split('-').map(Number)
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH) / 86_400_000)
}
const empresaIdx = (empresaCodigo: number): number => Math.max(0, POSTO_CODES.indexOf(empresaCodigo))
const weekdayFactor = (dateISO: string): number => {
  const [y, m, d] = dateISO.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=dom
  return wd === 6 ? 1.25 : wd === 0 ? 1.1 : wd === 5 ? 1.15 : 1.0
}
const POSTO_SCALE: Record<number, number> = { 9001: 1.0, 9002: 1.25, 9003: 0.85, 9004: 0.6 }

/** Mix + faixa de litros por combustível. */
const FUEL_MIX = [
  { produtoCodigo: 9101, peso: 30, litMin: 25, litMax: 55 },
  { produtoCodigo: 9102, peso: 10, litMin: 25, litMax: 55 },
  { produtoCodigo: 9103, peso: 18, litMin: 25, litMax: 50 },
  { produtoCodigo: 9104, peso: 28, litMin: 60, litMax: 220 },
  { produtoCodigo: 9105, peso: 14, litMin: 80, litMax: 250 },
]
const FUEL_WEIGHTS = FUEL_MIX.map((f) => f.peso)

const placa = (rng: () => number): string => {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const c = () => L[Math.floor(rng() * 26)]
  const n = () => Math.floor(rng() * 10)
  return `${c()}${c()}${c()}${n()}${c()}${n()}${n()}`
}

export interface DiaFuel {
  abastecimentos: any[]
  vendaItens: any[]
  vendas: any[]
  formas: any[]
}

/** Gera o dia de combustível de UM posto. */
export const gerarDiaFuel = (empresaCodigo: number, dateISO: string): DiaFuel => {
  const rng = rngFor(empresaCodigo, dateISO, 'fuel')
  const bicos = bicosDoPosto(empresaCodigo)
  const bicosPorFuel: Record<number, any[]> = {}
  for (const b of bicos) (bicosPorFuel[b.produtoCodigo] ??= []).push(b)
  const frentistas = FRENTISTAS.filter((f) => f.empresaCodigo === empresaCodigo)
  const cede = empresaCodigo === 9003 // Aurora Litoral cede margem (ajuste de bomba)

  const scale = POSTO_SCALE[empresaCodigo] ?? 1
  const nFills = Math.round(intBetween(rng, 130, 175) * scale * weekdayFactor(dateISO))
  const base = dayOrdinal(dateISO) * 100_000 + empresaIdx(empresaCodigo) * 10_000

  const abastecimentos: any[] = []
  const vendaItens: any[] = []
  const vendas: any[] = []
  const formas: any[] = []

  for (let i = 0; i < nFills; i++) {
    const fuel = FUEL_MIX[weightedIndex(rng, FUEL_WEIGHTS)]
    const bico = pick(rng, bicosPorFuel[fuel.produtoCodigo] ?? bicos)
    const frentista = pick(rng, frentistas)
    const litros = Math.round(between(rng, fuel.litMin, fuel.litMax) * 100) / 100

    const tabela = FUEL_PRICE[fuel.produtoCodigo].tabela
    const custo = FUEL_PRICE[fuel.produtoCodigo].custo
    // Praticado: tabela ± ruído; no posto que cede, parte das vendas abaixo da tabela.
    let valorUnitario = tabela + between(rng, -0.01, 0.01)
    if (cede && rng() < 0.45) valorUnitario = tabela - between(rng, 0.08, 0.2)
    valorUnitario = Math.round(valorUnitario * 1000) / 1000
    const valorTotal = Math.round(litros * valorUnitario * 100) / 100

    const hh = String(intBetween(rng, 6, 22)).padStart(2, '0')
    const mm = String(intBetween(rng, 0, 59)).padStart(2, '0')
    const ss = String(intBetween(rng, 0, 59)).padStart(2, '0')
    const hora = `${hh}:${mm}:${ss}`
    const dataHora = `${dateISO}T${hora}`

    const codigo = base + i

    // Pagamento (1 forma por cupom nesta fase)
    const forma = FORMAS_MIX[weightedIndex(rng, FORMAS_MIX.map((f) => f.peso))]
    const frota = forma.administradoraCodigo === 9308
    const clienteCodigo = frota ? 9401 + Math.floor(rng() * 10) : 0
    const adm = forma.administradoraCodigo
    const taxa = forma.tipo === 'CARTAO' ? (adm === 9301 || adm === 9303 ? 2.85 : adm === 9305 ? 3.2 : adm === 9308 ? 1.95 : adm === 9302 || adm === 9304 ? 0.69 : 1.2) : 0
    const credito = /CREDITO|FROTA/.test(forma.nome)
    const vencimento = credito ? addDays(dateISO, 30) : dateISO

    abastecimentos.push({
      codigo,
      dataFiscal: dateISO,
      horaFiscal: hora,
      codigoProduto: fuel.produtoCodigo,
      quantidade: litros,
      valorUnitario,
      valorTotal,
      codigoFrentista: frentista.funcionarioCodigo,
      codigoBico: bico.bicoCodigo,
      afericao: false,
      vendaItemCodigo: codigo,
      precoCadastro: tabela,
      tabelaPrecoA: tabela,
      tabelaPrecoB: tabela,
      tabelaPrecoC: tabela,
      empresaCodigo,
      dataHoraAbastecimento: dataHora,
      stringAll: '',
      placa: placa(rng),
      abastecimentoCodigo: codigo,
      encerrante: 0,
      precoCusto: custo,
    })
    vendaItens.push({
      codigo,
      empresaCodigo,
      vendaCodigo: codigo,
      vendaItemCodigo: codigo,
      dataMovimento: dateISO,
      produtoCodigo: fuel.produtoCodigo,
      quantidade: litros,
      precoCusto: custo,
      totalCusto: Math.round(custo * litros * 100) / 100,
      precoVenda: valorUnitario,
      totalVenda: valorTotal,
      totalDesconto: 0,
      totalAcrescimo: 0,
      cancelada: 'N',
      bicoCodigo: bico.bicoCodigo,
      tanqueCodigo: bico.tanqueCodigo,
      funcionarioCodigo: frentista.funcionarioCodigo,
    })
    vendas.push({
      codigo,
      vendaCodigo: codigo,
      empresaCodigo,
      dataMovimento: dateISO,
      situacao: 'A',
      clienteCodigo,
    })
    formas.push({
      codigo,
      empresaCodigo,
      vendaCodigo: codigo,
      vendaPrazoCodigo: 0,
      dataMovimento: dateISO,
      vencimento,
      valorPagamento: valorTotal,
      taxaPercentual: taxa,
      formaPagamentoCodigo: adm || 1,
      administradoraCodigo: adm,
      turnoCodigo: Number(hh) < 14 ? 1 : 2,
      tipoFormaPagamento: forma.tipo,
      nomeFormaPagamento: forma.nome,
    })
  }

  return { abastecimentos, vendaItens, vendas, formas }
}

const addDays = (dateISO: string, n: number): string => {
  const [y, m, d] = dateISO.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Linhas de LMC (custo por combustível) pra UM posto numa data — fallback de custo do front. */
export const lmcDoPosto = (empresaCodigo: number, dataMovimento: string): any[] =>
  Object.entries(FUEL_PRICE).map(([code, p]) => ({
    empresaCodigo,
    produtoCodigo: [Number(code)],
    produtoLmcCodigo: Number(code),
    dataMovimento,
    precoCusto: p.custo,
  }))
