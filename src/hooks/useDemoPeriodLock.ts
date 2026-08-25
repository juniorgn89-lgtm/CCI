import { useEffect } from 'react'
import { useIsDemoPeriodLocked } from '@/store/tenant'
import { useFilterStore, defaultPeriodo } from '@/store/filters'

/**
 * Na Rede Demonstração o período fica FIXO no mês atual — o cron mantém o mês
 * corrente sempre apurado, então a demo "só traz os dados", sem depender do mês
 * que a pessoa escolhe (e sem cair num mês vazio). O seletor de mês some (ver
 * DateRangeToolbar); este hook garante que, ao entrar na demo, o período volte
 * pro mês atual mesmo que o usuário tenha um período custom de outra rede.
 *
 * Só re-fixa quando `isDemo` (ou o critério de dias fechados) muda — dentro da
 * demo o toolbar está oculto, então o período não deriva depois disso.
 */
export const useDemoPeriodLock = (): void => {
  const isDemo = useIsDemoPeriodLocked()
  const setPeriodo = useFilterStore((s) => s.setPeriodo)
  const diasFechados = useFilterStore((s) => s.diasFechados)
  useEffect(() => {
    if (!isDemo) return
    const { dataInicial, dataFinal } = defaultPeriodo(diasFechados)
    setPeriodo(dataInicial, dataFinal)
  }, [isDemo, diasFechados, setPeriodo])
}

export default useDemoPeriodLock
