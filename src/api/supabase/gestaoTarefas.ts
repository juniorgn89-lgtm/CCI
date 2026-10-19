import { supabase } from '@/lib/supabase'

/**
 * Gestão · Tarefas, Rotinas e Setores — dados próprios do Visor por rede
 * (docs/supabase-gestao-tarefas.sql). Escritas são chamadas DIRETO dos
 * handlers (nunca useMutation, ver CLAUDE.md) e o caller invalida as queries.
 */

export type TarefaStatus = 'a_fazer' | 'em_andamento' | 'concluida' | 'cancelada'
export type Recorrencia = 'diaria' | 'dias_uteis' | 'personalizada'
export type ReferenteA = 'proprio_dia' | 'dia_anterior' | 'dia_util_anterior' | 'mes_anterior'

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

/**
 * Próximo dia (yyyy-MM-dd) em que a rotina gera tarefa, a partir de `aPartirDe`
 * (inclusive). Espelha a regra do gerar_tarefas_de_rotinas: diária = todo dia,
 * dias úteis = seg–sex, personalizada = dias_semana (0 = domingo). null = nunca.
 */
export const proximaGeracao = (
  r: Pick<RotinaRow, 'recorrencia' | 'dias_semana' | 'inicio_em'>,
  aPartirDe: string,
): string | null => {
  const base = r.inicio_em > aPartirDe ? r.inicio_em : aPartirDe
  const [y, m, d] = base.split('-').map(Number)
  for (let i = 0; i < 14; i++) {
    const dt = new Date(y, m - 1, d + i)
    const dow = dt.getDay()
    const gera = r.recorrencia === 'diaria' ? true : r.recorrencia === 'dias_uteis' ? dow >= 1 && dow <= 5 : r.dias_semana.includes(dow)
    if (gera) return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }
  return null
}

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

export const atualizarRotina = async (id: string, patch: Partial<RotinaInput>) => {
  const { error } = await need().from('gestao_rotinas').update(patch).eq('id', id)
  if (error) throw erro(error)
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
  criado_em: string
}

const BUCKET = 'gestao-anexos'
export const ANEXO_MAX_BYTES = 15 * 1024 * 1024

export const fetchAnexos = async (tarefaId: string): Promise<AnexoRow[]> => {
  const { data, error } = await need().from('gestao_anexos').select('*').eq('tarefa_id', tarefaId).order('criado_em', { ascending: false })
  if (error) throw erro(error)
  return (data as AnexoRow[]) ?? []
}

/** Sobe o arquivo no bucket privado e registra na tabela. */
export const enviarAnexo = async (t: TarefaRow, file: File, autor: Autor): Promise<AnexoRow> => {
  if (file.size > ANEXO_MAX_BYTES) throw new Error('Arquivo acima de 15 MB.')
  const sb = need()
  const seguro = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80)
  const path = `${t.rede_id}/${t.id}/${crypto.randomUUID()}-${seguro}`
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (upErr) throw new Error(`Não foi possível enviar o arquivo: ${upErr.message}`)
  const { data, error } = await sb
    .from('gestao_anexos')
    .insert({ rede_id: t.rede_id, tarefa_id: t.id, nome: file.name, path, tamanho: file.size, tipo: file.type || null, autor_id: autor.userId, autor_nome: autor.nome })
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
