import { supabase } from '@/lib/supabase'

/**
 * Compras · pedidos de compra com liberação — dados PRÓPRIOS do Visor por rede
 * (docs/supabase-compras.sql). O ERP continua só leitura: o pedido nasce e é
 * liberado aqui; a nota entra no WebPosto pelo fluxo normal. Escritas são
 * chamadas direto dos handlers (nunca useMutation) e o caller invalida as queries.
 */

export type SetorCompra = 'conveniencia' | 'automotivos' | 'combustivel' | 'outros'
export type StatusPedido = 'rascunho' | 'aguardando' | 'liberado' | 'liberado_parcial' | 'recusado' | 'recebido_parcial' | 'recebido' | 'cancelado'
export type TipoEvento = 'criado' | 'editado' | 'enviado' | 'liberado' | 'liberado_parcial' | 'recusado' | 'recebido' | 'cancelado' | 'reaberto' | 'comentario'
  | 'nota_vinculada' | 'nota_desvinculada' | 'recebimento_encerrado' | 'nota_devolvida' | 'liberacao_desfeita' | 'recebimento_desfeito'

export const SETOR_LABEL: Record<SetorCompra, string> = { conveniencia: 'Conveniência', automotivos: 'Automotivos', combustivel: 'Combustível', outros: 'Outros' }
export const STATUS_LABEL: Record<StatusPedido, string> = {
  rascunho: 'Rascunho', aguardando: 'Aguardando liberação', liberado: 'Liberado', liberado_parcial: 'Liberado parcial',
  recusado: 'Recusado', recebido_parcial: 'Recebido parcial', recebido: 'Recebido', cancelado: 'Cancelado',
}
/** Cor só no selo: texto + ponto. */
export const STATUS_META: Record<StatusPedido, { cls: string; dot: string }> = {
  rascunho: { cls: 'text-gray-600 dark:text-gray-300', dot: 'bg-gray-400' },
  aguardando: { cls: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  liberado: { cls: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  liberado_parcial: { cls: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-400' },
  recusado: { cls: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  recebido_parcial: { cls: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-300' },
  recebido: { cls: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  cancelado: { cls: 'text-gray-500', dot: 'bg-gray-300' },
}
export const EVENTO_VERBO: Record<TipoEvento, string> = {
  criado: 'criou o pedido', editado: 'editou o pedido', enviado: 'enviou para liberação', liberado: 'liberou', liberado_parcial: 'liberou parcialmente',
  recusado: 'recusou', recebido: 'marcou como recebido', cancelado: 'cancelou', reaberto: 'reabriu como rascunho', comentario: 'comentou',
  nota_vinculada: 'recebeu a nota', nota_desvinculada: 'tirou a nota do pedido', recebimento_encerrado: 'encerrou o recebimento', nota_devolvida: 'devolveu a nota para correção', liberacao_desfeita: 'desfez a liberação', recebimento_desfeito: 'desfez o recebimento',
}
/** Liberado e ainda sem nota, ou já com parte das notas: conta no teto do mês. */
export const STATUS_LIBERADOS: StatusPedido[] = ['liberado', 'liberado_parcial', 'recebido_parcial', 'recebido']
/** Pedido ainda em jogo (conta para duplicidade e para o teto do mês). */
export const STATUS_ABERTOS: StatusPedido[] = ['rascunho', 'aguardando', 'liberado', 'liberado_parcial', 'recebido_parcial']

export interface FornecedorRow {
  id: string
  rede_id: string
  codigo_erp: number | null
  nome: string
  cnpj: string | null
  telefone: string | null
  email: string | null
  observacao: string | null
  ativo: boolean
  criado_em: string
}

export interface PedidoRow {
  id: string
  rede_id: string
  numero: number
  empresa_codigo: number
  fornecedor_id: string | null
  fornecedor_nome: string
  fornecedor_cnpj: string | null
  fornecedor_codigo_erp: number | null
  setor: SetorCompra
  status: StatusPedido
  observacoes: string | null
  total_solicitado: number
  total_liberado: number | null
  solicitante_id: string | null
  solicitante_nome: string | null
  enviado_em: string | null
  liberador_id: string | null
  liberador_nome: string | null
  liberado_em: string | null
  motivo_recusa: string | null
  recebido_em: string | null
  criado_em: string
  atualizado_em: string
}

export interface ItemRow {
  id: string
  rede_id: string
  pedido_id: string
  produto_codigo: number
  produto_nome: string
  unidade: string | null
  qtd_solicitada: number
  qtd_liberada: number | null
  custo_unit: number
  justificativa: string | null
  ordem: number
}

export interface EventoRow {
  id: string
  rede_id: string
  pedido_id: string
  tipo: TipoEvento
  autor_id: string | null
  autor_nome: string | null
  detalhe: string | null
  criado_em: string
}

export interface TetoRow {
  rede_id: string
  empresa_codigo: number
  setor: SetorCompra
  valor_mensal: number
  atualizado_em: string
}

export interface Autor { userId: string; nome: string }

export interface ItemInput {
  produto_codigo: number
  produto_nome: string
  unidade?: string | null
  qtd_solicitada: number
  custo_unit: number
  justificativa?: string | null
}

export interface PedidoInput {
  empresa_codigo: number
  fornecedor_id?: string | null
  fornecedor_nome: string
  fornecedor_cnpj?: string | null
  fornecedor_codigo_erp?: number | null
  setor: SetorCompra
  observacoes?: string | null
  itens: ItemInput[]
}

const need = () => {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}
const erro = (e: { message: string; details?: string | null; hint?: string | null }) =>
  new Error([e.message, e.details, e.hint].filter(Boolean).join(' · '))

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0)
const normPedido = (r: Record<string, unknown>): PedidoRow => ({ ...(r as unknown as PedidoRow), total_solicitado: num(r.total_solicitado), total_liberado: r.total_liberado == null ? null : num(r.total_liberado) })
const normItem = (r: Record<string, unknown>): ItemRow => ({ ...(r as unknown as ItemRow), qtd_solicitada: num(r.qtd_solicitada), qtd_liberada: r.qtd_liberada == null ? null : num(r.qtd_liberada), custo_unit: num(r.custo_unit) })

export const totalItens = (itens: { qtd_solicitada: number; custo_unit: number }[]) => itens.reduce((s, i) => s + i.qtd_solicitada * i.custo_unit, 0)
export const totalLiberado = (itens: { qtd_liberada: number | null; qtd_solicitada: number; custo_unit: number }[]) => itens.reduce((s, i) => s + (i.qtd_liberada ?? i.qtd_solicitada) * i.custo_unit, 0)

/* ─── leituras ─────────────────────────────────────────────────────────── */

export const fetchFornecedores = async (redeId: string): Promise<FornecedorRow[]> => {
  const { data, error } = await need().from('compras_fornecedores').select('*').eq('rede_id', redeId).eq('ativo', true).order('nome')
  if (error) throw erro(error)
  return (data as FornecedorRow[]) ?? []
}

export const fetchPedidos = async (redeId: string, de?: string, ate?: string): Promise<PedidoRow[]> => {
  let q = need().from('compras_pedidos').select('*').eq('rede_id', redeId).order('numero', { ascending: false }).limit(1000)
  if (de) q = q.gte('criado_em', `${de}T00:00:00`)
  if (ate) q = q.lte('criado_em', `${ate}T23:59:59`)
  const { data, error } = await q
  if (error) throw erro(error)
  return ((data as Record<string, unknown>[]) ?? []).map(normPedido)
}

/** Quantidades por pedido (soma dos itens) — para a coluna Qtd. da lista de pedidos. */
export const fetchQtdPorPedido = async (redeId: string): Promise<Map<string, { itens: number; solicitada: number; liberada: number | null }>> => {
  const { data, error } = await need().from('compras_itens').select('pedido_id, qtd_solicitada, qtd_liberada').eq('rede_id', redeId)
  if (error) throw erro(error)
  const m = new Map<string, { itens: number; solicitada: number; liberada: number | null }>()
  for (const i of (data ?? []) as { pedido_id: string; qtd_solicitada: number; qtd_liberada: number | null }[]) {
    const a = m.get(i.pedido_id) ?? { itens: 0, solicitada: 0, liberada: null }
    a.itens++
    a.solicitada += Number(i.qtd_solicitada) || 0
    if (i.qtd_liberada != null) a.liberada = (a.liberada ?? 0) + Number(i.qtd_liberada)
    m.set(i.pedido_id, a)
  }
  return m
}

export const fetchItensDoPedido = async (pedidoId: string): Promise<ItemRow[]> => {
  const { data, error } = await need().from('compras_itens').select('*').eq('pedido_id', pedidoId).order('ordem')
  if (error) throw erro(error)
  return ((data as Record<string, unknown>[]) ?? []).map(normItem)
}

/** Itens de todos os pedidos EM ABERTO de um posto (aviso de duplicidade). */
export const fetchItensAbertosDoPosto = async (redeId: string, empresaCodigo: number): Promise<(ItemRow & { numero: number; status: StatusPedido })[]> => {
  const { data: pedidos, error: e1 } = await need().from('compras_pedidos').select('id, numero, status').eq('rede_id', redeId).eq('empresa_codigo', empresaCodigo).in('status', STATUS_ABERTOS)
  if (e1) throw erro(e1)
  const lista = (pedidos as { id: string; numero: number; status: StatusPedido }[]) ?? []
  if (lista.length === 0) return []
  const { data, error } = await need().from('compras_itens').select('*').in('pedido_id', lista.map((p) => p.id))
  if (error) throw erro(error)
  const meta = new Map(lista.map((p) => [p.id, p]))
  return ((data as Record<string, unknown>[]) ?? []).map((r) => { const i = normItem(r); const m = meta.get(i.pedido_id)!; return { ...i, numero: m.numero, status: m.status } })
}

export const fetchEventos = async (pedidoId: string): Promise<EventoRow[]> => {
  const { data, error } = await need().from('compras_eventos').select('*').eq('pedido_id', pedidoId).order('criado_em')
  if (error) throw erro(error)
  return (data as EventoRow[]) ?? []
}

export const fetchTetos = async (redeId: string): Promise<TetoRow[]> => {
  const { data, error } = await need().from('compras_tetos').select('*').eq('rede_id', redeId)
  if (error) throw erro(error)
  return ((data as Record<string, unknown>[]) ?? []).map((r) => ({ ...(r as unknown as TetoRow), valor_mensal: num(r.valor_mensal) }))
}

/* ─── escritas ─────────────────────────────────────────────────────────── */

const evento = async (redeId: string, pedidoId: string, tipo: TipoEvento, autor: Autor, detalhe?: string | null) => {
  const { error } = await need().from('compras_eventos').insert({ rede_id: redeId, pedido_id: pedidoId, tipo, autor_id: autor.userId, autor_nome: autor.nome, detalhe: detalhe ?? null })
  if (error) throw erro(error)
}

/** Garante um fornecedor da rede (reaproveita pelo código do ERP ou pelo nome). */
export const garantirFornecedor = async (redeId: string, f: { codigo_erp?: number | null; nome: string; cnpj?: string | null; telefone?: string | null }): Promise<FornecedorRow> => {
  const sb = need()
  if (f.codigo_erp) {
    const { data } = await sb.from('compras_fornecedores').select('*').eq('rede_id', redeId).eq('codigo_erp', f.codigo_erp).maybeSingle()
    if (data) return data as FornecedorRow
  } else {
    const { data } = await sb.from('compras_fornecedores').select('*').eq('rede_id', redeId).ilike('nome', f.nome.trim()).maybeSingle()
    if (data) return data as FornecedorRow
  }
  const { data, error } = await sb.from('compras_fornecedores').insert({ rede_id: redeId, codigo_erp: f.codigo_erp ?? null, nome: f.nome.trim(), cnpj: f.cnpj ?? null, telefone: f.telefone ?? null }).select('*').single()
  if (error) throw erro(error)
  return data as FornecedorRow
}

export const atualizarFornecedor = async (id: string, patch: Partial<Pick<FornecedorRow, 'nome' | 'cnpj' | 'telefone' | 'email' | 'observacao' | 'ativo'>>) => {
  const { error } = await need().from('compras_fornecedores').update(patch).eq('id', id)
  if (error) throw erro(error)
}

const gravarItens = async (redeId: string, pedidoId: string, itens: ItemInput[]) => {
  const sb = need()
  const { error: eDel } = await sb.from('compras_itens').delete().eq('pedido_id', pedidoId)
  if (eDel) throw erro(eDel)
  if (itens.length === 0) return
  const { error } = await sb.from('compras_itens').insert(itens.map((i, idx) => ({
    rede_id: redeId, pedido_id: pedidoId, produto_codigo: i.produto_codigo, produto_nome: i.produto_nome, unidade: i.unidade ?? null,
    qtd_solicitada: i.qtd_solicitada, custo_unit: i.custo_unit, justificativa: i.justificativa ?? null, ordem: idx,
  })))
  if (error) throw erro(error)
}

export const criarPedido = async (redeId: string, input: PedidoInput, autor: Autor, enviar: boolean): Promise<PedidoRow> => {
  const sb = need()
  const agora = new Date().toISOString()
  const { data, error } = await sb.from('compras_pedidos').insert({
    rede_id: redeId, empresa_codigo: input.empresa_codigo,
    fornecedor_id: input.fornecedor_id ?? null, fornecedor_nome: input.fornecedor_nome, fornecedor_cnpj: input.fornecedor_cnpj ?? null, fornecedor_codigo_erp: input.fornecedor_codigo_erp ?? null,
    setor: input.setor, observacoes: input.observacoes ?? null, total_solicitado: totalItens(input.itens),
    status: enviar ? 'aguardando' : 'rascunho', enviado_em: enviar ? agora : null,
    solicitante_id: autor.userId, solicitante_nome: autor.nome,
  }).select('*').single()
  if (error) throw erro(error)
  const pedido = normPedido(data as Record<string, unknown>)
  await gravarItens(redeId, pedido.id, input.itens)
  await evento(redeId, pedido.id, 'criado', autor, `${input.itens.length} ${input.itens.length === 1 ? 'item' : 'itens'}`)
  if (enviar) await evento(redeId, pedido.id, 'enviado', autor)
  return pedido
}

export const editarPedido = async (p: PedidoRow, input: PedidoInput, autor: Autor, enviar: boolean) => {
  const sb = need()
  const agora = new Date().toISOString()
  const status: StatusPedido = enviar ? 'aguardando' : p.status === 'aguardando' ? 'aguardando' : 'rascunho'
  const { error } = await sb.from('compras_pedidos').update({
    empresa_codigo: input.empresa_codigo,
    fornecedor_id: input.fornecedor_id ?? null, fornecedor_nome: input.fornecedor_nome, fornecedor_cnpj: input.fornecedor_cnpj ?? null, fornecedor_codigo_erp: input.fornecedor_codigo_erp ?? null,
    setor: input.setor, observacoes: input.observacoes ?? null, total_solicitado: totalItens(input.itens),
    status, enviado_em: enviar && !p.enviado_em ? agora : p.enviado_em,
  }).eq('id', p.id)
  if (error) throw erro(error)
  await gravarItens(p.rede_id, p.id, input.itens)
  await evento(p.rede_id, p.id, 'editado', autor, `${input.itens.length} ${input.itens.length === 1 ? 'item' : 'itens'} · ${totalItens(input.itens).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
  if (enviar && p.status !== 'aguardando') await evento(p.rede_id, p.id, 'enviado', autor)
}

export const enviarPedido = async (p: PedidoRow, autor: Autor) => {
  const { error } = await need().from('compras_pedidos').update({ status: 'aguardando', enviado_em: new Date().toISOString() }).eq('id', p.id)
  if (error) throw erro(error)
  await evento(p.rede_id, p.id, 'enviado', autor)
}

/** Liberação: quantidades por item (igual à solicitada = total; menor = parcial; 0 = item cortado). */
export const liberarPedido = async (p: PedidoRow, itens: ItemRow[], liberadas: Record<string, number>, autor: Autor, observacao?: string | null) => {
  const sb = need()
  // Uma chamada só: upsert pela chave primária atualiza a qtd_liberada de todos
  // os itens (pedido grande com 200 itens não pode virar 200 requisições).
  if (itens.length > 0) {
    const { error: eItens } = await sb.from('compras_itens').upsert(itens.map((i) => ({ ...i, qtd_liberada: Math.max(0, liberadas[i.id] ?? i.qtd_solicitada) })), { onConflict: 'id' })
    if (eItens) throw erro(eItens)
  }
  const total = itens.reduce((s, i) => s + Math.max(0, liberadas[i.id] ?? i.qtd_solicitada) * i.custo_unit, 0)
  const parcial = itens.some((i) => Math.abs((liberadas[i.id] ?? i.qtd_solicitada) - i.qtd_solicitada) > 1e-9)
  const status: StatusPedido = parcial ? 'liberado_parcial' : 'liberado'
  const { error } = await sb.from('compras_pedidos').update({ status, total_liberado: total, liberador_id: autor.userId, liberador_nome: autor.nome, liberado_em: new Date().toISOString(), motivo_recusa: null }).eq('id', p.id)
  if (error) throw erro(error)
  await evento(p.rede_id, p.id, status, autor, `${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${observacao ? ` · ${observacao}` : ''}`)
}

export const recusarPedido = async (p: PedidoRow, motivo: string, autor: Autor) => {
  const { error } = await need().from('compras_pedidos').update({ status: 'recusado', motivo_recusa: motivo, liberador_id: autor.userId, liberador_nome: autor.nome, liberado_em: new Date().toISOString(), total_liberado: 0 }).eq('id', p.id)
  if (error) throw erro(error)
  await evento(p.rede_id, p.id, 'recusado', autor, motivo)
}

export const cancelarPedido = async (p: PedidoRow, motivo: string | null, autor: Autor) => {
  if (!motivo?.trim()) throw new Error('Informe o motivo do cancelamento.')
  if (p.status !== 'aguardando') throw new Error('Só dá para cancelar pedido aguardando liberação. Se já foi liberado, desfaça a liberação antes.')
  const { error } = await need().from('compras_pedidos').update({ status: 'cancelado' }).eq('id', p.id)
  if (error) throw erro(error)
  await evento(p.rede_id, p.id, 'cancelado', autor, motivo)
}

/**
 * Volta um pedido liberado para "Aguardando liberação" (quem libera percebeu um
 * erro): limpa a liberação e as quantidades liberadas, devolve o teto do mês.
 * Com nota já ligada pelo NotaOK não dá: tire a nota antes.
 */
export const desfazerLiberacao = async (p: PedidoRow, motivo: string, autor: Autor) => {
  if (!motivo.trim()) throw new Error('Informe o motivo.')
  if (p.status !== 'liberado' && p.status !== 'liberado_parcial') throw new Error('Este pedido não está liberado.')
  const sb = need()
  const { error } = await sb.from('compras_pedidos').update({ status: 'aguardando', total_liberado: null, liberador_id: null, liberador_nome: null, liberado_em: null }).eq('id', p.id).in('status', ['liberado', 'liberado_parcial'])
  if (error) throw erro(error)
  const { error: eItens } = await sb.from('compras_itens').update({ qtd_liberada: null }).eq('pedido_id', p.id)
  if (eItens) throw erro(eItens)
  await evento(p.rede_id, p.id, 'liberacao_desfeita', autor, motivo.trim())
}

/**
 * Volta um pedido "Recebido" marcado À MÃO para liberado (com motivo). Se tem
 * nota ligada pelo NotaOK, não: quem desfaz é o NotaOK (tirando a nota).
 */
export const desfazerRecebimento = async (p: PedidoRow, motivo: string, autor: Autor) => {
  if (!motivo.trim()) throw new Error('Informe o motivo.')
  if (p.status !== 'recebido') throw new Error('Este pedido não está recebido.')
  const sb = need()
  const { count, error: eN } = await sb.from('compras_pedido_notas').select('id', { count: 'exact', head: true }).eq('pedido_id', p.id)
  if (eN && eN.code !== '42P01' && eN.code !== 'PGRST205') throw erro(eN)
  if ((count ?? 0) > 0) throw new Error('Este pedido tem nota ligada pelo NotaOK. Tire a nota no NotaOK para desfazer o recebimento.')
  const volta: StatusPedido = p.total_liberado != null && p.total_liberado < p.total_solicitado - 0.005 ? 'liberado_parcial' : 'liberado'
  const { error } = await sb.from('compras_pedidos').update({ status: volta, recebido_em: null }).eq('id', p.id).eq('status', 'recebido')
  if (error) throw erro(error)
  await evento(p.rede_id, p.id, 'recebimento_desfeito', autor, motivo.trim())
}

export const reabrirPedido = async (p: PedidoRow, autor: Autor) => {
  const { error } = await need().from('compras_pedidos').update({ status: 'rascunho', motivo_recusa: null, total_liberado: null, liberador_id: null, liberador_nome: null, liberado_em: null }).eq('id', p.id)
  if (error) throw erro(error)
  await evento(p.rede_id, p.id, 'reaberto', autor)
}

export const marcarRecebido = async (p: PedidoRow, autor: Autor, observacao?: string | null) => {
  const { error } = await need().from('compras_pedidos').update({ status: 'recebido', recebido_em: new Date().toISOString() }).eq('id', p.id)
  if (error) throw erro(error)
  await evento(p.rede_id, p.id, 'recebido', autor, observacao)
}

export const excluirRascunho = async (p: PedidoRow) => {
  const { error } = await need().from('compras_pedidos').delete().eq('id', p.id)
  if (error) throw erro(error)
}

/** Papel do usuário logado (profiles.role): "supervisor" desfaz liberação/recebimento. */
export const fetchPapelCompras = async (): Promise<string | null> => {
  const sb = need()
  const { data: u } = await sb.auth.getUser()
  if (!u.user) return null
  const { data } = await sb.from('profiles').select('role').eq('user_id', u.user.id).maybeSingle()
  return (data as { role?: string } | null)?.role ?? null
}

/** Flag por usuário (profiles.pode_apagar_compras) — limpeza de testes. Não vem do master. */
export const fetchPodeApagarCompras = async (): Promise<boolean> => {
  const { data, error } = await need().rpc('pode_apagar_compras')
  if (error) return false
  return data === true
}
/** Apaga o pedido em qualquer situação, com itens e histórico (só quem tem pode_apagar_compras). */
export const apagarPedido = async (p: PedidoRow) => {
  const { data, error } = await need().from('compras_pedidos').delete().eq('id', p.id).select('id')
  if (error) throw erro(error)
  if (!data?.length) throw new Error('Sem permissão para apagar este pedido.')
}

/** Recebido parcial que não vai mais completar: fecha como recebido. */
export const encerrarRecebimento = async (p: PedidoRow, autor: Autor, motivo?: string | null) => {
  const { error } = await need().from('compras_pedidos').update({ status: 'recebido', recebido_em: new Date().toISOString() }).eq('id', p.id)
  if (error) throw erro(error)
  await evento(p.rede_id, p.id, 'recebimento_encerrado', autor, motivo)
}

// ─── Notas fiscais vinculadas pelo NotaOK (docs/supabase-compras-notas.sql) ──
export type SituacaoNota = 'vinculada' | 'conferida' | 'lancada' | 'devolvida'
export const SITUACAO_NOTA_LABEL: Record<SituacaoNota, string> = {
  vinculada: 'Conferindo no NotaOK', conferida: 'Conferida no NotaOK', lancada: 'Lançada no ERP', devolvida: 'Devolvida no NotaOK',
}
export interface PedidoNotaRow {
  id: string
  pedido_id: string
  nota_chave: string
  nota_numero: number | null
  nota_serie: number | null
  nota_valor: number | null
  nota_emissao: string | null
  completa: boolean
  situacao: SituacaoNota
  vinculado_por_nome: string | null
  vinculado_em: string
  conferida_em: string | null
  lancada_em: string | null
  /** O que o escritório apontou ao devolver (docs/supabase-compras-notas-devolucao.sql). */
  devolucao?: DevolucaoNota | null
  devolvida_em?: string | null
  devolvida_por_nome?: string | null
}
export interface DevolucaoNota {
  geral: string | null
  nf: string | null
  boleto: string | null
  itens: { codigo: string | null; descricao: string | null; motivo: string }[]
}
/** Notas do pedido. Tabela ausente (SQL não rodado) = lista vazia, sem quebrar a tela. */
export const fetchNotasDoPedido = async (pedidoId: string): Promise<PedidoNotaRow[]> => {
  const { data, error } = await need().from('compras_pedido_notas').select('*').eq('pedido_id', pedidoId).order('vinculado_em')
  if (error) { if (error.code === '42P01' || error.code === 'PGRST205') return []; throw erro(error) }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...(r as unknown as PedidoNotaRow), nota_valor: r.nota_valor == null ? null : num(r.nota_valor) }))
}

/** Resumo das notas ligadas a um pedido: quantas e a situação mais atrasada. */
export interface ResumoNotas { qtd: number; pior: SituacaoNota }
// Mais atrasada primeiro: devolvida (voltou p/ correção) → em conferência → conferida → lançada.
const RANK_NOTA: Record<SituacaoNota, number> = { devolvida: 0, vinculada: 1, conferida: 2, lancada: 3 }
/** Notas de todos os pedidos da rede, resumidas por pedido. Tabela ausente = nenhum resumo. */
export const fetchNotasDaRede = async (redeId: string): Promise<Map<string, ResumoNotas>> => {
  const { data, error } = await need().from('compras_pedido_notas').select('pedido_id, situacao').eq('rede_id', redeId)
  if (error) { if (error.code === '42P01' || error.code === 'PGRST205') return new Map(); throw erro(error) }
  const m = new Map<string, ResumoNotas>()
  for (const r of (data ?? []) as { pedido_id: string; situacao: SituacaoNota }[]) {
    const cur = m.get(r.pedido_id)
    if (!cur) m.set(r.pedido_id, { qtd: 1, pior: r.situacao })
    else { cur.qtd += 1; if (RANK_NOTA[r.situacao] < RANK_NOTA[cur.pior]) cur.pior = r.situacao }
  }
  return m
}

/**
 * Etapa do pedido na lista (não é gravada: sai do status + notas).
 * Recebido só vira "concluído" quando todas as notas foram lançadas no ERP, ou
 * quando foi marcado à mão sem nota ligada (rede sem NotaOK).
 */
export type EtapaPedido = 'rascunho' | 'aguardando' | 'entrega' | 'conferencia' | 'concluido' | 'encerrado'
export const etapaDoPedido = (p: PedidoRow, notas?: ResumoNotas): EtapaPedido => {
  switch (p.status) {
    case 'rascunho': return 'rascunho'
    case 'aguardando': return 'aguardando'
    case 'liberado': case 'liberado_parcial': return 'entrega'
    case 'recebido_parcial': return 'conferencia'
    case 'recebido': return !notas || notas.pior === 'lancada' ? 'concluido' : 'conferencia'
    default: return 'encerrado'
  }
}

export const comentarPedido = async (p: PedidoRow, texto: string, autor: Autor) => evento(p.rede_id, p.id, 'comentario', autor, texto)

export const salvarTeto = async (redeId: string, empresaCodigo: number, setor: SetorCompra, valor: number, autor: Autor) => {
  const { error } = await need().from('compras_tetos').upsert({ rede_id: redeId, empresa_codigo: empresaCodigo, setor, valor_mensal: valor, atualizado_por: autor.userId, atualizado_em: new Date().toISOString() })
  if (error) throw erro(error)
}

/* ═══════════════════ Transferências entre postos (Fase 2) ═══════════════════ */

export type StatusTransf = 'rascunho' | 'solicitada' | 'em_transito' | 'recebida' | 'cancelada'
export type TipoEventoTransf = 'criada' | 'editada' | 'solicitada' | 'enviada' | 'recebida' | 'cancelada' | 'reaberta' | 'comentario'
export const STATUS_TRANSF_LABEL: Record<StatusTransf, string> = { rascunho: 'Rascunho', solicitada: 'Solicitada', em_transito: 'Em trânsito', recebida: 'Recebida', cancelada: 'Cancelada' }
export const STATUS_TRANSF_META: Record<StatusTransf, { cls: string; dot: string }> = {
  rascunho: { cls: 'text-gray-600 dark:text-gray-300', dot: 'bg-gray-400' },
  solicitada: { cls: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  em_transito: { cls: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  recebida: { cls: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  cancelada: { cls: 'text-gray-500', dot: 'bg-gray-300' },
}
export const EVENTO_TRANSF_VERBO: Record<TipoEventoTransf, string> = {
  criada: 'criou a transferência', editada: 'editou', solicitada: 'solicitou à origem', enviada: 'despachou da origem', recebida: 'confirmou o recebimento', cancelada: 'cancelou', reaberta: 'reabriu como rascunho', comentario: 'comentou',
}

export interface TransferenciaRow {
  id: string
  rede_id: string
  numero: number
  origem_codigo: number
  destino_codigo: number
  status: StatusTransf
  observacoes: string | null
  total_ref: number
  solicitante_id: string | null
  solicitante_nome: string | null
  solicitada_em: string | null
  enviado_por_id: string | null
  enviado_por_nome: string | null
  enviada_em: string | null
  recebido_por_id: string | null
  recebido_por_nome: string | null
  recebida_em: string | null
  criado_em: string
  atualizado_em: string
}
export interface TransfItemRow {
  id: string
  rede_id: string
  transferencia_id: string
  produto_codigo: number
  produto_nome: string
  unidade: string | null
  qtd: number
  qtd_recebida: number | null
  custo_ref: number
  justificativa: string | null
  ordem: number
}
export interface TransfEventoRow { id: string; rede_id: string; transferencia_id: string; tipo: TipoEventoTransf; autor_id: string | null; autor_nome: string | null; detalhe: string | null; criado_em: string }
export interface TransfItemInput { produto_codigo: number; produto_nome: string; unidade?: string | null; qtd: number; custo_ref: number; justificativa?: string | null }
export interface TransferenciaInput { origem_codigo: number; destino_codigo: number; observacoes?: string | null; itens: TransfItemInput[] }

const normTransf = (r: Record<string, unknown>): TransferenciaRow => ({ ...(r as unknown as TransferenciaRow), total_ref: num(r.total_ref) })
const normTItem = (r: Record<string, unknown>): TransfItemRow => ({ ...(r as unknown as TransfItemRow), qtd: num(r.qtd), qtd_recebida: r.qtd_recebida == null ? null : num(r.qtd_recebida), custo_ref: num(r.custo_ref) })
export const totalTransf = (itens: { qtd: number; custo_ref: number }[]) => itens.reduce((s, i) => s + i.qtd * i.custo_ref, 0)

export const fetchTransferencias = async (redeId: string): Promise<TransferenciaRow[]> => {
  const { data, error } = await need().from('compras_transferencias').select('*').eq('rede_id', redeId).order('numero', { ascending: false }).limit(1000)
  if (error) throw erro(error)
  return ((data as Record<string, unknown>[]) ?? []).map(normTransf)
}
export const fetchTransfItens = async (id: string): Promise<TransfItemRow[]> => {
  const { data, error } = await need().from('compras_transf_itens').select('*').eq('transferencia_id', id).order('ordem')
  if (error) throw erro(error)
  return ((data as Record<string, unknown>[]) ?? []).map(normTItem)
}
/** Itens das transferências da rede (lista mostra "N itens · nomes"). */
export const fetchTransfItensDaRede = async (redeId: string): Promise<TransfItemRow[]> => {
  const { data, error } = await need().from('compras_transf_itens').select('*').eq('rede_id', redeId).order('ordem').limit(5000)
  if (error) throw erro(error)
  return ((data as Record<string, unknown>[]) ?? []).map(normTItem)
}
export const fetchTransfEventos = async (id: string): Promise<TransfEventoRow[]> => {
  const { data, error } = await need().from('compras_transf_eventos').select('*').eq('transferencia_id', id).order('criado_em')
  if (error) throw erro(error)
  return (data as TransfEventoRow[]) ?? []
}

const eventoT = async (redeId: string, id: string, tipo: TipoEventoTransf, autor: Autor, detalhe?: string | null) => {
  const { error } = await need().from('compras_transf_eventos').insert({ rede_id: redeId, transferencia_id: id, tipo, autor_id: autor.userId, autor_nome: autor.nome, detalhe: detalhe ?? null })
  if (error) throw erro(error)
}
const gravarTItens = async (redeId: string, id: string, itens: TransfItemInput[]) => {
  const sb = need()
  const { error: eDel } = await sb.from('compras_transf_itens').delete().eq('transferencia_id', id)
  if (eDel) throw erro(eDel)
  if (itens.length === 0) return
  const { error } = await sb.from('compras_transf_itens').insert(itens.map((i, idx) => ({ rede_id: redeId, transferencia_id: id, produto_codigo: i.produto_codigo, produto_nome: i.produto_nome, unidade: i.unidade ?? null, qtd: i.qtd, custo_ref: i.custo_ref, justificativa: i.justificativa ?? null, ordem: idx })))
  if (error) throw erro(error)
}

export const criarTransferencia = async (redeId: string, input: TransferenciaInput, autor: Autor, solicitar: boolean): Promise<TransferenciaRow> => {
  const agora = new Date().toISOString()
  const { data, error } = await need().from('compras_transferencias').insert({
    rede_id: redeId, origem_codigo: input.origem_codigo, destino_codigo: input.destino_codigo, observacoes: input.observacoes ?? null, total_ref: totalTransf(input.itens),
    status: solicitar ? 'solicitada' : 'rascunho', solicitada_em: solicitar ? agora : null, solicitante_id: autor.userId, solicitante_nome: autor.nome,
  }).select('*').single()
  if (error) throw erro(error)
  const t = normTransf(data as Record<string, unknown>)
  await gravarTItens(redeId, t.id, input.itens)
  await eventoT(redeId, t.id, 'criada', autor, `${input.itens.length} ${input.itens.length === 1 ? 'item' : 'itens'}`)
  if (solicitar) await eventoT(redeId, t.id, 'solicitada', autor)
  return t
}
export const editarTransferencia = async (t: TransferenciaRow, input: TransferenciaInput, autor: Autor, solicitar: boolean) => {
  const agora = new Date().toISOString()
  const status: StatusTransf = solicitar ? 'solicitada' : t.status
  const { error } = await need().from('compras_transferencias').update({ origem_codigo: input.origem_codigo, destino_codigo: input.destino_codigo, observacoes: input.observacoes ?? null, total_ref: totalTransf(input.itens), status, solicitada_em: solicitar && !t.solicitada_em ? agora : t.solicitada_em }).eq('id', t.id)
  if (error) throw erro(error)
  await gravarTItens(t.rede_id, t.id, input.itens)
  await eventoT(t.rede_id, t.id, 'editada', autor, `${input.itens.length} ${input.itens.length === 1 ? 'item' : 'itens'}`)
  if (solicitar && t.status === 'rascunho') await eventoT(t.rede_id, t.id, 'solicitada', autor)
}
export const solicitarTransferencia = async (t: TransferenciaRow, autor: Autor) => {
  const { error } = await need().from('compras_transferencias').update({ status: 'solicitada', solicitada_em: new Date().toISOString() }).eq('id', t.id)
  if (error) throw erro(error)
  await eventoT(t.rede_id, t.id, 'solicitada', autor)
}
/** Origem separou e despachou. */
export const despacharTransferencia = async (t: TransferenciaRow, autor: Autor, observacao?: string | null) => {
  const { error } = await need().from('compras_transferencias').update({ status: 'em_transito', enviado_por_id: autor.userId, enviado_por_nome: autor.nome, enviada_em: new Date().toISOString() }).eq('id', t.id)
  if (error) throw erro(error)
  await eventoT(t.rede_id, t.id, 'enviada', autor, observacao)
}
/** Destino conferiu: quantidade recebida por item (diferença fica no histórico). */
export const receberTransferencia = async (t: TransferenciaRow, itens: TransfItemRow[], recebidas: Record<string, number>, autor: Autor, observacao?: string | null) => {
  const sb = need()
  if (itens.length > 0) {
    const { error: eItens } = await sb.from('compras_transf_itens').upsert(itens.map((i) => ({ ...i, qtd_recebida: Math.max(0, recebidas[i.id] ?? i.qtd) })), { onConflict: 'id' })
    if (eItens) throw erro(eItens)
  }
  const difs = itens.filter((i) => Math.abs((recebidas[i.id] ?? i.qtd) - i.qtd) > 1e-9)
  const { error } = await sb.from('compras_transferencias').update({ status: 'recebida', recebido_por_id: autor.userId, recebido_por_nome: autor.nome, recebida_em: new Date().toISOString() }).eq('id', t.id)
  if (error) throw erro(error)
  await eventoT(t.rede_id, t.id, 'recebida', autor, [difs.length ? `${difs.length} ${difs.length === 1 ? 'item com diferença' : 'itens com diferença'}` : 'tudo conferido', observacao].filter(Boolean).join(' · ') || null)
}
export const cancelarTransferencia = async (t: TransferenciaRow, motivo: string | null, autor: Autor) => {
  const { error } = await need().from('compras_transferencias').update({ status: 'cancelada' }).eq('id', t.id)
  if (error) throw erro(error)
  await eventoT(t.rede_id, t.id, 'cancelada', autor, motivo)
}
export const reabrirTransferencia = async (t: TransferenciaRow, autor: Autor) => {
  const { error } = await need().from('compras_transferencias').update({ status: 'rascunho', enviado_por_id: null, enviado_por_nome: null, enviada_em: null }).eq('id', t.id)
  if (error) throw erro(error)
  await eventoT(t.rede_id, t.id, 'reaberta', autor)
}
export const excluirTransferencia = async (t: TransferenciaRow) => {
  const { error } = await need().from('compras_transferencias').delete().eq('id', t.id)
  if (error) throw erro(error)
}
/** Apaga a transferência em qualquer situação, com itens e histórico (só quem tem pode_apagar_compras). */
export const apagarTransferencia = async (t: TransferenciaRow) => {
  const { data, error } = await need().from('compras_transferencias').delete().eq('id', t.id).select('id')
  if (error) throw erro(error)
  if (!data?.length) throw new Error('Sem permissão para apagar esta transferência.')
}
export const comentarTransferencia = async (t: TransferenciaRow, texto: string, autor: Autor) => eventoT(t.rede_id, t.id, 'comentario', autor, texto)
