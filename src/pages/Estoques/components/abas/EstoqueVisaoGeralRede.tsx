import { Fragment, useMemo, useState } from 'react'
import {
  Warehouse, Boxes, AlertTriangle, PackageX, ChevronDown, ChevronUp, ChevronRight,
  LineChart, Package, RefreshCw, ShoppingCart, TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { Skeleton } from '@/components/ui/skeleton'
import BarCell from '@/components/tables/BarCell'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { PostoOption } from '@/components/filters/PostoLocalSelect'
import useEstoqueRede, { type CriticoRow } from '@/pages/Estoques/hooks/useEstoqueRede'

type SortKey = 'nome' | 'valor' | 'skus' | 'abaixoMinimo' | 'emFalta' | 'negativos'
type DetailTab = 'geral' | 'giro' | 'necessidade'
type PostoStatus = 'critico' | 'atencao' | 'ok' | 'sem_dado'

interface VgRow {
  codigo: number
  nome: string
  hasData: boolean
  valor: number
  skus: number
  abaixoMinimo: number
  emFalta: number
  negativos: number
  status: PostoStatus
}

interface Props {
  postos: PostoOption[]
  onOpenPosto: (codigo: number, tab: DetailTab) => void
}

const classify = (r: { hasData: boolean; emFalta: number; negativos: number; abaixoMinimo: number }): PostoStatus => {
  if (!r.hasData) return 'sem_dado'
  if (r.emFalta > 0 || r.negativos > 0) return 'critico'
  if (r.abaixoMinimo > 0) return 'atencao'
  return 'ok'
}

/**
 * Visão Geral do Estoque — rede inteira no estilo Central: cards de rede +
 * tabela por posto RANQUEADA por valor em estoque (heatmap), linha expansível
 * com os produtos críticos do posto (drill) e menu Analisar que leva ao detalhe
 * (Estoque geral / Giro / Necessidade). Só leitura; estoque é ao vivo por posto
 * (sem cache) — posto sem retorno = "—".
 */
const EstoqueVisaoGeralRede = ({ postos, onOpenPosto }: Props) => {
  const { byPosto, criticosByPosto, isLoading, hasData } = useEstoqueRede(postos)

  const rows: VgRow[] = useMemo(() => postos.map((p) => {
    const d = byPosto.get(p.codigo)
    const base = {
      codigo: p.codigo,
      nome: p.fantasia,
      hasData: d != null,
      valor: d?.valor ?? 0,
      skus: d?.skus ?? 0,
      abaixoMinimo: d?.abaixoMinimo ?? 0,
      emFalta: d?.emFalta ?? 0,
      negativos: d?.negativos ?? 0,
    }
    return { ...base, status: classify(base) }
  }), [postos, byPosto])

  const totais = useMemo(() => ({
    valor: rows.reduce((s, r) => s + r.valor, 0),
    skus: rows.reduce((s, r) => s + r.skus, 0),
    abaixoMinimo: rows.reduce((s, r) => s + r.abaixoMinimo, 0),
    emFalta: rows.reduce((s, r) => s + r.emFalta, 0),
    negativos: rows.reduce((s, r) => s + r.negativos, 0),
  }), [rows])

  const maxValor = useMemo(() => Math.max(1, ...rows.map((r) => r.valor)), [rows])

  const [sortKey, setSortKey] = useState<SortKey>('valor')
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
        case 'skus': return dir * (a.skus - b.skus)
        case 'abaixoMinimo': return dir * (a.abaixoMinimo - b.abaixoMinimo)
        case 'emFalta': return dir * (a.emFalta - b.emFalta)
        case 'negativos': return dir * (a.negativos - b.negativos)
        default: return dir * (a.valor - b.valor)
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

  if (isLoading && !hasData) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-6 text-[13px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
          <TrendingDown className="h-4 w-4 shrink-0" />
          Sem dados de estoque para os postos do filtro.
        </p>
      </div>
    )
  }

  const COLS = 8

  return (
    <div className="space-y-4">
      {/* Cards de rede — resposta primeiro */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RedeCard label="Valor em estoque" hint="Quanto de dinheiro está parado em mercadoria na rede: soma de (saldo × custo) de todos os produtos controlados dos postos do filtro."
          value={formatCurrencyInt(totais.valor)} Icon={Warehouse}
          tint="from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900" iconCls="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <RedeCard label="SKUs" hint="Quantos produtos diferentes (com controle de estoque) estão em giro na rede — os que têm saldo ou venderam nos últimos meses."
          value={formatNumber(totais.skus)} Icon={Boxes}
          tint="from-indigo-50/60 to-white dark:from-indigo-950/20 dark:to-gray-900" iconCls="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" />
        <RedeCard label="Em falta" hint="Produtos zerados que ainda vendem — você está perdendo venda por falta de reposição. Repor o quanto antes."
          value={formatNumber(totais.emFalta)} Icon={PackageX}
          tint={totais.emFalta > 0 ? 'from-red-50/70 to-white dark:from-red-950/25 dark:to-gray-900' : 'from-gray-50/60 to-white dark:from-gray-900/40 dark:to-gray-900'}
          iconCls={totais.emFalta > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'} />
        <RedeCard label="Abaixo do mínimo" hint="Produtos com saldo abaixo do estoque mínimo cadastrado — sinal amarelo pra repor antes de zerar."
          value={formatNumber(totais.abaixoMinimo)} Icon={AlertTriangle}
          tint={totais.abaixoMinimo > 0 ? 'from-amber-50/70 to-white dark:from-amber-950/25 dark:to-gray-900' : 'from-gray-50/60 to-white dark:from-gray-900/40 dark:to-gray-900'}
          iconCls={totais.abaixoMinimo > 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'} />
      </div>

      {/* Tabela por posto — estilo Central (heatmap + drill) */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Estoque por posto</h3>
          <InfoHint text="Cada linha = um posto, ranqueado pelo valor parado em estoque. Clique na linha pra ver os produtos críticos; use Analisar pra ir ao detalhe do posto." />
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr>
              <th className="py-1.5" />
              <GroupTh first label="Capital" colSpan={1} />
              <GroupTh label="Saúde do estoque" colSpan={4} />
              <th className="py-1.5" colSpan={2} />
            </tr>
            <tr className="border-b border-gray-200 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:text-gray-500">
              <SortTh label="Posto" k="nome" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="py-2 pl-4 pr-3" />
              <SortTh label="Valor em estoque" k="valor" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="border-l border-gray-200 py-2 px-3 dark:border-gray-700" />
              <SortTh label="SKUs" k="skus" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="border-l border-gray-200 py-2 px-3 dark:border-gray-700" />
              <SortTh label="Abaixo do mín." k="abaixoMinimo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="py-2 px-3" />
              <SortTh label="Em falta" k="emFalta" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="py-2 px-3" />
              <SortTh label="Negativos" k="negativos" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" className="py-2 px-3" />
              <th className="border-l border-gray-200 py-2 px-3 text-center dark:border-gray-700">Status</th>
              <th className="py-2 pl-3 pr-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rowsSorted.map((r) => {
              const isOpen = aberto.has(r.codigo)
              const criticos = criticosByPosto.get(r.codigo) ?? []
              const semDado = !r.hasData
              return (
                <Fragment key={r.codigo}>
                  <tr onClick={() => toggleAberto(r.codigo)}
                    className="group cursor-pointer border-b border-gray-100 transition-colors hover:bg-blue-50/40 dark:border-gray-800 dark:hover:bg-blue-950/20">
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex items-center gap-2">
                        <ChevronRight className={cn('h-4 w-4 shrink-0 text-gray-300 transition-transform dark:text-gray-600', isOpen && 'rotate-90 text-[#2563eb] dark:text-blue-400')} />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{r.nome}</span>
                      </div>
                    </td>
                    <td className="border-l border-gray-100 px-2 py-1.5 dark:border-gray-800">
                      {semDado
                        ? <span className="block px-1.5 text-right text-gray-400">—</span>
                        : <BarCell value={r.valor} max={maxValor} formatted={formatCurrencyInt(r.valor)} color="blue" align="near" maxWidthPct={70} />}
                    </td>
                    <td className="border-l border-gray-100 px-3 py-2.5 text-right tabular-nums text-gray-700 dark:border-gray-800 dark:text-gray-200">{semDado ? '—' : formatNumber(r.skus)}</td>
                    <td className={cn('px-3 py-2.5 text-right tabular-nums', r.abaixoMinimo > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-200')}>{semDado ? '—' : formatNumber(r.abaixoMinimo)}</td>
                    <td className={cn('px-3 py-2.5 text-right tabular-nums', r.emFalta > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200')}>{semDado ? '—' : formatNumber(r.emFalta)}</td>
                    <td className={cn('px-3 py-2.5 text-right tabular-nums', r.negativos > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200')}>{semDado ? '—' : formatNumber(r.negativos)}</td>
                    <td className="border-l border-gray-100 px-3 py-2.5 text-center dark:border-gray-800"><StatusPill status={r.status} /></td>
                    <td className="py-2.5 pl-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:border-[#2563eb] hover:text-[#2563eb] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-300">
                            <LineChart className="h-3.5 w-3.5" />Analisar<ChevronDown className="h-3 w-3 opacity-70" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2 text-[13px]" onSelect={() => onOpenPosto(r.codigo, 'geral')}>
                            <Package className="h-3.5 w-3.5 text-gray-500" />Estoque geral
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-[13px]" onSelect={() => onOpenPosto(r.codigo, 'giro')}>
                            <RefreshCw className="h-3.5 w-3.5 text-gray-500" />Giro
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-[13px]" onSelect={() => onOpenPosto(r.codigo, 'necessidade')}>
                            <ShoppingCart className="h-3.5 w-3.5 text-gray-500" />Necessidade
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-gray-50/50 dark:bg-gray-800/20">
                      <td colSpan={COLS} className="px-4 py-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            <AlertTriangle className="h-3.5 w-3.5" />Produtos críticos · {r.nome}
                          </p>
                          <button type="button" onClick={() => onOpenPosto(r.codigo, 'necessidade')}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#2563eb] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#2563eb] transition-colors hover:bg-blue-50 dark:border-blue-500 dark:bg-transparent dark:text-blue-300 dark:hover:bg-blue-950/30">
                            <ShoppingCart className="h-3.5 w-3.5" />Analisar em Necessidade
                          </button>
                        </div>
                        {criticos.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-[12px] text-gray-400 dark:border-gray-700">Sem produtos críticos neste posto.</p>
                        ) : (
                          <CriticosTable rows={criticos} />
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
                <td className="border-l border-gray-100 px-3 py-2.5 text-right tabular-nums text-gray-900 dark:border-gray-800 dark:text-gray-100">{formatCurrencyInt(totais.valor)}</td>
                <td className="border-l border-gray-100 px-3 py-2.5 text-right tabular-nums text-gray-900 dark:border-gray-800 dark:text-gray-100">{formatNumber(totais.skus)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(totais.abaixoMinimo)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(totais.emFalta)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(totais.negativos)}</td>
                <td className="border-l border-gray-100 py-2.5 dark:border-gray-800" />
                <td className="py-2.5" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

/** Produtos críticos de um posto (drill) — saldo, mínimo e situação. */
const CriticosTable = ({ rows }: { rows: CriticoRow[] }) => (
  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
    <table className="w-full text-xs">
      <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-transparent dark:text-gray-400">
        <tr>
          <th className="px-3 py-2 text-left font-medium">Produto</th>
          <th className="px-3 py-2 text-left font-medium">Categoria</th>
          <th className="px-3 py-2 text-right font-medium">Saldo</th>
          <th className="px-3 py-2 text-right font-medium">Mínimo</th>
          <th className="px-3 py-2 text-right font-medium">Situação</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((r) => (
          <tr key={r.produtoCodigo} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
            <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{r.nome}</td>
            <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.categoria}</td>
            <td className={cn('px-3 py-2 text-right tabular-nums', r.saldo < 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300')}>{formatNumber(r.saldo)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{r.minimo > 0 ? formatNumber(r.minimo) : '—'}</td>
            <td className="px-3 py-2 text-right"><SituacaoBadge situacao={r.situacao} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const SituacaoBadge = ({ situacao }: { situacao: CriticoRow['situacao'] }) => {
  const cfg = {
    negativo: { label: 'Negativo', cls: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' },
    emFalta: { label: 'Em falta', cls: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' },
    abaixoMinimo: { label: 'Abaixo do mín.', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
  }[situacao]
  return <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold', cfg.cls)}>{cfg.label}</span>
}

const StatusPill = ({ status }: { status: PostoStatus }) => {
  if (status === 'sem_dado') return <span className="text-[12px] text-gray-400">—</span>
  const cfg = {
    critico: { label: 'Crítico', cls: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' },
    atencao: { label: 'Atenção', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
    ok: { label: 'OK', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' },
  }[status]
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', cfg.cls)}>{cfg.label}</span>
}

const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th colSpan={colSpan} className={cn('bg-gray-100/60 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-transparent dark:text-gray-500', !first && 'border-l border-gray-200 dark:border-gray-700')}>
    {label}
  </th>
)

const RedeCard = ({ label, value, hint, Icon, tint, iconCls }: {
  label: string; value: string; hint: string; Icon: typeof Warehouse; tint: string; iconCls: string
}) => (
  <div className={cn('rounded-xl border border-gray-200 bg-gradient-to-br p-4 shadow-sm dark:border-gray-700', tint)}>
    <div className="flex items-center justify-between">
      <p className="flex items-center gap-1 text-[12px] font-medium text-gray-600 dark:text-gray-400">{label}<InfoHint text={hint} /></p>
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconCls)}><Icon className="h-4 w-4" /></div>
    </div>
    <p className="mt-2 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
  </div>
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

export default EstoqueVisaoGeralRede
