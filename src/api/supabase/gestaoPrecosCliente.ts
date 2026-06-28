import { supabase } from '@/lib/supabase'

/**
 * Preço especial POR CLIENTE (espelho da aba "Tabela de Preço" do Cadastro de
 * Clientes do WebPosto). READ-ONLY no app; ingestão por seed/import. Tolerante:
 * se a tabela ainda não existe (schema não rodado), retorna [] sem quebrar.
 */
export interface GestaoPrecoCliente {
  id: string
  rede_id: string
  cliente_nome: string
  cliente_codigo: number | null
  filial_nome: string | null
  produto_nome: string
  produto_codigo: number | null
  prazo: string | null
  preco_base: number | null
  preco_custo: number | null
  tipo: 'especifico' | 'ajuste'
  valor: number
  /** Preço final do contrato (base ± ajuste) — a referência do cliente. */
  preco_calculado: number | null
  tipo_transacao: string | null
  regra: 'sempre' | 'so_bomba_maior' | 'so_bomba_menor'
}

export const fetchGestaoPrecosCliente = async (): Promise<GestaoPrecoCliente[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('gestao_precos_cliente')
    .select('*')
    .order('cliente_nome', { ascending: true })
  if (error) {
    console.warn('[gp_cliente] fetch error:', error.message)
    return []
  }
  return (data ?? []) as GestaoPrecoCliente[]
}
