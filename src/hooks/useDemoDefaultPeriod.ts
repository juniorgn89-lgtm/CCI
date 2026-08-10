import { useEffect, useRef } from 'react'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { fetchUltimaDataApurada } from '@/api/supabase/apuracao'
import { isDemoApiBaseUrl } from '@/lib/redeDemo'

/**
 * Na **Rede Demonstração**, o período de abertura cai no ÚLTIMO mês APURADO, em
 * vez do mês corrente (que a demo normalmente não apura → tela vazia pro usuário
 * normal). Roda UMA vez por rede: ao entrar na demo, busca o último `data` de
 * `apuracao_diaria` e fixa o período (1º do mês → esse dia). Depois o usuário
 * navega livremente (não reforça). Ao SAIR da demo, volta pro mês corrente.
 *
 * Não toca em redes reais — elas seguem no mês corrente (dado ao vivo/atual).
 * Auto-mantém: reapurou a demo em qualquer período → os usuários caem nele.
 *
 * Depende só de `id` + `api_base_url` (primitivos estáveis por rede), não do
 * objeto `rede` — que é setado 2x no bootstrap (sem plano, depois com plano) e
 * cancelaria o fetch no cleanup se fosse dependência.
 */
export default function useDemoDefaultPeriod() {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const apiBaseUrl = useTenantStore((s) => s.rede?.api_base_url ?? null)
  const setPeriodo = useFilterStore((s) => s.setPeriodo)
  const resetPeriodoToDefault = useFilterStore((s) => s.resetPeriodoToDefault)
  // rede.id pra qual fixamos o período da demo (null = não estamos numa demo).
  const doneFor = useRef<string | null>(null)

  useEffect(() => {
    if (!redeId || !isDemoApiBaseUrl(apiBaseUrl)) {
      // Saiu da demo (master trocou pra rede real) → volta pro mês corrente.
      if (doneFor.current !== null) {
        doneFor.current = null
        resetPeriodoToDefault()
      }
      return
    }
    if (doneFor.current === redeId) return // já ajustou pra esta rede nesta sessão
    doneFor.current = redeId

    let cancelled = false
    ;(async () => {
      const ultima = await fetchUltimaDataApurada(redeId)
      if (cancelled || !ultima) return
      const primeiroDia = `${ultima.slice(0, 7)}-01`
      setPeriodo(primeiroDia, ultima)
    })()
    return () => { cancelled = true }
  }, [redeId, apiBaseUrl, setPeriodo, resetPeriodoToDefault])
}
