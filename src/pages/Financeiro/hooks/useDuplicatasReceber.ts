import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchDuplicatas } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { Duplicata } from '@/api/types/financeiro'

/** Início da janela: 24 meses atrás (por dataMovimento). */
const janelaInicio = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 24)
  return d.toISOString().split('T')[0]
}

/**
 * Duplicatas de cliente EM ABERTO (pendente = situação "Pendente" + "Parcial").
 * É a fonte das "Faturas" do Contas a Receber: bate 1:1 com a tela "Duplicatas"
 * do WebPosto (bruto/pago/saldo por duplicata), incluindo as PARCIAIS — que o
 * `apenasPendente=true` da API silenciosamente descarta (ele só devolve "Pendente").
 * Por isso paginamos SEM o flag e filtramos `pendente` no cliente.
 *
 * Janela móvel de 24 meses segura o crescimento da paginação (as duplicatas PAGAS
 * antigas dominam e empurrariam as pendentes recentes pra fora do teto de páginas,
 * o mesmo risco do /TITULO_PAGAR) sem perder nenhuma pendente — a mais antiga em
 * aberto vence há < 12 meses. Snapshot fresco (stale 30s, revalida ao abrir/focar).
 */
const useDuplicatasReceber = (): Duplicata[] => {
  const { data = [] } = useQuery({
    queryKey: ['duplicatasReceber', 'rede'],
    queryFn: async () => {
      const all = await fetchAllPages(
        (p) => fetchDuplicatas({
          dataInicial: janelaInicio(),
          dataFinal: '2045-12-31',
          ultimoCodigo: p.ultimoCodigo,
          limite: p.limite,
        }),
        1000, 30,
      )
      return all.filter((d) => d.pendente === true)
    },
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })
  return data
}

export default useDuplicatasReceber
