import { useMemo, useState } from 'react'
import { Scale, TrendingDown, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import TableSkeleton from '@/components/feedback/TableSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import EmptyState from '@/components/feedback/EmptyState'
import CartaoDetalheModal from '@/pages/FechamentoCaixa/components/CartaoDetalheModal'
import useCartaoBreakdown from '@/pages/FechamentoCaixa/hooks/useCartaoBreakdown'
import useDiferencasCaixa, { type RespRow, type TopCaixaRow } from '@/pages/CaixasTurnos/hooks/useDiferencasCaixa'

const EPS = 0.005
const fmtBRDate = (iso: string): string => (iso ? iso.split('-').reverse().join('/') : '-')
/** "01 Mai" — dia + mês curto pro eixo do gráfico. */
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const fmtDiaMes = (iso: string): string => {
  const [, m, d] = iso.split('-')
  return `${d} ${MES[parseInt(m, 10) - 1] ?? m}`
}

/** R$ assinado: positivo ganha "+", negativo já vem com "−" do Intl. */
const fmtSigned = (v: number): string => (v > EPS ? `+${formatCurrency(v)}` : formatCurrency(v))
/** Classe de cor pelo sinal (falta=vermelho, sobra=verde, zero=cinza). */
const signColor = (v: number): string =>
  v < -EPS ? 'text-[#b91c1c] dark:text-red-400'
    : v > EPS ? 'text-[#047857] dark:text-emerald-400'
      : 'text-gray-500 dark:text-gray-400'

type OrdResp = 'liquido' | 'faltas' | 'sobras' | 'caixas'
const ORD_LABEL: Record<OrdResp, string> = {
  liquido: 'diferença líquida', faltas: 'faltas', sobras: 'sobras', caixas: 'nº de caixas',
}

/* ── KPI base ── */
const KpiBase = ({ navy, border, children }: { navy?: boolean; border?: string; children: React.ReactNode }) => (
  <div className={cn(
    'flex flex-col rounded-2xl border p-5 shadow-sm',
    navy
      ? 'border-[#1e3a5f]/30 bg-gradient-to-br from-[#1e3a5f] to-[#27496f]'
      : cn('bg-white dark:bg-gray-900', border ?? 'border-gray-200 dark:border-gray-700'),
  )}>
    {children}
  </div>
)
const Chip = ({ Icon, bg, color }: { Icon: typeof Scale; bg: string; color: string }) => (
  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', bg)}>
    <Icon className={cn('h-5 w-5', color)} />
  </div>
)

/* ── Barra divergente (responsável) ── */
const DivergentBar = ({ valor, maxAbs }: { valor: number; maxAbs: number }) => {
  const pct = maxAbs > 0 ? (Math.abs(valor) / maxAbs) * 100 : 0
  return (
    <div className="flex h-[18px] w-[180px] items-stretch">
      <div className="flex flex-1 justify-end overflow-hidden">
        {valor < -EPS && <div className="rounded-l-sm bg-[#ef4444]" style={{ width: `${pct}%` }} />}
      </div>
      <div className="w-px shrink-0 bg-[#cbd5e1] dark:bg-gray-600" />
      <div className="flex flex-1 overflow-hidden">
        {valor > EPS && <div className="rounded-r-sm bg-[#22c55e]" style={{ width: `${pct}%` }} />}
      </div>
    </div>
  )
}

const DiferencasCaixa = () => {
  const { dataInicial, dataFinal } = useFilterStore()
  const data = useDiferencasCaixa()
  const { kpis, porResponsavel, porForma, naoConferidoCount, porDia, topCaixas, isLoading, hasEmpresa } = data

  const [ordResp, setOrdResp] = useState<OrdResp>('liquido')
  const [piorPrimeiro, setPiorPrimeiro] = useState(true)
  const [ocultarSemDif, setOcultarSemDif] = useState(false)

  // Modal de cartão — escopo contextual (período inteiro ou um caixa).
  const [cartaoOpen, setCartaoOpen] = useState(false)
  const [cartaoCaixas, setCartaoCaixas] = useState<number[]>([])
  const [cartaoPdv, setCartaoPdv] = useState<Map<number, string>>(() => new Map())
  const cartao = useCartaoBreakdown(cartaoCaixas, cartaoPdv, cartaoOpen)

  const abrirCartaoPeriodo = () => {
    setCartaoCaixas(data.caixaCodigos)
    setCartaoPdv(data.pdvByCaixa)
    setCartaoOpen(true)
  }
  const abrirCartaoCaixa = (c: TopCaixaRow) => {
    setCartaoCaixas([c.caixaCodigo])
    setCartaoPdv(new Map([[c.caixaCodigo, c.pdvLabel]]))
    setCartaoOpen(true)
  }

  const respSorted = useMemo(() => {
    const val = (r: RespRow) => ordResp === 'liquido' ? r.liquido : ordResp === 'faltas' ? r.faltas : ordResp === 'sobras' ? r.sobras : r.caixas
    return porResponsavel
      .filter((r) => !ocultarSemDif || Math.abs(r.liquido) > EPS || r.sobras > EPS || r.faltas < -EPS)
      .sort((a, b) => (piorPrimeiro ? val(a) - val(b) : val(b) - val(a)))
  }, [porResponsavel, ordResp, piorPrimeiro, ocultarSemDif])

  const maxAbsResp = useMemo(() => Math.max(...respSorted.map((r) => Math.abs(r.liquido)), 0), [respSorted])
  const maxAbsDia = useMemo(() => Math.max(...porDia.map((d) => Math.abs(d.valor)), 0), [porDia])
  const maxForma = useMemo(() => Math.max(...porForma.map((f) => Math.abs(f.valor)), 0), [porForma])
  const dominante = useMemo(() => porForma.filter((f) => !f.isNaoConferido).sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))[0], [porForma])

  const periodoLabel = `${formatDate(dataInicial)} – ${formatDate(dataFinal)}`
  const pctComDif = kpis.totalConferidos > 0 ? Math.round((kpis.comDiferenca / kpis.totalConferidos) * 100) : 0

  /* ── Estados ── */
  if (!hasEmpresa) return <SelectCompanyState />
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
        <TableSkeleton rows={8} showHeader />
      </div>
    )
  }
  if (kpis.totalConferidos === 0) {
    return (
      <EmptyState
        title="Sem caixas fechados no período"
        description="Não há caixas conferidos para apurar sobras e faltas. Ajuste o período ou aguarde o fechamento."
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* ── 4 KPI cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1 · Diferença líquida (navy) */}
        <KpiBase navy>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white">Diferença líquida</p>
              <p className="text-[11px] uppercase tracking-wide text-white/60">Sobras − Faltas</p>
            </div>
            <Chip Icon={Scale} bg="bg-white/15" color="text-white/90" />
          </div>
          <p className={cn('mt-3 text-3xl font-bold tabular-nums',
            kpis.liquida < -EPS ? 'text-[#fca5a5]' : kpis.liquida > EPS ? 'text-[#6ee7b7]' : 'text-white')}>
            {fmtSigned(kpis.liquida)}
          </p>
          <div className="mt-auto border-t border-white/15 pt-3">
            <span className="text-[11px] text-white/60">{periodoLabel}</span>
          </div>
        </KpiBase>

        {/* 2 · Faltas */}
        <KpiBase border="border-[#fecaca] dark:border-red-900/40">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Faltas</p>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Dinheiro a menos</p>
            </div>
            <Chip Icon={TrendingDown} bg="bg-[#fee2e2] dark:bg-red-900/30" color="text-[#dc2626] dark:text-red-400" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[#b91c1c] dark:text-red-400">{formatCurrency(kpis.faltas)}</p>
          <div className="mt-auto border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-[11px] text-gray-400">em {kpis.faltasCount} {kpis.faltasCount === 1 ? 'caixa' : 'caixas'}</span>
          </div>
        </KpiBase>

        {/* 3 · Sobras */}
        <KpiBase border="border-[#bbf7d0] dark:border-emerald-900/40">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Sobras</p>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Dinheiro a mais</p>
            </div>
            <Chip Icon={TrendingUp} bg="bg-[#dcfce7] dark:bg-emerald-900/30" color="text-[#16a34a] dark:text-emerald-400" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-[#15803d] dark:text-emerald-400">{fmtSigned(kpis.sobras)}</p>
          <div className="mt-auto border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-[11px] text-gray-400">em {kpis.sobrasCount} {kpis.sobrasCount === 1 ? 'caixa' : 'caixas'}</span>
          </div>
        </KpiBase>

        {/* 4 · Caixas com diferença */}
        <KpiBase>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Caixas com diferença</p>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">No período</p>
            </div>
            <Chip Icon={AlertTriangle} bg="bg-[#fef3c7] dark:bg-amber-900/30" color="text-[#d97706] dark:text-amber-400" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {kpis.comDiferenca}<span className="text-lg font-semibold text-gray-400"> / {kpis.totalConferidos}</span>
          </p>
          <div className="mt-auto border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-[11px] text-gray-400">{pctComDif}% dos caixas conferidos</span>
          </div>
        </KpiBase>
      </div>

      {/* ── Diferença por dia ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Diferença por dia</h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Sobra (verde) acima · falta (vermelho) abaixo da linha</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#22c55e]" /> sobra</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#ef4444]" /> falta</span>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex h-24 items-stretch gap-px border-y border-dashed border-gray-200 dark:border-gray-700">
            {porDia.map((d) => {
              const pct = maxAbsDia > 0 ? (Math.abs(d.valor) / maxAbsDia) * 100 : 0
              return (
                <div key={d.dia} className="flex flex-1 flex-col" title={`${fmtBRDate(d.dia)}: ${fmtSigned(d.valor)}`}>
                  <div className="flex flex-1 items-end justify-center">
                    {d.valor > EPS && <div className="w-2/3 rounded-t-sm bg-[#22c55e]" style={{ height: `${pct}%` }} />}
                  </div>
                  <div className="h-px shrink-0 bg-[#cbd5e1] dark:bg-gray-600" />
                  <div className="flex flex-1 items-start justify-center">
                    {d.valor < -EPS && <div className="w-2/3 rounded-b-sm bg-[#ef4444]" style={{ height: `${pct}%` }} />}
                  </div>
                </div>
              )
            })}
          </div>
          {porDia.length > 0 && (
            <div className="mt-1.5 flex justify-between text-[10px] text-gray-400">
              <span>{fmtDiaMes(porDia[0].dia)}</span>
              {porDia.length > 2 && <span>{fmtDiaMes(porDia[Math.floor(porDia.length / 2)].dia)}</span>}
              <span>{fmtDiaMes(porDia[porDia.length - 1].dia)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Por responsável + Onde está a diferença ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
        {/* Por responsável */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div>
              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Diferença por responsável</h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Ordenado por {ORD_LABEL[ordResp]} · saldo de sobras e faltas</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['liquido', 'faltas', 'sobras', 'caixas'] as OrdResp[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOrdResp(o)}
                  className={cn('rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                    ordResp === o ? 'bg-[#1e3a5f] text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800')}
                >
                  {o === 'liquido' ? 'Líquido' : o === 'faltas' ? 'Faltas' : o === 'sobras' ? 'Sobras' : 'Caixas'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPiorPrimeiro((v) => !v)}
                className={cn('rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  piorPrimeiro ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800')}
                title="Pior (mais negativo) no topo"
              >
                pior 1º
              </button>
              <button
                type="button"
                onClick={() => setOcultarSemDif((v) => !v)}
                className={cn('rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  ocultarSemDif ? 'bg-[#1e3a5f] text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800')}
                title="Ocultar quem não tem diferença"
              >
                ocultar zerados
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#f3f4f6] text-[11px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                  <th className="px-5 py-2.5 text-left font-semibold">Responsável</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Caixas</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Saldo</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {respSorted.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">Nenhum responsável com diferença.</td></tr>
                ) : respSorted.map((r, i) => (
                  <tr key={r.nome} className={cn('border-t border-gray-100 transition-colors hover:bg-[#eff6ff] dark:border-gray-800 dark:hover:bg-blue-950/20', i % 2 === 1 && 'bg-[#f9fafb] dark:bg-gray-800/20')}>
                    <td className="px-5 py-2.5 font-medium text-gray-900 dark:text-gray-100">{r.nome}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{r.caixas}</td>
                    <td className="px-4 py-2.5"><DivergentBar valor={r.liquido} maxAbs={maxAbsResp} /></td>
                    <td className={cn('px-4 py-2.5 text-right font-bold tabular-nums', signColor(r.liquido))}>{fmtSigned(r.liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Onde está a diferença (por forma) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Onde está a diferença</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Diferença líquida por forma de pagamento</p>
          {porForma.length === 0 ? (
            <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">Sem diferença por forma no período.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {porForma.map((f) => {
                const pct = maxForma > 0 ? (Math.abs(f.valor) / maxForma) * 100 : 0
                const clickable = f.isCartao
                return (
                  <div
                    key={f.nome}
                    className={cn('rounded-lg px-1 py-0.5', clickable && 'cursor-pointer hover:bg-[#f9fafb] dark:hover:bg-gray-800/40')}
                    onClick={clickable ? abrirCartaoPeriodo : undefined}
                    title={clickable ? 'Ver débito/crédito por bandeira' : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                        <span className="truncate">{f.nome}</span>
                        {clickable && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[#eff6ff] px-1 py-0.5 text-[9px] font-semibold text-[#2563eb] dark:bg-blue-900/30 dark:text-blue-300">
                            detalhar <ChevronRight className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </span>
                      <span className={cn('shrink-0 text-xs font-bold tabular-nums', f.isNaoConferido ? 'text-gray-500 dark:text-gray-400' : signColor(f.valor))}>{fmtSigned(f.valor)}</span>
                    </div>
                    <div className="mt-1 h-[9px] w-full overflow-hidden rounded-full bg-[#f3f4f6] dark:bg-gray-800">
                      <div
                        className={cn('h-full rounded-full', f.isNaoConferido ? 'bg-gray-300 dark:bg-gray-600' : f.valor < -EPS ? 'bg-[#ef4444]' : 'bg-[#22c55e]')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {naoConferidoCount > 0 && (
            <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
              {naoConferidoCount} {naoConferidoCount === 1 ? 'caixa' : 'caixas'} sem detalhamento por forma (agrupado em “Não conferido”).
            </p>
          )}
          {dominante && dominante.nome.toUpperCase().includes('DINHEIRO') && dominante.valor < -EPS && (
            <p className="mt-1 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
              Concentração em <strong className="text-gray-700 dark:text-gray-300">Dinheiro</strong> sugere falha de troco/sangria — foco da conferência.
            </p>
          )}
        </div>
      </div>

      {/* ── Caixas com maior diferença ── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Caixas com maior diferença</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Maiores divergências do período · por valor absoluto</p>
        </div>
        {topCaixas.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">Nenhum caixa com diferença no período. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#f3f4f6] text-[11px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                  <th className="px-5 py-2.5 text-left font-semibold">Data</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Turno</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Caixa</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Responsável</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Forma</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Apurado</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {topCaixas.map((c, i) => (
                  <tr key={c.key} className={cn('border-t border-gray-100 transition-colors hover:bg-[#eff6ff] dark:border-gray-800 dark:hover:bg-blue-950/20', i % 2 === 1 && 'bg-[#f9fafb] dark:bg-gray-800/20')}>
                    <td className="px-5 py-2.5 tabular-nums text-gray-500 dark:text-gray-400">{fmtBRDate(c.data)}</td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{c.turno}</td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-500 dark:text-gray-400">{c.caixaLabel}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{c.responsavel}</td>
                    <td className="px-4 py-2.5">
                      {c.forma == null ? (
                        <span className="text-gray-400">—</span>
                      ) : c.isCartao ? (
                        <button
                          type="button"
                          onClick={() => abrirCartaoCaixa(c)}
                          className="rounded-md bg-[#eff6ff] px-2 py-0.5 text-[11px] font-medium text-[#2563eb] hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                          title="Ver débito/crédito por bandeira"
                        >
                          {c.forma}
                        </button>
                      ) : (
                        <span className="rounded-md bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-medium text-[#4b5563] dark:bg-gray-800 dark:text-gray-300">{c.forma}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(c.apurado)}</td>
                    <td className={cn('px-4 py-2.5 text-right font-bold tabular-nums', signColor(c.diferenca))}>{fmtSigned(c.diferenca)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CartaoDetalheModal
        open={cartaoOpen}
        onClose={() => setCartaoOpen(false)}
        linhas={cartao.linhas}
        total={cartao.total}
        pdvs={cartao.pdvs}
        isLoading={cartao.isLoading}
      />
    </div>
  )
}

export default DiferencasCaixa
