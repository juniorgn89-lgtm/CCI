import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound, X, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { useTenantStore } from '@/store/tenant'
import { updateRede } from '@/api/supabase/redes'

/**
 * Onboarding da chave de API (1º acesso).
 *
 * Assim que o cliente entra e a rede dele ainda NÃO tem a `chave` (CHAVE de
 * integração do WebPosto/Quality), este modal é a primeira coisa que aparece:
 * "Informe a chave de API para começar a usar o Visor360". Ao salvar, grava em
 * `redes.chave` (via updateRede) e atualiza o tenant — o app passa a puxar os
 * dados na hora. Some sozinho quando a chave está preenchida.
 *
 * Dispensável (X) pra não travar quem só está navegando (ex.: master em rede de
 * demonstração), mas reaparece no próximo carregamento enquanto faltar a chave.
 */
const ChaveApiOnboarding = () => {
  const rede = useTenantStore((s) => s.rede)
  const setRede = useTenantStore((s) => s.setRede)
  const queryClient = useQueryClient()

  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // Só aparece quando há rede conectada e ela ainda não tem CHAVE.
  if (!rede || rede.chave?.trim() || dismissed) return null

  const salvar = async () => {
    const chave = value.trim()
    if (!chave || saving) return
    setSaving(true)
    setError(null)
    try {
      await updateRede(rede.id, { chave })
      // Atualiza o tenant → o client interceptor passa a enviar a nova CHAVE.
      setRede({ ...rede, chave })
      // Recarrega tudo que estava vazio por falta de chave.
      queryClient.invalidateQueries()
    } catch (e) {
      setError(
        e instanceof Error
          ? `Não consegui salvar: ${e.message}. Se persistir, peça ao administrador.`
          : 'Não consegui salvar a chave. Tente de novo ou peça ao administrador.',
      )
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Header */}
        <div className="relative bg-[#1e3a5f] px-6 py-5 text-white">
          <button
            onClick={() => setDismissed(true)}
            aria-label="Fechar"
            className="absolute right-3 top-3 rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <KeyRound className="h-5 w-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight">Informe a chave de API</h2>
              <p className="text-xs text-white/70">para começar a usar o Visor360</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            Cole abaixo a <strong>chave de integração (API)</strong> do WebPosto (Quality) da rede{' '}
            <strong>{rede.nome}</strong>. É ela que conecta o Visor360 aos seus dados.
          </p>

          <label className="mt-4 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Chave de API (CHAVE)
          </label>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') salvar()
            }}
            placeholder="Cole aqui a chave fornecida pelo WebPosto"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          />

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            Ainda não tem a chave? Solicite ao WebPosto (Quality) — ou fale com a CCI em comercial@cci.app.br.
          </div>

          <button
            onClick={salvar}
            disabled={!value.trim() || saving}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#162d4a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {saving ? 'Conectando…' : 'Salvar e conectar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChaveApiOnboarding
