import type { ApuracaoVendaFuncionarioRow } from '@/api/supabase/apuracao'
import type { TituloPagar, TituloReceber } from '@/api/types/financeiro'
import type { Diagnostico, Sujeito } from '@/pages/Diagnostico/lib/diagnostico'
import { brlHumano, litrosHumano, pctHumano } from '@/pages/Diagnostico/lib/narrativa'

/**
 * Pilares do diagnóstico além da venda: equipe da pista (frentistas), equipe
 * da loja (vendedores) e financeiro (contas em aberto hoje). Cálculo puro,
 * frases em linguagem de dono, e "sem dado" dito como sem dado.
 */

const num = (v: number, casas = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const listar = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)
/** "IVANILDO DA SILVA" → "Ivanildo S."; "DERIVAN ." → "Derivan". */
const primeiroNome = (nome: string) => {
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  const n = nome.trim().split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, '')).filter(Boolean)
  if (n.length === 0) return 'Sem nome'
  const ultimo = n[n.length - 1]
  return n.length > 1 && ultimo.length >= 2 ? `${cap(n[0])} ${ultimo.charAt(0).toUpperCase()}.` : cap(n[0])
}

/* ───────────────────────── equipe ───────────────────────── */

export interface Pessoa { codigo: number; nome: string; valor: number; share: number }
export interface EquipeLado {
  /** Quantas pessoas venderam no período (A) e no comparativo (B). */
  pessoasA: number
  pessoasB: number | null
  /** Métrica por pessoa por mês: litros (pista) ou faturamento (loja). */
  porPessoaMesA: number
  porPessoaMesB: number | null
  topA: Pessoa[]
  sumiram: string[]
  novos: string[]
  frases: string[]
  temDado: boolean
}

const mesDe = (data: string) => data.slice(0, 7)

const ladoEquipe = (
  rows: ApuracaoVendaFuncionarioRow[],
  setor: 'combustivel' | 'conveniencia',
  mesesA: Set<string>,
  mesesB: Set<string>,
  nomes: Map<number, string>,
  metrica: (r: ApuracaoVendaFuncionarioRow) => number,
  fmt: (v: number) => string,
  rotuloPessoa: string,
  rotuloMetrica: string,
  S: string,
): EquipeLado => {
  const porPessoa = mesesA.size === 1 ? 'por pessoa' : 'por pessoa por mês'
  const agg = (meses: Set<string>) => {
    const m = new Map<number, number>()
    for (const r of rows) {
      if (r.setor !== setor || !meses.has(mesDe(r.data))) continue
      const v = metrica(r)
      if (v <= 0) continue
      m.set(r.funcionario_codigo, (m.get(r.funcionario_codigo) ?? 0) + v)
    }
    return m
  }
  const A = agg(mesesA), B = mesesB.size ? agg(mesesB) : null
  const totalA = [...A.values()].reduce((s, v) => s + v, 0)
  const totalB = B ? [...B.values()].reduce((s, v) => s + v, 0) : 0
  // Pessoa "relevante" = pelo menos 2% do total (tira quem lançou uma venda por engano).
  const relevantesA = [...A.entries()].filter(([, v]) => totalA > 0 && v / totalA >= 0.02)
  const relevantesB = B ? [...B.entries()].filter(([, v]) => totalB > 0 && v / totalB >= 0.02) : null
  const nA = relevantesA.length, nB = relevantesB ? relevantesB.length : null
  const nMesesA = Math.max(1, mesesA.size), nMesesB = Math.max(1, mesesB.size)
  const porPessoaMesA = nA > 0 ? totalA / nA / nMesesA : 0
  const porPessoaMesB = nB && nB > 0 ? totalB / nB / nMesesB : null
  const nome = (c: number) => nomes.get(c) ?? `${rotuloPessoa} ${c}`
  const topA: Pessoa[] = relevantesA.map(([codigo, valor]) => ({ codigo, nome: primeiroNome(nome(codigo)), valor, share: totalA > 0 ? (valor / totalA) * 100 : 0 })).sort((x, y) => y.valor - x.valor).slice(0, 5)
  const setA = new Set(relevantesA.map(([c]) => c)), setB = new Set((relevantesB ?? []).map(([c]) => c))
  const sumiram = relevantesB ? [...setB].filter((c) => !setA.has(c)).map((c) => primeiroNome(nome(c))) : []
  const novos = relevantesB ? [...setA].filter((c) => !setB.has(c)).map((c) => primeiroNome(nome(c))) : []

  const frases: string[] = []
  const temDado = nA > 0
  if (!temDado) {
    frases.push(`Não há venda por ${rotuloPessoa.toLowerCase()} apurada neste período. Ou ${S} não registra quem vendeu, ou essa apuração ainda não foi feita; sem isso não dá para falar de equipe.`)
    return { pessoasA: 0, pessoasB: nB, porPessoaMesA: 0, porPessoaMesB, topA, sumiram, novos, frases, temDado }
  }
  const metricaTxt = (v: number) => `${fmt(v)}${rotuloMetrica ? ` de ${rotuloMetrica}` : ''}`
  frases.push(`${nA} ${nA === 1 ? rotuloPessoa.toLowerCase() : `${rotuloPessoa.toLowerCase()}s`} ${nA === 1 ? 'fez' : 'fizeram'} as vendas do período, uma média de ${metricaTxt(porPessoaMesA)} ${porPessoa}${porPessoaMesB != null && porPessoaMesB > 0 ? ` (antes ${metricaTxt(porPessoaMesB)}, ${porPessoaMesA >= porPessoaMesB ? 'subiu' : 'caiu'} ${pctHumano(((porPessoaMesA - porPessoaMesB) / porPessoaMesB) * 100)})` : ''}.`)
  if (topA.length >= 2) {
    const lider = topA[0]
    if (lider.share >= 40) frases.push(`${lider.nome} responde sozinho por ${pctHumano(lider.share)} de tudo: se essa pessoa faltar, ${S} sente. Vale distribuir melhor e proteger quem carrega o resultado.`)
    else frases.push(`O resultado está bem distribuído: ${lider.nome} lidera com ${pctHumano(lider.share)}, seguido de ${listar(topA.slice(1, 3).map((p) => `${p.nome} (${pctHumano(p.share)})`))}.`)
    const ultimo = topA[topA.length - 1]
    if (topA.length >= 3 && lider.valor > 0 && ultimo.valor / lider.valor < 0.4) frases.push(`A distância entre o primeiro e o último é grande (${ultimo.nome} faz ${pctHumano((ultimo.valor / lider.valor) * 100)} do que faz ${lider.nome}). Escala, horário ou treinamento explicam isso, e é onde a consultoria olha primeiro.`)
  }
  if (nB != null && nB > 0) {
    if (sumiram.length > 0 || novos.length > 0) frases.push(`Rotatividade: ${sumiram.length ? `${listar(sumiram.slice(0, 4))} ${sumiram.length === 1 ? 'saiu' : 'saíram'}` : 'ninguém saiu'}${novos.length ? `; ${listar(novos.slice(0, 4))} ${novos.length === 1 ? 'entrou' : 'entraram'}` : ''}. ${sumiram.length >= 2 ? 'Trocar gente custa treinamento e cliente que não reconhece quem o atende.' : ''}`.trim())
    else frases.push('A equipe é a mesma do período anterior: estabilidade é um ativo aqui.')
  }
  return { pessoasA: nA, pessoasB: nB, porPessoaMesA, porPessoaMesB, topA, sumiram, novos, frases, temDado }
}

export interface Equipe { pista: EquipeLado; loja: EquipeLado }

export const analisarEquipe = (rows: ApuracaoVendaFuncionarioRow[], nomes: Map<number, string>, d: Diagnostico): Equipe => {
  const mesesA = new Set(d.pareados.a.length ? d.pareados.a : d.cobertura.a)
  const mesesB = new Set(d.pareados.b)
  const S = d.sujeito === 'rede' ? 'a rede' : 'o posto'
  return {
    pista: ladoEquipe(rows, 'combustivel', mesesA, mesesB, nomes, (r) => r.quantidade, (v) => litrosHumano(v), 'Frentista', '', S),
    loja: ladoEquipe(rows, 'conveniencia', mesesA, mesesB, nomes, (r) => r.faturamento, (v) => brlHumano(v), 'Vendedor', 'venda', S),
  }
}

/* ───────────────────────── financeiro ───────────────────────── */

export interface Financeiro {
  temDado: boolean
  receberAberto: number
  receberVencido: number
  receberVencidoCount: number
  pagarAberto: number
  pagarVencido: number
  pagarVencidoCount: number
  /** Dias de faturamento que o vencido a receber representa. */
  diasReceber: number | null
  topDevedores: { nome: string; valor: number; share: number }[]
  frases: string[]
}

const onlyDate = (s: string) => (s ?? '').split('T')[0]

export const analisarFinanceiro = (
  receber: TituloReceber[],
  pagar: TituloPagar[],
  empresaCodigos: number[],
  faturamentoMes: number,
  hoje: string,
  sujeito: Sujeito = 'posto',
): Financeiro => {
  const codigos = new Set(empresaCodigos)
  const S = sujeito === 'rede' ? 'a rede' : 'o posto'
  const deste = sujeito === 'rede' ? 'desta rede' : 'deste posto'
  const rec = receber.filter((t) => codigos.has(t.empresaCodigo) && t.pendente)
  const pag = pagar.filter((t) => codigos.has(t.empresaCodigo) && !['CANCELADO', 'PAGO'].includes((t.situacao ?? '').toUpperCase()))
  let receberAberto = 0, receberVencido = 0, receberVencidoCount = 0
  const porCliente = new Map<string, number>()
  for (const t of rec) {
    const v = t.valor ?? 0
    receberAberto += v
    if (onlyDate(t.dataVencimento) < hoje) { receberVencido += v; receberVencidoCount++; const k = t.nomeCliente?.trim() || `Cliente ${t.clienteCodigo}`; porCliente.set(k, (porCliente.get(k) ?? 0) + v) }
  }
  let pagarAberto = 0, pagarVencido = 0, pagarVencidoCount = 0
  for (const t of pag) {
    const saldo = Math.max(0, (t.valor ?? 0) + (t.acrescimo ?? 0) - (t.desconto ?? 0) - (t.valorPago ?? 0))
    if (saldo <= 0) continue
    pagarAberto += saldo
    if (onlyDate(t.vencimento) < hoje) { pagarVencido += saldo; pagarVencidoCount++ }
  }
  const temDado = rec.length > 0 || pag.length > 0
  const diasReceber = faturamentoMes > 0 ? receberVencido / (faturamentoMes / 30) : null
  const topDevedores = [...porCliente.entries()].map(([nome, valor]) => ({ nome, valor, share: receberVencido > 0 ? (valor / receberVencido) * 100 : 0 })).sort((x, y) => y.valor - x.valor).slice(0, 3)

  const frases: string[] = []
  if (!temDado) {
    frases.push(`Não há títulos a receber nem a pagar ${deste} no ERP. Ou o financeiro não roda no WebPosto, ou está em outro sistema; neste caso a análise financeira fica para a conversa.`)
    return { temDado, receberAberto, receberVencido, receberVencidoCount, pagarAberto, pagarVencido, pagarVencidoCount, diasReceber, topDevedores, frases }
  }
  if (receberVencido > 0) {
    frases.push(`Há ${brlHumano(receberVencido)} de clientes em atraso (${receberVencidoCount} ${receberVencidoCount === 1 ? 'título' : 'títulos'})${diasReceber != null ? `, o equivalente a ${num(diasReceber, diasReceber < 10 ? 1 : 0)} ${diasReceber === 1 ? 'dia' : 'dias'} de faturamento parados na rua` : ''}.${topDevedores[0] && topDevedores[0].share >= 30 ? ` Só ${topDevedores[0].nome} deve ${brlHumano(topDevedores[0].valor)} (${pctHumano(topDevedores[0].share)} do atrasado): é uma conversa, não uma lista.` : ''}`)
  } else if (receberAberto > 0) {
    frases.push(`Nada vencido a receber: ${brlHumano(receberAberto)} em aberto, tudo no prazo. Cobrança em dia.`)
  }
  if (pagarVencido > 0) {
    frases.push(`A pagar vencido: ${brlHumano(pagarVencido)} em ${pagarVencidoCount} ${pagarVencidoCount === 1 ? 'título' : 'títulos'}. Boleto vencido vira juro e multa; se for falta de baixa no sistema, é cadastro para arrumar.`)
  } else if (pagarAberto > 0) {
    frases.push(`A pagar: ${brlHumano(pagarAberto)} em aberto, nenhum vencido.`)
  }
  if (receberVencido > 0 && pagarVencido > 0 && receberVencido >= pagarVencido) frases.push(`Cobrar o que está atrasado pagaria tudo o que ${S} deve vencido: a prioridade financeira é cobrança, não corte.`)
  return { temDado, receberAberto, receberVencido, receberVencidoCount, pagarAberto, pagarVencido, pagarVencidoCount, diasReceber, topDevedores, frases }
}

/* ───────────────────────── pilares ───────────────────────── */

export type StatusPilar = 'bom' | 'atencao' | 'critico' | 'sem_dado'
export interface Pilar { id: string; nome: string; status: StatusPilar; frase: string }

export const montarPilares = (d: Diagnostico, eq: Equipe | null, fin: Financeiro | null): Pilar[] => {
  const A = d.totA, B = d.totB
  const n = Math.max(1, A.meses)
  const out: Pilar[] = []
  const dS = d.sujeito === 'rede' ? 'da rede' : 'do posto'
  const deste = d.sujeito === 'rede' ? 'desta rede' : 'deste posto'
  const porMes = A.meses === 1 ? 'no mês' : 'por mês'
  const porPessoa = A.meses === 1 ? 'por pessoa' : 'por pessoa por mês'

  // 1. Venda e margem (combustível)
  if (B) {
    const dLbL = A.lbPorLitro - B.lbPorLitro
    const vLit = B.litros > 0 ? ((A.litros - B.litros) / B.litros) * 100 : 0
    const status: StatusPilar = dLbL < -0.03 || vLit < -8 ? 'critico' : dLbL < -0.01 || vLit < -2 ? 'atencao' : 'bom'
    out.push({ id: 'venda', nome: 'Venda e margem', status, frase: `${litrosHumano(A.litros / n)} ${porMes} (${vLit >= 0 ? '+' : '−'}${pctHumano(vLit)}) a R$ ${num(A.lbPorLitro, 2)} de lucro por litro (antes R$ ${num(B.lbPorLitro, 2)}).` })
  } else {
    out.push({ id: 'venda', nome: 'Venda e margem', status: 'sem_dado', frase: `${litrosHumano(A.litros / n)} ${porMes} a R$ ${num(A.lbPorLitro, 2)} por litro. Sem o período anterior não dá para dizer a tendência.` })
  }
  // 2. Loja
  if (A.fatLoja === 0) out.push({ id: 'loja', nome: 'Loja', status: 'sem_dado', frase: 'Nenhuma venda de loja apurada: confirmar se há loja e se está integrada.' })
  else {
    const vLb = B && B.lbLoja > 0 ? ((A.lbLoja - B.lbLoja) / B.lbLoja) * 100 : null
    const status: StatusPilar = vLb == null ? 'bom' : vLb < -10 ? 'critico' : vLb < -2 ? 'atencao' : 'bom'
    out.push({ id: 'loja', nome: 'Loja', status, frase: `${brlHumano(A.lbLoja / n)} de lucro ${porMes}, ${pctHumano(A.shareLojaLb)} do lucro ${dS}${vLb != null ? ` (${vLb >= 0 ? '+' : '−'}${pctHumano(vLb)} contra o período anterior)` : ''}.` })
  }
  // 3. Equipe da pista
  if (!eq || !eq.pista.temDado) out.push({ id: 'pista', nome: 'Equipe da pista', status: 'sem_dado', frase: 'Sem venda por frentista apurada neste período.' })
  else {
    const lider = eq.pista.topA[0]
    const status: StatusPilar = eq.pista.sumiram.length >= 3 || (lider && lider.share >= 50) ? 'atencao' : 'bom'
    out.push({ id: 'pista', nome: 'Equipe da pista', status, frase: `${eq.pista.pessoasA} frentistas, ${litrosHumano(eq.pista.porPessoaMesA)} ${porPessoa}${eq.pista.sumiram.length ? `; ${eq.pista.sumiram.length} ${eq.pista.sumiram.length === 1 ? 'saiu' : 'saíram'}` : ''}.` })
  }
  // 4. Equipe da loja
  if (!eq || !eq.loja.temDado) out.push({ id: 'vendedores', nome: 'Equipe da loja', status: 'sem_dado', frase: A.fatLoja === 0 ? 'Sem loja apurada.' : 'Sem venda por vendedor apurada neste período.' })
  else {
    const lider = eq.loja.topA[0]
    const status: StatusPilar = eq.loja.sumiram.length >= 2 || (lider && lider.share >= 60) ? 'atencao' : 'bom'
    out.push({ id: 'vendedores', nome: 'Equipe da loja', status, frase: `${eq.loja.pessoasA} vendedores, ${brlHumano(eq.loja.porPessoaMesA)} ${porPessoa}${eq.loja.sumiram.length ? `; ${eq.loja.sumiram.length} ${eq.loja.sumiram.length === 1 ? 'saiu' : 'saíram'}` : ''}.` })
  }
  // 5. Financeiro
  if (!fin || !fin.temDado) out.push({ id: 'financeiro', nome: 'Financeiro', status: 'sem_dado', frase: `Sem títulos ${deste} no ERP.` })
  else {
    const status: StatusPilar = (fin.diasReceber ?? 0) > 15 || fin.pagarVencido > 0 ? 'critico' : fin.receberVencido > 0 ? 'atencao' : 'bom'
    out.push({ id: 'financeiro', nome: 'Financeiro', status, frase: `${brlHumano(fin.receberVencido)} a receber vencido${fin.diasReceber != null && fin.diasReceber >= 0.5 ? ` (${num(fin.diasReceber, fin.diasReceber < 10 ? 1 : 0)} ${fin.diasReceber < 1.5 ? 'dia' : 'dias'} de faturamento)` : ''}; ${brlHumano(fin.pagarVencido)} a pagar vencido.` })
  }
  return out
}
