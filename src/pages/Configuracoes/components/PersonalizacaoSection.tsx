import { useMemo, useState } from 'react'
import {
  Eye, EyeOff, ChevronUp, ChevronDown, ChevronRight, RotateCcw, Sparkles, LayoutGrid,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { APP_STRUCTURE, NAV_GROUPS, tabKey, type AppModule } from '@/lib/appStructure'
import { getPlano } from '@/lib/planos'
import { usePersonalizationStore } from '@/store/personalization'

/** Módulo acessível pelo usuário (permissão é o teto; a personalização só
 * esconde/reordena dentro do que a permissão libera). */
const useAccessibleModules = (): AppModule[] => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const modulosPermitidos = useAuthStore((s) => s.modulosPermitidos)
  return useMemo(() => {
    if (isMaster || !modulosPermitidos || modulosPermitidos.length === 0) return APP_STRUCTURE
    return APP_STRUCTURE.filter((m) => !m.permId || modulosPermitidos.includes(m.permId))
  }, [isMaster, modulosPermitidos])
}

const RowButton = ({
  onClick, disabled, label, children,
}: { onClick: () => void; disabled?: boolean; label: string; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-300"
  >
    {children}
  </button>
)

const PersonalizacaoSection = () => {
  const rede = useTenantStore((s) => s.rede)
  const modules = useAccessibleModules()

  const hidden = usePersonalizationStore((s) => s.hidden)
  const moduleOrder = usePersonalizationStore((s) => s.moduleOrder)
  const tabOrder = usePersonalizationStore((s) => s.tabOrder)
  const planoApplied = usePersonalizationStore((s) => s.planoApplied)
  const toggleModule = usePersonalizationStore((s) => s.toggleModule)
  const toggleTab = usePersonalizationStore((s) => s.toggleTab)
  const moveModule = usePersonalizationStore((s) => s.moveModule)
  const moveTab = usePersonalizationStore((s) => s.moveTab)
  const applyPlano = usePersonalizationStore((s) => s.applyPlano)
  const reset = usePersonalizationStore((s) => s.reset)

  const [expanded, setExpanded] = useState<string | null>(null)

  // Agrupa os módulos acessíveis por seção do menu, cada grupo ordenado pela
  // personalização (a reordenação acontece dentro do grupo).
  const grupos = useMemo(() => {
    const idx = new Map(moduleOrder.map((p, i) => [p, i]))
    return NAV_GROUPS.map((g) => ({
      ...g,
      modules: modules
        .filter((m) => m.group === g.id)
        .sort((a, b) => (idx.get(a.path) ?? 999) - (idx.get(b.path) ?? 999)),
    })).filter((g) => g.modules.length > 0)
  }, [modules, moduleOrder])

  const planoAtual = getPlano(rede?.plano)

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Personalização do menu
        </h2>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar padrão
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Escolha quais módulos e abas aparecem no menu e em que ordem. É só visual —
        não muda o que a sua rede tem contratado, e você pode reexibir a qualquer momento.
      </p>

      {/* Aplicar plano — preset reversível */}
      {planoAtual && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/60 p-3 dark:border-teal-500/30 dark:bg-teal-900/15">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">
              Deixar o menu igual ao plano {planoAtual.nome}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Mostra os módulos e abas do plano {planoAtual.nome} e recolhe o resto. Você ajusta depois se quiser.
            </p>
          </div>
          <button
            type="button"
            onClick={() => applyPlano(planoAtual.id)}
            className={cn(
              'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              planoApplied === planoAtual.id
                ? 'cursor-default bg-teal-600/20 text-teal-700 dark:text-teal-300'
                : 'bg-[#1e3a5f] text-white hover:bg-[#162a44]',
            )}
          >
            {planoApplied === planoAtual.id ? 'Aplicado' : `Aplicar plano ${planoAtual.nome}`}
          </button>
        </div>
      )}

      {/* Lista de módulos, agrupada pelas seções do menu */}
      {grupos.map((g) => (
        <div key={g.id} className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
            {g.label}
          </p>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
            {g.modules.map((m, index) => {
              const isHidden = hidden.includes(m.path)
              const hasTabs = m.tabs.length > 0
              const isOpen = expanded === m.path
              // Abas ordenadas pela personalização.
              const tabIdx = new Map((tabOrder[m.path] ?? m.tabs.map((t) => t.id)).map((id, i) => [id, i]))
              const orderedTabs = [...m.tabs].sort((a, b) => (tabIdx.get(a.id) ?? 999) - (tabIdx.get(b.id) ?? 999))
              return (
                <div key={m.path}>
                  <div className="flex items-center gap-2 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => hasTabs && setExpanded((p) => (p === m.path ? null : m.path))}
                  disabled={!hasTabs}
                  aria-label={hasTabs ? 'Ver abas' : undefined}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded text-gray-400',
                    hasTabs ? 'hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800' : 'opacity-0',
                  )}
                >
                  <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
                </button>
                <LayoutGrid className={cn('h-4 w-4 shrink-0', isHidden ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400')} />
                <span
                  className={cn(
                    'flex-1 text-sm font-medium',
                    isHidden ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-900 dark:text-gray-100',
                  )}
                >
                  {m.label}
                </span>
                {hasTabs && !isOpen && (
                  <span className="text-[11px] text-gray-400 dark:text-gray-500">
                    {m.tabs.length} {m.tabs.length === 1 ? 'aba' : 'abas'}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <RowButton onClick={() => toggleModule(m.path)} label={isHidden ? 'Mostrar módulo' : 'Ocultar módulo'}>
                    {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </RowButton>
                  <RowButton onClick={() => moveModule(m.path, 'up')} disabled={index === 0} label="Mover para cima">
                    <ChevronUp className="h-4 w-4" />
                  </RowButton>
                  <RowButton onClick={() => moveModule(m.path, 'down')} disabled={index === g.modules.length - 1} label="Mover para baixo">
                    <ChevronDown className="h-4 w-4" />
                  </RowButton>
                </div>
              </div>

              {/* Abas do módulo */}
              {hasTabs && isOpen && (
                <div className="space-y-1 border-t border-gray-100 bg-gray-50/60 px-4 py-2 dark:border-gray-800 dark:bg-gray-800/30">
                  {orderedTabs.map((t, ti) => {
                    const tHidden = hidden.includes(tabKey(m.path, t.id))
                    return (
                      <div key={t.id} className="flex items-center gap-2 pl-8">
                        <span
                          className={cn(
                            'flex-1 text-[13px]',
                            tHidden ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-700 dark:text-gray-300',
                          )}
                        >
                          {t.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <RowButton onClick={() => toggleTab(m.path, t.id)} label={tHidden ? 'Mostrar aba' : 'Ocultar aba'}>
                            {tHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </RowButton>
                          <RowButton onClick={() => moveTab(m.path, t.id, 'up')} disabled={ti === 0} label="Mover para cima">
                            <ChevronUp className="h-3.5 w-3.5" />
                          </RowButton>
                          <RowButton onClick={() => moveTab(m.path, t.id, 'down')} disabled={ti === orderedTabs.length - 1} label="Mover para baixo">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </RowButton>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
                  )
                })}
          </div>
        </div>
      ))}
    </section>
  )
}

export default PersonalizacaoSection
