import { LayoutGrid, ClipboardList, Repeat, CalendarDays } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import { type TopBarTab } from '@/components/layout/TopBarTabs'
import ModuloAbas from '@/components/layout/ModuloAbas'
import InfoHint from '@/components/ui/InfoHint'
import useIsMobile from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
import { useGestaoBase } from './comum'
import Painel from './Painel'
import Tarefas from './Tarefas'
import Rotinas from './Rotinas'
import AgendaEquipe from './AgendaEquipe'
import Celebracao from './Celebracao'

/**
 * Módulo Tarefas (menu "Tarefas", grupo Gestão) — padrão do Visor: um item na
 * barra lateral e as abas no topo: Painel · Tarefas · Agenda · Rotinas (`?tab=`).
 * Rotinas é de gestor/diretor; os demais veem só Painel e Tarefas.
 */
type GestaoTab = 'painel' | 'tarefas' | 'agenda' | 'rotinas'
const isGestaoTab = (v: string | null): v is GestaoTab => v === 'painel' || v === 'tarefas' || v === 'agenda' || v === 'rotinas'

const Gestao = () => {
  const [tab, setTab] = useTabParam<GestaoTab>('painel', isGestaoTab)
  const { podeGerir } = useGestaoBase()
  // No celular o título do módulo não tem barra para ir: as abas ficam na própria página.
  const isMobile = useIsMobile()

  const tabs: TopBarTab[] = [
    { id: 'painel', label: 'Painel', Icon: LayoutGrid },
    { id: 'tarefas', label: 'Tarefas', Icon: ClipboardList },
    { id: 'agenda', label: 'Agenda', Icon: CalendarDays },
    ...(podeGerir ? [{ id: 'rotinas', label: 'Rotinas', Icon: Repeat } as TopBarTab] : []),
  ]
  const active: GestaoTab = tab === 'rotinas' && !podeGerir ? 'painel' : tab

  return (
    // Agenda ocupa a altura da tela e rola por dentro (a página não rola).
    <div className={active === 'agenda' ? 'flex h-full min-h-0 flex-col gap-4' : 'space-y-4 md:space-y-6'}>
      {isMobile && (
        <div className="grid gap-1 rounded-xl bg-gray-100 p-1 dark:bg-[#0f0f0f]" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id as GestaoTab)}
              className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold', active === t.id ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700 dark:text-white' : 'text-gray-500 dark:text-gray-400')}>
              {t.Icon && <t.Icon className="h-4 w-4" />}{t.label}
            </button>
          ))}
        </div>
      )}
      <PageHeaderTitle>
        <div className="flex items-center gap-1.5">
          <ModuloAbas active={active} onChange={(id) => setTab(id as GestaoTab)} tabs={tabs} />
          <InfoHint side="bottom" text="Painel: execução das rotinas e tarefas no período. Tarefas: a lista do dia a dia, com checklist e conclusão. Agenda: as tarefas de cada pessoa por dia e hora; arraste para mudar o horário. Rotinas: os modelos que geram as tarefas sozinhos, todos os dias." />
        </div>
      </PageHeaderTitle>
      {active === 'painel' && <Painel />}
      {active === 'tarefas' && <Tarefas />}
      {active === 'agenda' && <div className="min-h-0 flex-1"><AgendaEquipe /></div>}
      {active === 'rotinas' && <Rotinas />}
      <Celebracao />
    </div>
  )
}

export default Gestao
