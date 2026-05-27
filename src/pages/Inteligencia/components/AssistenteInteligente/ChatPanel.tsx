import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, User, Bot, Wrench, Loader2, RefreshCw, AlertTriangle, ShieldOff, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRedeAssistente } from './hooks/useRedeAssistente'
import { useClaudeChat } from './hooks/useClaudeChat'
import { useUsageTracker } from './ai/usageTracker'
import { SUGGESTED_PROMPTS } from './mockData'
import type { UiChatMessage } from './ai/types'

const renderInline = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <strong key={i} className="font-semibold text-gray-900 dark:text-gray-100">{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

const ToolCallsPill = ({ calls }: { calls: NonNullable<UiChatMessage['toolCalls']> }) => (
  <div className="mt-2 flex flex-wrap gap-1.5">
    {calls.map((c, i) => (
      <span
        key={i}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium',
          c.ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300'
            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300',
        )}
        title={c.ok ? `${c.rowCount ?? '?'} registros · ${c.durationMs}ms` : c.error}
      >
        <Wrench className="h-2.5 w-2.5" />
        {c.tool} · {c.durationMs}ms
      </span>
    ))}
  </div>
)

/**
 * Mensagem fixa quando o Assistente não está disponível pra esta rede.
 * Não há ação que o usuário possa tomar — só o gerente do Visor360 configura.
 */
const UnavailableState = ({ status, errorMessage, redeNome }: { status: string; errorMessage: string | null; redeNome: string | null }) => {
  const messages: Record<string, { title: string; body: string; icon: typeof ShieldOff }> = {
    'sem-rede': {
      title: 'Conecte uma rede primeiro',
      body: 'O Assistente IA só funciona depois que você conectar a uma rede no painel "Selecionar rede".',
      icon: ShieldOff,
    },
    desabilitado: {
      title: 'Assistente desabilitado pra esta rede',
      body: redeNome
        ? `O Assistente IA não está habilitado para ${redeNome}. Fale com o administrador do Visor360 pra liberar.`
        : 'O Assistente IA não está habilitado pra esta rede. Fale com o administrador do Visor360 pra liberar.',
      icon: ShieldOff,
    },
    'sem-chave': {
      title: 'Configuração pendente',
      body: 'O Assistente foi habilitado, mas o administrador ainda precisa configurar a chave de IA. Solicite ao gerente do Visor360.',
      icon: KeyRound,
    },
    invalido: {
      title: 'Chave inválida ou sem saldo',
      body: 'A chave configurada pelo administrador foi rejeitada pela Anthropic. Avise o gerente do Visor360 pra reconfigurar.',
      icon: AlertTriangle,
    },
    erro: {
      title: 'Erro ao ler configuração',
      body: 'Não consegui carregar a configuração desta rede. Tente recarregar a página.',
      icon: AlertTriangle,
    },
    validando: {
      title: 'Verificando configuração…',
      body: 'Confirmando se o Assistente está liberado pra esta rede.',
      icon: Loader2,
    },
  }
  const info = messages[status] ?? messages.erro
  const Icon = info.icon
  const isLoading = status === 'validando'
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className={cn(
        'mb-4 flex h-12 w-12 items-center justify-center rounded-2xl',
        status === 'invalido' || status === 'erro'
          ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
          : status === 'desabilitado'
          ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
      )}>
        <Icon className={cn('h-6 w-6', isLoading && 'animate-spin')} />
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{info.title}</h3>
      <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{info.body}</p>
      {errorMessage && (status === 'invalido' || status === 'erro') && (
        <p className="mt-2 max-w-md rounded-md bg-red-50 px-3 py-1.5 text-[11px] text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {errorMessage}
        </p>
      )}
    </div>
  )
}

const ChatPanel = () => {
  const { apiKey, status, errorMessage, isUsable, redeNome, redeId, limiteUsd, markInvalid } = useRedeAssistente()
  const { messages, loading, error, ask, reset } = useClaudeChat(apiKey, markInvalid)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Subscreve no usage tracker pra mostrar banner quando passar de 80% do limite
  const version = useUsageTracker((s) => s.version)
  const getUsage = useUsageTracker((s) => s.getCurrentMonthUsage)
  void version
  const usage = redeId ? getUsage(redeId) : null
  const usagePct = limiteUsd && limiteUsd > 0 && usage ? (usage.costUsd / limiteUsd) * 100 : null
  const showLimitWarning = usagePct != null && usagePct >= 80

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const send = (text: string) => {
    if (!text.trim() || loading || !isUsable) return
    setInput('')
    void ask(text.trim())
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-[calc(100vh-340px)] min-h-[480px] flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-[#0a0a0a]">
      {/* Status bar — somente leitura, não há config aqui */}
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium',
            status === 'ativo'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300'
              : status === 'validando'
              ? 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
              : status === 'invalido' || status === 'erro'
              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-600/40 dark:bg-red-900/20 dark:text-red-300'
              : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-300',
          )}
        >
          {status === 'ativo' && <><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> Assistente ativo</>}
          {status === 'validando' && <><Loader2 className="h-3 w-3 animate-spin" /> Verificando…</>}
          {status === 'invalido' && <><AlertTriangle className="h-3 w-3" /> Chave inválida</>}
          {status === 'sem-chave' && <><KeyRound className="h-3 w-3" /> Aguardando configuração do admin</>}
          {status === 'desabilitado' && <><ShieldOff className="h-3 w-3" /> Não habilitado</>}
          {status === 'sem-rede' && <><ShieldOff className="h-3 w-3" /> Sem rede conectada</>}
          {status === 'erro' && <><AlertTriangle className="h-3 w-3" /> Erro de configuração</>}
        </div>
        {messages.length > 0 && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title="Nova conversa"
          >
            <RefreshCw className="h-3 w-3" />
            Nova conversa
          </button>
        )}
      </div>

      {/* Banner de alerta de limite (>= 80%) */}
      {showLimitWarning && usage && limiteUsd && (
        <div className={cn(
          'flex items-start gap-2 border-b px-3 py-2',
          usagePct! >= 100
            ? 'border-red-200 bg-red-50 dark:border-red-700/40 dark:bg-red-900/20'
            : 'border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/20',
        )}>
          <AlertTriangle className={cn(
            'mt-0.5 h-3.5 w-3.5 shrink-0',
            usagePct! >= 100 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
          )} />
          <div className={cn(
            'text-[11px]',
            usagePct! >= 100 ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
          )}>
            <strong>{usagePct! >= 100 ? 'Limite atingido' : 'Limite próximo'}:</strong>{' '}
            este navegador já consumiu <strong>{usagePct!.toFixed(0)}%</strong> do limite mensal
            (US$ {usage.costUsd.toFixed(2)} de US$ {limiteUsd.toFixed(2)}).
            {usagePct! >= 100
              ? ' A Anthropic deve estar bloqueando novas chamadas dessa workspace.'
              : ' Avise o administrador se precisar subir de tier.'}
          </div>
        </div>
      )}

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {!isUsable ? (
          <UnavailableState status={status} errorMessage={errorMessage} redeNome={redeNome} />
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
              <Sparkles className="h-6 w-6 text-[#1e3a5f] dark:text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Como posso te ajudar?</h3>
            <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
              Pergunte sobre <strong>faturamento, combustível, frentistas, produtos e operação</strong> da sua rede. Consulto os dados em tempo real.
            </p>
            <p className="mt-2 max-w-md text-[11px] text-gray-400 dark:text-gray-500">
              Respondo apenas sobre dados da sua rede conectada — não atendo perguntas fora da operação.
            </p>
            <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="rounded-lg border border-gray-200 bg-white/60 px-3 py-2 text-left text-xs text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-800/40"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex gap-3', m.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  m.role === 'user'
                    ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                    : 'bg-[#1e3a5f] text-white',
                )}
              >
                {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>
              <div className={cn('flex max-w-[85%] flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'bg-[#1e3a5f] text-white dark:bg-slate-700'
                      : 'border border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200',
                  )}
                >
                  {renderInline(m.text)}
                </div>
                {m.toolCalls && <ToolCallsPill calls={m.toolCalls} />}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e3a5f] text-white">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analisando os dados…
            </div>
          </div>
        )}
      </div>

      {/* Erro inline */}
      {error && !loading && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder={isUsable ? 'Pergunte algo sobre seus dados…' : 'Assistente indisponível nesta rede'}
            rows={1}
            disabled={!isUsable || loading}
            className="min-h-[40px] flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:disabled:bg-gray-800"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || !isUsable}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
              input.trim() && !loading && isUsable
                ? 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]'
                : 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600',
            )}
            title="Enviar (Enter)"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-1.5 text-center text-[10px] text-gray-400 dark:text-gray-500">
          Powered by Claude · Configuração gerenciada pelo administrador do Visor360
        </p>
      </div>
    </div>
  )
}

export default ChatPanel
