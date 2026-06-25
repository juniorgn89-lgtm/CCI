import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Warehouse, Package, AlertTriangle, RefreshCw, Boxes } from 'lucide-react'
import useEstoqueAnalytics, { type ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import { KpiCard, Section, ScrollTabs, Badge, type Tone } from '@/components/mobile/primitives'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brl, brlShort } from '@/components/mobile/format'

const TABS = [
  { id: 'repor', label: 'Reposição' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'giro', label: 'Giro' },
]

const STATUS_TONE: Record<string, Tone> = {
  negativo: 'rose',
  critico: 'rose',
  baixo: 'amber',
  ok: 'emerald',
  sem_movimento: 'navy',
}
const STATUS_LABEL: Record<string, string> = {
  negativo: 'Negativo',
  critico: 'Crítico',
  baixo: 'Baixo',
  ok: 'OK',
  sem_movimento: 'Sem mov.',
}

const fmtUn = (n: number) => `${formatNumber(Math.round(n))} un`
const fmtDias = (n: number) => (isFinite(n) ? `${Math.round(n)}d` : '∞')

/**
 * Estoques — versão mobile. Reusa useEstoqueAnalytics (cobertura 30 dias). KPIs +
 * abas: Reposição (críticos/baixos com sugestão), Estoque (por valor) e Giro
 * (parados — menor giro com capital empatado).
 */
const EstoqueMobile = () => {
  // Estoque é por-posto → um posto por vez, com seletor quando o filtro tem mais.
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))
  const [activeCodigo, setActiveCodigo] = useState<number | null>(null)
  const postoCodes = postos.map((p) => p.codigo)
  const selectedCodigo = activeCodigo != null && postoCodes.includes(activeCodigo)
    ? activeCodigo
    : (postos[0]?.codigo ?? null)

  const { productAnalytics, kpis, isLoading } = useEstoqueAnalytics(30, 30, selectedCodigo)
  const [tab, setTab] = useState('repor')

  const { repor, porValor, parados, counts } = useMemo(() => {
    const rank: Record<string, number> = { negativo: 0, critico: 1, baixo: 2, ok: 3, sem_movimento: 4 }
    const repor = productAnalytics
      .filter((p) => p.necessidadeStatus === 'negativo' || p.necessidadeStatus === 'critico' || p.necessidadeStatus === 'baixo')
      .sort((a, b) => (rank[a.necessidadeStatus] - rank[b.necessidadeStatus]) || a.diasCobertura - b.diasCobertura)
    const porValor = [...productAnalytics].filter((p) => p.valorEstoque > 0).sort((a, b) => b.valorEstoque - a.valorEstoque)
    const parados = [...productAnalytics]
      .filter((p) => p.saldoAtual > 0 && p.valorEstoque > 0)
      .sort((a, b) => a.giro - b.giro)
    const counts = {
      criticos: productAnalytics.filter((p) => p.necessidadeStatus === 'critico' || p.necessidadeStatus === 'negativo').length,
      baixos: productAnalytics.filter((p) => p.necessidadeStatus === 'baixo').length,
    }
    return { repor, porValor, parados, counts }
  }, [productAnalytics])

  const postoTabs = postos.length > 1 ? (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      {postos.map((e) => (
        <button
          key={e.codigo}
          type="button"
          onClick={() => setActiveCodigo(e.codigo)}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
            e.codigo === selectedCodigo
              ? 'bg-[#1e3a5f] text-white'
              : 'border border-gray-200 bg-white text-gray-500 dark:border-[#303030] dark:bg-[#1a1a1a] dark:text-gray-400',
          )}
        >
          {e.fantasia}
        </button>
      ))}
    </div>
  ) : null

  if (postos.length === 0) {
    return (
      <div className="space-y-3 pb-2">
        <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Estoques</h1>
        <EmptyCard title="Sem posto" desc="Nenhum posto disponível." />
      </div>
    )
  }
  if (isLoading) return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Estoques</h1>
      {postoTabs}
      <LoadingScreen message="Carregando estoque…" />
    </div>
  )
  if (productAnalytics.length === 0) return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Estoques</h1>
      {postoTabs}
      <EmptyCard title="Sem produtos" desc="Não há produtos de estoque pro posto selecionado." />
    </div>
  )

  const Row = ({ p, right, sub }: { p: ProductAnalyticsRow; right: React.ReactNode; sub: string }) => (
    <div className="flex items-center gap-2 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{p.produtoNome}</p>
        <p className="truncate text-[10.5px] text-gray-400 dark:text-gray-500">{sub}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">{right}</div>
    </div>
  )

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Estoques</h1>
      {postoTabs}

      <div className="grid grid-cols-2 gap-2">
        <KpiCard span2 big label="Valor em estoque" tone="navy" Icon={Warehouse} value={brlShort(kpis.valorTotalEstoque)} sub={`${formatNumber(kpis.totalProdutos)} produtos`} />
        <KpiCard label="Críticos" tone="rose" Icon={AlertTriangle} value={formatNumber(counts.criticos)} sub="repor já" />
        <KpiCard label="Baixos" tone="amber" Icon={Package} value={formatNumber(counts.baixos)} sub="atenção" />
      </div>

      <ScrollTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'repor' && (
        repor.length === 0 ? (
          <EmptyCard title="Tudo abastecido" desc="Nenhum produto crítico ou baixo pra repor." />
        ) : (
          <Section Icon={RefreshCw} title="Precisa repor" right={<Badge tone="rose">{repor.length}</Badge>} flush>
            <div className="divide-y divide-gray-100 dark:divide-[#303030]">
              {repor.slice(0, 150).map((p) => (
                <Row
                  key={p.produtoCodigo}
                  p={p}
                  sub={`saldo ${fmtUn(p.saldoAtual)} · cobre ${fmtDias(p.diasCobertura)} · ${p.categoria}`}
                  right={
                    <>
                      <span className="text-[12px] font-bold tabular-nums text-gray-900 dark:text-gray-100">
                        {p.necessidadeUnidades > 0 ? `comprar ${fmtUn(p.necessidadeUnidades)}` : '—'}
                      </span>
                      <Badge tone={STATUS_TONE[p.necessidadeStatus] ?? 'navy'}>{STATUS_LABEL[p.necessidadeStatus] ?? p.necessidadeStatus}</Badge>
                    </>
                  }
                />
              ))}
            </div>
          </Section>
        )
      )}

      {tab === 'estoque' && (
        <Section Icon={Boxes} title="Maior valor em estoque" flush>
          <div className="divide-y divide-gray-100 dark:divide-[#303030]">
            {porValor.slice(0, 150).map((p) => (
              <Row
                key={p.produtoCodigo}
                p={p}
                sub={`${fmtUn(p.saldoAtual)} · ${p.categoria}`}
                right={
                  <>
                    <span className="text-[12.5px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brl(p.valorEstoque)}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">cobre {fmtDias(p.diasCobertura)}</span>
                  </>
                }
              />
            ))}
          </div>
        </Section>
      )}

      {tab === 'giro' && (
        <Section Icon={RefreshCw} title="Menor giro (capital parado)" flush>
          <div className="divide-y divide-gray-100 dark:divide-[#303030]">
            {parados.slice(0, 150).map((p) => (
              <Row
                key={p.produtoCodigo}
                p={p}
                sub={`saldo ${fmtUn(p.saldoAtual)} · ${brlShort(p.valorEstoque)} parado`}
                right={
                  <>
                    <span className="text-[12.5px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{p.giro.toFixed(2).replace('.', ',')}×</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">giro 6m</span>
                  </>
                }
              />
            ))}
          </div>
        </Section>
      )}

      <p className="px-1 text-center text-[10px] text-gray-400 dark:text-gray-500">
        Cobertura calculada pra 30 dias · giro e médias sobre os últimos 6 meses.
      </p>
    </div>
  )
}

export default EstoqueMobile
