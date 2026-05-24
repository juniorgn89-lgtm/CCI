/**
 * Throttle de tentativas de login no client. Defesa em profundidade:
 * o Supabase já tem rate limit no servidor, mas isso evita centenas de
 * requests ruidosos antes deles chegarem na borda + dá feedback visual
 * imediato pro usuário ("aguarde X segundos").
 *
 * Estado fica em sessionStorage (não localStorage) — restrição vale só
 * pra aba atual; abrir aba nova zera. Aceitável porque atacante que
 * controla múltiplas abas já tem o controle da máquina.
 */

const STORAGE_KEY = 'visor360.login_throttle'
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 min
const LOCKOUT_MS = 5 * 60 * 1000 // 5 min após atingir o limite

interface ThrottleState {
  attempts: number
  firstAttemptAt: number
  lockedUntil: number
}

const read = (): ThrottleState => {
  if (typeof sessionStorage === 'undefined') {
    return { attempts: 0, firstAttemptAt: 0, lockedUntil: 0 }
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { attempts: 0, firstAttemptAt: 0, lockedUntil: 0 }
    return JSON.parse(raw) as ThrottleState
  } catch {
    return { attempts: 0, firstAttemptAt: 0, lockedUntil: 0 }
  }
}

const write = (state: ThrottleState) => {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* storage cheio/bloqueado — falha silenciosa */ }
}

export interface ThrottleStatus {
  /** True quando o usuário pode tentar agora. */
  allowed: boolean
  /** Segundos restantes até poder tentar de novo (0 quando allowed). */
  retryAfterSeconds: number
  /** Tentativas restantes antes do lockout (informativo). */
  remainingAttempts: number
}

export const getLoginThrottleStatus = (): ThrottleStatus => {
  const now = Date.now()
  const state = read()

  if (state.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000),
      remainingAttempts: 0,
    }
  }

  // Janela expirou — zera o contador
  if (state.firstAttemptAt && now - state.firstAttemptAt > WINDOW_MS) {
    write({ attempts: 0, firstAttemptAt: 0, lockedUntil: 0 })
    return { allowed: true, retryAfterSeconds: 0, remainingAttempts: MAX_ATTEMPTS }
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - state.attempts),
  }
}

/** Chamar ao receber resposta de erro do login (credencial inválida). */
export const registerLoginFailure = (): ThrottleStatus => {
  const now = Date.now()
  const state = read()
  const inWindow = state.firstAttemptAt && now - state.firstAttemptAt < WINDOW_MS
  const next: ThrottleState = inWindow
    ? { ...state, attempts: state.attempts + 1 }
    : { attempts: 1, firstAttemptAt: now, lockedUntil: 0 }

  if (next.attempts >= MAX_ATTEMPTS) {
    next.lockedUntil = now + LOCKOUT_MS
  }
  write(next)
  return getLoginThrottleStatus()
}

/** Chamar ao login bem-sucedido — zera o contador. */
export const resetLoginThrottle = () => {
  if (typeof sessionStorage === 'undefined') return
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}
