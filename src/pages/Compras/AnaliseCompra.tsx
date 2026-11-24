import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ComprarEstoque from '@/pages/Estoques/components/abas/ComprarEstoque'
import useEstoqueAnalytics from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import { JanelaCalculoBar, EstoqueTableSkeleton } from '@/pages/Estoques/components/JanelaCalculo'

/**
 * Compras › Análise de estoque para comprar (antes Estoques › Comprar).
 * Compara o saldo atual de UM posto com a média de venda da janela (30/60/90
 * dias) e sugere quanto comprar para a cobertura escolhida; dá pra marcar os
 * produtos e montar o pedido de compra direto daqui. Estoque é físico por
 * posto: sem um posto escolhido no topo, pede para escolher.
 */
const AnaliseCompra = () => {
  const [coberturaDias, setCoberturaDias] = useState(30)
  const [janelaDias, setJanelaDias] = useState<30 | 60 | 90>(30)

  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const selectedCodigo = empresaCodigos.length === 1 && empresasPermitidas.some((e) => e.codigo === empresaCodigos[0])
    ? empresaCodigos[0]
    : empresasPermitidas.length === 1 ? empresasPermitidas[0].codigo : null

  const { productAnalytics, categorias, isLoading: carregandoEstoque } = useEstoqueAnalytics(coberturaDias, janelaDias, selectedCodigo)

  if (selectedCodigo == null) return <SelectCompanyState />
  // Esqueleto enquanto qualquer parte carrega: o saldo chega antes das vendas,
  // e mostrar a lista sem as vendas dava "Sem movimento: todos" (falso).
  if (carregandoEstoque) return <EstoqueTableSkeleton />

  return (
    <div className="space-y-6">
      <JanelaCalculoBar value={janelaDias} onChange={setJanelaDias} />
      <ComprarEstoque
        data={productAnalytics}
        categorias={categorias}
        coberturaDias={coberturaDias}
        janelaDias={janelaDias}
        onCoberturaChange={setCoberturaDias}
        empresaCodigo={selectedCodigo}
      />
    </div>
  )
}

export default AnaliseCompra
