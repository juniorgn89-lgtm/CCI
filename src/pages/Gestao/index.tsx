import { LayoutGrid, ClipboardList, Repeat } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import TopBarTabs, { type TopBarTab } from '@/components/layout/TopBarTabs'
import InfoHint from '@/components/ui/InfoHint'
import useIsMobile from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
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
  // No celular o título do módulo não tem barra para ir: as abas ficam na própria página.
  const isMobile = useIsMobile()

  const tabs: TopBarTab[] = [
    { id: 'painel', label: 'Painel', Icon: LayoutGrid },
    { id: 'tarefas', label: 'Tarefas', Icon: ClipboardList },
    ...(podeGerir ? [{ id: 'rotinas', label: 'Rotinas', Icon: Repeat } as TopBarTab] : []),
  ]
  const active: GestaoTab = tab === 'rotinas' && !podeGerir ? 'painel' : tab

  return (
    <div className="space-y-4 md:space-y-6">
      {isMobile && (
        <div className="grid gap-1 rounded-xl bg-gray-100 p-1 dark:bg-[#0f0f0f]" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id as GestaoTab)}
              className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold', active === t.id ? 'bg-white text-[#1e3a5f] shadow-sm dark:bg-gray-800 dark:text-blue-200' : 'text-gray-500 dark:text-gray-400')}>
              {t.Icon && <t.Icon className="h-4 w-4" />}{t.label}
            </button>
          ))}
        </div>
      )}
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
