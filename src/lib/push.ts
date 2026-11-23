/**
 * Avisos no celular (Web Push): ligar/desligar NESTE aparelho.
 * A inscrição do navegador fica no banco (push_inscricoes) via RPC; quem envia é a
 * Edge Function `notificacoes`. No iPhone só funciona com o app instalado na Tela
 * de Início (iOS 16.4+). Mesmo desenho do NotaOK.
 */
import { supabase } from '@/lib/supabase'

export type EstadoPush = 'indisponivel' | 'bloqueada' | 'ligada' | 'desligada'

// Quem ligou neste aparelho: outro login no mesmo aparelho precisa ligar de novo.
const CHAVE_DONO = 'visor360_push_dono'
const dono = () => { try { return localStorage.getItem(CHAVE_DONO) || '' } catch { return '' } }
const marcarDono = (id: string) => { try { if (id) localStorage.setItem(CHAVE_DONO, id); else localStorage.removeItem(CHAVE_DONO) } catch { /* ignore */ } }

export const ehIphone = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
export const suportado = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
/** iPhone fora do app instalado: precisa instalar primeiro. */
export const precisaInstalar = () => ehIphone() && !instalado()

const registro = async () => (('serviceWorker' in navigator) ? (await navigator.serviceWorker.getRegistration()) ?? null : null)

export async function estado(userId?: string | null): Promise<EstadoPush> {
  if (!suportado()) return 'indisponivel'
  if (Notification.permission === 'denied') return 'bloqueada'
  const sub = await (await registro())?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' && (!userId || dono() === userId) ? 'ligada' : 'desligada'
}

const base64ParaBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const bruto = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0))
}
const nomeAparelho = () => {
  const ua = navigator.userAgent
  const so = /Android/.test(ua) ? 'Android' : ehIphone() ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Outro'
  const nav = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ''
  return [so, nav].filter(Boolean).join(' · ')
}

const sb = () => { if (!supabase) throw new Error('Supabase não configurado.'); return supabase }

/** Chama a Edge Function `notificacoes` e devolve a mensagem de erro dela, se houver. */
async function chamar<T>(acao: string): Promise<T> {
  const { data, error } = await sb().functions.invoke('notificacoes', { body: { acao } })
  if (error) {
    let msg = error.message
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.erro) msg = j.erro } catch { /* mantém */ }
    throw new Error(msg)
  }
  return data as T
}

async function gravar(sub: PushSubscription) {
  const j = sub.toJSON()
  const { error } = await sb().rpc('push_inscrever', { p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth, p_aparelho: nomeAparelho() })
  if (error?.code === 'PGRST202') throw new Error('Os avisos ainda não foram ativados no banco de dados. Avise o suporte da CCI.')
  if (error) throw new Error(error.message)
}

/** Pede permissão, inscreve e grava. Lança Error com mensagem legível. */
export async function ligar(userId: string) {
  if (precisaInstalar()) throw new Error('No iPhone, instale o Visor360 na Tela de Início (Compartilhar › Adicionar à Tela de Início) e ligue os avisos por lá.')
  if (!suportado()) throw new Error('Este navegador não recebe avisos. Use o Chrome no Android ou o app instalado no iPhone.')
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('A permissão de aviso foi negada. Libere nas configurações do navegador (cadeado › Notificações).')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const { chave } = await chamar<{ chave: string }>('chave')
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(chave) })
  }
  await gravar(sub)
  marcarDono(userId)
}

export async function desligar() {
  const sub = await (await registro())?.pushManager.getSubscription()
  if (sub) {
    await sb().rpc('push_cancelar', { p_endpoint: sub.endpoint })
    await sub.unsubscribe().catch(() => undefined)
  }
  marcarDono('')
}

export const testar = () => chamar<{ enviadas: number; aparelhos: number }>('testar')

/** Ao abrir o app logado: regrava a inscrição (o navegador pode ter renovado). */
export async function sincronizar(userId?: string | null) {
  try {
    if (!userId || dono() !== userId || !suportado() || Notification.permission !== 'granted') return
    const sub = await (await registro())?.pushManager.getSubscription()
    if (sub) await gravar(sub)
  } catch { /* sem rede ou SQL ainda não rodado */ }
}

/** Ao sair (antes do signOut): o aparelho deixa de receber os avisos de quem saiu. */
export async function aoSair() {
  try { if (suportado() && dono()) await desligar() } catch { /* ignora */ }
}
