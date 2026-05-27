import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { sendToClaude, isAuthError } from '../ai/claudeClient'
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from '../ai/tools'
import { buildSystemPrompt } from '../ai/systemPrompt'
import { useToolCallLog } from '../ai/toolCallLog'
import type { ClaudeContentBlock, ClaudeMessage, UiChatMessage } from '../ai/types'

const MAX_TOOL_ITERATIONS = 6

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/**
 * Calcula período default = mês corrente. Independente do filtro global da UI
 * (o Assistente é "livre de filtros" — opera no escopo total do user).
 */
const currentMonthRange = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const first = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const last = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { dataInicial: first, dataFinal: last }
}

/**
 * Orquestrador do chat com Claude.
 *
 * Escopo das tools:
 *  - Usa empresas PERMITIDAS pro user (auth.empresaCodigos) — não o filtro global.
 *  - Master/null → vê toda a rede. Whitelist → restringe ao subset.
 *  - Período default = mês corrente (calculado agora), independente do filtro.
 *
 * Fluxo:
 *  1) Pega histórico atual + nova pergunta
 *  2) Chama Claude com tools disponíveis
 *  3) Se tool_use → executa, anexa tool_result, volta pro passo 2
 *  4) end_turn → extrai texto final e mostra
 */
export const useClaudeChat = (apiKey: string, onAuthError?: (msg: string) => void) => {
  const allowedFromAuth = useAuthStore((s) => s.empresaCodigos)
  const isMaster = useAuthStore((s) => s.isMaster)
  const appendLog = useToolCallLog((s) => s.append)

  // Lista das empresas reais da rede (pra system prompt e validação de escopo)
  const { data: empresasData } = useQuery({
    queryKey: ['assistente-empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 5 * 60 * 1000,
  })

  // Empresas que o user efetivamente pode consultar:
  // - master → todas
  // - whitelist null → todas (sem restrição)
  // - whitelist com itens → intersecta com a lista real
  const accessiblePostos = (() => {
    const todas = empresasData?.resultados ?? []
    if (isMaster || allowedFromAuth === null || allowedFromAuth.length === 0) {
      return todas.map((e) => ({
        codigo: e.codigo,
        nome: (e.fantasia || e.razao || '').trim() || `Empresa ${e.codigo}`,
      }))
    }
    const set = new Set(allowedFromAuth)
    return todas
      .filter((e) => set.has(e.codigo))
      .map((e) => ({
        codigo: e.codigo,
        nome: (e.fantasia || e.razao || '').trim() || `Empresa ${e.codigo}`,
      }))
  })()

  const [messages, setMessages] = useState<UiChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question || loading) return
      if (!apiKey) {
        setError('Configure sua chave da Anthropic primeiro.')
        return
      }

      setError(null)
      setLoading(true)

      const userMsg: UiChatMessage = {
        id: newId(),
        role: 'user',
        text: question,
        timestamp: new Date().toISOString(),
      }
      setMessages((curr) => [...curr, userMsg])

      const baseHistory: ClaudeMessage[] = []
      const priorMessages = [...messages, userMsg]
      for (const m of priorMessages) {
        if (m.text) baseHistory.push({ role: m.role, content: m.text })
      }

      // Escopo de empresas pra esse turno: SEMPRE all-accessible (livre de filtros).
      // Se whitelist do user existe → usa ela. Master/null → array vazio (no-filter).
      const allowedCodigos = isMaster || allowedFromAuth === null
        ? []
        : accessiblePostos.map((p) => p.codigo)

      const { dataInicial, dataFinal } = currentMonthRange()
      const ctx: ToolContext = { allowedEmpresaCodigos: allowedCodigos, dataInicial, dataFinal }
      const todayISO = new Date().toISOString().slice(0, 10)
      const system = buildSystemPrompt(ctx, todayISO, accessiblePostos)

      const collectedToolCalls: UiChatMessage['toolCalls'] = []

      try {
        let conversation = baseHistory
        let iterations = 0

        while (iterations < MAX_TOOL_ITERATIONS) {
          iterations++

          const response = await sendToClaude({
            apiKey,
            system,
            tools: TOOL_DEFINITIONS,
            messages: conversation,
          })

          if (response.stop_reason === 'end_turn') {
            const finalText = response.content
              .filter((b): b is Extract<ClaudeContentBlock, { type: 'text' }> => b.type === 'text')
              .map((b) => b.text)
              .join('\n')

            const assistantMsg: UiChatMessage = {
              id: newId(),
              role: 'assistant',
              text: finalText || '(resposta vazia do modelo)',
              timestamp: new Date().toISOString(),
              toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
            }
            setMessages((curr) => [...curr, assistantMsg])
            return
          }

          if (response.stop_reason === 'tool_use') {
            const toolUses = response.content.filter(
              (b): b is Extract<ClaudeContentBlock, { type: 'tool_use' }> => b.type === 'tool_use',
            )

            conversation = [
              ...conversation,
              { role: 'assistant', content: response.content },
            ]

            const toolResults = await Promise.all(
              toolUses.map(async (tu) => {
                const start = performance.now()
                try {
                  const result = await executeTool(tu.name, tu.input, ctx)
                  const durationMs = Math.round(performance.now() - start)
                  const rowCount = Array.isArray(result)
                    ? result.length
                    : typeof result === 'object' && result !== null && 'top' in result
                    ? (result as { top?: unknown[] }).top?.length
                    : undefined
                  collectedToolCalls.push({
                    tool: tu.name,
                    args: tu.input,
                    durationMs,
                    rowCount,
                    ok: true,
                  })
                  appendLog({
                    question,
                    tool: tu.name,
                    args: tu.input,
                    durationMs,
                    rowCount,
                    ok: true,
                  })
                  return {
                    type: 'tool_result' as const,
                    tool_use_id: tu.id,
                    content: JSON.stringify(result),
                  }
                } catch (err) {
                  const durationMs = Math.round(performance.now() - start)
                  const message = err instanceof Error ? err.message : String(err)
                  collectedToolCalls.push({
                    tool: tu.name,
                    args: tu.input,
                    durationMs,
                    ok: false,
                    error: message,
                  })
                  appendLog({
                    question,
                    tool: tu.name,
                    args: tu.input,
                    durationMs,
                    ok: false,
                    error: message,
                  })
                  return {
                    type: 'tool_result' as const,
                    tool_use_id: tu.id,
                    content: `Erro: ${message}`,
                    is_error: true,
                  }
                }
              }),
            )

            conversation = [
              ...conversation,
              { role: 'user', content: toolResults },
            ]

            continue
          }

          throw new Error(`Resposta interrompida: ${response.stop_reason}`)
        }

        throw new Error(`Limite de ${MAX_TOOL_ITERATIONS} iterações de tool atingido. Refraseie a pergunta.`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        // Se o erro for de autenticação (401/403/credit), avisa o caller pra
        // marcar a chave como inválida. UI vai mostrar mensagem pro usuário
        // contactar o admin.
        if (isAuthError(err) && onAuthError) {
          onAuthError(message)
        }
        setMessages((curr) => [
          ...curr,
          {
            id: newId(),
            role: 'assistant',
            text: `⚠ **Falha:** ${message}`,
            timestamp: new Date().toISOString(),
            toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [apiKey, loading, messages, allowedFromAuth, isMaster, accessiblePostos, appendLog, onAuthError],
  )

  return {
    messages,
    loading,
    error,
    ask,
    reset,
    accessiblePostosCount: accessiblePostos.length,
  }
}
