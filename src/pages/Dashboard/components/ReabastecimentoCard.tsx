import { useEffect, useMemo, useRef, useState } from 'react'
import { Fuel, AlertTriangle, Clock, Building2, Droplets, ClipboardList, LayoutGrid, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLiters } from '@/lib/formatters'
import useReabastecimento, { type ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'
import TanqueCard from '@/pages/Dashboard/components/TanqueCard'
import ReposicaoTabela, { aggregarPorProduto, type ReposicaoLinha } from '@/pages/Dashboard/components/ReposicaoTabela'

// A Central só lista tanques baixos (crítico/alerta), então não há filtro "OK".
type FilterStatus = 'todos' | 'critico' | 'alerta'
type AgruparPor = 'posto' | 'combustivel'
type View = 'tanques' | 'resumo'

interface Grupo {
  key: string
  label: string
  tanques: ReabastTanque[]
  criticosCount: number
  minNivelPct: number
}

interface ResumoPosto {
  empresaCodigo: number
  empresaNome: string
  linhas: ReposicaoLinha[]
  totalSugestao: number
}

/**
 * Painel de Reabastecimento na Central da Rede.
 * Renderiza só quando há ao menos 1 tanque abaixo de 30%. Tem duas visões
 * (switcher instantâneo, mesmos dados): "Tanques" (cards em carrossel,
 * agrupáveis por posto/combustível) e "Resumo" (relatório de reposição por
 * posto, estilo planilha).
 *
 * Visibilidade é controlada pelo Dashboard (isMaster || canVerReabastecimento).
 */
const ReabastecimentoCard = () => {
  // includeDetalhes=true puxa LMC dos últimos 90 dias pra preencher
  // ultimaCompra + necessidadeFimDoMes em cada tanque baixo.
  const { baixos, criticos, isLoading } = useReabastecimento({ includeDetalhes: true })
  const [expanded, setExpanded] = useState(true)
  const [view, setView] = useState<View>('tanques')
  const [agruparPor, setAgruparPor] = useState<AgruparPor>('posto')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos')
  const [filterProduto, setFilterProduto] = useState<string>('todos')

  // Resumo estável pro cabeçalho do painel (independe do agrupamento atual).
  const postosCount = useMemo(() => new Set(baixos.map((t) => t.empresaCodigo)).size, [baixos])

  const produtosUnicos = useMemo(() => {
    const set = new Set<string>()
    for (const t of baixos) set.add(t.produtoNome)
    return Array.from(set).sort()
  }, [baixos])

  // Resumo de reposição: por posto, e dentro de cada posto consolidado por
  // combustível (estilo relatório "Reposição de Estoque").
  const resumoPostos = useMemo<ResumoPosto[]>(() => {
    const postoMap = new Map<number, { empresaNome: string; tanques: ReabastTanque[] }>()
    for (const t of baixos) {
      if (filterStatus !== 'todos' && t.nivel !== filterStatus) continue
      const g = postoMap.get(t.empresaCodigo) ?? { empresaNome: t.empresaNome, tanques: [] }
      g.tanques.push(t)
      postoMap.set(t.empresaCodigo, g)
    }
    const arr: ResumoPosto[] = Array.from(postoMap.entries()).map(([empresaCodigo, g]) => ({
      empresaCodigo,
      empresaNome: g.empresaNome,
      linhas: aggregarPorProduto(g.tanques),
      totalSugestao: g.tanques.reduce((s, t) => s + t.necessidadeFimDoMes, 0),
    }))
    return arr.sort((a, b) => b.totalSugestao - a.totalSugestao)
  }, [baixos, filterStatus])

  const totalSugestao = resumoPostos.reduce((s, rp) => s + rp.totalSugestao, 0)

  // Agrupa por posto ou por combustível. Grupos ordenados por urgência (menor
  // % primeiro); tanques dentro do grupo também (pior primeiro).
  const grupos = useMemo<Grupo[]>(() => {
    const map = new Map<string, Grupo>()
    for (const t of baixos) {
      const key = agruparPor === 'posto' ? String(t.empresaCodigo) : t.produtoNome
      const label = agruparPor === 'posto' ? t.empresaNome : t.produtoNome
      const g = map.get(key) ?? { key, label, tanques: [], criticosCount: 0, minNivelPct: Infinity }
      g.tanques.push(t)
      if (t.nivel === 'critico') g.criticosCount += 1
      if (t.nivelPct < g.minNivelPct) g.minNivelPct = t.nivelPct
      map.set(key, g)
    }
    const arr = Array.from(map.values()).sort((a, b) => a.minNivelPct - b.minNivelPct)
    for (const g of arr) g.tanques.sort((a, b) => a.nivelPct - b.nivelPct)
    return arr
  }, [baixos, agruparPor])

  // Aplica os filtros em cada grupo e descarta grupos que ficam sem tanques.
  const gruposFiltrados = useMemo<Grupo[]>(() => {
    return grupos
      .map((g) => {
        const tanques = g.tanques.filter(
          (t) =>
            (filterStatus === 'todos' || t.nivel === filterStatus) &&
            (filterProduto === 'todos' || t.produtoNome === filterProduto),
        )
        return { ...g, tanques, criticosCount: tanques.filter((t) => t.nivel === 'critico').length }
      })
      .filter((g) => g.tanques.length > 0)
  }, [grupos, filterStatus, filterProduto])

  const totalFiltrados = gruposFiltrados.reduce((s, g) => s + g.tanques.length, 0)

  if (isLoading || baixos.length === 0) return null

  const trocarAgrupamento = (modo: AgruparPor) => {
    setAgruparPor(modo)
    // Filtro de produto é redundante quando já agrupa por combustível.
    setFilterProduto('todos')
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/40',
          expanded && 'border-b border-gray-100 dark:border-gray-800',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Reabastecimento</h2>
            {criticos.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-2.5 w-2.5" />
                {criticos.length} crítico{criticos.length === 1 ? '' : 's'}
              </span>
            )}
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              · {postosCount} {postosCount === 1 ? 'posto' : 'postos'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Tanques com estoque baixo · crítico abaixo de 20% · alerta abaixo de 30% · clique pra {expanded ? 'minimizar' : 'expandir'}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <>
          {/* Switcher de visão + filtro de status (vale pras duas visões) */}
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-2 dark:border-gray-800">
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
              {(
                [
                  { v: 'tanques', l: 'Tanques', Icon: LayoutGrid },
                  { v: 'resumo', l: 'Resumo', Icon: ClipboardList },
                ] as { v: View; l: string; Icon: typeof LayoutGrid }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setView(opt.v)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    view === opt.v
                      ? 'bg-[#1e3a5f] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50',
                  )}
                >
                  <opt.Icon className="h-3.5 w-3.5" />
                  {opt.l}
                </button>
              ))}
            </div>

            {/* Status — filtra tanto os cards quanto o resumo */}
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
              {(
                [
                  { v: 'todos', l: 'Todos' },
                  { v: 'critico', l: 'Críticos' },
                  { v: 'alerta', l: 'Alerta' },
                ] as { v: FilterStatus; l: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setFilterStatus(opt.v)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    filterStatus === opt.v
                      ? 'bg-[#1e3a5f] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50',
                  )}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
              {view === 'resumo' ? (
                <>
                  Total a comprar:{' '}
                  <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                    {formatLiters(totalSugestao)}
                  </span>
                </>
              ) : (
                <>
                  {totalFiltrados} de {baixos.length} {baixos.length === 1 ? 'tanque' : 'tanques'}
                </>
              )}
            </span>
          </div>

          {view === 'resumo' ? (
            /* ── Visão Resumo: relatório de reposição por posto ── */
            <div className="space-y-4 px-4 py-3">
              {resumoPostos.map((rp) => (
                <div key={rp.empresaCodigo}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <p className="truncate text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      {rp.empresaNome}
                    </p>
                    <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
                      Comprar{' '}
                      <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                        {formatLiters(rp.totalSugestao)}
                      </span>
                    </span>
                  </div>
                  <ReposicaoTabela linhas={rp.linhas} />
                </div>
              ))}
            </div>
          ) : (
            /* ── Visão Tanques: controles + carrosséis de cards ── */
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                {/* Agrupar por */}
                <div className="inline-flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Agrupar:</span>
                  <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
                    {(
                      [
                        { v: 'posto', l: 'Posto' },
                        { v: 'combustivel', l: 'Combustível' },
                      ] as { v: AgruparPor; l: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.v}
                        onClick={() => trocarAgrupamento(opt.v)}
                        className={cn(
                          'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                          agruparPor === opt.v
                            ? 'bg-[#1e3a5f] text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50',
                        )}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Produto — só faz sentido quando agrupando por posto */}
                {agruparPor === 'posto' && produtosUnicos.length > 1 && (
                  <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
                    {['todos', ...produtosUnicos].map((p) => (
                      <button
                        key={p}
                        onClick={() => setFilterProduto(p)}
                        className={cn(
                          'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                          filterProduto === p
                            ? 'bg-[#1e3a5f] text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50',
                        )}
                      >
                        {p === 'todos' ? 'Todos os produtos' : p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {gruposFiltrados.length === 0 ? (
                <div className="p-8 text-center">
                  <Fuel className="mx-auto h-7 w-7 text-gray-400" />
                  <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nenhum tanque pros filtros aplicados
                  </p>
                </div>
              ) : (
                <div className="space-y-5 py-4">
                  {gruposFiltrados.map((g) => (
                    <GrupoCarrossel key={g.key} grupo={g} agruparPor={agruparPor} />
                  ))}
                </div>
              )}
            </>
          )}

          <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-800">
            <p className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <Clock className="h-3 w-3" />
              Baseado no estoque escritural atual de cada tanque
            </p>
          </div>
        </>
      )}
    </section>
  )
}

/**
 * Seção de um grupo (posto ou combustível): título + carrossel horizontal dos
 * cards de tanque. As setas aparecem só quando há conteúdo a rolar.
 */
const GrupoCarrossel = ({ grupo, agruparPor }: { grupo: Grupo; agruparPor: AgruparPor }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const updateArrows = () => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    updateArrows()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scrollByDir = (dir: -1 | 1) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  const arrowClass =
    'absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-600 shadow-md transition hover:bg-white hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-300 dark:hover:bg-gray-800'

  const Icon = agruparPor === 'posto' ? Building2 : Droplets

  return (
    <div>
      {/* Título do grupo */}
      <div className="mb-2 flex items-center gap-2 px-4">
        <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <p className="truncate text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          {grupo.label}
        </p>
        <span className="text-[10px] text-gray-400">·</span>
        <p className="shrink-0 text-[11px] font-medium text-gray-500 dark:text-gray-400">
          {grupo.tanques.length} {grupo.tanques.length === 1 ? 'tanque baixo' : 'tanques baixos'}
        </p>
        {grupo.criticosCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <AlertTriangle className="h-2.5 w-2.5" />
            {grupo.criticosCount} crít.
          </span>
        )}
      </div>

      {/* Carrossel horizontal */}
      <div className="relative">
        {canLeft && (
          <button
            type="button"
            onClick={() => scrollByDir(-1)}
            aria-label="Rolar para a esquerda"
            className={cn(arrowClass, 'left-1')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {grupo.tanques.map((t) => (
            <div key={`${t.empresaCodigo}-${t.tanqueCodigo}`} className="w-[19rem] shrink-0">
              <TanqueCard t={t} subtitle={agruparPor === 'combustivel' ? t.empresaNome : undefined} />
            </div>
          ))}
        </div>
        {canRight && (
          <button
            type="button"
            onClick={() => scrollByDir(1)}
            aria-label="Rolar para a direita"
            className={cn(arrowClass, 'right-1')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export default ReabastecimentoCard
