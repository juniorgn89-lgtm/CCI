import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, Loader2, Undo2, X, Search, Check, AlertCircle, Menu, Plus, ExternalLink, CalendarDays, Clock, User, Building2, ListChecks,
} from 'lucide-react'
import { estaAtrasada, STATUS_LABEL, type TarefaRow } from '@/api/supabase/gestaoTarefas'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { Modal, Erro } from './comumUi'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'

/**
 * Agenda da equipe — a parte visual, no modelo do Google Agenda (os dados e as
 * gravações vêm por props; ver AgendaEquipe.tsx). Ocupa a altura disponível e
 * só a grade rola por dentro: a barra do topo e a lateral ficam paradas.
 *
 * - Lateral recolhível (☰): Criar, mini calendário, pessoas com a sua cor.
 * - Visões: Dia (D), 4 dias (X), Semana (W), Mês (M), Ano (Y), Programação (A).
 *   T = hoje; J/N = próximo; K/P = anterior. Fins de semana e concluídas
 *   ligam/desligam no menu da visão.
 * - Dia/4 dias/Semana: régua de 24 h, cabeçalho dos dias preso, linha da hora
 *   atual; clicar num horário vazio cria tarefa ali (quem pode criar).
 * - Mês/Ano: a rodinha do mouse troca de mês/ano.
 * - Arrastar tarefa aberta muda dia/horário (de 15 em 15 min), com Desfazer.
 */

/** 'intervalo' = dias escolhidos arrastando no mini calendário (não fica salvo). */
export type ModoAgenda = 'dia' | 'quatro' | 'semana' | 'mes' | 'ano' | 'programacao' | 'intervalo'

export interface PeriodoAgenda { tarefas: TarefaRow[]; carregando: boolean; buscando: boolean; erro: string | null }

export interface AgendaVisaoProps {
  /** Hook que busca as tarefas do intervalo [de, ate] (sempre o mesmo hook). */
  usePeriodo: (de: string, ate: string) => PeriodoAgenda
  /** A equipe da rede (para a lista de pessoas e as cores). */
  equipe: { id: string; nome: string }[]
  nomeUsuario: (id: string | null) => string | null
  nomePosto: (codigo: number | null) => string | null
  nomeSetor: (id: string | null) => string | null
  podeMover: (t: TarefaRow) => boolean
  podeCriar: boolean
  onMover: (t: TarefaRow, novoVenceEm: string, motivo: string) => Promise<void>
  onAbrirTarefa: (t: TarefaRow) => void
  /** Detalhe completo aberto na própria agenda (no lugar do cartão-resumo). */
  renderDetalhe?: (t: TarefaRow, fechar: () => void) => React.ReactNode
  onCriar: (inicial: { data: string; hora?: string }) => void
  /** yyyy-MM-dd; padrão = hoje (o harness de teste fixa uma data). */
  hoje: string
}

const CHAVE_PREFS = 'visor360.gestao.agenda.prefs'
interface Prefs { modo: ModoAgenda; lateral: boolean; fds: boolean; fechadas: boolean }
const lerPrefs = (): Prefs => {
  const padrao: Prefs = { modo: 'semana', lateral: true, fds: true, fechadas: true }
  try {
    const p = { ...padrao, ...(JSON.parse(localStorage.getItem(CHAVE_PREFS) ?? '{}') as Partial<Prefs>) }
    return p.modo === 'intervalo' ? { ...p, modo: 'semana' } : p
  } catch { return padrao }
}

// Cores vivas (texto branco por cima), uma por pessoa.
const PALETA = ['#1a73e8', '#0b8043', '#f4511e', '#8e24aa', '#d81b60', '#039be5', '#e67c73', '#33b679', '#7986cb', '#f6bf26', '#3f51b5', '#616161']
const SEM_RESP = '__sem__'
const COR_SEM_RESP = '#64748b'

const DIAS_CURTOS = ['SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.', 'DOM.']
const DIAS_MINI = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const deIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const somaDias = (dia: string, n: number) => { const d = deIso(dia); d.setDate(d.getDate() + n); return iso(d) }
const dow = (dia: string) => (deIso(dia).getDay() + 6) % 7 // 0 = segunda
const segundaDe = (dia: string) => somaDias(dia, -dow(dia))
const primeiroDoMes = (dia: string) => `${dia.slice(0, 7)}-01`
const mudaMes = (dia: string, n: number) => { const d = deIso(dia); return iso(new Date(d.getFullYear(), d.getMonth() + n, 1)) }
const minutosDe = (isoDt: string) => { const d = new Date(isoDt); return d.getHours() * 60 + d.getMinutes() }
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
const novoVencimento = (dia: string, min: number) => { const d = deIso(dia); d.setHours(Math.floor(min / 60), min % 60, 0, 0); return d.toISOString() }
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const mesAno = (dia: string) => capital(deIso(dia).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
const mesCurto = (dia: string) => deIso(dia).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
const ehFds = (dia: string) => dow(dia) >= 5

/** Régua: altura de 1 hora; a tarefa ocupa 30 min (não tem duração). */
const PX_HORA = 48
const DURACAO = 30
const PASSO = 15
const ALTURA_BLOCO = (DURACAO / 60) * PX_HORA
const DIAS_PROGRAMACAO = 30

const aberta = (t: TarefaRow) => t.status === 'a_fazer' || t.status === 'em_andamento'

const VISOES: { id: ModoAgenda; rotulo: string; tecla: string }[] = [
  { id: 'dia', rotulo: 'Dia', tecla: 'D' },
  { id: 'semana', rotulo: 'Semana', tecla: 'W' },
  { id: 'mes', rotulo: 'Mês', tecla: 'M' },
  { id: 'ano', rotulo: 'Ano', tecla: 'Y' },
  { id: 'programacao', rotulo: 'Programação', tecla: 'A' },
  { id: 'quatro', rotulo: '4 dias', tecla: 'X' },
]

interface Movida { t: TarefaRow; de: string; para: string }

export const AgendaVisao = (p: AgendaVisaoProps) => {
  const { hoje } = p
  const [prefs, setPrefsState] = useState<Prefs>(lerPrefs)
  const setPrefs = (patch: Partial<Prefs>) => setPrefsState((cur) => {
    const n = { ...cur, ...patch }
    try { localStorage.setItem(CHAVE_PREFS, JSON.stringify(n)) } catch { /* sem storage */ }
    return n
  })
  const { modo, lateral, fds, fechadas } = prefs
  const setModo = (m: ModoAgenda) => setPrefs({ modo: m })
  // Dias escolhidos no mini calendário (arrastando): começa em `ref` e tem N dias.
  const [faixaN, setFaixaN] = useState(3)
  /** Até 14 dias vão lado a lado na régua de horas; mais que isso, em lista. */
  const MAX_GRADE = 14

  const [ref, setRef] = useState(hoje)
  const [mini, setMini] = useState(primeiroDoMes(hoje))
  const [pessoas, setPessoas] = useState<Set<string> | null>(null) // null = todas
  const [pessoasAbertas, setPessoasAbertas] = useState(true)
  const [buscaPessoa, setBuscaPessoa] = useState('')
  const [aberto, setAberto] = useState<TarefaRow | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [movida, setMovida] = useState<Movida | null>(null)
  const irPara = (dia: string) => { setRef(dia); setMini(primeiroDoMes(dia)) }

  /* ─── período ─── */
  const { de, ate, dias } = useMemo(() => {
    let ini: string, n: number
    if (modo === 'dia') { ini = ref; n = 1 }
    else if (modo === 'quatro') { ini = ref; n = 4 }
    else if (modo === 'semana') { ini = segundaDe(ref); n = 7 }
    else if (modo === 'mes') { ini = segundaDe(primeiroDoMes(ref)); n = 42 }
    else if (modo === 'ano') { ini = `${ref.slice(0, 4)}-01-01`; n = 0 }
    else if (modo === 'intervalo') { ini = ref; n = faixaN }
    else { ini = ref; n = DIAS_PROGRAMACAO }
    const fim = modo === 'ano' ? `${ref.slice(0, 4)}-12-31` : somaDias(ini, n - 1)
    let lista = n ? Array.from({ length: n }, (_, i) => somaDias(ini, i)) : []
    if (!fds && (modo === 'semana' || modo === 'mes')) lista = lista.filter((d) => !ehFds(d))
    return { de: ini, ate: fim, dias: lista }
  }, [modo, ref, fds, faixaN])
  const periodo = p.usePeriodo(de, ate)

  /* ─── cores e pessoas ─── */
  const corDe = useMemo(() => {
    const m = new Map<string, string>()
    ;[...p.equipe].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).forEach((u, i) => m.set(u.id, PALETA[i % PALETA.length]))
    return (id: string | null) => (id ? m.get(id) ?? COR_SEM_RESP : COR_SEM_RESP)
  }, [p.equipe])
  const chavePessoa = (t: TarefaRow) => t.responsavel_id ?? SEM_RESP
  const listaPessoas = useMemo(() => {
    const n = new Map<string, number>()
    for (const t of periodo.tarefas) if (fechadas || aberta(t)) n.set(chavePessoa(t), (n.get(chavePessoa(t)) ?? 0) + 1)
    const ids = new Set<string>([...p.equipe.map((u) => u.id), ...n.keys()])
    return [...ids]
      .map((id) => ({ id, qtd: n.get(id) ?? 0, nome: id === SEM_RESP ? 'Sem responsável' : p.nomeUsuario(id) ?? 'Usuário', cor: corDe(id === SEM_RESP ? null : id) }))
      .sort((a, b) => (b.qtd > 0 ? 1 : 0) - (a.qtd > 0 ? 1 : 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [periodo.tarefas, fechadas, p, corDe])
  const pessoasFiltradas = buscaPessoa.trim() ? listaPessoas.filter((x) => x.nome.toLowerCase().includes(buscaPessoa.trim().toLowerCase())) : listaPessoas
  const ligada = (id: string) => !pessoas || pessoas.has(id)
  const alternarPessoa = (id: string) => setPessoas((prev) => {
    const n = new Set(prev ?? listaPessoas.map((x) => x.id))
    if (n.has(id)) n.delete(id); else n.add(id)
    return n.size === listaPessoas.length ? null : n
  })

  const visiveis = useMemo(
    () => periodo.tarefas.filter((t) => (fechadas || aberta(t)) && (!pessoas || pessoas.has(chavePessoa(t)))),
    [periodo.tarefas, fechadas, pessoas],
  )
  const porDia = useMemo(() => {
    const m = new Map<string, TarefaRow[]>()
    for (const t of visiveis) { const l = m.get(t.vence_dia) ?? []; l.push(t); m.set(t.vence_dia, l) }
    for (const l of m.values()) l.sort((a, b) => a.vence_em.localeCompare(b.vence_em))
    return m
  }, [visiveis])

  /* ─── navegação, teclado e rodinha ─── */
  const navegar = (dir: number) => {
    if (modo === 'mes') irPara(mudaMes(ref, dir))
    else if (modo === 'ano') irPara(`${Number(ref.slice(0, 4)) + dir}-${ref.slice(5)}`)
    else irPara(somaDias(ref, dir * (modo === 'dia' ? 1 : modo === 'quatro' ? 4 : modo === 'semana' ? 7 : modo === 'intervalo' ? faixaN : DIAS_PROGRAMACAO)))
  }
  const navRef = useRef(navegar)
  navRef.current = navegar
  const atalhos = useRef({ setModo, hoje: () => irPara(hoje) })
  atalhos.current = { setModo, hoje: () => irPara(hoje) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return
      if (document.querySelector('[role="dialog"]')) return
      const k = e.key.toLowerCase()
      const v = VISOES.find((x) => x.tecla.toLowerCase() === k)
      if (v) { atalhos.current.setModo(v.id); e.preventDefault() }
      else if (k === 't') { atalhos.current.hoje(); e.preventDefault() }
      else if (k === 'j' || k === 'n') { navRef.current(1); e.preventDefault() }
      else if (k === 'k' || k === 'p') { navRef.current(-1); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Mês e Ano: a rodinha troca de período. Dia/Semana/Programação: a rodinha rola.
  const trocaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = trocaRef.current
    if (!el || (modo !== 'mes' && modo !== 'ano')) return
    let acumulado = 0
    let travadoAte = 0
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      e.preventDefault()
      const agora = Date.now()
      if (agora < travadoAte) return
      acumulado += e.deltaY
      if (Math.abs(acumulado) >= 60) {
        navRef.current(acumulado > 0 ? 1 : -1)
        acumulado = 0
        travadoAte = agora + 450
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [modo])

  // Régua: abre perto das tarefas (ou 7h), uma vez por período.
  const horasRef = useRef<HTMLDivElement>(null)
  const primeiraHora = useMemo(() => {
    const mins = visiveis.map((t) => minutosDe(t.vence_em))
    return mins.length ? Math.max(0, Math.floor(Math.min(...mins) / 60) - 1) : 7
  }, [visiveis])
  const rolouPara = useRef('')
  useLayoutEffect(() => {
    if (!horasRef.current || periodo.carregando) return
    const k = `${modo}:${de}`
    if (rolouPara.current === k) return
    rolouPara.current = k
    horasRef.current.scrollTop = primeiraHora * PX_HORA
  }, [modo, de, primeiraHora, periodo.carregando])

  /* ─── arrastar ─── */
  const arrastando = useRef<{ t: TarefaRow; offsetY: number } | null>(null)
  const [alvo, setAlvo] = useState<{ dia: string; min?: number } | null>(null)
  const mover = async (t: TarefaRow, dia: string, min: number, motivo = 'movida na agenda') => {
    const para = novoVencimento(dia, min)
    if (new Date(para).getTime() === new Date(t.vence_em).getTime()) return
    setErro(null)
    try {
      await p.onMover(t, para, motivo)
      if (motivo === 'movida na agenda') setMovida({ t: { ...t, vence_em: para, vence_dia: dia }, de: t.vence_em, para })
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
  }
  useEffect(() => {
    if (!movida) return
    const timer = window.setTimeout(() => setMovida(null), 8000)
    return () => window.clearTimeout(timer)
  }, [movida])
  const desfazer = async () => {
    if (!movida) return
    const { t, de: anterior } = movida
    setMovida(null)
    await mover(t, iso(new Date(anterior)), minutosDe(anterior), 'desfeito na agenda')
  }
  const iniciarArraste = (e: React.DragEvent, t: TarefaRow) => {
    if (!p.podeMover(t)) { e.preventDefault(); return }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    arrastando.current = { t, offsetY: e.clientY - r.top }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', t.id)
  }
  const fimArraste = () => { arrastando.current = null; setAlvo(null) }

  /* ─── textos do período ─── */
  const titulo = (() => {
    if (modo === 'mes') return mesAno(ref)
    if (modo === 'ano') return ref.slice(0, 4)
    if (modo === 'dia') return deIso(ref).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    const ini = dias[0] ?? de
    const fim = dias[dias.length - 1] ?? ate
    if (ini.slice(0, 7) === fim.slice(0, 7)) return `${Number(ini.slice(8))} – ${Number(fim.slice(8))} de ${mesCurto(fim)} de ${fim.slice(0, 4)}`
    return `${Number(ini.slice(8))} de ${mesCurto(ini)} – ${Number(fim.slice(8))} de ${mesCurto(fim)} de ${fim.slice(0, 4)}`
  })()
  const noPeriodo = modo === 'mes' ? visiveis.filter((t) => t.vence_dia.slice(0, 7) === ref.slice(0, 7)) : visiveis
  const abertasN = noPeriodo.filter(aberta).length
  const atrasadasN = noPeriodo.filter((t) => estaAtrasada(t)).length

  /* ─── bloco de tarefa (função de render: o arrastado não pode remontar) ─── */
  const bloco = (t: TarefaRow, tipo: 'grade' | 'linha') => {
    const cor = corDe(t.responsavel_id)
    const fechada = !aberta(t)
    const atrasada = estaAtrasada(t)
    const movivel = p.podeMover(t)
    const comuns = {
      type: 'button' as const,
      draggable: movivel,
      onDragStart: (e: React.DragEvent) => iniciarArraste(e, t),
      onDragEnd: fimArraste,
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); setAberto(t) },
    }
    if (tipo === 'linha') {
      return (
        <button key={t.id} {...comuns}
          className={cn('flex w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-[2px] text-left text-[12px] leading-tight hover:bg-gray-100 dark:hover:bg-white/[0.06]', movivel ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer', fechada && 'opacity-50')}>
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} />
          <span className={cn('shrink-0 tabular-nums', atrasada ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400')}>{hhmm(minutosDe(t.vence_em))}</span>
          <span className={cn('min-w-0 flex-1 truncate text-gray-800 dark:text-gray-100', fechada && 'line-through')}>{t.titulo}</span>
        </button>
      )
    }
    return (
      <button key={t.id} {...comuns}
        className={cn('flex h-full w-full min-w-0 items-center gap-1 overflow-hidden rounded-md px-1.5 text-left text-[12px] leading-tight text-white shadow-sm ring-1 ring-white transition-shadow hover:shadow-md dark:ring-gray-900', movivel ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer', fechada && 'opacity-45')}
        style={{ background: cor }}>
        {atrasada && <AlertCircle className="h-3 w-3 shrink-0" />}
        {fechada && <Check className="h-3 w-3 shrink-0" />}
        <span className={cn('min-w-0 truncate', fechada && 'line-through')}><b className="font-semibold">{t.titulo}</b>, {hhmm(minutosDe(t.vence_em))}</span>
      </button>
    )
  }

  /* ═══ LATERAL ═══ */
  const miniDias = useMemo(() => Array.from({ length: 42 }, (_, i) => somaDias(segundaDe(mini), i)), [mini])
  const naFaixa = (d: string) => (modo === 'semana' || modo === 'quatro' || modo === 'dia' || modo === 'intervalo') && d >= de && d <= ate

  // Mini calendário: segurar o clique num dia e arrastar até outro escolhe esses dias.
  const [sel, setSel] = useState<{ a: string; b: string } | null>(null)
  const selRef = useRef(sel)
  selRef.current = sel
  const ordenada = (x: { a: string; b: string }) => (x.a <= x.b ? [x.a, x.b] : [x.b, x.a])
  const naSelecao = (d: string) => { if (!sel) return false; const [i, f] = ordenada(sel); return d >= i && d <= f }
  const concluirSelecao = useRef<() => void>(() => {})
  concluirSelecao.current = () => {
    const atual = selRef.current
    if (!atual) return
    setSel(null)
    const [i, f] = ordenada(atual)
    const n = Math.round((deIso(f).getTime() - deIso(i).getTime()) / 86_400_000) + 1
    if (n <= 1) { irPara(i); return } // clique simples: vai para o dia
    setRef(i)
    setFaixaN(Math.min(n, 62))
    setModo('intervalo')
  }
  useEffect(() => {
    const solto = () => concluirSelecao.current()
    window.addEventListener('mouseup', solto)
    return () => window.removeEventListener('mouseup', solto)
  }, [])
  const lateralEl = (
    <aside className={cn('hidden shrink-0 flex-col overflow-hidden border-r border-gray-200 transition-[width] duration-200 dark:border-gray-800 lg:flex', lateral ? 'w-[256px]' : 'w-0 border-r-0')}>
      {/* Criar, mini calendário, busca e o título "Pessoas" ficam parados; só a lista de pessoas rola. */}
      <div className="flex min-h-0 w-[256px] flex-1 flex-col gap-5 overflow-hidden px-4 pb-4 pt-3 [&>*]:shrink-0">
        {p.podeCriar && (
          <button type="button" onClick={() => p.onCriar({ data: ref })}
            className="inline-flex h-12 w-fit items-center gap-3 rounded-2xl bg-white pl-4 pr-6 text-[14px] font-semibold text-gray-800 shadow-md ring-1 ring-gray-200 transition-shadow hover:shadow-lg dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700">
            <Plus className="h-5 w-5" /> Criar
          </button>
        )}

        {/* Mini calendário */}
        <div>
          <div className="mb-1 flex items-center justify-between pl-1">
            <span className="text-[13.5px] font-semibold text-gray-800 dark:text-gray-100">{mesAno(mini)}</span>
            <span className="flex">
              <button type="button" aria-label="Mês anterior" onClick={() => setMini(mudaMes(mini, -1))} className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06]"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Próximo mês" onClick={() => setMini(mudaMes(mini, 1))} className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06]"><ChevronRight className="h-4 w-4" /></button>
            </span>
          </div>
          <div className="grid select-none grid-cols-7 text-center">
            {DIAS_MINI.map((d, i) => <span key={i} className="py-1 text-[10.5px] font-semibold text-gray-500 dark:text-gray-400">{d}</span>)}
            {miniDias.map((d) => {
              const fora = d.slice(0, 7) !== mini.slice(0, 7)
              return (
                <span key={d} className={cn('flex justify-center py-[1px]', sel ? naSelecao(d) && 'bg-[#1a73e8]/25 dark:bg-teal-400/25' : naFaixa(d) && 'bg-[#1a73e8]/10 dark:bg-teal-400/10')}>
                  <button type="button"
                    onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); setSel({ a: d, b: d }) }}
                    onMouseEnter={() => { if (selRef.current) setSel((x) => (x ? { ...x, b: d } : x)) }}
                    onClick={(e) => { if (e.detail === 0) irPara(d) /* teclado (Enter/Espaço) */ }}
                    className={cn('h-7 w-7 rounded-full text-[11.5px] tabular-nums transition-colors',
                      d === hoje ? 'bg-[#1a73e8] font-bold text-white dark:bg-teal-600'
                        : d === ref ? 'bg-[#1a73e8]/15 font-bold text-[#1a73e8] dark:bg-teal-400/20 dark:text-teal-200'
                          : fora ? 'text-gray-400 hover:bg-gray-100 dark:text-gray-600 dark:hover:bg-white/[0.06]' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]')}>
                    {Number(d.slice(8))}
                  </button>
                </span>
              )
            })}
          </div>
        </div>

        {/* Pesquisar pessoas */}
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input value={buscaPessoa} onChange={(e) => setBuscaPessoa(e.target.value)} placeholder="Pesquisar pessoas"
            className="h-10 w-full rounded-lg border-0 bg-gray-100 pl-9 pr-2 text-[13px] text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/40 dark:bg-white/[0.06] dark:text-gray-100 dark:focus:ring-teal-500/40" />
        </label>

        {/* Pessoas: o título fica fixo; a lista rola por dentro. */}
        <div className="flex min-h-0 !shrink flex-1 flex-col">
          <button type="button" onClick={() => setPessoasAbertas((v) => !v)} className="flex w-full items-center justify-between rounded-md py-1 pl-1 text-[13.5px] font-semibold text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-white/[0.04]">
            Pessoas
            <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform', !pessoasAbertas && '-rotate-90')} />
          </button>
          {pessoasAbertas && (
            <ul className="-mr-2 mt-1 min-h-[96px] flex-1 space-y-px overflow-y-auto pr-2">
              {pessoasFiltradas.map((x) => {
                const on = ligada(x.id)
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => alternarPessoa(x.id)} onDoubleClick={() => setPessoas(new Set([x.id]))}
                      className="flex w-full items-center gap-3 rounded-md px-1 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-white/[0.05]">
                      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2" style={{ borderColor: x.cor, background: on ? x.cor : 'transparent' }}>
                        {on && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
                      </span>
                      <span className={cn('min-w-0 flex-1 truncate text-[13.5px]', on ? 'text-gray-800 dark:text-gray-100' : 'text-gray-500')}>{x.nome}</span>
                      {x.qtd > 0 && <span className="text-[11px] tabular-nums text-gray-400">{x.qtd}</span>}
                    </button>
                  </li>
                )
              })}
              {pessoasFiltradas.length === 0 && <li className="px-1 py-1 text-[12px] text-gray-400">Ninguém com esse nome.</li>}
              {pessoas && <li><button type="button" onClick={() => setPessoas(null)} className="px-1 py-1 text-[12px] font-semibold text-[#1a73e8] hover:underline dark:text-teal-300">Mostrar todas</button></li>}
            </ul>
          )}
        </div>

      </div>
    </aside>
  )

  /* ═══ DIA · 4 DIAS · SEMANA ═══ */
  const horas = Array.from({ length: 24 }, (_, i) => i)
  const yDe = (min: number) => (min / 60) * PX_HORA
  const [agoraMin, setAgoraMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() })
  useEffect(() => {
    const t = window.setInterval(() => { const d = new Date(); setAgoraMin(d.getHours() * 60 + d.getMinutes()) }, 60_000)
    return () => window.clearInterval(t)
  }, [])
  const posicoes = (itens: TarefaRow[]) => {
    const out: { t: TarefaRow; ini: number; faixa: number; faixas: number }[] = []
    let grupo: typeof out = []
    let fimGrupo = -1
    const fins: number[] = []
    const fechar = () => { const n = Math.max(1, ...grupo.map((g) => g.faixa + 1)); grupo.forEach((g) => { g.faixas = n }); grupo = [] }
    for (const t of itens) {
      const ini = minutosDe(t.vence_em)
      if (ini >= fimGrupo && grupo.length) { fechar(); fins.length = 0 }
      let faixa = fins.findIndex((f) => f <= ini)
      if (faixa < 0) { faixa = fins.length; fins.push(0) }
      fins[faixa] = ini + DURACAO
      const x = { t, ini, faixa, faixas: 1 }
      grupo.push(x); out.push(x)
      fimGrupo = Math.max(fimGrupo, ini + DURACAO)
    }
    if (grupo.length) fechar()
    return out
  }
  const minutoNoPonto = (clientY: number, col: HTMLElement, offset: number) => {
    const y = clientY - col.getBoundingClientRect().top - offset
    return Math.max(0, Math.min(24 * 60 - PASSO, Math.round(((y / PX_HORA) * 60) / PASSO) * PASSO))
  }
  const cols = `64px repeat(${dias.length}, minmax(0, 1fr))`

  const visaoHoras = (
    <div ref={horasRef} className="min-h-0 flex-1 overflow-auto">
      <div style={{ minWidth: dias.length > 4 ? 760 : 0 }}>
        {/* Cabeçalho dos dias — fica no alto enquanto as horas rolam */}
        <div className="sticky top-0 z-20 grid border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" style={{ gridTemplateColumns: cols }}>
          <div className="flex items-end justify-end pb-2 pr-2 text-[10px] text-gray-500">BRT</div>
          {dias.map((dia) => {
            const ehHoje = dia === hoje
            const itens = porDia.get(dia) ?? []
            const pend = itens.filter(aberta).length
            const atras = itens.filter((t) => estaAtrasada(t)).length
            return (
              <div key={dia} className={cn('border-l border-gray-200 px-2 pb-2 pt-2 dark:border-gray-800', dias.length === 1 ? 'text-left' : 'text-center')}>
                <div className={cn('text-[11px] font-semibold tracking-wider', ehHoje ? 'text-[#1a73e8] dark:text-teal-300' : 'text-gray-500 dark:text-gray-400')}>{DIAS_CURTOS[dow(dia)]}</div>
                <button type="button" onClick={() => { irPara(dia); setModo('dia') }}
                  className={cn('mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-full text-[24px] tabular-nums transition-colors', ehHoje ? 'bg-[#1a73e8] text-white dark:bg-teal-600' : 'text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/[0.06]')}>
                  {Number(dia.slice(8))}
                </button>
                <div className={cn('mt-1 flex h-5 items-center gap-1 truncate rounded px-1.5 text-[11px]', itens.length ? 'bg-gray-100 text-gray-700 dark:bg-white/[0.07] dark:text-gray-200' : '', dias.length === 1 ? 'w-fit' : 'justify-center')}>
                  {itens.length > 0 && <><ListChecks className="h-3 w-3 shrink-0" />{pend > 0 ? `${pend} ${pend === 1 ? 'pendente' : 'pendentes'}` : 'tudo feito'}{atras > 0 && <b className="text-red-600 dark:text-red-400">· {atras} atras.</b>}</>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Régua das 24 h */}
        <div className="grid" style={{ gridTemplateColumns: cols }}>
          <div className="relative" style={{ height: 24 * PX_HORA }}>
            {horas.map((h) => h > 0 && (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-gray-500 dark:text-gray-400" style={{ top: yDe(h * 60) }}>{pad(h)}:00</span>
            ))}
          </div>
          {dias.map((dia) => {
            const ehHoje = dia === hoje
            const itens = porDia.get(dia) ?? []
            const sobre = alvo?.dia === dia && alvo.min !== undefined ? alvo.min : null
            return (
              <div
                key={dia}
                className={cn('relative border-l border-gray-200 dark:border-gray-800', p.podeCriar && 'cursor-cell')}
                style={{ height: 24 * PX_HORA }}
                onClick={(e) => { if (!p.podeCriar) return; const min = Math.floor(minutoNoPonto(e.clientY, e.currentTarget, 0) / 30) * 30; p.onCriar({ data: dia, hora: hhmm(min) }) }}
                onDragOver={(e) => {
                  if (!arrastando.current) return
                  e.preventDefault(); e.dataTransfer.dropEffect = 'move'
                  const min = minutoNoPonto(e.clientY, e.currentTarget, arrastando.current.offsetY)
                  if (alvo?.dia !== dia || alvo.min !== min) setAlvo({ dia, min })
                }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setAlvo((a) => (a?.dia === dia ? null : a)) }}
                onDrop={(e) => { e.preventDefault(); const a = arrastando.current; const min = minutoNoPonto(e.clientY, e.currentTarget, a?.offsetY ?? 0); fimArraste(); if (a) void mover(a.t, dia, min) }}
              >
                {horas.map((h) => <span key={h} className="pointer-events-none absolute inset-x-0 border-t border-gray-200 dark:border-gray-800" style={{ top: yDe(h * 60) }} />)}
                {ehHoje && (
                  <span className="pointer-events-none absolute inset-x-0 z-[6] flex items-center" style={{ top: yDe(agoraMin) - 1 }}>
                    <span className="-ml-[6px] h-3 w-3 rounded-full bg-[#ea4335]" /><span className="h-[2px] flex-1 bg-[#ea4335]" />
                  </span>
                )}
                {sobre !== null && (
                  <span className="pointer-events-none absolute inset-x-1 z-[5] flex items-center rounded-md border-2 border-dashed border-[#1a73e8] bg-[#1a73e8]/10 px-1.5 text-[11px] font-semibold text-[#1a73e8] dark:border-teal-400 dark:bg-teal-400/10 dark:text-teal-300"
                    style={{ top: yDe(sobre), height: ALTURA_BLOCO }}>
                    {hhmm(sobre)}
                  </span>
                )}
                {posicoes(itens).map(({ t, ini, faixa, faixas }) => (
                  <div key={t.id} className="absolute z-[4] pr-1" style={{ top: yDe(ini), height: ALTURA_BLOCO, left: `${(faixa / faixas) * 100}%`, width: `${100 / faixas}%` }}>
                    {bloco(t, 'grade')}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  /* ═══ MÊS ═══ */
  const colsMes = dias.length / 6
  const visaoMes = (
    <div ref={trocaRef} className="flex min-h-0 flex-1 flex-col overflow-x-auto">
      <div className="grid min-h-0 min-w-[760px] flex-1" style={{ gridTemplateColumns: `repeat(${colsMes}, minmax(0, 1fr))`, gridTemplateRows: 'repeat(6, minmax(0, 1fr))' }}>
        {dias.map((dia, i) => {
          const itens = porDia.get(dia) ?? []
          const fora = dia.slice(0, 7) !== ref.slice(0, 7)
          const ehHoje = dia === hoje
          const sobre = alvo?.dia === dia && alvo.min === undefined
          const caber = 3
          return (
            <div
              key={dia}
              onDragOver={(e) => { if (!arrastando.current) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (alvo?.dia !== dia) setAlvo({ dia }) }}
              onDrop={(e) => { e.preventDefault(); const a = arrastando.current; fimArraste(); if (a) void mover(a.t, dia, minutosDe(a.t.vence_em)) }}
              onClick={() => { if (p.podeCriar) p.onCriar({ data: dia }) }}
              className={cn('flex min-h-0 flex-col gap-px overflow-hidden border-b border-r border-gray-200 px-1 pb-1 dark:border-gray-800', (i + 1) % colsMes === 0 && 'border-r-0', sobre && 'bg-[#1a73e8]/[0.08] dark:bg-teal-400/10', p.podeCriar && 'cursor-cell')}
            >
              <div className="flex flex-col items-center pt-1.5">
                {i < colsMes && <span className="text-[11px] font-semibold tracking-wider text-gray-500 dark:text-gray-400">{DIAS_CURTOS[dow(dia)]}</span>}
                <button type="button" onClick={(e) => { e.stopPropagation(); irPara(dia); setModo('dia') }}
                  className={cn('mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[12.5px] font-medium tabular-nums', ehHoje ? 'bg-[#1a73e8] text-white dark:bg-teal-600' : fora ? 'text-gray-400 hover:bg-gray-100 dark:text-gray-600 dark:hover:bg-white/[0.06]' : 'text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.06]')}>
                  {dia.slice(8) === '01' ? `${Number(dia.slice(8))} ${mesCurto(dia)}` : Number(dia.slice(8))}
                </button>
              </div>
              {itens.slice(0, caber).map((t) => bloco(t, 'linha'))}
              {itens.length > caber && (
                <button type="button" onClick={(e) => { e.stopPropagation(); irPara(dia); setModo('dia') }} className="rounded px-1.5 text-left text-[11.5px] font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.06]">
                  Mais {itens.length - caber}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  /* ═══ ANO ═══ */
  const contagemDia = useMemo(() => { const m = new Map<string, number>(); for (const [d, l] of porDia) m.set(d, l.length); return m }, [porDia])
  const maxDia = Math.max(1, ...contagemDia.values())
  const visaoAno = (
    <div ref={trocaRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, m) => `${ref.slice(0, 4)}-${pad(m + 1)}-01`).map((mes) => {
          const grade = Array.from({ length: 42 }, (_, i) => somaDias(segundaDe(mes), i))
          return (
            <div key={mes}>
              <button type="button" onClick={() => { irPara(mes); setModo('mes') }} className="mb-1 pl-1 text-[14px] font-semibold text-gray-800 hover:underline dark:text-gray-100">{capital(deIso(mes).toLocaleDateString('pt-BR', { month: 'long' }))}</button>
              <div className="grid grid-cols-7 text-center">
                {DIAS_MINI.map((d, i) => <span key={i} className="py-1 text-[10px] font-semibold text-gray-500">{d}</span>)}
                {grade.map((d) => {
                  const fora = d.slice(0, 7) !== mes.slice(0, 7)
                  const n = fora ? 0 : contagemDia.get(d) ?? 0
                  return (
                    <span key={d} className="flex justify-center py-[1px]">
                      <button type="button" disabled={fora} onClick={() => { irPara(d); setModo('dia') }}
                        className={cn('relative h-7 w-7 rounded-full text-[11.5px] tabular-nums transition-colors',
                          fora ? 'text-transparent' : d === hoje ? 'bg-[#1a73e8] font-bold text-white dark:bg-teal-600' : n ? 'font-semibold text-gray-900 hover:ring-2 hover:ring-[#1a73e8]/40 dark:text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]')}
                        style={!fora && n && d !== hoje ? { background: `rgba(26, 115, 232, ${0.12 + (n / maxDia) * 0.45})` } : undefined}
                        aria-label={n ? `${ddmm(d)}: ${n} tarefa${n === 1 ? '' : 's'}` : ddmm(d)}>
                        {Number(d.slice(8))}
                      </button>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-6 text-center text-[11px] text-gray-500">Cor mais forte = mais tarefas no dia. Clique num dia para abrir.</p>
    </div>
  )

  /* ═══ PROGRAMAÇÃO ═══ */
  const diasComTarefa = dias.filter((d) => (porDia.get(d) ?? []).length > 0)
  const visaoProgramacao = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {diasComTarefa.length === 0 && !periodo.carregando && (
        <p className="px-6 py-16 text-center text-[13px] text-gray-500">Nenhuma tarefa {modo === 'intervalo' ? 'nos dias escolhidos' : `nos próximos ${DIAS_PROGRAMACAO} dias`}{pessoas ? ' para as pessoas escolhidas' : ''}.</p>
      )}
      {diasComTarefa.map((dia) => (
        <div key={dia} className="grid grid-cols-[110px_minmax(0,1fr)] border-b border-gray-200 px-4 py-2 dark:border-gray-800">
          <button type="button" onClick={() => { irPara(dia); setModo('dia') }} className="flex items-start gap-2 self-start pt-1 text-left">
            <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full text-[20px] tabular-nums', dia === hoje ? 'bg-[#1a73e8] text-white dark:bg-teal-600' : 'text-gray-800 dark:text-gray-100')}>{Number(dia.slice(8))}</span>
            <span className={cn('pt-2 text-[11px] font-semibold uppercase tracking-wider', dia === hoje ? 'text-[#1a73e8] dark:text-teal-300' : 'text-gray-500')}>{mesCurto(dia)}, {DIAS_CURTOS[dow(dia)].replace('.', '').toLowerCase()}</span>
          </button>
          <ul>
            {(porDia.get(dia) ?? []).map((t) => {
              const fechada = !aberta(t)
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => setAberto(t)} className="grid w-full grid-cols-[18px_96px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                    <span className="h-3 w-3 rounded-full" style={{ background: corDe(t.responsavel_id) }} />
                    <span className={cn('text-[13px] tabular-nums', estaAtrasada(t) ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300')}>{hhmm(minutosDe(t.vence_em))}</span>
                    <span className="min-w-0">
                      <span className={cn('block truncate text-[13.5px] font-medium text-gray-900 dark:text-gray-100', fechada && 'text-gray-400 line-through dark:text-gray-500')}>{t.titulo}</span>
                      <span className="block truncate text-[11.5px] text-gray-500">{[p.nomeUsuario(t.responsavel_id) ?? 'Sem responsável', p.nomePosto(t.empresa_codigo)].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-semibold', estaAtrasada(t) ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : fechada ? 'bg-gray-100 text-gray-500 dark:bg-white/[0.06]' : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300')}>
                      {estaAtrasada(t) ? 'Atrasada' : STATUS_LABEL[t.status]}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )

  const rotuloVisao = modo === 'intervalo' ? `${faixaN} dias` : VISOES.find((v) => v.id === modo)?.rotulo ?? 'Semana'

  return (
    <section className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {/* ═══ BARRA DO TOPO (parada) ═══ */}
      <header className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-gray-200 px-2 py-2 dark:border-gray-800">
        <button type="button" onClick={() => setPrefs({ lateral: !lateral })} aria-label={lateral ? 'Recolher o menu' : 'Abrir o menu'}
          className="hidden h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06] lg:inline-flex">
          <Menu className="h-5 w-5" />
        </button>
        <span className="mr-3 hidden items-center gap-2 lg:inline-flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a73e8] text-[13px] font-bold text-white dark:bg-teal-600">{Number(hoje.slice(8))}</span>
          <span className="text-[19px] text-gray-700 dark:text-gray-200">Agenda</span>
        </span>
        <button type="button" onClick={() => irPara(hoje)} className="h-9 rounded-full border border-gray-300 px-5 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/[0.06]">Hoje</button>
        <button type="button" onClick={() => navegar(-1)} aria-label="Anterior" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" onClick={() => navegar(1)} aria-label="Próximo" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]"><ChevronRight className="h-5 w-5" /></button>
        <h2 className="ml-1 text-[21px] text-gray-800 dark:text-gray-100">{titulo}</h2>
        {periodo.buscando && <Loader2 className="ml-1 h-4 w-4 animate-spin text-gray-400" />}

        <span className="ml-auto flex items-center gap-2">
          <span className="hidden text-[12px] text-gray-500 xl:inline">
            {noPeriodo.length} {noPeriodo.length === 1 ? 'tarefa' : 'tarefas'} · {abertasN} {abertasN === 1 ? 'aberta' : 'abertas'}
            {atrasadasN > 0 && <b className="text-red-600 dark:text-red-400"> · {atrasadasN} {atrasadasN === 1 ? 'atrasada' : 'atrasadas'}</b>}
          </span>
          <InfoHint side="bottom" text="Cada pessoa tem uma cor; ligue e desligue na lateral (☰ recolhe). No Mês e no Ano, a rodinha do mouse troca de período; no Dia e na Semana ela rola as horas. Arraste uma tarefa aberta para outro dia ou horário: o vencimento muda e fica no histórico. Clique num horário vazio para criar uma tarefa ali. Arraste no mini calendário para escolher vários dias; dois cliques numa pessoa mostram só ela. Atalhos: D dia · W semana · M mês · Y ano · A programação · X 4 dias · T hoje · J/K próximo/anterior." />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex h-9 items-center gap-2 rounded-full border border-gray-300 pl-4 pr-3 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/[0.06]">
                {rotuloVisao} <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-800">
              {VISOES.map((v) => (
                <DropdownMenuItem key={v.id} onSelect={() => setModo(v.id)} className={cn('h-10 cursor-pointer rounded-lg px-3 text-[13.5px]', modo === v.id && 'bg-[#1a73e8]/10 font-semibold text-[#1a73e8] dark:bg-teal-500/15 dark:text-teal-200')}>
                  {v.rotulo}<DropdownMenuShortcut>{v.tecla}</DropdownMenuShortcut>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuCheckboxItem checked={fds} onCheckedChange={(v) => setPrefs({ fds: !!v })} onSelect={(e) => e.preventDefault()} className="h-10 cursor-pointer rounded-lg text-[13.5px]">Mostrar fins de semana</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={fechadas} onCheckedChange={(v) => setPrefs({ fechadas: !!v })} onSelect={(e) => e.preventDefault()} className="h-10 cursor-pointer rounded-lg text-[13.5px]">Mostrar tarefas concluídas</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {p.podeCriar && (
            <button type="button" onClick={() => p.onCriar({ data: ref })} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1a73e8] px-4 text-[13.5px] font-semibold text-white hover:bg-[#1765cc] dark:bg-teal-600 dark:hover:bg-teal-500', lateral && 'lg:hidden')}>
              <Plus className="h-4 w-4" /> Criar
            </button>
          )}
        </span>
      </header>

      {/* Tela estreita: pessoas em chips (a lateral some) */}
      <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-gray-200 px-3 py-2 [scrollbar-width:none] dark:border-gray-800 lg:hidden">
        {listaPessoas.filter((x) => x.qtd > 0).map((x) => (
          <button key={x.id} type="button" onClick={() => alternarPessoa(x.id)}
            className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]', ligada(x.id) ? 'border-gray-200 text-gray-800 dark:border-gray-700 dark:text-gray-100' : 'border-dashed border-gray-200 text-gray-400 dark:border-gray-700')}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: ligada(x.id) ? x.cor : 'transparent', boxShadow: `inset 0 0 0 2px ${x.cor}` }} />{x.nome} <span className="tabular-nums text-gray-400">{x.qtd}</span>
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {lateralEl}
        <div className="flex min-w-0 flex-1 flex-col">
          {(erro || periodo.erro) && <div className="px-4 pt-2"><Erro msg={erro ?? `Não foi possível carregar a agenda: ${periodo.erro}`} /></div>}
          {modo === 'mes' ? visaoMes : modo === 'ano' ? visaoAno : modo === 'programacao' || (modo === 'intervalo' && faixaN > MAX_GRADE) ? visaoProgramacao : visaoHoras}
        </div>
      </div>

      {/* Desfazer o último movimento */}
      {movida && (
        <div className="fixed inset-x-0 bottom-4 z-[80] flex justify-center px-3">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1e293b] px-4 py-2.5 text-[13px] text-white shadow-2xl">
            <span className="min-w-0 truncate"><b>{movida.t.titulo}</b> foi para {ddmm(iso(new Date(movida.para)))} às {hhmm(minutosDe(movida.para))}</span>
            <button type="button" onClick={() => void desfazer()} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-[12px] font-semibold hover:bg-white/20"><Undo2 className="h-3.5 w-3.5" /> Desfazer</button>
            <button type="button" aria-label="Fechar" onClick={() => setMovida(null)} className="shrink-0 rounded p-1 text-white/50 hover:text-white"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      {/* Tarefa clicada: detalhe completo ali mesmo (ou o cartão-resumo, se não houver) */}
      {aberto && p.renderDetalhe && p.renderDetalhe(aberto, () => setAberto(null))}
      {aberto && !p.renderDetalhe && (
        <Modal open onClose={() => setAberto(null)} largura="max-w-md"
          titulo={<span className="flex items-start gap-3"><span className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded" style={{ background: corDe(aberto.responsavel_id) }} /><span className={cn(!aberta(aberto) && 'line-through')}>{aberto.titulo}</span></span>}>
          <ul className="space-y-2.5 text-[13.5px] text-gray-800 dark:text-gray-100">
            <li className="flex items-center gap-3"><CalendarDays className="h-4 w-4 shrink-0 text-gray-400" />{capital(deIso(aberto.vence_dia).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))}</li>
            <li className="flex items-center gap-3"><Clock className="h-4 w-4 shrink-0 text-gray-400" /><span className="tabular-nums">{hhmm(minutosDe(aberto.vence_em))}</span>{estaAtrasada(aberto) && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">atrasada</span>}<span className="text-gray-500">· {STATUS_LABEL[aberto.status]}</span></li>
            <li className="flex items-center gap-3"><User className="h-4 w-4 shrink-0 text-gray-400" />{p.nomeUsuario(aberto.responsavel_id) ?? 'Sem responsável'}</li>
            {p.nomePosto(aberto.empresa_codigo) && <li className="flex items-center gap-3"><Building2 className="h-4 w-4 shrink-0 text-gray-400" /><span className="uppercase">{p.nomePosto(aberto.empresa_codigo)}</span>{aberto.setor_id && <span className="text-gray-500">· {p.nomeSetor(aberto.setor_id)}</span>}</li>}
            {aberto.checklist?.length > 0 && <li className="flex items-center gap-3"><ListChecks className="h-4 w-4 shrink-0 text-gray-400" /><span className="tabular-nums">{aberto.checklist.filter((c) => c.feito).length} de {aberto.checklist.length} etapas</span></li>}
          </ul>
          {aberto.descricao && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-[13px] text-gray-700 dark:bg-white/[0.04] dark:text-gray-300">{aberto.descricao}</p>}
          {!p.podeMover(aberto) && aberta(aberto) && <p className="mt-3 text-[11.5px] text-gray-500 dark:text-gray-400">Só o responsável ou quem gere tarefas pode mudar o horário desta tarefa.</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setAberto(null)} className="h-9 rounded-full px-4 text-[13.5px] font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]">Fechar</button>
            <button type="button" onClick={() => p.onAbrirTarefa(aberto)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1a73e8] px-4 text-[13.5px] font-semibold text-white hover:bg-[#1765cc] dark:bg-teal-600 dark:hover:bg-teal-500"><ExternalLink className="h-4 w-4" /> Abrir a tarefa</button>
          </div>
        </Modal>
      )}
    </section>
  )
}

export default AgendaVisao
