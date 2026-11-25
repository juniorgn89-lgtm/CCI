import { useEffect, useRef, useState } from 'react'
import { Landmark, ArrowDownLeft, ArrowUpRight, TrendingUp, ChevronDown, AlertTriangle, Loader2, X, Search } from 'lucide-react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { cn } from '@/lib/utils'
import { formatCurrencyInt, formatCurrencyShort } from '@/lib/formatters'
import { useChartTheme } from '@/lib/chartTheme'
import InfoHint from '@/components/ui/InfoHint'
import useVisaoFinanceira from '@/pages/Financeiro/hooks/useVisaoFinanceira'
import useFechamentoMes from '@/pages/Dashboard/hooks/useFechamentoMes'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import ContasListaModal, { type ListaSel, type TomLista } from '@/pages/Dashboard/components/modais/ContasListaModal'
import type { Horizonte } from '@/pages/Dashboard/hooks/useContasResumo'

const FAIXA: Record<'vencidas' | 'hoje' | 'd7' | 'd30', { label: string; desc: string }> = {
  vencidas: { label: 'Vencidos', desc: 'Venceram antes de hoje e seguem em aberto' },
  hoje: { label: 'Vencem hoje', desc: 'Vencem hoje' },
  d7: { label: 'Próximos 7 dias', desc: 'Vencem de amanhã a 7 dias' },
  d30: { label: '8 a 30 dias', desc: 'Vencem de 8 a 30 dias' },
}

const card = 'rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[#2f3b4f] dark:bg-[#1e293b]'
const pctFmt = (v: number) => `${v.toFixed(1).replace('.', ',')}%`
const iniciais = (nome: string) => nome.replace(/[^A-Za-zÀ-ú ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '—'

/** Rótulo de valor das barras do fluxo, sempre do lado de fora da barra (nunca na linha do zero). */
const RotuloBarra = (props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: unknown; fora: 'cima' | 'baixo'; cor: string }) => {
  const v = Number(props.value ?? 0)
  if (!v) return null
  const x = Number(props.x ?? 0) + Number(props.width ?? 0) / 2
  const y = Number(props.y ?? 0)
  const h = Number(props.height ?? 0)
  // Barra negativa: o recharts pode mandar altura negativa; o fim da barra é o maior dos dois.
  const base = props.fora === 'cima' ? Math.min(y, y + h) - 6 : Math.max(y, y + h) + 14
  const texto = props.fora === 'cima' ? formatCurrencyShort(v) : `−${formatCurrencyShort(Math.abs(v))}`
  return <text x={x} y={base} textAnchor="middle" fontSize={11} fontWeight={600} fill={props.cor}>{texto}</text>
}

const Kpi = ({ titulo, valor, sub, Icone, hint, tom }: { titulo: string; valor: string; sub: React.ReactNode; Icone: typeof Landmark; hint: string; tom?: 'neg' | 'pos' }) => (
  <div className={cn(card, 'p-5')}>
    <div className="flex items-start justify-between gap-2">
      <p className="inline-flex items-center gap-1 text-[13px] text-gray-500 dark:text-[#94a3b8]">{titulo} <InfoHint text={hint} /></p>
      <Icone className="h-4 w-4 shrink-0 text-gray-400 dark:text-[#64748b]" />
    </div>
    <p className={cn('mt-2 text-[26px] font-bold tabular-nums leading-tight', tom === 'neg' ? 'text-red-600 dark:text-[#e3a3a3]' : 'text-gray-900 dark:text-[#f1f5f9]')}>{valor}</p>
    <p className="mt-2 text-[12.5px] text-gray-500 dark:text-[#94a3b8]">{sub}</p>
  </div>
)

/** Aba "Visão Financeira": o essencial do dinheiro da rede, simples, no modelo do Atlas. Só leitura. */
const VisaoFinanceira = () => {
  const v = useVisaoFinanceira()
  const mes = useFechamentoMes()
  const setores = useRedeSetores()
  const ct = useChartTheme()
  const [todasContas, setTodasContas] = useState(false)
  // Clicar num valor da tabela "O que entra e o que sai" abre os títulos daquela faixa.
  const [lista, setLista] = useState<ListaSel | null>(null)
  const abrirFaixa = (lado: 'receber' | 'pagar', h: 'vencidas' | 'hoje' | 'd7' | 'd30') => {
    const tom: TomLista = h === 'vencidas' ? (lado === 'receber' ? 'orange' : 'red') : h === 'hoje' ? 'amber' : h === 'd7' ? 'blue' : 'gray'
    setLista({ titulo: lado === 'pagar' ? 'Contas a pagar' : 'Contas a receber', subtitulo: FAIXA[h].desc, selo: FAIXA[h].label, tom, lado, itens: v.resumo.itens[lado].filter((i) => i.horizonte === (h as Horizonte)), filtro: { faixas: [h as Horizonte] } })
  }

  const negativas = v.contas.filter((c) => c.saldo < 0)
  const contasVisiveis = v.contas.slice(0, 6)
  const [buscaConta, setBuscaConta] = useState('')
  const painelRef = useRef<HTMLDivElement>(null)
  // "Ver todas" abre por cima (flutuante); fecha no X, no Esc ou clicando fora.
  useEffect(() => {
    if (!todasContas) return undefined
    const fora = (e: MouseEvent) => { if (painelRef.current && !painelRef.current.contains(e.target as Node)) setTodasContas(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setTodasContas(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [todasContas])
  const contasFiltradas = v.contas.filter((c) => !buscaConta.trim() || `${c.nome} ${c.posto}`.toLowerCase().includes(buscaConta.trim().toLowerCase()))
  const maxSaida = Math.max(1, ...v.saidasMes.map((s) => s.valor))
  const entradasSetor = [
    { nome: 'Combustível', valor: setores.combustivel.faturamento },
    { nome: 'Automotivos', valor: setores.automotivos.faturamento },
    { nome: 'Conveniência', valor: setores.conveniencia.faturamento },
  ].filter((s) => s.valor > 0)
  const maxEntrada = Math.max(1, ...entradasSetor.map((s) => s.valor))
  const totalSaidas = v.saidasMes.reduce((s, x) => s + x.valor, 0)
  const corEnt = ct.dark ? '#4f9d84' : '#2f855a'
  const corSai = ct.dark ? '#c07a7a' : '#c0392b'

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Saldo em contas" Icone={Landmark} tom={v.saldoContas < 0 ? 'neg' : undefined}
          valor={v.contasCarregando ? '…' : formatCurrencyInt(v.saldoContas)}
          sub={<>{v.contas.length} {v.contas.length === 1 ? 'conta' : 'contas'} · saldo no sistema (ERP)</>}
          hint="Soma do saldo atual de cada conta ativa como está no ERP (bancos, caixa do posto, aplicações). Cada conta conta uma vez, mesmo cadastrada em vários postos. Não é o extrato do banco: lançamento pendente no sistema muda o número." />
        <Kpi titulo="A receber · 30 dias" Icone={ArrowDownLeft}
          valor={formatCurrencyInt(v.receber30)}
          sub={<>{Math.round(v.pctCartoes)}% em cartões e apps</>}
          hint="Títulos a receber em aberto até 30 dias (inclui vencidos), com cartões e apps pelo líquido estimado de taxa." />
        <Kpi titulo="A pagar · 30 dias" Icone={ArrowUpRight}
          valor={formatCurrencyInt(v.pagar30)}
          sub={<>{v.pagarSemanaQtd} {v.pagarSemanaQtd === 1 ? 'vence' : 'vencem'} nesta semana{v.pagarVencidoQtd > 0 && <span className="text-red-600 dark:text-[#e3a3a3]"> · {v.pagarVencidoQtd} vencidos</span>}</>}
          hint="Títulos a pagar em aberto até 30 dias (inclui vencidos), pelo saldo que falta pagar." />
        <Kpi titulo="Lucro bruto do mês" Icone={TrendingUp}
          valor={formatCurrencyInt(mes.jaEntrou)}
          sub={<>Margem bruta de {pctFmt(setores.global.margem)}{!mes.fechado && mes.previsao > 0 && <> · deve fechar em {formatCurrencyShort(mes.previsao)}</>}</>}
          hint="Vendas menos o custo das mercadorias, no período do filtro (o mesmo da Central). Não desconta despesas: é lucro BRUTO, não resultado líquido." />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Fluxo de caixa */}
        <div className={cn(card, 'flex flex-col p-5')}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="inline-flex items-center gap-1 text-[15px] font-semibold text-gray-900 dark:text-[#f1f5f9]">Fluxo de caixa <InfoHint text="Semanas passadas: entradas e saídas lançadas nas contas no ERP (sem as transferências entre contas da própria empresa). Semanas futuras: títulos em aberto a receber e a pagar pelo vencimento (vencidos ficam fora). O saldo é estimado a partir do saldo de hoje." /></p>
              <p className="text-[12px] text-gray-500 dark:text-[#94a3b8]">Semanal · 6 semanas realizadas (até hoje) + 6 projetadas (pelos títulos em aberto)</p>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-gray-500 dark:text-[#94a3b8]">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: corEnt }} /> Entradas</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: corSai }} /> Saídas</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-gray-800 dark:bg-[#e2e8f0]" /> Saldo estimado</span>
              <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-[#2f3b4f]" />
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: corEnt, opacity: 0.9 }} /> Realizada</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: corEnt, opacity: 0.35 }} /> Projetada</span>
            </div>
          </div>
          {v.fluxoCarregando ? (
            <div className="flex h-[300px] items-center justify-center gap-2 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Montando o fluxo…</div>
          ) : (
            <div className="mt-3 min-h-[320px] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={v.fluxo.map((s) => ({ ...s, saidasNeg: -s.saidas }))} stackOffset="sign" margin={{ top: 30, right: 8, left: 8, bottom: 26 }}>
                  <CartesianGrid vertical={false} stroke={ct.grid} />
                  <XAxis dataKey="rotulo" tick={{ fill: ct.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickMargin={10} />
                  <YAxis yAxisId="f" hide domain={[(min: number) => (min < 0 ? min * 1.22 : 0), (max: number) => (max > 0 ? max * 1.18 : 0)]} />
                  <YAxis yAxisId="s" orientation="right" hide />
                  <ReferenceLine yAxisId="f" y={0} stroke={ct.grid} />
                  {v.fluxo.find((s) => s.projetada)?.rotulo && (
                    <ReferenceArea yAxisId="f" x1={v.fluxo.find((s) => s.projetada)?.rotulo} x2={v.fluxo[v.fluxo.length - 1]?.rotulo} fill={ct.dark ? '#ffffff' : '#0f172a'} fillOpacity={0.03}
                      label={{ value: 'Projetado (títulos em aberto) →', fill: ct.axis, fontSize: 11, position: 'insideTop' }} />
                  )}
                  <Tooltip
                    contentStyle={ct.tooltip}
                    formatter={(val, nome) => [formatCurrencyInt(Math.abs(Number(val ?? 0))), nome === 'entradas' ? 'Entradas' : nome === 'saidasNeg' ? 'Saídas' : 'Saldo estimado']}
                    labelFormatter={(l, p) => `Semana de ${String(l)}${p?.[0]?.payload?.projetada ? ' (projetada)' : ''}`}
                  />
                  <Bar yAxisId="f" dataKey="entradas" stackId="x" radius={[3, 3, 0, 0]}>
                    {v.fluxo.map((s) => <Cell key={`e${s.inicio}`} fill={corEnt} fillOpacity={s.projetada ? 0.35 : 0.9} />)}
                    <LabelList dataKey="entradas" content={(p) => <RotuloBarra {...(p as object)} fora="cima" cor={ct.dark ? '#86c5aa' : '#2f855a'} />} />
                  </Bar>
                  <Bar yAxisId="f" dataKey="saidasNeg" stackId="x" radius={[0, 0, 3, 3]}>
                    {v.fluxo.map((s) => <Cell key={`s${s.inicio}`} fill={corSai} fillOpacity={s.projetada ? 0.35 : 0.9} />)}
                    <LabelList dataKey="saidasNeg" content={(p) => <RotuloBarra {...(p as object)} fora="baixo" cor={ct.dark ? '#e3a3a3' : '#c0392b'} />} />
                  </Bar>
                  <Line yAxisId="s" dataKey="saldo" type="monotone" stroke={ct.dark ? '#e2e8f0' : '#1f2937'} strokeWidth={1.75} dot={false} />
                  {v.fluxo.find((s) => s.atual) && <ReferenceLine yAxisId="f" x={v.fluxo.find((s) => s.atual)!.rotulo} stroke={ct.axis} strokeDasharray="3 3" label={{ value: '← Realizado · Hoje', fill: ct.axis, fontSize: 11, position: 'insideTopRight' }} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Contas bancárias */}
        <div className={cn(card, 'relative flex flex-col')}>
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <p className="inline-flex items-center gap-1 text-[15px] font-semibold text-gray-900 dark:text-[#f1f5f9]">Contas <InfoHint text="Saldo atual de cada conta no ERP. Conta negativa costuma ser lançamento ou conciliação pendente no sistema, não necessariamente o banco." /></p>
            <span className="text-[12px] text-gray-500 dark:text-[#94a3b8]">{v.contas.length} {v.contas.length === 1 ? 'conta' : 'contas'}</span>
          </div>
          <div className="flex-1 divide-y divide-gray-100 border-t border-gray-100 dark:divide-[#2f3b4f] dark:border-[#2f3b4f]">
            {v.contasCarregando && <p className="flex items-center gap-2 px-5 py-4 text-[13px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Buscando as contas…</p>}
            {contasVisiveis.map((c) => (
              <div key={c.chave} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[11px] font-semibold text-gray-600 dark:bg-[#172234] dark:text-[#cbd5e1]">{iniciais(c.nome)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-gray-900 dark:text-[#f1f5f9]">{c.nome}</span>
                  <span className="block truncate text-[11.5px] text-gray-500 dark:text-[#94a3b8]">{c.posto || '—'}</span>
                </span>
                <span className={cn('shrink-0 text-[13.5px] font-semibold tabular-nums', c.saldo < 0 ? 'text-red-600 dark:text-[#e3a3a3]' : 'text-gray-900 dark:text-[#f1f5f9]')}>{formatCurrencyInt(c.saldo)}</span>
              </div>
            ))}
          </div>
          {v.contas.length > 6 && (
            <button type="button" onClick={() => setTodasContas(true)} className="inline-flex items-center justify-center gap-1 border-t border-gray-100 py-2.5 text-[12.5px] font-semibold text-teal-700 hover:bg-gray-50 dark:border-[#2f3b4f] dark:text-[#5eead4] dark:hover:bg-white/[0.03]">
              Ver todas as {v.contas.length} contas <ChevronDown className="h-4 w-4" />
            </button>
          )}

          {/* Todas as contas: painel flutuante por cima (não estica a tela) */}
          {todasContas && (
            <div ref={painelRef} role="dialog" aria-label="Todas as contas"
              className="absolute inset-x-0 top-0 z-30 flex max-h-[min(760px,85vh)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#3e4c63] dark:bg-[#1e293b]">
              <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-5">
                <p className="text-[15px] font-semibold text-gray-900 dark:text-[#f1f5f9]">Todas as contas <span className="text-[12px] font-normal text-gray-500 dark:text-[#94a3b8]">· {v.contas.length}</span></p>
                <button type="button" onClick={() => setTodasContas(false)} aria-label="Fechar"
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-[#94a3b8] dark:hover:bg-white/[0.06] dark:hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <label className="relative mx-5 mb-3 block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input autoFocus value={buscaConta} onChange={(e) => setBuscaConta(e.target.value)} placeholder="Buscar banco ou posto…"
                  className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-[13px] outline-none focus:border-teal-500 dark:border-[#2f3b4f] dark:bg-[#0b1220] dark:text-gray-100" />
              </label>
              <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto border-t border-gray-100 dark:divide-[#2f3b4f] dark:border-[#2f3b4f]">
            {contasFiltradas.map((c) => (
              <div key={c.chave} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[11px] font-semibold text-gray-600 dark:bg-[#172234] dark:text-[#cbd5e1]">{iniciais(c.nome)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-gray-900 dark:text-[#f1f5f9]">{c.nome}</span>
                  <span className="block truncate text-[11.5px] text-gray-500 dark:text-[#94a3b8]">{c.posto || '—'}</span>
                </span>
                <span className={cn('shrink-0 text-[13.5px] font-semibold tabular-nums', c.saldo < 0 ? 'text-red-600 dark:text-[#e3a3a3]' : 'text-gray-900 dark:text-[#f1f5f9]')}>{formatCurrencyInt(c.saldo)}</span>
              </div>
            ))}
                {contasFiltradas.length === 0 && <p className="px-5 py-4 text-center text-[12.5px] text-gray-400">Nenhuma conta com esse nome.</p>}
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-[12.5px] dark:border-[#2f3b4f]">
                <span className="text-gray-500 dark:text-[#94a3b8]">{buscaConta.trim() ? `Soma das ${contasFiltradas.length} mostradas` : 'Saldo em contas'}</span>
                <span className="font-semibold tabular-nums text-gray-900 dark:text-[#f1f5f9]">{formatCurrencyInt(contasFiltradas.reduce((acc, c) => acc + c.saldo, 0))}</span>
              </div>
            </div>
          )}
          {negativas.length > 0 && (
            <p className="flex items-start gap-1.5 border-t border-gray-100 px-5 py-3 text-[12px] text-amber-700 dark:border-[#2f3b4f] dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {negativas.length} {negativas.length === 1 ? 'conta está negativa' : 'contas estão negativas'} no sistema: confira os lançamentos no ERP.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Entra × sai nos próximos dias (no lugar da lista de contas) */}
        <div className={cn(card, 'p-5')}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="inline-flex items-center gap-1 text-[15px] font-semibold text-gray-900 dark:text-[#f1f5f9]">O que entra e o que sai <InfoHint text="Títulos em aberto pelo vencimento: a receber (clientes, cartões e apps líquidos de taxa) contra a pagar. O saldo mostra se o que entra cobre o que sai em cada prazo." /></p>
              <p className="text-[12px] text-gray-500 dark:text-[#94a3b8]">Títulos em aberto, pelo vencimento · clique num valor para ver os títulos</p>
            </div>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-gray-100 dark:border-[#2f3b4f]">
            <table className="w-full text-[13px]">
              <thead className="text-[10.5px] uppercase tracking-wide text-gray-400">
                <tr className="border-b border-gray-100 dark:border-[#2f3b4f]">
                  <th className="px-4 py-2 text-left font-semibold">Prazo</th>
                  <th className="px-4 py-2 text-right font-semibold">Entra</th>
                  <th className="px-4 py-2 text-right font-semibold">Sai</th>
                  <th className="px-4 py-2 text-right font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {([['vencidas', 'Vencidos'], ['hoje', 'Hoje'], ['d7', 'Próximos 7 dias'], ['d30', '8 a 30 dias']] as const).map(([id, label]) => {
                  const ent = v.resumo.receber.buckets[id].total
                  const sai = v.resumo.pagar.buckets[id].total
                  const saldo = ent - sai
                  return (
                    <tr key={id}>
                      <td className="px-4 py-2.5 text-gray-700 dark:text-[#cbd5e1]">{label}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums">
                        <button type="button" disabled={ent <= 0} onClick={() => abrirFaixa('receber', id)} aria-label={`Ver os títulos a receber: ${label}`}
                          className="rounded-md px-2 py-1 underline-offset-4 hover:bg-gray-50 hover:underline disabled:cursor-default disabled:no-underline disabled:hover:bg-transparent dark:hover:bg-white/[0.04]" style={{ color: corEnt }}>{formatCurrencyInt(ent)}</button>
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums">
                        <button type="button" disabled={sai <= 0} onClick={() => abrirFaixa('pagar', id)} aria-label={`Ver os títulos a pagar: ${label}`}
                          className="rounded-md px-2 py-1 underline-offset-4 hover:bg-gray-50 hover:underline disabled:cursor-default disabled:no-underline disabled:hover:bg-transparent dark:hover:bg-white/[0.04]" style={{ color: corSai }}>{formatCurrencyInt(sai)}</button>
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', saldo >= 0 ? 'text-gray-900 dark:text-[#f1f5f9]' : 'text-red-600 dark:text-[#e3a3a3]')}>{saldo >= 0 ? '+' : '−'}{formatCurrencyInt(Math.abs(saldo))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Receitas × despesas do mês */}
        <div className={cn(card, 'p-5')}>
          <p className="inline-flex items-center gap-1 text-[15px] font-semibold text-gray-900 dark:text-[#f1f5f9]">Receitas × despesas <InfoHint text="Entradas: vendas de cada setor no período do filtro. Saídas: contas pagas neste mês, por centro de custo (ou categoria, quando o título não tem centro de custo)." /></p>
          <p className="text-[12px] text-gray-500 dark:text-[#94a3b8]">Vendas por setor × contas pagas no mês</p>
          <div className="mt-3 space-y-2.5">
            {entradasSetor.map((s) => (
              <div key={s.nome}>
                <div className="flex justify-between text-[12.5px]"><span className="text-gray-700 dark:text-[#cbd5e1]">{s.nome}</span><span className="font-semibold tabular-nums" style={{ color: corEnt }}>+{formatCurrencyShort(s.valor)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-[#172234]"><div className="h-full rounded-full" style={{ width: `${(s.valor / maxEntrada) * 100}%`, background: corEnt }} /></div>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2.5 dark:border-[#2f3b4f]" />
            {v.saidasCarregando ? (
              <p className="flex items-center gap-2 text-[12.5px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Somando as contas pagas…</p>
            ) : v.saidasMes.length === 0 ? (
              <p className="text-[12.5px] text-gray-500 dark:text-[#94a3b8]">Nenhuma conta paga neste mês.</p>
            ) : (
              <>
                {v.saidasMes.slice(0, 5).map((s) => (
                  <div key={s.nome}>
                    <div className="flex justify-between gap-2 text-[12.5px]"><span className="truncate text-gray-700 dark:text-[#cbd5e1]">{s.nome}</span><span className="shrink-0 font-semibold tabular-nums" style={{ color: corSai }}>−{formatCurrencyShort(s.valor)}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-[#172234]"><div className="h-full rounded-full" style={{ width: `${(s.valor / maxSaida) * 100}%`, background: corSai }} /></div>
                  </div>
                ))}
                <p className="text-[11.5px] text-gray-500 dark:text-[#94a3b8]">Total pago no mês: <b className="font-semibold text-gray-800 dark:text-[#e2e8f0]">{formatCurrencyInt(totalSaidas)}</b>{v.saidasMes.length > 5 ? ` · ${v.saidasMes.length - 5} outros centros` : ''}</p>
              </>
            )}
          </div>
        </div>
      </div>
      <ContasListaModal sel={lista} onClose={() => setLista(null)} />
    </div>
  )
}

export default VisaoFinanceira
