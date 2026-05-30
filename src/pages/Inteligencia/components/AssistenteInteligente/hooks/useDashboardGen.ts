import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { sendToClaude } from '../ai/claudeClient'
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from '../ai/tools'
import { buildSystemPrompt } from '../ai/systemPrompt'
import type { ClaudeContentBlock, ClaudeMessage, ClaudeToolDefinition } from '../ai/types'

/** Gráfico final produzido pela IA a partir de dados REAIS das tools. */
export interface DashChart {
  title: string
  type: 'line' | 'bar'
  unidade?: string
  series: Array<{ label: string; value: number }>
}

/** Tool "de saída" — o modelo a chama no fim com o gráfico pronto. Não entra no
 * chat normal; só existe no escopo do gerador de dashboard. */
const RENDER_DASHBOARD_TOOL: ClaudeToolDefinition = {
  name: 'render_dashboard',
  description:
    'Renderiza o gráfico final do painel com os dados REAIS já coletados pelas outras ferramentas. Chame UMA única vez, no fim, com o gráfico pronto. Nunca invente valores.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título curto do gráfico (ex.: "Faturamento por posto · maio").' },
      type: { type: 'string', enum: ['line', 'bar'], description: 'line = evolução/série temporal; bar = comparação/ranking entre itens.' },
      unidade: { type: 'string', description: 'Unidade dos valores: "R$", "L", "%", "un" etc. Opcional.' },
      series: {
        type: 'array',
        description: 'Pontos do gráfico — use nomes reais (postos, meses, produtos). label = eixo X, value = número.',
        items: {
          type: 'object',
          properties: { label: { type: 'string' }, value: { type: 'number' } },
          required: ['label', 'value'],
        },
      },
    },
    required: ['title', 'type', 'series'],
  },
}

const MAX_ITER = 8

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
 * Gera UM gráfico de painel a partir de um prompt em linguagem natural, usando
 * as MESMAS ferramentas de dados do Cadu (faturamento, volume, margem, ranking,
 * financeiro…). O modelo coleta dados reais e devolve a especificação do gráfico
 * via a tool `render_dashboard`. Mesmo escopo de empresas/período do chat.
 */
export const useDashboardGen = (apiKey: string) => {
  const allowedFromAuth = useAuthStore((s) => s.empresaCodigos)
  const isMaster = useAuthStore((s) => s.isMaster)

  const { data: empresasData } = useQuery({
    queryKey: ['assistente-empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 5 * 60 * 1000,
  })

  const accessiblePostos = (() => {
    const todas = empresasData?.resultados ?? []
    const map = (e: { codigo: number; fantasia?: string; razao?: string }) => ({
      codigo: e.codigo,
      nome: (e.fantasia || e.razao || '').trim() || `Empresa ${e.codigo}`,
    })
    if (isMaster || allowedFromAuth === null || allowedFromAuth.length === 0) {
      return todas.map(map)
    }
    const set = new Set(allowedFromAuth)
    return todas.filter((e) => set.has(e.codigo)).map(map)
  })()

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (prompt: string): Promise<DashChart | null> => {
      const question = prompt.trim()
      if (!question) return null
      if (!apiKey) {
        setError('Configuração de IA pendente — fale com o administrador.')
        return null
      }
      setError(null)
      setGenerating(true)

      const allowedCodigos = accessiblePostos.map((p) => p.codigo)
      const { dataInicial, dataFinal } = currentMonthRange()
      const ctx: ToolContext = { allowedEmpresaCodigos: allowedCodigos, dataInicial, dataFinal }
      const todayISO = new Date().toISOString().slice(0, 10)
      const system =
        buildSystemPrompt(ctx, todayISO, accessiblePostos) +
        '\n\n--- MODO PAINEL ---\n' +
        'Você está montando UM gráfico para um painel visual (não é um chat). Use as ferramentas de dados pra obter números REAIS da rede. Quando tiver os dados, chame `render_dashboard` UMA única vez com o gráfico final: título curto, type (line para evolução/série temporal, bar para comparação/ranking), unidade e os pontos usando nomes reais (postos, meses, produtos). NUNCA invente valores — use só o que veio das ferramentas. Se o pedido não puder ser atendido com os dados disponíveis, chame `render_dashboard` mesmo assim com series vazia.'
      const tools = [...TOOL_DEFINITIONS, RENDER_DASHBOARD_TOOL]

      try {
        let conversation: ClaudeMessage[] = [{ role: 'user', content: question }]

        for (let i = 0; i < MAX_ITER; i++) {
          const response = await sendToClaude({ apiKey, system, tools, messages: conversation })

          if (response.stop_reason === 'tool_use') {
            const toolUses = response.content.filter(
              (b): b is Extract<ClaudeContentBlock, { type: 'tool_use' }> => b.type === 'tool_use',
            )

            // Se o modelo chamou render_dashboard, capturamos o gráfico e encerramos.
            const render = toolUses.find((t) => t.name === 'render_dashboard')
            if (render) {
              const spec = render.input as Partial<DashChart>
              const series = Array.isArray(spec.series)
                ? spec.series.filter((p) => p && typeof p.label === 'string' && typeof p.value === 'number')
                : []
              return {
                title: typeof spec.title === 'string' && spec.title ? spec.title : question.slice(0, 60),
                type: spec.type === 'bar' ? 'bar' : 'line',
                unidade: typeof spec.unidade === 'string' ? spec.unidade : undefined,
                series,
              }
            }

            conversation = [...conversation, { role: 'assistant', content: response.content }]
            const toolResults = await Promise.all(
              toolUses.map(async (tu) => {
                try {
                  const result = await executeTool(tu.name, tu.input, ctx)
                  return { type: 'tool_result' as const, tool_use_id: tu.id, content: JSON.stringify(result) }
                } catch (err) {
                  const message = err instanceof Error ? err.message : String(err)
                  return { type: 'tool_result' as const, tool_use_id: tu.id, content: `Erro: ${message}`, is_error: true }
                }
              }),
            )
            conversation = [...conversation, { role: 'user', content: toolResults }]
            continue
          }

          if (response.stop_reason === 'end_turn') {
            throw new Error('O modelo não conseguiu montar o gráfico. Tente reformular o pedido.')
          }
          throw new Error(`Resposta interrompida: ${response.stop_reason}`)
        }

        throw new Error('Limite de iterações atingido — refraseie o pedido.')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return null
      } finally {
        setGenerating(false)
      }
    },
    [apiKey, accessiblePostos],
  )

  return { generate, generating, error }
}
