import { LayoutGrid, ClipboardList, Repeat } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import TopBarTabs, { type TopBarTab } from '@/components/layout/TopBarTabs'
import InfoHint from '@/components/ui/InfoHint'
import { useGestaoBase } from './comum'
import Painel from './Painel'
import Tarefas from './Tarefas'
import Rotinas from './Rotinas'

/**
 * Módulo Tarefas (menu "Tarefas", grupo Gestão) — padrão do Visor: um item na
 * barra lateral e as abas no topo: Painel · Tarefas · Rotinas (`?tab=`).
 * Rotinas é de gestor/diretor; os demais veem só Painel e Tarefas.
 */
type GestaoTab = 'painel' | 'tarefas' | 'rotinas'
const isGestaoTab = (v: string | null): v is GestaoTab => v === 'painel' || v === 'tarefas' || v === 'rotinas'

const Gestao = () => {
  const [tab, setTab] = useTabParam<GestaoTab>('painel', isGestaoTab)
  const { podeGerir } = useGestaoBase()

  const tabs: TopBarTab[] = [
    { id: 'painel', label: 'Painel', Icon: LayoutGrid },
    { id: 'tarefas', label: 'Tarefas', Icon: ClipboardList },
    ...(podeGerir ? [{ id: 'rotinas', label: 'Rotinas', Icon: Repeat } as TopBarTab] : []),
  ]
  const active: GestaoTab = tab === 'rotinas' && !podeGerir ? 'painel' : tab

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-1.5">
          <TopBarTabs active={active} onChange={(id) => setTab(id as GestaoTab)} tabs={tabs} />
          <InfoHint side="bottom" text="Painel: execução das rotinas e tarefas no período. Tarefas: a lista do dia a dia, com checklist e conclusão. Rotinas: os modelos que geram as tarefas sozinhos, todos os dias." />
        </div>
      </PageHeaderTitle>
      {active === 'painel' && <Painel />}
      {active === 'tarefas' && <Tarefas />}
      {active === 'rotinas' && <Rotinas />}
    </div>
  )
}

export default Gestao
