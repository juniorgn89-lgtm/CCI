// @ts-nocheck — Deno. Financeiro do mock:
//  - /CARTAO: recebíveis de cartão derivados dos MESMOS pagamentos do dia
//    (reconcilia com o bucket "cartão" do caixa).
//  - /TITULO_RECEBER + /TITULO_PAGAR: pool AR/AP próprio (faturas de frota e
//    contas de fornecedor), determinístico por posto, com vencidos pro
//    Financeiro "em atraso".

import { gerarDia } from './dia.ts'
import { CLIENTES, ADM_BY_CODE } from './catalogs.ts'
import { rngFor, between, intBetween, pick } from './generator.ts'

const r2 = (n: number) => Math.round(n * 100) / 100
const addDays = (dateISO: string, n: number): string => {
  const [y, m, d] = dateISO.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/* ─── /CARTAO (recebíveis) ─── */
export const gerarCartoes = (empresaCodigo: number, dateISO: string, hoje: string): any[] => {
  const { formas } = gerarDia(empresaCodigo, dateISO)
  const out: any[] = []
  for (const f of formas) {
    if (f.tipoFormaPagamento !== 'CARTAO') continue
    const adm = ADM_BY_CODE[f.administradoraCodigo]
    const pendente = f.vencimento > hoje
    out.push({
      codigo: f.codigo,
      cartaoCodigo: f.codigo,
      empresaCodigo,
      vendaCodigo: f.vendaCodigo,
      vencimento: f.vencimento,
      valor: f.valorPagamento,
      parcela: 1,
      taxaPercentual: f.taxaPercentual,
      administradoraCodigo: f.administradoraCodigo,
      adiministradoraDescricao: adm?.descricao ?? f.nomeFormaPagamento,
      clienteReferencia: '000001',
      clienteRazao: 'CONSUMIDOR FINAL',
      clienteCpfCnpj: '00.000.000/0000-00',
      centroCustoCodigo: 1,
      centroCustoDescricao: 'PISTA',
      dataPagamento: pendente ? '' : f.vencimento,
      tipoInclusao: 'PDV',
      dataMovimento: dateISO,
      horaMovimento: f.dataMovimento ? '12:00:00' : '12:00:00',
      dataFiscal: dateISO,
      pendente,
      nsu: String(f.codigo).slice(-9),
      autorizacao: String(f.codigo).slice(-6),
      codigoBandeira: String(f.administradoraCodigo % 20),
      nsuTef: null,
    })
  }
  return out
}

/* ─── /TITULO_RECEBER (frota a prazo) ─── */
export const titulosReceber = (empresaCodigo: number, hoje: string): any[] => {
  const rng = rngFor(empresaCodigo, 'titulos-receber')
  const out: any[] = []
  const N = 48
  for (let i = 0; i < N; i++) {
    const cli = pick(rng, CLIENTES)
    // ~75% da carteira vence na JANELA NAVEGÁVEL (≈ hoje-14 … hoje+45), pra o
    // calendário de recebimento ficar "cheio" nas semanas que o usuário abre.
    // ~25% é histórico (vencimento mais no passado) que alimenta o "Em atraso".
    let mov: string
    let venc: string
    if (i % 4 !== 0) {
      venc = addDays(hoje, intBetween(rng, -14, 45))
      mov = addDays(venc, -intBetween(rng, 15, 45))
    } else {
      mov = addDays(hoje, -intBetween(rng, 40, 120))
      venc = addDays(mov, intBetween(rng, 15, 45))
    }
    // A vencer quase nunca está pago; vencido já foi recebido em ~metade dos casos.
    const pago = venc < hoje ? rng() < 0.5 : rng() < 0.05
    const tituloCodigo = empresaCodigo * 100000 + i
    out.push({
      codigo: tituloCodigo,
      empresaCodigo,
      tituloCodigo,
      dataMovimento: mov,
      dataVencimento: venc,
      valor: r2(between(rng, 2000, 25000)),
      vendaCodigo: 0,
      duplicataCodigo: 0,
      tipo: 'BOLETO',
      pendente: !pago,
      clienteCodigo: cli.codigo,
      dataPagamento: pago ? addDays(venc, -intBetween(rng, 0, 8)) : '',
      planoContaGerencialCodigo: 1,
      nomeCliente: cli.nome,
      cpfCnpjCliente: cli.cpfCnpj,
      convertido: false,
      documento: `DUP-${tituloCodigo}`,
      tituloNumero: tituloCodigo,
    })
  }
  return out
}

/* ─── /TITULO_PAGAR (fornecedores) ─── */
const FORNECEDORES = [
  'Petrobras Distribuidora', 'Ipiranga Produtos', 'Raízen Combustíveis', 'Vibra Energia',
  'Distribuidora Aurora', 'Lubrificantes Cosan', 'Transporte Rodocarga', 'Energia Elétrica CPFL',
  'Companhia de Água SABESP', 'Manutenção TecPump',
]
export const titulosPagar = (empresaCodigo: number, hoje: string): any[] => {
  const rng = rngFor(empresaCodigo, 'titulos-pagar')
  const out: any[] = []
  const N = 32
  for (let i = 0; i < N; i++) {
    const fornIdx = intBetween(rng, 0, FORNECEDORES.length - 1)
    const nome = FORNECEDORES[fornIdx]
    const utilidade = fornIdx >= 7 // energia/água/manutenção = valores menores
    // ~75% vence na JANELA NAVEGÁVEL (≈ hoje-14 … hoje+40), pra o calendário de
    // pagamento ficar "cheio"; ~25% é histórico que alimenta o "Em atraso".
    let mov: string
    let venc: string
    if (i % 4 !== 0) {
      venc = addDays(hoje, intBetween(rng, -14, 40))
      mov = addDays(venc, -intBetween(rng, 7, 35))
    } else {
      mov = addDays(hoje, -intBetween(rng, 35, 120))
      venc = addDays(mov, intBetween(rng, 7, 35))
    }
    // A vencer quase nunca está pago; vencido já foi quitado em ~metade dos casos.
    const pago = venc < hoje ? rng() < 0.5 : rng() < 0.05
    const tituloPagarCodigo = empresaCodigo * 100000 + 50000 + i
    const valor = utilidade ? r2(between(rng, 1000, 8000)) : r2(between(rng, 15000, 120000))
    out.push({
      codigo: tituloPagarCodigo,
      empresaCodigo,
      tituloPagarCodigo,
      notaEntradaCodigo: 0,
      dataMovimento: mov,
      vencimento: venc,
      dataPagamento: pago ? addDays(venc, -intBetween(rng, 0, 6)) : '',
      situacao: pago ? 'P' : 'A',
      tipo: 'BOLETO',
      tipoLancamento: 'BOLETO',
      valor,
      valorPago: pago ? valor : 0,
      desconto: 0,
      acrescimo: 0,
      cheque: 0,
      dinheiro: 0,
      troco: 0,
      adiantamento: 0,
      cartao: 0,
      fornecedorCodigo: 9500 + fornIdx,
      planoContaGerencialCodigo: 1,
      descricao: nome,
      numeroTitulo: String(tituloPagarCodigo),
      nomeFornecedor: nome,
      cpfCnpjFornecedor: `33.333.333/000${fornIdx}-00`,
      pagamento: [],
      numeroRemessa: 0,
      planoContaGerencialNivel: '',
      planoContaGerencialDescricao: utilidade ? 'Despesas' : 'Compra de Combustível',
    })
  }
  return out
}
