import { useMemo, useState } from 'react'
import { Fuel, Car, ShoppingBag, Building2, Clock } from 'lucide-react'
import { formatLiters } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import useReabastecimento, { type ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'
import ReposicaoTabela from '@/pages/Dashboard/components/ReposicaoTabela'
import { aggregarPorProduto, calcularMaxes } from '@/pages/Dashboard/components/reposicao'
import SubTabSwitcher, { type SubTab } from '@/pages/Dashboard/components/reabastecimento/SubTabSwitcher'
import StatusFilter from '@/pages/Dashboard/components/reabastecimento/StatusFilter'
import KpiHero from '@/pages/Dashboard/components/reabastecimento/KpiHero'
import KpiStatusCard from '@/pages/Dashboard/components/reabastecimento/KpiStatusCard'
import ReposicaoItemCard from '@/pages/Dashboard/components/reabastecimento/ReposicaoItemCard'
import { combustivelView } from '@/pages/Dashboard/components/reabastecimento/combustivelView'
import type { ReposicaoSetor } from '@/pages/Dashboard/components/reabastecimento/types'

// 'negativo' é ortogonal aos níveis — filtra por estoqueAtual < 0.
type FilterStatus = 'todos' | 'critico' | 'alerta' | 'negativo'

/**
 * Aba "Reabastecimento" da Central da Rede — 3 sub-abas (Fase 1: Combustível;
 * Automotivo/Conveniência em breve). Combustível usa `useReabastecimento` →
 * `combustivelView` (view-model compartilhado) → blocos burros. A tabela de
 * reposição por posto é a mesma de antes (idêntica). Visibilidade controlada
 * pelo Dashboard (permissão canVerReabastecimento).
 */
const ReabastecimentoCard = () => {
  const [sub, setSub] = useState<ReposicaoSetor>('combustivel')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos')
  const { baixos, criticos, isLoading } = useReabastecimento({ includeDetalhes: true })

  const view = useMemo(() => combustivelView(baixos, criticos), [baixos, criticos])
  const filteredItems = view.items.filter((i) => filterStatus === 'todos' || i.status === filterStatus)

  // Resumo de reposição por posto (consolidado por combustível) — idêntico ao atual.
  const resumoPostos = useMemo(() => {
    const matches = (t: ReabastTanque): boolean => {
      if (filterStatus === 'todos') return true
      if (filterStatus === 'negativo') return t.estoqueAtual < 0
      return t.estoqueAtual >= 0 && t.nivel === filterStatus
    }
    const postoMap = new Map<number, { empresaNome: string; tanques: ReabastTanque[] }>()
    for (const t of baixos) {
      if (!matches(t)) continue
      const g = postoMap.get(t.empresaCodigo) ?? { empresaNome: t.empresaNome, tanques: [] }
      g.tanques.push(t)
      postoMap.set(t.empresaCodigo, g)
    }
    return Array.from(postoMap.entries())
      .map(([empresaCodigo, g]) => ({
        empresaCodigo,
        empresaNome: g.empresaNome,
        linhas: aggregarPorProduto(g.tanques),
        totalSugestao: g.tanques.reduce((s, t) => s + t.necessidadeFimDoMes, 0),
      }))
      .sort((a, b) => b.totalSugestao - a.totalSugestao)
  }, [baixos, filterStatus])
  const resumoMaxes = useMemo(() => calcularMaxes(resumoPostos), [resumoPostos])

  const subTabs: SubTab[] = [
    { id: 'combustivel', label: 'Combustível', Icon: Fuel },
    { id: 'automotivo', label: 'Automotivo', Icon: Car, disabled: true },
    { id: 'conveniencia', label: 'Conveniência', Icon: ShoppingBag, disabled: true },
  ]

  if (isLoading) return null

  return (
    <section className="space-y-4">
      <div className="flex justify-center">
        <SubTabSwitcher tabs={subTabs} active={sub} onChange={setSub} />
      </div>

      {sub !== 'combustivel' ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
          Em breve.
        </div>
      ) : baixos.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <Fuel className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">Todos os tanques abastecidos</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Nenhum tanque abaixo de 30% no momento.</p>
        </div>
      ) : (
        <>
          {/* KPIs: hero navy + 3 status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiHero hero={view.hero} />
            {view.kpis.map((k) => <KpiStatusCard key={k.label} kpi={k} />)}
          </div>

          {/* Itens que precisam de atenção */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">{view.itemsTitulo}</h3>
                  <InfoHint text={view.itemsCriterio} align="start" />
                </div>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{view.itemsSubtitulo}</p>
              </div>
              <StatusFilter options={view.statusFilters} active={filterStatus} onChange={(id) => setFilterStatus(id as FilterStatus)} />
            </div>
            {filteredItems.length === 0 ? (
              <p className="mt-6 text-center text-xs text-gray-400">Sem itens nesse filtro.</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((it) => <ReposicaoItemCard key={it.id} item={it} />)}
              </div>
            )}
          </div>

          {/* Reposição por posto — tabela idêntica à anterior */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Reposição por posto</h3>
              <InfoHint text={view.reposicaoFormula} align="start" />
            </div>
            <div className="mt-3 space-y-4">
              {resumoPostos.map((rp) => (
                <div key={rp.empresaCodigo}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <p className="truncate text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">{rp.empresaNome}</p>
                    <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
                      Comprar <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-400">{formatLiters(rp.totalSugestao)}</span>
                    </span>
                  </div>
                  <ReposicaoTabela linhas={rp.linhas} maxes={resumoMaxes} />
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <Clock className="h-3 w-3" />
              Baseado no estoque escritural atual de cada tanque
            </p>
          </div>
        </>
      )}
    </section>
  )
}

export default ReabastecimentoCard
