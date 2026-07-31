import { Fragment, useMemo, useState } from 'react'
import { Droplets, AlertTriangle, Fuel, ChevronDown, ChevronUp, ChevronRight, CircleDollarSign, LineChart, Trophy, Warehouse, Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLiters, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import BarCell from '@/components/tables/BarCell'
import type { PostoOption } from '@/components/filters/PostoLocalSelect'
import useReabastecimento, { type ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'
import ReposicaoTabela from '@/pages/Dashboard/components/ReposicaoTabela'
import { aggregarPorProduto, calcularMaxes, type ReposicaoLinha } from '@/pages/Dashboard/components/reposicao'
import usePostosLitros from '@/pages/Operacao/hooks/usePostosLitros'

type StatusKind = 'critico' | 'atencao' | 'ok' | 'sem-dado'
type SortKey = 'nome' | 'litros' | 'faturamento' | 'reposicao' | 'status'
type DetailTab = 'bombas' | 'reabastecimento'

interface VgRow {
  codigo: number
  nome: string
  litros: number
  faturamento: number
  crit: number
  alerta: number
  ok: number
  tanques: number
  reposicao: number
  status: StatusKind
}

const STATUS_ORDER: Record<StatusKind, number> = { critico: 0, atencao: 1, ok: 2, 'sem-dado': 3 }
const STATUS_META: Record<StatusKind, { label: string; cls: string }> = {
  critico: { label: 'Crítico', cls: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' },
  atencao: { label: 'Atenção', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
  ok: { label: 'OK', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' },
  'sem-dado': { label: 'Sem tanque', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
}

interface Props {
  postos: PostoOption[]
  onOpenPosto: (codigo: number, tab?: DetailTab) => void
  /** Se o usuário pode ver Reabastecimento — controla a opção no menu "Analisar". */
  canReabastecimento: boolean
}

/**
 * Visão Geral da Operação — rede inteira no estilo da Central: cabeçalho
 * agrupado, heatmap e linha expansível (drill-down). Cada posto abre a reposição
 * por produto (mesma tabela do Reabastecimento) e traz um botão "Analisar" que
 * leva pra aba Bombas naquele posto. Só leitura, nunca inventa número:
 * combustível sem apuração aparece como "—".
 */
const VisaoGeralOperacao = ({ postos, onOpenPosto, canReabastecimento }: Props) => {
  const { byPosto, isLoading: fuelLoading, hasCache } = usePostosLitros()
  const { tanques, isLoading: tankLoading } = useReabastecimento({ includeDetalhes: true })

  const postoSet = useMemo(() => new Set(postos.map((p) => p.codigo)), [postos])

  // Tanques do escopo, agrupados por posto — base das linhas E do drill.
  const tanquesByPosto = useMemo(() => {
    const m = new Map<number, ReabastTanque[]>()
    for (const t of tanques) {
      if (!postoSet.has(t.empresaCodigo)) continue
      const arr = m.get(t.empresaCodigo) ?? []
      arr.push(t)
      m.set(t.empresaCodigo, arr)
    }
    return m
  }, [tanques, postoSet])

  // Reposição por produto por posto (drill) + máximos compartilhados (comparáveis).
  const linhasByPosto = useMemo(() => {
    const m = new Map<number, ReposicaoLinha[]>()
    for (const [cod, ts] of tanquesByPosto) m.set(cod, aggregarPorProduto(ts))
    return m
  }, [tanquesByPosto])
  const sharedMaxes = useMemo(
    () => calcularMaxes([...linhasByPosto.values()].map((linhas) => ({ linhas }))),
    [linhasByPosto],
  )

  const rows: VgRow[] = useMemo(() => {
    return postos.map((p) => {
      const fuel = byPosto.get(p.codigo)
      const ts = tanquesByPosto.get(p.codigo) ?? []
      let crit = 0, alerta = 0, ok = 0, reposicao = 0
      for (const t of ts) {
        if (t.nivel === 'critico') crit += 1
        else if (t.nivel === 'alerta') alerta += 1
        else ok += 1
        reposicao += t.necessidadeFimDoMes
      }
      const status: StatusKind = ts.length === 0
        ? 'sem-dado'
        : crit > 0 ? 'critico' : alerta > 0 ? 'atencao' : 'ok'
      return { codigo: p.codigo, nome: p.fantasia, litros: fuel?.litros ?? 0, faturamento: fuel?.faturamento ?? 0, crit, alerta, ok, tanques: ts.length, reposicao, status }
    })
  }, [postos, byPosto, tanquesByPosto])

  const totais = useMemo(() => ({
    litros: rows.reduce((s, r) => s + r.litros, 0),
    faturamento: rows.reduce((s, r) => s + r.faturamento, 0),
    postosCriticos: rows.filter((r) => r.crit > 0).length,
    reposicao: rows.reduce((s, r) => s + r.reposicao, 0),
    tanques: rows.reduce((s, r) => s + r.tanques, 0),
  }), [rows])

  const maxLitros = useMemo(() => Math.max(1, ...rows.map((r) => r.litros)), [rows])
  const topLitros = useMemo(() => (hasCache ? rows.reduce((mx, r) => Math.max(mx, r.litros), 0) : -1), [rows, hasCache])

  const [sortKey, setSortKey] = useState<SortKey>('litros')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(k); setSortDir(k === 'nome' ? 'asc' : 'desc') }
  }
  const rowsSorted = useMemo(() => {
    const arr = [...rows]
    const dir = sortDir === 'desc' ? -1 : 1
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'nome': return dir * a.nome.localeCompare(b.nome)
        case 'faturamento': return dir * (a.faturamento - b.faturamento)
        case 'reposicao': return dir * (a.reposicao - b.reposicao)
        case 'status': return dir * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * -1
        default: return dir * (a.litros - b.litros)
      }
    })
    return arr
  }, [rows, sortKey, sortDir])

  const [aberto, setAberto] = useState<Set<number>>(new Set())
  const toggleAberto = (cod: number) => setAberto((prev) => {
    const next = new Set(prev)
    if (next.has(cod)) next.delete(cod)
    else next.add(cod)
    return next
  })

  const loading = (fuelLoading || tankLoading) && rows.every((r) => r.litros === 0 && r.tanques === 0)
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const COLS = 7

  return (
    <div className="space-y-4">
      {/* Cards de rede — resposta primeiro */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RedeCard label="Litros vendidos" hint="Litros de combustível de toda a rede no período (base fiscal apurada)."
          value={hasCache ? formatLiters(totais.litros) : '—'} Icon={Droplets}
          tint="from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900" iconCls="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <RedeCard label="Faturamento combustível" hint="Venda bruta de combustível da rede no período."
          value={hasCache ? formatCurrencyInt(totais.faturamento) : '—'} Icon={CircleDollarSign}
          tint="from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900" iconCls="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <RedeCard label="Postos c/ tanque crítico" hint="Postos com pelo menos um tanque abaixo de 20% — risco de faltar produto na pista."
          value={`${totais.postosCriticos}`} sub={`de ${postos.length} ${postos.length === 1 ? 'posto' : 'postos'}`} Icon={AlertTriangle}
          tint={totais.postosCriticos > 0 ? 'from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900' : 'from-gray-50/60 to-white dark:from-gray-900 dark:to-gray-900'}
          iconCls={totais.postosCriticos > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'} />
        <RedeCard label="Reposição necessária" hint="Litros a comprar pra não zerar tanque, no ritmo de venda atual — até o fim do mês (ou os próximos 7 dias, o que for maior; assim não zera no último dia do mês)."
          value={formatLiters(totais.reposicao)} Icon={Fuel}
          tint="from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900" iconCls="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
      </div>

      {!hasCache && (
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Combustível sem apuração no período — litros e faturamento aparecem como "—". Tanques e reposição são ao vivo.
        </p>
      )}

      {/* Tabela por posto — estilo Central (grupos + heatmap + drill) */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Resumo por posto</h3>
          <InfoHint text="Cada linha = um posto. Clique na linha pra abrir a reposição por combustível; use Analisar pra ir ao detalhe (Bombas). Litros/faturamento vêm da apuração; tanques e reposição, ao vivo." />
        </div>
        <table className="w-full text-[13px]">
          <thead>
            {/* Linha de grupos */}
            <tr>
              <th className="py-1.5" />
              <GroupTh first label="Combustível" colSpan={2} />
              <GroupTh label="Tanques" colSpan={2} />
              <GroupTh label="Situação" colSpan={2} />
            </tr>
            {/* Linha de colunas */}
            <tr className="border-b border-gray-200 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:text-gray-500">
              <SortTh label="Posto" k="nome" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="py-2 pl-4 pr-3" />
              <SortTh label="Litros" k="litros" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="border-l border-gray-200 py-2 px-3 dark:border-gray-700" />
              <SortTh label="Faturamento" k="faturamento" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="py-2 px-3" />
              <th className="border-l border-gray-200 py-2 px-3 dark:border-gray-700">Por status</th>
              <SortTh label="Reposição" k="reposicao" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="py-2 px-3" />
              <SortTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="border-l border-gray-200 py-2 px-3 dark:border-gray-700" />
              <th className="py-2 pl-3 pr-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rowsSorted.map((r) => {
              const sm = STATUS_META[r.status]
              const isOpen = aberto.has(r.codigo)
              const linhas = linhasByPosto.get(r.codigo) ?? []
              return (
                <Fragment key={r.codigo}>
                  <tr onClick={() => toggleAberto(r.codigo)}
                    className="group cursor-pointer border-b border-gray-100 transition-colors hover:bg-blue-50/40 dark:border-gray-800 dark:hover:bg-blue-950/20">
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex items-center gap-2">
                        <ChevronRight className={cn('h-4 w-4 shrink-0 text-gray-300 transition-transform dark:text-gray-600', isOpen && 'rotate-90 text-[#2563eb] dark:text-blue-400')} />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{r.nome}</span>
                        {hasCache && r.litros === topLitros && r.litros > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                            <Trophy className="h-3 w-3" />Destaque
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border-l border-gray-100 px-2 py-1.5 dark:border-gray-800">
                      {hasCache
                        ? <BarCell value={r.litros} max={maxLitros} formatted={formatLiters(r.litros)} color="blue" align="near" maxWidthPct={70} />
                        : <span className="block px-1.5 text-right text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{hasCache ? formatCurrencyInt(r.faturamento) : '—'}</td>
                    <td className="border-l border-gray-100 px-3 py-2.5 dark:border-gray-800">
                      {r.tanques === 0 ? (
                        <span className="text-[11px] text-gray-400">—</span>
                      ) : (
                        <div className="flex items-center gap-2 text-[11px] tabular-nums">
                          {r.crit > 0 && <Dot cls="bg-red-500" n={r.crit} title="críticos" />}
                          {r.alerta > 0 && <Dot cls="bg-amber-500" n={r.alerta} title="em alerta" />}
                          {r.ok > 0 && <Dot cls="bg-emerald-500" n={r.ok} title="ok" />}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{r.reposicao > 0 ? formatLiters(r.reposicao) : '—'}</td>
                    <td className="border-l border-gray-100 px-3 py-2.5 dark:border-gray-800">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', sm.cls)}>{sm.label}</span>
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {canReabastecimento ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:border-[#2563eb] hover:text-[#2563eb] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-300">
                              <LineChart className="h-3.5 w-3.5" />Analisar<ChevronDown className="h-3 w-3 opacity-70" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2 text-[13px]" onSelect={() => onOpenPosto(r.codigo, 'bombas')}>
                              <Gauge className="h-3.5 w-3.5 text-gray-500" />Analisar em Bombas
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-[13px]" onSelect={() => onOpenPosto(r.codigo, 'reabastecimento')}>
                              <Fuel className="h-3.5 w-3.5 text-gray-500" />Ver no Reabastecimento
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <button type="button" onClick={() => onOpenPosto(r.codigo, 'bombas')}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:border-[#2563eb] hover:text-[#2563eb] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-300">
                          <LineChart className="h-3.5 w-3.5" />Analisar
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-gray-50/50 dark:bg-gray-800/20">
                      <td colSpan={COLS} className="px-4 py-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            <Warehouse className="h-3.5 w-3.5" />Reposição por combustível · {r.nome}
                          </p>
                          <div className="flex items-center gap-2">
                            {canReabastecimento && (
                              <button type="button" onClick={() => onOpenPosto(r.codigo, 'reabastecimento')}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition-colors hover:border-[#2563eb] hover:text-[#2563eb] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-300">
                                <Fuel className="h-3.5 w-3.5" />Ver tanques no Reabastecimento
                              </button>
                            )}
                            <button type="button" onClick={() => onOpenPosto(r.codigo, 'bombas')}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#2563eb] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2563eb] transition-colors hover:bg-blue-50 dark:border-blue-500 dark:bg-transparent dark:text-blue-300 dark:hover:bg-blue-950/30">
                              <LineChart className="h-3.5 w-3.5" />Analisar em Bombas
                            </button>
                          </div>
                        </div>
                        {linhas.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-[12px] text-gray-400 dark:border-gray-700">Sem tanques cadastrados neste posto.</p>
                        ) : (
                          <ReposicaoTabela linhas={linhas} maxes={sharedMaxes} />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr className="border-t border-gray-200 text-[13px] font-semibold dark:border-gray-700">
                <td className="py-2.5 pl-4 pr-3 text-gray-500 dark:text-gray-400">Rede · {rows.length} postos</td>
                <td className="border-l border-gray-100 px-3 py-2.5 text-right tabular-nums text-gray-900 dark:border-gray-800 dark:text-gray-100">{hasCache ? formatLiters(totais.litros) : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{hasCache ? formatCurrencyInt(totais.faturamento) : '—'}</td>
                <td className="border-l border-gray-100 px-3 py-2.5 text-[11px] text-gray-400 dark:border-gray-800">{formatNumber(totais.tanques)} tanques</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(totais.reposicao)}</td>
                <td className="border-l border-gray-100 px-3 py-2.5 dark:border-gray-800" colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th colSpan={colSpan} className={cn('bg-gray-100/60 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-transparent dark:text-gray-500', !first && 'border-l border-gray-200 dark:border-gray-700')}>
    {label}
  </th>
)

const RedeCard = ({ label, value, sub, hint, Icon, tint, iconCls }: {
  label: string; value: string; sub?: string; hint: string; Icon: typeof Droplets; tint: string; iconCls: string
}) => (
  <div className={cn('rounded-xl border border-gray-200 bg-gradient-to-br p-4 shadow-sm dark:border-gray-700', tint)}>
    <div className="flex items-center justify-between">
      <p className="flex items-center gap-1 text-[12px] font-medium text-gray-600 dark:text-gray-400">{label}<InfoHint text={hint} /></p>
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconCls)}><Icon className="h-4 w-4" /></div>
    </div>
    <p className="mt-2 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500">{sub}</p>}
  </div>
)

const Dot = ({ cls, n, title }: { cls: string; n: number; title: string }) => (
  <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300" title={`${n} ${title}`}>
    <span className={cn('h-2 w-2 rounded-full', cls)} />{n}
  </span>
)

const SortTh = ({ label, k, sortKey, sortDir, onSort, align, className }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc'; onSort: (k: SortKey) => void; align?: 'right'; className?: string
}) => {
  const active = sortKey === k
  return (
    <th className={cn(className, align === 'right' && 'text-right')}>
      <button type="button" onClick={() => onSort(k)}
        className={cn('inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-gray-600 dark:hover:text-gray-300',
          align === 'right' && 'flex-row-reverse', active ? 'text-[#2563eb] dark:text-blue-300' : '')}>
        {label}
        {active && (sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
      </button>
    </th>
  )
}

export default VisaoGeralOperacao
