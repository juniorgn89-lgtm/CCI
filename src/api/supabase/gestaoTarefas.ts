import { supabase } from '@/lib/supabase'

/**
 * Gestão · Tarefas, Rotinas e Setores — dados próprios do Visor por rede
 * (docs/supabase-gestao-tarefas.sql). Escritas são chamadas DIRETO dos
 * handlers (nunca useMutation, ver CLAUDE.md) e o caller invalida as queries.
 */

export type TarefaStatus = 'a_fazer' | 'em_andamento' | 'concluida' | 'cancelada'
export type Recorrencia = 'diaria' | 'dias_uteis' | 'personalizada'
export type ReferenteA = 'proprio_dia' | 'dia_anterior' | 'dia_util_anterior' | 'mes_anterior'
/** Como a recorrência personalizada escolhe os dias (docs/supabase-gestao-tarefas-4.sql). */
export type ModoPersonalizado = 'semana' | 'mes' | 'ano' | 'escala'
export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'

export const MODO_PERSONALIZADO_LABEL: Record<ModoPersonalizado, string> = {
  semana: 'Dias da semana',
  mes: 'Dias do mês',
  ano: 'Datas no ano',
  escala: 'Escala',
}
export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}
/** Peso para ordenar: urgente primeiro. */
export const PRIORIDADE_PESO: Record<Prioridade, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 }
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export const STATUS_LABEL: Record<TarefaStatus, string> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}
export const RECORRENCIA_LABEL: Record<Recorrencia, string> = {
  diaria: 'Todos os dias',
  dias_uteis: 'Dias úteis',
  personalizada: 'Personalizada',
}
export const REFERENTE_LABEL: Record<ReferenteA, string> = {
  proprio_dia: 'O próprio dia',
  dia_anterior: 'Dia anterior',
  dia_util_anterior: 'Dia útil anterior',
  mes_anterior: 'Mês anterior',
}
export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
/** Verbo de cada tipo de atividade, pra montar "Fulano concluiu X". */
export const ATIVIDADE_VERBO: Record<AtividadeRow['tipo'], string> = {
  criada: 'criou', gerada: 'gerou', iniciada: 'iniciou', concluida: 'concluiu', reaberta: 'reabriu', cancelada: 'cancelou',
  checklist: 'atualizou o checklist de', adiada: 'adiou', editada: 'editou',
}

export interface ChecklistItem {
  texto: string
  feito: boolean
}

export interface SetorRow {
  id: string
  rede_id: string
  nome: string
  ativo: boolean
  criado_em: string
}

export interface RotinaRow {
  id: string
  rede_id: string
  nome: string
  descricao: string | null
  empresa_codigos: number[]
  responsavel_id: string | null
  setor_id: string | null
  recorrencia: Recorrencia
  dias_semana: number[]
  hora_vencimento: string
  inicio_em: string
  referente_a: ReferenteA
  checklist: string[]
  ativa: boolean
  modo_personalizado: ModoPersonalizado
  /** 1–31; 0 = último dia do mês. */
  dias_mes: number[]
  /** 'MM-DD'. */
  datas_ano: string[]
  escala_trabalha: number | null
  escala_folga: number | null
  prioridade: Prioridade
  exige_anexo: boolean
  documentos_exigidos: string[]
  criado_por: string | null
  criado_em: string
  atualizado_em: string
}

export interface TarefaRow {
  id: string
  rede_id: string
  rotina_id: string | null
  titulo: string
  descricao: string | null
  empresa_codigo: number | null
  responsavel_id: string | null
  setor_id: string | null
  status: TarefaStatus
  vence_em: string
  vence_dia: string
  data_ref: string | null
  checklist: ChecklistItem[]
  prioridade: Prioridade
  /** Só conclui com anexo (foto ou documento). */
  exige_anexo: boolean
  /** Nome de cada anexo obrigatório; vazio + exige_anexo = basta um anexo qualquer. */
  documentos_exigidos: string[]
  concluida_em: string | null
  concluida_por: string | null
  criado_por: string | null
  criado_por_nome: string | null
  criado_em: string
  atualizado_em: string
}

export interface UsuarioRede {
  user_id: string
  nome: string
  email: string
  role: string
  is_master: boolean
}

export interface AtividadeRow {
  id: string
  rede_id: string
  tarefa_id: string
  tipo: 'criada' | 'iniciada' | 'concluida' | 'reaberta' | 'cancelada' | 'checklist' | 'gerada' | 'adiada' | 'editada'
  autor_id: string | null
  autor_nome: string | null
  detalhe: string | null
  criado_em: string
}

const need = () => {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

const erro = (e: { message: string; details?: string | null; hint?: string | null }) =>
  new Error([e.message, e.details, e.hint].filter(Boolean).join(' · '))

/** Está atrasada: aberta e já passou do vencimento. */
export const estaAtrasada = (t: TarefaRow, agora = Date.now()) =>
  (t.status === 'a_fazer' || t.status === 'em_andamento') && new Date(t.vence_em).getTime() < agora

/** Dia local yyyy-MM-dd de um timestamptz (fuso do navegador = Brasília na prática). */
export const diaLocal = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ─── leituras ─────────────────────────────────────────────────────────── */

export const fetchUsuariosDaRede = async (redeId: string): Promise<UsuarioRede[]> => {
  const { data, error } = await need().rpc('usuarios_da_rede', { p_rede: redeId })
  if (error) throw erro(error)
  return (data as UsuarioRede[]) ?? []
}

export const fetchSetores = async (redeId: string): Promise<SetorRow[]> => {
  const { data, error } = await need().from('gestao_setores').select('*').eq('rede_id', redeId).order('nome')
  if (error) throw erro(error)
  return (data as SetorRow[]) ?? []
}

export const fetchRotinas = async (redeId: string): Promise<RotinaRow[]> => {
  const { data, error } = await need().from('gestao_rotinas').select('*').eq('rede_id', redeId).order('nome')
  if (error) throw erro(error)
  return (data as RotinaRow[]) ?? []
}

/** Tarefas da rede com vencimento no intervalo [de, ate] (dias yyyy-MM-dd). */
export const fetchTarefas = async (redeId: string, de: string, ate: string): Promise<TarefaRow[]> => {
  const { data, error } = await need()
    .from('gestao_tarefas')
    .select('*')
    .eq('rede_id', redeId)
    .gte('vence_dia', de)
    .lte('vence_dia', ate)
    .order('vence_em', { ascending: true })
  if (error) throw erro(error)
  return (data as TarefaRow[]) ?? []
}

export const fetchAtividadesRecentes = async (redeId: string, limite = 20): Promise<AtividadeRow[]> => {
  const { data, error } = await need()
    .from('gestao_atividades')
    .select('*')
    .eq('rede_id', redeId)
    .order('criado_em', { ascending: false })
    .limit(limite)
  if (error) throw erro(error)
  return (data as AtividadeRow[]) ?? []
}

/** Histórico de uma tarefa (mais recente primeiro). */
export const fetchAtividadesDaTarefa = async (tarefaId: string, limite = 30): Promise<AtividadeRow[]> => {
  const { data, error } = await need()
    .from('gestao_atividades')
    .select('*')
    .eq('tarefa_id', tarefaId)
    .order('criado_em', { ascending: false })
    .limit(limite)
  if (error) throw erro(error)
  return (data as AtividadeRow[]) ?? []
}

type RegraGeracao = Pick<RotinaRow, 'recorrencia' | 'dias_semana' | 'inicio_em' | 'modo_personalizado' | 'dias_mes' | 'datas_ano' | 'escala_trabalha' | 'escala_folga'>

const iso = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
const diasEntre = (de: string, ate: string) => {
  const [a, b, c] = de.split('-').map(Number); const [x, y, z] = ate.split('-').map(Number)
  return Math.round((Date.UTC(x, y - 1, z) - Date.UTC(a, b - 1, c)) / 86_400_000)
}

/** A rotina gera tarefa neste dia? Espelha o gerar_tarefas_de_rotinas (SQL). */
export const geraNoDia = (r: RegraGeracao, dia: string): boolean => {
  if (dia < r.inicio_em) return false
  const [y, m, d] = dia.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay()
  if (r.recorrencia === 'diaria') return true
  if (r.recorrencia === 'dias_uteis') return dow >= 1 && dow <= 5
  const modo = r.modo_personalizado ?? 'semana'
  if (modo === 'semana') return r.dias_semana.includes(dow)
  if (modo === 'mes') {
    const ultimo = new Date(y, m, 0).getDate()
    return r.dias_mes.includes(d) || (r.dias_mes.includes(0) && d === ultimo)
  }
  if (modo === 'ano') return r.datas_ano.includes(dia.slice(5))
  const trab = r.escala_trabalha ?? 0
  const folga = r.escala_folga ?? 0
  if (trab <= 0) return false
  return diasEntre(r.inicio_em, dia) % (trab + folga) < trab
}

/**
 * Próximo dia (yyyy-MM-dd) em que a rotina gera tarefa, a partir de `aPartirDe`
 * (inclusive). Procura até um ano à frente (datas no ano). null = nunca.
 */
export const proximaGeracao = (r: RegraGeracao, aPartirDe: string): string | null => {
  const base = r.inicio_em > aPartirDe ? r.inicio_em : aPartirDe
  const [y, m, d] = base.split('-').map(Number)
  for (let i = 0; i < 400; i++) {
    const dia = iso(new Date(y, m - 1, d + i))
    if (geraNoDia(r, dia)) return dia
  }
  return null
}

/** Anexos que ainda faltam para concluir: os nomes exigidos sem arquivo, ou [''] quando basta um qualquer e não há nenhum. */
export const anexosFaltando = (t: Pick<TarefaRow, 'exige_anexo' | 'documentos_exigidos'>, anexos: Pick<AnexoRow, 'documento'>[]): string[] => {
  const docs = t.documentos_exigidos ?? []
  if (docs.length > 0) return docs.filter((d) => !anexos.some((a) => a.documento === d))
  return t.exige_anexo && anexos.length === 0 ? [''] : []
}
/** A tarefa pede anexo para concluir? */
export const exigeAnexo = (t: Pick<TarefaRow, 'exige_anexo' | 'documentos_exigidos'>) => !!t.exige_anexo || (t.documentos_exigidos ?? []).length > 0

/* ─── escritas ─────────────────────────────────────────────────────────── */

interface Autor {
  userId: string
  nome: string
}

const registrarAtividade = async (redeId: string, tarefaId: string, tipo: AtividadeRow['tipo'], autor: Autor, detalhe?: string) => {
  const { error } = await need().from('gestao_atividades').insert({
    rede_id: redeId, tarefa_id: tarefaId, tipo, autor_id: autor.userId, autor_nome: autor.nome, detalhe: detalhe ?? null,
  })
  if (error) console.warn('[gestao] atividade não registrada:', error.message)
}

export const criarSetor = async (redeId: string, nome: string): Promise<SetorRow> => {
  const { data, error } = await need().from('gestao_setores').insert({ rede_id: redeId, nome: nome.trim() }).select().single()
  if (error) throw error.code === '23505' ? new Error('Já existe um setor com esse nome.') : erro(error)
  return data as SetorRow
}

export const atualizarSetor = async (id: string, patch: Partial<Pick<SetorRow, 'nome' | 'ativo'>>) => {
  const { error } = await need().from('gestao_setores').update(patch).eq('id', id)
  if (error) throw erro(error)
}

export type RotinaInput = Omit<RotinaRow, 'id' | 'rede_id' | 'criado_por' | 'criado_em' | 'atualizado_em'>

export const criarRotina = async (redeId: string, input: RotinaInput): Promise<RotinaRow> => {
  const { data, error } = await need().from('gestao_rotinas').insert({ rede_id: redeId, ...input }).select().single()
  if (error) throw erro(error)
  return data as RotinaRow
}

/**
 * Salva a rotina. Prioridade e anexos exigidos também valem para as tarefas
 * dela que ainda estão em aberto (o resto só nas próximas geradas).
 */
export const atualizarRotina = async (id: string, patch: Partial<RotinaInput>) => {
  const sb = need()
  const { error } = await sb.from('gestao_rotinas').update(patch).eq('id', id)
  if (error) throw erro(error)
  const emAberto: Record<string, unknown> = {}
  if (patch.prioridade !== undefined) emAberto.prioridade = patch.prioridade
  if (patch.exige_anexo !== undefined) emAberto.exige_anexo = patch.exige_anexo
  if (patch.documentos_exigidos !== undefined) emAberto.documentos_exigidos = patch.documentos_exigidos
  if (Object.keys(emAberto).length) {
    const { error: e2 } = await sb.from('gestao_tarefas').update(emAberto).eq('rotina_id', id).in('status', ['a_fazer', 'em_andamento'])
    if (e2) console.warn('[gestao] tarefas em aberto não atualizadas:', e2.message)
  }
}

/**
 * Exclui a rotina de vez (gestor/diretor — a RLS barra os demais). As tarefas
 * já geradas FICAM no histórico, só perdem o vínculo (rotina_id → null); nada
 * mais é gerado. Pra parar sem apagar, use `ativa: false`.
 */
export const excluirRotina = async (id: string) => {
  const { data, error } = await need().from('gestao_rotinas').delete().eq('id', id).select('id')
  if (error) throw erro(error)
  if (!data?.length) throw new Error('Nada foi excluído: só gestor ou diretor podem excluir rotinas.')
}

/** Gera (idempotente) as tarefas das rotinas para um dia. Default: hoje em Brasília. */
export const gerarTarefasDeRotinas = async (dia?: string): Promise<number> => {
  const { data, error } = await need().rpc('gerar_tarefas_de_rotinas', dia ? { p_data: dia } : {})
  if (error) throw erro(error)
  return (data as number) ?? 0
}

export interface TarefaInput {
  titulo: string
  descricao: string | null
  empresa_codigo: number | null
  responsavel_id: string | null
  setor_id: string | null
  /** ISO completo do vencimento. */
  vence_em: string
  checklist: ChecklistItem[]
  prioridade: Prioridade
  exige_anexo: boolean
  documentos_exigidos: string[]
}

export const criarTarefa = async (redeId: string, input: TarefaInput, autor: Autor): Promise<TarefaRow> => {
  const { data, error } = await need()
    .from('gestao_tarefas')
    .insert({ rede_id: redeId, ...input, vence_dia: diaLocal(input.vence_em), criado_por: autor.userId, criado_por_nome: autor.nome })
    .select()
    .single()
  if (error) throw erro(error)
  const t = data as TarefaRow
  await registrarAtividade(redeId, t.id, 'criada', autor, t.titulo)
  return t
}

export const atualizarTarefa = async (id: string, patch: Partial<TarefaInput & { status: TarefaStatus }>) => {
  const body: Record<string, unknown> = { ...patch }
  if (patch.vence_em) body.vence_dia = diaLocal(patch.vence_em)
  const { data, error } = await need().from('gestao_tarefas').update(body).eq('id', id).select('id')
  if (error) throw erro(error)
  if (!data?.length) throw new Error('Nada foi salvo: você não tem permissão para alterar esta tarefa.')
}

/** Edita campos da tarefa (gestor, ou quem criou) e registra no histórico. */
export const editarTarefa = async (t: TarefaRow, patch: Partial<TarefaInput>, autor: Autor) => {
  await atualizarTarefa(t.id, patch)
  const mudou: string[] = []
  if (patch.titulo !== undefined && patch.titulo !== t.titulo) mudou.push('título')
  if (patch.responsavel_id !== undefined && patch.responsavel_id !== t.responsavel_id) mudou.push('responsável')
  if (patch.vence_em !== undefined && patch.vence_em !== t.vence_em) mudou.push('vencimento')
  if (patch.empresa_codigo !== undefined && patch.empresa_codigo !== t.empresa_codigo) mudou.push('posto')
  if (patch.setor_id !== undefined && patch.setor_id !== t.setor_id) mudou.push('setor')
  if (patch.descricao !== undefined && (patch.descricao ?? '') !== (t.descricao ?? '')) mudou.push('descrição')
  if (patch.checklist !== undefined && JSON.stringify(patch.checklist.map((c) => c.texto)) !== JSON.stringify(t.checklist.map((c) => c.texto))) mudou.push('checklist')
  if (patch.prioridade !== undefined && patch.prioridade !== t.prioridade) mudou.push('prioridade')
  if ((patch.exige_anexo !== undefined && patch.exige_anexo !== t.exige_anexo) || (patch.documentos_exigidos !== undefined && JSON.stringify(patch.documentos_exigidos) !== JSON.stringify(t.documentos_exigidos ?? []))) mudou.push('anexos exigidos')
  await registrarAtividade(t.rede_id, t.id, 'editada', autor, mudou.length ? `${t.titulo} — ${mudou.join(', ')}` : t.titulo)
}

/** Adia o vencimento (responsável ou gestor); o motivo vai pro histórico. */
export const adiarTarefa = async (t: TarefaRow, novoVenceEm: string, autor: Autor, motivo?: string) => {
  await atualizarTarefa(t.id, { vence_em: novoVenceEm })
  const d = new Date(novoVenceEm)
  const quando = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const m = motivo?.trim()
  await registrarAtividade(t.rede_id, t.id, 'adiada', autor, `${t.titulo} — para ${quando}${m ? ` · ${m}` : ''}`)
}

export const mudarStatusTarefa = async (t: TarefaRow, status: TarefaStatus, autor: Autor, observacao?: string) => {
  const patch: Record<string, unknown> = { status }
  if (status === 'concluida') { patch.concluida_em = new Date().toISOString(); patch.concluida_por = autor.userId }
  if (status === 'a_fazer' || status === 'em_andamento') { patch.concluida_em = null; patch.concluida_por = null }
  const { data, error } = await need().from('gestao_tarefas').update(patch).eq('id', t.id).select('id')
  if (error) throw erro(error)
  if (!data?.length) throw new Error('Nada foi salvo: você não tem permissão para alterar esta tarefa.')
  const tipo: AtividadeRow['tipo'] =
    status === 'concluida' ? 'concluida' : status === 'cancelada' ? 'cancelada' : status === 'em_andamento' ? 'iniciada' : 'reaberta'
  const obs = observacao?.trim()
  await registrarAtividade(t.rede_id, t.id, tipo, autor, obs ? `${t.titulo} — ${obs}` : t.titulo)
}

/* ─── anexos (foto ou documento) ───────────────────────────────────────── */

export interface AnexoRow {
  id: string
  rede_id: string
  tarefa_id: string
  nome: string
  path: string
  tamanho: number | null
  tipo: string | null
  autor_id: string | null
  autor_nome: string | null
  /** Documento exigido que este arquivo cumpre (null = anexo livre). */
  documento: string | null
  criado_em: string
}

const BUCKET = 'gestao-anexos'
export const ANEXO_MAX_BYTES = 15 * 1024 * 1024

export const fetchAnexos = async (tarefaId: string): Promise<AnexoRow[]> => {
  const { data, error } = await need().from('gestao_anexos').select('*').eq('tarefa_id', tarefaId).order('criado_em', { ascending: false })
  if (error) throw erro(error)
  return (data as AnexoRow[]) ?? []
}

/** Sobe o arquivo no bucket privado e registra na tabela. `documento` = qual documento exigido ele cumpre. */
export const enviarAnexo = async (t: TarefaRow, file: File, autor: Autor, documento?: string | null): Promise<AnexoRow> => {
  if (file.size > ANEXO_MAX_BYTES) throw new Error('Arquivo acima de 15 MB.')
  const sb = need()
  const seguro = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80)
  const path = `${t.rede_id}/${t.id}/${crypto.randomUUID()}-${seguro}`
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (upErr) throw new Error(`Não foi possível enviar o arquivo: ${upErr.message}`)
  const { data, error } = await sb
    .from('gestao_anexos')
    .insert({ rede_id: t.rede_id, tarefa_id: t.id, nome: file.name, path, tamanho: file.size, tipo: file.type || null, autor_id: autor.userId, autor_nome: autor.nome, ...(documento ? { documento } : {}) })
    .select()
    .single()
  if (error) {
    await sb.storage.from(BUCKET).remove([path]).catch(() => undefined)
    throw erro(error)
  }
  return data as AnexoRow
}

/** URL temporária (1 h) pra abrir/baixar o anexo. */
export const urlAnexo = async (a: AnexoRow): Promise<string> => {
  const { data, error } = await need().storage.from(BUCKET).createSignedUrl(a.path, 3600)
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível gerar o link.')
  return data.signedUrl
}

export const removerAnexo = async (a: AnexoRow) => {
  const sb = need()
  const { error } = await sb.from('gestao_anexos').delete().eq('id', a.id)
  if (error) throw erro(error)
  await sb.storage.from(BUCKET).remove([a.path]).catch(() => undefined)
}

/**
 * Salva o checklist. Marcar a primeira etapa de uma tarefa "A fazer" passa
 * ela pra "Em andamento" sozinho (ninguém precisa clicar em Iniciar).
 */
/**
 * Exclui a tarefa de vez (gestor/diretor — a RLS barra os demais). Apaga os
 * arquivos do bucket antes; atividades e registros de anexo caem em cascata.
 */
export const excluirTarefa = async (t: TarefaRow) => {
  const sb = need()
  const { data: anexos } = await sb.from('gestao_anexos').select('path').eq('tarefa_id', t.id)
  const paths = ((anexos as { path: string }[] | null) ?? []).map((a) => a.path)
  if (paths.length) await sb.storage.from(BUCKET).remove(paths).catch(() => undefined)
  const { data, error } = await sb.from('gestao_tarefas').delete().eq('id', t.id).select('id')
  if (error) throw erro(error)
  if (!data?.length) throw new Error('Nada foi excluído: só gestor ou diretor podem excluir tarefas.')
}

/**
 * Exclui várias tarefas de uma vez (supervisor/diretor; a RLS de delete ainda
 * exige gestor). Remove os arquivos do bucket antes. Devolve quantas saíram.
 */
export const excluirTarefas = async (ids: string[]): Promise<number> => {
  if (!ids.length) return 0
  const sb = need()
  let apagadas = 0
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100)
    const { data: anexos } = await sb.from('gestao_anexos').select('path').in('tarefa_id', lote)
    const paths = ((anexos as { path: string }[] | null) ?? []).map((a) => a.path)
    if (paths.length) await sb.storage.from(BUCKET).remove(paths).catch(() => undefined)
    const { data, error } = await sb.from('gestao_tarefas').delete().in('id', lote).select('id')
    if (error) throw erro(error)
    apagadas += data?.length ?? 0
  }
  if (!apagadas) throw new Error('Nada foi excluído: só gestor ou diretor podem excluir tarefas.')
  return apagadas
}

/** Papel do usuário logado (profiles.role). */
export const fetchMeuPapel = async (): Promise<string | null> => {
  const sb = need()
  const { data: u } = await sb.auth.getUser()
  if (!u.user) return null
  const { data } = await sb.from('profiles').select('role').eq('user_id', u.user.id).maybeSingle()
  return (data as { role?: string } | null)?.role ?? null
}

export const salvarChecklist = async (t: TarefaRow, checklist: ChecklistItem[], autor: Autor) => {
  const feitos = checklist.filter((c) => c.feito).length
  const inicia = t.status === 'a_fazer' && feitos > 0
  const patch: Record<string, unknown> = inicia ? { checklist, status: 'em_andamento' } : { checklist }
  const { data, error } = await need().from('gestao_tarefas').update(patch).eq('id', t.id).select('id')
  if (error) throw erro(error)
  if (!data?.length) throw new Error('Nada foi salvo: você não tem permissão para alterar esta tarefa.')
  if (inicia) await registrarAtividade(t.rede_id, t.id, 'iniciada', autor, `${t.titulo} — pela primeira etapa do checklist`)
  await registrarAtividade(t.rede_id, t.id, 'checklist', autor, `${feitos}/${checklist.length} etapas`)
}
