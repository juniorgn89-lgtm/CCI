import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Building2, User, Loader2 } from 'lucide-react'
import { fetchTarefas, fetchRotinas, estaAtrasada, type TarefaRow, type RotinaRow } from '@/api/supabase/gestaoTarefas'
import { containerCls, btnGhost, hojeLocal, somaDias } from './comum'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'

/**
 * Agenda: calendário mensal (seg–dom) com as tarefas do dia e, nos dias
 * futuros, o que as rotinas ativas ainda vão gerar ("previstas"). Clicar num
 * dia abre a semana dele. Busca as tarefas do mês visível por conta própria
 * (a lista principal só carrega a janela do período) e aplica os mesmos
 * filtros da página via `filtro`.
 */

interface Ctx {
  redeId: string
  nomePosto: (c: number | null) => string | null
  nomeUsuario: (id: string | null) => string | null
}

type Cor = 'atrasada' | 'andamento' | 'fazer' | 'concluida' | 'cancelada'
const COR_DOT: Record<Cor, string> = {
  atrasada: 'bg-red-500',
  andamento: 'bg-blue-500',
  fazer: 'bg-gray-400',
  concluida: 'bg-emerald-500',
  cancelada: 'bg-gray-300 dark:bg-gray-600',
}
const COR_BARRA: Record<Cor, string> = {
  atrasada: 'border-l-red-500',
  andamento: 'border-l-blue-500',
  fazer: 'border-l-gray-400',
  concluida: 'border-l-emerald-500',
  cancelada: 'border-l-gray-300 dark:border-l-gray-600',
}
const PESO: Record<Cor, number> = { atrasada: 0, andamento: 1, fazer: 2, concluida: 3, cancelada: 4 }

const corDe = (t: TarefaRow): Cor =>
  estaAtrasada(t) ? 'atrasada' : t.status === 'em_andamento' ? 'andamento' : t.status === 'a_fazer' ? 'fazer' : t.status === 'concluida' ? 'concluida' : 'cancelada'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const deIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
/** Segunda-feira da semana do dia. */
const segundaDe = (dia: string) => { const d = deIso(dia); const off = (d.getDay() + 6) % 7; return somaDias(dia, -off) }
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/** A rotina gera tarefa neste dia? (mesma regra do gerar_tarefas_de_rotinas) */
const rotinaGeraEm = (r: RotinaRow, dia: string) => {
  if (!r.ativa || !r.responsavel_id || r.inicio_em > dia) return false
  const dow = deIso(dia).getDay()
  return r.recorrencia === 'diaria' ? true : r.recorrencia === 'dias_uteis' ? dow >= 1 && dow <= 5 : r.dias_semana.includes(dow)
}

interface Previsto { rotina: RotinaRow; quantidade: number }

export const Agenda = ({ ctx, filtro, onAbrir }: {
  ctx: Ctx
  filtro: (t: TarefaRow) => boolean
  onAbrir: (t: TarefaRow) => void
}) => {
  const hoje = hojeLocal()
  const [modo, setModo] = useState<'mes' | 'semana'>('mes')
  // Dia de referência: mês/semana visível gira em torno dele.
  const [ref, setRef] = useState(hoje)
  const refDate = deIso(ref)
  const mesIni = iso(new Date(refDate.getFullYear(), refDate.getMonth(), 1))
  const mesFim = iso(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0))
  // Grade: da segunda antes do dia 1 até fechar 6 linhas (42 dias) — sempre o mesmo tamanho.
  const gradeIni = segundaDe(mesIni)
  const semanaIni = segundaDe(ref)
  const de = modo === 'mes' ? gradeIni : semanaIni
  const ate = modo === 'mes' ? somaDias(gradeIni, 41) : somaDias(semanaIni, 6)

  const tarefasQ = useQuery({
    queryKey: ['gestao-tarefas', ctx.redeId, 'agenda', de, ate],
    queryFn: () => fetchTarefas(ctx.redeId, de, ate),
    refetchInterval: 60_000,
  })
  const rotinasQ = useQuery({ queryKey: ['gestao-rotinas', ctx.redeId], queryFn: () => fetchRotinas(ctx.redeId), staleTime: 60_000 })

  const porDia = useMemo(() => {
    const m = new Map<string, TarefaRow[]>()
    for (const t of tarefasQ.data ?? []) {
      if (!filtro(t)) continue
      const l = m.get(t.vence_dia) ?? []
      l.push(t)
      m.set(t.vence_dia, l)
    }
    for (const l of m.values()) l.sort((a, b) => PESO[corDe(a)] - PESO[corDe(b)] || a.vence_em.localeCompare(b.vence_em))
    return m
  }, [tarefasQ.data, filtro])

  // Previstas: dias depois de hoje em que rotinas ativas vão gerar tarefa (uma por posto).
  const previstosDe = (dia: string): Previsto[] => {
    if (dia <= hoje) return []
    return (rotinasQ.data ?? []).filter((r) => rotinaGeraEm(r, dia)).map((r) => ({ rotina: r, quantidade: r.empresa_codigos.length || 1 }))
  }

  const dias: string[] = []
  for (let i = 0; i < (modo === 'mes' ? 42 : 7); i++) dias.push(somaDias(de, i))
  const totalVisivel = dias.reduce((a, d) => a + (d >= mesIni && d <= mesFim || modo === 'semana' ? (porDia.get(d)?.length ?? 0) : 0), 0)

  const mesExtenso = refDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const titulo = modo === 'mes'
    ? mesExtenso.charAt(0).toUpperCase() + mesExtenso.slice(1)
    : `${deIso(semanaIni).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${deIso(somaDias(semanaIni, 6)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
  const navegar = (dir: -1 | 1) => {
    if (modo === 'semana') { setRef(somaDias(ref, 7 * dir)); return }
    const d = new Date(refDate.getFullYear(), refDate.getMonth() + dir, 1)
    setRef(iso(d))
  }

  return (
    <div className={cn(containerCls, 'overflow-hidden')}>
      {/* Cabeçalho: mês/semana, navegação, Hoje, alternador. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100"><span data-agenda-titulo>{titulo}</span> <InfoHint text="As tarefas de cada dia, com a cor do status, e nos dias futuros o que as rotinas ainda vão gerar (bolinha vazada). Clique num dia para ver a semana; clique no título para abrir a tarefa. Os filtros da tela valem aqui também." /></span>
            <span className="block text-[11px] text-gray-500">{tarefasQ.isLoading ? 'carregando…' : `${totalVisivel} tarefa(s)`}</span>
          </span>
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" className={cn(btnGhost, 'h-8 w-8 px-0')} onClick={() => navegar(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" className={cn(btnGhost, 'h-8 px-2.5 text-xs')} onClick={() => setRef(hoje)}>Hoje</button>
          <button type="button" className={cn(btnGhost, 'h-8 w-8 px-0')} onClick={() => navegar(1)} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></button>
          <span className="ml-2 inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
            {(['semana', 'mes'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setModo(m)}
                className={cn('rounded px-2.5 py-1 text-xs font-semibold', modo === m ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800')}>
                {m === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </span>
        </span>
      </div>

      {tarefasQ.error ? (
        <div className="p-6 text-sm text-red-600">Erro ao carregar: {(tarefasQ.error as Error).message}</div>
      ) : modo === 'mes' ? (
        <div className="overflow-x-auto">
          <div className="md:min-w-[640px]">
            <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
              {DIAS.map((d) => <div key={d} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-100 p-px dark:bg-gray-800">
              {dias.map((dia) => {
                const itens = porDia.get(dia) ?? []
                const previstos = previstosDe(dia)
                const foraDoMes = dia < mesIni || dia > mesFim
                const ehHoje = dia === hoje
                const pior = itens.length ? corDe(itens[0]) : null
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => { setRef(dia); setModo('semana') }}
                    title="Clique para ver a semana"
                    className={cn(
                      'flex min-h-[3.5rem] flex-col items-stretch bg-white p-1 md:min-h-[6.5rem] md:p-1.5 text-left transition-colors hover:bg-gray-50 dark:bg-[#0b0b0b] dark:hover:bg-white/[0.04]',
                      foraDoMes && 'opacity-45',
                      pior && cn('border-l-[3px]', COR_BARRA[pior]),
                      ehHoje && 'ring-2 ring-inset ring-emerald-500/70',
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums', ehHoje ? 'bg-emerald-500 text-white' : 'text-gray-600 dark:text-gray-300')}>{Number(dia.slice(8))}</span>
                      {ehHoje && <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">hoje</span>}
                      {itens.length > 0 && <span className="rounded bg-gray-100 px-1 text-[10px] tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">{itens.length}</span>}
                    </span>
                    <span className="mt-1 hidden flex-1 flex-col gap-0.5 md:flex">
                      {itens.slice(0, 3).map((t) => (
                        <span key={t.id} role="link" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onAbrir(t) }}
                          className="flex items-center gap-1 truncate text-[11px] text-gray-700 hover:underline dark:text-gray-200">
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', COR_DOT[corDe(t)])} />
                          <span className={cn('truncate', (t.status === 'concluida' || t.status === 'cancelada') && 'text-gray-400')}>{t.titulo}</span>
                        </span>
                      ))}
                      {itens.length > 3 && <span className="text-[10px] text-gray-400">+{itens.length - 3}</span>}
                      {previstos.slice(0, 2).map((p) => (
                        <span key={p.rotina.id} className="flex items-center gap-1 truncate text-[11px] text-gray-400 dark:text-gray-500" title={`Prevista: ${p.rotina.nome} (${p.quantidade})`}>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-emerald-500" />
                          <span className="truncate">{p.rotina.nome}{p.quantidade > 1 ? ` ×${p.quantidade}` : ''}</span>
                        </span>
                      ))}
                    </span>
                    {/* Celular: só as bolinhas. */}
                    <span className="mt-1 flex flex-wrap gap-0.5 md:hidden">
                      {itens.slice(0, 6).map((t) => <span key={t.id} className={cn('h-1.5 w-1.5 rounded-full', COR_DOT[corDe(t)])} />)}
                      {previstos.length > 0 && <span className="h-1.5 w-1.5 rounded-full border border-emerald-500" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-px bg-gray-100 p-px md:grid-cols-7 dark:bg-gray-800">
          {dias.map((dia) => {
            const itens = porDia.get(dia) ?? []
            const previstos = previstosDe(dia)
            const ehHoje = dia === hoje
            const d = deIso(dia)
            return (
              <div key={dia} className={cn('flex min-h-[4rem] flex-col bg-white p-2 md:min-h-[10rem] dark:bg-[#0b0b0b]', ehHoje && 'ring-2 ring-inset ring-emerald-500/70')}>
                <p className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <span>{DIAS[(d.getDay() + 6) % 7]} <span className={cn('ml-1 tabular-nums', ehHoje && 'rounded-full bg-emerald-500 px-1.5 text-white')}>{d.getDate()}</span></span>
                  {itens.length > 0 && <span className="rounded bg-gray-100 px-1 tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">{itens.length}</span>}
                </p>
                <div className="flex flex-1 flex-col gap-1.5">
                  {itens.length === 0 && previstos.length === 0 && <p className="py-3 text-center text-[11px] text-gray-300 dark:text-gray-600">—</p>}
                  {itens.map((t) => {
                    const cor = corDe(t)
                    return (
                      <button key={t.id} type="button" onClick={() => onAbrir(t)}
                        className={cn('rounded-md border border-l-[3px] border-gray-200 bg-white p-1.5 text-left text-[11px] hover:border-[#1e3a5f]/40 dark:border-gray-700 dark:bg-[#161616]', COR_BARRA[cor])}>
                        <p className={cn('font-semibold text-gray-900 dark:text-gray-100', (t.status === 'concluida' || t.status === 'cancelada') && 'text-gray-400 line-through dark:text-gray-500')}>{t.titulo}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-gray-500">
                          <span className={cn('tabular-nums', cor === 'atrasada' && 'font-semibold text-red-600 dark:text-red-400')}>{new Date(t.vence_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          {t.empresa_codigo !== null && <span className="inline-flex items-center gap-0.5"><Building2 className="h-2.5 w-2.5" />{ctx.nomePosto(t.empresa_codigo)}</span>}
                          {t.responsavel_id && <span className="inline-flex items-center gap-0.5"><User className="h-2.5 w-2.5" />{ctx.nomeUsuario(t.responsavel_id)}</span>}
                        </p>
                      </button>
                    )
                  })}
                  {previstos.map((p) => (
                    <div key={p.rotina.id} className="rounded-md border border-dashed border-emerald-400/60 p-1.5 text-[11px] text-gray-500 dark:text-gray-400" title="Ainda não gerada: a rotina cria a tarefa à meia-noite do dia">
                      <p className="font-medium">{p.rotina.nome}</p>
                      <p className="text-[10px]">prevista · {p.quantidade} tarefa{p.quantidade > 1 ? 's' : ''} · {p.rotina.hora_vencimento.slice(0, 5)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 px-4 py-2 text-[10px] text-gray-500 dark:border-gray-800">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Atrasada</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Em andamento</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-400" /> A fazer</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Concluída</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-emerald-500" /> Prevista (rotina, ainda não gerada)</span>
        {modo === 'mes' && <span className="text-gray-400">· Clique num dia para ver a semana.</span>}
        {tarefasQ.isFetching && !tarefasQ.isLoading && <Loader2 className="ml-auto h-3 w-3 animate-spin text-gray-400" />}
      </div>
    </div>
  )
}

export default Agenda
