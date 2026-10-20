import { supabase } from '@/lib/supabase'

/** Um serviço da CCI contratado por um posto (cópia diária do Prospecção360). */
export interface CciServicoPosto {
  empresa_codigo: number
  servico: string
  desde: string
  ate: string | null
  origem: string | null
  sincronizado_em: string
}

/** Nome de cada serviço do catálogo do Prospecção (ids iguais aos de lá). */
export const NOME_SERVICO_CCI: Record<string, string> = {
  consultoria: 'Consultoria',
  'bpo-financeiro': 'BPO Financeiro',
  relatorios: 'Relatórios Inteligentes',
  visor360: 'Visor360',
  fleetpass: 'FleetPass',
  'reverter-sistema': 'Troca de sistema',
}

/** Serviços da rede (todos os postos), ativos e encerrados. Só leitura. */
export const fetchCciServicos = async (redeId: string): Promise<CciServicoPosto[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('cci_servicos_posto')
    .select('empresa_codigo, servico, desde, ate, origem, sincronizado_em')
    .eq('rede_id', redeId)
  // Tabela ainda não criada (migration pendente) ou sem acesso: sem serviços, sem quebrar a tela.
  if (error) return []
  return (data ?? []) as CciServicoPosto[]
}

/** Admin › Redes: serviços de TODAS as redes legíveis (master vê todas). */
export const fetchCciServicosTodas = async (): Promise<(CciServicoPosto & { rede_id: string })[]> => {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('cci_servicos_posto')
    .select('rede_id, empresa_codigo, servico, desde, ate, origem, sincronizado_em')
  if (error) return []
  return (data ?? []) as (CciServicoPosto & { rede_id: string })[]
}

/** Ordem e serviços que dá para marcar pelo Visor (ids do catálogo do Prospecção). */
export const SERVICOS_MARCAVEIS = ['consultoria', 'bpo-financeiro', 'relatorios', 'fleetpass', 'visor360'] as const

export interface CciPostoAdmin {
  empresa_codigo: number
  nome: string
  cnpj: string
  no_prospeccao: boolean
  lead_nome: string | null
  ativos: { servico: string; desde: string }[]
}

const invocar = async <T>(body: Record<string, unknown>): Promise<T> => {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.functions.invoke('servicos-cci', { body })
  if (error) {
    // A Edge Function devolve { error } no corpo; o supabase-js embrulha num FunctionsHttpError.
    const ctx = (error as { context?: Response }).context
    const msg = ctx ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null
    throw new Error(msg || error.message)
  }
  return data as T
}

/** Postos da rede (ERP) + se estão no Prospecção + serviços ativos. Só master. */
export const fetchCciPostosAdmin = (redeId: string) => invocar<{ postos: CciPostoAdmin[] }>({ acao: 'postos', rede_id: redeId }).then((r) => r.postos)

/** Liga ou encerra um serviço num posto: grava no Prospecção e na cópia do Visor. Só master. */
export const marcarCciServico = (redeId: string, empresaCodigo: number, servico: string, ligado: boolean, desde?: string) =>
  invocar<{ ok: true }>({ acao: 'marcar', rede_id: redeId, empresa_codigo: empresaCodigo, servico, ligado, desde })

/**
 * Corrige a data de início de um serviço já ligado (um ou vários postos). Para
 * a Consultoria, é o marco do "antes e depois da CCI" no Diagnóstico. Só master.
 * `falhas` = postos onde o Prospecção não achou o serviço ativo.
 */
export const datarCciServico = (redeId: string, empresas: number[], servico: string, desde: string) =>
  invocar<{ ok: true; falhas: string[] }>({ acao: 'datar', rede_id: redeId, empresas, servico, desde })
