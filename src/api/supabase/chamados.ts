import { supabase } from '@/lib/supabase'

/**
 * Chamados internos (bug / melhoria / número estranho / dúvida), abertos pelo
 * botão do topo. Só diretores da CCI (RLS: profiles.is_master). O print vai
 * para o bucket PRIVADO "chamados". SQL: docs/supabase-chamados.sql.
 */
export type ChamadoTipo = 'bug' | 'melhoria' | 'numero' | 'duvida'
export type ChamadoStatus = 'novo' | 'analise' | 'resolvido' | 'descartado'

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
}

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
}

export const fetchChamados = async (): Promise<ChamadoRow[]> => {
  const { data, error } = await need().from('chamados').select('*').order('criado_em', { ascending: false }).limit(500)
  if (error) throw erro(error)
  return (data ?? []) as ChamadoRow[]
}

/** URL temporária (1 h) do print. */
export const urlPrint = async (path: string): Promise<string> => {
  const { data, error } = await need().storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error || !data) throw new Error(error?.message ?? 'Não foi possível abrir o print.')
  return data.signedUrl
}

export const atualizarChamado = async (id: string, patch: Partial<Pick<ChamadoRow, 'status' | 'resposta'>>) => {
  const { data, error } = await need()
    .from('chamados')
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) throw erro(error)
  if (!data?.length) throw new Error('Nada foi salvo: sem permissão para alterar este chamado.')
}
