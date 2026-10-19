import { mesLabel, type Achado, type Diagnostico, type Totais, type ModoJanela } from '@/pages/Diagnostico/lib/diagnostico'

/**
 * A narrativa: o diagnóstico contado como um consultor contaria, em frases
 * curtas. Determinística — cada frase nasce de um número do `Diagnostico`,
 * e os números entram arredondados e poucos. Nada de IA, nada de adjetivo
 * sem base.
 */

export interface Prioridade {
  acao: string
  porque: string
  ganho: string | null
}

export interface Narrativa {
  abertura: string
  veredito: string
  bem: string[]
  preocupa: string[]
  prioridades: Prioridade[]
  limites: string[]
  fechamento: string | null
}

/* ───────── números em linguagem de gente ───────── */

const num = (v: number, casas = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/** "R$ 850", "R$ 2,7 mil", "R$ 1,19 milhão". */
export const brlHumano = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `R$ ${num(v / 1_000_000, a >= 10_000_000 ? 1 : 2)} ${a >= 2_000_000 ? 'milhões' : 'milhão'}`
  if (a >= 10_000) return `R$ ${num(v / 1000, 0)} mil`
  if (a >= 1_000) return `R$ ${num(v / 1000, 1)} mil`
  return `R$ ${num(v, 0)}`
}

/** "850 litros", "137 mil litros", "1,65 milhão de litros". */
export const litrosHumano = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${num(v / 1_000_000, 2)} ${a >= 2_000_000 ? 'milhões' : 'milhão'} de litros`
  if (a >= 1_000) return `${num(v / 1000, 0)} mil litros`
  return `${num(v, 0)} litros`
}

/** "7%", "0,8%", "107%". */
export const pctHumano = (v: number) => `${num(Math.abs(v), Math.abs(v) >= 10 ? 0 : 1)}%`

const brl2 = (v: number) => `R$ ${num(v, 2)}`

/** "Diesel s-10." → "diesel S-10"; "Gasolina comum." → "gasolina comum". */
const produto = (nome: string) => nome.replace(/\.+$/, '').replace(/\bs-(\d+)/i, 'S-$1').toLowerCase()

/** "Gasolina comum.: o custo subiu R$ 0,43/L" → ["gasolina comum", "o custo subiu R$ 0,43/L"] */
const partes = (titulo: string): [string | null, string] => {
  const m = titulo.match(/^([^:]+): (.+)$/)
  return m ? [produto(m[1]), m[2]] : [null, titulo]
}

const frase = (s: string) => {
  const t = s.trim().replace(/\s+/g, ' ')
  return /[.!?]$/.test(t) ? t : `${t}.`
}

const listar = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

/* ───────── a narrativa ───────── */

/** Leitura extra do modo "mês": o mesmo mês contra o mês imediatamente anterior. */
export interface MesAnterior { tot: Totais; rotulo: string }

export const narrar = (d: Diagnostico, posto: string, mesAnterior?: MesAnterior | null, modo?: ModoJanela): Narrativa => {
  const A = d.totA, B = d.totB
  const n = Math.max(1, A.meses)
  const temB = !!B && B.meses > 0
  const nomeB = d.b.nome ?? 'ano anterior'
  // Sujeito ("o posto" / "a rede") e unidade de tempo da janela.
  const S = d.sujeito === 'rede' ? 'a rede' : 'o posto'
  const S1 = d.sujeito === 'rede' ? 'A rede' : 'O posto'
  const dS = d.sujeito === 'rede' ? 'da rede' : 'do posto'
  const porMes = A.meses === 1 ? 'no mês' : 'por mês'
  // Nome do período pela JANELA escolhida — "últimos 12 meses" não é "o ano", e
  // "ano até o mês passado" é um ano em andamento (nada de "foi um ano").
  const periodo = A.meses === 1 ? 'mês' : 'período'
  const manchetePositiva = modo === 'mes' || A.meses === 1 ? 'Foi um mês bom'
    : modo === '12m' ? 'Os últimos 12 meses foram bons'
    : modo === 'ano' ? 'O ano está indo bem até aqui'
    : modo === 'cci' ? 'Desde a entrada da CCI, o resultado melhorou'
    : 'Foi um período bom'

  // Abertura: o que foi olhado e com que cobertura.
  let abertura = `Olhei ${d.a.rotulo} ${d.sujeito === 'rede' ? 'da' : 'do'} ${posto}`
  if (temB) {
    abertura += ` e comparei com ${d.b.rotulo}.`
    if (d.pareados.a.length < d.a.meses.length) {
      const faltas = [...d.cobertura.faltamA, ...d.cobertura.faltamB]
      abertura += ` Consegui comparar ${d.pareados.a.length} ${d.pareados.a.length === 1 ? 'mês' : 'meses'}, porque ${faltas.length > 0 ? `ainda não há apuração de ${listar(faltas.slice(0, 6).map(mesLabel))}${faltas.length > 6 ? ' e outros' : ''}` : 'alguns meses foram apurados só em parte'}.`
    }
  } else {
    abertura += `. Ainda não tenho o ${nomeB} apurado, então vou falar só do que vi neste período; a comparação completa fica para quando os meses anteriores forem apurados.`
  }

  // Veredito: uma ou duas frases que resumem o ano.
  let veredito: string
  if (!temB) {
    veredito = `Neste período ${S} vendeu ${litrosHumano(A.litros)}, faturou ${brlHumano(A.faturamento)} e ficou com ${brlHumano(A.lucroBruto)} de lucro bruto, uma margem de ${pctHumano(A.margem)}. Isso dá ${brl2(A.lbPorLitro)} de lucro por litro.`
  } else {
    const vLb = B!.lucroBruto > 0 ? ((A.lucroBruto - B!.lucroBruto) / B!.lucroBruto) * 100 : 0
    const vLit = B!.litros > 0 ? ((A.litros - B!.litros) / B!.litros) * 100 : 0
    const dMarg = A.margem - B!.margem
    const dLbL = A.lbPorLitro - B!.lbPorLitro
    const lucroTxt = `o lucro bruto ${vLb >= 0 ? 'subiu' : 'caiu'} ${pctHumano(vLb)} (${brlHumano(A.lucroBruto / n)} ${porMes}, antes ${brlHumano(B!.lucroBruto / n)})`
    // Margem em % pode cair com o preço subindo mesmo quando o posto ganha MAIS
    // por litro — por isso quem decide a frase é o lucro por litro, não o %.
    // Variação fora do comum: antes de chamar de bom ou ruim, pede para conferir a base.
    if (Math.abs(vLb) >= 50 || Math.abs(vLit) >= 50) {
      const sobe = vLb >= 0
      veredito = `${sobe ? 'Um salto fora do comum' : 'Uma queda fora do comum'}: ${lucroTxt} e o volume ${vLit >= 0 ? 'cresceu' : 'caiu'} ${pctHumano(vLit)}. Uma variação desse tamanho raramente vem só da operação: pode ser posto que abriu, reformou ou trocou de bandeira no ${nomeB}, mês apurado pela metade na base ou mudança de cadastro. Vale confirmar a base antes de tirar conclusão.`
    } else if (vLb >= 3 && dLbL >= -0.01) {
      const margemTxt = dMarg < -0.3
        ? `A margem em porcentagem caiu ${num(Math.abs(dMarg), 1)} ponto${Math.abs(dMarg) >= 1.95 ? 's' : ''}, mas isso é efeito do preço mais alto: o lucro por litro foi de ${brl2(B!.lbPorLitro)} para ${brl2(A.lbPorLitro)}, ou seja, ${S} não perdeu nada na bomba.`
        : `${S1} está vendendo mais sem abrir mão de ganhar por litro (${brl2(B!.lbPorLitro)} antes, ${brl2(A.lbPorLitro)} agora).`
      veredito = `${manchetePositiva}: ${lucroTxt} e o volume ${vLit >= 0 ? 'cresceu' : 'caiu'} ${pctHumano(vLit)}. ${margemTxt}`
    } else if (vLb >= 3 && dLbL < -0.01) {
      veredito = `${S1} vendeu mais, mas ganhou menos em cada litro: ${lucroTxt}, puxado pelo volume (${vLit >= 0 ? '+' : '−'}${pctHumano(vLit)}), enquanto a margem caiu ${num(Math.abs(dMarg), 1)} ${Math.abs(dMarg) >= 1.95 ? 'pontos' : 'ponto'} e o lucro por litro foi de ${brl2(B!.lbPorLitro)} para ${brl2(A.lbPorLitro)}. Crescer assim é bom, mas está deixando dinheiro na bomba.`
    } else if (vLb < -3 && vLit < -3) {
      veredito = `${S1} encolheu: ${lucroTxt} e o volume caiu ${pctHumano(vLit)}. ${dLbL < -0.02 ? `E ainda ganhou menos por litro (${brl2(B!.lbPorLitro)} para ${brl2(A.lbPorLitro)}).` : 'O lucro por litro se manteve, então o problema é volume, não preço.'}`
    } else if (vLb < -3 && vLit >= -3) {
      veredito = `Vendeu parecido e lucrou menos: ${lucroTxt} com o volume ${vLit >= 0 ? 'até crescendo' : 'praticamente igual'}. O que mudou foi a margem: ${brl2(B!.lbPorLitro)} por litro antes, ${brl2(A.lbPorLitro)} agora. Isso é preço e custo, e se resolve na bomba.`
    } else {
      veredito = `${S1} está estável: ${lucroTxt}, volume ${vLit >= 0 ? '+' : '−'}${pctHumano(vLit)} e margem ${dMarg >= 0 ? 'um pouco acima' : 'um pouco abaixo'} do ${nomeB}. Não há susto, mas também não há salto.`
    }
  }

  // Modo "mês": segunda leitura, contra o mês imediatamente anterior.
  if (mesAnterior && mesAnterior.tot.meses > 0) {
    const M = mesAnterior.tot
    const vLbM = M.lucroBruto > 0 ? ((A.lucroBruto - M.lucroBruto) / M.lucroBruto) * 100 : null
    const vLitM = M.litros > 0 ? ((A.litros - M.litros) / M.litros) * 100 : null
    if (vLbM != null && vLitM != null) {
      veredito += ` Contra ${mesAnterior.rotulo}, o mês anterior, o lucro ${vLbM >= 0 ? 'subiu' : 'caiu'} ${pctHumano(vLbM)} e o volume ${vLitM >= 0 ? 'cresceu' : 'caiu'} ${pctHumano(vLitM)}${Math.abs(vLbM) < 3 && Math.abs(vLitM) < 3 ? ': mês parecido com o anterior' : ''}.`
    }
  }

  // O que está indo bem / o que preocupa — a partir dos achados.
  const destaques = d.achados.filter((x) => x.tipo === 'destaque')
  const alertas = d.achados.filter((x) => x.tipo === 'alerta')
  const oportunidades = d.achados.filter((x) => x.tipo === 'oportunidade')
  const notas = d.achados.filter((x) => x.tipo === 'nota')

  const comoFrase = (x: Achado, comImpacto: boolean) => {
    const [prod, resto] = partes(x.titulo)
    const limpo = resto.replace(/(cresceu|subiu|ganhou) \+/g, '$1 ').replace(/(caiu|perdeu) -/g, '$1 ')
    const corpo = prod ? `Em ${prod}, ${limpo.charAt(0).toLowerCase()}${limpo.slice(1)}` : limpo.replace(/(cresceu|subiu) \+/g, '$1 ').replace(/(caiu) -/g, '$1 ')
    const impacto = comImpacto && x.impactoMes && x.impactoMes >= 100 ? ` São cerca de ${brlHumano(x.impactoMes)} ${porMes} em jogo.` : ''
    return frase(corpo) + impacto
  }

  const bem = destaques.slice(0, 3).map((x) => comoFrase(x, true))
  if (temB && bem.length === 0 && A.margem >= B!.margem) bem.push(`A margem não caiu, o que já é mérito num ${periodo} de custo subindo.`)
  if (A.lbLoja > 0 && A.shareLojaLb >= 20) bem.push(`A loja faz a diferença aqui: ${pctHumano(A.shareLojaLb)} do lucro ${dS} vem dela.`)

  const preocupa = alertas.slice(0, 4).map((x) => comoFrase(x, true))
  if (temB && A.fatLoja === 0 && B!.fatLoja === 0) { /* sem loja: vai pros limites */ }

  // Prioridades: as três maiores alavancas em R$/mês.
  const candidatos = [...alertas, ...oportunidades].filter((x) => x.alavanca).sort((x, y) => (y.impactoMes ?? 0) - (x.impactoMes ?? 0))
  const prioridades: Prioridade[] = candidatos.slice(0, 3).map((x) => {
    const [prod, resto] = partes(x.titulo)
    return {
      acao: frase(x.alavanca!),
      porque: prod ? frase(`Hoje, em ${prod}, ${resto.replace(/(cresceu|subiu) \+/g, '$1 ').replace(/(caiu) -/g, '$1 ').charAt(0).toLowerCase()}${resto.replace(/(cresceu|subiu) \+/g, '$1 ').replace(/(caiu) -/g, '$1 ').slice(1)}`) : frase(x.titulo.replace(/(cresceu|subiu) \+/g, '$1 ').replace(/(caiu) -/g, '$1 ')),
      ganho: x.impactoMes && x.impactoMes >= 100 ? `Vale cerca de ${brlHumano(x.impactoMes)} ${porMes}.` : null,
    }
  })
  if (prioridades.length === 0) {
    prioridades.push({ acao: 'Manter a rotina semanal de preço e custo por combustível.', porque: 'Nada saiu da curva entre os dois períodos; o risco agora é relaxar.', ganho: null })
  }

  // Limites e checagens: o que não dá pra afirmar ainda.
  const limites: string[] = []
  if (!temB) limites.push(`Sem o ${nomeB} apurado não dá para dizer se ${S} está melhor ou pior do que era. Essa é a primeira coisa a fazer.`)
  if (temB && d.cobertura.faltamB.length > 0) limites.push(`Faltam ${d.cobertura.faltamB.length} ${d.cobertura.faltamB.length === 1 ? 'mês' : 'meses'} do ${nomeB} (${listar(d.cobertura.faltamB.slice(0, 4).map(mesLabel))}${d.cobertura.faltamB.length > 4 ? '…' : ''}); com eles a comparação fica inteira.`)
  if (d.cobertura.parciais.length > 0) limites.push(`${listar(d.cobertura.parciais.map((p) => `${mesLabel(p.mes)} (${p.dias} dias)`))} ${d.cobertura.parciais.length === 1 ? 'está apurado só em parte e ficou' : 'estão apurados só em parte e ficaram'} fora da conta.`)
  for (const x of notas) {
    if (/Lucro bruto oscila/.test(x.titulo)) limites.push(frase(`${x.titulo}. ${x.detalhe.includes('custo registrado') ? 'Faturamento parecido com lucro tão diferente costuma ser custo lançado errado em algum mês, e isso contamina a margem do ano. Vale conferir as notas de entrada antes de concluir qualquer coisa sobre margem' : 'Caixa e compras precisam prever esse vale'}`))
    else if (/do volume é/.test(x.titulo)) limites.push(frase(`${x.titulo}: a margem desse produto decide o mês ${dS}, então é ele que merece acompanhamento semanal`))
    else limites.push(frase(`${x.titulo}. ${x.detalhe}`))
  }
  if (A.fatLoja === 0 && A.litros > 0) limites.push(`Não apareceu venda de loja. Ou ${S} não tem loja, ou ela vende fora do cupom integrado: nos dois casos é uma conversa a ter, porque loja costuma valer de 15% a 30% do lucro de um posto.`)
  if (d.b.nome === 'período antes da CCI') limites.push(`O "antes e depois" compara os ${A.meses} ${A.meses === 1 ? 'mês' : 'meses'} com a CCI com os ${A.meses} imediatamente anteriores, não com o mesmo trecho do ano passado: parte da diferença pode ser época do ano, preço de compra ou mercado, não só o trabalho feito. Com 12 meses de CCI, a comparação ano contra ano passa a valer mais.`)
  limites.push('Este diagnóstico usa venda fiscal, venda por funcionário e títulos em aberto. Perdas de tanque, turnos, horários de pico e taxa de cartão entram na próxima etapa.')

  const fechamento = prioridades.length > 0 && prioridades[0].ganho
    ? `Se for fazer uma coisa só este mês: ${prioridades[0].acao.charAt(0).toLowerCase()}${prioridades[0].acao.slice(1)} ${prioridades[0].ganho}`
    : null

  return { abertura, veredito, bem, preocupa, prioridades, limites, fechamento }
}
