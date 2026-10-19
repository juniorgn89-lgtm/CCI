import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Search, MapPin, Store, ChevronRight, ArrowUpDown, Globe, Navigation, Table2, Map as MapIcon, RefreshCw } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import TopBarTabs from '@/components/layout/TopBarTabs'
import InfoHint from '@/components/ui/InfoHint'
import { Skeleton } from '@/components/ui/skeleton'
import useTabParam from '@/hooks/useTabParam'
import { usePersonalizedTabs } from '@/hooks/usePersonalizedTabs'
import useIsMobile from '@/hooks/useIsMobile'
import { useRedePostos, type RedePosto } from '@/pages/Rede/hooks/useRedePostos'
import { formatCnpj, enderecoLinha } from '@/pages/Rede/lib'
import PostoDrawer from '@/pages/Rede/components/PostoDrawer'

const RedeMapa = lazy(() => import('@/pages/Rede/components/RedeMapa'))

type RedeTab = 'tabela' | 'mapa'
const isRedeTab = (v: string | null): v is RedeTab => v === 'tabela' || v === 'mapa'
const TABS: { id: RedeTab; label: string; Icon: typeof Store }[] = [
  { id: 'tabela', label: 'Tabela', Icon: Table2 },
  { id: 'mapa', label: 'Mapa', Icon: MapIcon },
]

type Ordenacao = 'posto' | 'cidade'

const temCoord = (p: RedePosto) =>
  Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && (p.latitude !== 0 || p.longitude !== 0)

const Rede = () => {
  const { postos, isLoading } = useRedePostos()
  const [busca, setBusca] = useState('')
  const [cidade, setCidade] = useState('')
  const [ordem, setOrdem] = useState<Ordenacao>('posto')
  const [sel, setSel] = useState<RedePosto | null>(null)

  const isMobile = useIsMobile()
  const [tab, setTab] = useTabParam<RedeTab>('tabela', isRedeTab)
  const visibleTabs = usePersonalizedTabs('/rede', TABS)
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === tab)) setTab(visibleTabs[0].id)
  }, [visibleTabs, tab, setTab])

  const cidades = useMemo(
    () => [...new Set(postos.map((p) => p.cidade).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [postos]
  )

  const kpis = useMemo(
    () => ({
      total: postos.length,
      cidades: new Set(postos.map((p) => p.cidade).filter(Boolean)).size,
      estados: new Set(postos.map((p) => p.estado).filter(Boolean)).size,
      noMapa: postos.filter(temCoord).length,
    }),
    [postos]
  )

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const arr = postos.filter((p) => {
      if (cidade && p.cidade !== cidade) return false
      if (!q) return true
      return (
        (p.fantasia ?? '').toLowerCase().includes(q) ||
        (p.razao ?? '').toLowerCase().includes(q) ||
        (p.cidade ?? '').toLowerCase().includes(q) ||
        (p.cnpj ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
      )
    })
    const nome = (p: RedePosto) => (p.fantasia || p.razao || '').toLowerCase()
    arr.sort((a, b) =>
      ordem === 'cidade'
        ? (a.cidade ?? '').localeCompare(b.cidade ?? '') || nome(a).localeCompare(nome(b))
        : nome(a).localeCompare(nome(b))
    )
    return arr
  }, [postos, busca, cidade, ordem])

  return (
    <div className="space-y-5">
      {/* Abas: no desktop portam pra sub-bar do topo; no celular (sem esse slot)
          renderizam inline, senão o usuário perderia o alternador Tabela/Mapa. */}
      {isMobile ? (
        <TopBarTabs active={tab} onChange={(id) => setTab(id as RedeTab)} tabs={visibleTabs} />
      ) : (
        <PageHeaderTitle>
          <TopBarTabs active={tab} onChange={(id) => setTab(id as RedeTab)} tabs={visibleTabs} />
        </PageHeaderTitle>
      )}

      {tab === 'mapa' ? (
        <Suspense fallback={<div className="h-[24rem] animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />}>
          <RedeMapa postos={postos} onSelect={setSel} />
        </Suspense>
      ) : (
        <>
          {/* KPIs — mesmo padrão da tela Pessoas (rótulo em caixa alta, número, selo de ícone à direita). */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat Icon={Store} label="Postos na rede" value={kpis.total} tone="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" />
            <Stat Icon={MapPin} label="Cidades" value={kpis.cidades} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" />
            <Stat Icon={Globe} label="Estados" value={kpis.estados} tone="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" />
            <Stat Icon={Navigation} label="No mapa" value={kpis.noMapa} hint="Postos com coordenada (aparecem na aba Mapa)." tone="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-[#0f0f0f]">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar posto, cidade ou CNPJ..."
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </div>
            <select
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-gray-50 px-3 text-xs font-medium text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">Todas as cidades</option>
              {cidades.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {filtrados.length} de {postos.length} posto{postos.length === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <RefreshCw className="h-3 w-3" />
              Automático · WebPosto
              <InfoHint text="Este cadastro não é feito no Visor360: os postos vêm do WebPosto (sistema da Quality) e aparecem aqui sozinhos. Para incluir ou alterar um posto, faça no WebPosto." />
            </span>
          </div>

          {/* Lista */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : filtrados.length === 0 ? (
              <div className="px-5 py-16 text-center text-sm text-gray-400">
                {postos.length === 0 ? 'Nenhum posto na rede.' : 'Nenhum posto pros filtros aplicados.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-transparent dark:text-gray-400">
                    <tr>
                      <Th onClick={() => setOrdem('posto')} ativo={ordem === 'posto'}>Posto</Th>
                      <th className="px-4 py-2.5 text-left font-medium">CNPJ</th>
                      <Th onClick={() => setOrdem('cidade')} ativo={ordem === 'cidade'}>Cidade / UF</Th>
                      <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">Endereço</th>
                      <th className="w-8 px-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtrados.map((p) => (
                      <tr
                        key={p.codigo}
                        onClick={() => setSel(p)}
                        className="cursor-pointer transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/30"
                      >
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                          <p>{p.fantasia || p.razao}</p>
                          {p.fantasia && p.razao && p.fantasia !== p.razao && (
                            <p className="truncate text-[10px] font-normal text-gray-400 dark:text-gray-500">{p.razao}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-gray-700 dark:text-gray-300">{formatCnpj(p.cnpj) || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-700 dark:text-gray-300">
                          {[p.cidade, p.estado].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="hidden max-w-[280px] truncate px-4 py-2.5 text-gray-500 dark:text-gray-400 md:table-cell">
                          {enderecoLinha(p) || '—'}
                        </td>
                        <td className="px-2 text-gray-300 dark:text-gray-600">
                          <ChevronRight className="h-4 w-4" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Cadastro automático: os postos vêm do WebPosto (sistema da Quality) e aparecem aqui sozinhos. Para incluir ou alterar um posto, faça no WebPosto. Clique numa linha pra ver os detalhes.
          </p>
        </>
      )}

      <PostoDrawer posto={sel} onClose={() => setSel(null)} />
    </div>
  )
}

const Stat = ({
  Icon,
  label,
  value,
  hint,
  tone,
}: {
  Icon: typeof Store
  label: string
  value: number
  hint?: string
  tone: string
}) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
    <div className="min-w-0">
      <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
        {hint && <InfoHint text={hint} />}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value.toLocaleString('pt-BR')}</p>
    </div>
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
      <Icon className="h-5 w-5" />
    </div>
  </div>
)

const Th = ({ children, onClick, ativo }: { children: React.ReactNode; onClick: () => void; ativo: boolean }) => (
  <th className="px-4 py-2.5 text-left font-medium">
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 ${ativo ? 'text-gray-800 dark:text-gray-200' : ''}`}>
      {children}
      <ArrowUpDown className="h-3 w-3 opacity-50" />
    </button>
  </th>
)

export default Rede
