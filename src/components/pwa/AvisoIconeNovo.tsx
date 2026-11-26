import { useState } from 'react'
import { X } from 'lucide-react'
import { rodandoInstalado } from '@/lib/pwaInstall'

/**
 * O iPhone grava o ícone do app na hora do "Adicionar à Tela de Início" e nunca
 * mais confere. Quando o ícone muda, quem já instalou só vê o novo removendo e
 * adicionando de novo — este cartão explica isso uma única vez (só no iPhone/iPad
 * com o app instalado; no Android o Chrome atualiza sozinho).
 */
const CHAVE = 'visor360.aviso-icone-novo.2026-11'
const CHAVE_DEPOIS = 'visor360.aviso-icone-novo.depois'

const ehAppleInstalado = () => {
  if (typeof window === 'undefined' || !rodandoInstalado()) return false
  const ua = navigator.userAgent
  // iPadOS se apresenta como Mac; o toque denuncia.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

const deveMostrar = () => {
  try {
    return ehAppleInstalado() && !localStorage.getItem(CHAVE) && !sessionStorage.getItem(CHAVE_DEPOIS)
  } catch {
    return false
  }
}

const AvisoIconeNovo = () => {
  const [aberto, setAberto] = useState(deveMostrar)
  if (!aberto) return null

  const entendi = () => { try { localStorage.setItem(CHAVE, '1') } catch { /* sem storage: só fecha */ } setAberto(false) }
  const depois = () => { try { sessionStorage.setItem(CHAVE_DEPOIS, '1') } catch { /* idem */ } setAberto(false) }

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-[60] mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300" role="dialog" aria-labelledby="aviso-icone-titulo">
      <div className="relative rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/5 dark:bg-[#0f172a] dark:ring-white/10">
        <button type="button" onClick={depois} aria-label="Fechar" className="absolute right-2.5 top-2.5 rounded-md p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
        <div className="flex gap-3">
          <img src="/brand/visor360-app-192.png" alt="" className="h-12 w-12 shrink-0 rounded-[11px]" />
          <div className="min-w-0 pr-5">
            <p id="aviso-icone-titulo" className="text-[15px] font-semibold text-gray-900 dark:text-white">O Visor tem ícone novo</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-gray-600 dark:text-gray-300">
              No iPhone, o ícone só troca reinstalando o atalho. Seus dados não se perdem.
            </p>
          </div>
        </div>
        <ol className="mt-3 space-y-1.5 rounded-xl bg-gray-50 p-3 text-[12.5px] leading-snug text-gray-700 dark:bg-white/[0.04] dark:text-gray-300">
          <li><b>1.</b> Segure o ícone do Visor na tela de início → <b>Remover app</b>.</li>
          <li><b>2.</b> Abra <b>visor360.cci.app.br</b> no Safari.</li>
          <li><b>3.</b> Toque em <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b>.</li>
        </ol>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={depois} className="h-10 rounded-lg border border-gray-200 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">Mostrar depois</button>
          <button type="button" onClick={entendi} className="h-10 rounded-lg bg-[#0f766e] text-[13px] font-semibold text-white hover:bg-[#0d5f58]">Entendi</button>
        </div>
      </div>
    </div>
  )
}

export default AvisoIconeNovo
