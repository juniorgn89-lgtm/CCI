import { useTenantStore } from '@/store/tenant'
import { usePedidos } from '@/pages/Compras/hooks/usePedidos'
import NovoPedidoModal from '@/pages/Compras/NovoPedidoModal'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import { STATUS_ESTOQUE, fmtUnidades } from '@/pages/Estoques/components/estoqueComum'

const custoUn = (r: ProductAnalyticsRow) => (r.precoCustoCadastro > 0 ? r.precoCustoCadastro : r.custoMedio)

/**
 * Abre o formulário de pedido do módulo Compras já com os produtos escolhidos no
 * Estoque (quantidade = o que falta para a meta de dias; mínimo 1). O pedido vai
 * para Compras › Pedidos, aguardando liberação, e a pessoa continua no Estoque.
 */
const GerarPedidoEstoque = ({ empresaCodigo, produtos, coberturaDias, onClose, onSalvo }: {
  empresaCodigo: number
  produtos: ProductAnalyticsRow[]
  coberturaDias: number
  onClose: () => void
  onSalvo: () => void
}) => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const compras = usePedidos(redeId)
  const inicial = {
    empresa: empresaCodigo,
    itens: produtos.map((r) => ({
      produto_codigo: r.produtoCodigo,
      produto_nome: r.produtoNome,
      unidade: null,
      qtd_solicitada: Math.max(1, Math.ceil(r.necessidadeUnidades)),
      custo_unit: Number(custoUn(r).toFixed(2)),
      justificativa: `do Estoques: ${STATUS_ESTOQUE[r.necessidadeStatus].label.toLowerCase()}, saldo ${fmtUnidades(r.saldoAtual)}, dura ${Math.round(r.diasCobertura)} dias (meta ${coberturaDias})`,
    })),
  }
  return (
    <NovoPedidoModal open onClose={onClose} pedido={null} inicial={inicial} tetos={compras.tetos} pedidos={compras.pedidos}
      onSalvo={() => { compras.invalidar(); onSalvo() }} />
  )
}

export default GerarPedidoEstoque
