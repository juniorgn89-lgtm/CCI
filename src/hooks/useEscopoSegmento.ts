import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTanques } from '@/api/endpoints/combustiveis'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { fetchVendasSetorMensal } from '@/api/supabase/apuracao'
import type { Tanque } from '@/api/types/combustivel'
import { useRedePostos } from '@/pages/Rede/hooks/useRedePostos'
import { useFilterStore } from '@/store/filters'
import { useTenantStore } from '@/store/tenant'

/**
 * O escopo atual é SÓ conveniência (CNPJ da loja, separado do posto)?
 *
 * Sinal: tanques no ERP (/TANQUE). Todo CNPJ que vende combustível tem tanque;
 * a conveniência com CNPJ próprio não tem nenhum. Uma chamada para a rede toda,
 * guardada por 1 h.
 *
 * Escopo = postos escolhidos no filtro (ou, em "Todos", todos os permitidos ao
 * usuário). Só esconde quando TODOS do escopo são conveniência; misturado com
 * posto, fica tudo como antes.
 *
 * Falha aberta (anti-enganação ao contrário): se os tanques não carregaram, ou a
 * rede não tem tanque nenhum (leitura suspeita), NÃO esconde nada.
 *
 * Automotivo: some só se, além de conveniência, não houve venda de automotivos
 * nos últimos 3 meses no cache. Cache vazio (rede não apurada) = não esconde.
 */
export interface EscopoSegmento {
  /** Todos os postos do escopo são conveniência (sem tanque): esconde combustível. */
  soConveniencia: boolean
  /** Além disso, sem venda de automotivos recente: esconde Automotivo/Pista. */
  semAutomotivo: boolean
}

const mesYm = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export const useEscopoSegmento = (opts?: { ignorarFiltro?: boolean }): EscopoSegmento => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const filtro = useFilterStore((s) => s.empresaCodigos)
  const { postos } = useRedePostos()

  const tanques = useQuery({
    queryKey: ['segmento-tanques', redeId],
    enabled: !!redeId,
    staleTime: 60 * 60_000,
    retry: 1,
    queryFn: () => fetchAllPages<Tanque>((p) => fetchTanques({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
  })

  const escopo = useMemo(() => {
    const permitidas = postos.map((p) => p.codigo)
    if (opts?.ignorarFiltro || filtro.length === 0) return permitidas
    const ok = new Set(permitidas)
    return filtro.filter((c) => ok.has(c))
  }, [postos, filtro, opts?.ignorarFiltro])

  const soConveniencia = useMemo(() => {
    if (!tanques.isSuccess || escopo.length === 0) return false
    const comTanque = new Set((tanques.data ?? []).map((t) => t.empresaCodigo))
    if (comTanque.size === 0) return false // nenhum tanque na rede inteira: leitura suspeita
    return escopo.every((c) => !comTanque.has(c))
  }, [tanques.isSuccess, tanques.data, escopo])

  const vendas = useQuery({
    queryKey: ['segmento-automotivos', redeId, [...escopo].sort().join(',')],
    enabled: soConveniencia,
    staleTime: 60 * 60_000,
    retry: 1,
    queryFn: () => {
      const fim = new Date()
      const ini = new Date(fim.getFullYear(), fim.getMonth() - 2, 1)
      return fetchVendasSetorMensal({ empresaCodigos: escopo, mesInicial: mesYm(ini), mesFinal: mesYm(fim) })
    },
  })

  const semAutomotivo = useMemo(() => {
    if (!soConveniencia || !vendas.isSuccess) return false
    const linhas = vendas.data ?? []
    if (linhas.length === 0) return false // cache vazio: não dá para afirmar
    return !linhas.some((l) => l.setor === 'automotivos' && Number(l.total_venda) > 0)
  }, [soConveniencia, vendas.isSuccess, vendas.data])

  return { soConveniencia, semAutomotivo }
}

/**
 * Abas que não fazem sentido num escopo só de conveniência. `path` = rota do
 * módulo (mesma chave do appStructure), `tabId` = id da aba.
 */
export const abaOcultaPorSegmento = (path: string, tabId: string, s: EscopoSegmento): boolean => {
  if (!s.soConveniencia) return false
  if (path === '/dashboard') return tabId === 'combustivel' || tabId === 'precos' || (tabId === 'pista' && s.semAutomotivo)
  if (path === '/produtividade') return tabId === 'pista'
  return false
}

/** Módulos inteiros que somem num escopo só de conveniência. */
export const moduloOcultoPorSegmento = (path: string, s: EscopoSegmento): boolean =>
  s.soConveniencia && (path === '/operacao' || path.startsWith('/operacao/') || path === '/comercial')
