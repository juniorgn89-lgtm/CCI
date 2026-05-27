import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  ArrowLeft,
  Edit3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Info,
  TrendingUp,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { fetchRedes, updateAssistenteConfig, type RedeRow, type AssistenteTier } from '@/api/supabase/redes'
import { validateApiKey } from '@/pages/Inteligencia/components/AssistenteInteligente/ai/claudeClient'
import { cn } from '@/lib/utils'

/**
 * Painel administrativo pro gerente do Visor360 configurar o Assistente IA
 * por rede (cliente). Lista todas as redes com config atual + tabela de
 * referência de tiers/custos. Edição por modal.
 *
 * IMPORTANTE: os campos aqui são INFORMACIONAIS. A chave da API e o spend
 * limit REAL ficam configurados no console.anthropic.com via workspaces.
 * Este painel é a fonte de verdade do gerente pra: qual rede está habilitada,
 * qual tier escolheu, quanto pode gastar, contato do responsável.
 */

// Tabela de referência: custos e sugestões de cobrança por tier.
// Câmbio referência (atualizar quando variar > 10%).
const USD_BRL = 5.5

interface TierConfig {
  key: AssistenteTier
  label: string
  perfil: string
  perguntasDia: string
  limiteUsd: number
  margem3x: number
  margem5x: number
}

const TIERS: TierConfig[] = [
  {
    key: 'light',
    label: 'Light',
    perfil: 'Gerente consulta 1–2x/dia',
    perguntasDia: '~20',
    limiteUsd: 15,
    margem3x: 240,
    margem5x: 400,
  },
  {
    key: 'medium',
    label: 'Medium',
    perfil: 'Operação ativa, múltiplos usuários',
    perguntasDia: '~50',
    limiteUsd: 40,
    margem3x: 660,
    margem5x: 1100,
  },
  {
    key: 'heavy',
    label: 'Heavy',
    perfil: 'Multi-usuário, consulta constante',
    perguntasDia: '100+',
    limiteUsd: 120,
    margem3x: 1950,
    margem5x: 3250,
  },
  {
    key: 'custom',
    label: 'Custom',
    perfil: 'Limite manual definido pelo gerente',
    perguntasDia: '—',
    limiteUsd: 0,
    margem3x: 0,
    margem5x: 0,
  },
]

const tierStyle: Record<AssistenteTier, string> = {
  light: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40',
  heavy: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/40',
  custom: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
}

const fmtBRL = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
const fmtUSD = (n: number) => `US$ ${n.toLocaleString('en-US')}`

/**
 * Extrai mensagem legível de qualquer erro — Error nativo, PostgrestError do
 * Supabase, ou objeto genérico. Sem isso, erros do Supabase viram
 * "[object Object]" quando passados pra String().
 */
const extractErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>
    // PostgrestError: { message, details, hint, code }
    if (typeof obj.message === 'string' && obj.message) {
      const parts = [obj.message]
      if (typeof obj.details === 'string' && obj.details) parts.push(`(${obj.details})`)
      if (typeof obj.code === 'string' && obj.code) parts.push(`[${obj.code}]`)
      return parts.join(' ')
    }
    try {
      return JSON.stringify(e)
    } catch {
      return String(e)
    }
  }
  return String(e)
}

const AssistenteConfig = () => {
  const queryClient = useQueryClient()
  const { data: redes = [], isLoading, error } = useQuery({
    queryKey: ['redes'],
    queryFn: fetchRedes,
    staleTime: 60_000,
  })

  const [editingRede, setEditingRede] = useState<RedeRow | null>(null)

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['redes'] })
    setEditingRede(null)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/selecionar-rede"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          title="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg shadow-purple-500/30">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">Assistente IA · Configuração por rede</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Defina tier, limite mensal e contato responsável pra cada cliente.
          </p>
        </div>
      </div>

      {/* Tabela de referência: tiers + custos + sugestão de cobrança */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Tiers de uso · Custos e sugestão de cobrança</h2>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Referência: <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">claude-sonnet-4-5</code> · Input US$ 3 · Output US$ 15 por 1M tokens · Câmbio referência R$ {USD_BRL.toFixed(2)}/USD
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Tier</th>
                <th className="px-3 py-2 text-left font-medium">Perfil</th>
                <th className="px-3 py-2 text-right font-medium">Perg./dia</th>
                <th className="px-3 py-2 text-right font-medium">Limite (US$)</th>
                <th className="px-3 py-2 text-right font-medium">Limite (R$)</th>
                <th className="px-3 py-2 text-right font-medium">Cobrar 3x</th>
                <th className="px-3 py-2 text-right font-medium">Cobrar 5x</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {TIERS.filter((t) => t.key !== 'custom').map((t) => (
                <tr key={t.key}>
                  <td className="px-3 py-2">
                    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider', tierStyle[t.key])}>
                      {t.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">{t.perfil}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-700 dark:text-gray-300">{t.perguntasDia}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmtUSD(t.limiteUsd)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-700 dark:text-gray-300">{fmtBRL(t.limiteUsd * USD_BRL)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">{fmtBRL(t.margem3x)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtBRL(t.margem5x)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-200 px-4 py-2 dark:border-gray-700">
          <p className="flex items-start gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              Spend limit real é configurado no <a href="https://console.anthropic.com/settings/workspaces" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline dark:text-purple-400">console.anthropic.com/workspaces<ExternalLink className="ml-0.5 inline h-2.5 w-2.5" /></a>. Aqui é registro/planejamento.
            </span>
          </p>
        </div>
      </section>

      {/* Lista de redes com config atual */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Redes cadastradas</h2>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
            <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Carregando…</p>
          </div>
        ) : redes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma rede cadastrada.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Rede</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Tier</th>
                  <th className="px-3 py-2 text-right font-medium">Limite mensal</th>
                  <th className="px-3 py-2 text-left font-medium">Contato</th>
                  <th className="px-3 py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {redes.map((rede) => {
                  const enabled = !!rede.assistente_habilitado
                  const tier = (rede.assistente_tier ?? 'light') as AssistenteTier
                  const limiteUsd = rede.assistente_limite_mensal_usd ?? null
                  return (
                    <tr key={rede.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                      <td className="px-3 py-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{rede.nome}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {rede.ativo ? 'Rede ativa' : 'Rede inativa'}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                          enabled
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                        )}>
                          {enabled ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                          {enabled ? 'Habilitado' : 'Desabilitado'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {enabled ? (
                            <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', tierStyle[tier])}>
                              {TIERS.find((t) => t.key === tier)?.label ?? tier}
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-400">—</span>
                          )}
                          {rede.assistente_chave_anthropic ? (
                            <span title="Chave Anthropic configurada" className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              <KeyRound className="h-2 w-2" />
                              chave
                            </span>
                          ) : enabled && (
                            <span title="Sem chave configurada" className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              sem chave
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-gray-700 dark:text-gray-300">
                        {enabled && limiteUsd != null ? (
                          <>
                            {fmtUSD(limiteUsd)}
                            <span className="ml-1 text-[10px] text-gray-400">/ {fmtBRL(limiteUsd * USD_BRL)}</span>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
                        {rede.assistente_contato_email || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setEditingRede(rede)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <Edit3 className="h-3 w-3" />
                          Configurar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Aviso geral */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-700/40 dark:bg-blue-900/20">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-[11px] text-blue-700 dark:text-blue-300">
          <strong>Como funciona:</strong> esta tela registra a <em>política</em> de cada rede (tier escolhido, limite previsto, responsável).
          O controle real de gasto é feito por <strong>workspaces na Anthropic</strong> (1 workspace por rede).
          A chave de API continua sendo configurada pelo usuário final no próprio módulo do Assistente.
        </div>
      </div>

      <ConfigModal rede={editingRede} onClose={() => setEditingRede(null)} onSaved={handleSaved} />
    </div>
  )
}

interface ConfigModalProps {
  rede: RedeRow | null
  onClose: () => void
  onSaved: () => void
}

const ConfigModal = ({ rede, onClose, onSaved }: ConfigModalProps) => {
  const [habilitado, setHabilitado] = useState(rede?.assistente_habilitado ?? false)
  const [tier, setTier] = useState<AssistenteTier>((rede?.assistente_tier ?? 'light') as AssistenteTier)
  const [limiteUsd, setLimiteUsd] = useState<string>(
    String(rede?.assistente_limite_mensal_usd ?? TIERS.find((t) => t.key === 'light')?.limiteUsd ?? 15),
  )
  const [contato, setContato] = useState(rede?.assistente_contato_email ?? '')
  const [workspaceId, setWorkspaceId] = useState(rede?.assistente_workspace_id ?? '')
  const [observacoes, setObservacoes] = useState(rede?.assistente_observacoes ?? '')
  const [chaveAnthropic, setChaveAnthropic] = useState(rede?.assistente_chave_anthropic ?? '')
  const [showChave, setShowChave] = useState(false)
  const [testando, setTestando] = useState(false)
  const [resultadoTeste, setResultadoTeste] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state quando troca de rede
  const stateKey = rede?.id ?? null
  const [prevKey, setPrevKey] = useState<string | null>(null)
  if (rede && prevKey !== stateKey) {
    setPrevKey(stateKey)
    setHabilitado(rede.assistente_habilitado ?? false)
    setTier((rede.assistente_tier ?? 'light') as AssistenteTier)
    setLimiteUsd(String(rede.assistente_limite_mensal_usd ?? TIERS.find((t) => t.key === 'light')?.limiteUsd ?? 15))
    setContato(rede.assistente_contato_email ?? '')
    setWorkspaceId(rede.assistente_workspace_id ?? '')
    setObservacoes(rede.assistente_observacoes ?? '')
    setChaveAnthropic(rede.assistente_chave_anthropic ?? '')
    setShowChave(false)
    setResultadoTeste(null)
    setError(null)
  }

  const testarChave = async () => {
    if (!chaveAnthropic.trim()) return
    setTestando(true)
    setResultadoTeste(null)
    try {
      const result = await validateApiKey(chaveAnthropic.trim())
      setResultadoTeste({
        ok: result.ok,
        msg: result.ok ? 'Chave válida e com saldo na Anthropic.' : (result.errorMessage ?? `HTTP ${result.status ?? '?'}`),
      })
    } finally {
      setTestando(false)
    }
  }

  if (!rede) return null

  const applyTierDefault = (t: AssistenteTier) => {
    setTier(t)
    const ref = TIERS.find((x) => x.key === t)
    if (ref && t !== 'custom') {
      setLimiteUsd(String(ref.limiteUsd))
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const limite = parseFloat(limiteUsd.replace(',', '.'))
      await updateAssistenteConfig(rede.id, {
        assistente_habilitado: habilitado,
        assistente_tier: tier,
        assistente_limite_mensal_usd: isFinite(limite) ? limite : null,
        assistente_contato_email: contato.trim() || null,
        assistente_workspace_id: workspaceId.trim() || null,
        assistente_observacoes: observacoes.trim() || null,
        assistente_chave_anthropic: chaveAnthropic.trim() || null,
      })
      onSaved()
    } catch (e) {
      setError(extractErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!rede} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Configurar Assistente — {rede.nome}
          </DialogTitle>
          <DialogDescription>
            Defina como esta rede pode usar o Assistente IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle habilitado */}
          <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Habilitar Assistente IA</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Quando desabilitado, usuários dessa rede não veem a aba.
              </p>
            </div>
            <input
              type="checkbox"
              checked={habilitado}
              onChange={(e) => setHabilitado(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-purple-500"
            />
          </label>

          {/* Tier */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Tier</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {TIERS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => applyTierDefault(t.key)}
                  disabled={!habilitado}
                  className={cn(
                    'rounded-lg border p-2 text-left text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50',
                    tier === t.key
                      ? cn('ring-2 ring-purple-400 dark:ring-purple-500/60', tierStyle[t.key])
                      : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900',
                  )}
                >
                  <p className="font-bold uppercase tracking-wider">{t.label}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{t.perfil}</p>
                  {t.key !== 'custom' && (
                    <p className="mt-1 font-mono text-[10px] font-semibold">{fmtUSD(t.limiteUsd)} / mês</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Chave Anthropic */}
          <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3 dark:border-purple-700/40 dark:bg-purple-900/10">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-purple-900 dark:text-purple-200">
              <KeyRound className="h-3 w-3" />
              Chave da Anthropic (gerenciada por você)
            </label>
            <p className="mt-0.5 text-[10px] text-purple-700/80 dark:text-purple-300/80">
              Esta chave fica armazenada por rede. Os usuários finais não a configuram — só usam.
            </p>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showChave ? 'text' : 'password'}
                  value={chaveAnthropic}
                  onChange={(e) => { setChaveAnthropic(e.target.value); setResultadoTeste(null) }}
                  placeholder="sk-ant-api03-…"
                  disabled={!habilitado}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 font-mono text-xs focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setShowChave((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title={showChave ? 'Ocultar' : 'Mostrar'}
                >
                  {showChave ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={testarChave}
                disabled={!chaveAnthropic.trim() || testando || !habilitado}
                className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50 dark:border-purple-700/40 dark:bg-gray-900 dark:text-purple-300 dark:hover:bg-purple-900/20"
              >
                {testando ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Testar
              </button>
            </div>
            {resultadoTeste && (
              <p className={cn(
                'mt-2 rounded-md px-2 py-1 text-[11px]',
                resultadoTeste.ok
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
              )}>
                {resultadoTeste.ok ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : <AlertCircle className="mr-1 inline h-3 w-3" />}
                {resultadoTeste.msg}
              </p>
            )}
          </div>

          {/* Limite mensal */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Limite mensal (US$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={limiteUsd}
              onChange={(e) => setLimiteUsd(e.target.value)}
              disabled={!habilitado}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 disabled:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800"
            />
            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              Em R$ ≈ {fmtBRL((parseFloat(limiteUsd) || 0) * USD_BRL)} (câmbio referência R$ {USD_BRL}/USD)
            </p>
          </div>

          {/* Contato */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Email do responsável
            </label>
            <input
              type="email"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              placeholder="contato@cliente.com.br"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Workspace ID */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Workspace ID na Anthropic (opcional)
            </label>
            <input
              type="text"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              placeholder="wrk_..."
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              Pra rastrear qual workspace na Anthropic foi criado pra essa rede.
            </p>
          </div>

          {/* Observações */}
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Ex: cliente piloto, free trial até 30/06, etc."
              className="mt-1 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-700/40 dark:bg-red-900/20">
              <p className="flex items-start gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                Não consegui salvar
              </p>
              <p className="mt-1 break-words text-[11px] text-red-700 dark:text-red-300">{error}</p>
              {/column .* does not exist|coluna .* não existe/i.test(error) && (
                <p className="mt-2 rounded bg-red-100 px-2 py-1 text-[10px] text-red-800 dark:bg-red-900/40 dark:text-red-200">
                  <strong>Dica:</strong> rode a migration <code>docs/supabase-assistente-config.sql</code> no Supabase Studio antes de salvar — as colunas do Assistente ainda não existem na tabela <code>redes</code>.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 px-4 py-2 text-sm font-medium text-white shadow-md shadow-purple-500/30 hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AssistenteConfig
