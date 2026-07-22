import type { ReceivableRow, PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'
import type { Cartao } from '@/api/types/financeiro'

/**
 * Fonte ÚNICA de classificação e montagem das linhas de Contas a Receber e a
 * Pagar. As tabelas (ReceberTabela/PagarTabela) E o dashboard consomem estas
 * funções, então os totais BATEM por construção — não há lógica duplicada que
 * possa divergir.
 *
 * A receber = títulos pendentes (/TITULO_RECEBER) + cartões (/CARTAO). O título
 * pendente É a dívida em aberto — a receber não tem pagamento parcial, então o
 * valor cheio é o saldo devido. NÃO usamos /DUPLICATA como stream separado: um
 * título faturado (convertido=true) já está aqui como "fatura", e cruzar com a
 * duplicata só escondia recebíveis quando a duplicata não voltava completa da API
 * (o card "Em atraso" via 137 títulos e a tabela mostrava 21). Fonte = os títulos.
 */

const todayISO = () => new Date().toISOString().split('T')[0]
const onlyDate = (s: string) => (s ?? '').split('T')[0]
const diffDays = (from: string, to: string) =>
  Math.max(0, Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000))

/* ─────────────── A RECEBER ─────────────── */

export type InstReceber = 'cartoes' | 'apps' | 'notas' | 'faturas' | 'outros'

export interface RecebRow {
  key: string
  empresa: number
  instrumento: InstReceber
  cliente: string
  sub: string
  valor: number
  vencimento: string
  vencido: boolean
  diasAtraso: number
  documento: string
}

/** Modalidade "app/carteira digital" (vs cartão crédito/débito) pelo tipo da
 *  administradora (ou descrição da bandeira como fallback). */
export const isApp = (s: string) => {
  const x = (s || '').toLowerCase()
  return x.includes('digital') || x.includes('pix') || x.includes('carteira') || x.includes('app')
}

/** Instrumento do título a receber. Faturado (convertido=true) = fatura/boleto;
 *  não faturado com "nota" no tipo = nota a prazo; resto = outros. NUNCA descarta
 *  — o título pendente é a dívida em aberto (a receber não tem pagamento parcial,
 *  então o valor cheio é o saldo devido). */
export const catTituloReceber = (r: ReceivableRow): InstReceber => {
  if (r.convertido === true) return 'faturas'
  return (r.tipo || '').toLowerCase().includes('nota') ? 'notas' : 'outros'
}

/** Só a dívida de CLIENTE (títulos pendentes): notas, faturas, outros. É o que a
 *  aba Contas a Receber (cobrança) mostra — cartões/apps ficam de fora, pois são
 *  recebíveis a compensar da adquirente, não cobrança de cliente. */
export const buildCobrancaRows = (titulos: ReceivableRow[]): RecebRow[] => {
  const hoje = todayISO()
  const out: RecebRow[] = []
  for (const t of titulos) {
    if (!t.pendente) continue
    const cat = catTituloReceber(t)
    const venc = onlyDate(t.dataVencimento)
    const vencido = !!venc && venc < hoje
    const sub = cat === 'faturas' ? (t.tipo?.trim() || 'Fatura / boleto') : (t.tipo || '—')
    out.push({ key: `t${t.codigo}`, empresa: t.empresaCodigo, instrumento: cat, cliente: (t.nomeCliente || `Cliente ${t.clienteCodigo}`).trim(), sub, valor: t.valor, vencimento: venc, vencido, diasAtraso: vencido ? diffDays(venc, hoje) : 0, documento: t.documento || '' })
  }
  return out
}

/** Recebíveis COMPLETOS: cobrança de cliente + cartões/apps a compensar (/CARTAO).
 *  Usado só pelo dashboard (que mostra o bloco "Cartões e apps" à parte).
 *  `adminTipo` mapeia `${empresaCodigo}-${administradoraCodigo}` → tipo (separa
 *  Apps de Cartões). */
export const buildReceberRows = (
  titulos: ReceivableRow[],
  cartoes: Cartao[],
  adminTipo: Map<string, string>,
): RecebRow[] => {
  const hoje = todayISO()
  const cartaoRows: RecebRow[] = []
  for (const c of cartoes) {
    if (!c.pendente) continue
    const venc = onlyDate(c.vencimento)
    const vencido = !!venc && venc < hoje
    const modal = adminTipo.get(`${c.empresaCodigo}-${c.administradoraCodigo}`) || c.adiministradoraDescricao || ''
    cartaoRows.push({ key: `c${c.codigo}`, empresa: c.empresaCodigo, instrumento: isApp(modal) ? 'apps' : 'cartoes', cliente: (c.clienteRazao || c.clienteReferencia || 'Cartão').trim(), sub: c.adiministradoraDescricao || 'Cartão', valor: c.valor, vencimento: venc, vencido, diasAtraso: vencido ? diffDays(venc, hoje) : 0, documento: c.nsu || c.autorizacao || '' })
  }
  return [...cartaoRows, ...buildCobrancaRows(titulos)]
}

/* ─────────────── A PAGAR ─────────────── */

export type InstPagar = 'boleto' | 'tributo' | 'pix' | 'transferencia' | 'convenio' | 'outros'

export interface PagarRow {
  key: string
  empresa: number
  instrumento: InstPagar
  fornecedor: string
  sub: string
  valor: number
  vencimento: string
  vencido: boolean
  diasAtraso: number
  documento: string
}

/** Instrumento do pagável pelo tipoLancamento da Quality (enum conhecido). */
export const catPagar = (r: PayableRow): InstPagar => {
  const tl = String((r as Record<string, unknown>).tipoLancamento ?? '').toUpperCase()
  if (tl === 'BOLETO') return 'boleto'
  if (tl === 'TRIBUTO') return 'tributo'
  if (tl === 'PIX') return 'pix'
  if (tl === 'TED' || tl === 'DOC' || tl === 'CREDITO_CONTA') return 'transferencia'
  if (tl === 'CONVENIO') return 'convenio'
  return 'outros'
}

/** Linhas de pagáveis em aberto (vencido + a vencer), instrumento por tipoLancamento. */
export const buildPagarRows = (payables: PayableRow[]): PagarRow[] => {
  const out: PagarRow[] = []
  for (const p of payables) {
    if (p.statusTag !== 'vencido' && p.statusTag !== 'a-vencer') continue
    const venc = onlyDate(p.vencimento)
    const vencido = p.statusTag === 'vencido'
    const parc = p.quantidadeParcelas > 1 ? `Parcela ${p.parcela}/${p.quantidadeParcelas}` : ''
    out.push({
      key: `p${p.codigo}`, empresa: p.empresaCodigo, instrumento: catPagar(p),
      fornecedor: (p.nomeFornecedor || `Fornecedor ${p.fornecedorCodigo}`).trim(),
      sub: p.descricao?.trim() || parc || p.tipo || '—',
      valor: p.saldoRestante, vencimento: venc, vencido, diasAtraso: p.diasAtraso,
      documento: String((p as Record<string, unknown>).numeroTitulo ?? ''),
    })
  }
  return out
}
