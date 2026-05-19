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

export interface CaixaAlteracao {
  id: string
  rede_id: string
  empresa_codigo: number
  caixa_codigo: number
  turno_codigo: number
  funcionario_nome: string
  data_movimento: string
  campo: string
  valor_anterior: string | null
  valor_novo: string | null
  descricao: string
  detectado_em: string
}

type AlteracaoInsert = Omit<CaixaAlteracao, 'id' | 'detectado_em'>

const snapshotKey = (s: { rede_id: string; empresa_codigo: number; caixa_codigo: number; turno_codigo: number; data_movimento: string }) =>
  `${s.rede_id}-${s.empresa_codigo}-${s.caixa_codigo}-${s.turno_codigo}-${s.data_movimento}`

/* ─── Detect and save changes (batch) ─── */

/**
 * Compara snapshots atuais com o que está gravado em `caixa_snapshots`,
 * detecta mudanças em apurado/diferenca/fechado e grava em `caixa_alteracoes`.
 *
 * Versão batch: 1 SELECT pra buscar os existing, depois 3 operações de write
 * em lote (insert dos novos, upsert dos atualizados, insert das alterações).
 * Substitui o loop antigo que fazia 2-3 round trips por caixa.
 */
export const syncCaixaSnapshots = async (snapshots: CaixaSnapshot[]) => {
  if (!supabase || snapshots.length === 0) return

  // Todos os snapshots no batch são da mesma rede + empresa + range de datas.
  // Usa essas chaves pra pré-buscar só o que interessa em UM SELECT.
  const redeId = snapshots[0].rede_id
  const empresaCodigos = Array.from(new Set(snapshots.map((s) => s.empresa_codigo)))
  const datas = snapshots.map((s) => s.data_movimento).sort()
  const minData = datas[0]
  const maxData = datas[datas.length - 1]

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

  const toInsertSnapshots: CaixaSnapshot[] = []
  const toUpsertSnapshots: CaixaSnapshot[] = []
  const alteracoesToInsert: AlteracaoInsert[] = []

  for (const snap of snapshots) {
    const key = snapshotKey(snap)
    const existing = existingMap.get(key)

    if (!existing) {
      // Primeira vez vendo esse caixa-turno-data: apenas grava o baseline.
      toInsertSnapshots.push(snap)
      continue
    }

    // Detecta alterações campo a campo. Cents de tolerância pra evitar
    // ruído de float, mas mantém a sensibilidade pra mudanças reais.
    if (Math.abs(existing.apurado - snap.apurado) > 0.005) {
      alteracoesToInsert.push({
        rede_id: snap.rede_id,
        empresa_codigo: snap.empresa_codigo,
        caixa_codigo: snap.caixa_codigo,
        turno_codigo: snap.turno_codigo,
        funcionario_nome: snap.funcionario_nome,
        data_movimento: snap.data_movimento,
        campo: 'apurado',
        valor_anterior: formatCurrency(existing.apurado),
        valor_novo: formatCurrency(snap.apurado),
        descricao: `Apurado alterado de ${formatCurrency(existing.apurado)} para ${formatCurrency(snap.apurado)}`,
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
        campo: 'diferenca',
        valor_anterior: formatCurrency(existing.diferenca),
        valor_novo: formatCurrency(snap.diferenca),
        descricao: `Diferença alterada de ${formatCurrency(existing.diferenca)} para ${formatCurrency(snap.diferenca)}`,
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
        campo: 'fechado',
        valor_anterior: existing.fechado ? 'Fechado' : 'Aberto',
        valor_novo: snap.fechado ? 'Fechado' : 'Aberto',
        descricao: snap.fechado
          ? `Caixa fechado por ${snap.funcionario_nome}`
          : `Caixa reaberto por ${snap.funcionario_nome}`,
      })
    }

    // Sempre atualiza o snapshot pro estado mais recente — mesmo quando
    // nenhum campo mudou, refresca o snapshot_at pra registrar atividade.
    toUpsertSnapshots.push(snap)
  }

  // 3 operações em lote — independentes, podem rodar em paralelo.
  await Promise.all([
    toInsertSnapshots.length > 0
      ? supabase.from('caixa_snapshots').insert(toInsertSnapshots).then((res) => {
          if (res.error) console.warn('[caixaHistory] insert snapshots:', res.error.message)
        })
      : Promise.resolve(),
    toUpsertSnapshots.length > 0
      ? supabase
          .from('caixa_snapshots')
          .upsert(
            toUpsertSnapshots.map((s) => ({ ...s, snapshot_at: new Date().toISOString() })),
            { onConflict: 'rede_id,empresa_codigo,caixa_codigo,turno_codigo,data_movimento' },
          )
          .then((res) => {
            if (res.error) console.warn('[caixaHistory] upsert snapshots:', res.error.message)
          })
      : Promise.resolve(),
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
    .limit(100)

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
