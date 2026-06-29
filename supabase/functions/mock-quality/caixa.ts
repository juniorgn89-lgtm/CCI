// @ts-nocheck — Deno. Gera os caixas do dia a partir dos MESMOS pagamentos do
// combustível (gerarDiaFuel) → o apurado do caixa fecha com as vendas, e o
// apresentado = apurado ± pequena diferença (com uma "falta" plantada pro
// Fechamento ter o que sinalizar).

import { gerarDiaFuel, dayOrdinal } from './dia.ts'
import { FRENTISTAS, POSTO_CODES } from './catalogs.ts'
import { rngFor, between, pick } from './generator.ts'

const r2 = (n: number) => Math.round(n * 100) / 100
const empresaIdx = (c: number) => Math.max(0, POSTO_CODES.indexOf(c))

// Forma de pagamento → bucket do /CAIXA_APRESENTADO.
const bucketOf = (forma: any): string => {
  if (forma.tipoFormaPagamento === 'DINHEIRO') return 'dinheiro'
  if (forma.tipoFormaPagamento === 'PIX') return 'transfBanc'
  if (/FROTA/.test(forma.nomeFormaPagamento)) return 'cartaoFrete'
  return 'cartao'
}

const FORMA_KEYS = [
  'dinheiro', 'cartao', 'transfBanc', 'transfDeb', 'notaPrazo', 'cheque', 'chequePre',
  'cartaoFrete', 'valeCliente', 'valeFun', 'emprestimo', 'prePag', 'despesa', 'chequePagar', 'fundoCxDeb',
]
const MISC_KEYS = [
  'valeCliente', 'suprimentoCaixa', 'recebimentoCaixa', 'chequeTroco', 'servicoCaixa',
  'prePagoCredito', 'fundoCaixaCredito', 'ordemPagamento', 'pagamentoCaixa', 'saidaTrocaValor',
]

const mkApresentado = (codigo: number, empresaCodigo: number, caixaCodigo: number, apur: Record<string, number>, dif: Record<string, number>) => {
  const o: any = { codigo, empresaCodigo, caixaCodigo, consolidado: true }
  for (const k of FORMA_KEYS) {
    const a = r2(apur[k] ?? 0)
    const d = r2(dif[k] ?? 0)
    o[`${k}Apurado`] = a
    o[`${k}Apresentado`] = r2(a + d)
    o[`${k}Diferenca`] = d
  }
  for (const m of MISC_KEYS) o[m] = 0
  return o
}

export interface DiaCaixa {
  caixas: any[]
  apresentados: any[]
}

export const gerarCaixas = (empresaCodigo: number, dateISO: string): DiaCaixa => {
  const { formas } = gerarDiaFuel(empresaCodigo, dateISO)
  const frentistas = FRENTISTAS.filter((f) => f.empresaCodigo === empresaCodigo)
  const ord = dayOrdinal(dateISO)

  // Agrupa pagamentos por (turno, pdv).
  const groups = new Map<number, { turno: number; pdv: number; apur: Record<string, number>; total: number }>()
  for (const f of formas) {
    const pdv = (f.vendaCodigo % 2) + 1
    const key = f.turnoCodigo * 10 + pdv
    const g = groups.get(key) ?? { turno: f.turnoCodigo, pdv, apur: {}, total: 0 }
    const bk = bucketOf(f)
    g.apur[bk] = (g.apur[bk] ?? 0) + f.valorPagamento
    g.total += f.valorPagamento
    groups.set(key, g)
  }

  const caixas: any[] = []
  const apresentados: any[] = []
  for (const g of groups.values()) {
    const caixaCodigo = ord * 1000 + empresaIdx(empresaCodigo) * 100 + g.turno * 10 + g.pdv
    const rng = rngFor(empresaCodigo, dateISO, 'caixa', caixaCodigo)
    const operador = pick(rng, frentistas)

    // Diferenças: ruído pequeno no dinheiro; "falta" plantada (Aurora Marginal).
    const dif: Record<string, number> = { dinheiro: r2(between(rng, -3, 3)) }
    if (empresaCodigo === 9002 && ord % 9 === 0 && g.turno === 2 && g.pdv === 1) {
      dif.dinheiro = -r2(between(rng, 120, 180))
    }
    const totalDif = Object.values(dif).reduce((s, v) => s + v, 0)

    const abertura = `${dateISO}T${g.turno === 1 ? '06:00:00' : '14:00:00'}`
    const fechamento = `${dateISO}T${g.turno === 1 ? '14:00:00' : '22:00:00'}`

    caixas.push({
      codigo: caixaCodigo,
      empresaCodigo,
      caixaCodigo,
      dataMovimento: dateISO,
      turnoCodigo: g.turno,
      turno: `${g.turno}º TURNO`,
      pdvCodigo: empresaCodigo * 10 + g.pdv,
      funcionarioCodigo: operador.funcionarioCodigo,
      centroCusto: 1,
      abertura,
      fechamento,
      fechado: true,
      consolidado: true,
      tipoInclusao: 'PDV',
      bloqueado: false,
      tipoBloqueio: '',
      apurado: r2(g.total),
      diferenca: r2(totalDif),
    })
    apresentados.push(mkApresentado(caixaCodigo, empresaCodigo, caixaCodigo, g.apur, dif))
  }

  caixas.sort((a, b) => a.caixaCodigo - b.caixaCodigo)
  apresentados.sort((a, b) => a.caixaCodigo - b.caixaCodigo)
  return { caixas, apresentados }
}
