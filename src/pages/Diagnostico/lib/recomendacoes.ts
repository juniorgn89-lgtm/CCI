import type { Achado, Diagnostico } from '@/pages/Diagnostico/lib/diagnostico'
import type { Equipe, Financeiro, Pilar } from '@/pages/Diagnostico/lib/pilares'
import { calcularSaude } from '@/pages/Diagnostico/lib/saude'
import { brlHumano } from '@/pages/Diagnostico/lib/narrativa'

/**
 * Serviços da CCI que o próprio diagnóstico justifica. Catálogo = o do
 * Prospecção360 (src/lib/catalogo.ts): Consultoria, BPO Financeiro,
 * Relatórios Inteligentes e FleetPass — Visor360 o cliente já tem; troca de
 * sistema não tem sinal aqui. Cada recomendação só aparece com um número
 * deste posto/rede por trás (regra fixa, sem IA, sem preço).
 */
export type ServicoId = 'bpo-financeiro' | 'fleetpass' | 'relatorios' | 'consultoria'

export interface Recomendacao {
  id: ServicoId
  nome: string
  resumo: string
  /** As provas, já em frase, com os números deste diagnóstico. */
  porque: string[]
  incluso: string[]
  /** Peso para ordenar (R$ em jogo ou equivalente). */
  forca: number
  /** Já contratado em parte dos postos do escopo (nomes) — a recomendação vale para os demais. */
  contratado?: { em: string[]; total: number }
}

const CATALOGO: Record<ServicoId, { nome: string; resumo: string; incluso: string[] }> = {
  'bpo-financeiro': { nome: 'BPO Financeiro', resumo: 'A CCI executa a rotina financeira de ponta a ponta: o posto para de gastar o dia com conferência e passa a olhar resultado.', incluso: ['Fechamento diário de caixa por turno', 'Conciliação bancária', 'Contas a pagar e a receber em dia'] },
  fleetpass: { nome: 'FleetPass', resumo: 'Abastecimento de frota pré-aprovado: a transportadora libera antes, o frentista valida por QR e o posto recebe só o que foi autorizado.', incluso: ['Requisição pré-aprovada com limite', 'Validação na pista por QR', 'Faturamento por transportadora'] },
  relatorios: { nome: 'Relatórios Inteligentes', resumo: 'DRE gerencial, fluxo de caixa e análise por produto entregues prontos, com o que mudou e por quê.', incluso: ['DRE gerencial mensal', 'Fluxo de caixa com tendência de 6 meses', 'Análise de margem por produto'] },
  consultoria: { nome: 'Consultoria', resumo: 'A CCI mapeia como o posto trabalha, escreve as rotinas e treina a equipe, para o resultado não depender do dono.', incluso: ['Mapeamento dos processos', 'Rotinas documentadas e treinamento', 'KPIs operacionais e financeiros'] },
}

const num = (v: number, c = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c })

export const recomendar = ({ d, pilares, financeiro, equipe }: { d: Diagnostico; pilares: Pilar[] | null; financeiro: Financeiro | null; equipe: Equipe | null }): Recomendacao[] => {
  const out: Recomendacao[] = []
  const pelo = d.sujeito === 'rede' ? 'pela rede' : 'pelo posto'
  const lista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)
  const ach = (pref: string) => d.achados.filter((a: Achado) => a.chave.startsWith(pref))

  // BPO Financeiro: conta vencida dos dois lados.
  if (financeiro?.temDado && (financeiro.pagarVencido > 0 || financeiro.receberVencidoCount >= 5)) {
    const porque: string[] = []
    if (financeiro.pagarVencido > 0) porque.push(`${brlHumano(financeiro.pagarVencido)} a pagar vencido em ${num(financeiro.pagarVencidoCount)} ${financeiro.pagarVencidoCount === 1 ? 'título' : 'títulos'}: conta atrasada costuma virar juro, multa e boleto vencido.`)
    if (financeiro.receberVencido > 0) porque.push(`${brlHumano(financeiro.receberVencido)} a receber vencido em ${num(financeiro.receberVencidoCount)} ${financeiro.receberVencidoCount === 1 ? 'título' : 'títulos'}${financeiro.diasReceber != null && financeiro.diasReceber >= 0.5 ? ` (${num(financeiro.diasReceber, financeiro.diasReceber < 10 ? 1 : 0)} dias de faturamento parados na rua)` : ''}.`)
    out.push({ id: 'bpo-financeiro', ...CATALOGO['bpo-financeiro'], porque, forca: financeiro.pagarVencido + financeiro.receberVencido })
  }

  // FleetPass: atraso de cliente a prazo concentrado em poucos (perfil de frota).
  if (financeiro?.temDado && financeiro.receberVencido > 0 && financeiro.topDevedores.length > 0 && financeiro.topDevedores[0].share >= 15) {
    const top = financeiro.topDevedores.slice(0, 3)
    out.push({
      id: 'fleetpass', ...CATALOGO.fleetpass,
      porque: [
        `O atraso está concentrado: ${top.map((t) => `${t.nome} (${brlHumano(t.valor)})`).join(', ')} respondem por ${num(top.reduce((s, t) => s + t.share, 0))}% do vencido a receber.`,
        'Se esses clientes são frota (transportadora, ônibus, agro), abastecimento pré-aprovado acaba com o "essa assinatura não é nossa" no fim do mês.',
      ],
      forca: top.reduce((s, t) => s + t.valor, 0) * 0.5,
    })
  }

  // Relatórios Inteligentes: decisão de preço sem o número certo.
  const custo = ach('custo:'), oscila = ach('oscila')
  if (custo.length > 0 || oscila.length > 0) {
    const porque: string[] = []
    if (custo.length > 0) porque.push(`Custo de compra subiu e não foi para a bomba em ${custo.length} ${custo.length === 1 ? 'combustível' : 'combustíveis'}: ${brlHumano(custo.reduce((s, a) => s + (a.impactoMes ?? 0), 0))} por mês absorvidos ${pelo}.`)
    if (oscila.length > 0) porque.push(`${oscila[0].titulo}. ${oscila[0].detalhe.includes('custo registrado errado') ? 'Faturamento parecido com lucro tão diferente aponta custo lançado errado: sem DRE gerencial, isso passa despercebido.' : 'Sem DRE e fluxo de caixa, o mês fraco pega o caixa de surpresa.'}`)
    out.push({ id: 'relatorios', ...CATALOGO.relatorios, porque, forca: custo.reduce((s, a) => s + (a.impactoMes ?? 0), 0) + (oscila.length ? 5000 : 0) })
  }

  // Consultoria: saúde baixa, vários pilares ruins ou equipe girando.
  if (pilares) {
    const s = calcularSaude(pilares)
    const ruins = pilares.filter((p) => p.status === 'critico' || p.status === 'atencao')
    const giro = (equipe?.pista.sumiram.length ?? 0) + (equipe?.loja.sumiram.length ?? 0)
    if ((s.pontos != null && s.pontos < 75) || ruins.length >= 2 || giro >= 4) {
      const porque: string[] = []
      if (s.pontos != null && s.pontos < 75) porque.push(`Nota de saúde ${s.pontos} de 100${ruins.length ? `: ${lista(ruins.map((p) => p.nome.toLowerCase()))} ${ruins.length === 1 ? 'pede' : 'pedem'} atenção` : ''}.`)
      else if (ruins.length >= 2) porque.push(`${ruins.length} pilares pedem atenção: ${lista(ruins.map((p) => p.nome.toLowerCase()))}.`)
      if (giro >= 4) porque.push(`${giro} pessoas saíram da equipe no período: cada saída leva junto o jeito de fazer o fechamento e a venda.`)
      out.push({ id: 'consultoria', ...CATALOGO.consultoria, porque, forca: (100 - (s.pontos ?? 100)) * 1000 + giro * 2000 })
    }
  }

  return out.sort((a, b) => b.forca - a.forca).slice(0, 3)
}
