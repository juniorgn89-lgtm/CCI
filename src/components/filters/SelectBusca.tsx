import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Lista de escolha com busca (para listas longas, ex.: categorias). Abre
 * flutuando por cima; fecha ao escolher, no Esc ou clicando fora.
 * valor '' = a opção "todos" (rotuloTodos).
 */
const SelectBusca = ({ valor, onChange, opcoes, rotuloTodos, placeholder = 'Buscar…', className, ariaLabel }: {
  valor: string
  onChange: (v: string) => void
  opcoes: string[]
  rotuloTodos: string
  placeholder?: string
  className?: string
  ariaLabel?: string
}) => {
  const [aberto, setAberto] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAberto(false) } }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc, true) }
  }, [aberto])
  const lista = useMemo(() => opcoes.filter((o) => !q.trim() || norm(o).includes(norm(q.trim()))), [opcoes, q])
  const escolher = (v: string) => { onChange(v); setAberto(false); setQ('') }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-label={ariaLabel}
        className="flex h-9 w-full min-w-[180px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-left text-[13px] text-gray-800 outline-none hover:border-gray-300 focus:border-teal-500 dark:border-[#2f3b4f] dark:bg-[#0b1220] dark:text-[#e2e8f0] dark:hover:border-[#3e4c63]">
        <span className="min-w-0 flex-1 truncate">{valor || rotuloTodos}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-[240px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-[#3e4c63] dark:bg-[#1e293b]">
          <div className="relative border-b border-gray-100 dark:border-[#2f3b4f]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
              onKeyDown={(e) => { if (e.key === 'Enter' && lista.length === 1) { e.preventDefault(); escolher(lista[0]) } }}
              className="h-9 w-full bg-transparent pl-9 pr-3 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100" />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
            {!q.trim() && (
              <li>
                <button type="button" onClick={() => escolher('')} className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-50 dark:hover:bg-[#223049]', valor === '' && 'font-semibold')}>
                  <span className="flex-1">{rotuloTodos}</span>{valor === '' && <Check className="h-4 w-4 text-teal-600 dark:text-[#5eead4]" />}
                </button>
              </li>
            )}
            {lista.map((o) => (
              <li key={o}>
                <button type="button" onClick={() => escolher(o)} className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-gray-800 hover:bg-gray-50 dark:text-[#e2e8f0] dark:hover:bg-[#223049]', valor === o && 'bg-teal-50 font-semibold dark:bg-[#0d9488]/[0.12]')}>
                  <span className="min-w-0 flex-1 truncate">{o}</span>{valor === o && <Check className="h-4 w-4 shrink-0 text-teal-600 dark:text-[#5eead4]" />}
                </button>
              </li>
            ))}
            {lista.length === 0 && <li className="px-3 py-3 text-center text-[12px] text-gray-400">Nada com esse nome.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

export default SelectBusca
