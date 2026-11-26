import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useFilters } from '@/hooks/useFilters'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, Plus, Loader2, Check, Play, RotateCcw, XCircle, Clock, AlertTriangle, Building2, User, Pencil, CalendarClock, History, ListChecks, X, Undo2, Repeat, Trash2, Camera, SlidersHorizontal, Search, Siren, ChevronDown, Circle, CircleCheck, MoreHorizontal,
} from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import {
  fetchTarefas, fetchTarefa, fetchAtividadesDaTarefa, criarTarefa, editarTarefa, adiarTarefa, mudarStatusTarefa, salvarChecklist, excluirTarefa, excluirTarefas, estaAtrasada,
  exigeAnexo, anexosFaltando, STATUS_LABEL, ATIVIDADE_VERBO, PRIORIDADE_LABEL, PRIORIDADE_PESO,
  type TarefaRow, type TarefaStatus, type ChecklistItem, type TarefaInput, type Prioridade,
} from '@/api/supabase/gestaoTarefas'
import { useGestaoBase, useAnexosTarefa, containerCls, inputCls, selectCls, labelCls, btnPrimary, btnGhost, fmtDataHora, fmtData, fmtPrazo, hojeLocal, somaDias } from './comum'
import { Modal, ModalRodape, Erro, Segmentos, ConfirmaAcao } from './comumUi'
import { Kanban } from './TarefasVisoes'
import { Agenda } from './Agenda'
import AnexosTarefa from './Anexos'
import SeletorPostos from './SeletorPostos'
import { BlocoForm, EtapasCampo } from './BlocoForm'
import { CAMPO, CAMPO_ERRO, ROTULO, ERRO_CAMPO, TRILHO, pilula, segmento, corPrioridade } from './estiloForm'
import { celebrarConclusao } from './concluirEvento'
import { SeloPrioridade } from './Prioridade'
import { ExigirAnexoCampos } from './Rotinas'
import useIsMobile from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import { GUIAS } from '@/lib/guiasModais'
import HeaderHint from '@/components/tables/HeaderHint'
import SeletorHora from '@/components/ui/SeletorHora'

/**
 * Gestão → Tarefas: as tarefas das rotinas e as avulsas da rede. Abas por
 * situação, filtros por posto/responsável/setor/status, detalhe com checklist,
 * histórico e ações (iniciar, concluir, reabrir, adiar, editar, cancelar).
 * Criar e editar é só gestor/diretor; executar e adiar é o responsável (ou gestor).
 */

type Aba = 'todas' | 'atrasadas' | 'hoje' | 'andamento' | 'minhas' | 'canceladas'
type Periodo = 7 | 14 | 30
type Visao = 'lista' | 'kanban' | 'agenda'

const STATUS_DOT: Record<TarefaStatus, string> = {
  a_fazer: 'bg-gray-400',
  em_andamento: 'bg-blue-500',
  concluida: 'bg-emerald-500',
  cancelada: 'bg-gray-300 dark:bg-gray-600',
}
const STATUS_CLS: Record<TarefaStatus, string> = {
  a_fazer: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  em_andamento: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  concluida: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelada: 'bg-gray-100 text-gray-400 line-through dark:bg-gray-800',
}

/** Preferências da tela (visão, período, filtros) — voltam como estavam ao reabrir. */
interface Prefs { visao?: Visao; periodo?: Periodo; resp?: string; setor?: string; posto?: string; status?: string }
const PREFS_KEY = 'visor360.gestao.tarefas'
const lerPrefs = (): Prefs => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Prefs } catch { return {} } }
const salvarPrefs = (p: Prefs) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...lerPrefs(), ...p })) } catch { /* sem storage, segue sem lembrar */ } }

/** Próxima segunda-feira (ou a de hoje, se hoje for domingo → amanhã). */
const proximaSegunda = (hoje: string) => { const [y, m, d] = hoje.split('-').map(Number); const dow = new Date(y, m - 1, d).getDay(); return somaDias(hoje, ((8 - dow) % 7) || 7) }

const horaDe = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const Tarefas = () => {
  const base = useGestaoBase()
  const qc = useQueryClient()
  const hoje = hojeLocal()
  // Lidas uma vez na montagem (lazy state, não ref: a regra de hooks proíbe ler ref no render).
  const [prefs] = useState(lerPrefs)
  const [periodo, setPeriodoState] = useState<Periodo>(prefs.periodo === 7 || prefs.periodo === 14 || prefs.periodo === 30 ? prefs.periodo : 30)
  const [visaoPref, setVisaoState] = useState<Visao>(prefs.visao === 'kanban' || prefs.visao === 'agenda' ? prefs.visao : 'lista')
  const isMobile = useIsMobile()
  const visao: Visao = isMobile && visaoPref === 'kanban' ? 'lista' : visaoPref
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const setPeriodo = (p: Periodo) => { setPeriodoState(p); salvarPrefs({ periodo: p }) }
  const setVisao = (v: Visao) => { setVisaoState(v); salvarPrefs({ visao: v }) }
  // ?aba= vem dos links do Painel (atrasadas / hoje).
  const [params] = useSearchParams()
  const abaInicial = params.get('aba')
  // Gestor começa em Todas; quem só executa começa nas suas pendentes.
  // null = "automática": resolvida na hora de usar, porque o perfil (podeGerir)
  // pode chegar depois do primeiro render num reload da página.
  const [abaEscolhida, setAba] = useState<Aba | null>(
    abaInicial === 'atrasadas' || abaInicial === 'hoje' || abaInicial === 'andamento' || abaInicial === 'minhas' || abaInicial === 'todas' || abaInicial === 'canceladas' ? abaInicial : null,
  )
  const aba: Aba = abaEscolhida ?? (base.podeGerir ? 'todas' : 'minhas')
  const [busca, setBusca] = useState('')
  // Link do Painel (?resp= etc.) manda; senão volta o que ficou da última vez.
  const [respSel, setRespSelState] = useState(params.get('resp') ?? prefs.resp ?? 'todos')
  const [setorSel, setSetorSelState] = useState(params.get('setor') ?? prefs.setor ?? 'todos')
  const [postoSel, setPostoSelState] = useState(params.get('posto') ?? prefs.posto ?? 'todos')
  const setRespSel = (v: string) => { setRespSelState(v); salvarPrefs({ resp: v }) }
  const setSetorSel = (v: string) => { setSetorSelState(v); salvarPrefs({ setor: v }) }
  const setPostoSel = (v: string) => { setPostoSelState(v); salvarPrefs({ posto: v }) }
  // Filtro global de posto (barra do topo) também vale aqui; tarefa sem posto sempre aparece.
  const { empresaCodigos } = useFilters()
  const [statusSel, setStatusSelState] = useState<'todos' | TarefaStatus | 'atrasada'>((prefs.status as 'todos' | TarefaStatus | 'atrasada' | undefined) ?? 'todos')
  const setStatusSel = (v: 'todos' | TarefaStatus | 'atrasada') => { setStatusSelState(v); salvarPrefs({ status: v }) }
  // Desfazer: faixa discreta depois de concluir (alguns segundos).
  const [desfazer, setDesfazer] = useState<{ t: TarefaRow; anterior: TarefaStatus } | null>(null)
  const desfazerTimer = useRef<number | null>(null)
  const [novaAberta, setNovaAberta] = useState(false)
  const [editando, setEditando] = useState<TarefaRow | null>(null)
  const [detalhe, setDetalhe] = useState<TarefaRow | null>(null)
  // Abrir o detalhe já com a confirmação de exclusão (vindo do botão da lista).
  const [excluindoDaLista, setExcluindoDaLista] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // ?tarefa=<id> (vem do "Abrir a tarefa" da Agenda): abre o detalhe dela,
  // mesmo que esteja fora do período da lista.
  const tarefaDoLink = params.get('tarefa')
  useEffect(() => {
    if (!tarefaDoLink) return
    let vivo = true
    fetchTarefa(tarefaDoLink).then((t) => { if (vivo && t) setDetalhe(t) }).catch(() => { /* sem acesso: segue na lista */ })
    return () => { vivo = false }
  }, [tarefaDoLink])

  // Janela: últimos N dias até 7 dias à frente (as próximas sempre aparecem).
  const de = somaDias(hoje, -periodo)
  const ate = somaDias(hoje, 7)
  const tarefas = useQuery({
    queryKey: ['gestao-tarefas', base.redeId, de, ate],
    queryFn: () => fetchTarefas(base.redeId!, de, ate),
    enabled: !!base.redeId,
    refetchInterval: 60_000,
  })
  const todas = useMemo(() => tarefas.data ?? [], [tarefas.data])

  const contagem = useMemo(() => ({
    todas: todas.length,
    atrasadas: todas.filter((t) => estaAtrasada(t)).length,
    hoje: todas.filter((t) => t.vence_dia === hoje && t.status !== 'concluida' && t.status !== 'cancelada').length,
    andamento: todas.filter((t) => t.status === 'em_andamento').length,
    minhas: todas.filter((t) => t.responsavel_id === base.userId && (t.status === 'a_fazer' || t.status === 'em_andamento')).length,
    canceladas: todas.filter((t) => t.status === 'cancelada').length,
  }), [todas, hoje, base.userId])

  // Filtro da página (abas + selects + busca + posto global). A Agenda usa o
  // mesmo filtro sobre as tarefas do mês que ela carrega por conta própria.
  const filtro = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (t: TarefaRow) => {
      if (aba === 'atrasadas' && !estaAtrasada(t)) return false
      if (aba === 'hoje' && !(t.vence_dia === hoje && t.status !== 'concluida' && t.status !== 'cancelada')) return false
      if (aba === 'andamento' && t.status !== 'em_andamento') return false
      if (aba === 'minhas' && !(t.responsavel_id === base.userId && (t.status === 'a_fazer' || t.status === 'em_andamento'))) return false
      if (aba === 'canceladas' && t.status !== 'cancelada') return false
      if (respSel === 'sem' ? t.responsavel_id !== null : respSel !== 'todos' && t.responsavel_id !== respSel) return false
      if (setorSel !== 'todos' && t.setor_id !== setorSel) return false
      if (postoSel === 'sem' ? t.empresa_codigo !== null : postoSel !== 'todos' && t.empresa_codigo !== Number(postoSel)) return false
      if (empresaCodigos.length > 0 && t.empresa_codigo !== null && !empresaCodigos.includes(t.empresa_codigo)) return false
      if (statusSel === 'atrasada' ? !estaAtrasada(t) : statusSel !== 'todos' && t.status !== statusSel) return false
      return !q || t.titulo.toLowerCase().includes(q) || (t.descricao ?? '').toLowerCase().includes(q) || (base.nomePosto(t.empresa_codigo) ?? '').toLowerCase().includes(q)
    }
  }, [aba, busca, respSel, setorSel, postoSel, empresaCodigos, statusSel, hoje, base])

  const lista = useMemo(() => {
    return todas.filter(filtro).sort((a, b) => {
      const peso = (t: TarefaRow) => (estaAtrasada(t) ? 0 : t.vence_dia === hoje && t.status !== 'concluida' && t.status !== 'cancelada' ? 1 : 2)
      // Mesma urgência: a de prioridade maior sobe; depois o prazo.
      return peso(a) - peso(b) || PRIORIDADE_PESO[a.prioridade ?? 'media'] - PRIORIDADE_PESO[b.prioridade ?? 'media'] || a.vence_em.localeCompare(b.vence_em)
    })
  }, [todas, filtro, hoje])

  // Seleção para apagar várias (hooks antes do return antecipado).
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [apagandoMassa, setApagandoMassa] = useState<'confirmar' | 'rodando' | null>(null)
  if (!base.redeId) return <div className="p-6 text-sm text-gray-500">Selecione uma rede para ver as tarefas.</div>

  const invalidar = (tarefaId?: string) => {
    void qc.invalidateQueries({ queryKey: ['gestao-tarefas', base.redeId] })
    void qc.invalidateQueries({ queryKey: ['gestao-atividades', base.redeId] })
    if (tarefaId) void qc.invalidateQueries({ queryKey: ['gestao-atividades-tarefa', tarefaId] })
  }

  const mudar = async (t: TarefaRow, status: TarefaStatus, obs?: string): Promise<boolean> => {
    setErro(null)
    try {
      await mudarStatusTarefa(t, status, base.autor, obs)
      invalidar(t.id)
      if (detalhe?.id === t.id) setDetalhe({ ...t, status })
      if (status === 'concluida') {
        setDesfazer({ t, anterior: t.status })
        if (desfazerTimer.current) window.clearTimeout(desfazerTimer.current)
        desfazerTimer.current = window.setTimeout(() => setDesfazer(null), 7000)
      }
      return true
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); return false }
  }
  const excluir = async (t: TarefaRow) => {
    setErro(null)
    try {
      await excluirTarefa(t)
      setDetalhe(null)
      setExcluindoDaLista(false)
      invalidar()
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
  }
  // Seleção para apagar várias (supervisor e acima).
  // Só conta o que está na lista agora (trocar o filtro não apaga escondida).
  const selVis = lista.filter((t) => selecionadas.has(t.id))
  const alternar = (id: string) => setSelecionadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const apagarSelecionadas = async () => {
    setErro(null); setApagandoMassa('rodando')
    try {
      await excluirTarefas(selVis.map((t) => t.id))
      setSelecionadas(new Set())
      setApagandoMassa(null)
      invalidar()
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); setApagandoMassa('confirmar') }
  }

  const voltarAtras = async () => {
    if (!desfazer) return
    const { t, anterior } = desfazer
    setDesfazer(null)
    await mudar({ ...t, status: 'concluida' }, anterior, 'desfeito logo após concluir')
  }

  const adiar = async (t: TarefaRow, novoVenceEm: string, motivo?: string) => {
    setErro(null)
    try {
      await adiarTarefa(t, novoVenceEm, base.autor, motivo)
      invalidar(t.id)
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
  }

  const abas: { id: Aba; label: string; n: number; cor?: string }[] = [
    { id: 'todas', label: 'Todas', n: contagem.todas },
    { id: 'atrasadas', label: 'Atrasadas', n: contagem.atrasadas, cor: 'text-red-600 dark:text-red-400' },
    { id: 'hoje', label: 'Vencem hoje', n: contagem.hoje, cor: 'text-amber-600 dark:text-amber-400' },
    { id: 'andamento', label: 'Em andamento', n: contagem.andamento },
    { id: 'minhas', label: 'Minhas pendentes', n: contagem.minhas },
    { id: 'canceladas', label: 'Canceladas', n: contagem.canceladas, cor: 'text-gray-400' },
  ]

  const tarefaAtual = detalhe ? (todas.find((t) => t.id === detalhe.id) ?? detalhe) : null

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
          {abas.map((a) => (
            <button key={a.id} type="button" onClick={() => setAba(a.id)}
              className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', aba === a.id ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : cn('text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800', a.cor))}>
              {a.label}
              <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', aba === a.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800')}>{a.n}</span>
            </button>
          ))}
          <InfoHint className="ml-1 hidden md:inline-flex" text="Atrasadas: abertas que passaram do vencimento. Vencem hoje: abertas com prazo hoje. Em andamento: alguém já começou. Minhas pendentes: as suas abertas. Canceladas: as que saíram do caminho (dá para reabrir ou, sendo gestor, excluir de vez). Os números contam o período escolhido à direita." />
        </div>
        <span className="flex w-full flex-wrap items-center gap-2 md:ml-auto md:w-auto">
          <Segmentos<Visao> opcoes={isMobile ? [{ value: 'lista', label: 'Lista' }, { value: 'agenda', label: 'Agenda' }] : [{ value: 'lista', label: 'Lista' }, { value: 'kanban', label: 'Kanban' }, { value: 'agenda', label: 'Agenda' }]} valor={visao} onChange={setVisao} />
          <span className="hidden md:contents">
            <Segmentos<Periodo> opcoes={[{ value: 7, label: '7 dias' }, { value: 14, label: '14 dias' }, { value: 30, label: '30 dias' }]} valor={periodo} onChange={setPeriodo} />
            <InfoHint text="Lista, Kanban (arraste entre colunas) ou Agenda (calendário do mês). O período é quantos dias para trás a lista mostra; os próximos 7 dias aparecem sempre." />
          </span>
          {isMobile && (() => {
            const ativos = [postoSel !== 'todos', respSel !== 'todos', setorSel !== 'todos', statusSel !== 'todos'].filter(Boolean).length
            return (
              <button type="button" className={cn(btnGhost, 'h-9 px-2.5', (filtrosAbertos || ativos > 0) && 'border-[#1e3a5f] text-[#1e3a5f] dark:border-blue-500 dark:text-blue-300')} onClick={() => setFiltrosAbertos((v) => !v)} aria-expanded={filtrosAbertos}>
                <SlidersHorizontal className="h-4 w-4" /> Filtrar{ativos > 0 && <span className="rounded-full bg-[#1e3a5f] px-1.5 text-[10px] font-bold text-white dark:bg-blue-600">{ativos}</span>}
              </button>
            )
          })()}
          {base.podeGerir && <button type="button" className={cn(btnPrimary, 'ml-auto md:ml-0')} onClick={() => setNovaAberta(true)}><Plus className="h-4 w-4" /> Nova<span className="hidden sm:inline"> tarefa</span></button>}
        </span>
      </div>

      <div className={cn('flex-wrap items-center gap-2', isMobile && !filtrosAbertos ? 'hidden' : 'flex')}>
        <input className={cn(inputCls, 'h-9 min-w-[12rem] flex-1')} placeholder="Buscar tarefa…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {isMobile && <Segmentos<Periodo> opcoes={[{ value: 7, label: '7 dias' }, { value: 14, label: '14 dias' }, { value: 30, label: '30 dias' }]} valor={periodo} onChange={setPeriodo} />}
        <select className={cn(selectCls, 'h-9 w-full sm:w-auto')} value={postoSel} onChange={(e) => setPostoSel(e.target.value)}>
          <option value="todos">Todos os postos</option>
          <option value="sem">Sem posto (rede)</option>
          {base.postos.map((p) => <option key={p.codigo} value={p.codigo}>{p.fantasia || p.razao || `Posto ${p.codigo}`}</option>)}
        </select>
        <select className={cn(selectCls, 'h-9 w-full sm:w-auto')} value={respSel} onChange={(e) => setRespSel(e.target.value)}>
          <option value="todos">Todos os responsáveis</option>
          <option value="sem">Sem responsável</option>
          {base.usuarios.map((u) => <option key={u.user_id} value={u.user_id}>{u.nome}</option>)}
        </select>
        <select className={cn(selectCls, 'h-9 w-full sm:w-auto')} value={setorSel} onChange={(e) => setSetorSel(e.target.value)}>
          <option value="todos">Todos os setores</option>
          {base.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select className={cn(selectCls, 'h-9 w-full sm:w-auto')} value={statusSel} onChange={(e) => setStatusSel(e.target.value as typeof statusSel)}>
          <option value="todos">Todos os status</option>
          <option value="a_fazer">A fazer</option>
          <option value="em_andamento">Em andamento</option>
          <option value="atrasada">Atrasada</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      <Erro msg={erro} />

      {visao === 'kanban' && !tarefas.isLoading && (
        <Kanban tarefas={lista} ctx={base} onAbrir={setDetalhe} onMudar={mudar} />
      )}
      {visao === 'agenda' && <Agenda ctx={{ redeId: base.redeId, nomePosto: base.nomePosto, nomeUsuario: base.nomeUsuario }} filtro={filtro} onAbrir={setDetalhe} />}

      {visao === 'lista' && base.podeApagarEmMassa && selVis.length > 0 && (
        apagandoMassa ? (
          <ConfirmaAcao perigo titulo={`Apagar ${selVis.length} ${selVis.length === 1 ? 'tarefa' : 'tarefas'} de vez?`}
            texto="Some a tarefa com o checklist, os anexos e o histórico. Não dá para desfazer. Para só tirar do caminho, use Cancelar dentro da tarefa."
            rotulo={`Apagar ${selVis.length}`} ocupado={apagandoMassa === 'rodando'}
            onVoltar={() => setApagandoMassa(null)} onConfirmar={apagarSelecionadas} />
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-[13px] text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-100">
            <span className="font-semibold">{selVis.length} {selVis.length === 1 ? 'tarefa selecionada' : 'tarefas selecionadas'}</span>
            <button type="button" onClick={() => setSelecionadas(new Set())} className="text-[12px] text-red-700 underline-offset-2 hover:underline dark:text-red-300">Limpar seleção</button>
            <button type="button" onClick={() => setApagandoMassa('confirmar')} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-[12.5px] font-semibold text-white hover:bg-red-700"><Trash2 className="h-4 w-4" /> Apagar selecionadas</button>
          </div>
        )
      )}

      {visao === 'lista' && <div className={cn(containerCls, 'overflow-hidden')}>
        {tarefas.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando tarefas…</div>
        ) : tarefas.error ? (
          <div className="p-6 text-sm text-red-600">Erro ao carregar: {(tarefas.error as Error).message}</div>
        ) : lista.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
            <ClipboardList className="mx-auto mb-2 h-6 w-6 opacity-50" />
            {todas.length === 0 ? 'Nenhuma tarefa no período.' : 'Nenhuma tarefa com esses filtros.'}
            {todas.length === 0 && base.podeGerir && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Link to="/gestao?tab=rotinas" className={btnGhost}><Repeat className="h-4 w-4" /> Criar uma rotina</Link>
                <button type="button" className={btnPrimary} onClick={() => setNovaAberta(true)}><Plus className="h-4 w-4" /> Nova tarefa</button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Celular: cards (a tabela não cabe). */}
            <ul className="divide-y divide-gray-100 md:hidden dark:divide-gray-800">
              {lista.map((t) => {
                const atrasada = estaAtrasada(t)
                const feitos = t.checklist.filter((c) => c.feito).length
                return (
                  <li key={t.id} className="space-y-2 px-4 py-3 text-gray-800 dark:text-gray-200">
                    <button type="button" onClick={() => setDetalhe(t)} className="block w-full text-left">
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-medium leading-snug">{t.titulo} <SeloPrioridade p={t.prioridade} className="ml-1 align-middle" /></span>
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', atrasada ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : STATUS_CLS[t.status])}>
                          {atrasada ? 'Atrasada' : STATUS_LABEL[t.status]}
                        </span>
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                        <span className={cn('inline-flex items-center gap-1 tabular-nums', atrasada && 'font-semibold text-red-600 dark:text-red-400')} title={fmtDataHora(t.vence_em)}><Clock className="h-3 w-3" />{fmtPrazo(t.vence_em, t.status === 'a_fazer' || t.status === 'em_andamento')}</span>
                        {t.empresa_codigo !== null && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{base.nomePosto(t.empresa_codigo)}</span>}
                        <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{base.nomeUsuario(t.responsavel_id) ?? 'sem responsável'}</span>
                        {t.checklist.length > 0 && <span>{feitos}/{t.checklist.length} etapas</span>}
                        {exigeAnexo(t) && <span className="inline-flex items-center gap-1"><Camera className="h-3 w-3" />{t.documentos_exigidos?.length ? `${t.documentos_exigidos.length} doc.` : 'foto'}</span>}
                      </span>
                    </button>
                    <div className="flex justify-end [&>button]:w-full [&>button]:h-10 [&>span]:w-full [&>span>button]:h-10 [&>span>button]:flex-1"><AcoesTarefa t={t} onMudar={mudar} compacto onAbrir={setDetalhe} onExcluir={base.podeGerir ? (x) => { setDetalhe(x); setExcluindoDaLista(true) } : undefined} /></div>
                  </li>
                )
              })}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-transparent dark:text-gray-400">
                  <tr className="text-left">
                    {base.podeApagarEmMassa && (
                      <th className="w-10 py-2.5 pl-4">
                        <input type="checkbox" aria-label="Selecionar todas as tarefas da lista" className="h-4 w-4 cursor-pointer accent-red-600"
                          checked={lista.length > 0 && lista.every((t) => selecionadas.has(t.id))}
                          ref={(el) => { if (el) el.indeterminate = lista.some((t) => selecionadas.has(t.id)) && !lista.every((t) => selecionadas.has(t.id)) }}
                          onChange={(e) => setSelecionadas(e.target.checked ? new Set(lista.map((t) => t.id)) : new Set())} />
                      </th>
                    )}
                    <HeaderHint align="left" className="px-4 font-semibold" label="Status" help="A fazer: ninguém começou. Em andamento: alguém começou (marcar a primeira etapa do checklist já faz isso). Atrasada: aberta e passou do prazo. Concluída e Cancelada fecham a tarefa; Reabrir volta para A fazer." />
                    <th className="px-3 py-2.5 font-semibold">Tarefa</th>
                    <th className="px-3 py-2.5 font-semibold">Posto</th>
                    <th className="px-3 py-2.5 font-semibold">Responsável</th>
                    <HeaderHint align="left" className="font-semibold" label="Vencimento" help="Data e hora do prazo; embaixo, em palavras: hoje, amanhã ou há quanto tempo está atrasada. Atrasadas vêm primeiro, depois as de hoje." />
                    <HeaderHint align="right" className="px-4 font-semibold" label="Ação" help="Sem checklist: Marcar como feita, direto, com Desfazer por alguns segundos. Com checklist pendente: Abrir checklist, para marcar as etapas antes de concluir. Adiar, editar e cancelar ficam dentro da tarefa." />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {lista.map((t) => {
                    const atrasada = estaAtrasada(t)
                    const aberta = t.status === 'a_fazer' || t.status === 'em_andamento'
                    const feitos = t.checklist.filter((c) => c.feito).length
                    const posto = base.nomePosto(t.empresa_codigo)
                    const setor = base.nomeSetor(t.setor_id)
                    return (
                      <tr key={t.id} onClick={() => setDetalhe(t)} className={cn('cursor-pointer text-gray-800 hover:bg-gray-50/60 dark:text-gray-200 dark:hover:bg-gray-800/30', selecionadas.has(t.id) && 'bg-red-50/50 dark:bg-red-950/20')}>
                        {base.podeApagarEmMassa && (
                          <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" aria-label={`Selecionar ${t.titulo}`} className="h-4 w-4 cursor-pointer accent-red-600" checked={selecionadas.has(t.id)} onChange={() => alternar(t.id)} />
                          </td>
                        )}
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', atrasada ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : STATUS_CLS[t.status])}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', atrasada ? 'bg-red-500' : STATUS_DOT[t.status])} />
                            {atrasada ? 'Atrasada' : STATUS_LABEL[t.status]}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <button type="button" onClick={() => setDetalhe(t)} className="text-left">
                            <span className={cn('flex items-center gap-1.5 font-semibold', !aberta && 'text-gray-500 dark:text-gray-400')}><span className="hover:underline">{t.titulo}</span><SeloPrioridade p={t.prioridade} /></span>
                            <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-gray-500 dark:text-gray-400">
                              <span>{t.rotina_id ? 'rotina' : 'avulsa'}</span>
                              {t.checklist.length > 0 && <span className={cn('inline-flex items-center gap-0.5', feitos === t.checklist.length && 'text-emerald-600 dark:text-emerald-400')}><ListChecks className="h-3 w-3" />{feitos}/{t.checklist.length} etapas</span>}
                              {t.data_ref && t.data_ref !== t.vence_dia && <span>ref. {fmtData(t.data_ref)}</span>}
                              {exigeAnexo(t) && <span className="inline-flex items-center gap-0.5"><Camera className="h-3 w-3" />{t.documentos_exigidos?.length ? `${t.documentos_exigidos.length} documento(s) exigido(s)` : 'foto obrigatória'}</span>}
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <span className="block uppercase text-gray-700 dark:text-gray-200">{posto ?? 'Rede'}</span>
                          {setor && <span className="block text-[11px] text-gray-400 dark:text-gray-500">{setor}</span>}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-200">{base.nomeUsuario(t.responsavel_id) ?? <span className="text-gray-400">sem responsável</span>}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs">
                          <span className={cn('block tabular-nums', atrasada ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200')}>
                            {atrasada && <AlertTriangle className="mr-1 inline h-3 w-3" />}{fmtDataHora(t.vence_em)}
                          </span>
                          {aberta && <span className={cn('block text-[11px]', atrasada ? 'text-red-500/80' : 'text-gray-400 dark:text-gray-500')}>{fmtPrazo(t.vence_em, true)}</span>}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <AcoesTarefa t={t} onMudar={mudar} compacto onAbrir={setDetalhe} onExcluir={base.podeGerir ? (x) => { setDetalhe(x); setExcluindoDaLista(true) } : undefined} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400 dark:border-gray-800 dark:text-gray-500">
              {lista.length} tarefa{lista.length === 1 ? '' : 's'} · ordenadas por urgência (atrasadas, depois as de hoje, depois por prazo)
            </div>
          </>
        )}
      </div>}

      {desfazer && (
        <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6" role="status">
          <div className="flex items-center gap-3 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm shadow-lg dark:border-emerald-900/50 dark:bg-[#161616]">
            <Check className="h-4 w-4 text-emerald-600" />
            <span className="text-gray-800 dark:text-gray-200">Tarefa concluída.</span>
            <button type="button" className="inline-flex items-center gap-1 font-semibold text-[#1e3a5f] hover:underline dark:text-blue-300" onClick={() => void voltarAtras()}><Undo2 className="h-3.5 w-3.5" /> Desfazer</button>
            <button type="button" className="text-gray-400 hover:text-gray-600" onClick={() => setDesfazer(null)} aria-label="Fechar"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
      {novaAberta && <TarefaForm onClose={() => setNovaAberta(false)} onSalva={() => { setNovaAberta(false); invalidar() }} />}
      {editando && (
        <TarefaForm
          tarefa={editando}
          onClose={() => setEditando(null)}
          onSalva={() => { invalidar(editando.id); setEditando(null) }}
        />
      )}
      {tarefaAtual && !editando && (
        <TarefaDetalhe
          key={`${tarefaAtual.id}-${tarefaAtual.atualizado_em}`}
          tarefa={tarefaAtual}
          onClose={() => { setDetalhe(null); setExcluindoDaLista(false) }}
          onMudar={mudar}
          onAdiar={adiar}
          onExcluir={base.podeGerir ? excluir : undefined}
          excluindoInicial={excluindoDaLista}
          onEditar={base.podeGerir ? (t) => setEditando(t) : undefined}
          onChecklist={async (t, lista) => {
            setErro(null)
            try { await salvarChecklist(t, lista, base.autor); invalidar(t.id) } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
          }}
        />
      )}
    </div>
  )
}

/* ─── ações de status ─────────────────────────────────────────────────── */

/**
 * Ações de status. Na lista (compacto) a regra evita concluir sem fazer:
 * tarefa com checklist incompleto só oferece "Abrir checklist" (vai pro
 * detalhe, onde as etapas ficam visíveis); sem checklist, Concluir direto.
 * Iniciar fica só no detalhe. Errou? Reabrir, e o histórico guarda os dois.
 */
const AcoesTarefa = ({ t, onMudar, compacto, destaque, onAbrir, onExcluir, bloqueio }: {
  t: TarefaRow; onMudar: (t: TarefaRow, s: TarefaStatus) => void; compacto?: boolean; destaque?: boolean; onAbrir?: (t: TarefaRow) => void
  /** Só gestor/diretor: aparece nas canceladas da lista. */
  onExcluir?: (t: TarefaRow) => void
  /** Motivo de não poder concluir ainda (ex.: falta anexo). Desliga o Concluir. */
  bloqueio?: string | null
}) => {
  const b = cn(btnGhost, compacto ? 'h-7 px-2 text-xs' : 'h-9')
  const concluirCls = destaque
    ? cn(b, 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600')
    : cn(b, 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300')
  const aberta = t.status === 'a_fazer' || t.status === 'em_andamento'
  const checklistPendente = t.checklist.length > 0 && t.checklist.some((c) => !c.feito)
  if (compacto && aberta) {
    if (checklistPendente && onAbrir) {
      const feitos = t.checklist.filter((c) => c.feito).length
      return (
        <button type="button" className={b} onClick={() => onAbrir(t)} title="Marque as etapas antes de concluir">
          <ListChecks className="h-3.5 w-3.5" /> Abrir checklist <span className="tabular-nums text-gray-400">{feitos}/{t.checklist.length}</span>
        </button>
      )
    }
    if (exigeAnexo(t) && onAbrir) {
      return (
        <button type="button" className={b} onClick={() => onAbrir(t)} title="Esta tarefa só conclui com foto ou documento">
          <Camera className="h-3.5 w-3.5" /> Anexar e concluir
        </button>
      )
    }
    return (
      <button type="button" onClick={() => onMudar(t, 'concluida')}
        className={cn(b, 'group hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:border-emerald-500/70 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300')}>
        <Circle className="h-3.5 w-3.5 text-gray-400 group-hover:hidden" />
        <CircleCheck className="hidden h-3.5 w-3.5 group-hover:block" />
        Marcar como feita
      </button>
    )
  }
  const concluir = (
    <button type="button" className={cn(concluirCls, bloqueio && 'cursor-not-allowed opacity-50')} onClick={() => { if (!bloqueio) onMudar(t, 'concluida') }} aria-disabled={!!bloqueio} title={bloqueio ?? undefined}>
      <Check className="h-3.5 w-3.5" /> Concluir
    </button>
  )
  if (t.status === 'a_fazer') return (
    <span className="inline-flex gap-1">
      <button type="button" className={b} onClick={() => onMudar(t, 'em_andamento')}><Play className="h-3.5 w-3.5" /> Iniciar</button>
      {concluir}
    </span>
  )
  if (t.status === 'em_andamento') return concluir
  return (
    <span className="inline-flex gap-1">
      <button type="button" className={b} onClick={() => onMudar(t, 'a_fazer')}><RotateCcw className="h-3.5 w-3.5" /> Reabrir</button>
      {compacto && onExcluir && t.status === 'cancelada' && (
        <button type="button" className={cn(b, 'text-red-600 dark:text-red-400')} onClick={() => onExcluir(t)} title="Excluir de vez (só gestor ou diretor)"><Trash2 className="h-3.5 w-3.5" /> Excluir</button>
      )}
    </span>
  )
}

/* ─── detalhe fora da aba Tarefas (Agenda) ──────────────────────────────── */

/**
 * O MESMO detalhe da aba Tarefas (checklist, anexos, iniciar/concluir, adiar,
 * editar, cancelar, histórico), para abrir em outra tela — a Agenda — sem sair
 * dela. Depois de cada ação relê a tarefa do banco, então o que aparece é
 * sempre o estado gravado.
 */
export const TarefaDetalheSolto = ({ tarefa, onClose }: { tarefa: TarefaRow; onClose: () => void }) => {
  const base = useGestaoBase()
  const qc = useQueryClient()
  const [atual, setAtual] = useState(tarefa)
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = async (id: string) => {
    void qc.invalidateQueries({ queryKey: ['gestao-tarefas', base.redeId] })
    void qc.invalidateQueries({ queryKey: ['gestao-atividades', base.redeId] })
    void qc.invalidateQueries({ queryKey: ['gestao-atividades-tarefa', id] })
    const nova = await fetchTarefa(id).catch(() => null)
    if (nova) setAtual(nova)
  }
  const tentar = async (fn: () => Promise<unknown>, id: string, releDetalhe = true): Promise<boolean> => {
    setErro(null)
    try {
      await fn()
      if (releDetalhe) await recarregar(id)
      else {
        void qc.invalidateQueries({ queryKey: ['gestao-tarefas', base.redeId] })
        void qc.invalidateQueries({ queryKey: ['gestao-atividades', base.redeId] })
      }
      return true
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); return false }
  }

  if (editando) {
    return <TarefaForm tarefa={atual} onClose={() => setEditando(false)} onSalva={() => { setEditando(false); void recarregar(atual.id) }} />
  }
  return (
    <>
      <TarefaDetalhe
        key={`${atual.id}-${atual.atualizado_em}`}
        tarefa={atual}
        onClose={onClose}
        onMudar={(t, s, obs) => tentar(() => mudarStatusTarefa(t, s, base.autor, obs), t.id, s !== 'concluida')}
        onAdiar={async (t, novo, motivo) => { await tentar(() => adiarTarefa(t, novo, base.autor, motivo), t.id) }}
        onEditar={base.podeGerir ? () => setEditando(true) : undefined}
        onExcluir={base.podeGerir ? async (t) => {
          setErro(null)
          try { await excluirTarefa(t); void qc.invalidateQueries({ queryKey: ['gestao-tarefas', base.redeId] }); onClose() } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
        } : undefined}
        onChecklist={async (t, lista) => { await tentar(() => salvarChecklist(t, lista, base.autor), t.id) }}
      />
      {erro && (
        <div className="fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4" role="alert">
          <div className="flex max-w-lg items-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-[13px] text-red-700 shadow-xl dark:border-red-900/50 dark:bg-[#1e293b] dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" /><span className="min-w-0">{erro}</span>
            <button type="button" aria-label="Fechar" onClick={() => setErro(null)} className="shrink-0 text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── detalhe ─────────────────────────────────────────────────────────── */

const TarefaDetalhe = ({ tarefa: t, onClose, onMudar, onAdiar, onEditar, onExcluir, excluindoInicial, onChecklist }: {
  tarefa: TarefaRow; onClose: () => void
  /** Devolve false se não gravou (aí não comemora nem fecha). */
  onMudar: (t: TarefaRow, s: TarefaStatus, obs?: string) => void | Promise<boolean | void>
  onAdiar: (t: TarefaRow, novoVenceEm: string, motivo?: string) => Promise<void>
  onEditar?: (t: TarefaRow) => void
  /** Só gestor/diretor. Apaga de vez: histórico e anexos vão junto. */
  onExcluir?: (t: TarefaRow) => Promise<void>
  excluindoInicial?: boolean
  onChecklist: (t: TarefaRow, lista: ChecklistItem[]) => Promise<void>
}) => {
  const base = useGestaoBase()
  const [obs, setObs] = useState('')
  const mudarComObs = (tt: TarefaRow, s: TarefaStatus) => onMudar(tt, s, obs)
  const atrasada = estaAtrasada(t)
  const aberta = t.status === 'a_fazer' || t.status === 'em_andamento'
  const podeAdiar = aberta && (base.podeGerir || t.responsavel_id === base.userId)
  // Otimista: a caixa marca na hora; a gravação segue atrás. Quando a lista
  // recarrega, o pai remonta este componente (key com atualizado_em).
  const [itens, setItens] = useState<ChecklistItem[]>(t.checklist)
  const toggle = (i: number) => {
    const lista = itens.map((c, j) => (j === i ? { ...c, feito: !c.feito } : c))
    setItens(lista)
    void onChecklist(t, lista)
  }
  const anexos = useAnexosTarefa(t.id)
  const faltam = aberta && exigeAnexo(t) ? anexosFaltando(t, anexos.data ?? []) : []
  const bloqueio = anexos.isLoading && exigeAnexo(t)
    ? 'Conferindo os anexos…'
    : faltam.length ? (faltam[0] === '' ? 'Anexe uma foto ou documento para concluir.' : `Para concluir, anexe: ${faltam.join(', ')}.`) : null
  const checklistCompleto = aberta && itens.length > 0 && itens.every((c) => c.feito)

  // Cancelar pede confirmação (sai das listas; o histórico fica).
  const [cancelando, setCancelando] = useState(false)
  // Excluir pede confirmação (apaga de vez, com histórico e anexos).
  const [excluindo, setExcluindo] = useState(!!excluindoInicial)
  const [excluindoSalva, setExcluindoSalva] = useState(false)
  const confirmarExcluir = async () => {
    if (!onExcluir) return
    setExcluindoSalva(true)
    try { await onExcluir(t) } finally { setExcluindoSalva(false) }
  }
  // Adiar: painel pequeno com nova data/hora; o motivo é a observação.
  const [adiando, setAdiando] = useState(false)
  const [novaData, setNovaData] = useState(somaDias(hojeLocal(), 1))
  const [novaHora, setNovaHora] = useState(horaDe(t.vence_em))
  const [adiandoSalva, setAdiandoSalva] = useState(false)
  const confirmarAdiar = async () => {
    if (!novaData) return
    setAdiandoSalva(true)
    try {
      await onAdiar(t, new Date(`${novaData}T${novaHora || '18:00'}:00`).toISOString(), obs)
      setAdiando(false)
    } finally { setAdiandoSalva(false) }
  }

  const historico = useQuery({ queryKey: ['gestao-atividades-tarefa', t.id], queryFn: () => fetchAtividadesDaTarefa(t.id) })
  const [verObs, setVerObs] = useState(false)
  const [concluindo, setConcluindo] = useState(false)
  const concluir = async () => {
    if (bloqueio || concluindo) return
    setConcluindo(true)
    const ok = await onMudar(t, 'concluida', obs)
    setConcluindo(false)
    if (ok === false) return
    onClose()
    celebrarConclusao(t.titulo)
  }
  const [verHistorico, setVerHistorico] = useState(false)
  const feitos = itens.filter((c) => c.feito).length
  const temMais = (aberta && base.podeGerir) || (onEditar && aberta) || podeAdiar || !!onExcluir
  const painelAberto = adiando || cancelando || excluindo
  const linha = 'flex items-start gap-3 text-[13.5px] text-gray-800 dark:text-gray-100'
  const icone = 'mt-[2px] h-4 w-4 shrink-0 text-gray-400'
  const sairDosPaineis = () => { setAdiando(false); setCancelando(false); setExcluindo(false) }

  return (
    <Modal guia={GUIAS.tarefaDetalhe} open onClose={onClose} largura="max-w-lg" titulo={<span className="block pr-10 text-[19px] leading-snug">{t.titulo}</span>}>
      {/* Menu ⋯ com as ações que não são o dia a dia (fica ao lado do X) */}
      {temMais && (
        <div className="absolute right-12 top-[18px] z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Mais ações" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-gray-100"><MoreHorizontal className="h-5 w-5" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-800">
              {onEditar && aberta && <DropdownMenuItem onSelect={() => onEditar(t)} className="h-9 cursor-pointer gap-2.5 rounded-lg text-[13px]"><Pencil className="h-4 w-4 text-gray-500" /> Editar</DropdownMenuItem>}
              {podeAdiar && <DropdownMenuItem onSelect={() => { sairDosPaineis(); setAdiando(true) }} className="h-9 cursor-pointer gap-2.5 rounded-lg text-[13px]"><CalendarClock className="h-4 w-4 text-gray-500" /> Adiar</DropdownMenuItem>}
              {aberta && base.podeGerir && <DropdownMenuItem onSelect={() => { sairDosPaineis(); setCancelando(true) }} className="h-9 cursor-pointer gap-2.5 rounded-lg text-[13px]"><XCircle className="h-4 w-4 text-gray-500" /> Cancelar tarefa</DropdownMenuItem>}
              {onExcluir && (
                <>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem onSelect={() => { sairDosPaineis(); setExcluindo(true) }} className="h-9 cursor-pointer gap-2.5 rounded-lg text-[13px] text-red-600 focus:text-red-700 dark:text-red-400"><Trash2 className="h-4 w-4" /> Excluir de vez</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="space-y-5 text-sm">
        {/* Selos: situação, prioridade e origem */}
        <div className="-mt-2 flex flex-wrap items-center gap-1.5">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold', atrasada ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300' : STATUS_CLS[t.status])}>
            <span className={cn('h-1.5 w-1.5 rounded-full', atrasada ? 'bg-red-500' : t.status === 'concluida' ? 'bg-emerald-500' : t.status === 'em_andamento' ? 'bg-blue-500' : 'bg-gray-400')} />
            {atrasada ? 'Atrasada' : STATUS_LABEL[t.status]}
          </span>
          <SeloPrioridade p={t.prioridade} />
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11.5px] font-medium text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">{t.rotina_id ? 'Rotina' : 'Avulsa'}</span>
        </div>

        {/* Quando, quem, onde */}
        <ul className="space-y-2.5">
          <li className={linha}>
            <Clock className={cn(icone, atrasada && 'text-red-500')} />
            <span>
              <span className={cn(atrasada && 'font-semibold text-red-600 dark:text-red-400')}>{capitalizar(atrasada ? fmtPrazo(t.vence_em, true) : `vence ${fmtPrazo(t.vence_em, aberta)}`)}</span>
              {t.data_ref && t.data_ref !== t.vence_dia && <span className="block text-[12px] text-gray-500 dark:text-gray-400">referente a {fmtData(t.data_ref)}</span>}
            </span>
          </li>
          <li className={linha}><User className={icone} />{base.nomeUsuario(t.responsavel_id) ?? 'Sem responsável'}</li>
          {(base.nomePosto(t.empresa_codigo) || t.setor_id) && (
            <li className={linha}><Building2 className={icone} /><span><span className="uppercase">{base.nomePosto(t.empresa_codigo) ?? 'Rede'}</span>{t.setor_id && <span className="text-gray-500 dark:text-gray-400"> · {base.nomeSetor(t.setor_id)}</span>}</span></li>
          )}
          {!t.rotina_id && t.criado_por_nome && <li className="pl-7 text-[12px] text-gray-500 dark:text-gray-400">Criada por {t.criado_por_nome}</li>}
        </ul>

        {t.descricao && <p className="whitespace-pre-wrap rounded-xl bg-gray-50 px-4 py-3 text-[13.5px] leading-relaxed text-gray-700 dark:bg-white/[0.04] dark:text-gray-300">{t.descricao}</p>}

        {/* Checklist com progresso */}
        {itens.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Etapas</span>
              <span className="text-[12px] tabular-nums text-gray-500 dark:text-gray-400">{feitos} de {itens.length}</span>
            </div>
            <div className="mb-2 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.08]">
              <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${(feitos / itens.length) * 100}%` }} />
            </div>
            <ul className="-mx-2">
              {itens.map((c, i) => (
                <li key={i}>
                  <button type="button" disabled={!aberta} onClick={() => toggle(i)}
                    className={cn('flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[13.5px]', aberta ? 'hover:bg-gray-50 dark:hover:bg-white/[0.04]' : 'cursor-default opacity-70')}>
                    {c.feito
                      ? <CircleCheck className="h-[18px] w-[18px] shrink-0 text-emerald-500" />
                      : <Circle className="h-[18px] w-[18px] shrink-0 text-gray-300 dark:text-gray-600" />}
                    <span className={cn('text-gray-800 dark:text-gray-100', c.feito && 'text-gray-400 line-through dark:text-gray-500')}>{c.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
            {aberta && t.status === 'a_fazer' && <p className="mt-1 text-[11.5px] text-gray-400">Marcar a primeira etapa já põe a tarefa em andamento.</p>}
          </section>
        )}

        <AnexosTarefa tarefa={t} />

        {/* Observação: só aparece quando a pessoa quer escrever */}
        {aberta && (verObs || obs ? (
          <div>
            <label className={cn(labelCls, 'inline-flex items-center gap-1')} htmlFor="obs-tarefa">Observação <InfoHint text="Vai para o histórico junto com a próxima ação: concluir, adiar ou cancelar. Serve para explicar um atraso, um problema encontrado ou por que adiou." /></label>
            <textarea id="obs-tarefa" autoFocus rows={2} className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: tanque 2 sem leitura, bomba em manutenção" />
          </div>
        ) : (
          <button type="button" onClick={() => setVerObs(true)} className="inline-flex items-center gap-2 text-[13px] font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100">
            <Plus className="h-4 w-4" /> Adicionar observação
          </button>
        ))}

        {bloqueio && !anexos.isLoading && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><Camera className="mt-0.5 h-4 w-4 shrink-0" />{bloqueio}</p>
        )}
        {checklistCompleto && !bloqueio && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><CircleCheck className="h-4 w-4 shrink-0" /> Todas as etapas feitas. Falta só concluir.</p>
        )}
        {t.concluida_em && <p className="text-[12.5px] text-gray-500 dark:text-gray-400">Concluída em {fmtDataHora(t.concluida_em)}{t.concluida_por ? ` por ${base.nomeUsuario(t.concluida_por)}` : ''}.</p>}

        {/* Histórico recolhido, em linha do tempo */}
        <section className="border-t border-gray-100 pt-4 dark:border-white/[0.06]">
          <button type="button" onClick={() => setVerHistorico((v) => !v)} className="flex w-full items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100">
            <History className="h-3.5 w-3.5" /> Histórico
            {(historico.data ?? []).length > 0 && <span className="rounded-full bg-gray-100 px-1.5 text-[10.5px] tabular-nums dark:bg-white/[0.08]">{historico.data!.length}</span>}
            <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform', verHistorico && 'rotate-180')} />
          </button>
          {verHistorico && (historico.isLoading ? (
            <p className="mt-3 text-xs text-gray-400">Carregando…</p>
          ) : (historico.data ?? []).length === 0 ? (
            <p className="mt-3 text-xs text-gray-400">Nada registrado ainda.</p>
          ) : (
            <ol className="relative ml-1.5 mt-3 max-h-48 space-y-3 overflow-y-auto border-l border-gray-200 pl-4 dark:border-white/[0.08]">
              {(historico.data ?? []).map((a) => (
                <li key={a.id} className="relative text-[12.5px] leading-snug text-gray-600 dark:text-gray-300">
                  <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-gray-300 ring-2 ring-white dark:bg-gray-600 dark:ring-gray-900" />
                  <span className="font-medium text-gray-800 dark:text-gray-100">{a.autor_nome ?? 'Alguém'}</span> {ATIVIDADE_VERBO[a.tipo]}
                  {a.detalhe && a.tipo !== 'criada' && a.tipo !== 'gerada' ? <> {a.detalhe.startsWith(t.titulo) ? a.detalhe.slice(t.titulo.length).replace(/^\s*—\s*/, '') || 'a tarefa' : a.detalhe}</> : ' a tarefa'}
                  <span className="block text-[11px] text-gray-400">{fmtDataHora(a.criado_em)}</span>
                </li>
              ))}
            </ol>
          ))}
        </section>

        {/* Confirmações (aparecem acima dos botões) */}
        {excluindo && (
          <div className="rounded-xl bg-red-50 p-3.5 dark:bg-red-500/10">
            <p className="text-[13px] font-semibold text-red-800 dark:text-red-300">Excluir esta tarefa de vez?</p>
            <p className="mt-0.5 text-[12px] text-red-700 dark:text-red-400">Some da lista, do painel e da agenda, com o histórico e os anexos. Não dá para desfazer. Para só tirar do caminho, use Cancelar tarefa.</p>
            <div className="mt-2.5 flex justify-end gap-2">
              <button type="button" className={cn(btnGhost, 'h-8 rounded-full text-xs')} onClick={() => setExcluindo(false)} disabled={excluindoSalva}>Voltar</button>
              <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-red-600 px-3.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60" onClick={() => void confirmarExcluir()} disabled={excluindoSalva}>
                {excluindoSalva ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Sim, excluir
              </button>
            </div>
          </div>
        )}
        {cancelando && (
          <div className="rounded-xl bg-red-50 p-3.5 dark:bg-red-500/10">
            <p className="text-[13px] font-semibold text-red-800 dark:text-red-300">Cancelar esta tarefa?</p>
            <p className="mt-0.5 text-[12px] text-red-700 dark:text-red-400">Ela sai das listas e não conta como feita. O histórico fica e dá para reabrir depois.</p>
            <div className="mt-2.5 flex justify-end gap-2">
              <button type="button" className={cn(btnGhost, 'h-8 rounded-full text-xs')} onClick={() => setCancelando(false)}>Voltar</button>
              <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-red-600 px-3.5 text-xs font-semibold text-white hover:bg-red-700" onClick={() => { setCancelando(false); mudarComObs(t, 'cancelada') }}><XCircle className="h-3.5 w-3.5" /> Sim, cancelar</button>
            </div>
          </div>
        )}
        {adiando && (
          <div className="rounded-xl bg-gray-50 p-3.5 dark:bg-white/[0.04]">
            <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Adiar para</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input id="adiar-data" type="date" aria-label="Dia" className={cn(inputCls, 'h-9 w-auto')} value={novaData} min={hojeLocal()} onChange={(e) => setNovaData(e.target.value)} />
              <SeletorHora id="adiar-hora" aria-label="Hora" value={novaHora} onChange={setNovaHora} />
              <button type="button" className="h-8 rounded-full border border-gray-200 px-3 text-xs font-semibold text-gray-600 hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.06]" onClick={() => setNovaData(somaDias(hojeLocal(), 1))}>Amanhã</button>
              <button type="button" className="h-8 rounded-full border border-gray-200 px-3 text-xs font-semibold text-gray-600 hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.06]" onClick={() => setNovaData(somaDias(hojeLocal(), 7))}>+7 dias</button>
            </div>
            <p className="mt-2 text-[11.5px] text-gray-500 dark:text-gray-400">Se escrever uma observação, ela vira o motivo no histórico.</p>
            <div className="mt-2.5 flex justify-end gap-2">
              <button type="button" className={cn(btnGhost, 'h-8 rounded-full text-xs')} onClick={() => setAdiando(false)}>Voltar</button>
              <button type="button" className={cn(btnPrimary, 'h-8 rounded-full text-xs')} disabled={adiandoSalva || !novaData} onClick={() => void confirmarAdiar()}>
                {adiandoSalva ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />} Adiar
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Rodapé: só as ações do dia a dia (filho direto do modal, para encostar no fundo) */}
        {!painelAberto && (
          <ModalRodape className="gap-2">
            {aberta ? (
              <>
                {t.status === 'a_fazer' && (
                  <button type="button" onClick={() => mudarComObs(t, 'em_andamento')}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-gray-300 px-5 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/[0.06]">
                    <Play className="h-4 w-4" /> Iniciar
                  </button>
                )}
                <button type="button" onClick={() => void concluir()} aria-disabled={!!bloqueio || concluindo}
                  className={cn('inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-5 text-[13.5px] font-semibold text-white shadow-sm hover:bg-emerald-700', (bloqueio || concluindo) && 'cursor-not-allowed opacity-40 hover:bg-emerald-600')}>
                  {concluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {concluindo ? 'Concluindo…' : 'Concluir'}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => mudarComObs(t, 'a_fazer')}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-gray-300 px-5 text-[13.5px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/[0.06]">
                <RotateCcw className="h-4 w-4" /> Reabrir
              </button>
            )}
          </ModalRodape>
        )}
    </Modal>
  )
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/* ─── responsável com busca (redes com muita gente) ─────────────────────── */

export const BuscaResponsavel = ({ id, usuarios, valor, onChange, erro, vazio }: {
  id: string
  usuarios: { user_id: string; nome: string; email: string }[]
  valor: string
  onChange: (v: string) => void
  erro?: boolean
  /** Se informado, a lista começa com esta opção (valor vazio). Ex.: "Sem responsável". */
  vazio?: string
}) => {
  const [aberto, setAberto] = useState(false)
  const [q, setQ] = useState('')
  const sel = usuarios.find((u) => u.user_id === valor)
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const lista = useMemo(() => {
    const k = norm(q.trim())
    return usuarios.filter((u) => !k || norm(`${u.nome} ${u.email}`).includes(k)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [usuarios, q])
  const escolher = (v: string) => { onChange(v); setAberto(false); setQ('') }
  // Fecha ao clicar fora (a lista flutua por cima dos campos de baixo).
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])
  return (
    <div ref={caixa} className="relative">
      <button id={id} type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
        className={cn(inputCls, 'flex items-center gap-2 text-left', erro && 'border-red-400 dark:border-red-700')}>
        <User className="h-4 w-4 shrink-0 text-gray-400" />
        <span className={cn('min-w-0 flex-1 truncate', !sel && 'text-gray-400')}>{sel ? sel.nome : vazio && !valor ? vazio : 'Selecione quem vai fazer…'}</span>
        {sel && <span className="hidden truncate text-[11.5px] text-gray-400 sm:inline">{sel.email}</span>}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-[#3e4c63] dark:bg-[#1e293b]">
          <div className="relative border-b border-gray-100 dark:border-[#2f3b4f]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar entre ${usuarios.length} pessoas pelo nome ou e-mail…`}
              onKeyDown={(e) => { if (e.key === 'Enter' && lista.length === 1) { e.preventDefault(); escolher(lista[0].user_id) } if (e.key === 'Escape') { e.stopPropagation(); setAberto(false) } }}
              className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100" />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
            {vazio && !q.trim() && (
              <li>
                <button type="button" role="option" aria-selected={!valor} onClick={() => escolher('')}
                  className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm italic text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-[#223049]', !valor && 'bg-teal-50 dark:bg-[#0d9488]/[0.12]')}>
                  <span className="min-w-0 flex-1 truncate">{vazio}</span>
                  {!valor && <Check className="h-4 w-4 shrink-0 text-[#0d9488]" />}
                </button>
              </li>
            )}
            {lista.map((u) => (
              <li key={u.user_id}>
                <button type="button" role="option" aria-selected={u.user_id === valor} onClick={() => escolher(u.user_id)}
                  className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-[#223049]', u.user_id === valor && 'bg-teal-50 dark:bg-[#0d9488]/[0.12]')}>
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-100">{u.nome}</span>
                  <span className="min-w-0 truncate text-[11.5px] text-gray-400">{u.email}</span>
                  {u.user_id === valor && <Check className="h-4 w-4 shrink-0 text-[#0d9488]" />}
                </button>
              </li>
            ))}
            {lista.length === 0 && <li className="px-3 py-3 text-center text-[12px] text-gray-400">Ninguém com esse nome.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ─── nova tarefa avulsa / edição ─────────────────────────────────────── */

/** Pré-preenchimento de uma tarefa nova criada de outra tela (ex.: títulos do Financeiro). */
export interface TarefaInicial {
  titulo?: string
  descricao?: string
  empresaCodigo?: number | null
  prioridade?: Prioridade
  checklist?: ChecklistItem[]
  /** yyyy-MM-dd */
  data?: string
  /** HH:mm */
  hora?: string
}

export const TarefaForm = ({ tarefa, inicial, onClose, onSalva }: { tarefa?: TarefaRow | null; inicial?: TarefaInicial; onClose: () => void; onSalva: (t?: TarefaRow) => void }) => {
  const base = useGestaoBase()
  const edicao = !!tarefa
  const [titulo, setTitulo] = useState(tarefa?.titulo ?? inicial?.titulo ?? '')
  const [empresa, setEmpresa] = useState(tarefa?.empresa_codigo != null ? String(tarefa.empresa_codigo) : inicial?.empresaCodigo != null ? String(inicial.empresaCodigo) : '')
  const [responsavel, setResponsavel] = useState(tarefa?.responsavel_id ?? '')
  const [setor, setSetor] = useState(tarefa?.setor_id ?? '')
  // Depois das 18h o padrão já é amanhã, pra tarefa não nascer atrasada.
  const [data, setData] = useState(tarefa ? tarefa.vence_dia : inicial?.data ?? (new Date().getHours() >= 18 ? somaDias(hojeLocal(), 1) : hojeLocal()))
  const [hora, setHora] = useState(tarefa ? horaDe(tarefa.vence_em) : inicial?.hora ?? '18:00')
  const [descricao, setDescricao] = useState(tarefa?.descricao ?? inicial?.descricao ?? '')
  // Checklist como lista de etapas (adiciona uma por vez, igual na rotina).
  // Na edição, etapas já marcadas continuam marcadas.
  const [checklist, setChecklist] = useState<ChecklistItem[]>(tarefa ? tarefa.checklist : inicial?.checklist ?? [])
  const [novaEtapa, setNovaEtapa] = useState('')
  const addEtapa = () => { const t = novaEtapa.trim(); if (!t) return; setChecklist((xs) => [...xs, { texto: t, feito: false }]); setNovaEtapa('') }
  const [prioridade, setPrioridade] = useState<Prioridade>(tarefa?.prioridade ?? inicial?.prioridade ?? 'media')
  const [exigeFoto, setExigeFoto] = useState(tarefa?.exige_anexo ?? false)
  const [documentos, setDocumentos] = useState<string[]>(tarefa?.documentos_exigidos ?? [])
  const [novoDoc, setNovoDoc] = useState('')
  const addDoc = () => { const d = novoDoc.trim(); if (!d || documentos.includes(d)) return; setDocumentos((xs) => [...xs, d]); setNovoDoc(''); setExigeFoto(true) }
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tentou, setTentou] = useState(false)
  const [verDescricao, setVerDescricao] = useState(!!(tarefa?.descricao ?? inicial?.descricao))

  // Validação visível no campo (não só na mensagem de erro).
  const tituloInvalido = titulo.trim().length < 3
  const respInvalido = !responsavel
  const dataPassada = !!data && (data < hojeLocal() || (data === hojeLocal() && (hora || '18:00') < horaDe(new Date().toISOString())))

  const salvar = async () => {
    setTentou(true)
    // Erros de preenchimento aparecem embaixo de cada campo; a faixa vermelha fica só pra erro do servidor.
    if (tituloInvalido || respInvalido || !data) { setErro(null); return }
    setSalvando(true); setErro(null)
    try {
      const venceEm = new Date(`${data}T${hora || '18:00'}:00`).toISOString()
      const input: TarefaInput = {
        titulo: titulo.trim(), descricao: descricao.trim() || null,
        empresa_codigo: empresa ? Number(empresa) : null, responsavel_id: responsavel || null, setor_id: setor || null,
        vence_em: venceEm,
        checklist,
        prioridade,
        exige_anexo: exigeFoto || documentos.length > 0,
        documentos_exigidos: exigeFoto || documentos.length > 0 ? documentos : [],
      }
      if (tarefa) { await editarTarefa(tarefa, input, base.autor); onSalva() }
      else onSalva(await criarTarefa(base.redeId!, input, base.autor))
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={onClose} largura="max-w-[600px]" lateral
      titulo={<span className="inline-flex items-center gap-2">{edicao ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {edicao ? 'Editar tarefa' : 'Nova tarefa'}</span>}
      descricao={edicao ? 'As mudanças ficam registradas no histórico da tarefa.' : 'Uma tarefa avulsa, para uma pessoa, com prazo.'}>
      <div className="space-y-6">
        <BlocoForm n={1} titulo="O quê">
          <div>
            <label className={ROTULO} htmlFor="tf-titulo">Título</label>
            <input id="tf-titulo" className={cn(CAMPO, tentou && tituloInvalido && CAMPO_ERRO)} placeholder="Ex.: Conferir fechamento de caixa" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
            {tentou && tituloInvalido && <p className={ERRO_CAMPO}>Dê um título com 3 letras ou mais.</p>}
          </div>
          {verDescricao ? (
            <div>
              <label className={ROTULO} htmlFor="tf-desc">Descrição</label>
              <textarea id="tf-desc" className={cn(CAMPO, 'h-auto min-h-[96px] resize-y py-2.5 leading-relaxed')} rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: cliente pediu para ligar depois das 14h" />
            </div>
          ) : (
            <button type="button" onClick={() => setVerDescricao(true)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"><Plus className="h-4 w-4" /> Adicionar descrição</button>
          )}
        </BlocoForm>

        <BlocoForm n={2} titulo="Onde e quem">
          <div>
            <span className={ROTULO}>Responsável <InfoHint text="Quem vai executar. Precisa ter login no Visor nesta rede: a tarefa aparece em Minhas pendentes dele e conta na bolinha do menu." /></span>
            <BuscaResponsavel id="tf-resp" usuarios={base.usuarios} valor={responsavel} onChange={setResponsavel} erro={tentou && respInvalido} />
            {tentou && respInvalido && <p className={ERRO_CAMPO}>Escolha quem vai fazer.</p>}
          </div>
          <div>
            <span className={ROTULO}>Posto</span>
            <SeletorPostos unico postos={base.postos} valor={empresa ? [Number(empresa)] : []} onChange={(v) => setEmpresa(v[0] != null ? String(v[0]) : '')} rotuloVazio="Sem posto (tarefa da rede)" />
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="block">
              <span className={ROTULO}>Setor</span>
              <select className={CAMPO} value={setor} onChange={(e) => setSetor(e.target.value)}>
                <option value="">Sem setor</option>
                {base.setores.filter((x) => x.ativo || x.id === setor).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            </label>
            <div>
              <span className={ROTULO}>Prioridade <InfoHint text="Alta e Urgente ganham selo e sobem na lista. Urgente aparece em vermelho para quem vai fazer." /></span>
              <div className={cn(TRILHO, 'h-11 items-center')}>
                {(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map((p) => (
                  <button key={p} type="button" onClick={() => setPrioridade(p)} className={cn(segmento(prioridade === p), 'inline-flex h-full items-center justify-center gap-1 whitespace-nowrap px-3', corPrioridade(p, prioridade === p))}>
                    {p === 'urgente' && <Siren className="h-3.5 w-3.5 shrink-0" />}{PRIORIDADE_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </BlocoForm>

        <BlocoForm n={3} titulo="Quando">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={ROTULO}>Vence em</span>
              <input id="tf-data" type="date" className={cn(CAMPO, tentou && !data && CAMPO_ERRO)} value={data} onChange={(e) => setData(e.target.value)} />
            </label>
            <div>
              <span className={ROTULO}>Horário</span>
              <SeletorHora id="tf-hora" className="h-11 w-full" value={hora} onChange={setHora} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([['Hoje', hojeLocal()], ['Amanhã', somaDias(hojeLocal(), 1)], ['Segunda', proximaSegunda(hojeLocal())], ['Em 7 dias', somaDias(hojeLocal(), 7)]] as const).map(([r, dia]) => (
              <button key={r} type="button" onClick={() => setData(dia)} className={pilula(data === dia)}>{r}</button>
            ))}
          </div>
          {dataPassada && <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Essa data já passou: a tarefa vai nascer atrasada.</p>}
        </BlocoForm>

        <BlocoForm n={4} titulo="Etapas e comprovação">
          <div>
            <span className={ROTULO}>Etapas <span className="font-normal text-gray-400">(opcional)</span> <InfoHint text="Etapas que precisam ser marcadas antes de concluir. Com etapas, a lista mostra Abrir checklist em vez de Concluir, e marcar a primeira já põe a tarefa em andamento." /></span>
            <EtapasCampo itens={checklist} onRemover={(i) => setChecklist((xs) => xs.filter((_, j) => j !== i))} novo={novaEtapa} onNovo={setNovaEtapa} onAdd={addEtapa} placeholderVazio="Ex.: Conferir sangrias e Enter…" />
          </div>
          <ExigirAnexoCampos exige={exigeFoto} onExige={setExigeFoto} documentos={documentos} onDocumentos={setDocumentos} novoDoc={novoDoc} onNovoDoc={setNovoDoc} onAdd={addDoc} />
        </BlocoForm>

        <Erro msg={erro} />
        <ModalRodape>
          <button type="button" className={btnGhost} onClick={onClose}>Cancelar</button>
          <button type="button" className={btnPrimary} onClick={() => void salvar()} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : edicao ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {edicao ? 'Salvar alterações' : 'Criar tarefa'}
          </button>
        </ModalRodape>
      </div>
    </Modal>
  )
}

export default Tarefas
