/**
 * DEBUG TEMPORÁRIO — estado real de uma venda no /VENDA.
 *
 * Uso (console, logado, com a rede conectada e período selecionado):
 *   await debugVenda(290082843)            // posto padrão ITAPOA
 *   await debugVenda(290082843, 'DIVINO')
 *
 * Mostra o cabeçalho da venda (cancelada, data, modelo, total) e se ela aparece
 * em situacao='T' (todas), 'A' (autorizada) e 'C' (cancelada). Define de uma vez
 * se a venda está cancelada ou não — base do diagnóstico app×BI.
 *
 * REMOVER depois (este arquivo + o bloco em main.tsx).
 */
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchVendas } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { useFilterStore } from '@/store/filters'

export const debugVenda = async (vendaCodigo: number, postoNome = 'ITAPOA') => {
  const { dataInicial, dataFinal } = useFilterStore.getState()
  console.log(`%c[debugVenda] venda=${vendaCodigo} · período ${dataInicial}→${dataFinal} · posto ~"${postoNome}"`, 'color:#2563eb;font-weight:bold')

  const empresas = (await fetchEmpresas()).resultados ?? []
  const emp = empresas.find((e) => `${e.fantasia ?? ''} ${e.razao ?? ''}`.toUpperCase().includes(postoNome.toUpperCase()))
  const empresaCodigo = emp?.codigo
  console.log(`[debugVenda] empresaCodigo=${empresaCodigo ?? '(não achou — buscando sem empresa)'}`)

  const grab = async (situacao: 'T' | 'A' | 'C') => {
    const all = await fetchAllPages(
      (p) => fetchVendas({ empresaCodigo, dataInicial, dataFinal, situacao, vendaCodigo: [vendaCodigo], ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 10,
    )
    return all.filter((v) => v.vendaCodigo === vendaCodigo)
  }

  const [todas, autoriz, cancel] = await Promise.all([grab('T'), grab('A'), grab('C')])

  console.log('[debugVenda] situacao=T (todas):')
  console.table(todas.map((v) => ({
    vendaCodigo: v.vendaCodigo,
    cancelada: v.cancelada,
    dataHora: v.dataHora,
    modelo: v.modeloDocumento,
    total: v.totalVenda,
    empresaCodigo: v.empresaCodigo,
  })))
  console.log(`%c[debugVenda] aparece em situacao='A' (autorizada)? ${autoriz.length > 0}`, autoriz.length > 0 ? 'color:#059669' : 'color:#dc2626;font-weight:bold')
  console.log(`%c[debugVenda] aparece em situacao='C' (cancelada)?  ${cancel.length > 0}`, cancel.length > 0 ? 'color:#dc2626;font-weight:bold' : 'color:#059669')

  // Sem filtro de empresa (caso o filtro de empresa esteja escondendo).
  if (todas.length === 0) {
    const semEmp = (await fetchVendas({ dataInicial, dataFinal, situacao: 'T', vendaCodigo: [vendaCodigo] })).resultados ?? []
    console.log('[debugVenda] tentativa SEM empresaCodigo:', semEmp.map((v) => ({ vendaCodigo: v.vendaCodigo, cancelada: v.cancelada, dataHora: v.dataHora, empresaCodigo: v.empresaCodigo })))
  }
  console.log('%c[debugVenda] fim — me mande as tabelas.', 'color:#2563eb')
  return { todas, autoriz, cancel }
}

export default debugVenda
