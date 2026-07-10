import useTabParam from '@/hooks/useTabParam'
import { useAuthStore } from '@/store/auth'
import { ScrollTabs } from '@/components/mobile/primitives'
import BombaMobile from '@/pages/Bombas/BombaMobile'
import ReabastecimentoMobile from '@/pages/Reabastecimento/ReabastecimentoMobile'

type OperacaoTab = 'bombas' | 'reabastecimento'
const isOperacaoTab = (v: string | null): v is OperacaoTab =>
  v === 'bombas' || v === 'reabastecimento'

/** Shell mobile do módulo Operação — alterna Bombas / Reabastecimento. */
const OperacaoMobile = () => {
  const canVerReab = useAuthStore((s) => s.canVerReabastecimento)
  const [tab, setTab] = useTabParam<OperacaoTab>('bombas', isOperacaoTab)
  const activeTab: OperacaoTab = tab === 'reabastecimento' && !canVerReab ? 'bombas' : tab

  return (
    <div className="space-y-3 pb-2">
      {canVerReab && (
        <ScrollTabs
          tabs={[
            { id: 'bombas', label: 'Bombas' },
            { id: 'reabastecimento', label: 'Reabastecimento' },
          ]}
          value={activeTab}
          onChange={(id) => setTab(id as OperacaoTab)}
        />
      )}
      {activeTab === 'reabastecimento' ? <ReabastecimentoMobile /> : <BombaMobile />}
    </div>
  )
}

export default OperacaoMobile
