import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/formatters'

/* ─── Types ─── */

export interface CaixaSnapshot {
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

/* ─── Detect and save changes ─── */

export const syncCaixaSnapshots = async (snapshots: CaixaSnapshot[]) => {
  if (!supabase || snapshots.length === 0) return

  for (const snap of snapshots) {
    // Check if snapshot exists
    const { data: existing } = await supabase
      .from('caixa_snapshots')
      .select('*')
      .eq('empresa_codigo', snap.empresa_codigo)
      .eq('caixa_codigo', snap.caixa_codigo)
      .eq('turno_codigo', snap.turno_codigo)
      .eq('data_movimento', snap.data_movimento)
      .maybeSingle()

    if (!existing) {
      // First time seeing this session — save snapshot
      await supabase.from('caixa_snapshots').insert(snap)
      continue
    }

    // Compare and detect changes
    const alteracoes: Omit<CaixaAlteracao, 'id' | 'detectado_em'>[] = []

    if (existing.apurado !== snap.apurado) {
      alteracoes.push({
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

    if (existing.diferenca !== snap.diferenca) {
      alteracoes.push({
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
      alteracoes.push({
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

    // Save alterations
    if (alteracoes.length > 0) {
      await supabase.from('caixa_alteracoes').insert(alteracoes)
    }

    // Update snapshot with current values
    await supabase
      .from('caixa_snapshots')
      .update({
        apurado: snap.apurado,
        diferenca: snap.diferenca,
        fechado: snap.fechado,
        funcionario_nome: snap.funcionario_nome,
        snapshot_at: new Date().toISOString(),
      })
      .eq('empresa_codigo', snap.empresa_codigo)
      .eq('caixa_codigo', snap.caixa_codigo)
      .eq('turno_codigo', snap.turno_codigo)
      .eq('data_movimento', snap.data_movimento)
  }
}

/* ─── Fetch history ─── */

export const fetchCaixaAlteracoes = async (
  empresaCodigo: number,
  dataInicial?: string,
  dataFinal?: string
): Promise<CaixaAlteracao[]> => {
  if (!supabase) return []
  let query = supabase
    .from('caixa_alteracoes')
    .select('*')
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
  caixaCodigo: number,
  turnoCodigo: number,
  dataMovimento: string
): Promise<CaixaAlteracao[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('caixa_alteracoes')
    .select('*')
    .eq('caixa_codigo', caixaCodigo)
    .eq('turno_codigo', turnoCodigo)
    .eq('data_movimento', dataMovimento)
    .order('detectado_em', { ascending: false })

  if (error) throw error
  return data ?? []
}
