import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  Search, Trophy, MapPin, Users, Store, ChevronRight, ArrowUpDown, Award, Handshake,
  Table2, Map as MapIcon,
} from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import TopBarTabs from '@/components/layout/TopBarTabs'
import InfoHint from '@/components/ui/InfoHint'
import useTabParam from '@/hooks/useTabParam'
import { usePersonalizedTabs } from '@/hooks/usePersonalizedTabs'
import { useRedePostos, type RedePosto } from '@/pages/Rede/hooks/useRedePostos'
import { isProspeccaoBridgeConfigured } from '@/lib/supabaseRede'
import { formatCnpj, enderecoLinha, prospeccaoStatusTone, prospeccaoStatusLabel } from '@/pages/Rede/lib'
import PostoDrawer from '@/pages/Rede/components/PostoDrawer'

const RedeMapa = lazy(() => import('@/pages/Rede/components/RedeMapa'))

type RedeTab = 'tabela' | 'mapa'
const isRedeTab = (v: string | null): v is RedeTab => v === 'tabela' || v === 'mapa'
const TABS: { id: RedeTab; label: string; Icon: typeof Store }[] = [
  { id: 'tabela', label: 'Tabela', Icon: Table2 },
  { id: 'mapa', label: 'Mapa', Icon: MapIcon },
]

type Ordenacao = 'posto' | 'cidade' | 'prospeccao'

const Rede = () => {
  const { postos, isLoading } = useRedePostos()
  const [busca, setBusca] = useState('')
  const [cidade, setCidade] = useState('')
  const [soProspeccao, setSoProspeccao] = useState(false)
  const [ordem, setOrdem] = useState<Ordenacao>('posto')
  const [sel, setSel] = useState<RedePosto | null>(null)

  const [tab, setTab] = useTabParam<RedeTab>('tabela', isRedeTab)
  const visibleTabs = usePersonalizedTabs('/rede', TABS)
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === tab)) setTab(visibleTabs[0].id)
  }, [visibleTabs, tab, setTab])

  const cidades = useMemo(
    () => [...new Set(postos.map((p) => p.cidade).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [postos]
  )

  const kpis = useMemo(() => {
    const comPros = postos.filter((p) => p.prospeccao)
    const vendedores = new Set(comPros.map((p) => p.prospeccao!.vendedor).filter(Boolean))
    return {
      total: postos.length,
      comProspeccao: comPros.length,
      vendedores: vendedores.size,
      cidades: new Set(postos.map((p) => p.cidade).filter(Boolean)).size,
    }
  }, [postos])

  const ranking = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of postos) {
      const v = p.prospeccao?.vendedor
      if (v) m.set(v, (m.get(v) ?? 0) + 1)
    }
    return [...m.entries()].map(([vendedor, qtd]) => ({ vendedor, qtd })).sort((a, b) => b.qtd - a.qtd)
  }, [postos])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const arr = postos.filter((p) => {
      if (soProspeccao && !p.prospeccao) return false
      if (cidade && p.cidade !== cidade) return false
      if (!q) return true
      return (
        (p.fantasia ?? '').toLowerCase().includes(q) ||
        (p.razao ?? '').toLowerCase().includes(q) ||
        (p.cidade ?? '').toLowerCase().includes(q) ||
        (p.prospeccao?.vendedor ?? '').toLowerCase().includes(q) ||
        (p.cnpj ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
      )
    })
    const nome = (p: RedePosto) => (p.fantasia || p.razao || '').toLowerCase()
    arr.sort((a, b) => {
      if (ordem === 'cidade') return (a.cidade ?? '').localeCompare(b.cidade ?? '') || nome(a).localeCompare(nome(b))
      if (ordem === 'prospeccao') {
        const av = a.prospeccao?.vendedor ?? '~'
        const bv = b.prospeccao?.vendedor ?? '~'
        return av.localeCompare(bv) || nome(a).localeCompare(nome(b))
      }
      return nome(a).localeCompare(nome(b))
    })
    return arr
  }, [postos, busca, cidade, soProspeccao, ordem])

  return (
    <div className="space-y-5">
      <PageHeaderTitle>
        <TopBarTabs active={tab} onChange={(id) => setTab(id as RedeTab)} tabs={visibleTabs} />
      </PageHeaderTitle>

      {tab === 'mapa' ? (
        <Suspense fallback={<div className="h-[24rem] animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" />}>
          <RedeMapa postos={postos} onSelect={setSel} />
        </Suspense>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat Icon={Store} label="Postos na rede" value={kpis.total} />
            <Stat
              Icon={Handshake}
              label="Vindos da prospecção"
              value={kpis.comProspeccao}
              hint="Postos que casaram por CNPJ com um lead do Prospecção360."
              tone="text-emerald-600 dark:text-emerald-400"
            />
            <Stat Icon={Users} label="Vendedores" value={kpis.vendedores} />
            <Stat Icon={MapPin} label="Cidades" value={kpis.cidades} />
          </div>

          {/* Ranking de vendedores */}
          {ranking.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quem trouxe mais clientes</h2>
                <InfoHint text="Nº de postos da rede conquistados por cada vendedor, segundo o Prospecção360." />
              </div>
              <ul className="space-y-2">
                {ranking.slice(0, 6).map((r, i) => (
                  <li key={r.vendedor} className="flex items-center gap-3">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      i === 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'
                    }`}>
                      {i === 0 ? <Award className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className="w-40 shrink-0 truncate text-sm font-medium text-gray-800 dark:text-gray-200">{r.vendedor}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(r.qtd / ranking[0].qtd) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-300">{r.qtd}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar posto, cidade, vendedor ou CNPJ…"
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
            <button
              onClick={() => setSoProspeccao((v) => !v)}
              className={`h-9 rounded-lg border px-3 text-sm font-medium transition-colors ${
                soProspeccao
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300'
              }`}
            >
              Só da prospecção
            </button>
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
                    <Th onClick={() => setOrdem('prospeccao')} ativo={ordem === 'prospeccao'}>Prospecção</Th>
                    <th className="w-8 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonRows />
                  ) : filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
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
                        <td className="px-4 py-2.5">
                          {p.prospeccao ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <Trophy className="h-3 w-3" /> {p.prospeccao.vendedor || '—'}
                              </span>
                              <span className={`inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${prospeccaoStatusTone(p.prospeccao.status)}`}>
                                {prospeccaoStatusLabel(p.prospeccao.status)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
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

          {/* Rodapé de contagem + estado da ponte */}
          <p className="text-xs text-gray-400">
            {filtrados.length} de {postos.length} postos
            {!isProspeccaoBridgeConfigured && (
              <> · <span className="text-amber-600">ponte de prospecção não configurada</span> (defina VITE_SUPABASE_PROSPECCAO_URL/ANON_KEY)</>
            )}
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
  tone?: string
}) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
      <Icon className="h-4 w-4" />
      <span className="text-[11px] font-medium">{label}</span>
      {hint && <InfoHint text={hint} />}
    </div>
    <p className={`mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100 ${tone ?? ''}`}>
      {value.toLocaleString('pt-BR')}
    </p>
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
        {Array.from({ length: 6 }).map((_, j) => (
          <td key={j} className="px-4 py-3">
            <div className="h-3.5 w-full max-w-[160px] animate-pulse rounded bg-gray-100 dark:bg-white/5" />
          </td>
        ))}
      </tr>
    ))}
  </>
)

export default Rede
