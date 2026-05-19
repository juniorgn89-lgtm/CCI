import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'

/* ─── Types ─── */

export interface CaixaSnapshot {
  rede_id: string
  empresa_codigo: number
  caixa_codigo: number
  turno_codigo: number
  funcionario_codigo: number
  funcionario_nome: string
  data_movimento: string
  apurado: number
  diferenca: number
  fechado: boolean
}

export type TipoEvento = 'inclusao' | 'alteracao' | 'exclusao'

export interface CaixaAlteracao {
  id: string
  rede_id: string
  empresa_codigo: number
  caixa_codigo: number
  turno_codigo: number
  funcionario_nome: string
  data_movimento: string
  tipo_evento: TipoEvento
  campo: string
  valor_anterior: string | null
  valor_novo: string | null
  descricao: string
  detectado_em: string
  detectado_por_user_id: string | null
  detectado_por_nome: string | null
}

type AlteracaoInsert = Omit<CaixaAlteracao, 'id' | 'detectado_em'>

export interface ActorInfo {
  userId: string | null
  nome: string | null
}

const snapshotKey = (s: { rede_id: string; empresa_codigo: number; caixa_codigo: number; turno_codigo: number; data_movimento: string }) =>
  `${s.rede_id}-${s.empresa_codigo}-${s.caixa_codigo}-${s.turno_codigo}-${s.data_movimento}`

/* ─── Detect and save changes (batch) ─── */

/**
 * Compara snapshots atuais com `caixa_snapshots`, detecta 3 tipos de eventos
 * e grava em `caixa_alteracoes`:
 *
 *  - Inclusão: snapshot não existia no DB → caixa "novo" pra nós
 *  - Alteração: apurado/diferenca/fechado mudaram entre o existing e o atual
 *  - Exclusão: existe no DB pra esse range mas não tá no current turnoRows
 *              (PDV removeu/cancelou). Escopo da comparação é a tupla
 *              (rede, empresa_codigo, data_movimento) — não emite exclusão
 *              pra datas fora do range que estamos vendo.
 *
 * O `actor` (quem detectou) é o user logado no app quando o sync rodou —
 * NÃO é necessariamente quem fez a mudança no PDV (Quality não expõe isso).
 */
export const syncCaixaSnapshots = async (snapshots: CaixaSnapshot[], actor: ActorInfo) => {
  if (!supabase || snapshots.length === 0) return

  const redeId = snapshots[0].rede_id
  const empresaCodigos = Array.from(new Set(snapshots.map((s) => s.empresa_codigo)))
  const datas = snapshots.map((s) => s.data_movimento).sort()
  const minData = datas[0]
  const maxData = datas[datas.length - 1]

  // Pré-busca em uma única query todos os snapshots no escopo
  // (rede, empresas, range de datas) pra comparar em memória.
  const { data: existingRows, error: fetchErr } = await supabase
    .from('caixa_snapshots')
    .select('*')
    .eq('rede_id', redeId)
    .in('empresa_codigo', empresaCodigos)
    .gte('data_movimento', minData)
    .lte('data_movimento', maxData)

  if (fetchErr) {
    console.warn('[caixaHistory] fetch existing snapshots error:', fetchErr.message)
    return
  }

  const existingMap = new Map<string, CaixaSnapshot>()
  for (const row of (existingRows ?? []) as CaixaSnapshot[]) {
    existingMap.set(snapshotKey(row), row)
  }

  const currentKeys = new Set(snapshots.map(snapshotKey))
  const alteracoesToInsert: AlteracaoInsert[] = []

  // 1) Inclusões + Alterações — itera os snapshots atuais
  for (const snap of snapshots) {
    const key = snapshotKey(snap)
    const existing = existingMap.get(key)

    if (!existing) {
      // Inclusão: novo caixa pra nós. Registra UM evento com resumo.
      alteracoesToInsert.push({
        rede_id: snap.rede_id,
        empresa_codigo: snap.empresa_codigo,
        caixa_codigo: snap.caixa_codigo,
        turno_codigo: snap.turno_codigo,
        funcionario_nome: snap.funcionario_nome,
        data_movimento: snap.data_movimento,
        tipo_evento: 'inclusao',
        campo: 'caixa',
        valor_anterior: null,
        valor_novo: `Apurado ${formatCurrency(snap.apurado)} · ${snap.fechado ? 'Fechado' : 'Aberto'}`,
        descricao: `Caixa de ${snap.funcionario_nome} criado (${snap.fechado ? 'fechado' : 'aberto'} com apurado ${formatCurrency(snap.apurado)})`,
        detectado_por_user_id: actor.userId,
        detectado_por_nome: actor.nome,
      })
      continue
    }

    // Detecta alterações campo a campo. Cents de tolerância pra evitar
    // ruído de float; mantém sensibilidade pra mudanças reais.
    if (Math.abs(existing.apurado - snap.apurado) > 0.005) {
      alteracoesToInsert.push({
        rede_id: snap.rede_id,
        empresa_codigo: snap.empresa_codigo,
        caixa_codigo: snap.caixa_codigo,
        turno_codigo: snap.turno_codigo,
        funcionario_nome: snap.funcionario_nome,
        data_movimento: snap.data_movimento,
        tipo_evento: 'alteracao',
        campo: 'apurado',
        valor_anterior: formatCurrency(existing.apurado),
        valor_novo: formatCurrency(snap.apurado),
        descricao: `Apurado alterado de ${formatCurrency(existing.apurado)} para ${formatCurrency(snap.apurado)}`,
        detectado_por_user_id: actor.userId,
        detectado_por_nome: actor.nome,
      })
    }

    if (Math.abs(existing.diferenca - snap.diferenca) > 0.005) {
      alteracoesToInsert.push({
        rede_id: snap.rede_id,
        empresa_codigo: snap.empresa_codigo,
        caixa_codigo: snap.caixa_codigo,
        turno_codigo: snap.turno_codigo,
        funcionario_nome: snap.funcionario_nome,
        data_movimento: snap.data_movimento,
        tipo_evento: 'alteracao',
        campo: 'diferenca',
        valor_anterior: formatCurrency(existing.diferenca),
        valor_novo: formatCurrency(snap.diferenca),
        descricao: `Diferença alterada de ${formatCurrency(existing.diferenca)} para ${formatCurrency(snap.diferenca)}`,
        detectado_por_user_id: actor.userId,
        detectado_por_nome: actor.nome,
      })
    }

    if (existing.fechado !== snap.fechado) {
      alteracoesToInsert.push({
        rede_id: snap.rede_id,
        empresa_codigo: snap.empresa_codigo,
        caixa_codigo: snap.caixa_codigo,
        turno_codigo: snap.turno_codigo,
        funcionario_nome: snap.funcionario_nome,
        data_movimento: snap.data_movimento,
        tipo_evento: 'alteracao',
        campo: 'fechado',
        valor_anterior: existing.fechado ? 'Fechado' : 'Aberto',
        valor_novo: snap.fechado ? 'Fechado' : 'Aberto',
        descricao: snap.fechado
          ? `Caixa fechado por ${snap.funcionario_nome}`
          : `Caixa reaberto por ${snap.funcionario_nome}`,
        detectado_por_user_id: actor.userId,
        detectado_por_nome: actor.nome,
      })
    }
  }

  // 2) Exclusões — snapshots existentes no DB que não aparecem mais no current.
  //    Escopo idêntico ao SELECT acima (rede, empresas, range de datas).
  for (const [key, existing] of existingMap) {
    if (currentKeys.has(key)) continue
    alteracoesToInsert.push({
      rede_id: existing.rede_id,
      empresa_codigo: existing.empresa_codigo,
      caixa_codigo: existing.caixa_codigo,
      turno_codigo: existing.turno_codigo,
      funcionario_nome: existing.funcionario_nome,
      data_movimento: existing.data_movimento,
      tipo_evento: 'exclusao',
      campo: 'caixa',
      valor_anterior: `Apurado ${formatCurrency(existing.apurado)} · ${existing.fechado ? 'Fechado' : 'Aberto'}`,
      valor_novo: null,
      descricao: `Caixa de ${existing.funcionario_nome} removido do PDV (existia com apurado ${formatCurrency(existing.apurado)})`,
      detectado_por_user_id: actor.userId,
      detectado_por_nome: actor.nome,
    })
  }

  // 3) Operações em lote em paralelo:
  //    - Upsert dos snapshots atuais (idempotente, atualiza snapshot_at)
  //    - Delete dos snapshots que detectamos como exclusão
  //    - Insert das alterações detectadas
  const excludedKeys: string[] = []
  for (const [key] of existingMap) {
    if (!currentKeys.has(key)) excludedKeys.push(key)
  }

  await Promise.all([
    supabase
      .from('caixa_snapshots')
      .upsert(
        snapshots.map((s) => ({ ...s, snapshot_at: new Date().toISOString() })),
        { onConflict: 'rede_id,empresa_codigo,caixa_codigo,turno_codigo,data_movimento' },
      )
      .then((res) => {
        if (res.error) console.warn('[caixaHistory] upsert snapshots:', res.error.message)
      }),
    // Delete dos snapshots excluídos (um por um — pequeno número, ok serial).
    ...excludedKeys.map(async (key) => {
      const existing = existingMap.get(key)!
      const res = await supabase!
        .from('caixa_snapshots')
        .delete()
        .eq('rede_id', existing.rede_id)
        .eq('empresa_codigo', existing.empresa_codigo)
        .eq('caixa_codigo', existing.caixa_codigo)
        .eq('turno_codigo', existing.turno_codigo)
        .eq('data_movimento', existing.data_movimento)
      if (res.error) console.warn('[caixaHistory] delete snapshot:', res.error.message)
    }),
    alteracoesToInsert.length > 0
      ? supabase.from('caixa_alteracoes').insert(alteracoesToInsert).then((res) => {
          if (res.error) console.warn('[caixaHistory] insert alteracoes:', res.error.message)
        })
      : Promise.resolve(),
  ])
}

/* ─── Fetch history ─── */

export const fetchCaixaAlteracoes = async (
  redeId: string,
  empresaCodigo: number,
  dataInicial?: string,
  dataFinal?: string,
): Promise<CaixaAlteracao[]> => {
  if (!supabase) return []
  let query = supabase
    .from('caixa_alteracoes')
    .select('*')
    .eq('rede_id', redeId)
    .eq('empresa_codigo', empresaCodigo)
    .order('detectado_em', { ascending: false })
    .limit(200)

  if (dataInicial) query = query.gte('data_movimento', dataInicial)
  if (dataFinal) query = query.lte('data_movimento', dataFinal)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export const fetchCaixaAlteracoesByCaixa = async (
  redeId: string,
  caixaCodigo: number,
  turnoCodigo: number,
  dataMovimento: string,
): Promise<CaixaAlteracao[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('caixa_alteracoes')
    .select('*')
    .eq('rede_id', redeId)
    .eq('caixa_codigo', caixaCodigo)
    .eq('turno_codigo', turnoCodigo)
    .eq('data_movimento', dataMovimento)
    .order('detectado_em', { ascending: false })

  if (error) throw error
  return data ?? []
}
