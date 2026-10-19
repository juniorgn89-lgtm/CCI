import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Flame, Loader2 } from 'lucide-react'
import { fetchTarefas, fetchRotinas, estaAtrasada, type TarefaRow, type RotinaRow } from '@/api/supabase/gestaoTarefas'
import { hojeLocal, somaDias } from './comum'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'

/**
 * Agenda: calendário mensal (seg–dom) no mesmo modelo do calendário de
 * vencimentos do Financeiro — cada dia é um cartão com a quantidade de
 * tarefas, as primeiras listadas com a cor do status, barra de "peso" do dia,
 * selo do dia mais pesado e a coluna de resumo da semana. Nos dias futuros
 * mostra também o que as rotinas ativas ainda vão gerar ("previstas").
 * Clicar num dia abre a semana dele; clicar numa tarefa abre o detalhe.
 * Busca as tarefas do mês visível por conta própria e aplica os mesmos
 * filtros da página via `filtro`.
 */

interface Ctx {
  redeId: string
  nomePosto: (c: number | null) => string | null
  nomeUsuario: (id: string | null) => string | null
}

type Cor = 'atrasada' | 'andamento' | 'fazer' | 'concluida' | 'cancelada'
const COR: Record<Cor, { dot: string; barraEsq: string; barra: string; fundo: string; txt: string }> = {
  atrasada: { dot: 'bg-red-500', barraEsq: 'border-l-red-500', barra: 'bg-red-500', fundo: 'bg-red-500', txt: 'text-red-600 dark:text-red-400' },
  andamento: { dot: 'bg-blue-500', barraEsq: 'border-l-blue-500', barra: 'bg-blue-500', fundo: 'bg-blue-500', txt: 'text-blue-600 dark:text-blue-400' },
  fazer: { dot: 'bg-gray-400', barraEsq: 'border-l-gray-400', barra: 'bg-gray-400', fundo: 'bg-gray-400', txt: 'text-gray-700 dark:text-gray-200' },
  concluida: { dot: 'bg-emerald-500', barraEsq: 'border-l-emerald-500', barra: 'bg-emerald-500', fundo: 'bg-emerald-500', txt: 'text-emerald-600 dark:text-emerald-400' },
  cancelada: { dot: 'bg-gray-300 dark:bg-gray-600', barraEsq: 'border-l-gray-300 dark:border-l-gray-600', barra: 'bg-gray-300 dark:bg-gray-600', fundo: 'bg-gray-400', txt: 'text-gray-400' },
}
const PESO: Record<Cor, number> = { atrasada: 0, andamento: 1, fazer: 2, concluida: 3, cancelada: 4 }

const corDe = (t: TarefaRow): Cor =>
  estaAtrasada(t) ? 'atrasada' : t.status === 'em_andamento' ? 'andamento' : t.status === 'a_fazer' ? 'fazer' : t.status === 'concluida' ? 'concluida' : 'cancelada'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const deIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
/** Segunda-feira da semana do dia. */
const segundaDe = (dia: string) => { const d = deIso(dia); const off = (d.getDay() + 6) % 7; return somaDias(dia, -off) }
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const hora = (isoDt: string) => new Date(isoDt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const ddmm = (dia: string) => deIso(dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

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
  const noMes = (d: string) => modo === 'semana' || (d >= mesIni && d <= mesFim)
  const visiveis = dias.filter(noMes)
  const qtd = (d: string) => porDia.get(d)?.length ?? 0
  const totalVisivel = visiveis.reduce((a, d) => a + qtd(d), 0)
  const abertasVisiveis = visiveis.reduce((a, d) => a + (porDia.get(d) ?? []).filter((t) => t.status === 'a_fazer' || t.status === 'em_andamento').length, 0)
  const maxDia = Math.max(...visiveis.map(qtd), 0)
  const piorDia = visiveis.reduce<string | null>((best, d) => (qtd(d) > (best ? qtd(best) : 0) ? d : best), null)

  const mesExtenso = refDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const tituloPeriodo = modo === 'mes'
    ? mesExtenso.charAt(0).toUpperCase() + mesExtenso.slice(1)
    : `${ddmm(semanaIni)} a ${ddmm(somaDias(semanaIni, 6))}`
  const navegar = (dir: -1 | 1) => {
    if (modo === 'semana') { setRef(somaDias(ref, 7 * dir)); return }
    setRef(iso(new Date(refDate.getFullYear(), refDate.getMonth() + dir, 1)))
  }

  const semanas: string[][] = []
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))

  const Celula = ({ dia }: { dia: string }) => {
    const itens = porDia.get(dia) ?? []
    const previstos = previstosDe(dia)
    const tem = itens.length > 0
    const foraDoMes = modo === 'mes' && (dia < mesIni || dia > mesFim)
    const ehHoje = dia === hoje
    const pior = tem ? corDe(itens[0]) : null
    const intensidade = tem && maxDia > 0 ? Math.min(0.22, 0.04 + (itens.length / maxDia) * 0.18) : 0
    const mostrar = modo === 'mes' ? 2 : 10
    const abertas = itens.filter((t) => t.status === 'a_fazer' || t.status === 'em_andamento').length
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => { if (modo === 'mes') { setRef(dia); setModo('semana') } }}
        onKeyDown={(e) => { if (e.key === 'Enter' && modo === 'mes') { setRef(dia); setModo('semana') } }}
        title={modo === 'mes' ? 'Clique para ver a semana' : undefined}
        className={cn(
          'relative flex flex-col items-stretch overflow-hidden rounded-lg border p-2 text-left transition-colors',
          modo === 'mes' ? 'min-h-[7.5rem] cursor-pointer' : 'min-h-[16rem]',
          tem || previstos.length ? 'border-gray-200 bg-white hover:border-[#1e3a5f]/40 dark:border-gray-700 dark:bg-gray-900/70' : 'border-dashed border-gray-200 bg-transparent dark:border-gray-800',
          foraDoMes && 'opacity-40',
          ehHoje && 'ring-2 ring-emerald-500/70',
          pior && cn('border-l-[3px]', COR[pior].barraEsq),
        )}
      >
        {pior && intensidade > 0 && <span aria-hidden className={cn('pointer-events-none absolute inset-0', COR[pior].fundo)} style={{ opacity: intensidade }} />}
        <span className="relative flex items-center justify-between gap-1">
          <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums', ehHoje ? 'bg-emerald-500 text-white' : 'text-gray-500 dark:text-gray-400')}>{Number(dia.slice(8))}</span>
          {ehHoje && <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">hoje</span>}
          <span className="ml-auto flex items-center gap-1">
            {piorDia === dia && tem && <Flame className="h-3 w-3 text-red-500" aria-label="Dia mais pesado" />}
            {tem && <span className="rounded bg-gray-100 px-1 text-[10px] tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">{itens.length}</span>}
          </span>
        </span>
        {tem && (
          <span className={cn('relative mt-0.5 text-[12px] font-extrabold leading-tight', pior ? COR[pior].txt : '')}>
            {abertas > 0 ? `${abertas} aberta${abertas === 1 ? '' : 's'}` : 'tudo fechado'}
          </span>
        )}
        <span className="relative mt-1 hidden flex-col gap-0.5 md:flex">
          {itens.slice(0, mostrar).map((t) => {
            const cor = corDe(t)
            const fechada = t.status === 'concluida' || t.status === 'cancelada'
            return (
              <span
                key={t.id}
                role="link"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); onAbrir(t) }}
                className="flex items-center justify-between gap-1 text-[10px] leading-tight text-gray-700 hover:underline dark:text-gray-200"
                title={`${t.titulo}${ctx.nomePosto(t.empresa_codigo) ? ` · ${ctx.nomePosto(t.empresa_codigo)}` : ''}${ctx.nomeUsuario(t.responsavel_id) ? ` · ${ctx.nomeUsuario(t.responsavel_id)}` : ''}`}
              >
                <span className="flex min-w-0 items-center gap-1"><span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', COR[cor].dot)} /><span className={cn('truncate', fechada && 'text-gray-400 line-through dark:text-gray-500')}>{t.titulo}</span></span>
                <span className={cn('shrink-0 tabular-nums', cor === 'atrasada' ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500')}>{hora(t.vence_em)}</span>
              </span>
            )
          })}
          {itens.length > mostrar && <span className="text-[10px] text-gray-400">+{itens.length - mostrar} tarefa{itens.length - mostrar === 1 ? '' : 's'}</span>}
          {previstos.slice(0, modo === 'mes' ? 2 : 10).map((p) => (
            <span key={p.rotina.id} className="flex items-center justify-between gap-1 text-[10px] leading-tight text-gray-400 dark:text-gray-500" title={`Prevista: ${p.rotina.nome} (${p.quantidade}). A rotina cria a tarefa à meia-noite do dia.`}>
              <span className="flex min-w-0 items-center gap-1"><span className="h-1.5 w-1.5 shrink-0 rounded-full border border-emerald-500" /><span className="truncate">{p.rotina.nome}{p.quantidade > 1 ? ` ×${p.quantidade}` : ''}</span></span>
              <span className="shrink-0 tabular-nums">{p.rotina.hora_vencimento.slice(0, 5)}</span>
            </span>
          ))}
        </span>
        {/* Celular: só as bolinhas. */}
        <span className="mt-1 flex flex-wrap gap-0.5 md:hidden">
          {itens.slice(0, 6).map((t) => <span key={t.id} className={cn('h-1.5 w-1.5 rounded-full', COR[corDe(t)].dot)} />)}
          {previstos.length > 0 && <span className="h-1.5 w-1.5 rounded-full border border-emerald-500" />}
        </span>
        {tem && pior && (
          <span className="relative mt-auto pt-1">
            <span className="block h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <span className={cn('block h-full rounded-full', COR[pior].barra)} style={{ width: `${maxDia > 0 ? Math.max(4, (itens.length / maxDia) * 100) : 0}%` }} />
            </span>
          </span>
        )}
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-gray-100">
              Calendário de tarefas
              <InfoHint text="As tarefas de cada dia, com a cor do status; fundo mais forte e barra maior = dia com mais tarefas. Nos dias futuros aparece também o que as rotinas ainda vão gerar (bolinha vazada). Clique num dia para ver a semana; clique no título para abrir a tarefa. Os filtros da tela valem aqui também." />
            </span>
            <span className="block text-[11px] text-gray-500 dark:text-gray-400">
              {tarefasQ.isLoading ? 'carregando…' : (
                <>
                  <span data-agenda-titulo>{tituloPeriodo}</span> · {totalVisivel} tarefa{totalVisivel === 1 ? '' : 's'} · <b className="text-gray-700 dark:text-gray-300">{abertasVisiveis} aberta{abertasVisiveis === 1 ? '' : 's'}</b>
                  {piorDia && qtd(piorDia) > 0 && <> · dia mais pesado: <b className="text-gray-700 dark:text-gray-300">{ddmm(piorDia)}</b> ({qtd(piorDia)})</>}
                </>
              )}
            </span>
          </span>
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800" onClick={() => navegar(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" className="inline-flex h-7 items-center rounded-md border border-gray-200 px-2 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800" onClick={() => setRef(hoje)}>Hoje</button>
            <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800" onClick={() => navegar(1)} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></button>
          </span>
          <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
            {(['semana', 'mes'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setModo(m)}
                className={cn('rounded px-2.5 py-1 text-[11px] font-semibold', modo === m ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800')}>
                {m === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </span>
        </span>
      </div>

      {tarefasQ.error ? (
        <div className="p-6 text-sm text-red-600">Erro ao carregar: {(tarefasQ.error as Error).message}</div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_96px] gap-1.5">
              {DIAS.map((d) => <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">{d}</div>)}
              <div className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">Semana</div>
              {semanas.map((sem) => {
                const nSem = sem.reduce((s, d) => s + (noMes(d) ? qtd(d) : 0), 0)
                const abSem = sem.reduce((s, d) => s + (noMes(d) ? (porDia.get(d) ?? []).filter((t) => t.status === 'a_fazer' || t.status === 'em_andamento').length : 0), 0)
                return [
                  ...sem.map((dia) => <Celula key={dia} dia={dia} />),
                  <div key={`s-${sem[0]}`} className="flex flex-col items-end justify-center rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-right dark:border-gray-800 dark:bg-white/[0.03]">
                    <span className="text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-200">{nSem > 0 ? nSem : '—'}</span>
                    <span className="text-[10px] text-gray-400">{nSem > 0 ? `${abSem} aberta${abSem === 1 ? '' : 's'}` : 'nada'}</span>
                    {totalVisivel > 0 && nSem > 0 && <span className="text-[10px] tabular-nums text-gray-400">{Math.round((nSem / totalVisivel) * 100)}%</span>}
                  </div>,
                ]
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-400 dark:text-gray-500">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> atrasada</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> em andamento</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-400" /> a fazer</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> concluída</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-emerald-500" /> prevista (rotina, ainda não gerada)</span>
        <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-red-500" /> dia mais pesado</span>
        <span>· Fundo mais forte = mais tarefas no dia.{modo === 'mes' && ' Clique num dia para ver a semana.'}</span>
        {tarefasQ.isFetching && !tarefasQ.isLoading && <Loader2 className="ml-auto h-3 w-3 animate-spin text-gray-400" />}
      </div>
    </section>
  )
}

export default Agenda
