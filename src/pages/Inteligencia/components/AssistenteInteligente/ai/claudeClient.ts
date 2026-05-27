import type { ClaudeMessage, ClaudeMessageResponse, ClaudeToolDefinition } from './types'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-5'
const MAX_TOKENS = 4096

interface SendOptions {
  apiKey: string
  system: string
  tools: ClaudeToolDefinition[]
  messages: ClaudeMessage[]
}

/**
 * Chama a API de Mensagens da Anthropic DIRETO do navegador.
 *
 * Requer o header `anthropic-dangerous-direct-browser-access: true` —
 * a Anthropic sinaliza que esse modo só é recomendado pra cenários
 * onde o usuário traz a própria chave (BYOK), nunca em produto SaaS
 * onde a chave da empresa estaria exposta a todo cliente.
 *
 * Pra Visor360 (uso interno do operador do posto, chave do próprio
 * usuário em localStorage) o trade-off é aceitável.
 */
export const sendToClaude = async ({ apiKey, system, tools, messages }: SendOptions): Promise<ClaudeMessageResponse> => {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools,
      messages,
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    let parsed: { error?: { message?: string; type?: string } } | undefined
    try {
      parsed = JSON.parse(errorText)
    } catch {
      // mantém errorText cru
    }
    const msg = parsed?.error?.message ?? errorText
    throw new Error(`Claude API ${res.status}: ${msg}`)
  }

  return res.json() as Promise<ClaudeMessageResponse>
}

export const CLAUDE_MODEL = MODEL

/**
 * Faz uma requisição mínima pra validar se a chave funciona. Custo desprezível
 * (max_tokens=1, prompt curtíssimo). Útil pra detectar chave revogada/sem
 * crédito ANTES de gastar tokens numa conversa real.
 *
 * Retorna:
 *  - ok=true → chave válida com saldo
 *  - ok=false + status=401 → chave inválida/revogada
 *  - ok=false + outros → erro de rede ou rate limit
 */
export interface ValidationResult {
  ok: boolean
  status?: number
  errorMessage?: string
}

export const validateApiKey = async (apiKey: string): Promise<ValidationResult> => {
  if (!apiKey || apiKey.trim().length < 20) {
    return { ok: false, errorMessage: 'Chave vazia ou muito curta' }
  }
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })
    if (res.ok) return { ok: true, status: res.status }
    const text = await res.text()
    let errorMessage = `HTTP ${res.status}`
    try {
      const parsed = JSON.parse(text)
      errorMessage = parsed?.error?.message ?? errorMessage
    } catch {
      if (text) errorMessage = text.slice(0, 200)
    }
    return { ok: false, status: res.status, errorMessage }
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Verifica se um erro do sendToClaude indica chave inválida/revogada (401)
 * ou problema de billing/permissão. Usado pra auto-marcar a chave como inválida.
 */
export const isAuthError = (error: unknown): boolean => {
  if (!error) return false
  const msg = error instanceof Error ? error.message : String(error)
  return /\b40[13]\b|authentication|invalid.{0,10}key|api[_-]?key|credit|billing/i.test(msg)
}
