import axios from 'axios'
import { useTenantStore } from '@/store/tenant'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  // Arrays em "repeat form" (?x=1&x=2), NÃO o bracket do axios (?x[]=1&x[]=2):
  // a API Quality só entende repeat/comma — com bracket ela devolve resultado
  // parcial (ex.: vendaCodigo[] retorna 1 de N). Vale p/ todos os params array.
  paramsSerializer: { indexes: null },
})

// --- Request interceptor: READ-ONLY enforcement ---
// Rejects any method that is not GET.
client.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase()

  if (method !== 'get') {
    return Promise.reject(
      new Error(`READ-ONLY: método ${method.toUpperCase()} bloqueado. Apenas GET é permitido.`)
    )
  }

  return config
})

// --- Request interceptor: injeta CHAVE + baseURL da rede atual (tenant) ---
// Tenant é populado pelo bootstrap no App.tsx após login. Enquanto não houver
// rede carregada (ex: pré-login, ou migração antes do SQL de redes rodar),
// cai no fallback do env VITE_API_KEY / VITE_API_BASE_URL.
client.interceptors.request.use((config) => {
  const rede = useTenantStore.getState().rede
  const chave = rede?.chave ?? (import.meta.env.VITE_API_KEY as string | undefined)
  const baseURL = rede?.api_base_url ?? (import.meta.env.VITE_API_BASE_URL as string | undefined)

  if (chave) {
    config.params = { ...config.params, CHAVE: chave }
  }
  if (baseURL) {
    config.baseURL = baseURL
  }

  return config
})

// --- Rate-limit handling: circuit-breaker adaptativo + backoff no 429 ---
// A API Quality é sensível a rajadas (re-apuração dispara centenas de GETs em
// paralelo). Estratégia em duas camadas, desenhada pra NÃO custar performance
// no caminho feliz:
//   1. Circuit-breaker adaptativo (request interceptor): quando saudável, zero
//      throttle — velocidade máxima, só o cap ~6 do browser governa. Assim que
//      a Quality devolve 429, entra em "cooldown" e os próximos GETs saem
//      espaçados (drenando a fila em vez de estourar tudo de novo). O
//      espaçamento relaxa sozinho conforme as respostas voltam a ser 2xx.
//   2. Backoff + retry (response interceptor): em vez de deixar o 429 propagar
//      como "vazio"/erro, espera e re-tenta — respeita Retry-After quando existe,
//      senão backoff exponencial com jitter. Teto de MAX_429_RETRIES por request.
const MAX_429_RETRIES = 6 // era 4 — sob throttle sustentado da CHAVE (cron + front
                          // competindo pela cota) 4 esgotava e o GET falhava.
const COOLDOWN_MS = 12_000 // janela de cooldown, renovada a cada novo 429
const SPACING_START_MS = 150 // espaçamento inicial ao entrar em cooldown
const SPACING_MAX_MS = 2_000 // teto do espaçamento entre GETs sob pressão (mais
                             // paciente = drena a fila em vez de re-estourar)

let rateLimitedUntil = 0 // timestamp (ms) até quando estamos em cooldown
let spacingMs = 0 // intervalo mínimo entre saídas de request durante cooldown
let lastRequestAt = 0 // quando o último GET foi liberado (agenda o espaçamento)

// --- Cancelamento de requisições em voo (ex.: botão "Cancelar" da apuração) ---
// Sem plumbar AbortSignal por TODOS os endpoints: um "epoch" que, ao ser bumpado,
// acorda todas as ESPERAS de backoff/espaçamento e faz as re-tentativas de 429
// desistirem na hora. Como a maioria das requisições da tempestade fica parada no
// backoff (até 15s), isso drena o storm quase imediatamente. Requisições NOVAS
// (depois do abort) seguem normais — o epoch é monotônico e cada espera compara
// contra o valor capturado, então só cancela quem estava esperando no momento.
let abortEpoch = 0
const backoffWaiters = new Set<() => void>()
export const abortPendingRequests = () => {
  abortEpoch++
  for (const wake of backoffWaiters) wake()
  backoffWaiters.clear()
}

// Sleep interrompível: acorda no timeout OU quando abortPendingRequests roda.
const abortableSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const wake = () => { clearTimeout(t); backoffWaiters.delete(wake); resolve() }
    const t = setTimeout(wake, ms)
    backoffWaiters.add(wake)
  })

// Request interceptor: gate adaptativo. Fora do cooldown, não faz nada (rápido).
// Dentro do cooldown, reserva um "slot" espaçado — a reserva é síncrona (antes
// do await), então requests concorrentes se enfileiram corretamente.
client.interceptors.request.use(async (config) => {
  const now = Date.now()
  if (now < rateLimitedUntil && spacingMs > 0) {
    const scheduledAt = Math.max(now, lastRequestAt + spacingMs)
    lastRequestAt = scheduledAt
    const wait = scheduledAt - now
    if (wait > 0) await abortableSleep(wait)
  } else {
    lastRequestAt = now
  }
  return config
})

const retryDelayMs = (attempt: number, retryAfterHeader?: string): number => {
  // Retry-After pode vir em segundos (número) — honra se presente.
  if (retryAfterHeader) {
    const secs = Number(retryAfterHeader)
    if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 30_000)
  }
  // Backoff exponencial: ~1s, 2s, 4s, 8s (teto 15s) + jitter até 400ms.
  const base = Math.min(1000 * 2 ** attempt, 15_000)
  return base + Math.floor(Math.random() * 400)
}

client.interceptors.response.use(
  (response) => {
    // Saudável de novo: se o cooldown já expirou, zera o espaçamento pra
    // próxima rajada voltar em velocidade máxima.
    if (spacingMs > 0 && Date.now() >= rateLimitedUntil) spacingMs = 0
    return response
  },
  async (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (axios.isAxiosError(error) && error.response?.status === 429 && error.config) {
      // Entra/renova o cooldown e sobe o espaçamento (rampa geométrica até o teto).
      rateLimitedUntil = Date.now() + COOLDOWN_MS
      spacingMs = Math.min(spacingMs > 0 ? spacingMs * 1.5 : SPACING_START_MS, SPACING_MAX_MS)

      const cfg = error.config as typeof error.config & { _retry429?: number }
      const attempt = cfg._retry429 ?? 0
      if (attempt < MAX_429_RETRIES) {
        cfg._retry429 = attempt + 1
        const retryAfter = error.response.headers?.['retry-after'] as string | undefined
        const epochAtWait = abortEpoch
        await abortableSleep(retryDelayMs(attempt, retryAfter))
        // Cancelado durante a espera → desiste na hora (não re-tenta).
        if (abortEpoch !== epochAtWait) return Promise.reject(error)
        return client(cfg)
      }
    }

    return Promise.reject(error)
  }
)

export { client }
