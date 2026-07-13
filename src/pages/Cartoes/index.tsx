import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, CircleCheck, FileText, SlidersHorizontal, Wand2, Info, Percent } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import { useFilters } from '@/hooks/useFilters'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchCartoesTratadas, marcarTratada, desfazerTratada } from '@/api/supabase/cartoesConciliacao'
import InfoHint from '@/components/ui/InfoHint'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import TopBarTabs from '@/components/layout/TopBarTabs'
import useCartoesConciliacao, { type DetalheItem } from '@/pages/Cartoes/hooks/useCartoesConciliacao'
import ResultadoTab from '@/pages/Cartoes/components/ResultadoTab'
import DetalhamentoTab from '@/pages/Cartoes/components/DetalhamentoTab'
import ParametrosTab from '@/pages/Cartoes/components/ParametrosTab'
import TaxasTab from '@/pages/Cartoes/components/TaxasTab'

type CartaoTab = 'resultado' | 'detalhamento' | 'taxas' | 'parametros'
const isCartaoTab = (v: string | null): v is CartaoTab => v === 'resultado' || v === 'detalhamento' || v === 'taxas' || v === 'parametros'

const TAB_META: { id: CartaoTab; label: string; Icon: typeof CreditCard }[] = [
  { id: 'resultado', label: 'Resultado', Icon: CircleCheck },
  { id: 'detalhamento', label: 'Detalhamento', Icon: FileText },
  { id: 'taxas', label: 'Taxas', Icon: Percent },
  { id: 'parametros', label: 'Parâmetros', Icon: SlidersHorizontal },
]

const Cartoes = () => {
  const [tab, setTab] = useTabParam<CartaoTab>('resultado', isCartaoTab)
  const [revisaoOn, setRevisaoOn] = useState(false)
  // Filtro interno do Detalhamento quando se clica numa linha do Resultado.
  const [filtro, setFiltro] = useState<{ empresaCodigo: number; bandeira: string; dia: string } | null>(null)
  const irParaDetalhe = (empresaCodigo: number, bandeira: string, dia: string) => {
    setFiltro({ empresaCodigo, bandeira, dia })
    setTab('detalhamento')
  }
  const { data, isLoading, scopeCodes } = useCartoesConciliacao()
  const qc = useQueryClient()

  const view = revisaoOn ? data?.revisao : data?.base

  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const { setEmpresas } = useFilters()
  const rede = useTenantStore((s) => s.rede)
  const user = useAuthStore((s) => s.user)
  const fullName = useAuthStore((s) => s.fullName)
  const ctx = rede && user ? { redeId: rede.id, userId: user.id, userNome: fullName || user.email || 'desconhecido' } : null

  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const permitidas = useEmpresasPermitidas(
    useMemo(() => (empresasData?.resultados ?? []).map((e) => ({ codigo: e.empresaCodigo, nome: e.fantasia || e.razao || `Posto ${e.empresaCodigo}` })), [empresasData]),
  )
  const postos = empresaCodigos.length > 0 ? permitidas.filter((e) => empresaCodigos.includes(e.codigo)) : permitidas
  const empresaNome = useMemo(() => new Map(permitidas.map((e) => [e.codigo, e.nome])), [permitidas])
  const openPosto = (codigo: number) => { setEmpresas([codigo]); setTab('resultado') }

  // Carimbos "tratado" da rede (soft-delete: filtramos os ativos).
  const { data: tratadasRows } = useQuery({
    queryKey: ['cartoes-tratadas', rede?.id, scopeCodes.join(',')],
    queryFn: () => fetchCartoesTratadas(rede!.id, scopeCodes),
    enabled: !!rede?.id && scopeCodes.length > 0,
    staleTime: 60 * 1000,
  })
  const activeTratadas = useMemo(() => (tratadasRows ?? []).filter((t) => !t.desfeito_em), [tratadasRows])
  const tratadasByVenda = useMemo(() => new Map(activeTratadas.map((t) => [t.venda_codigo, t])), [activeTratadas])

  const marcar = async (item: DetalheItem) => {
    if (!ctx) return
    await marcarTratada({ empresaCodigo: item.empresaCodigo, vendaCodigo: item.vendaCodigo, bandeira: item.bandeira, dia: item.diaLiq, valor: item.valor, motivo: item.motivo }, ctx)
    qc.invalidateQueries({ queryKey: ['cartoes-tratadas'] })
  }
  const desfazer = async (id: string) => {
    if (!ctx) return
    await desfazerTratada(id, { userId: ctx.userId, userNome: ctx.userNome })
    qc.invalidateQueries({ queryKey: ['cartoes-tratadas'] })
  }

  // Quantos carimbos ativos ainda cairiam como pendentes (pra o chip do KPI).
  const pendentesSet = useMemo(() => new Set(view?.vendasPendentes ?? []), [view])
  const tratadosCount = useMemo(() => activeTratadas.filter((t) => pendentesSet.has(t.venda_codigo)).length, [activeTratadas, pendentesSet])
  const recuperados = data?.revisao.recuperados

  return (
    <div className="space-y-4">
      <PageHeaderTitle>
        <TopBarTabs active={tab} onChange={(id) => { setFiltro(null); setTab(id as CartaoTab) }} tabs={TAB_META.map((t) => ({ id: t.id, label: t.label, Icon: t.Icon }))} />
      </PageHeaderTitle>

      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Barra de revisão automática (opt-in) — vale pro Resultado e Detalhamento. */}
      {tab !== 'parametros' && tab !== 'taxas' && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50/60 px-3.5 py-2 dark:border-gray-700 dark:bg-gray-800/40">
          <button
            type="button"
            onClick={() => setRevisaoOn((v) => !v)}
            disabled={!data}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50',
              revisaoOn
                ? 'border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-700/50 dark:bg-violet-900/30 dark:text-violet-300'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800',
            )}
          >
            <Wand2 className="h-3.5 w-3.5" />
            {revisaoOn ? 'Revisão automática ligada' : 'Revisar pendências (automático)'}
          </button>
          <InfoHint
            className="text-violet-400 hover:text-violet-600 dark:text-violet-400"
            text="Passada extra (opcional) que resolve LOTE DESLOCADO: quando o EDI posta o repasse no dia errado, ela casa um 'sem repasse' com um lote da MESMA bandeira e posto, mesmo valor, até 7 dias de distância, e marca como conciliado (badge 'lote deslocado'). É cruzamento determinístico de lotes que já existem — NÃO é IA/modelo e NÃO altera nenhum valor. A visão base (sem o botão) continua sendo a conciliação exata."
          />
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
            <Info className="h-3 w-3" /> cruzamento determinístico de lotes — não altera valores
          </span>
          {revisaoOn && recuperados && (
            <span className="ml-auto rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/25 dark:text-violet-300">
              recuperados: {recuperados.n} · {formatCurrencyInt(recuperados.valor)}
            </span>
          )}
        </div>
      )}

      {tab === 'resultado' && <ResultadoTab coverage={data?.coverage} view={view} empresaNome={empresaNome} isLoading={isLoading} tratadosCount={tratadosCount} onRowClick={irParaDetalhe} />}
      {tab === 'detalhamento' && (
        <DetalhamentoTab
          semRepasse={view?.semRepasse ?? []}
          divergencias={view?.divergencias ?? []}
          filtro={filtro}
          onClearFiltro={() => setFiltro(null)}
          isLoading={isLoading}
          activeTratadas={activeTratadas}
          tratadasByVenda={tratadasByVenda}
          vendasPendentes={pendentesSet}
          empresaNome={empresaNome}
          canWrite={!!ctx}
          onMarcar={marcar}
          onDesfazer={desfazer}
        />
      )}
      {tab === 'taxas' && <TaxasTab taxas={data?.taxas ?? []} temRemessa={!!data?.temRemessa} isLoading={isLoading} />}
      {tab === 'parametros' && <ParametrosTab postos={postos} dia={dataFinal} onOpenPosto={openPosto} />}
    </div>
  )
}

export default Cartoes
