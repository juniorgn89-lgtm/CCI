import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'
import { useManutencaoStore, DEFAULT_CONFIG, type ManutencaoConfig } from '@/store/manutencao'
import {
  fetchManutencaoConfigs, salvarManutencaoConfig, fetchManutencoesPosto, inserirManutencao, excluirManutencao,
  type BombaManutencaoRow,
} from '@/api/supabase/manutencaoBombas'

/** De onde veio a configuração do posto (o sistema vale para todos). */
export type FonteConfig = 'sistema' | 'navegador' | 'padrao'

/**
 * Configuração de manutenção por posto, salva no SISTEMA (vale igual para toda
 * a rede). Enquanto o posto não foi salvo lá, aproveita o que estiver no
 * navegador (config antiga, localStorage) e, por último, o padrão.
 */
export const useManutencaoConfigs = () => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const meuNome = useAuthStore((s) => s.user?.email ?? null)
  const locais = useManutencaoStore((s) => s.configs)
  const setLocal = useManutencaoStore((s) => s.setConfig)
  const clearLocal = useManutencaoStore((s) => s.clearConfig)
  const qc = useQueryClient()
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['manutencao-config', redeId],
    queryFn: () => fetchManutencaoConfigs(redeId!),
    enabled: !!redeId,
    staleTime: 60 * 1000,
  })

  return useMemo(() => {
    const porPosto = new Map(rows.map((r) => [r.empresa_codigo, r]))
    const get = (empresaCodigo: number | null): { config: ManutencaoConfig; fonte: FonteConfig; porNome: string | null; em: string | null } => {
      if (empresaCodigo == null) return { config: DEFAULT_CONFIG, fonte: 'padrao', porNome: null, em: null }
      const r = porPosto.get(empresaCodigo)
      if (r) return { config: { intervaloLitros: r.intervalo_litros, avisarAoAtingirPct: r.avisar_pct, responsavel: r.responsavel ?? '' }, fonte: 'sistema', porNome: r.updated_by_nome, em: r.updated_at }
      const l = locais[empresaCodigo]
      if (l) return { config: l, fonte: 'navegador', porNome: null, em: null }
      return { config: DEFAULT_CONFIG, fonte: 'padrao', porNome: null, em: null }
    }
    const salvar = async (empresaCodigo: number, cfg: ManutencaoConfig) => {
      if (!redeId) return { ok: false, error: 'Rede não selecionada.' }
      const res = await salvarManutencaoConfig({
        rede_id: redeId, empresa_codigo: empresaCodigo,
        intervalo_litros: cfg.intervaloLitros, avisar_pct: cfg.avisarAoAtingirPct,
        responsavel: cfg.responsavel || null, updated_by_nome: meuNome,
      })
      if (res.ok) {
        setLocal(empresaCodigo, cfg) // mantém o sino de alertas (lê o store) em dia
        await qc.invalidateQueries({ queryKey: ['manutencao-config', redeId] })
      }
      return res
    }
    /** "Remover" = volta ao padrão (o registro no sistema não se apaga). */
    const voltarAoPadrao = async (empresaCodigo: number) => {
      const res = await salvar(empresaCodigo, DEFAULT_CONFIG)
      if (res.ok) clearLocal(empresaCodigo)
      return res
    }
    return { isLoading, get, salvar, voltarAoPadrao }
  }, [rows, locais, isLoading, redeId, meuNome, setLocal, clearLocal, qc])
}

/** yyyy-MM-dd local de um ISO (a manutenção conta a partir daquele dia). */
export const diaLocal = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Histórico de manutenção das bombas de UM posto + registrar/excluir. */
export const useManutencoesPosto = (empresaCodigo: number | null) => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const meuNome = useAuthStore((s) => s.user?.email ?? null)
  const isMaster = useAuthStore((s) => s.isMaster)
  const qc = useQueryClient()
  const key = ['bomba-manutencoes', redeId, empresaCodigo]
  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => fetchManutencoesPosto(redeId!, empresaCodigo!),
    enabled: !!redeId && empresaCodigo != null,
    staleTime: 60 * 1000,
  })

  return useMemo(() => {
    const porBomba = new Map<number, BombaManutencaoRow[]>()
    for (const r of rows) { const a = porBomba.get(r.bomba_codigo) ?? []; a.push(r); porBomba.set(r.bomba_codigo, a) }
    const ultimaPorBomba = new Map<number, BombaManutencaoRow>()
    for (const [b, a] of porBomba) ultimaPorBomba.set(b, a[0]) // já vem por feita_em desc
    // Dia mais antigo entre as últimas manutenções (de onde buscar os litros).
    const desdeMaisAntigo = [...ultimaPorBomba.values()].map((r) => diaLocal(r.feita_em)).sort()[0] ?? null

    const registrar = async (bombaCodigo: number, feitaEm: string, responsavel: string, observacao: string) => {
      if (!redeId || empresaCodigo == null) return { ok: false, error: 'Posto não selecionado.' }
      const res = await inserirManutencao({
        rede_id: redeId, empresa_codigo: empresaCodigo, bomba_codigo: bombaCodigo,
        feita_em: feitaEm, responsavel: responsavel.trim() || null, observacao: observacao.trim() || null,
        created_by_nome: meuNome,
      })
      if (res.ok) await qc.invalidateQueries({ queryKey: ['bomba-manutencoes', redeId, empresaCodigo] })
      else if (res.error?.includes('row-level security')) return { ok: false, error: 'Sem permissão para registrar nesta rede.' }
      else if (res.error?.includes('nao_futuro')) return { ok: false, error: 'A data e hora não podem estar no futuro.' }
      return res
    }
    const excluir = async (id: string) => {
      const res = await excluirManutencao(id, meuNome)
      if (res.ok && (res.count ?? 0) === 0) return { ok: false, error: 'Só o master pode corrigir um registro.' }
      if (res.ok) await qc.invalidateQueries({ queryKey: ['bomba-manutencoes', redeId, empresaCodigo] })
      return res
    }
    return { isLoading, porBomba, ultimaPorBomba, desdeMaisAntigo, registrar, excluir, podeExcluir: isMaster }
  }, [rows, isLoading, redeId, empresaCodigo, meuNome, isMaster, qc])
}
