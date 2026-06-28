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
