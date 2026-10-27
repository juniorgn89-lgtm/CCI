// Testes do módulo e-extrato com os exemplos dos manuais v9.3.2 e v9.3.11 (as vírgulas e
// aspas que faltam no PDF foram corrigidas; os valores são os do manual).
// Rodar: node supabase/functions/_shared/eextrato.test.ts
import assert from 'node:assert/strict'
import { montarFiltroXml, validarFiltro, lerResposta, buscarTodasPaginas, cabecalhos, CAMINHO_RETORNO } from './eextrato.ts'

let n = 0
const caso = async (nome: string, fn: () => void | Promise<void>) => { await fn(); n++; console.log(`ok  ${nome}`) }

await caso('filtro: XML na ordem do manual, com rede/bandeira aninhadas', () => {
  const xml = montarFiltroXml({ dataVendaInicio: '2013-09-02', dataVendaFim: '2013-09-02', tipoVenda: 1, pagina: 1, statusConciliacao: 1, codigoLoja: '3', rede: 2, bandeira: 1 })
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Filtro>'))
  assert.ok(xml.indexOf('<dataVendaInicio>') < xml.indexOf('<pagina>'))
  assert.match(xml, /<rede>\s*<id>2<\/id>\s*<\/rede>/)
  assert.match(xml, /<bandeira>\s*<id>1<\/id>\s*<\/bandeira>/)
  assert.ok(!xml.includes('<nsu>'), 'campo vazio fica de fora')
})

await caso('filtro: escapa caracteres de XML', () => {
  assert.ok(montarFiltroXml({ dataPagamentoInicio: '2024-01-01', dataPagamentoFim: '2024-01-31', dadosCliente: 'A&B<1>' }).includes('A&amp;B&lt;1&gt;'))
})

await caso('filtro: exige pelo menos um período completo', () => {
  assert.ok(validarFiltro('venda', {}))
  assert.equal(validarFiltro('venda', { dataVendaInicio: '2024-01-01', dataVendaFim: '2024-01-31' }), null)
  assert.equal(validarFiltro('pagamento', { dataPagamentoInicio: '2024-01-01', dataPagamentoFim: '2024-01-31' }), null)
  assert.equal(validarFiltro('recebivel', { dataVendaInicio: '2024-01-01', dataVendaFim: '2024-01-31' }), null)
  assert.equal(validarFiltro('dataPrevistaCredito', { dataCreditoInicio: '2026-10-27', dataCreditoFim: '2026-12-26' }), null)
  assert.ok(validarFiltro('venda', { dataCreditoInicio: '2026-10-27' }), 'período pela metade')
  assert.ok(validarFiltro('venda', { dataVendaInicio: '01/01/2024', dataVendaFim: '2024-01-31' }))
})

await caso('cabeçalhos e caminhos', () => {
  assert.deepEqual(Object.keys(cabecalhos('a', 'b')), ['chaveAcesso', 'chaveSecreta', 'Content-Type', 'Accept'])
  assert.equal(CAMINHO_RETORNO.vendaDetalhada, '/retorno/v9/vendaDetalhada')
})

await caso('erro da API (JSON do manual)', () => {
  const r = lerResposta('venda', { paginaAtual: 1, erro: { status: 'ERRO', rejeitado: true, descricao: 'É obrigatório preencher pelo menos um período de data.' }, rejeitado: true })
  assert.deepEqual(r, { ok: false, erro: 'É obrigatório preencher pelo menos um período de data.' })
})

await caso('retorno de venda por parcela (5.2)', () => {
  const r = lerResposta('vendaDetalhada', {
    paginaAtual: 1, totalPaginas: 1, rejeitado: false,
    vendas: { vendasV9: [{
      dataVenda: '2013-09-02', nsu: '88888', autorizacao: '668683', plano: '3', rede: '2', bandeira: '1', produto: 'D', numeroLote: '5130902',
      areaCliente: 'b85b1014-8cec-44a7-868c924afc8a13:2244106', banco: '237', agencia: '999', conta: '15903', codigoLojaErp: '3',
      codigoEstabelecimento: '888852208', statusConciliacao: 1, dataCredito: '2013-09-03', valorVenda: 39.9, taxaAdministracao: 1.4,
      taxaAntecipacao: 0.0, numeroCartao: '999953******6418000', motivoConciliacao: '', parcela: 3, modoCaptura: 'TEF/PDV',
      horaVenda: '12:32:48', tid: '354645643', codigoProduto: '1', maquinaLoja: 'PV586811', valorLiquidoVenda: null,
      valorTaxaAdministracao: 4.0, valorParcela: 33.9, valorLiquidoParcela: 33.0, valorCancelado: 0.0, valorCanceladoPrevisto: 0.0, status: 'PAG',
      tipoConciliacao: { conciliadoManual: false },
    }] },
  })
  assert.ok(r.ok)
  if (!r.ok) return
  const v = r.itens[0]
  assert.equal(r.itens.length, 1)
  assert.equal(v.plano, 3); assert.equal(v.parcela, 3); assert.equal(v.rede, 2); assert.equal(v.bandeira, 1)
  assert.equal(v.produto, 'D'); assert.equal(v.codigoProduto, 1)
  assert.equal(v.dataCredito, '2013-09-03'); assert.equal(v.valorVenda, 39.9)
  assert.equal(v.valorParcela, 33.9); assert.equal(v.valorLiquidoParcela, 33); assert.equal(v.status, 'PAG')
  assert.equal(v.motivoConciliacao, null, 'texto vazio vira null')
  assert.equal(v.conciliadoManual, false)
  assert.equal(v.nsu, '88888', 'NSU fica texto (zeros à esquerda importam)')
})

await caso('retorno de pagamento (5.3)', () => {
  const r = lerResposta('pagamento', {
    paginaAtual: 1, totalPaginas: 1, rejeitado: false,
    pagamentos: { pagamentosV9: [{
      dataVenda: '2013-09-02', nsu: '99999', autorizacao: '132683', plano: '1', rede: '2', bandeira: '1', produto: 'D', numeroLote: '5130902',
      statusConciliacao: 1, dataCredito: null, parcela: 1, valorBruto: 39.9, valorAdministracao: 0.5586, valorAntecipacao: 0.0, status: 'PAG',
      horaVenda: '15:01:45', modoCaptura: 'POS', tid: '354645643', dataPagamento: '2013-09-03', codigoProduto: '1', valorLiquido: 35.9,
      taxaAntecipacao: 0.0, taxaAdministracao: 0.0, valorPago: 35.9,
    }] },
  })
  assert.ok(r.ok)
  if (!r.ok) return
  const p = r.itens[0]
  assert.equal(p.dataPagamento, '2013-09-03'); assert.equal(p.valorBruto, 39.9); assert.equal(p.valorAdministracao, 0.5586)
  assert.equal(p.valorLiquido, 35.9); assert.equal(p.valorPago, 35.9); assert.equal(p.status, 'PAG')
})

await caso('retorno de ajuste (5.4) com o "coditoProduto" do manual', () => {
  const r = lerResposta('ajuste', {
    paginaAtual: 1, totalPaginas: 1, rejeitado: false,
    ajustes: { ajustesV9: [{
      dataVenda: '2013-09-02', nsu: '0', autorizacao: '', plano: '1', rede: '6', bandeira: '2', produto: 'C', numeroLote: '42849353',
      statusConciliacao: 2, dataCreditoDebito: '2013-09-04', credito: 0.0, debito: 26.45, historico: '5', mesReferencia: '', tid: '354645643',
      tipoProduto: 'DÉBITO', coditoProduto: 1, parcela: 1,
    }] },
  })
  assert.ok(r.ok)
  if (!r.ok) return
  const a = r.itens[0]
  assert.equal(a.debito, 26.45); assert.equal(a.historico, 5); assert.equal(a.codigoProduto, 1)
  assert.equal(a.autorizacao, null); assert.equal(a.statusConciliacao, 2); assert.equal(a.tipoProduto, 'DÉBITO')
})

await caso('retorno de recebíveis (5.5) com a chave "recebiveis " do manual', () => {
  const r = lerResposta('recebivel', {
    paginaAtual: 1, totalPaginas: 1, rejeitado: false,
    'recebiveis ': { recebivelV9: [{
      rede: '6', bandeira: '2', produto: 'C', numeroLote: '42849353', banco: '237', agencia: '9920', conta: '9903', codigoLojaErp: '3',
      codigoEstabelecimento: '99900920', statusConciliacao: 2, dataCreditoDebito: '2013-09-04', credito: 0.0, debito: 26.45, historico: '5',
      tipoProduto: 'DÉBITO', coditoProduto: 1,
    }] },
  })
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.itens.length, 1)
  assert.equal(r.itens[0].dataCreditoDebito, '2013-09-04'); assert.equal(r.itens[0].codigoEstabelecimento, '99900920')
})

await caso('resposta sem registros', () => {
  const r = lerResposta('venda', { paginaAtual: 1, totalPaginas: 0, rejeitado: false, vendas: {} })
  assert.deepEqual(r, { ok: true, pagina: 1, totalPaginas: 0, itens: [] })
})

await caso('paginação: junta todas as páginas', async () => {
  const pag = (p: number) => ({ paginaAtual: p, totalPaginas: 3, rejeitado: false, pagamentos: { pagamentosV9: [{ nsu: `n${p}`, valorBruto: p }] } })
  const r = await buscarTodasPaginas('pagamento', async (p) => pag(p))
  assert.ok(r.ok)
  if (!r.ok) return
  assert.deepEqual(r.itens.map((x) => x.nsu), ['n1', 'n2', 'n3'])
  assert.equal(r.completo, true)
})

await caso('paginação: teto marca a leitura como incompleta (nunca soma como se fosse tudo)', async () => {
  const r = await buscarTodasPaginas('pagamento', async (p) => ({ paginaAtual: p, totalPaginas: 10, pagamentos: { pagamentosV9: [{ nsu: `n${p}` }] } }), 2)
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.itens.length, 2); assert.equal(r.completo, false)
})

await caso('paginação: erro no meio para e diz em que página', async () => {
  const r = await buscarTodasPaginas('venda', async (p) => (p === 2 ? { rejeitado: true, erro: { status: 'ERRO', descricao: 'falhou' } } : { totalPaginas: 3, vendas: { vendasV9: [{}] } }))
  assert.deepEqual(r, { ok: false, erro: 'falhou', pagina: 2 })
})

await caso('v9.3.11: vendas por parcela no layout V10, com descrição de rede/bandeira', () => {
  const r = lerResposta('vendaDetalhada', { paginaAtual: 1, totalPaginas: 1, rejeitado: false, vendas: { vendasV10: [{
    dataVenda: '2013-09-02', nsu: '12345', autorizacao: '12345', plano: '3', rede: '2', bandeira: '1', produto: 'D', statusConciliacao: 1,
    dataCredito: '2013-09-03', valorVenda: 39.9, parcela: 3, valorParcela: 33.9, valorLiquidoParcela: 33.0, status: 'PAG',
    descricaoRede: 'CIELO', descricaoBandeira: 'MASTERCARD', dataConciliacao: '2013-09-03',
  }] } })
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.itens[0].descricaoRede, 'CIELO'); assert.equal(r.itens[0].descricaoBandeira, 'MASTERCARD')
  assert.equal(r.itens[0].dataConciliacao, '2013-09-03'); assert.equal(r.itens[0].valorParcela, 33.9)
})

await caso('v9.3.11: status "null" como texto vira vazio', () => {
  const r = lerResposta('venda', { vendas: { vendasV10: [{ status: 'null', valorVenda: 1 }] } })
  assert.ok(r.ok && r.itens[0].status === null)
})

await caso('v9.3.11: ajuste com descrição do histórico e status do pagamento', () => {
  const r = lerResposta('ajuste', { ajustes: { ajustesV10: [{ historico: 4, descricaoHistorico: 'Ajuste Credito/Debito', statusPagamento: 'CONFIRMADO', debito: 26.45, dataCreditoDebito: '2013-09-04' }] } })
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.itens[0].descricaoHistorico, 'Ajuste Credito/Debito'); assert.equal(r.itens[0].statusPagamento, 'CONFIRMADO')
})

await caso('v9.3.11: recebíveis V10 (unidade de recebível com vencimento e chave UR)', () => {
  const r = lerResposta('recebivel', { recebiveis: { recebiveisV10: [{ rede: '6', dataCreditoDebito: '2013-09-04', debito: 26.45, historico: 9, dataVencimento: '2013-09-04', chaveUr: '' }] } })
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.itens[0].dataVencimento, '2013-09-04'); assert.equal(r.itens[0].chaveUr, null)
})

await caso('v9.3.11: data prevista de crédito (5.6)', () => {
  const r = lerResposta('dataPrevistaCredito', { paginaAtual: 1, totalPaginas: 1, rejeitado: false, dataCreditoPrevistos: { dataCreditoPrevistoV10: [{
    dataVenda: '2026-01-30', nsu: '00123456', autorizacao: '123456', plano: '10', rede: '6', bandeira: '2', produto: 'C',
    codigoLojaErp: '001', codigoEstabelecimento: '0012345678', statusConciliacao: 2, dataCredito: '2026-09-01', parcela: 7,
    valorBruto: 43.6, valorAdministracao: 0.7, valorAntecipacao: 0, status: 'PRE', valorLiquido: 42.9, taxaAdministracao: 1.61,
    descricaoRede: 'REDE', descricaoBandeira: 'MASTERCARD',
  }] } })
  assert.ok(r.ok)
  if (!r.ok) return
  const p = r.itens[0]
  assert.equal(p.dataCredito, '2026-09-01'); assert.equal(p.status, 'PRE'); assert.equal(p.valorLiquido, 42.9)
  assert.equal(p.nsu, '00123456', 'zeros à esquerda preservados'); assert.equal(p.codigoLojaErp, '001')
})

await caso('v9.3.11: filtro XML com período de crédito e de atualização', () => {
  const xml = montarFiltroXml({ dataCreditoInicio: '2026-10-27', dataCreditoFim: '2026-12-26', dataAtualizacaoInicio: '2026-10-26', dataAtualizacaoFim: '2026-10-27', historico: 6 })
  assert.ok(xml.includes('<dataCreditoInicio>2026-10-27</dataCreditoInicio>'))
  assert.ok(xml.includes('<dataAtualizacaoFim>2026-10-27</dataAtualizacaoFim>'))
  assert.ok(xml.includes('<historico>6</historico>'))
})

console.log(`\n${n} casos passaram.`)
