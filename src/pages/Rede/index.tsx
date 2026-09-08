import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Search, MapPin, Store, ChevronRight, ArrowUpDown, Globe, Navigation, Table2, Map as MapIcon } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import TopBarTabs from '@/components/layout/TopBarTabs'
import InfoHint from '@/components/ui/InfoHint'
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
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat Icon={Store} label="Postos na rede" value={kpis.total} />
            <Stat Icon={MapPin} label="Cidades" value={kpis.cidades} />
            <Stat Icon={Globe} label="Estados" value={kpis.estados} />
            <Stat Icon={Navigation} label="No mapa" value={kpis.noMapa} hint="Postos com coordenada (aparecem na aba Mapa)." />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar posto, cidade ou CNPJ…"
                className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/40 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-100"
              />
            </div>
            <select
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/40 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-100"
            >
              <option value="">Todas as cidades</option>
              {cidades.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Tabela */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50/70 text-[11px] uppercase tracking-wide text-gray-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-gray-400">
                  <tr>
                    <Th onClick={() => setOrdem('posto')} ativo={ordem === 'posto'}>Posto</Th>
                    <th className="px-4 py-2.5 font-medium">CNPJ</th>
                    <Th onClick={() => setOrdem('cidade')} ativo={ordem === 'cidade'}>Cidade / UF</Th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Endereço</th>
                    <th className="w-8 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonRows />
                  ) : filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                        {postos.length === 0 ? 'Nenhum posto na rede.' : 'Nada encontrado com esses filtros.'}
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((p) => (
                      <tr
                        key={p.codigo}
                        onClick={() => setSel(p)}
                        className="cursor-pointer border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{p.fantasia || p.razao}</p>
                          {p.fantasia && p.razao && p.fantasia !== p.razao && (
                            <p className="truncate text-xs text-gray-400">{p.razao}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-gray-600 dark:text-gray-300">{formatCnpj(p.cnpj) || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-600 dark:text-gray-300">
                          {[p.cidade, p.estado].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="hidden max-w-[280px] truncate px-4 py-2.5 text-gray-500 dark:text-gray-400 md:table-cell">
                          {enderecoLinha(p) || '—'}
                        </td>
                        <td className="px-2 text-gray-300 dark:text-gray-600">
                          <ChevronRight className="h-4 w-4" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-gray-400">{filtrados.length} de {postos.length} postos</p>
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
}: {
  Icon: typeof Store
  label: string
  value: number
  hint?: string
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
      <Icon className="h-4 w-4" />
      <span className="text-[11px] font-medium">{label}</span>
      {hint && <InfoHint text={hint} />}
    </div>
    <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value.toLocaleString('pt-BR')}</p>
  </div>
)

const Th = ({ children, onClick, ativo }: { children: React.ReactNode; onClick: () => void; ativo: boolean }) => (
  <th className="px-4 py-2.5 font-medium">
    <button onClick={onClick} className={`inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 ${ativo ? 'text-gray-800 dark:text-gray-200' : ''}`}>
      {children}
      <ArrowUpDown className="h-3 w-3 opacity-50" />
    </button>
  </th>
)

const SkeletonRows = () => (
  <>
    {Array.from({ length: 8 }).map((_, i) => (
      <tr key={i} className="border-b border-gray-100 dark:border-white/5">
        {Array.from({ length: 5 }).map((_, j) => (
          <td key={j} className="px-4 py-3">
            <div className="h-3.5 w-full max-w-[160px] animate-pulse rounded bg-gray-100 dark:bg-white/5" />
          </td>
        ))}
      </tr>
    ))}
  </>
)

export default Rede
