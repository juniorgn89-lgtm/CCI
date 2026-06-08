import { useState } from 'react'
import { Wrench, CheckCircle2, XCircle, Clock, Database, Shield, Search, Trash2, DollarSign, AlertTriangle, RotateCcw, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToolCallLog } from './ai/toolCallLog'
import { useUsageTracker, INPUT_PRICE_USD_PER_MTOK, OUTPUT_PRICE_USD_PER_MTOK } from './ai/usageTracker'
import { useRedeAssistente } from './hooks/useRedeAssistente'

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * Em vez de "Monitor SQL", o Visor360 usa Quality API (REST). Esta tela mostra
 * as TOOL CALLS que a IA executou — qual ferramenta (= endpoint+agregação)
 * ela invocou, com quais argumentos, quanto tempo demorou, quantos registros
 * voltou. Mesmo papel auditorial do Monitor SQL.
 *
 * Lê do store useToolCallLog que é alimentado pelo useClaudeChat em tempo real.
 */
const MonitorPanel = () => {
  const entries = useToolCallLog((s) => s.entries)
  const clear = useToolCallLog((s) => s.clear)
  const [query, setQuery] = useState('')

  const filtered = entries.filter(
    (c) => !query || c.tool.toLowerCase().includes(query.toLowerCase()) || c.question.toLowerCase().includes(query.toLowerCase()),
  )

  const totalCalls = entries.length
  const okCalls = entries.filter((e) => e.ok).length
  const avgDuration = entries.length > 0
    ? Math.round(entries.reduce((s, c) => s + c.durationMs, 0) / entries.length)
    : 0
  const totalRows = entries.reduce((s, c) => s + (c.rowCount ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Banner de segurança */}
      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/40">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
        <div>
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            Camada READ-ONLY
          </p>
          <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">
            A IA só pode invocar ferramentas que fazem GET no Quality API. Não há acesso direto a SQL nem operações de escrita
            (DELETE/UPDATE/DROP/ALTER) — a arquitetura do Visor360 não expõe esses caminhos.
          </p>
        </div>
      </div>

      {/* Consumo do mês */}
      <UsageCard />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/60">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Wrench className="h-3 w-3" />
            Total
          </div>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{totalCalls}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/60">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <CheckCircle2 className="h-3 w-3" />
            Sucesso
          </div>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{okCalls}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/60">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Clock className="h-3 w-3" />
            Tempo médio
          </div>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{avgDuration}<span className="ml-1 text-sm font-normal text-gray-400">ms</span></p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/60">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Database className="h-3 w-3" />
            Registros
          </div>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{totalRows}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por ferramenta ou pergunta…"
            className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        {entries.length > 0 && (
          <button
            onClick={clear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Trash2 className="h-3 w-3" />
            Limpar histórico
          </button>
        )}
      </div>

      {/* Tabela de logs */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/60">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Ferramenta / Argumentos</th>
              <th className="px-3 py-2 text-left font-medium">Pergunta</th>
              <th className="px-3 py-2 text-right font-medium">Tempo</th>
              <th className="px-3 py-2 text-right font-medium">Registros</th>
              <th className="px-3 py-2 text-left font-medium">Quando</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                <td className="px-3 py-2">
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                    c.ok
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                  )}>
                    {c.ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                    {c.ok ? 'OK' : 'Erro'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <p className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">{c.tool}</p>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-gray-500 dark:text-gray-400">
                    {Object.keys(c.args).length === 0
                      ? '(sem args)'
                      : Object.entries(c.args)
                          .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
                          .join(' · ')}
                  </p>
                  {!c.ok && c.error && (
                    <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">⚠ {c.error}</p>
                  )}
                </td>
                <td className="max-w-xs truncate px-3 py-2 text-xs text-gray-600 dark:text-gray-400" title={c.question}>
                  "{c.question}"
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-700 dark:text-gray-300">
                  {c.durationMs} ms
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-700 dark:text-gray-300">
                  {c.rowCount ?? '—'}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(c.timestamp)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">
                  {entries.length === 0
                    ? 'Nenhuma chamada ainda. Use o Chat pra começar.'
                    : 'Nenhuma chamada encontrada com esse filtro.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const fmtUSD = (n: number, dec = 2) =>
  `US$ ${n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`

const fmtInt = (n: number) => n.toLocaleString('pt-BR')

/**
 * Card de consumo do mês — gasto local (deste navegador) versus limite
 * configurado pelo admin pra essa rede. NÃO é o total real da workspace
 * na Anthropic (outros usuários/navegadores não contam). É só um aviso
 * preventivo pro usuário.
 */
const UsageCard = () => {
  const { redeId, redeNome, limiteUsd, tier } = useRedeAssistente()
  // Subscreve no version pra re-renderizar quando recordUsage rodar
  const version = useUsageTracker((s) => s.version)
  const getUsage = useUsageTracker((s) => s.getCurrentMonthUsage)
  const resetMonth = useUsageTracker((s) => s.resetMonth)

  if (!redeId) return null
  // version usado só pra forçar dependency da subscription
  void version
  const usage = getUsage(redeId)
  const pct = limiteUsd && limiteUsd > 0 ? (usage.costUsd / limiteUsd) * 100 : null

  const tone: 'ok' | 'alerta' | 'critico' = pct == null
    ? 'ok'
    : pct >= 80 ? 'critico' : pct >= 50 ? 'alerta' : 'ok'

  const barColor =
    tone === 'critico' ? 'bg-red-500' : tone === 'alerta' ? 'bg-amber-500' : 'bg-[#1e3a5f] dark:bg-slate-500'

  const tipoLabel = tier === 'custom' ? 'Custom' : tier.charAt(0).toUpperCase() + tier.slice(1)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Consumo deste mês {redeNome && <span className="font-normal text-gray-500">· {redeNome}</span>}
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            Tier <strong>{tipoLabel}</strong> · Período {usage.month} · Rastreio local deste navegador
          </p>
        </div>
        <button
          onClick={() => resetMonth(redeId)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          title="Zerar contador local (não afeta cobrança real na Anthropic)"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          Zerar local
        </button>
      </div>

      {/* Barra + valores */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-mono text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {fmtUSD(usage.costUsd, 3)}
          </p>
          {limiteUsd != null && (
            <p className="font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">
              de {fmtUSD(limiteUsd)} <span className={cn(
                'ml-1 font-semibold',
                tone === 'critico' ? 'text-red-600 dark:text-red-400'
                  : tone === 'alerta' ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-600 dark:text-gray-400',
              )}>
                ({pct?.toFixed(0)}%)
              </span>
            </p>
          )}
        </div>
        {limiteUsd != null && pct != null && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Stats secundárias */}
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-gray-200 pt-3 text-xs dark:border-gray-700">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Perguntas</p>
          <p className="font-mono font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmtInt(usage.questionsCount)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Input</p>
          <p className="font-mono font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {fmtInt(usage.inputTokens)} <span className="text-[10px] font-normal text-gray-400">tok</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Output</p>
          <p className="font-mono font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {fmtInt(usage.outputTokens)} <span className="text-[10px] font-normal text-gray-400">tok</span>
          </p>
        </div>
      </div>

      {/* Aviso */}
      {tone === 'critico' && limiteUsd != null && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-700/40 dark:bg-red-900/20">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="text-[11px] text-red-700 dark:text-red-300">
            <strong>Atenção:</strong> este navegador já consumiu {pct?.toFixed(0)}% do limite mensal de {fmtUSD(limiteUsd)}.
            Quando bater 100%, a Anthropic bloqueia novas chamadas até o próximo mês.
          </div>
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[10px] text-gray-400">
        <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0" />
        <span>
          Rastreio local — outros usuários/navegadores da mesma rede consomem o mesmo limite mas não aparecem aqui.
          Fonte oficial:{' '}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gray-600 underline hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
          >
            console.anthropic.com → Analytics
            <ExternalLink className="ml-0.5 inline h-2 w-2" />
          </a>
          {' '}· Preços: input {fmtUSD(INPUT_PRICE_USD_PER_MTOK)}/MTok · output {fmtUSD(OUTPUT_PRICE_USD_PER_MTOK)}/MTok
        </span>
      </p>
    </div>
  )
}

export default MonitorPanel
