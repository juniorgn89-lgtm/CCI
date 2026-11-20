import { supabase } from '@/lib/supabase'

/**
 * Chamados internos (bug / melhoria / número estranho / dúvida), abertos pelo
 * botão do topo. Diretores veem todos; quem tem a permissão de abrir chamado
 * vê os próprios ("Meus chamados"). O print vai para o bucket PRIVADO
 * "chamados" e, depois que a Central CCI confirma, vive só lá.
 * Status e resposta são da Central (o Visor só espelha); o autor pode cancelar.
 * SQL: docs/supabase-chamados*.sql.
 */
export type ChamadoTipo = 'bug' | 'melhoria' | 'numero' | 'duvida'
export type ChamadoStatus = 'novo' | 'analise' | 'resolvido' | 'descartado' | 'cancelado'

export const TIPO_LABEL: Record<ChamadoTipo, string> = {
  bug: 'Bug',
  melhoria: 'Melhoria',
  numero: 'Número estranho',
  duvida: 'Dúvida',
}
export const TIPO_AJUDA: Record<ChamadoTipo, string> = {
  bug: 'Algo quebrou ou não funciona',
  melhoria: 'Ideia ou pedido',
  numero: 'Um valor que não bate (com o WebPosto, com outra tela…)',
  duvida: 'Não ficou claro o que a tela mostra',
}
export const STATUS_LABEL: Record<ChamadoStatus, string> = {
  novo: 'Novo',
  analise: 'Em análise',
  resolvido: 'Resolvido',
  descartado: 'Descartado',
  cancelado: 'Cancelado',
}
/** Encerrados: não dá mais para cancelar. */
export const STATUS_FINAL: ChamadoStatus[] = ['resolvido', 'descartado', 'cancelado']
export const ehAberto = (s: ChamadoStatus) => s === 'novo' || s === 'analise'

/** Data e hora curtas (dd/mm/aa hh:mm). */
export const fmtQuando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

export interface ChamadoContexto {
  url: string
  tela: string
  titulo?: string
  rede?: { id: string | null; nome: string | null }
  filtros?: { empresaCodigos: number[]; dataInicial: string; dataFinal: string }
  versao: string
  navegador: string
  viewport: string
  tema: 'claro' | 'escuro'
  recorte?: { x: number; y: number; w: number; h: number } | 'tela inteira'
  erros: { quando: string; mensagem: string }[]
}

export interface ChamadoRow {
  id: string
  tipo: ChamadoTipo
  descricao: string
  status: ChamadoStatus
  print_path: string | null
  contexto: ChamadoContexto
  rede_id: string | null
  autor_id: string | null
  autor_nome: string | null
  resposta: string | null
  criado_em: string
  atualizado_em: string
  /** Central CCI (docs/supabase-chamados-central.sql). undefined = SQL ainda não rodado. */
  central_id?: string | null
  central_enviado_em?: string | null
  central_erro?: string | null
  /** Meus chamados / cancelamento / status da Central (docs/supabase-chamados-meus.sql). */
  cancelado_motivo?: string | null
  cancelado_em?: string | null
  cancelado_por?: string | null
  central_cancelado_em?: string | null
  resolvido_por_nome?: string | null
  central_sincronizado_em?: string | null
}

const BUCKET = 'chamados'

const need = () => {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

const erro = (e: { message: string; code?: string }) =>
  new Error(e.code === '42P01' ? 'A tabela de chamados ainda não existe: rode docs/supabase-chamados.sql no Supabase.' : e.message)

export const criarChamado = async (input: {
  tipo: ChamadoTipo
  descricao: string
  print: Blob | null
  contexto: ChamadoContexto
  redeId: string | null
  autor: { userId: string; nome: string }
}): Promise<void> => {
  const sb = need()
  const id = crypto.randomUUID()
  let path: string | null = null
  if (input.print) {
    path = `${id}.png`
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, input.print, { contentType: 'image/png', upsert: false })
    if (upErr) {
      throw new Error(/bucket not found/i.test(upErr.message)
        ? 'O armazenamento dos prints ainda não existe: rode docs/supabase-chamados.sql no Supabase.'
        : `Não foi possível enviar o print: ${upErr.message}`)
    }
  }
  const { error } = await sb.from('chamados').insert({
    id,
    tipo: input.tipo,
    descricao: input.descricao.trim(),
    print_path: path,
    contexto: input.contexto,
    rede_id: input.redeId,
    autor_id: input.autor.userId,
    autor_nome: input.autor.nome,
  })
  if (error) {
    if (path) await sb.storage.from(BUCKET).remove([path]).catch(() => undefined)
    throw erro(error)
  }
  // Repassa pra Central CCI em segundo plano: quem abriu não espera e não vê
  // erro — se falhar, fica "pendente" no Painel › Chamados pra reenviar.
  void enviarParaCentral(id).catch(() => undefined)
}

/** Lê a mensagem de erro que a Edge Function devolveu no corpo. */
const erroDaFuncao = async (error: { message: string }, funcao: string) => {
  let msg = error.message
  try {
    const ctx = (error as { context?: Response }).context
    const j = ctx ? await ctx.json() : null
    if (j?.erro) msg = j.erro
  } catch { /* mantém a mensagem genérica */ }
  if (/not found|404/i.test(msg) && !/Chamado/.test(msg)) msg = `A função ${funcao} ainda não foi publicada no Supabase do Visor.`
  return new Error(msg)
}

/**
 * Pede à Edge Function do Visor (enviar-chamado-central) que mande este chamado
 * para a Central CCI. Pode repetir à vontade: a Central não duplica.
 */
export const enviarParaCentral = async (id: string): Promise<{ centralId: string }> => {
  const { data, error } = await need().functions.invoke('enviar-chamado-central', { body: { chamado_id: id } })
  if (error) throw await erroDaFuncao(error, 'enviar-chamado-central')
  const r = data as { ok?: boolean; central_id?: string; erro?: string }
  if (!r?.ok || !r.central_id) throw new Error(r?.erro ?? 'A Central não confirmou o recebimento.')
  return { centralId: r.central_id }
}

export const fetchChamados = async (): Promise<ChamadoRow[]> => {
  const { data, error } = await need().from('chamados').select('*').order('criado_em', { ascending: false }).limit(500)
  if (error) throw erro(error)
  return (data ?? []) as ChamadoRow[]
}

/** Meus chamados: só os que EU abri (a RLS libera para quem tem a permissão). */
export const fetchMeusChamados = async (meuId: string): Promise<ChamadoRow[]> => {
  const { data, error } = await need().from('chamados').select('*').eq('autor_id', meuId)
    .order('criado_em', { ascending: false }).limit(200)
  if (error) throw erro(error)
  return (data ?? []) as ChamadoRow[]
}

export interface ResultadoCentral { ok: boolean; atualizados?: number; indisponivel?: boolean; local?: boolean; erro?: string }

/**
 * Pergunta à Central o status e a resposta (e reenvia cancelamentos pendentes).
 * Em silêncio: se falhar, fica o que já tinha.
 */
export const sincronizarComCentral = async (ids?: string[]): Promise<ResultadoCentral> => {
  try {
    const { data, error } = await need().functions.invoke('chamados-central', { body: { acao: 'sincronizar', ...(ids?.length ? { ids } : {}) } })
    if (error) return { ok: false }
    return data as ResultadoCentral
  } catch { return { ok: false } }
}

/**
 * Cancela (motivo obrigatório, mín. 5 letras) e avisa a Central. Se a Central
 * não puder ser avisada agora, o cancelamento vale aqui e é reenviado na
 * próxima sincronização.
 */
export const cancelarChamado = async (id: string, motivo: string): Promise<ResultadoCentral> => {
  const { error } = await need().rpc('chamado_cancelar', { p_id: id, p_motivo: motivo })
  if (error) {
    if (error.code === 'PGRST202') throw new Error('O cancelamento ainda não foi ativado: rode docs/supabase-chamados-meus.sql no Supabase.')
    throw erro(error)
  }
  try {
    const { data, error: fnErr } = await need().functions.invoke('chamados-central', { body: { acao: 'cancelar', chamado_id: id } })
    if (fnErr) return { ok: false, erro: (await erroDaFuncao(fnErr, 'chamados-central')).message }
    return data as ResultadoCentral
  } catch (e) { return { ok: false, erro: e instanceof Error ? e.message : String(e) } }
}

/** Exclui um chamado que ainda não foi para a Central (só diretor). Linha primeiro, depois o print. */
export const excluirChamado = async (c: Pick<ChamadoRow, 'id' | 'print_path'>) => {
  const { data, error } = await need().from('chamados').delete().eq('id', c.id).select('id')
  if (error) throw erro(error)
  if (!data?.length) throw new Error('Nada foi excluído: sem permissão para excluir este chamado.')
  if (c.print_path) await need().storage.from(BUCKET).remove([c.print_path]).catch(() => undefined)
}

/** URL temporária (1 h) do print. */
export const urlPrint = async (path: string): Promise<string> => {
  const { data, error } = await need().storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível abrir o print.')
  return data.signedUrl
}
