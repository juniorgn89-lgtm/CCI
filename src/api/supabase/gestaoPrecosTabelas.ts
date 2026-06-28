import { supabase } from '@/lib/supabase'

/**
 * Leitura das "Tabelas de Preço de Prazos" ingeridas (mestre + linhas).
 * READ-ONLY no app (escrita = master, via seed/import). Tolerante: se as tabelas
 * ainda não existem (schema não rodado), o select falha → retorna [] sem quebrar.
 */

export interface GestaoPrecoTabela {
  id: string
  rede_id: string
  ref: string
  descricao: string
  validade_inicial: string | null
  validade_final: string | null
  dias_semana: number[] | null
  hora_dia: boolean
  created_at: string
}

export interface GestaoPrecoTabelaItem {
  id: string
  tabela_id: string
  /** Nome da filial como vem do WebPosto (ex.: "POSTO DARWIN") — fonte do export.
   *  É o que a UI/atribuição casa com o empresaCodigo da Quality (o nº de filial
   *  do WebPosto NÃO é o empresaCodigo). */
  filial_nome: string | null
  filial_empresa_codigo: number | null
  cliente: string | null
  grupo_cliente: string | null
  produto_nome: string
  produto_codigo: number | null
  grupo: string | null
  subgrupo: string | null
  tipo: 'especifico' | 'desconto'
  valor: number
}

export const fetchGestaoPrecoTabelas = async (): Promise<GestaoPrecoTabela[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('gestao_precos_tabelas')
    .select('*')
    .order('ref', { ascending: true })
  if (error) {
    console.warn('[gp_tabelas] fetch error:', error.message)
    return []
  }
  return (data ?? []) as GestaoPrecoTabela[]
}

/**
 * Importa/atualiza UMA tabela (mestre + linhas). Upsert do mestre por
 * (rede_id, ref); as linhas são SUBSTITUÍDAS (delete + insert) pra refletir
 * edições/remoções do WebPosto. `created_at` do mestre vira a "última
 * importação". Escrita imperativa (master via RLS) — NUNCA useMutation.
 */
export const importGestaoPrecoTabela = async (params: {
  redeId: string
  ref: string
  descricao: string
  validadeInicial: string | null
  validadeFinal: string | null
  diasSemana: number[] | null
  filialNome: string | null
  filialEmpresaCodigo: number | null
  itens: { produto_nome: string; valor: number }[]
}): Promise<{ ok: boolean; count?: number; error?: string }> => {
  if (!supabase) return { ok: false, error: 'Sem conexão com o banco.' }
  const { data: t, error: e1 } = await supabase
    .from('gestao_precos_tabelas')
    .upsert({
      rede_id: params.redeId,
      ref: params.ref,
      descricao: params.descricao,
      validade_inicial: params.validadeInicial,
      validade_final: params.validadeFinal,
      dias_semana: params.diasSemana,
      created_at: new Date().toISOString(),
    }, { onConflict: 'rede_id,ref' })
    .select('id')
    .single()
  if (e1 || !t) return { ok: false, error: e1?.message ?? 'Erro ao salvar a tabela.' }
  const { error: e2 } = await supabase.from('gestao_precos_tabela_itens').delete().eq('tabela_id', t.id)
  if (e2) return { ok: false, error: e2.message }
  if (params.itens.length > 0) {
    const rows = params.itens.map((i) => ({
      tabela_id: t.id, filial_nome: params.filialNome, filial_empresa_codigo: params.filialEmpresaCodigo, produto_nome: i.produto_nome, tipo: 'especifico', valor: i.valor,
    }))
    const { error: e3 } = await supabase.from('gestao_precos_tabela_itens').insert(rows)
    if (e3) return { ok: false, error: e3.message }
  }
  return { ok: true, count: params.itens.length }
}

/** Todas as linhas (a escala atual é pequena — dá pra contar/detalhar numa leitura só). */
export const fetchGestaoPrecoTabelaItens = async (): Promise<GestaoPrecoTabelaItem[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('gestao_precos_tabela_itens')
    .select('*')
  if (error) {
    console.warn('[gp_tabela_itens] fetch error:', error.message)
    return []
  }
  return (data ?? []) as GestaoPrecoTabelaItem[]
}
