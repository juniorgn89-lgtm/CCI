import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { ShieldCheck, AlertTriangle, Fuel, History, Info, LineChart as LineChartIcon } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import HeaderHint from '@/components/tables/HeaderHint'
import InfoHint from '@/components/ui/InfoHint'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatLiters, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useChartTheme } from '@/lib/chartTheme'
import useComplianceMargens, { type CmpRow, type StatusFaixa } from '@/pages/Compliance/hooks/useComplianceMargens'

/* ─── Formatação ─── */

/** Preço unitário em R$/L com 3 casas (padrão de bomba). Ex.: "R$ 6,199". */
const formatPrecoLitro = (value: number): string =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`

/** Percentual pt-BR com sinal. Ex.: "+12,50%". */
const formatPct = (v: number): string => {
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${Math.abs(v).toFixed(2).replace('.', ',')}%`
}

const marginColor = (v: number): string => {
  if (v > 0) return 'text-emerald-600 dark:text-emerald-400'
  if (v < 0) return 'text-red-600 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
}

/* ─── Status por faixa (chip) ─── */

const STATUS_META: Record<StatusFaixa, { label: string; cls: string }> = {
  verde: { label: 'Verde', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  amarelo: { label: 'Amarelo', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  laranja: { label: 'Laranja', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' },
  vermelho: { label: 'Vermelho', cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
}

const StatusChip = ({ status, desvioPct }: { status: StatusFaixa; desvioPct: number | null }) => {
  const meta = STATUS_META[status]
  const d = desvioPct ?? 0
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', meta.cls)}>
      {meta.label} · {sign}{Math.abs(Math.round(d))}%
    </span>
  )
}

/* ─── Skeletons ─── */

const TableSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  </div>
)

/* ─── Estados vazios ─── */

const EmptyState = ({ icon: Icon, message }: { icon: typeof Fuel; message: string }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900/40">
    <Icon className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
    <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
  </div>
)

/* ─── Célula de valor ou traço ─── */

const NullableCell = ({ value, render }: { value: number | null; render: (v: number) => string }) =>
  value === null ? <span className="text-gray-300 dark:text-gray-600">—</span> : <>{render(value)}</>

/* ─── Tabela 1 — CMP por combustível ─── */

const MutedDash = () => <span className="text-gray-300 dark:text-gray-600">—</span>

const CmpTable = ({ rows, umPosto }: { rows: CmpRow[]; umPosto: boolean }) => (
  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <table className="w-full min-w-[720px] text-sm">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-100 text-xs uppercase text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
          <HeaderHint label="Combustível" help="Produto marcado como combustível no cadastro (produto.combustivel)." align="left" />
          <HeaderHint label="Qtd comprada" help="Volume total comprado no período, somando os itens das notas de entrada (/COMPRA_ITEM)." sub="litros" />
          <HeaderHint label="Nº notas" help="Quantidade de notas de compra distintas (compraCodigo) no período." />
          <HeaderHint label="CMP" help="Custo médio ponderado = Σ(quantidade × preço de custo) ÷ Σ(quantidade). Nunca só o último preço." sub="R$/L" groupStart />
          <HeaderHint label="Placa vigente" help="Preço à vista (coluna A) da troca de preço realizada mais recente no período. Provável placa à vista — confirmar com o WebPosto." sub="R$/L · col. A" />
          <HeaderHint label="Margem regulatória" help="Placa vigente − CMP. Margem SEM promoções/descontos — não é a margem operacional." sub="R$/L" groupStart />
          <HeaderHint label="Margem %" help="Margem regulatória ÷ placa vigente × 100." />
          <HeaderHint label="Status" help="Desvio da margem ATUAL vs. a MÉDIA das trocas do período. Faixas fixas (Fase 1): |desvio| < 20% Verde · 20–40% Amarelo · 40–70% Laranja · > 70% Vermelho. Configurável na Fase 2." align="center" groupStart />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((r) => (
          <tr key={r.produtoCodigo} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
            <td className="px-3 py-2.5 text-left font-medium text-gray-800 dark:text-gray-200">
              <span className="inline-flex items-center gap-2">
                <Fuel className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                {r.nome}
              </span>
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
              {r.qtdComprada > 0 ? formatLiters(r.qtdComprada) : <span className="text-gray-300 dark:text-gray-600">—</span>}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
              {r.numNotas > 0 ? formatNumber(r.numNotas) : <span className="text-gray-300 dark:text-gray-600">—</span>}
            </td>
            <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
              <NullableCell value={r.cmp} render={formatPrecoLitro} />
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
              {!umPosto || r.placaVigente === null ? (
                <MutedDash />
              ) : (
                <span className="inline-flex items-center justify-end gap-1">
                  {formatPrecoLitro(r.placaVigente)}
                  {r.placaData && (
                    <InfoHint text={`Troca de preço de ${formatDate(r.placaData)}. Colunas B/C: ${r.placaB !== null ? formatPrecoLitro(r.placaB) : '—'} / ${r.placaC !== null ? formatPrecoLitro(r.placaC) : '—'}.`} />
                  )}
                </span>
              )}
            </td>
            <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums font-semibold dark:border-gray-700">
              {!umPosto || r.margemAbs === null ? (
                <MutedDash />
              ) : (
                <span className={marginColor(r.margemAbs)}>{formatPrecoLitro(r.margemAbs)}</span>
              )}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums font-medium">
              {!umPosto || r.margemPct === null ? (
                <MutedDash />
              ) : (
                <span className={marginColor(r.margemPct)}>{formatPct(r.margemPct)}</span>
              )}
            </td>
            <td className="border-l border-gray-200 px-3 py-2.5 text-center dark:border-gray-700">
              {!umPosto || r.statusFaixa === null ? (
                <MutedDash />
              ) : (
                <StatusChip status={r.statusFaixa} desvioPct={r.desvioPct} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

/* ─── Gráfico — Placa × Margem ao longo do período ─── */

const MargemChart = ({ serie }: { serie: CmpRow['serie'] }) => {
  const ct = useChartTheme()
  const data = serie.map((p) => ({ data: formatDate(p.data), placa: p.placa, margem: p.margem }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} strokeOpacity={0.5} />
        <XAxis dataKey="data" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} />
        <YAxis
          width={82}
          tick={{ fontSize: 10, fill: ct.axis }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatPrecoLitro(v)}
        />
        <Tooltip
          formatter={((value: number | null, name: string) =>
            [value == null ? '—' : formatPrecoLitro(value), name]) as never}
          contentStyle={{ fontSize: 12, borderRadius: 8, ...ct.tooltip }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Line
          type="stepAfter"
          dataKey="placa"
          name="Placa (R$/L)"
          stroke={ct.accent}
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="stepAfter"
          dataKey="margem"
          name="Margem (R$/L)"
          stroke="#d97706"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#d97706' }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ─── Seção do gráfico (só com 1 posto) ─── */

const MargemChartSection = ({ rows }: { rows: CmpRow[] }) => {
  // Combustíveis "graficáveis": ≥2 pontos de troca no período.
  const chartRows = useMemo(() => rows.filter((r) => r.serie.length >= 2), [rows])
  const [selected, setSelected] = useState<number | null>(null)
  // Default = combustível com mais litros (rows já vem ordenada por qtdComprada).
  // Deriva sem effect: cai no 1º elegível quando a seleção some por filtro.
  const active = selected !== null && chartRows.some((r) => r.produtoCodigo === selected)
    ? selected
    : chartRows[0]?.produtoCodigo ?? null
  const activeRow = chartRows.find((r) => r.produtoCodigo === active) ?? null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <LineChartIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Placa × margem ao longo do período</h2>
        <InfoHint text="Evolução do preço de placa (à vista) e da margem regulatória (placa − CMP) a cada troca de preço do período. A margem usa o CMP ponderado do período como custo de referência." />
      </div>

      {chartRows.length === 0 || activeRow === null ? (
        <EmptyState
          icon={LineChartIcon}
          message="Poucas trocas de preço no período — o gráfico precisa de pelo menos 2 pontos por combustível."
        />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {/* Seletor de combustível (chips) */}
          <div className="mb-4 flex flex-wrap gap-2">
            {chartRows.map((r) => (
              <button
                key={r.produtoCodigo}
                type="button"
                onClick={() => setSelected(r.produtoCodigo)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  r.produtoCodigo === active
                    ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:border-blue-500 dark:bg-blue-600'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60',
                )}
              >
                <Fuel className="h-3.5 w-3.5 shrink-0" />
                {r.nome}
              </button>
            ))}
          </div>
          <MargemChart serie={activeRow.serie} />
        </div>
      )}
    </section>
  )
}

/* ─── Página ─── */

const Compliance = () => {
  const { cmpRows, trocaLog, scopedCount, isLoading, error } = useComplianceMargens()
  // Placa (e portanto a margem) é POR POSTO — só faz sentido com 1 posto no
  // escopo. Em vários, a placa "mais recente" seria de um posto qualquer, então
  // escondemos placa/margem (mostra só o CMP, que é agregável).
  const umPosto = scopedCount === 1

  return (
    <div className="space-y-6">
      <PageHeaderTitle placement="header">
        <div className="flex items-center gap-2.5">
          <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
          <ShieldCheck className="h-5 w-5 shrink-0 text-[#1e3a5f] dark:text-gray-300" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
              Compliance ANP · Validação
            </h1>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Margem regulatória (placa − CMP) reconstruída de dados GET · spike
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Disclaimer honesto — spike de validação. */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="space-y-1 text-[13px] leading-relaxed text-amber-800 dark:text-amber-200">
            <p className="font-semibold">Validação / spike — não é número oficial ainda.</p>
            <p>
              Confirme com o WebPosto e crave qual coluna (A/B/C) é a placa à vista antes de tratar como
              oficial. A margem <strong>REGULATÓRIA</strong> (placa − CMP, sem promoções nem descontos)
              não é a mesma coisa que a margem <strong>operacional</strong> do dia a dia. O objetivo desta
              tela é reconciliar os números contra o ERP.
            </p>
            <p>
              O <strong>preço de placa é por posto</strong> — <strong>selecione um posto</strong> pra ver
              placa e margem. Com vários postos, mostramos só o CMP consolidado (a margem sairia
              enganosa, misturando a placa de um posto com o custo da rede).
            </p>
            <p>
              O <strong>Status</strong> compara a margem atual com a <strong>média das trocas do período
              selecionado</strong> (ainda NÃO uma média histórica de 365 dias — isso vem na próxima etapa),
              e os <strong>limites de faixa são fixos</strong> (20/40/70%, configuráveis na Fase 2). O
              <strong> CMP é ponderado do período</strong> (não um custo diário por estoque). São escolhas
              de modelo v1 — uma cor aqui NÃO é veredito oficial da ANP.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <EmptyState icon={AlertTriangle} message="Erro ao carregar os dados de compra e troca de preço. Tente atualizar." />
      ) : (
        <>
          {/* Tabela 1 — CMP por combustível */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Fuel className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">CMP por combustível</h2>
              <InfoHint text="Custo médio ponderado das notas de compra do período × preço de placa vigente = margem regulatória prévia por produto." />
            </div>
            {!isLoading && !umPosto && cmpRows.length > 0 && (
              <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Vários postos no escopo — placa e margem estão ocultas (são por posto). Selecione um posto pra vê-las.
              </p>
            )}
            {isLoading ? (
              <TableSkeleton />
            ) : cmpRows.length === 0 ? (
              <EmptyState icon={Fuel} message="Sem compras de combustível nem trocas de preço no período/escopo selecionado." />
            ) : (
              <CmpTable rows={cmpRows} umPosto={umPosto} />
            )}
          </section>

          {/* Gráfico — Placa × Margem (só com 1 posto no escopo) */}
          {!isLoading && umPosto && cmpRows.length > 0 && <MargemChartSection rows={cmpRows} />}

          {/* Tabela 2 — Log de troca de preço */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Log de troca de preço</h2>
              <InfoHint text="Trilha de auditoria (/TROCA_PRECO): cada alteração de preço realizada no período, do mais recente pro mais antigo." />
            </div>
            {isLoading ? (
              <TableSkeleton />
            ) : trocaLog.length === 0 ? (
              <EmptyState icon={History} message="Nenhuma troca de preço de combustível registrada no período/escopo selecionado." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-100 text-xs uppercase text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
                      <HeaderHint label="Data / hora" help="Data e hora da troca de preço." align="left" />
                      <HeaderHint label="Combustível" help="Produto de combustível alterado." align="left" />
                      <HeaderHint label="Preço A" help="Preço à vista (coluna A) antes → depois da troca." sub="antigo → novo" groupStart />
                      <HeaderHint label="Custo no momento" help="Custo do produto registrado na troca de preço." sub="R$/L" groupStart />
                      <HeaderHint label="Markup %" help="Markup da coluna A registrado no momento da troca." />
                      <HeaderHint label="Turno" help="Turno em que a troca foi lançada." align="center" groupStart />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {trocaLog.map((r) => (
                      <tr key={r.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-3 py-2.5 text-left tabular-nums text-gray-700 dark:text-gray-300">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{r.data ? formatDate(r.data) : '—'}</span>
                          {r.hora && <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{r.hora.slice(0, 5)}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-left font-medium text-gray-800 dark:text-gray-200">{r.nome}</td>
                        <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums dark:border-gray-700">
                          <span className="text-gray-400 line-through dark:text-gray-500">{formatPrecoLitro(r.precoA)}</span>
                          <span className={cn('ml-2 font-semibold', r.novoPrecoA >= r.precoA ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                            {formatPrecoLitro(r.novoPrecoA)}
                          </span>
                        </td>
                        <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums text-gray-700 dark:border-gray-700 dark:text-gray-300">
                          {r.custo > 0 ? formatPrecoLitro(r.custo) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {r.percMarkupA ? `${r.percMarkupA.toFixed(2).replace('.', ',')}%` : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="border-l border-gray-200 px-3 py-2.5 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
                          {r.turno || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Rodapé de fonte */}
          <p className="flex items-center gap-1.5 pt-1 text-[11px] text-gray-400 dark:text-gray-500">
            <Info className="h-3 w-3 shrink-0" />
            Fonte: /COMPRA_ITEM + /TROCA_PRECO (GET). Read-only.
          </p>
        </>
      )}
    </div>
  )
}

export default Compliance
