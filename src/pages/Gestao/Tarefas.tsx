import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useFilters } from '@/hooks/useFilters'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList, Plus, Loader2, Check, Play, RotateCcw, XCircle, Clock, AlertTriangle, Building2, User, Layers, Pencil, CalendarClock, History, ListChecks, X, Undo2, Repeat,
} from 'lucide-react'
import {
  fetchTarefas, fetchAtividadesDaTarefa, criarTarefa, editarTarefa, adiarTarefa, mudarStatusTarefa, salvarChecklist, estaAtrasada,
  STATUS_LABEL, ATIVIDADE_VERBO,
  type TarefaRow, type TarefaStatus, type ChecklistItem, type TarefaInput,
} from '@/api/supabase/gestaoTarefas'
import { useGestaoBase, containerCls, inputCls, selectCls, labelCls, btnPrimary, btnGhost, fmtDataHora, fmtData, fmtPrazo, hojeLocal, somaDias } from './comum'
import { Modal, ModalRodape, Erro, Segmentos } from './comumUi'
import { Kanban } from './TarefasVisoes'
import { Agenda } from './Agenda'
import AnexosTarefa from './Anexos'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import HeaderHint from '@/components/tables/HeaderHint'

/**
 * Gestão → Tarefas: as tarefas das rotinas e as avulsas da rede. Abas por
 * situação, filtros por posto/responsável/setor/status, detalhe com checklist,
 * histórico e ações (iniciar, concluir, reabrir, adiar, editar, cancelar).
 * Criar e editar é só gestor/diretor; executar e adiar é o responsável (ou gestor).
 */

type Aba = 'todas' | 'atrasadas' | 'hoje' | 'andamento' | 'minhas'
type Periodo = 7 | 14 | 30
type Visao = 'lista' | 'kanban' | 'agenda'

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
  const [visao, setVisaoState] = useState<Visao>(prefs.visao === 'kanban' || prefs.visao === 'agenda' ? prefs.visao : 'lista')
  const setPeriodo = (p: Periodo) => { setPeriodoState(p); salvarPrefs({ periodo: p }) }
  const setVisao = (v: Visao) => { setVisaoState(v); salvarPrefs({ visao: v }) }
  // ?aba= vem dos links do Painel (atrasadas / hoje).
  const [params] = useSearchParams()
  const abaInicial = params.get('aba')
  // Gestor começa em Todas; quem só executa começa nas suas pendentes.
  // null = "automática": resolvida na hora de usar, porque o perfil (podeGerir)
  // pode chegar depois do primeiro render num reload da página.
  const [abaEscolhida, setAba] = useState<Aba | null>(
    abaInicial === 'atrasadas' || abaInicial === 'hoje' || abaInicial === 'andamento' || abaInicial === 'minhas' || abaInicial === 'todas' ? abaInicial : null,
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
  const [erro, setErro] = useState<string | null>(null)

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
      return peso(a) - peso(b) || a.vence_em.localeCompare(b.vence_em)
    })
  }, [todas, filtro, hoje])

  if (!base.redeId) return <div className="p-6 text-sm text-gray-500">Selecione uma rede para ver as tarefas.</div>

  const invalidar = (tarefaId?: string) => {
    void qc.invalidateQueries({ queryKey: ['gestao-tarefas', base.redeId] })
    void qc.invalidateQueries({ queryKey: ['gestao-atividades', base.redeId] })
    if (tarefaId) void qc.invalidateQueries({ queryKey: ['gestao-atividades-tarefa', tarefaId] })
  }

  const mudar = async (t: TarefaRow, status: TarefaStatus, obs?: string) => {
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
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
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
  ]

  const tarefaAtual = detalhe ? (todas.find((t) => t.id === detalhe.id) ?? detalhe) : null

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {abas.map((a) => (
            <button key={a.id} type="button" onClick={() => setAba(a.id)}
              className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', aba === a.id ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : cn('text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800', a.cor))}>
              {a.label}
              <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', aba === a.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800')}>{a.n}</span>
            </button>
          ))}
          <InfoHint className="ml-1" text="Atrasadas: abertas que passaram do vencimento. Vencem hoje: abertas com prazo hoje. Em andamento: alguém já começou. Minhas pendentes: as suas abertas. Os números contam o período escolhido à direita." />
        </div>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <Segmentos<Visao> opcoes={[{ value: 'lista', label: 'Lista' }, { value: 'kanban', label: 'Kanban' }, { value: 'agenda', label: 'Agenda' }]} valor={visao} onChange={setVisao} />
          <Segmentos<Periodo> opcoes={[{ value: 7, label: '7 dias' }, { value: 14, label: '14 dias' }, { value: 30, label: '30 dias' }]} valor={periodo} onChange={setPeriodo} />
          <InfoHint text="Lista, Kanban (arraste entre colunas) ou Agenda (calendário do mês). O período é quantos dias para trás a lista mostra; os próximos 7 dias aparecem sempre." />
          {base.podeGerir && <button type="button" className={btnPrimary} onClick={() => setNovaAberta(true)}><Plus className="h-4 w-4" /> Nova tarefa</button>}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className={cn(inputCls, 'h-9 min-w-[12rem] flex-1')} placeholder="Buscar tarefa…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className={cn(selectCls, 'h-9 w-auto')} value={postoSel} onChange={(e) => setPostoSel(e.target.value)}>
          <option value="todos">Todos os postos</option>
          <option value="sem">Sem posto (rede)</option>
          {base.postos.map((p) => <option key={p.codigo} value={p.codigo}>{p.fantasia || p.razao || `Posto ${p.codigo}`}</option>)}
        </select>
        <select className={cn(selectCls, 'h-9 w-auto')} value={respSel} onChange={(e) => setRespSel(e.target.value)}>
          <option value="todos">Todos os responsáveis</option>
          <option value="sem">Sem responsável</option>
          {base.usuarios.map((u) => <option key={u.user_id} value={u.user_id}>{u.nome}</option>)}
        </select>
        <select className={cn(selectCls, 'h-9 w-auto')} value={setorSel} onChange={(e) => setSetorSel(e.target.value)}>
          <option value="todos">Todos os setores</option>
          {base.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select className={cn(selectCls, 'h-9 w-auto')} value={statusSel} onChange={(e) => setStatusSel(e.target.value as typeof statusSel)}>
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
        <Kanban tarefas={lista.filter((t) => t.status !== 'cancelada')} ctx={base} onAbrir={setDetalhe} onMudar={mudar} />
      )}
      {visao === 'agenda' && <Agenda ctx={{ redeId: base.redeId, nomePosto: base.nomePosto, nomeUsuario: base.nomeUsuario }} filtro={filtro} onAbrir={setDetalhe} />}

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
                        <span className="font-medium leading-snug">{t.titulo}</span>
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', atrasada ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : STATUS_CLS[t.status])}>
                          {atrasada ? 'Atrasada' : STATUS_LABEL[t.status]}
                        </span>
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                        <span className={cn('inline-flex items-center gap-1 tabular-nums', atrasada && 'font-semibold text-red-600 dark:text-red-400')} title={fmtDataHora(t.vence_em)}><Clock className="h-3 w-3" />{fmtPrazo(t.vence_em, t.status === 'a_fazer' || t.status === 'em_andamento')}</span>
                        {t.empresa_codigo !== null && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{base.nomePosto(t.empresa_codigo)}</span>}
                        <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{base.nomeUsuario(t.responsavel_id) ?? 'sem responsável'}</span>
                        {t.checklist.length > 0 && <span>{feitos}/{t.checklist.length} etapas</span>}
                      </span>
                    </button>
                    <div className="flex justify-end"><AcoesTarefa t={t} onMudar={mudar} compacto onAbrir={setDetalhe} /></div>
                  </li>
                )
              })}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 dark:bg-transparent dark:text-gray-400">
                    <th className="px-4 py-2 font-semibold">Tarefa</th>
                    <th className="px-3 py-2 font-semibold">Posto</th>
                    <th className="px-3 py-2 font-semibold">Responsável</th>
                    <HeaderHint align="left" className="font-semibold" label="Vence" help="Prazo em palavras: hoje, amanhã ou há quanto tempo está atrasada. Passe o mouse para ver a data e a hora exatas. Atrasadas vêm primeiro, depois as de hoje." />
                    <HeaderHint align="left" className="font-semibold" label="Status" help="A fazer: ninguém começou. Em andamento: alguém começou (marcar a primeira etapa do checklist já faz isso). Concluída e Cancelada fecham a tarefa; Reabrir volta para A fazer." />
                    <HeaderHint align="right" className="px-4 font-semibold" label="Ação" help="Sem checklist: Concluir direto, com Desfazer por alguns segundos. Com checklist pendente: Abrir checklist, para marcar as etapas antes de concluir. Adiar, editar e cancelar ficam dentro da tarefa." />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {lista.map((t) => {
                    const atrasada = estaAtrasada(t)
                    const feitos = t.checklist.filter((c) => c.feito).length
                    return (
                      <tr key={t.id} onClick={() => setDetalhe(t)} className="cursor-pointer text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/[0.03]">
                        <td className="px-4 py-2.5">
                          <button type="button" onClick={() => setDetalhe(t)} className="text-left">
                            <span className="block font-medium hover:underline">{t.titulo}</span>
                            <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-gray-500">
                              {t.setor_id && <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" />{base.nomeSetor(t.setor_id)}</span>}
                              {t.checklist.length > 0 && <span>{feitos}/{t.checklist.length} etapas</span>}
                              {t.rotina_id && <span>rotina</span>}
                              {t.data_ref && t.data_ref !== t.vence_dia && <span>ref. {fmtData(t.data_ref)}</span>}
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300">{base.nomePosto(t.empresa_codigo) ?? '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300">{base.nomeUsuario(t.responsavel_id) ?? <span className="text-gray-400">sem responsável</span>}</td>
                        <td className={cn('whitespace-nowrap px-3 py-2.5 text-xs tabular-nums', atrasada ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300')} title={fmtDataHora(t.vence_em)}>
                          {atrasada && <AlertTriangle className="mr-1 inline h-3 w-3" />}{fmtPrazo(t.vence_em, t.status === 'a_fazer' || t.status === 'em_andamento')}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', atrasada ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : STATUS_CLS[t.status])}>
                            {atrasada ? 'Atrasada' : STATUS_LABEL[t.status]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <AcoesTarefa t={t} onMudar={mudar} compacto onAbrir={setDetalhe} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
          onClose={() => setDetalhe(null)}
          onMudar={mudar}
          onAdiar={adiar}
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
const AcoesTarefa = ({ t, onMudar, compacto, destaque, onAbrir }: {
  t: TarefaRow; onMudar: (t: TarefaRow, s: TarefaStatus) => void; compacto?: boolean; destaque?: boolean; onAbrir?: (t: TarefaRow) => void
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
    return (
      <button type="button" className={concluirCls} onClick={() => onMudar(t, 'concluida')}><Check className="h-3.5 w-3.5" /> Concluir</button>
    )
  }
  if (t.status === 'a_fazer') return (
    <span className="inline-flex gap-1">
      <button type="button" className={b} onClick={() => onMudar(t, 'em_andamento')}><Play className="h-3.5 w-3.5" /> Iniciar</button>
      <button type="button" className={concluirCls} onClick={() => onMudar(t, 'concluida')}><Check className="h-3.5 w-3.5" /> Concluir</button>
    </span>
  )
  if (t.status === 'em_andamento') return (
    <button type="button" className={concluirCls} onClick={() => onMudar(t, 'concluida')}><Check className="h-3.5 w-3.5" /> Concluir</button>
  )
  return (
    <button type="button" className={b} onClick={() => onMudar(t, 'a_fazer')}><RotateCcw className="h-3.5 w-3.5" /> Reabrir</button>
  )
}

/* ─── detalhe ─────────────────────────────────────────────────────────── */

const TarefaDetalhe = ({ tarefa: t, onClose, onMudar, onAdiar, onEditar, onChecklist }: {
  tarefa: TarefaRow; onClose: () => void
  onMudar: (t: TarefaRow, s: TarefaStatus, obs?: string) => void
  onAdiar: (t: TarefaRow, novoVenceEm: string, motivo?: string) => Promise<void>
  onEditar?: (t: TarefaRow) => void
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
  const checklistCompleto = aberta && itens.length > 0 && itens.every((c) => c.feito)

  // Cancelar pede confirmação (sai das listas; o histórico fica).
  const [cancelando, setCancelando] = useState(false)
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

  return (
    <Modal open onClose={onClose} titulo={t.titulo} largura="max-w-lg">
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', atrasada ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : STATUS_CLS[t.status])}>{atrasada ? 'Atrasada' : STATUS_LABEL[t.status]}</span>
          <span className={cn('inline-flex items-center gap-1 text-xs', atrasada ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500')} title={fmtDataHora(t.vence_em)}><Clock className="h-3.5 w-3.5" /> {atrasada ? fmtPrazo(t.vence_em, true) : `vence ${fmtPrazo(t.vence_em, aberta)}`}</span>
          {t.data_ref && t.data_ref !== t.vence_dia && <span className="text-xs text-gray-500">· referente a {fmtData(t.data_ref)}</span>}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div><dt className="text-gray-500">Posto</dt><dd className="inline-flex items-center gap-1 font-medium text-gray-800 dark:text-gray-200"><Building2 className="h-3 w-3" />{base.nomePosto(t.empresa_codigo) ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Responsável</dt><dd className="inline-flex items-center gap-1 font-medium text-gray-800 dark:text-gray-200"><User className="h-3 w-3" />{base.nomeUsuario(t.responsavel_id) ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Setor</dt><dd className="font-medium text-gray-800 dark:text-gray-200">{base.nomeSetor(t.setor_id) ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Origem</dt><dd className="font-medium text-gray-800 dark:text-gray-200">{t.rotina_id ? 'Rotina' : `Avulsa · ${t.criado_por_nome ?? ''}`}</dd></div>
        </dl>
        {t.descricao && <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{t.descricao}</p>}
        {itens.length > 0 && (
          <div>
            <p className={labelCls}>Checklist{!aberta && <span className="ml-1 font-normal text-gray-400">(tarefa fechada, só leitura)</span>}</p>
            <ul className="space-y-1.5">
              {itens.map((c, i) => (
                <li key={i}>
                  <label className={cn('flex items-start gap-2 rounded-md px-2 py-1.5', aberta ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.04]' : 'cursor-default opacity-70')}>
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1e3a5f]" checked={c.feito} disabled={!aberta} onChange={() => toggle(i)} />
                    <span className={cn(c.feito && 'text-gray-400 line-through')}>{c.texto}</span>
                  </label>
                </li>
              ))}
            </ul>
            {aberta && t.status === 'a_fazer' && <p className="mt-1 text-[11px] text-gray-400">Marcar a primeira etapa já põe a tarefa em andamento.</p>}
          </div>
        )}
        <AnexosTarefa tarefa={t} />
        {aberta && (
          <div>
            <label className={cn(labelCls, 'inline-flex items-center gap-1')} htmlFor="obs-tarefa">Observação (opcional, vai para o histórico) <InfoHint text="O que você escrever aqui é gravado junto com a próxima ação: concluir, adiar ou cancelar. Serve para explicar um atraso, um problema encontrado ou por que adiou." /></label>
            <textarea id="obs-tarefa" rows={2} className={inputCls} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: tanque 2 sem leitura, bomba em manutenção" />
          </div>
        )}
        {checklistCompleto && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">Checklist completo. Falta só concluir.</p>
        )}
        {cancelando && (
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
            <p className="text-xs font-semibold text-red-800 dark:text-red-300">Cancelar esta tarefa?</p>
            <p className="text-[11px] text-red-700 dark:text-red-400">Ela sai das listas e não conta como feita. O histórico fica, e dá para reabrir depois. Se quiser, escreva o motivo na observação acima.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={cn(btnGhost, 'h-8 text-xs')} onClick={() => setCancelando(false)}>Voltar</button>
              <button type="button" className={cn(btnGhost, 'h-8 border-red-300 text-xs text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300')} onClick={() => { setCancelando(false); mudarComObs(t, 'cancelada') }}><XCircle className="h-3.5 w-3.5" /> Sim, cancelar</button>
            </div>
          </div>
        )}
        {adiando && (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Adiar para</p>
            <div className="flex flex-wrap items-end gap-2">
              <div><label className={labelCls} htmlFor="adiar-data">Dia</label><input id="adiar-data" type="date" className={cn(inputCls, 'h-9 w-auto')} value={novaData} min={hojeLocal()} onChange={(e) => setNovaData(e.target.value)} /></div>
              <div><label className={labelCls} htmlFor="adiar-hora">Hora</label><input id="adiar-hora" type="time" className={cn(inputCls, 'h-9 w-auto')} value={novaHora} onChange={(e) => setNovaHora(e.target.value)} /></div>
              <button type="button" className={cn(btnGhost, 'h-9 px-2 text-xs')} onClick={() => setNovaData(somaDias(hojeLocal(), 1))}>Amanhã</button>
              <button type="button" className={cn(btnGhost, 'h-9 px-2 text-xs')} onClick={() => setNovaData(somaDias(hojeLocal(), 7))}>+7 dias</button>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">O motivo, se houver, é a observação acima. Fica registrado no histórico.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={cn(btnGhost, 'h-8 text-xs')} onClick={() => setAdiando(false)}>Voltar</button>
              <button type="button" className={cn(btnPrimary, 'h-8 text-xs')} disabled={adiandoSalva || !novaData} onClick={() => void confirmarAdiar()}>
                {adiandoSalva ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />} Confirmar adiamento
              </button>
            </div>
          </div>
        )}
        {t.concluida_em && <p className="text-xs text-gray-500">Concluída em {fmtDataHora(t.concluida_em)}{t.concluida_por ? ` por ${base.nomeUsuario(t.concluida_por)}` : ''}.</p>}

        {/* Histórico: quem fez o quê e quando (inclui observações, adiamentos e edições). */}
        <div>
          <p className={cn(labelCls, 'inline-flex items-center gap-1')}><History className="h-3.5 w-3.5" /> Histórico <InfoHint text="Tudo que aconteceu com esta tarefa, do mais novo para o mais antigo: quem criou ou gerou, iniciou, mexeu no checklist, adiou, editou, concluiu, reabriu ou cancelou, com a observação de cada ação." /></p>
          {historico.isLoading ? (
            <p className="text-xs text-gray-400">Carregando…</p>
          ) : (historico.data ?? []).length === 0 ? (
            <p className="text-xs text-gray-400">Nada registrado ainda.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
              {(historico.data ?? []).map((a) => (
                <li key={a.id} className="text-gray-600 dark:text-gray-300">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{a.autor_nome ?? 'Alguém'}</span> {ATIVIDADE_VERBO[a.tipo]}
                  {a.detalhe && a.tipo !== 'criada' && a.tipo !== 'gerada' ? <> <span className="text-gray-700 dark:text-gray-300">{a.detalhe.startsWith(t.titulo) ? a.detalhe.slice(t.titulo.length).replace(/^\s*—\s*/, '') || 'a tarefa' : a.detalhe}</span></> : ' a tarefa'}
                  <span className="text-gray-400"> · {fmtDataHora(a.criado_em)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ModalRodape className="justify-between">
          <span className="flex flex-wrap gap-1.5">
            {aberta && base.podeGerir && (
              <button type="button" className={cn(btnGhost, 'h-8 px-2 text-xs text-red-600 dark:text-red-400')} onClick={() => { setAdiando(false); setCancelando(true) }} disabled={cancelando}><XCircle className="h-3.5 w-3.5" /> Cancelar tarefa</button>
            )}
            {onEditar && aberta && (
              <button type="button" className={cn(btnGhost, 'h-8 px-2 text-xs')} onClick={() => onEditar(t)}><Pencil className="h-3.5 w-3.5" /> Editar</button>
            )}
            {podeAdiar && !adiando && (
              <button type="button" className={cn(btnGhost, 'h-8 px-2 text-xs')} onClick={() => setAdiando(true)}><CalendarClock className="h-3.5 w-3.5" /> Adiar</button>
            )}
          </span>
          <AcoesTarefa t={t} onMudar={mudarComObs} destaque={checklistCompleto} />
        </ModalRodape>
      </div>
    </Modal>
  )
}

/* ─── nova tarefa avulsa / edição ─────────────────────────────────────── */

const TarefaForm = ({ tarefa, onClose, onSalva }: { tarefa?: TarefaRow | null; onClose: () => void; onSalva: () => void }) => {
  const base = useGestaoBase()
  const edicao = !!tarefa
  const [titulo, setTitulo] = useState(tarefa?.titulo ?? '')
  const [empresa, setEmpresa] = useState(tarefa?.empresa_codigo != null ? String(tarefa.empresa_codigo) : '')
  const [responsavel, setResponsavel] = useState(tarefa?.responsavel_id ?? '')
  const [setor, setSetor] = useState(tarefa?.setor_id ?? '')
  // Depois das 18h o padrão já é amanhã, pra tarefa não nascer atrasada.
  const [data, setData] = useState(tarefa ? tarefa.vence_dia : new Date().getHours() >= 18 ? somaDias(hojeLocal(), 1) : hojeLocal())
  const [hora, setHora] = useState(tarefa ? horaDe(tarefa.vence_em) : '18:00')
  const [descricao, setDescricao] = useState(tarefa?.descricao ?? '')
  // Checklist como lista de etapas (adiciona uma por vez, igual na rotina).
  // Na edição, etapas já marcadas continuam marcadas.
  const [checklist, setChecklist] = useState<ChecklistItem[]>(tarefa ? tarefa.checklist : [])
  const [novaEtapa, setNovaEtapa] = useState('')
  const addEtapa = () => { const t = novaEtapa.trim(); if (!t) return; setChecklist((xs) => [...xs, { texto: t, feito: false }]); setNovaEtapa('') }
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tentou, setTentou] = useState(false)

  // Validação visível no campo (não só na mensagem de erro).
  const tituloInvalido = titulo.trim().length < 3
  const respInvalido = !responsavel
  const dataPassada = !!data && (data < hojeLocal() || (data === hojeLocal() && (hora || '18:00') < horaDe(new Date().toISOString())))
  const campoErro = 'border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-700'

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
      }
      if (tarefa) await editarTarefa(tarefa, input, base.autor)
      else await criarTarefa(base.redeId!, input, base.autor)
      onSalva()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={onClose} titulo={<span className="inline-flex items-center gap-2">{edicao ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {edicao ? 'Editar tarefa' : 'Nova tarefa'}</span>}>
      <div className="space-y-3">
        <div>
          <label className={labelCls} htmlFor="tf-titulo">Título</label>
          <input id="tf-titulo" className={cn(inputCls, tentou && tituloInvalido && campoErro)} placeholder="Ex.: Conferir fechamento de caixa" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
          {tentou && tituloInvalido && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">Dê um título com 3 letras ou mais.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={labelCls} htmlFor="tf-posto">Posto</label>
            <select id="tf-posto" className={selectCls} value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
              <option value="">Sem posto (rede)</option>
              {base.postos.map((p) => <option key={p.codigo} value={p.codigo}>{p.fantasia || p.razao || `Posto ${p.codigo}`}</option>)}
            </select></div>
          <div><label className={cn(labelCls, 'inline-flex items-center gap-1')} htmlFor="tf-resp">Responsável <span className="font-normal text-gray-400">(obrigatório)</span> <InfoHint text="Quem vai executar. Precisa ter login no Visor nesta rede: a tarefa aparece em Minhas pendentes dele e conta na bolinha do menu." /></label>
            <select id="tf-resp" className={cn(selectCls, tentou && respInvalido && campoErro)} value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">Selecione…</option>
              {base.usuarios.map((u) => <option key={u.user_id} value={u.user_id}>{u.nome}</option>)}
            </select>
            {tentou && respInvalido && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">Escolha quem vai fazer.</p>}
          </div>
          <div><label className={labelCls} htmlFor="tf-setor">Setor</label>
            <select id="tf-setor" className={selectCls} value={setor} onChange={(e) => setSetor(e.target.value)}>
              <option value="">Sem setor</option>
              {base.setores.filter((s) => s.ativo || s.id === setor).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls} htmlFor="tf-data">Vence em</label><input id="tf-data" type="date" className={cn(inputCls, tentou && !data && campoErro)} value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><label className={labelCls} htmlFor="tf-hora">Horário</label><input id="tf-hora" type="time" className={inputCls} value={hora} onChange={(e) => setHora(e.target.value)} /></div>
            <div className="col-span-2 -mt-1 flex flex-wrap gap-1">
              {([['Hoje', hojeLocal()], ['Amanhã', somaDias(hojeLocal(), 1)], ['Segunda', proximaSegunda(hojeLocal())]] as const).map(([rotulo, dia]) => (
                <button key={rotulo} type="button" onClick={() => setData(dia)}
                  className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', data === dia ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#0f0f0f] dark:text-gray-300')}>
                  {rotulo}
                </button>
              ))}
            </div>
            {dataPassada && <p className="col-span-2 -mt-1 text-[11px] text-amber-600 dark:text-amber-400">Essa data já passou: a tarefa vai nascer atrasada.</p>}
          </div>
        </div>
        <div><label className={labelCls} htmlFor="tf-desc">Descrição (opcional)</label><textarea id="tf-desc" className={inputCls} rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
        <div>
          <label className={cn(labelCls, 'inline-flex items-center gap-1')} htmlFor="tf-check">Checklist (opcional) <InfoHint text="Etapas que precisam ser marcadas antes de concluir. Com checklist, a lista mostra Abrir checklist em vez de Concluir, e marcar a primeira etapa já põe a tarefa em andamento." /></label>
          {checklist.length > 0 && (
            <ul className="mb-2 space-y-1">
              {checklist.map((c, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1 text-sm text-gray-700 dark:bg-white/[0.04] dark:text-gray-200">
                  <span className="flex-1">{i + 1}. {c.texto}{c.feito && <span className="ml-1 text-[11px] text-emerald-600">(feita)</span>}</span>
                  <button type="button" className="text-xs text-gray-400 hover:text-red-600" onClick={() => setChecklist((xs) => xs.filter((_, j) => j !== i))} aria-label="Remover etapa"><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input id="tf-check" className={inputCls} placeholder="Ex.: Conferir sangrias" value={novaEtapa} onChange={(e) => setNovaEtapa(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEtapa() } }} />
            <button type="button" className={cn(btnGhost, 'shrink-0')} onClick={addEtapa} disabled={!novaEtapa.trim()}><Plus className="h-4 w-4" /> Etapa</button>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">Digite a etapa e aperte Enter ou "Etapa". Com checklist, a tarefa só conclui pela lista de etapas.</p>
        </div>
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
