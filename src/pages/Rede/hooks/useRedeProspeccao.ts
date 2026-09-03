import { useQuery } from '@tanstack/react-query'
import { supabaseRede } from '@/lib/supabaseRede'

/** Quem fechou (ou está trabalhando) um posto, vindo do Prospecção360. */
export interface ProspeccaoInfo {
  cnpj: string
  status: string
  vendedor: string
  atualizadoEm: string
}

const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')

interface RedeProspeccaoRow {
  cnpj: string | null
  status: string | null
  vendedor_nome: string | null
  atualizado_em: string | null
}

/**
 * Ponte com o Prospecção360: mapa `CNPJ (só dígitos) → info do vendedor`.
 * Se a ponte não estiver configurada (env do 2º Supabase ausente), a query fica
 * desabilitada e o módulo Rede simplesmente não mostra a coluna de prospecção —
 * degrada com elegância, sem quebrar.
 */
export const useRedeProspeccao = () =>
  useQuery({
    queryKey: ['rede-prospeccao'],
    enabled: !!supabaseRede,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Map<string, ProspeccaoInfo>> => {
      const m = new Map<string, ProspeccaoInfo>()
      if (!supabaseRede) return m
      const { data, error } = await supabaseRede
        .from('rede_prospeccao')
        .select('cnpj,status,vendedor_nome,atualizado_em')
      if (error) throw error
      for (const r of (data as RedeProspeccaoRow[] | null) ?? []) {
        const cnpj = onlyDigits(r.cnpj)
        if (!cnpj) continue
        m.set(cnpj, {
          cnpj,
          status: r.status ?? '',
          vendedor: r.vendedor_nome ?? '',
          atualizadoEm: r.atualizado_em ?? '',
        })
      }
      return m
    },
  })
