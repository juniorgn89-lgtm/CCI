/**
 * Tipos espelhando a API de Mensagens da Anthropic (subset que usamos).
 * Não importamos o SDK oficial @anthropic-ai/sdk pra evitar dependência pesada
 * no bundle do cliente — o subset abaixo é estável e fácil de manter.
 */

export interface ClaudeTextBlock {
  type: 'text'
  text: string
}

export interface ClaudeToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ClaudeToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export type ClaudeContentBlock = ClaudeTextBlock | ClaudeToolUseBlock | ClaudeToolResultBlock

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

export interface ClaudeToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ClaudeMessageResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: ClaudeContentBlock[]
  model: string
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence'
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

/** Mensagem renderizada na UI do chat (forma estável independente do protocolo Claude). */
export interface UiChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: string
  toolCalls?: Array<{
    tool: string
    args: Record<string, unknown>
    durationMs: number
    rowCount?: number
    ok: boolean
    error?: string
  }>
}
