import type { AjusteEextrato, PrevisaoCreditoEextrato, VendaEextrato } from '@/api/supabase/eextrato'
import { nomeBandeira, nomeDivergencia, nomeMotivoAjuste, nomeOperadora } from '@/lib/eextrato/codigos'

/** Nome da adquirente/bandeira: o que a e-extrato mandou; sem isso, a tabela do manual. */
export const rotuloRede = (x: { descricaoRede?: string | null; rede: number | null }) => x.descricaoRede || nomeOperadora(x.rede)
export const rotuloBandeira = (x: { descricaoBandeira?: string | null; bandeira: number | null }) => x.descricaoBandeira || nomeBandeira(x.bandeira)

/**
 * Contas da aba Conciliação de cartão, sobre os retornos da e-extrato.
 * Regra do anti-enganação: valor que não veio não vira zero. Cada soma diz em
 * quantas linhas se apoiou (`base`) para a tela avisar quando é parcial.
 */

/** Valor bruto da linha: a parcela (retorno por parcela) ou a venda. */
export const valorLinha = (v: VendaEextrato) => v.valorParcela ?? v.valorVenda ?? 0

/** Taxa em R$ da linha: bruto − líquido da parcela; sem isso, o valor de taxa informado. */
export const taxaLinha = (v: VendaEextrato): number | null =>
  v.valorParcela != null && v.valorLiquidoParcela != null ? v.valorParcela - v.valorLiquidoParcela : v.valorTaxaAdministracao

export const ehConciliada = (v: VendaEextrato) => v.statusConciliacao === 1
export const ehNaoConciliada = (v: VendaEextrato) => v.statusConciliacao === 2
export const ehCancelada = (v: VendaEextrato) => v.status === 'CAN' || v.status === 'CTP' || v.status === 'CPP'

/** Motivo legível da não conciliação (Tabela VII quando vem o código). */
export const motivoLegivel = (v: VendaEextrato): string | null => {
  const m = v.motivoConciliacao?.trim()
  if (!m) return null
  return /^\d+$/.test(m) ? nomeDivergencia(Number(m)) : m
}

export interface ResumoConciliacao {
  linhas: number
  bruto: number
  conciliadas: number
  naoConciliadas: VendaEextrato[]
  valorNaoConciliado: number
  /** Linhas sem status de conciliação (nem 1 nem 2). */
  semStatus: number
  taxa: number
  /** Bruto das linhas que têm taxa (base do % efetivo). */
  brutoComTaxa: number
  antecipadas: { qtd: number; valor: number }
  canceladas: { qtd: number; valor: number }
  /** Última data de venda recebida da e-extrato. */
  ultimaVenda: string | null
}

export const resumir = (vendas: VendaEextrato[]): ResumoConciliacao => {
  const r: ResumoConciliacao = {
    linhas: vendas.length, bruto: 0, conciliadas: 0, naoConciliadas: [], valorNaoConciliado: 0, semStatus: 0,
    taxa: 0, brutoComTaxa: 0, antecipadas: { qtd: 0, valor: 0 }, canceladas: { qtd: 0, valor: 0 }, ultimaVenda: null,
  }
  for (const v of vendas) {
    const valor = valorLinha(v)
    r.bruto += valor
    if (ehConciliada(v)) r.conciliadas++
    else if (ehNaoConciliada(v)) { r.naoConciliadas.push(v); r.valorNaoConciliado += valor }
    else r.semStatus++
    const t = taxaLinha(v)
    if (t != null) { r.taxa += t; r.brutoComTaxa += valor }
    if (v.status === 'ANT') { r.antecipadas.qtd++; r.antecipadas.valor += valor }
    if (ehCancelada(v)) { r.canceladas.qtd++; r.canceladas.valor += v.valorCancelado ?? v.valorCanceladoPrevisto ?? valor }
    if (v.dataVenda && (!r.ultimaVenda || v.dataVenda > r.ultimaVenda)) r.ultimaVenda = v.dataVenda
  }
  r.naoConciliadas.sort((a, b) => (b.dataVenda ?? '').localeCompare(a.dataVenda ?? '') || valorLinha(b) - valorLinha(a))
  return r
}

export interface DiaAgenda { dia: string; parcelas: number; bruto: number; taxas: number; liquido: number; antecipadas: number; porOperadora: Map<string, number> }

/**
 * Agenda de créditos: o que cai por dia, das parcelas com data prevista
 * (retorno 5.6). Cancelada não entra; líquido sem valor informado usa
 * bruto − taxas. A quebra por adquirente é pelo líquido.
 */
export const agendaPorDia = (previsoes: PrevisaoCreditoEextrato[]): DiaAgenda[] => {
  const m = new Map<string, DiaAgenda>()
  for (const p of previsoes) {
    if (!p.dataCredito || p.status === 'CAN') continue
    const d = m.get(p.dataCredito) ?? { dia: p.dataCredito, parcelas: 0, bruto: 0, taxas: 0, liquido: 0, antecipadas: 0, porOperadora: new Map() }
    const bruto = p.valorBruto ?? 0
    const taxas = (p.valorAdministracao ?? 0) + (p.valorAntecipacao ?? 0)
    const liquido = p.valorLiquido ?? bruto - taxas
    d.parcelas++; d.bruto += bruto; d.taxas += taxas; d.liquido += liquido
    if (p.status === 'ANT') d.antecipadas++
    const nome = rotuloRede(p)
    d.porOperadora.set(nome, (d.porOperadora.get(nome) ?? 0) + liquido)
    m.set(p.dataCredito, d)
  }
  return [...m.values()].sort((a, b) => a.dia.localeCompare(b.dia))
}

export interface GrupoAjuste { historico: number | null; nome: string; qtd: number; credito: number; debito: number; itens: AjusteEextrato[] }

/** Ajustes e tarifas agrupados pelo motivo (Tabela III). Chargeback = 6. */
export const ajustesPorMotivo = (ajustes: AjusteEextrato[]): GrupoAjuste[] => {
  const m = new Map<number | null, GrupoAjuste>()
  for (const a of ajustes) {
    const g = m.get(a.historico) ?? { historico: a.historico, nome: a.descricaoHistorico || nomeMotivoAjuste(a.historico), qtd: 0, credito: 0, debito: 0, itens: [] }
    g.qtd++; g.credito += a.credito ?? 0; g.debito += a.debito ?? 0; g.itens.push(a)
    m.set(a.historico, g)
  }
  return [...m.values()].sort((a, b) => b.debito - a.debito)
}
