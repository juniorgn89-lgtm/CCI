import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import {
  consultarEextrato, fetchEextratoStatus,
  type AjusteEextrato, type RecebivelEextrato, type VendaEextrato,
} from '@/api/supabase/eextrato'
import { todayLocal } from '@/lib/period'

const somarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Quantos dias de agenda de créditos à frente. */
export const DIAS_AGENDA = 60

/**
 * Retornos da e-extrato para a aba Conciliação de cartão: vendas por parcela e
 * ajustes no período do filtro, e a agenda de créditos dos próximos dias.
 * Só busca depois de confirmar que a integração tem chave (senão a tela diz isso).
 */
const useConciliacaoCartao = (dataInicial: string, dataFinal: string) => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const status = useQuery({ queryKey: ['eextrato-status'], queryFn: fetchEextratoStatus, staleTime: 10 * 60_000, retry: false })
  const ativo = !!redeId && status.data?.configurado === true
  const periodo = { dataVendaInicio: dataInicial, dataVendaFim: dataFinal }
  const hoje = todayLocal()

  const vendas = useQuery({
    queryKey: ['eextrato', 'vendaDetalhada', redeId, dataInicial, dataFinal],
    queryFn: () => consultarEextrato<VendaEextrato>('vendaDetalhada', periodo),
    enabled: ativo, staleTime: 15 * 60_000, retry: false,
  })
  const ajustes = useQuery({
    queryKey: ['eextrato', 'ajuste', redeId, dataInicial, dataFinal],
    queryFn: () => consultarEextrato<AjusteEextrato>('ajuste', { dataPagamentoInicio: dataInicial, dataPagamentoFim: dataFinal }),
    enabled: ativo, staleTime: 15 * 60_000, retry: false,
  })
  const recebiveis = useQuery({
    queryKey: ['eextrato', 'recebivel', redeId, hoje],
    queryFn: () => consultarEextrato<RecebivelEextrato>('recebivel', { dataPagamentoInicio: hoje, dataPagamentoFim: somarDias(hoje, DIAS_AGENDA) }),
    enabled: ativo, staleTime: 15 * 60_000, retry: false,
  })

  return { status, configurado: status.data?.configurado ?? null, vendas, ajustes, recebiveis }
}

export default useConciliacaoCartao
