/**
 * Reparo do app: apaga o que o Visor guardou NESTE aparelho (localStorage,
 * sessionStorage, cache do service worker) e reabre o login limpo.
 *
 * Por quê: no app instalado (PWA), dado velho guardado pode prender a pessoa
 * num loop "entra → volta pro login" (ex.: sessão de um usuário que foi apagado
 * e recriado, 19/11/2026). Usuário comum não sabe abrir DevTools, então o
 * próprio app se limpa: automático ao detectar o loop + link "Problemas para
 * entrar?" no login. Não mexe em nada no servidor; login e senha continuam.
 */

/** Preferências inofensivas que sobrevivem ao reparo (tema e escala da tela). */
const MANTER = ['visor360-theme-mode', 'visor360.uiscale']

/** Marca, em sessionStorage, o instante de um login que deu certo. */
export const LOGIN_OK_KEY = 'visor360.loginOk'
/** Janela em que voltar pro login sem sessão conta como loop. */
export const JANELA_LOOP_MS = 30_000

export const marcarLoginOk = () => {
  try { sessionStorage.setItem(LOGIN_OK_KEY, String(Date.now())) } catch { /* sem storage */ }
}

export const limparMarcaLogin = () => {
  try { sessionStorage.removeItem(LOGIN_OK_KEY) } catch { /* sem storage */ }
}

/** true = acabou de logar com sucesso e já caiu de volta no login. */
export const caiuDeVoltaNoLogin = (): boolean => {
  try {
    const t = Number(sessionStorage.getItem(LOGIN_OK_KEY))
    return Number.isFinite(t) && t > 0 && Date.now() - t < JANELA_LOOP_MS
  } catch {
    return false
  }
}

export const repararApp = async () => {
  try {
    const guardado = MANTER.map((k) => [k, localStorage.getItem(k)] as const)
    localStorage.clear()
    for (const [k, v] of guardado) if (v !== null) localStorage.setItem(k, v)
  } catch { /* segue */ }
  try { sessionStorage.clear() } catch { /* segue */ }
  try {
    if ('caches' in window) {
      const nomes = await caches.keys()
      await Promise.all(nomes.map((n) => caches.delete(n)))
    }
  } catch { /* segue */ }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch { /* segue */ }
  window.location.replace('/login?reparado=1')
}
