import { useState } from 'react'
import { X, Sparkles, CornerRightDown } from 'lucide-react'
import CaduAvatar from '@/pages/Inteligencia/components/AssistenteInteligente/CaduAvatar'

interface Props {
  /** Título curto — o que o Cadu iA pode fazer nesta tela. */
  titulo?: string
  /** Exemplo(s) de pergunta pronta — mostrados como "balões" pra ilustrar. */
  exemplos: string[]
  /** Chave de localStorage pra lembrar que o usuário ocultou (uma por tela). */
  storageKey: string
}

/**
 * Dica sugestiva do Cadu iA — aponta pro balão flutuante (canto inferior
 * direito, SuporteCaduWidget) e mostra um exemplo de pergunta pronta pra tela.
 * Universal: o balão do Cadu aparece pra todos os clientes, então a dica também.
 * Dismissível por tela (localStorage). Componente compartilhado — reusar em
 * outras telas passando `exemplos` + `storageKey` próprios.
 */
const CaduHint = ({ titulo = 'Deixe o Cadu iA montar isso pra você', exemplos, storageKey }: Props) => {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(storageKey) === '1' } catch { return false }
  })
  if (hidden) return null
  const dismiss = () => {
    try { localStorage.setItem(storageKey, '1') } catch { /* ignore */ }
    setHidden(true)
  }

  return (
    <div className="relative flex items-start gap-3 overflow-hidden rounded-2xl border border-[#1e3a5f]/15 bg-gradient-to-r from-[#1e3a5f]/[0.06] via-white to-white p-4 shadow-sm dark:border-blue-500/25 dark:from-blue-950/40 dark:via-gray-900 dark:to-black">
      <CaduAvatar className="h-9 w-9 shrink-0 rounded-lg" iconClassName="h-5 w-5" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {titulo}
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[12.5px] text-gray-600 dark:text-gray-300">
          Abra o balão
          <span className="inline-flex h-4 items-center rounded bg-[#1e3a5f] px-1 text-[9px] font-extrabold leading-none text-white dark:bg-blue-700">IA</span>
          no canto inferior direito
          <CornerRightDown className="h-3.5 w-3.5 text-[#1e3a5f] dark:text-blue-300" />
          e peça, por exemplo:
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {exemplos.map((ex, i) => (
            <span key={i} className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[12px] italic text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              “{ex}”
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        title="Ocultar dica"
        aria-label="Ocultar dica"
        className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default CaduHint
