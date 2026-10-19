import TanquesRedeCard from '@/pages/Dashboard/components/TanquesRedeCard'

/**
 * Visão Geral da Operação — o quadro de Tanques da rede (o mesmo da Central;
 * clique no posto abre o detalhe ao vivo com o pedido sugerido). As aferições
 * ganharam aba própria (Operação › Aferições). Menos é mais: litros e
 * faturamento ficam na Central.
 */
const VisaoGeralOperacao = () => (
  <div className="space-y-4">
    <TanquesRedeCard />
  </div>
)

export default VisaoGeralOperacao
