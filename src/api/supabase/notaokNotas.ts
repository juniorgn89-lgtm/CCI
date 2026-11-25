import { supabase } from '@/lib/supabase'

/**
 * Notas de entrada espelhadas pelo NotaOK: as que ainda não foram lançadas e as
 * lançadas nos últimos 90 dias (migrations 20261125000002/3_notaok_notas*.sql). Só leitura no Visor:
 * conferir, devolver e lançar continuam no NotaOK/ERP.
 */
export type StatusNotaOk = 'pendente' | 'em_preenchimento' | 'devolvida' | 'enviada' | 'lancada'

export interface NotaOkRow {
  nota_chave: string
  notaok_nota_id: string | null
  empresa_codigo: number | null
  numero: number | null
  serie: number | null
  valor: number | null
  emissao: string | null
  fornecedor_nome: string | null
  fornecedor_cnpj: string | null
  status: StatusNotaOk
  desde: string | null
  por_nome: string | null
  motivo: string | null
  observacao: string | null
  sem_pedido: boolean
  sem_pedido_motivo: string | null
  atualizado_em: string
  lancada_em?: string | null
  lancada_por_nome?: string | null
  /** 'conferida' | 'incompleta' | 'sem' */
  lancada_conferencia?: string | null
}

/** Quantos dias de notas lançadas o NotaOK manda (o Visor apaga as mais antigas). */
export const LANCADAS_DIAS = 90

/** Pedido do Visor ligado à nota no recebimento. */
export interface PedidoDaNota { pedido_id: string; numero: number | null }

export const NOTAOK_URL = 'https://notaok.cci.app.br'

export const STATUS_NOTAOK: Record<StatusNotaOk, { rotulo: string; cor: string }> = {
  pendente: { rotulo: 'A conferir', cor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  em_preenchimento: { rotulo: 'Em conferência', cor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  devolvida: { rotulo: 'Devolvida', cor: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
  enviada: { rotulo: 'Aguardando lançamento', cor: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  lancada: { rotulo: 'Lançada', cor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
}

const need = () => {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}
const semTabela = (code?: string) => code === '42P01' || code === 'PGRST205'

/** null = a tabela ainda não existe (SQL não rodado). */
export const fetchNotasNotaok = async (redeId: string): Promise<NotaOkRow[] | null> => {
  const { data, error } = await need().from('notaok_notas').select('*').eq('rede_id', redeId)
    .order('desde', { ascending: true, nullsFirst: false }).limit(2000)
  if (error) {
    if (semTabela(error.code)) return null
    throw new Error(error.message)
  }
  return (data ?? []) as NotaOkRow[]
}

/** chave da nota → pedidos do Visor ligados a ela. */
export const fetchPedidosPorNota = async (redeId: string): Promise<Map<string, PedidoDaNota[]>> => {
  const { data, error } = await need().from('compras_pedido_notas')
    .select('nota_chave, pedido_id, compras_pedidos(numero)').eq('rede_id', redeId).limit(5000)
  const m = new Map<string, PedidoDaNota[]>()
  if (error) return m
  for (const r of (data ?? []) as unknown as { nota_chave: string; pedido_id: string; compras_pedidos: { numero: number } | { numero: number }[] | null }[]) {
    const p = Array.isArray(r.compras_pedidos) ? r.compras_pedidos[0] : r.compras_pedidos
    m.set(r.nota_chave, [...(m.get(r.nota_chave) ?? []), { pedido_id: r.pedido_id, numero: p?.numero ?? null }])
  }
  return m
}
