import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { classifySetor } from '@/lib/setorClassification'
import useVendaCodigosAutorizados from '@/hooks/useVendaCodigosAutorizados'

/**
 * Grupos de produto AUTOMOTIVO (loja/pista) vendidos POR funcionário, no período do
 * filtro. Vem AO VIVO do /VENDA_ITEM porque o cache `apuracao_vendas_funcionario`
 * guarda só o total do setor por funcionário — sem quebra por grupo de produto.
 *
 * Conta só itens de vendas AUTORIZADAS: o /VENDA_ITEM não traz o flag `cancelada`,
 * então cruzamos `vendaCodigo` com o set de `/VENDA` situacao='A' (mesmo filtro da
 * apuração — ver project_venda_item_sem_cancelada). Assim o total do painel bate
 * com o card "Automotivos". Escopo = setor 'automotivos' (tipoGrupo 'Pista');
 * combustível e conveniência ficam de fora de propósito (reconciliação com o KPI).
 *
 * Buscado sob demanda (só na aba Funcionários), com seu próprio estado de loading
 * pra não travar o resto do detalhe.
 */
export interface GrupoVenda {
  grupo: string
  faturamento: number
  itens: number
}

const useGruposFuncionario = (
  postoCodigo?: number | null,
): { byFunc: Map<number, GrupoVenda[]>; isLoading: boolean } => {
  const { dataInicial, dataFinal } = useFilterStore()
  const empresaCodigos = postoCodigo != null ? [postoCodigo] : []
  const hasEmpresa = empresaCodigos.length > 0

  // Itens de venda do posto no período (todos; filtramos por setor/autorizado no
  // memo). Cap alto (150 págs = 150k itens) fica bem acima de 1 mês de posto único.
  const { data: itens = [], isLoading: lItens } = useQuery({
    queryKey: ['produtividade-venda-itens', postoCodigo ?? 'none', dataInicial, dataFinal],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchVendaItens({
          empresaCodigo: postoCodigo ?? undefined,
          dataInicial, dataFinal,
          usaProdutoLmc: false,
          ultimoCodigo: p.ultimoCodigo, limite: p.limite,
        }),
        1000, 150,
      ),
    enabled: hasEmpresa && !!dataInicial && !!dataFinal,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  // Vendas autorizadas do período (exclui canceladas / itens órfãos).
  const { autorizados, isLoading: lAut } = useVendaCodigosAutorizados(
    empresaCodigos, dataInicial ?? '', dataFinal ?? '', hasEmpresa,
  )

  // Catálogo (rede-wide, compartilhado por query key com os outros hooks).
  const { data: produtosData, isLoading: lProd } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    enabled: hasEmpresa,
    staleTime: 30 * 60 * 1000,
  })
  const { data: gruposData, isLoading: lGrp } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages((p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    enabled: hasEmpresa,
    staleTime: 30 * 60 * 1000,
  })

  const byFunc = useMemo(() => {
    const out = new Map<number, GrupoVenda[]>()
    if (!produtosData || !gruposData) return out

    // produtoCodigo → { setor, grupo (nome) }.
    const grupoTipo = new Map(gruposData.map((g) => [g.grupoCodigo, g.tipoGrupo]))
    const grupoNome = new Map(gruposData.map((g) => [g.grupoCodigo, g.nome]))
    const info = new Map<number, { setor: string; grupo: string }>()
    for (const p of produtosData) {
      info.set(p.produtoCodigo, {
        setor: classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)),
        grupo: grupoNome.get(p.grupoCodigo) ?? 'Sem grupo',
      })
    }

    // funcionário → (grupo → agregado), só automotivos de vendas autorizadas.
    const acc = new Map<number, Map<string, GrupoVenda>>()
    for (const it of itens) {
      if (!autorizados.has(it.vendaCodigo)) continue
      if (!it.funcionarioCodigo) continue
      const pi = info.get(it.produtoCodigo)
      if (!pi || pi.setor !== 'automotivos') continue
      let m = acc.get(it.funcionarioCodigo)
      if (!m) { m = new Map(); acc.set(it.funcionarioCodigo, m) }
      const g = m.get(pi.grupo) ?? { grupo: pi.grupo, faturamento: 0, itens: 0 }
      g.faturamento += it.totalVenda ?? 0
      g.itens += it.quantidade ?? 0
      m.set(pi.grupo, g)
    }
    for (const [cod, m] of acc) {
      out.set(cod, [...m.values()].sort((a, b) => b.faturamento - a.faturamento))
    }
    return out
  }, [itens, autorizados, produtosData, gruposData])

  return { byFunc, isLoading: hasEmpresa && (lItens || lAut || lProd || lGrp) }
}

export default useGruposFuncionario
