import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchVendaItens, fetchVendaFormasPagamento } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { classifyFuelSlug } from '@/api/supabase/concorrencia'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useTabelasPrazo } from '@/pages/Dashboard/hooks/useTabelasPrazo'

/**
 * Isola o desconto do programa BARATAO (combustível), por produto e por posto.
 *
 * COMO: uma venda é "Baratão" quando sua forma de pagamento usa um prazo da
 * tabela BARATAO (`formaPagamentoCodigo` ∈ `prazoCodigos` da tabela). O item
 * Baratão guarda só o preço final (já com desconto) — não há campo de "preço
 * cheio" —, então o desconto é ESTIMADO contra o preço normal (média realizada
 * das vendas NÃO-Baratão do mesmo produto/posto):
 *   desconto = Σ máx(0, preço_normal − preço_Baratão) × litros
 *
 * Isso difere do relatório do WebPosto (que usa o "Preço Original 99" como
 * referência) — os LITROS batem; o VALOR é uma estimativa por referência.
 *
 * Escopo enxuto: só busca /VENDA nos postos que têm tabela Baratão (∩ filtro).
 */
export interface BarataoData {
  /** produtoCodigo → desconto estimado (R$). */
  porProduto: Map<number, number>
  /** empresaCodigo → desconto estimado (R$). */
  porPosto: Map<number, number>
  total: number
  litros: number
  isLoading: boolean
}

const useBaratao = (): BarataoData => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const permitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const { data: tabelasApi = [] } = useTabelasPrazo()
  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  // Prazos e postos da(s) tabela(s) BARATAO.
  const { prazoSet, postosBaratao } = useMemo(() => {
    const prz = new Set<number>()
    const pos = new Set<number>()
    for (const t of tabelasApi) {
      if (!/barat/i.test(t.descricao)) continue
      for (const p of t.prazoCodigos) prz.add(p)
      for (const it of t.itens) if (it.empresaCodigo != null) pos.add(it.empresaCodigo)
    }
    return { prazoSet: prz, postosBaratao: pos }
  }, [tabelasApi])

  // Escopo = postos Baratão ∩ filtro global (∩ permitidos).
  const scopePostos = useMemo(() => {
    const permit = new Set(permitidas.map((e) => e.codigo))
    return [...postosBaratao].filter(
      (p) => permit.has(p) && (empresaCodigos.length === 0 || empresaCodigos.includes(p)),
    )
  }, [postosBaratao, permitidas, empresaCodigos])

  // produtoCodigo → nome (pra classificar combustível).
  const nomeProduto = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of produtosData ?? []) if (!m.has(p.produtoCodigo)) m.set(p.produtoCodigo, p.nome)
    return m
  }, [produtosData])

  const prazoKey = [...prazoSet].sort((a, b) => a - b).join(',')
  const enabled = scopePostos.length > 0 && !!dataInicial && !!dataFinal && prazoSet.size > 0 && (produtosData?.length ?? 0) > 0

  const { data, isLoading } = useQuery({
    queryKey: ['baratao', scopePostos.join(','), dataInicial, dataFinal, prazoKey],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const isFuel = (cod: number) => !!classifyFuelSlug(nomeProduto.get(cod) ?? '')
      const porProduto: [number, number][] = []
      const porPosto: [number, number][] = []
      const accProd = new Map<number, number>()
      const accPosto = new Map<number, number>()
      let total = 0
      let litros = 0

      for (const emp of scopePostos) {
        const [fps, itens] = await Promise.all([
          fetchAllPages((p) => fetchVendaFormasPagamento({ empresaCodigo: emp, dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 2000, 40),
          fetchAllPages((p) => fetchVendaItens({ empresaCodigo: emp, dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 2000, 40),
        ])
        const barVendas = new Set<number>()
        for (const f of fps) if (prazoSet.has(f.formaPagamentoCodigo)) barVendas.add(f.vendaCodigo)
        if (barVendas.size === 0) continue

        // Preço normal (não-Baratão) por produto de combustível — média ponderada.
        const nq = new Map<number, number>()
        const nv = new Map<number, number>()
        for (const it of itens) {
          if (it.cancelada === 'S' || it.quantidade <= 0 || barVendas.has(it.vendaCodigo)) continue
          if (!isFuel(it.produtoCodigo)) continue
          nq.set(it.produtoCodigo, (nq.get(it.produtoCodigo) ?? 0) + it.quantidade)
          nv.set(it.produtoCodigo, (nv.get(it.produtoCodigo) ?? 0) + it.precoVenda * it.quantidade)
        }
        const normal = (cod: number) => { const q = nq.get(cod) ?? 0; return q > 0 ? (nv.get(cod) as number) / q : null }

        for (const it of itens) {
          if (it.cancelada === 'S' || it.quantidade <= 0 || !barVendas.has(it.vendaCodigo)) continue
          if (!isFuel(it.produtoCodigo)) continue
          const n = normal(it.produtoCodigo)
          if (n == null) continue
          const desc = Math.max(0, n - it.precoVenda) * it.quantidade
          if (desc <= 0) continue
          accProd.set(it.produtoCodigo, (accProd.get(it.produtoCodigo) ?? 0) + desc)
          accPosto.set(emp, (accPosto.get(emp) ?? 0) + desc)
          total += desc
          litros += it.quantidade
        }
      }
      for (const [k, v] of accProd) porProduto.push([k, v])
      for (const [k, v] of accPosto) porPosto.push([k, v])
      return { porProduto, porPosto, total, litros }
    },
  })

  return {
    porProduto: new Map(data?.porProduto ?? []),
    porPosto: new Map(data?.porPosto ?? []),
    total: data?.total ?? 0,
    litros: data?.litros ?? 0,
    isLoading: enabled && isLoading,
  }
}

export default useBaratao
