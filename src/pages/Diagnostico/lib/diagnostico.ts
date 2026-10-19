/**
 * Diagnóstico do posto — cálculo PURO (sem React, sem rede).
 *
 * Compara duas janelas de 12 meses (A = recente, B = anterior) a partir da
 * view mensal por produto (`apuracao_vendas_produto_mensal`). Toda comparação
 * é PAREADA: só entram meses que têm dado nos dois anos. Mês que falta num
 * lado é declarado, nunca preenchido.
 *
 * Os "achados" são regras determinísticas, em linguagem de dono, cada um com
 * o número que o sustenta e a alavanca. Nada de estimativa sem base.
 */

export interface LinhaMensal {
  /** Posto da linha (presente nas leituras da view; usado no "posto a posto" da rede). */
  empresa_codigo?: number
  mes: string // YYYY-MM
  setor: string
  produto_codigo: number
  produto_nome: string | null
  quantidade: number
  total_venda: number
  total_custo: number
  cupons_produto: number
  dias: number
}

export type ModoJanela = '12m' | 'ano' | 'mes' | 'cci' | 'custom'

/** Como falar "do período de comparação" a partir do nome da janela B. */
export const deJanelaB = (b: Janela) => (!b.nome || b.nome === 'ano anterior' ? 'do ano anterior' : `do ${b.nome}`)

/** De quem é o diagnóstico: um posto ou a rede inteira (muda só o sujeito das frases). */
export type Sujeito = 'posto' | 'rede'

/** Período escolhido à mão: A = de..ate; B = mesma quantidade de meses a partir de `base`. */
export interface PeriodoCustom { de: string; ate: string; base: string }

export interface Janela {
  /** Meses YYYY-MM, do mais antigo pro mais novo. */
  meses: string[]
  ini: string
  fim: string
  rotulo: string
  /** Como chamar o período nos textos: "ano anterior" ou "período de comparação". */
  nome?: string
}

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const mesLabel = (ym: string) => `${MESES_CURTO[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`
export const mesLabelLongo = (ym: string) => `${MESES_CURTO[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`
const MESES_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
/** "setembro de 2026" — pro modo "mês", em que o mês é o assunto. */
export const mesLabelExtenso = (ym: string) => `${MESES_EXTENSO[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`

export const addMeses = (ym: string, n: number) => {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const seqMeses = (fim: string, n: number) => Array.from({ length: n }, (_, i) => addMeses(fim, -(n - 1 - i)))

const mesesEntre = (de: string, ate: string) => {
  const out: string[] = []
  let m = de
  for (let i = 0; i < 36 && m <= ate; i++) { out.push(m); m = addMeses(m, 1) }
  return out
}

/** Janelas a partir de um período escolhido à mão (até 24 meses). */
export const janelasPersonalizadas = (p: PeriodoCustom): { a: Janela; b: Janela } => {
  const de = p.de <= p.ate ? p.de : p.ate
  const ate = p.de <= p.ate ? p.ate : p.de
  const mesesA = mesesEntre(de, ate).slice(0, 24)
  const mesesB = mesesA.map((_, i) => addMeses(p.base, i))
  const rot = (ms: string[]) => (ms.length === 1 ? mesLabel(ms[0]) : `${mesLabel(ms[0])} a ${mesLabel(ms[ms.length - 1])}`)
  return {
    a: { meses: mesesA, ini: mesesA[0], fim: mesesA[mesesA.length - 1], rotulo: rot(mesesA) },
    b: { meses: mesesB, ini: mesesB[0], fim: mesesB[mesesB.length - 1], rotulo: rot(mesesB), nome: mesesB[0] === addMeses(mesesA[0], -12) ? 'ano anterior' : 'período de comparação' },
  }
}

/** Padrão do período personalizado: últimos 12 meses fechados contra os 12 anteriores. */
export const periodoCustomPadrao = (hoje: string): PeriodoCustom => {
  const fim = addMeses(hoje.slice(0, 7), -1)
  const de = addMeses(fim, -11)
  return { de, ate: fim, base: addMeses(de, -12) }
}

/** Janelas A (recente) e B (anterior) a partir de hoje (yyyy-MM-dd). */
export const janelas = (hoje: string, modo: ModoJanela, custom?: PeriodoCustom, mes?: string | null, marco?: string | null): { a: Janela; b: Janela } => {
  if (modo === 'custom') return janelasPersonalizadas(custom ?? periodoCustomPadrao(hoje))
  const ultimoFechado = addMeses(hoje.slice(0, 7), -1)
  if (modo === 'cci') {
    // Antes e depois da CCI: A = do mês do marco até o último mês fechado (até
    // 12); B = os mesmos N meses imediatamente ANTES do marco. Marco no 2º
    // quinzena → começa no mês seguinte (o mês de entrada fica pela metade).
    const m0 = marco && /^\d{4}-\d{2}/.test(marco) ? marco : hoje
    const dia = Number(m0.slice(8, 10) || '1')
    let ini = dia > 15 ? addMeses(m0.slice(0, 7), 1) : m0.slice(0, 7)
    if (ini > ultimoFechado) ini = ultimoFechado
    const mesesA = mesesEntre(ini, ultimoFechado).slice(-12)
    const n = mesesA.length
    const mesesB = mesesA.map((_, i) => addMeses(mesesA[0], -(n - i)))
    const rot = (ms: string[]) => (ms.length === 1 ? mesLabel(ms[0]) : `${mesLabel(ms[0])} a ${mesLabel(ms[ms.length - 1])}`)
    return {
      a: { meses: mesesA, ini: mesesA[0], fim: mesesA[n - 1], rotulo: `${rot(mesesA)} (com a CCI)` },
      b: { meses: mesesB, ini: mesesB[0], fim: mesesB[n - 1], rotulo: `${rot(mesesB)} (antes da CCI)`, nome: 'período antes da CCI' },
    }
  }
  if (modo === 'mes') {
    // Um mês contra o mesmo mês do ano anterior (o "contra o mês anterior" é
    // uma segunda leitura, ver janelaMesAnterior).
    const m = mes && mes <= ultimoFechado ? mes : ultimoFechado
    const mb = addMeses(m, -12)
    return {
      a: { meses: [m], ini: m, fim: m, rotulo: mesLabelExtenso(m) },
      b: { meses: [mb], ini: mb, fim: mb, rotulo: mesLabelExtenso(mb), nome: 'mesmo mês do ano anterior' },
    }
  }
  if (modo === 'ano') {
    const ano = ultimoFechado.slice(0, 4)
    const n = Number(ultimoFechado.slice(5, 7))
    const mesesA = seqMeses(ultimoFechado, n)
    const mesesB = mesesA.map((m) => addMeses(m, -12))
    return {
      a: { meses: mesesA, ini: mesesA[0], fim: mesesA[mesesA.length - 1], rotulo: `${ano} até ${mesLabel(ultimoFechado)}` },
      b: { meses: mesesB, ini: mesesB[0], fim: mesesB[mesesB.length - 1], rotulo: `${Number(ano) - 1}, mesmos meses` },
    }
  }
  const mesesA = seqMeses(ultimoFechado, 12)
  const mesesB = mesesA.map((m) => addMeses(m, -12))
  return {
    a: { meses: mesesA, ini: mesesA[0], fim: mesesA[11], rotulo: `${mesLabel(mesesA[0])} a ${mesLabel(mesesA[11])}` },
    b: { meses: mesesB, ini: mesesB[0], fim: mesesB[11], rotulo: `${mesLabel(mesesB[0])} a ${mesLabel(mesesB[11])}` },
  }
}

/** Janela B alternativa do modo "mês": o mês imediatamente anterior. */
export const janelaMesAnterior = (a: Janela): Janela => {
  const m = addMeses(a.ini, -1)
  return { meses: [m], ini: m, fim: m, rotulo: mesLabelExtenso(m), nome: 'mês anterior' }
}

/* ───────────────────────── agregação ───────────────────────── */

interface Agg { qtd: number; venda: number; custo: number; cupons: number }
const agg0 = (): Agg => ({ qtd: 0, venda: 0, custo: 0, cupons: 0 })
const add = (a: Agg, r: LinhaMensal) => { a.qtd += r.quantidade; a.venda += r.total_venda; a.custo += r.total_custo; a.cupons += r.cupons_produto }
const lb = (a: Agg) => a.venda - a.custo
const margem = (a: Agg) => (a.venda > 0 ? ((a.venda - a.custo) / a.venda) * 100 : 0)

export interface Totais {
  meses: number
  litros: number
  faturamento: number
  lucroBruto: number
  margem: number
  lbPorLitro: number
  fatComb: number
  lbComb: number
  fatLoja: number
  lbLoja: number
  cuponsLoja: number
  ticketLoja: number
  fatAuto: number
  lbAuto: number
  shareLojaLb: number
  shareAutoLb: number
}

const totaisDe = (rows: LinhaMensal[], meses: Set<string>): Totais => {
  const comb = agg0(), loja = agg0(), auto = agg0()
  for (const r of rows) {
    if (!meses.has(r.mes)) continue
    if (r.setor === 'combustivel') add(comb, r)
    else if (r.setor === 'conveniencia') add(loja, r)
    else if (r.setor === 'automotivos') add(auto, r)
  }
  const venda = comb.venda + loja.venda + auto.venda
  const custo = comb.custo + loja.custo + auto.custo
  const lucro = venda - custo
  return {
    meses: meses.size,
    litros: comb.qtd,
    faturamento: venda,
    lucroBruto: lucro,
    margem: venda > 0 ? (lucro / venda) * 100 : 0,
    lbPorLitro: comb.qtd > 0 ? lb(comb) / comb.qtd : 0,
    fatComb: comb.venda, lbComb: lb(comb),
    fatLoja: loja.venda, lbLoja: lb(loja), cuponsLoja: loja.cupons, ticketLoja: loja.cupons > 0 ? loja.venda / loja.cupons : 0,
    fatAuto: auto.venda, lbAuto: lb(auto),
    shareLojaLb: lucro > 0 ? (lb(loja) / lucro) * 100 : 0,
    shareAutoLb: lucro > 0 ? (lb(auto) / lucro) * 100 : 0,
  }
}

export interface MesPar {
  mesA: string
  mesB: string
  a: { litros: number; fat: number; lb: number; margem: number } | null
  b: { litros: number; fat: number; lb: number; margem: number } | null
}

export interface ProdutoComb {
  codigo: number
  nome: string
  a: { litros: number; preco: number; custo: number; margemL: number; lb: number; share: number } | null
  b: { litros: number; preco: number; custo: number; margemL: number; lb: number; share: number } | null
}

export interface ProdutoLoja {
  codigo: number
  nome: string
  a: { fat: number; lb: number; margem: number; qtd: number; cupons: number } | null
  b: { fat: number; lb: number; margem: number; qtd: number; cupons: number } | null
}

export type TipoAchado = 'alerta' | 'oportunidade' | 'destaque' | 'nota'
export interface Achado {
  /** Identidade fixa do achado (regra + produto): casa o achado da rede com o mesmo achado em cada posto. */
  chave: string
  tipo: TipoAchado
  titulo: string
  detalhe: string
  /** Impacto estimado em R$/mês (positivo = dinheiro em jogo). Só quando dá pra calcular. */
  impactoMes?: number
  alavanca?: string
}

export interface Diagnostico {
  a: Janela
  b: Janela
  sujeito: Sujeito
  /** Meses com dado em cada janela; parciais = apurados só em parte (ficam fora da comparação). */
  cobertura: { a: string[]; b: string[]; faltamA: string[]; faltamB: string[]; parciais: { mes: string; dias: number }[] }
  /** Meses de A que têm par em B (a comparação usa só estes). */
  pareados: { a: string[]; b: string[] }
  totA: Totais
  totB: Totais | null
  /** A inteira (todos os meses de A com dado), pra mostrar o ano cheio quando B é parcial. */
  totAFull: Totais
  mesAMes: MesPar[]
  combustiveis: ProdutoComb[]
  loja: { top: ProdutoLoja[]; sumiram: ProdutoLoja[]; novos: ProdutoLoja[] }
  auto: { top: ProdutoLoja[]; sumiram: ProdutoLoja[]; novos: ProdutoLoja[] }
  achados: Achado[]
  temDados: boolean
}

const varPct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null)
const fmtPct1 = (v: number) => `${v > 0 ? '+' : ''}${(Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1)).replace('.', ',')}%`
const fmtBrl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtBrl2 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtL = (v: number) => `${Math.round(v).toLocaleString('pt-BR')} L`
const bonito = (nome: string | null) => {
  const n = (nome ?? '').trim().replace(/[.\s]+$/, '')
  if (!n) return 'Produto'
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
}

const diasNoMes = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()

export const calcularDiagnostico = (rows: LinhaMensal[], a: Janela, b: Janela, sujeito: Sujeito = 'posto'): Diagnostico => {
  // Sujeito das frases ("o posto" / "a rede") e unidade de tempo ("por mês" /
  // "no mês" quando a janela é um mês só).
  const S = sujeito === 'rede' ? 'a rede' : 'o posto'
  const S1 = sujeito === 'rede' ? 'A rede' : 'O posto'
  const dS = sujeito === 'rede' ? 'da rede' : 'do posto'
  const unidade = a.meses.length === 1 ? 'no mês' : 'por mês'
  // Dias apurados por mês = o maior `dias` entre os produtos do mês (o produto
  // que vende todo dia marca a cobertura). Mês com 3+ dias faltando é PARCIAL:
  // sai da comparação e da sazonalidade, e é declarado na cobertura.
  const diasPorMes = new Map<string, number>()
  for (const r of rows) if (r.quantidade > 0) diasPorMes.set(r.mes, Math.max(diasPorMes.get(r.mes) ?? 0, r.dias))
  const parciais: { mes: string; dias: number }[] = []
  const mesesComDado = new Set<string>()
  for (const [mes, dias] of diasPorMes) {
    if (dias >= diasNoMes(mes) - 3) mesesComDado.add(mes)
    else parciais.push({ mes, dias })
  }
  parciais.sort((x, y) => x.mes.localeCompare(y.mes))
  const cobA = a.meses.filter((m) => mesesComDado.has(m))
  const cobB = b.meses.filter((m) => mesesComDado.has(m))
  const parA: string[] = [], parB: string[] = []
  a.meses.forEach((m, i) => { if (mesesComDado.has(m) && mesesComDado.has(b.meses[i])) { parA.push(m); parB.push(b.meses[i]) } })
  const temB = parA.length > 0
  const setA = new Set(temB ? parA : cobA)
  const setB = new Set(parB)

  const totA = totaisDe(rows, setA)
  const totB = temB ? totaisDe(rows, setB) : null
  const totAFull = totaisDe(rows, new Set(cobA))

  // Mês a mês (sempre os 12 pares; null onde falta dado).
  const porMes = new Map<string, Agg>()
  for (const r of rows) { const g = porMes.get(r.mes) ?? agg0(); add(g, r); porMes.set(r.mes, g) }
  const litrosMes = new Map<string, number>()
  for (const r of rows) if (r.setor === 'combustivel') litrosMes.set(r.mes, (litrosMes.get(r.mes) ?? 0) + r.quantidade)
  const mesVal = (m: string) => {
    const g = porMes.get(m)
    if (!g || !mesesComDado.has(m)) return null
    return { litros: litrosMes.get(m) ?? 0, fat: g.venda, lb: lb(g), margem: margem(g) }
  }
  const mesAMes: MesPar[] = a.meses.map((m, i) => ({ mesA: m, mesB: b.meses[i], a: mesVal(m), b: mesVal(b.meses[i]) }))

  // Combustíveis por produto.
  const prodAgg = (setor: string, meses: Set<string>) => {
    const m = new Map<number, { nome: string | null; g: Agg }>()
    for (const r of rows) {
      if (r.setor !== setor || !meses.has(r.mes)) continue
      const e = m.get(r.produto_codigo) ?? { nome: r.produto_nome, g: agg0() }
      add(e.g, r); if (!e.nome && r.produto_nome) e.nome = r.produto_nome
      m.set(r.produto_codigo, e)
    }
    return m
  }
  const combA = prodAgg('combustivel', setA), combB = prodAgg('combustivel', setB)
  const litrosTotA = [...combA.values()].reduce((s, e) => s + e.g.qtd, 0)
  const litrosTotB = [...combB.values()].reduce((s, e) => s + e.g.qtd, 0)
  const combCodigos = new Set([...combA.keys(), ...combB.keys()])
  const combustiveis: ProdutoComb[] = [...combCodigos].map((c) => {
    const ea = combA.get(c), eb = combB.get(c)
    const mk = (e: { g: Agg } | undefined, tot: number) => (e && e.g.qtd > 0 ? { litros: e.g.qtd, preco: e.g.venda / e.g.qtd, custo: e.g.custo / e.g.qtd, margemL: lb(e.g) / e.g.qtd, lb: lb(e.g), share: tot > 0 ? (e.g.qtd / tot) * 100 : 0 } : null)
    return { codigo: c, nome: bonito(ea?.nome ?? eb?.nome ?? null), a: mk(ea, litrosTotA), b: temB ? mk(eb, litrosTotB) : null }
  }).sort((x, y) => (y.a?.litros ?? 0) - (x.a?.litros ?? 0))

  const lojaDe = (setor: string, topN: number) => {
    const pa = prodAgg(setor, setA), pb = prodAgg(setor, setB)
    const codigos = new Set([...pa.keys(), ...pb.keys()])
    const mk = (e: { g: Agg } | undefined) => (e && e.g.venda > 0 ? { fat: e.g.venda, lb: lb(e.g), margem: margem(e.g), qtd: e.g.qtd, cupons: e.g.cupons } : null)
    const todos: ProdutoLoja[] = [...codigos].map((c) => ({ codigo: c, nome: bonito(pa.get(c)?.nome ?? pb.get(c)?.nome ?? null), a: mk(pa.get(c)), b: temB ? mk(pb.get(c)) : null }))
    const top = todos.filter((p) => p.a).sort((x, y) => (y.a!.lb) - (x.a!.lb)).slice(0, topN)
    const sumiram = temB ? todos.filter((p) => p.b && !p.a).sort((x, y) => y.b!.fat - x.b!.fat).slice(0, 5) : []
    const novos = temB ? todos.filter((p) => p.a && !p.b).sort((x, y) => y.a!.lb - x.a!.lb).slice(0, 5) : []
    return { top, sumiram, novos }
  }
  const loja = lojaDe('conveniencia', 12)
  const auto = lojaDe('automotivos', 8)

  /* ───────── achados ───────── */
  const achados: Achado[] = []
  const nMeses = Math.max(1, setA.size)
  const noB = `no ${b.nome ?? 'ano anterior'}`
  if (totB && totB.meses > 0) {
    const vLit = varPct(totA.litros, totB.litros)
    if (vLit !== null && Math.abs(vLit) >= 5) {
      const difMes = (totA.litros - totB.litros) / nMeses
      achados.push({
        tipo: vLit < 0 ? 'alerta' : 'destaque',
        chave: 'volume',
        titulo: `Volume de combustível ${vLit < 0 ? 'caiu' : 'cresceu'} ${fmtPct1(vLit)}`,
        detalhe: `${fmtL(totA.litros / nMeses)} ${unidade} contra ${fmtL(totB.litros / nMeses)} ${noB} (${fmtL(Math.abs(difMes))} ${unidade} de diferença).`,
        impactoMes: Math.abs(difMes) * totB.lbPorLitro,
        alavanca: vLit < 0 ? 'Entender onde o volume foi: preço de bomba frente à concorrência, horários, frotas e clientes a prazo que sumiram.' : 'Proteger o ganho: garantir estoque e equipe nos horários de pico.',
      })
    }
    // Margem por litro, por combustível.
    for (const p of combustiveis) {
      if (!p.a || !p.b || p.a.litros < 1000) continue
      const dM = p.a.margemL - p.b.margemL
      const litrosMes = p.a.litros / nMeses
      const dPrecoPre = p.a.preco - p.b.preco, dCustoPre = p.a.custo - p.b.custo
      const absorveu = dCustoPre > 0.05 && dPrecoPre < dCustoPre - 0.03
      if (Math.abs(dM) >= 0.03 && !(dM < 0 && absorveu)) {
        achados.push({
          tipo: dM < 0 ? 'alerta' : 'destaque',
          chave: `margemL:${p.codigo}`,
          titulo: `${p.nome}: margem por litro ${dM < 0 ? 'caiu' : 'subiu'} ${fmtBrl2(Math.abs(dM))}`,
          detalhe: `${fmtBrl2(p.a.margemL)}/L agora contra ${fmtBrl2(p.b.margemL)}/L antes. No volume atual (${fmtL(litrosMes)} ${unidade}) isso ${dM < 0 ? 'tira' : 'coloca'} ${fmtBrl(Math.abs(dM) * litrosMes)} ${unidade}.`,
          impactoMes: Math.abs(dM) * litrosMes,
          alavanca: dM < 0 ? `Rever o preço de bomba de ${p.nome.toLowerCase()}: cada R$ 0,01/L recuperado vale ${fmtBrl(0.01 * litrosMes)} ${unidade}.` : 'Manter a disciplina de preço que trouxe o ganho.',
        })
      }
      // Custo subiu mais que o preço: o posto absorveu.
      const dPreco = p.a.preco - p.b.preco, dCusto = p.a.custo - p.b.custo
      if (dCusto > 0.05 && dPreco < dCusto - 0.03) {
        const absorvido = dCusto - dPreco
        achados.push({
          tipo: 'alerta',
          chave: `custo:${p.codigo}`,
          titulo: `${p.nome}: o custo subiu ${fmtBrl2(dCusto)}/L e ${dPreco > 0.005 ? `o preço só ${fmtBrl2(dPreco)}/L` : 'o preço não acompanhou'}`,
          detalhe: `${S1} absorveu ${fmtBrl2(absorvido)} por litro de aumento de custo: ${fmtBrl(absorvido * litrosMes)} ${unidade} que não foram repassados.`,
          impactoMes: absorvido * litrosMes,
          alavanca: 'Repasse mais rápido do custo de compra ao preço de bomba, acompanhando o CMP a cada nota.',
        })
      }
      const vVol = varPct(p.a.litros, p.b.litros)
      if (vVol !== null && Math.abs(vVol) >= 12 && p.b.litros >= 1000) {
        achados.push({
          tipo: vVol < 0 ? 'alerta' : 'destaque',
          chave: `volProd:${p.codigo}`,
          titulo: `${p.nome}: volume ${vVol < 0 ? 'caiu' : 'cresceu'} ${fmtPct1(vVol)}`,
          detalhe: `${fmtL(p.a.litros / nMeses)} ${unidade} contra ${fmtL(p.b.litros / nMeses)}. Participação no volume: ${p.a.share.toFixed(0)}% (antes ${p.b.share.toFixed(0)}%).`,
          impactoMes: (Math.abs(p.a.litros - p.b.litros) / nMeses) * p.b.margemL,
          alavanca: vVol < 0 ? `Comparar o preço de ${p.nome.toLowerCase()} com os vizinhos: queda isolada num produto costuma ser preço.` : 'Produto em alta: cuidar do estoque e do preço para não perder o embalo.',
        })
      }
    }
    // Loja.
    if (totB.fatLoja > 0 || totA.fatLoja > 0) {
      const vLb = varPct(totA.lbLoja, totB.lbLoja)
      if (vLb !== null && Math.abs(vLb) >= 10) {
        achados.push({
          tipo: vLb < 0 ? 'alerta' : 'destaque',
          chave: 'lucroLoja',
          titulo: `Lucro da loja ${vLb < 0 ? 'caiu' : 'cresceu'} ${fmtPct1(vLb)}`,
          detalhe: `${fmtBrl(totA.lbLoja / nMeses)} ${unidade} contra ${fmtBrl(totB.lbLoja / nMeses)}. A loja responde por ${totA.shareLojaLb.toFixed(0)}% do lucro ${dS} (antes ${totB.shareLojaLb.toFixed(0)}%).`,
          impactoMes: Math.abs(totA.lbLoja - totB.lbLoja) / nMeses,
          alavanca: vLb < 0 ? 'Mix e exposição: ver os produtos que sumiram e o ticket médio.' : 'Loja puxando o resultado: vale investir em mix e horário.',
        })
      }
      const vTicket = varPct(totA.ticketLoja, totB.ticketLoja)
      if (vTicket !== null && Math.abs(vTicket) >= 8 && totA.cuponsLoja > 0) {
        achados.push({
          tipo: vTicket < 0 ? 'alerta' : 'destaque',
          chave: 'ticket',
          titulo: `Ticket médio da loja ${vTicket < 0 ? 'caiu' : 'subiu'} ${fmtPct1(vTicket)}`,
          detalhe: `${fmtBrl2(totA.ticketLoja)} por cupom contra ${fmtBrl2(totB.ticketLoja)}. ${Math.round(totA.cuponsLoja / nMeses).toLocaleString('pt-BR')} cupons ${unidade}.`,
          impactoMes: Math.abs(totA.ticketLoja - totB.ticketLoja) * (totA.cuponsLoja / nMeses) * (totA.fatLoja > 0 ? totA.lbLoja / totA.fatLoja : 0),
          alavanca: vTicket < 0 ? 'Venda casada no caixa e combos: subir R$ 1 no ticket vale muito em cupom.' : 'Manter a oferta de balcão que está funcionando.',
        })
      }
      if (loja.sumiram.length >= 3) {
        achados.push({
          tipo: 'oportunidade',
          chave: 'sumiram',
          titulo: `${loja.sumiram.length} produtos da loja que vendiam ${noB} sumiram`,
          detalhe: `${loja.sumiram.slice(0, 3).map((p) => p.nome).join(', ')}${loja.sumiram.length > 3 ? '…' : ''}. Juntos faturavam ${fmtBrl(loja.sumiram.reduce((s, p) => s + (p.b?.fat ?? 0), 0) / nMeses)} ${unidade}.`,
          impactoMes: loja.sumiram.reduce((s, p) => s + (p.b?.lb ?? 0), 0) / nMeses,
          alavanca: 'Checar ruptura de estoque e cadastro: produto que some sem decisão é venda perdida.',
        })
      }
    }
    // Margem total.
    const dMarg = totA.margem - totB.margem
    if (Math.abs(dMarg) >= 0.5) {
      achados.push({
        tipo: dMarg < 0 ? 'alerta' : 'destaque',
        chave: 'margem',
        titulo: `Margem bruta ${dS} ${dMarg < 0 ? 'caiu' : 'subiu'} ${Math.abs(dMarg).toFixed(1).replace('.', ',')} ponto${Math.abs(dMarg) >= 1.95 ? 's' : ''}`,
        detalhe: `${totA.margem.toFixed(2).replace('.', ',')}% contra ${totB.margem.toFixed(2).replace('.', ',')}%. Sobre o faturamento atual, cada ponto de margem vale ${fmtBrl((totA.faturamento / nMeses) * 0.01)} ${unidade}.`,
        impactoMes: Math.abs(dMarg) * 0.01 * (totA.faturamento / nMeses),
      })
    }
    // Meses em que A ficou bem abaixo de B.
    const ruins = mesAMes.filter((m) => m.a && m.b && m.b.lb > 0 && (m.a.lb - m.b.lb) / m.b.lb <= -0.15)
    if (ruins.length > 0 && a.meses.length >= 3) {
      achados.push({
        tipo: 'nota',
        chave: 'mesesRuins',
        titulo: `${ruins.length} ${ruins.length === 1 ? 'mês ficou' : 'meses ficaram'} mais de 15% abaixo ${deJanelaB(b)} em lucro`,
        detalhe: ruins.slice(0, 4).map((m) => `${mesLabel(m.mesA)} (${fmtPct1(((m.a!.lb - m.b!.lb) / m.b!.lb) * 100)})`).join(', ') + (ruins.length > 4 ? '…' : '') + '.',
        alavanca: 'Levantar o que aconteceu nesses meses: preço, obra, concorrente novo, perda de frota.',
      })
    }
  } else if (totA.meses > 0) {
    achados.push({ chave: 'semBase', tipo: 'nota', titulo: `Sem base ${deJanelaB(b)} para comparar`, detalhe: 'O diagnóstico mostra os meses apurados do período atual. Apure o período de comparação para liberar os achados.', alavanca: 'Painel › Apuração: apurar os meses que faltam.' })
  }
  // Sazonalidade e concentração (valem com ou sem B).
  const comDado = mesAMes.filter((m) => m.a)
  if (comDado.length >= 6) {
    const melhor = [...comDado].sort((x, y) => y.a!.lb - x.a!.lb)[0], pior = [...comDado].sort((x, y) => x.a!.lb - y.a!.lb)[0]
    if (melhor && pior && pior.a!.lb > 0 && melhor.a!.lb / pior.a!.lb >= 1.3) {
      // Faturamento parecido com lucro muito diferente costuma ser CUSTO mal
      // registrado, não sazonalidade — o achado diz isso em vez de fingir certeza.
      const fatParecido = pior.a!.fat > 0 && Math.abs(melhor.a!.fat - pior.a!.fat) / pior.a!.fat < 0.15
      achados.push({
        tipo: 'nota',
        chave: 'oscila',
        titulo: `Lucro bruto oscila muito: ${mesLabel(melhor.mesA)} rendeu ${(melhor.a!.lb / pior.a!.lb).toFixed(1).replace('.', ',')}× ${mesLabel(pior.mesA)}`,
        detalhe: `Melhor mês ${fmtBrl(melhor.a!.lb)} de lucro bruto (fat. ${fmtBrl(melhor.a!.fat)}); pior ${fmtBrl(pior.a!.lb)} (fat. ${fmtBrl(pior.a!.fat)}).${fatParecido ? ' Faturamento parecido com lucro tão diferente aponta para custo registrado errado em algum dos meses.' : ' Caixa e compras precisam prever esse vale.'}`,
        alavanca: fatParecido ? 'Conferir o custo das notas de entrada nesses meses antes de tirar conclusão de margem.' : 'Planejar estoque e caixa pelos meses fracos, não pela média.',
      })
    }
  }
  const lider = combustiveis.find((p) => p.a)
  if (lider?.a && lider.a.share >= 70) {
    achados.push({ chave: `concentracao:${lider.codigo}`, tipo: 'nota', titulo: `${lider.a.share.toFixed(0)}% do volume é ${lider.nome.toLowerCase()}`, detalhe: `Resultado concentrado num produto: a margem dele decide o mês ${dS}.`, alavanca: `Acompanhar o preço e o custo de ${lider.nome.toLowerCase()} toda semana; é a alavanca que mais pesa.` })
  }
  if (totA.fatLoja === 0 && totA.litros > 0) {
    achados.push({ chave: 'semLoja', tipo: 'oportunidade', titulo: 'Nenhuma venda de loja apurada', detalhe: `Ou ${S} não tem loja, ou a loja vende fora do cupom fiscal integrado. Nos dois casos há dinheiro na mesa.`, alavanca: 'Confirmar se a loja está integrada ao sistema; se não há loja, avaliar.' })
  }

  const peso: Record<TipoAchado, number> = { alerta: 0, oportunidade: 1, destaque: 2, nota: 3 }
  achados.sort((x, y) => peso[x.tipo] - peso[y.tipo] || (y.impactoMes ?? 0) - (x.impactoMes ?? 0))

  return {
    a, b, sujeito,
    cobertura: {
      a: cobA, b: cobB,
      faltamA: a.meses.filter((m) => !mesesComDado.has(m) && !parciais.some((p) => p.mes === m)),
      faltamB: b.meses.filter((m) => !mesesComDado.has(m) && !parciais.some((p) => p.mes === m)),
      parciais: parciais.filter((p) => a.meses.includes(p.mes) || b.meses.includes(p.mes)),
    },
    pareados: { a: parA, b: parB },
    totA, totB, totAFull, mesAMes, combustiveis, loja, auto, achados,
    temDados: cobA.length > 0,
  }
}
