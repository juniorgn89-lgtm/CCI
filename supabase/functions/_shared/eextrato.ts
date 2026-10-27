// ============================================================================
// e-extrato (Boavista) — conciliadora de cartão. Manual "Integração Web
// Services v9.3.11" (01/09/2026; respostas JSON no layout V10). Módulo PURO (sem Deno, sem rede): monta o filtro em XML,
// lê a resposta JSON e normaliza os registros. Quem chama (Edge Function)
// faz o fetch com as chaves; os testes rodam no Node com os exemplos do manual
// (node supabase/functions/_shared/eextrato.test.ts).
//
// Só os RETORNOS (consulta). A REMESSA (enviar vendas do ERP para conciliar)
// é escrita num sistema de terceiro e fica fora até ser decidida.
// Os retornos são POST com corpo XML, mas só leem: exceção explícita à regra
// GET-only, que vale para o ERP Quality.
// ============================================================================

export const EEXTRATO_BASE = 'https://integracao.eextrato.com.br/conciliador/rest'

export type TipoRetorno = 'venda' | 'vendaDetalhada' | 'pagamento' | 'ajuste' | 'recebivel' | 'dataPrevistaCredito'

export const CAMINHO_RETORNO: Record<TipoRetorno, string> = {
  venda: '/retorno/v9/venda',
  vendaDetalhada: '/retorno/v9/vendaDetalhada',
  pagamento: '/retorno/v9/pagamento',
  ajuste: '/retorno/v9/ajuste',
  recebivel: '/retorno/v9/recebivel',
  // 5.6 — a URL vem cortada no PDF ("…/dataPrevistaCredi"); o nome do endpoint
  // está no controle de versão (9.3.2). Confirmar na primeira chamada real.
  dataPrevistaCredito: '/retorno/v9/dataPrevistaCredito',
}

/** Filtro dos retornos (manual 5.1–5.6). Datas yyyy-MM-dd. */
export interface FiltroEextrato {
  dataVendaInicio?: string
  dataVendaFim?: string
  dataPagamentoInicio?: string
  dataPagamentoFim?: string
  /** Data (prevista) do crédito — filtra o retorno 5.6; nos recebíveis só cumpre a exigência de período. */
  dataCreditoInicio?: string
  dataCreditoFim?: string
  /** Quando a e-extrato processou / atualizou o registro — base de uma cópia incremental. */
  dataProcessamentoInicio?: string
  dataProcessamentoFim?: string
  dataAtualizacaoInicio?: string
  dataAtualizacaoFim?: string
  /** Tabela IV. Pagamento: 1 pagamentos, 3 antecipações. Recebível: 5 cessão, 6 gravame. */
  tipoArquivo?: number
  /** Tabela V: 1 todas, 2 débito, 3 crédito. */
  tipoVenda?: number
  /** Tabela V (1 todas, 2 débito, 3 crédito); tem precedência sobre tipoVenda onde existe. */
  tipoProduto?: number
  /** Ajuste: Tabela III (1–7; 7 = tarifa). */
  historico?: number
  /** Ajuste: PENDENTE ou CONFIRMADO. */
  statusPagamento?: 'PENDENTE' | 'CONFIRMADO'
  dadosCliente?: string
  pagina?: number
  /** Tabela VI: 1 conciliada, 2 não conciliada. Vazio = todas. */
  statusConciliacao?: number
  codigoLoja?: string
  nsu?: string
  autorizacao?: string
  /** Tabela I (operadora/adquirente). */
  rede?: number
  /** Tabela II (bandeira). */
  bandeira?: number
}

const DATA = /^\d{4}-\d{2}-\d{2}$/

const PERIODOS = [
  ['dataVendaInicio', 'dataVendaFim'], ['dataPagamentoInicio', 'dataPagamentoFim'], ['dataCreditoInicio', 'dataCreditoFim'],
  ['dataProcessamentoInicio', 'dataProcessamentoFim'], ['dataAtualizacaoInicio', 'dataAtualizacaoFim'],
] as const

/** Erro de filtro antes de chamar a API (a API recusaria do mesmo jeito): pelo menos um período completo. */
export const validarFiltro = (_tipo: TipoRetorno, f: FiltroEextrato): string | null => {
  for (const par of PERIODOS) for (const k of par) {
    if (f[k] != null && !DATA.test(f[k]!)) return `${k} deve estar no formato AAAA-MM-DD`
  }
  for (const [ini, fim] of PERIODOS) if (!!f[ini] !== !!f[fim]) return `${ini} e ${fim} vão juntos`
  return PERIODOS.some(([ini, fim]) => f[ini] && f[fim]) ? null : 'Informe pelo menos um período completo (início e fim).'
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** Corpo XML <Filtro> na ordem do manual; campos vazios ficam de fora. */
export const montarFiltroXml = (f: FiltroEextrato): string => {
  const tag = (nome: string, v: string | number | undefined | null) =>
    v == null || v === '' ? '' : `  <${nome}>${esc(String(v))}</${nome}>\n`
  const corpo =
    tag('dataVendaInicio', f.dataVendaInicio) +
    tag('dataVendaFim', f.dataVendaFim) +
    tag('dataPagamentoInicio', f.dataPagamentoInicio) +
    tag('dataPagamentoFim', f.dataPagamentoFim) +
    tag('dataCreditoInicio', f.dataCreditoInicio) +
    tag('dataCreditoFim', f.dataCreditoFim) +
    tag('dataProcessamentoInicio', f.dataProcessamentoInicio) +
    tag('dataProcessamentoFim', f.dataProcessamentoFim) +
    tag('dataAtualizacaoInicio', f.dataAtualizacaoInicio) +
    tag('dataAtualizacaoFim', f.dataAtualizacaoFim) +
    tag('tipoArquivo', f.tipoArquivo) +
    tag('tipoVenda', f.tipoVenda) +
    tag('tipoProduto', f.tipoProduto) +
    tag('historico', f.historico) +
    tag('statusPagamento', f.statusPagamento) +
    tag('dadosCliente', f.dadosCliente) +
    tag('pagina', f.pagina ?? 1) +
    tag('statusConciliacao', f.statusConciliacao) +
    tag('codigoLoja', f.codigoLoja) +
    tag('nsu', f.nsu) +
    tag('autorizacao', f.autorizacao) +
    (f.rede != null ? `  <rede>\n    <id>${f.rede}</id>\n  </rede>\n` : '') +
    (f.bandeira != null ? `  <bandeira>\n    <id>${f.bandeira}</id>\n  </bandeira>\n` : '')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Filtro>\n${corpo}</Filtro>`
}

/** Cabeçalhos de toda chamada. As chaves nunca saem do servidor. */
export const cabecalhos = (chaveAcesso: string, chaveSecreta: string) => ({
  chaveAcesso,
  chaveSecreta,
  'Content-Type': 'application/xml',
  Accept: 'application/json',
})

/* ------------------------------------------------------------ normalização */

type Bruto = Record<string, unknown>

const txt = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const int = (v: unknown): number | null => { const n = num(v); return n == null ? null : Math.trunc(n) }
const dia = (v: unknown): string | null => { const s = txt(v); return s && DATA.test(s.slice(0, 10)) ? s.slice(0, 10) : null }

/** Situação da parcela/pagamento (manual 5.2): previsto, pago, antecipado, cancelado, cancelado total/parcial previsto. */
export type StatusEextrato = 'PRE' | 'PAG' | 'ANT' | 'CAN' | 'CTP' | 'CPP'
const status = (v: unknown): StatusEextrato | null => {
  const s = txt(v)?.toUpperCase()
  return s === 'PRE' || s === 'PAG' || s === 'ANT' || s === 'CAN' || s === 'CTP' || s === 'CPP' ? s : null
}

/** Campos comuns a venda, pagamento e ajuste. */
interface Base {
  dataVenda: string | null
  nsu: string | null
  autorizacao: string | null
  tid: string | null
  plano: number | null
  parcela: number | null
  /** Tabela I. */
  rede: number | null
  /** Tabela II. */
  bandeira: number | null
  /** 'C' crédito, 'D' débito (como veio). */
  produto: string | null
  /** Tabela VIII. */
  codigoProduto: number | null
  numeroLote: string | null
  areaCliente: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
  codigoLojaErp: string | null
  codigoEstabelecimento: string | null
  /** Tabela VI: 1 conciliada, 2 não conciliada. */
  statusConciliacao: number | null
  modoCaptura: string | null
  horaVenda: string | null
  /** Nome da adquirente/bandeira como a e-extrato manda (v9.3.11); a tela prefere ao código. */
  descricaoRede: string | null
  descricaoBandeira: string | null
  dataConciliacao: string | null
  dataCancelamento: string | null
}

const base = (r: Bruto): Base => ({
  dataVenda: dia(r.dataVenda),
  nsu: txt(r.nsu),
  autorizacao: txt(r.autorizacao),
  tid: txt(r.tid),
  plano: int(r.plano),
  parcela: int(r.parcela),
  rede: int(r.rede),
  bandeira: int(r.bandeira),
  produto: txt(r.produto)?.toUpperCase() ?? null,
  // O manual escreve "coditoProduto" nos exemplos JSON de ajuste/recebível.
  codigoProduto: int(r.codigoProduto ?? r.coditoProduto),
  numeroLote: txt(r.numeroLote),
  areaCliente: txt(r.areaCliente),
  banco: txt(r.banco),
  agencia: txt(r.agencia),
  conta: txt(r.conta),
  codigoLojaErp: txt(r.codigoLojaErp),
  codigoEstabelecimento: txt(r.codigoEstabelecimento),
  statusConciliacao: int(r.statusConciliacao),
  modoCaptura: txt(r.modoCaptura),
  horaVenda: txt(r.horaVenda),
  descricaoRede: txt(r.descricaoRede),
  descricaoBandeira: txt(r.descricaoBandeira),
  dataConciliacao: dia(r.dataConciliacao),
  dataCancelamento: dia(r.dataCancelamento),
})

export interface VendaEextrato extends Base {
  dataCredito: string | null
  valorVenda: number | null
  taxaAdministracao: number | null
  valorTaxaAdministracao: number | null
  taxaAntecipacao: number | null
  numeroCartao: string | null
  maquinaLoja: string | null
  /** Tabela VII (motivo da não conciliação). */
  motivoConciliacao: string | null
  conciliadoManual: boolean | null
  /** Só no retorno por parcela. */
  valorParcela: number | null
  valorLiquidoParcela: number | null
  valorCancelado: number | null
  valorCanceladoPrevisto: number | null
  status: StatusEextrato | null
}

export interface PagamentoEextrato extends Base {
  dataPagamento: string | null
  /** Data do crédito (no 5.6, a data PREVISTA do crédito da parcela). */
  dataCredito: string | null
  dataPrevistaCredito: string | null
  valorBruto: number | null
  taxaAdministracao: number | null
  valorAdministracao: number | null
  taxaAntecipacao: number | null
  valorAntecipacao: number | null
  valorLiquido: number | null
  valorPago: number | null
  status: StatusEextrato | null
}

export interface AjusteEextrato extends Base {
  dataCreditoDebito: string | null
  credito: number | null
  debito: number | null
  /** Tabela III: 1 aluguel POS inativo, 2 cancelamento, 3 aluguel POS, 4 ajuste, 5 consulta de cheques, 6 chargeback, 7 tarifa. */
  historico: number | null
  descricaoHistorico: string | null
  mesReferencia: string | null
  tipoProduto: string | null
  /** PENDENTE ou CONFIRMADO. */
  statusPagamento: string | null
  /** Só recebível (UR): vencimento e chave da unidade de recebível. */
  dataVencimento: string | null
  chaveUr: string | null
}

export type RecebivelEextrato = Omit<AjusteEextrato, 'dataVenda' | 'nsu' | 'autorizacao' | 'tid' | 'plano' | 'parcela' | 'areaCliente' | 'mesReferencia' | 'modoCaptura' | 'horaVenda'>

const venda = (r: Bruto): VendaEextrato => {
  const tc = r.tipoConciliacao as Bruto | null | undefined
  return {
    ...base(r),
    dataCredito: dia(r.dataCredito),
    valorVenda: num(r.valorVenda),
    taxaAdministracao: num(r.taxaAdministracao),
    valorTaxaAdministracao: num(r.valorTaxaAdministracao),
    taxaAntecipacao: num(r.taxaAntecipacao),
    numeroCartao: txt(r.numeroCartao),
    maquinaLoja: txt(r.maquinaLoja),
    motivoConciliacao: txt(r.motivoConciliacao),
    conciliadoManual: tc && typeof tc.conciliadoManual === 'boolean' ? tc.conciliadoManual : tc && tc.conciliadoManual != null ? String(tc.conciliadoManual) === 'true' : null,
    valorParcela: num(r.valorParcela),
    valorLiquidoParcela: num(r.valorLiquidoParcela),
    valorCancelado: num(r.valorCancelado),
    valorCanceladoPrevisto: num(r.valorCanceladoPrevisto),
    status: status(r.status),
  }
}

const pagamento = (r: Bruto): PagamentoEextrato => ({
  ...base(r),
  dataPagamento: dia(r.dataPagamento),
  dataCredito: dia(r.dataCredito),
  dataPrevistaCredito: dia(r.dataPrevistaCredito),
  valorBruto: num(r.valorBruto),
  taxaAdministracao: num(r.taxaAdministracao),
  valorAdministracao: num(r.valorAdministracao),
  taxaAntecipacao: num(r.taxaAntecipacao),
  valorAntecipacao: num(r.valorAntecipacao),
  valorLiquido: num(r.valorLiquido),
  valorPago: num(r.valorPago),
  status: status(r.status),
})

const ajuste = (r: Bruto): AjusteEextrato => ({
  ...base(r),
  dataCreditoDebito: dia(r.dataCreditoDebito),
  credito: num(r.credito),
  debito: num(r.debito),
  historico: int(r.historico),
  descricaoHistorico: txt(r.descricaoHistorico),
  mesReferencia: txt(r.mesReferencia),
  tipoProduto: txt(r.tipoProduto),
  statusPagamento: txt(r.statusPagamento),
  dataVencimento: dia(r.dataVencimento),
  chaveUr: txt(r.chaveUr),
})

const recebivel = (r: Bruto): RecebivelEextrato => {
  const { dataVenda: _a, nsu: _b, autorizacao: _c, tid: _d, plano: _e, parcela: _f, areaCliente: _g, mesReferencia: _h, modoCaptura: _i, horaVenda: _j, ...resto } = ajuste(r)
  return resto
}

export interface ItensPorTipo {
  venda: VendaEextrato
  vendaDetalhada: VendaEextrato
  pagamento: PagamentoEextrato
  ajuste: AjusteEextrato
  recebivel: RecebivelEextrato
  /** 5.6: cada parcela com a data prevista do crédito (mesmo formato do pagamento). */
  dataPrevistaCredito: PagamentoEextrato
}

const NORMALIZA: { [K in TipoRetorno]: (r: Bruto) => ItensPorTipo[K] } = {
  venda, vendaDetalhada: venda, pagamento, ajuste, recebivel, dataPrevistaCredito: pagamento,
}

/** Onde a lista vem no JSON: vendas.vendasV10, pagamentos.pagamentosV10, ajustes.ajustesV10, recebiveis.recebiveisV10, dataCreditoPrevistos.dataCreditoPrevistoV10 (V9 também é aceito). */
const RAIZ: Record<TipoRetorno, string[]> = {
  venda: ['vendas'],
  vendaDetalhada: ['vendas'],
  pagamento: ['pagamentos'],
  ajuste: ['ajustes'],
  // O exemplo do manual traz a chave com espaço ("recebiveis ").
  recebivel: ['recebiveis', 'recebiveis '],
  dataPrevistaCredito: ['dataCreditoPrevistos'],
}

/** Primeira lista dentro do bloco (vendasV9, venda[], …), tolerante a nomes. */
const listaDe = (bloco: unknown): Bruto[] => {
  if (Array.isArray(bloco)) return bloco as Bruto[]
  if (bloco && typeof bloco === 'object') {
    for (const v of Object.values(bloco as Bruto)) {
      if (Array.isArray(v)) return v as Bruto[]
      if (v && typeof v === 'object') return [v as Bruto] // um registro só, vindo como objeto
    }
  }
  return []
}

export type RespostaEextrato<T> =
  | { ok: true; pagina: number; totalPaginas: number; itens: T[] }
  | { ok: false; erro: string }

/** Lê a resposta JSON de um retorno. Erro da API vem como { ok:false, erro } com a descrição dela. */
export const lerResposta = <K extends TipoRetorno>(tipo: K, corpo: unknown): RespostaEextrato<ItensPorTipo[K]> => {
  if (!corpo || typeof corpo !== 'object') return { ok: false, erro: 'Resposta vazia ou fora do formato JSON.' }
  const r = corpo as Bruto
  const erro = r.erro as Bruto | undefined
  if (r.rejeitado === true || (erro && (erro.rejeitado === true || erro.status === 'ERRO'))) {
    return { ok: false, erro: txt(erro?.descricao) ?? 'A e-extrato recusou a consulta.' }
  }
  const chave = RAIZ[tipo].find((k) => k in r)
  const itens = chave ? listaDe(r[chave]).map(NORMALIZA[tipo]) : []
  return { ok: true, pagina: int(r.paginaAtual) ?? 1, totalPaginas: int(r.totalPaginas) ?? 1, itens }
}

/**
 * Busca todas as páginas. `buscar(pagina)` faz o POST e devolve o JSON.
 * `maxPaginas` é teto de segurança: se bater nele, `completo` = false e quem
 * mostra o dado tem que dizer que está parcial (nunca somar como se fosse tudo).
 */
export const buscarTodasPaginas = async <K extends TipoRetorno>(
  tipo: K,
  buscar: (pagina: number) => Promise<unknown>,
  maxPaginas = 200,
): Promise<{ ok: true; itens: ItensPorTipo[K][]; paginas: number; completo: boolean } | { ok: false; erro: string; pagina: number }> => {
  const itens: ItensPorTipo[K][] = []
  let total = 1
  for (let p = 1; p <= Math.min(total, maxPaginas); p++) {
    const r = lerResposta(tipo, await buscar(p))
    if (!r.ok) return { ok: false, erro: r.erro, pagina: p }
    itens.push(...r.itens)
    total = Math.max(r.totalPaginas, 1)
  }
  return { ok: true, itens, paginas: Math.min(total, maxPaginas), completo: total <= maxPaginas }
}
