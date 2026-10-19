import { ShoppingCart, Lock, ArrowLeftRight } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import TopBarTabs, { type TopBarTab } from '@/components/layout/TopBarTabs'
import InfoHint from '@/components/ui/InfoHint'
import { useComprasBase, containerCls } from './comum'
import Pedidos from './Pedidos'
import Transferencias from './Transferencias'

/**
 * Módulo Compras (grupo Gestão): pedidos de compra com liberação. Dados
 * próprios do Visor; o ERP continua só leitura. Abas no topo (`?tab=`), hoje
 * Pedidos de compra e Transferências entre postos.
 */
type ComprasTab = 'pedidos' | 'transferencias'
const isTab = (v: string | null): v is ComprasTab => v === 'pedidos' || v === 'transferencias'

const Compras = () => {
  const [tab, setTab] = useTabParam<ComprasTab>('pedidos', isTab)
  const { moduloLigado, rede } = useComprasBase()
  const tabs: TopBarTab[] = [
    { id: 'pedidos', label: 'Pedidos de compra', Icon: ShoppingCart },
    { id: 'transferencias', label: 'Transferências', Icon: ArrowLeftRight },
  ]

  if (rede && !moduloLigado) {
    return (
      <div className={`${containerCls} flex items-start gap-3 p-6`}>
        <Lock className="mt-0.5 h-5 w-5 text-gray-400" />
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">O módulo Compras não está ligado para esta rede.</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Quem liga é o administrador, em Admin › Redes (coluna Compras).</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-1.5">
          <TopBarTabs active={tab} onChange={(id) => setTab(id as ComprasTab)} tabs={tabs} />
          <InfoHint side="bottom" text="Pedidos de compra com liberação: quem pede monta o pedido a partir das sugestões de reposição do estoque; quem libera aprova inteiro, parcial ou recusa. Transferências: um posto manda, o outro confere. Nada é enviado ao ERP: nota e movimentação de estoque entram no WebPosto pelo fluxo normal." />
        </div>
      </PageHeaderTitle>
      {tab === 'pedidos' && <Pedidos />}
      {tab === 'transferencias' && <Transferencias />}
    </div>
  )
}

export default Compras
