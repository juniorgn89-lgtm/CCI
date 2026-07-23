import { useMemo, useState } from 'react'
import { Building2, ChevronDown, Search, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface PostoOption { codigo: number; fantasia: string }

/** Acima disso, a fileira de chips vira bagunça → dropdown com busca. */
const MAX_CHIPS = 8

const PostoDropdown = ({ postos, value, onChange }: { postos: PostoOption[]; value: number | null; onChange: (c: number) => void }) => {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const sel = postos.find((p) => p.codigo === value)
  const q = busca.trim().toLowerCase()
  const filtrados = useMemo(
    () => (q ? postos.filter((p) => (p.fantasia ?? '').toLowerCase().includes(q)) : postos),
    [postos, q],
  )
  const onOpenChange = (v: boolean) => { setOpen(v); if (v) setBusca('') }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="max-w-[220px] truncate">{sel?.fantasia ?? 'Selecione o posto'}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        {/* Busca — não deixa o typeahead do menu roubar o que se digita (Esc fecha). */}
        <div className="px-2 py-1.5" onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation() }}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar posto..."
              autoFocus
              className="h-7 w-full rounded-md border border-gray-200 bg-white pl-7 pr-2 text-[12px] text-gray-700 outline-none placeholder:text-gray-400 focus:border-[#2563eb] dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200"
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {filtrados.length === 0 ? (
            <p className="px-2 py-3 text-center text-[12px] text-gray-400">Nenhum posto encontrado.</p>
          ) : (
            filtrados.map((p) => {
              const isSel = p.codigo === value
              return (
                <DropdownMenuItem
                  key={p.codigo}
                  onSelect={() => onChange(p.codigo)}
                  className={cn('gap-2 text-[13px]', isSel && 'font-semibold text-[#1e3a5f] dark:text-blue-200')}
                >
                  <Check className={cn('h-3.5 w-3.5 shrink-0', isSel ? 'text-[#2563eb]' : 'opacity-0')} />
                  <span className="truncate">{p.fantasia}</span>
                </DropdownMenuItem>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Seletor de UM posto LOCAL (não mexe no filtro global). Chips quando são poucos
 * (rápido, 1 clique); dropdown com busca quando há muitos (escala pra dezenas de
 * postos). Renderize DENTRO de um container flex — o pai controla label/rótulo.
 * Retorna null com ≤1 posto (nada a escolher).
 */
const PostoLocalSelect = ({ postos, value, onChange }: { postos: PostoOption[]; value: number | null; onChange: (c: number) => void }) => {
  if (postos.length <= 1) return null
  if (postos.length > MAX_CHIPS) return <PostoDropdown postos={postos} value={value} onChange={onChange} />
  return (
    <>
      {postos.map((e) => (
        <button
          key={e.codigo}
          type="button"
          onClick={() => onChange(e.codigo)}
          className={cn(
            'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
            e.codigo === value
              ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700'
              : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800',
          )}
        >
          {e.fantasia}
        </button>
      ))}
    </>
  )
}

export default PostoLocalSelect
