import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchBombas, fetchBicos } from '@/api/endpoints/combustiveis'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { fetchApuracaoAfericoes } from '@/api/supabase/apuracao'
import type { AfericaoRow } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'

/**
 * Aferições (afericao=true) lidas do CACHE (apuracao_afericoes), não do
 * /ABASTECIMENTO live. Como a tabela é pequena, dá pra ler a rede inteira de
 * uma vez — habilita tanto o resumo rede-wide quanto o drill por posto (filtrado
 * no cliente). Os nomes (posto/bomba/frentista/combustível) são resolvidos aqui
 * pelos catálogos, com as MESMAS query keys do useAbastecimentosAnalytics
 * (react-query deduplica — sem fetch extra).
 *
 * @param empresaCodigos postos do escopo (vazio/omitido = toda a rede permitida).
 */
const useAfericoesCache = (empresaCodigos?: number[]) => {
  const { dataInicial, dataFinal } = useFilterStore()
  const scoped = empresaCodigos ?? []

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['apuracao-afericoes', scoped.join(','), dataInicial, dataFinal],
    queryFn: () => fetchApuracaoAfericoes({ empresaCodigos: scoped, dataInicial, dataFinal }),
    enabled: !!dataInicial && !!dataFinal,
    staleTime: 5 * 60 * 1000,
  })

  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })
  const { data: funcionariosData } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: () => fetchAllPages((p) => fetchFuncionarios({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    staleTime: 30 * 60 * 1000,
  })
  const { data: bombasData } = useQuery({ queryKey: ['bombas'], queryFn: () => fetchBombas(), staleTime: 30 * 60 * 1000 })
  const { data: bicosData } = useQuery({
    queryKey: ['bicos'],
    queryFn: () => fetchAllPages((p) => fetchBicos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    staleTime: 30 * 60 * 1000,
  })
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 10 * 60 * 1000 })

  const afericoes = useMemo<AfericaoRow[]>(() => {
    const productMap = new Map<number, string>()
    for (const p of produtosData ?? []) {
      productMap.set(p.produtoCodigo, p.nome)
      if (p.produtoLmcCodigo) productMap.set(p.produtoLmcCodigo, p.nome)
      productMap.set(p.codigo, p.nome)
    }
    const bicoProdutoMap = new Map<number, number>()
    const bicoDescMap = new Map<number, string>()
    for (const bico of bicosData ?? []) {
      bicoProdutoMap.set(bico.bicoCodigo, bico.produtoCodigo)
      const bomba = bombasData?.resultados?.find((b) => b.bombaCodigo === bico.bombaCodigo)
      bicoDescMap.set(bico.bicoCodigo, bomba ? `${bomba.descricao || bomba.bombaReferencia} - Bico ${bico.bicoNumero}` : `Bico ${bico.bicoNumero}`)
    }
    const getProductName = (codigoProduto: number, codigoBico: number): string => {
      const direct = productMap.get(codigoProduto)
      if (direct) return direct
      const prodCode = bicoProdutoMap.get(codigoBico)
      if (prodCode) {
        const name = productMap.get(prodCode)
        if (name) return name
      }
      return codigoProduto ? `Combustível ${codigoProduto}` : '—'
    }
    const funcionarioMap = new Map<number, string>()
    for (const f of funcionariosData ?? []) funcionarioMap.set(f.funcionarioCodigo, f.nome)
    const empresaMap = new Map<number, string>()
    for (const e of empresasData?.resultados ?? []) empresaMap.set(e.codigo, e.fantasia)

    return rows
      .map((r) => {
        const bico = r.codigo_bico ?? 0
        const frentista = r.codigo_frentista ?? 0
        return {
          codigo: r.abastecimento_codigo,
          dataHora: r.data_hora_abastecimento ?? '',
          dataFiscal: (r.data_fiscal || r.data_hora_abastecimento || '').slice(0, 10),
          empresaCodigo: r.empresa_codigo,
          empresaNome: empresaMap.get(r.empresa_codigo) ?? `Empresa ${r.empresa_codigo}`,
          bicoCodigo: bico,
          bombaDescricao: bicoDescMap.get(bico) ?? `Bico ${bico}`,
          frentistaCodigo: frentista,
          frentistaNome: funcionarioMap.get(frentista) ?? (frentista ? `Frentista ${frentista}` : '—'),
          combustivelNome: getProductName(r.codigo_produto ?? 0, bico),
          litros: r.quantidade,
          valorUnitario: r.valor_unitario,
          valorEstimado: r.quantidade * r.valor_unitario,
        }
      })
      .sort((x, y) => (y.dataHora || '').localeCompare(x.dataHora || ''))
  }, [rows, produtosData, funcionariosData, bombasData, bicosData, empresasData])

  return { afericoes, isLoading }
}

export default useAfericoesCache
