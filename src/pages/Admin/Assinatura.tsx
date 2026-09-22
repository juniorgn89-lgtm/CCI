import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Wrench, CreditCard, KeyRound, Phone, MessageCircle, Save, Loader2,
  AlertTriangle, CheckCircle2, ShieldAlert, ExternalLink,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { fetchAppConfig, updateAppConfig, type AppConfigPatch } from '@/api/supabase/appConfig'
import { ASSINATURA_DEFAULTS } from '@/pages/Landing/assinatura'

/**
 * Painel → Assinatura (master): edita a config GLOBAL da tela pública de
 * assinatura — modo manutenção, links de pagamento do Stripe, chave publicável
 * e contatos do WebPosto. Grava em `app_config` (ver docs/supabase-app-config.sql).
 */

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500'
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400'
const cardCls = 'rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900'

interface FormState {
  assinatura_manutencao: boolean
  assinatura_manutencao_msg: string
  stripe_link_base: string
  stripe_link_ia: string
  stripe_pk: string
  webposto_telefone: string
  webposto_whatsapp: string
  webposto_mensagem: string
}

const EMPTY: FormState = {
  assinatura_manutencao: false,
  assinatura_manutencao_msg: ASSINATURA_DEFAULTS.manutencaoMsg,
  stripe_link_base: '',
  stripe_link_ia: '',
  stripe_pk: '',
  webposto_telefone: '',
  webposto_whatsapp: '',
  webposto_mensagem: ASSINATURA_DEFAULTS.whatsappMsg,
}

const Assinatura = () => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['app-config'], queryFn: fetchAppConfig })
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!data) return
    setForm({
      assinatura_manutencao: data.assinatura_manutencao,
      assinatura_manutencao_msg: data.assinatura_manutencao_msg || ASSINATURA_DEFAULTS.manutencaoMsg,
      stripe_link_base: data.stripe_link_base,
      stripe_link_ia: data.stripe_link_ia,
      stripe_pk: data.stripe_pk,
      webposto_telefone: data.webposto_telefone,
      webposto_whatsapp: data.webposto_whatsapp,
      webposto_mensagem: data.webposto_mensagem || ASSINATURA_DEFAULTS.whatsappMsg,
    })
  }, [data])

  if (!isMaster) return <Navigate to="/dashboard" replace />

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setSavedAt(null)
  }

  // Segurança: a tabela é lida publicamente → só a chave PUBLICÁVEL (pk_) pode
  // entrar. Bloqueia qualquer coisa que pareça secreta (sk_/rk_).
  const pk = form.stripe_pk.trim()
  const pkPerigosa = /^(sk_|rk_)/i.test(pk)
  const pkInvalida = pk.length > 0 && !pk.startsWith('pk_')

  const salvar = async () => {
    if (saving || pkPerigosa) return
    setSaving(true)
    setError(null)
    try {
      const patch: AppConfigPatch = {
        assinatura_manutencao: form.assinatura_manutencao,
        assinatura_manutencao_msg: form.assinatura_manutencao_msg.trim(),
        stripe_link_base: form.stripe_link_base.trim(),
        stripe_link_ia: form.stripe_link_ia.trim(),
        stripe_pk: pk,
        webposto_telefone: form.webposto_telefone.trim(),
        webposto_whatsapp: form.webposto_whatsapp.replace(/\D/g, ''),
        webposto_mensagem: form.webposto_mensagem.trim(),
      }
      await updateAppConfig(patch)
      await queryClient.invalidateQueries({ queryKey: ['app-config'] })
      setSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar. Verifique se você é master (RLS).')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Assinatura</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">Configuração da tela pública de contratação — links de pagamento, contatos e manutenção.</p>
      </div>

      {/* Manutenção */}
      <div className={cardCls}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"><Wrench className="h-[18px] w-[18px]" /></span>
          <div className="min-w-0 flex-1">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">Modo manutenção</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">Esconde o checkout e mostra um aviso na tela de assinatura.</span>
              </span>
              <input
                type="checkbox"
                checked={form.assinatura_manutencao}
                onChange={(e) => set('assinatura_manutencao', e.target.checked)}
                className="h-5 w-5 shrink-0 rounded border-gray-300 accent-[#1e3a5f]"
              />
            </label>
            {form.assinatura_manutencao && (
              <div className="mt-3">
                <label className={labelCls}>Mensagem exibida</label>
                <textarea
                  rows={2}
                  value={form.assinatura_manutencao_msg}
                  onChange={(e) => set('assinatura_manutencao_msg', e.target.value)}
                  className={`mt-1 ${inputCls} resize-none`}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stripe */}
      <div className={cardCls}>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"><CreditCard className="h-4 w-4" /></span>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Stripe · pagamento</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Payment Link — Plano base (R$ 199,99/mês)</label>
            <input value={form.stripe_link_base} onChange={(e) => set('stripe_link_base', e.target.value)} placeholder="https://buy.stripe.com/..." className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className={labelCls}>Payment Link — Plano + Analista de IA (R$ 269,99/mês)</label>
            <input value={form.stripe_link_ia} onChange={(e) => set('stripe_link_ia', e.target.value)} placeholder="https://buy.stripe.com/..." className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className={labelCls}>Chave publicável do Stripe (pk_…)</label>
            <input value={form.stripe_pk} onChange={(e) => set('stripe_pk', e.target.value)} placeholder="pk_live_... ou pk_test_..." className={`mt-1 ${inputCls}`} />
            {pkPerigosa ? (
              <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700 dark:bg-red-900/20 dark:text-red-300">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Isso parece uma chave <strong>SECRETA</strong> (sk_/rk_). Ela NUNCA pode ficar aqui — esta config é lida publicamente e vazaria. Use só a publicável (pk_).
              </p>
            ) : pkInvalida ? (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">A chave publicável começa com <strong>pk_</strong>. Confira.</p>
            ) : (
              <p className="mt-1.5 text-[11px] text-gray-400">Opcional. Só a publicável (pk_) — a secreta (sk_) nunca entra aqui.</p>
            )}
          </div>
        </div>
      </div>

      {/* WebPosto */}
      <div className={cardCls}>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400"><KeyRound className="h-4 w-4" /></span>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">WebPosto · contatos para a chave de API</h2>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}><Phone className="mr-1 inline h-3 w-3" />Telefone</label>
              <input value={form.webposto_telefone} onChange={(e) => set('webposto_telefone', e.target.value)} placeholder="(27) 3000-0000" className={`mt-1 ${inputCls}`} />
            </div>
            <div>
              <label className={labelCls}><MessageCircle className="mr-1 inline h-3 w-3" />WhatsApp (com DDI, só dígitos)</label>
              <input value={form.webposto_whatsapp} onChange={(e) => set('webposto_whatsapp', e.target.value)} placeholder="5527999999999" className={`mt-1 ${inputCls}`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Mensagem pronta do WhatsApp</label>
            <textarea rows={2} value={form.webposto_mensagem} onChange={(e) => set('webposto_mensagem', e.target.value)} className={`mt-1 ${inputCls} resize-none`} />
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={saving || pkPerigosa}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#162d4a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configuração
        </button>
        <a href="/como-comecar" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0F766E] hover:underline">
          Ver a tela pública <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {savedAt && !error && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Salvo!</span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}
    </div>
  )
}

export default Assinatura
