import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

// Checa por nova versão de tempos em tempos (além do check no load). Importante
// pro PWA instalado no celular, que pode ficar aberto por horas sem recarregar.
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000 // 30 min

/**
 * Banner de atualização do PWA. Quando há uma versão nova publicada, o Service
 * Worker novo entra em "waiting" e este banner aparece — ao tocar em "Atualizar"
 * chamamos `updateServiceWorker(true)` (skipWaiting + reload imediato), então o
 * celular nunca fica preso numa casca antiga (com CSP/bundle velhos).
 *
 * Também força um `registration.update()` periódico e ao voltar o foco pro app,
 * pra detectar deploys novos sem depender do usuário recarregar na mão.
 */
const PwaUpdatePrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      const check = () => { void registration.update().catch(() => { /* offline/noop */ }) }
      setInterval(check, UPDATE_CHECK_INTERVAL)
      // Voltou pro app (reabriu o PWA, trocou de aba) → checa update na hora.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-white/10 bg-[#1e3a5f] px-4 py-3 text-white shadow-2xl">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <RefreshCw className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Nova versão disponível</p>
          <p className="text-[11.5px] leading-snug text-white/70">Atualize pra pegar as últimas melhorias.</p>
        </div>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="shrink-0 rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] active:scale-95"
        >
          Atualizar
        </button>
        <button
          type="button"
          aria-label="Depois"
          onClick={() => setNeedRefresh(false)}
          className="shrink-0 rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default PwaUpdatePrompt
