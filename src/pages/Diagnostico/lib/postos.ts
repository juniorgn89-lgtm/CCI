import { calcularDiagnostico, type Janela, type LinhaMensal } from '@/pages/Diagnostico/lib/diagnostico'
import { brlHumano, litrosHumano, pctHumano } from '@/pages/Diagnostico/lib/narrativa'

/**
 * Posto a posto — a parte do diagnóstico da rede que a soma esconde: quem
 * puxou o lucro para cima e para baixo, quem ganha mais e menos por litro,
 * onde a loja pesa e onde não existe. Mesmo motor do diagnóstico, rodado
 * por posto, sobre os mesmos meses pareados.
 */

export interface PostoResumo {
  codigo: number
  nome: string
  meses: number
  temDados: boolean
  litrosMes: number
  lucroMes: number
  lucroMesB: number | null
  /** Variação do lucro bruto contra o período de comparação, em %. */
  varLucro: number | null
  lbPorLitro: number
  lbPorLitroB: number | null
  margem: number
  lucroLojaMes: number
  shareLoja: number
}

export interface PostoAPosto {
  postos: PostoResumo[]
  /** Postos da rede sem venda apurada no período (ficam fora da tabela, mas são ditos). */
  semDado: string[]
  frases: string[]
  /** Lucro por litro médio da rede (lucro de combustível ÷ litros), base das comparações. */
  lbPorLitroRede: number
}

const num2 = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const listar = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

export const compararPostos = (rows: LinhaMensal[], a: Janela, b: Janela, nomeDe: (codigo: number) => string, codigos: number[] = []): PostoAPosto => {
  const porPosto = new Map<number, LinhaMensal[]>()
  for (const r of rows) {
    if (r.empresa_codigo == null) continue
    const l = porPosto.get(r.empresa_codigo) ?? []
    l.push(r)
    porPosto.set(r.empresa_codigo, l)
  }
  const postos: PostoResumo[] = []
  let lbCombRede = 0, litrosRede = 0
  for (const [codigo, sub] of porPosto) {
    const d = calcularDiagnostico(sub, a, b, 'posto')
    if (!d.temDados) continue
    const n = Math.max(1, d.totA.meses)
    const nB = Math.max(1, d.totB?.meses ?? 1)
    const lucroMesB = d.totB ? d.totB.lucroBruto / nB : null
    const lucroMes = d.totA.lucroBruto / n
    lbCombRede += d.totA.lbComb; litrosRede += d.totA.litros
    postos.push({
      codigo, nome: nomeDe(codigo), meses: d.totA.meses, temDados: true,
      litrosMes: d.totA.litros / n,
      lucroMes, lucroMesB,
      varLucro: lucroMesB && lucroMesB > 0 ? ((lucroMes - lucroMesB) / lucroMesB) * 100 : null,
      lbPorLitro: d.totA.lbPorLitro, lbPorLitroB: d.totB ? d.totB.lbPorLitro : null,
      margem: d.totA.margem,
      lucroLojaMes: d.totA.lbLoja / n, shareLoja: d.totA.shareLojaLb,
    })
  }
  postos.sort((x, y) => y.lucroMes - x.lucroMes)
  const lbPorLitroRede = litrosRede > 0 ? lbCombRede / litrosRede : 0
  const porMes = a.meses.length === 1 ? 'no mês' : 'por mês'
  const comDado = new Set(postos.map((p) => p.codigo))
  const semDado = codigos.filter((c) => !comDado.has(c)).map(nomeDe)

  const frases: string[] = []
  if (semDado.length) frases.push(`${listar(semDado)} ${semDado.length === 1 ? 'não tem' : 'não têm'} venda apurada em ${a.rotulo}: ${semDado.length === 1 ? 'fica' : 'ficam'} fora desta comparação até ser apurado.`)
  if (postos.length < 2) return { postos, semDado, frases, lbPorLitroRede }

  // Quem puxou o lucro para cima / para baixo (em R$/mês contra o comparativo).
  const comB = postos.filter((p) => p.lucroMesB != null).map((p) => ({ p, dif: p.lucroMes - (p.lucroMesB as number) }))
  if (comB.length >= 2) {
    const sobe = comB.filter((x) => x.dif > 0).sort((x, y) => y.dif - x.dif)
    const desce = comB.filter((x) => x.dif < 0).sort((x, y) => x.dif - y.dif)
    const fmtDif = (x: { p: PostoResumo; dif: number }) => `${x.p.nome} (${x.dif > 0 ? '+' : '−'}${brlHumano(Math.abs(x.dif))} ${porMes})`
    if (sobe.length && desce.length) frases.push(`Quem puxou o lucro para cima: ${listar(sobe.slice(0, 3).map(fmtDif))}. Quem puxou para baixo: ${listar(desce.slice(0, 3).map(fmtDif))}.`)
    else if (sobe.length) frases.push(`Todos os postos lucraram mais do que no período de comparação; os maiores saltos foram de ${listar(sobe.slice(0, 3).map(fmtDif))}.`)
    else if (desce.length) frases.push(`Nenhum posto lucrou mais do que no período de comparação; as maiores quedas foram de ${listar(desce.slice(0, 3).map(fmtDif))}.`)
  }

  // Lucro por litro: melhor e pior, e quanto vale o pior chegar à média da rede.
  const comLitros = postos.filter((p) => p.litrosMes > 0)
  if (comLitros.length >= 2 && lbPorLitroRede > 0) {
    const melhor = [...comLitros].sort((x, y) => y.lbPorLitro - x.lbPorLitro)[0]
    const pior = [...comLitros].sort((x, y) => x.lbPorLitro - y.lbPorLitro)[0]
    if (melhor.codigo !== pior.codigo && melhor.lbPorLitro - pior.lbPorLitro >= 0.03) {
      const ganho = (lbPorLitroRede - pior.lbPorLitro) * pior.litrosMes
      frases.push(`O melhor lucro por litro é do ${melhor.nome} (${num2(melhor.lbPorLitro)}); o menor, do ${pior.nome} (${num2(pior.lbPorLitro)}). A média da rede é ${num2(lbPorLitroRede)}${ganho >= 100 ? `: se o ${pior.nome} chegasse nela, seriam cerca de ${brlHumano(ganho)} ${porMes} a mais` : ''}.`)
    }
  }

  // Concentração do lucro da rede num posto.
  const lucroRede = postos.reduce((s, p) => s + p.lucroMes, 0)
  if (lucroRede > 0) {
    const lider = postos[0]
    const share = (lider.lucroMes / lucroRede) * 100
    if (share >= 40) frases.push(`${lider.nome} responde por ${pctHumano(share)} do lucro da rede (${brlHumano(lider.lucroMes)} ${porMes}, ${litrosHumano(lider.litrosMes)}): o resultado da rede depende dele.`)
  }

  // Loja: onde pesa e onde não aparece.
  const pesa = postos.filter((p) => p.lucroLojaMes > 0 && p.shareLoja >= 20).sort((x, y) => y.shareLoja - x.shareLoja)
  const semLoja = postos.filter((p) => p.lucroLojaMes <= 0)
  if (pesa.length) frases.push(`A loja pesa em ${listar(pesa.slice(0, 3).map((p) => `${p.nome} (${pctHumano(p.shareLoja)} do lucro)`))}.${semLoja.length ? ` Em ${listar(semLoja.map((p) => p.nome))} não aparece venda de loja: ou não há loja, ou ela vende fora do cupom integrado.` : ''}`)
  else if (semLoja.length === postos.length) frases.push('Nenhum posto da rede tem venda de loja apurada.')

  return { postos, semDado, frases, lbPorLitroRede }
}
