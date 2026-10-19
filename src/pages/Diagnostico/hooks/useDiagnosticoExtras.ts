import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchVendasFuncionarioCache } from '@/api/supabase/apuracao'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchTitulosReceber, fetchTitulosPagar } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { TituloPagar, TituloReceber } from '@/api/types/financeiro'
import { todayLocal } from '@/lib/period'
import type { Diagnostico } from '@/pages/Diagnostico/lib/diagnostico'
import { analisarEquipe, analisarFinanceiro, montarPilares, type Equipe, type Financeiro, type Pilar } from '@/pages/Diagnostico/lib/pilares'

const ultimoDia = (ym: string) => { const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0); return `${ym}-${String(d.getDate()).padStart(2, '0')}` }

/**
 * Os outros pilares do diagnóstico: equipe (cache de venda por funcionário,
 * pista e loja) e financeiro (títulos em aberto hoje, mesma leitura da
 * Central — chaves iguais, cache compartilhado). Só roda quando o
 * diagnóstico de vendas já existe.
 */
const useDiagnosticoExtras = (empresaCodigos: number[] | null, d: Diagnostico | null) => {
  const hoje = todayLocal()
  const codes = empresaCodigos ?? []
  const chave = codes.join(',')
  const temCodes = codes.length > 0
  const mesIni = d ? (d.a.ini < d.b.ini ? d.b.ini : d.b.ini < d.a.ini ? d.b.ini : d.a.ini) : null
  const mesFim = d ? (d.a.fim > d.b.fim ? d.a.fim : d.b.fim) : null
  const mesMin = d ? [d.a.ini, d.b.ini].sort()[0] : mesIni

  const funcQ = useQuery({
    queryKey: ['diagnostico-funcionarios', chave, mesMin, mesFim],
    enabled: temCodes && !!d && !!mesMin && !!mesFim,
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchVendasFuncionarioCache({ empresaCodigos: codes, dataInicial: `${mesMin}-01`, dataFinal: ultimoDia(mesFim!) }),
  })
  const nomesQ = useQuery({
    queryKey: ['funcionarios-nomes', chave],
    enabled: temCodes && !!d,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      // Um posto: só os dele. Rede: /FUNCIONARIO sem empresa traz a rede toda.
      const emp = codes.length === 1 ? codes[0] : undefined
      const all = await fetchAllPages((p) => fetchFuncionarios({ empresaCodigo: emp, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 500, 10)
      const m = new Map<number, string>()
      for (const f of all) m.set(f.funcionarioCodigo, f.nome)
      return m
    },
  })

  // Mesmas chaves/params do useContasResumo e do useFinanceData → cache compartilhado.
  const SNAPSHOT_INICIO = '2015-01-01', SNAPSHOT_FIM = '2045-12-31'
  const receberQ = useQuery({
    queryKey: ['titulosReceberPend', 'rede'],
    enabled: temCodes && !!d,
    staleTime: 30_000, placeholderData: keepPreviousData,
    queryFn: () => fetchAllPages((p) => fetchTitulosReceber({ dataInicial: SNAPSHOT_INICIO, dataFinal: SNAPSHOT_FIM, apenasPendente: true, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 20),
  })
  const pagarQ = useQuery({
    queryKey: ['titulosPagarPend', 'rede'],
    enabled: temCodes && !!d,
    staleTime: 5 * 60 * 1000, placeholderData: keepPreviousData,
    queryFn: () => fetchAllPages((p) => fetchTitulosPagar({ dataInicial: SNAPSHOT_INICIO, dataFinal: SNAPSHOT_FIM, apenasPendente: true, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 30),
  })

  const equipe: Equipe | null = useMemo(() => (d && funcQ.data ? analisarEquipe(funcQ.data, nomesQ.data ?? new Map(), d) : null), [d, funcQ.data, nomesQ.data])
  const financeiro: Financeiro | null = useMemo(() => {
    if (!d || !temCodes || (!receberQ.data && !pagarQ.data)) return null
    const fatMes = d.totA.faturamento / Math.max(1, d.totA.meses)
    return analisarFinanceiro((receberQ.data ?? []) as TituloReceber[], (pagarQ.data ?? []) as TituloPagar[], codes, fatMes, hoje, d.sujeito)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- codes é derivado de chave
  }, [d, chave, temCodes, receberQ.data, pagarQ.data, hoje])
  const pilares: Pilar[] | null = useMemo(() => (d ? montarPilares(d, equipe, financeiro) : null), [d, equipe, financeiro])

  return {
    equipe, financeiro, pilares,
    carregandoEquipe: funcQ.isLoading,
    carregandoFinanceiro: receberQ.isLoading || pagarQ.isLoading,
  }
}

export default useDiagnosticoExtras
