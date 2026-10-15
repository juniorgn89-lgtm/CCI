import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Gauge, CheckCircle2, Clock, AlertTriangle, ListChecks, Activity, ChevronRight, Loader2 } from 'lucide-react'
import { fetchTarefas, fetchAtividadesRecentes, estaAtrasada, ATIVIDADE_VERBO, type TarefaRow, type AtividadeRow } from '@/api/supabase/gestaoTarefas'
import { useChartTheme } from '@/lib/chartTheme'
import { useGestaoBase, containerCls, hojeLocal, somaDias, fmtDataHora } from './comum'
import { Segmentos } from './comumUi'
import { cn } from '@/lib/utils'

/**
 * Gestão → Painel de tarefas: execução das rotinas e tarefas por empresa,
 * setor e pessoa no período (7/14/30 dias). "Execução" = concluídas no prazo
 * sobre o que já venceu; o que ainda não venceu é "pendente" e não conta
 * contra ninguém. Tudo derivado das tarefas, nenhum número inventado.
 */

type Periodo = 7 | 14 | 30
type Corte = 'empresa' | 'setor' | 'pessoa'

const noPrazo = (t: TarefaRow) => t.status === 'concluida' && !!t.concluida_em && new Date(t.concluida_em).getTime() <= new Date(t.vence_em).getTime()
const vencida = (t: TarefaRow, agora: number) => new Date(t.vence_em).getTime() <= agora && t.status !== 'cancelada'

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null)

const Painel = () => {
  const base = useGestaoBase()
  const ct = useChartTheme()
  const hoje = hojeLocal()
  const [periodo, setPeriodo] = useState<Periodo>(30)
  const [corte, setCorte] = useState<Corte>('empresa')

  // Busca com folga de 7 dias antes (pra comparar com a semana anterior).
  const de = somaDias(hoje, -(periodo + 7))
  const tarefasQ = useQuery({
    queryKey: ['gestao-tarefas', base.redeId, de, hoje],
    queryFn: () => fetchTarefas(base.redeId!, de, hoje),
    enabled: !!base.redeId,
    refetchInterval: 60_000,
  })
  const atividadesQ = useQuery({
    queryKey: ['gestao-atividades', base.redeId],
    queryFn: () => fetchAtividadesRecentes(base.redeId!, 12),
    enabled: !!base.redeId,
    refetchInterval: 60_000,
  })

  const inicio = somaDias(hoje, -(periodo - 1))
  const todas = useMemo(() => (tarefasQ.data ?? []).filter((t) => t.status !== 'cancelada'), [tarefasQ.data])
  const noPeriodo = useMemo(() => todas.filter((t) => t.vence_dia >= inicio && t.vence_dia <= hoje), [todas, inicio, hoje])

  // "Agora" = instante da última leitura dos dados (puro; renova a cada refetch de 60 s).
  const agora = tarefasQ.dataUpdatedAt || 0

  const r = useMemo(() => {
    const vencidas = noPeriodo.filter((t) => vencida(t, agora))
    const vencidasPrazo = vencidas.filter(noPrazo)
    const concluidas = noPeriodo.filter((t) => t.status === 'concluida')
    const concluidasPrazo = concluidas.filter(noPrazo)
    const emAndamento = noPeriodo.filter((t) => t.status === 'em_andamento')
    const atrasadas = noPeriodo.filter((t) => estaAtrasada(t, agora))
    const pendentes = noPeriodo.filter((t) => (t.status === 'a_fazer' || t.status === 'em_andamento') && !estaAtrasada(t, agora))
    const execucao = pct(vencidasPrazo.length, vencidas.length)

    // Semana atual × anterior (execução).
    const ini7 = somaDias(hoje, -6), ini14 = somaDias(hoje, -13), fim14 = somaDias(hoje, -7)
    const exec = (a: string, b: string) => {
      const v = todas.filter((t) => t.vence_dia >= a && t.vence_dia <= b && vencida(t, agora))
      return pct(v.filter(noPrazo).length, v.length)
    }
    const semanaAtual = exec(ini7, hoje), semanaAnterior = exec(ini14, fim14)

    // Série diária.
    const dias: { dia: string; label: string; execucao: number | null; vencidas: number; prazo: number }[] = []
    for (let i = periodo - 1; i >= 0; i--) {
      const d = somaDias(hoje, -i)
      const v = noPeriodo.filter((t) => t.vence_dia === d && vencida(t, agora))
      const p = v.filter(noPrazo).length
      dias.push({ dia: d, label: `${d.slice(8, 10)}/${d.slice(5, 7)}`, execucao: pct(p, v.length), vencidas: v.length, prazo: p })
    }

    // Cortes.
    const chave = (t: TarefaRow) =>
      corte === 'empresa' ? (base.nomePosto(t.empresa_codigo) ?? 'Sem posto')
      : corte === 'setor' ? (base.nomeSetor(t.setor_id) ?? 'Sem setor')
      : (base.nomeUsuario(t.responsavel_id) ?? 'Sem responsável')
    // Link pra lista já filtrada por este corte (?posto= / ?setor= / ?resp=).
    const link = (t: TarefaRow) =>
      corte === 'empresa' ? `/gestao?tab=tarefas&posto=${t.empresa_codigo ?? 'sem'}`
      : corte === 'setor' ? (t.setor_id ? `/gestao?tab=tarefas&setor=${t.setor_id}` : '/gestao?tab=tarefas')
      : (t.responsavel_id ? `/gestao?tab=tarefas&resp=${t.responsavel_id}` : '/gestao?tab=tarefas&resp=sem')
    const grupos = new Map<string, { conc: number; atras: number; venc: number; prazo: number; total: number; to: string }>()
    for (const t of noPeriodo) {
      const k = chave(t)
      const g = grupos.get(k) ?? { conc: 0, atras: 0, venc: 0, prazo: 0, total: 0, to: link(t) }
      g.total++
      if (t.status === 'concluida') g.conc++
      if (estaAtrasada(t, agora)) g.atras++
      if (vencida(t, agora)) { g.venc++; if (noPrazo(t)) g.prazo++ }
      grupos.set(k, g)
    }
    const linhas = [...grupos.entries()].map(([nome, g]) => ({ nome, ...g, execucao: pct(g.prazo, g.venc) })).sort((a, b) => (b.execucao ?? -1) - (a.execucao ?? -1) || b.total - a.total)

    const atencao = todas
      .filter((t) => (t.status === 'a_fazer' || t.status === 'em_andamento') && (estaAtrasada(t, agora) || t.vence_dia === hoje))
      .sort((a, b) => new Date(a.vence_em).getTime() - new Date(b.vence_em).getTime())
      .slice(0, 8)
      .map((t) => ({ t, atras: estaAtrasada(t, agora) }))

    return { vencidas, vencidasPrazo, concluidasPrazo, concluidas, emAndamento, atrasadas, pendentes, execucao, semanaAtual, semanaAnterior, dias, linhas, atencao }
  }, [noPeriodo, todas, agora, hoje, periodo, corte, base])

  if (!base.redeId) return <div className="p-6 text-sm text-gray-500">Selecione uma rede para ver o painel.</div>

  const kpi = (Icon: typeof Gauge, rotulo: string, valor: string, detalhe: string, tom?: 'ok' | 'alerta') => (
    <div className={cn(containerCls, 'p-4')}>
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {rotulo} <Icon className={cn('h-4 w-4', tom === 'ok' ? 'text-emerald-500' : tom === 'alerta' ? 'text-red-500' : 'text-gray-400')} />
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{valor}</div>
      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{detalhe}</div>
    </div>
  )

  const delta = r.semanaAtual !== null && r.semanaAnterior !== null ? r.semanaAtual - r.semanaAnterior : null
  const execCor = r.execucao === null ? 'text-gray-400' : r.execucao >= 90 ? 'text-emerald-600 dark:text-emerald-400' : r.execucao >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
  const ringCor = r.execucao === null ? '#94a3b8' : r.execucao >= 90 ? '#10b981' : r.execucao >= 70 ? '#f59e0b' : '#ef4444'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Segmentos<Periodo> opcoes={[{ value: 7, label: '7 dias' }, { value: 14, label: '14 dias' }, { value: 30, label: '30 dias' }]} valor={periodo} onChange={setPeriodo} />
      </div>

      {tarefasQ.isLoading && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpi(Gauge, 'Execução', r.execucao === null ? '—' : `${r.execucao}%`, r.vencidas.length ? `${r.vencidasPrazo.length} de ${r.vencidas.length} vencidas concluídas no prazo` : 'nenhuma tarefa vencida no período')}
        {kpi(CheckCircle2, 'Concluídas', String(r.concluidas.length), `${r.concluidasPrazo.length} no prazo`, 'ok')}
        {kpi(Clock, 'Pendentes', String(r.pendentes.length), 'dentro do prazo')}
        {kpi(AlertTriangle, 'Atrasadas', String(r.atrasadas.length), 'abertas e vencidas', r.atrasadas.length ? 'alerta' : undefined)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        {/* Saúde operacional */}
        <div className={cn(containerCls, 'p-4')}>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Saúde operacional</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Tarefas vencidas concluídas no prazo · {periodo} dias</p>
          <div className="my-4 flex flex-col items-center">
            <div className="relative h-32 w-32">
              <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke={ct.grid} strokeWidth="10" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={ringCor} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${((r.execucao ?? 0) / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-2xl font-bold tabular-nums', execCor)}>{r.execucao === null ? '—' : `${r.execucao}%`}</span>
                <span className="text-[10px] uppercase tracking-wide text-gray-400">execução</span>
              </div>
            </div>
            <p className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-300">
              {r.execucao === null ? 'Sem tarefas vencidas no período' : r.execucao >= 90 ? 'Execução saudável' : r.execucao >= 70 ? 'Execução com atenção' : 'Execução crítica'}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
            {delta === null ? 'Sem base para comparar com a semana anterior' : (
              <span className={cn(delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} p.p. vs semana anterior ({r.semanaAtual}% × {r.semanaAnterior}%)
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {[
              ['Concluídas', r.concluidas.length, 'bg-emerald-500'],
              ['Em andamento', r.emAndamento.length, 'bg-blue-500'],
              ['Pendentes', r.pendentes.length, 'bg-gray-400'],
              ['Atrasadas', r.atrasadas.length, 'bg-red-500'],
            ].map(([l, n, c]) => (
              <div key={String(l)} className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', c as string)} />{l}</span>
                <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Execução diária */}
        <div className={cn(containerCls, 'p-4')}>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Execução diária</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">% das tarefas vencidas no dia concluídas no prazo</p>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 224 }}>
              <BarChart data={r.dias} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} interval={periodo > 14 ? 2 : 0} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ ...ct.tooltip, fontSize: 12, borderRadius: 8 }}
                  formatter={(v, _n, p) => [v === null ? 'sem vencidas' : `${v}% (${(p.payload as { prazo: number; vencidas: number }).prazo}/${(p.payload as { vencidas: number }).vencidas})`, 'Execução']}
                />
                <Bar dataKey="execucao" fill={ct.dark ? '#34d399' : '#10b981'} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Execução por corte */}
        <div className={cn(containerCls, 'p-4')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"><ListChecks className="h-4 w-4 text-emerald-500" /> Execução por empresa, setor e pessoa</p>
            <Segmentos<Corte> opcoes={[{ value: 'empresa', label: 'Empresa' }, { value: 'setor', label: 'Setor' }, { value: 'pessoa', label: 'Pessoa' }]} valor={corte} onChange={setCorte} />
          </div>
          {r.linhas.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Sem tarefas no período.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
              {r.linhas.map((l) => (
                <li key={l.nome} className="flex items-center gap-3 py-2 text-sm">
                  <Link to={l.to} className="min-w-0 flex-1 truncate font-medium text-gray-800 hover:underline dark:text-gray-200" title="Abrir as tarefas deste corte">{l.nome}</Link>
                  <span className="whitespace-nowrap text-[11px] text-gray-500">{l.conc} conc. · {l.atras} atras. · {l.total} total</span>
                  <span className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <span className={cn('block h-full rounded-full', l.execucao === null ? 'bg-gray-300' : l.execucao >= 90 ? 'bg-emerald-500' : l.execucao >= 70 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${l.execucao ?? 0}%` }} />
                  </span>
                  <span className="w-12 text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{l.execucao === null ? '—' : `${l.execucao}%`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          {/* Pedem atenção */}
          <div className={cn(containerCls, 'p-4')}>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"><AlertTriangle className="h-4 w-4 text-red-500" /> Pedem atenção</p>
            {r.atencao.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Nada atrasado ou vencendo hoje. 👋</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                {r.atencao.map(({ t, atras }) => {
                  return (
                    <li key={t.id} className="py-2 text-xs">
                      <Link to={`/gestao?tab=tarefas&aba=${atras ? 'atrasadas' : 'hoje'}`} className="flex items-center gap-2 hover:underline">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', atras ? 'bg-red-500' : 'bg-amber-500')} />
                        <span className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-200">{t.titulo}</span>
                        <span className="whitespace-nowrap text-gray-500">{base.nomePosto(t.empresa_codigo) ?? ''} · {fmtDataHora(t.vence_em)}</span>
                        <ChevronRight className="h-3 w-3 text-gray-400" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Atividade recente */}
          <div className={cn(containerCls, 'p-4')}>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"><Activity className="h-4 w-4 text-emerald-500" /> Atividade recente</p>
            {(atividadesQ.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Sem atividade ainda.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-xs">
                {(atividadesQ.data ?? []).map((a) => <li key={a.id} className="text-gray-600 dark:text-gray-300">{descreverAtividade(a)}</li>)}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const descreverAtividade = (a: AtividadeRow) => (
  <>
    <span className="font-medium text-gray-800 dark:text-gray-200">{a.autor_nome ?? 'Alguém'}</span> {ATIVIDADE_VERBO[a.tipo]}{' '}
    <span className="text-gray-800 dark:text-gray-200">{a.detalhe ?? 'uma tarefa'}</span>
    <span className="text-gray-400"> · {fmtDataHora(a.criado_em)}</span>
  </>
)

export default Painel
