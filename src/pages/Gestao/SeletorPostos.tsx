import { useMemo, useState } from 'react'
import * as Pop from '@radix-ui/react-dropdown-menu'
import { Building2, Check, ChevronDown, Fuel, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RedePosto } from '@/pages/Rede/hooks/useRedePostos'

/**
 * Escolha de postos em lista suspensa — mesmo jeito do seletor de postos do
 * topo do Visor (caixinha, nome, cidade, "Escolher um só", "Marcar todos"),
 * só que vale na hora (sem "Aplicar"). Nenhum marcado = a rede inteira.
 */
const SeletorPostos = ({ postos, valor, onChange, rotuloVazio = 'Rede inteira (uma tarefa só)', unico = false }: {
  postos: RedePosto[]
  valor: number[]
  onChange: (v: number[]) => void
  rotuloVazio?: string
  /** Escolhe um posto só (ou nenhum): clicou, escolheu e fechou. */
  unico?: boolean
}) => {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const nome = (p: RedePosto) => p.fantasia || p.razao || `Posto ${p.codigo}`
  const ordenados = useMemo(() => [...postos].sort((a, b) => nome(a).localeCompare(nome(b), 'pt-BR')), [postos])
  const visiveis = busca.trim() ? ordenados.filter((p) => `${nome(p)} ${p.cidade ?? ''}`.toLowerCase().includes(busca.trim().toLowerCase())) : ordenados
  const sel = new Set(valor)
  const alternar = (c: number) => {
    if (unico) { onChange(sel.has(c) ? [] : [c]); setAberto(false); return }
    onChange(sel.has(c) ? valor.filter((x) => x !== c) : [...valor, c])
  }
  const escolhidos = ordenados.filter((p) => sel.has(p.codigo))

  return (
    <Pop.Root open={aberto} onOpenChange={setAberto}>
      <Pop.Trigger asChild>
        <button type="button"
          className={cn('flex min-h-11 w-full items-center gap-2.5 rounded-lg border bg-white px-3.5 py-2 text-left text-[14px] transition-colors dark:bg-[#0f172a]',
            aberto ? 'border-[#1e3a5f] ring-2 ring-[#1e3a5f]/15 dark:border-teal-500 dark:ring-teal-500/20' : 'border-gray-300 hover:border-gray-400 dark:border-[#3e4c63] dark:hover:border-gray-500')}>
          <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="min-w-0 flex-1">
            {escolhidos.length === 0
              ? <span className="text-gray-700 dark:text-gray-200">{rotuloVazio}</span>
              : escolhidos.length <= 2
                ? <span className="font-medium text-gray-900 dark:text-gray-100">{escolhidos.map(nome).join(', ')}</span>
                : <span className="font-medium text-gray-900 dark:text-gray-100">{escolhidos.length} postos <span className="font-normal text-gray-500 dark:text-gray-400">· {nome(escolhidos[0])} e mais {escolhidos.length - 1}</span></span>}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', aberto && 'rotate-180')} />
        </button>
      </Pop.Trigger>
      <Pop.Portal>
        <Pop.Content align="start" sideOffset={6} collisionPadding={12} onCloseAutoFocus={(e) => e.preventDefault()}
          className="z-[300] w-[var(--radix-dropdown-menu-trigger-width)] min-w-[300px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#2f3b4f] dark:bg-[#1e293b]">
          <div className="flex items-center justify-between px-4 pb-1 pt-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400"><Fuel className="h-3.5 w-3.5" /> Posto</span>
            {valor.length > 0 && <button type="button" onClick={() => { onChange([]); if (unico) setAberto(false) }} className="text-[12px] font-semibold text-[#1e3a5f] hover:underline dark:text-teal-300">{unico ? 'Sem posto' : 'Rede inteira'}</button>}
          </div>
          {postos.length > 6 && (
            <div className="relative mx-3 mb-1 mt-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Buscar posto…"
                className="h-9 w-full rounded-lg bg-gray-100 pl-8 pr-2 text-[13px] text-gray-800 outline-none placeholder:text-gray-500 dark:bg-white/[0.06] dark:text-gray-100" />
            </div>
          )}
          <ul className="max-h-72 overflow-y-auto px-2 pb-2">
            {visiveis.map((p) => {
              const on = sel.has(p.codigo)
              return (
                <li key={p.codigo}>
                  <button type="button" onClick={() => alternar(p.codigo)}
                    className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors', on ? 'bg-[#1e3a5f]/[0.07] dark:bg-teal-500/15' : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]')}>
                    <span className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center border-2', unico ? 'rounded-full' : 'rounded-[5px]', on ? 'border-[#1e3a5f] bg-[#1e3a5f] dark:border-teal-500 dark:bg-teal-500' : 'border-gray-300 dark:border-gray-600')}>
                      {on && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[13.5px]', on ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-800 dark:text-gray-200')}>{nome(p)}</span>
                      {p.cidade && <span className="block truncate text-[11.5px] text-gray-500 dark:text-gray-400">{p.cidade}</span>}
                    </span>
                    {!unico && <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onChange([p.codigo]) }}
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-gray-400 opacity-0 transition-opacity hover:text-[#1e3a5f] group-hover:opacity-100 dark:hover:text-teal-300 [li:hover_&]:opacity-100">
                      só este
                    </span>}
                  </button>
                </li>
              )
            })}
            {visiveis.length === 0 && <li className="px-3 py-3 text-center text-[12px] text-gray-400">{postos.length ? 'Nenhum posto com esse nome.' : 'Carregando postos da rede…'}</li>}
          </ul>
          {!unico && <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-[#2f3b4f]">
            <span className="text-[12px] text-gray-500 dark:text-gray-400">
              {valor.length === 0 ? 'Nenhum marcado = rede inteira' : `${valor.length} ${valor.length === 1 ? 'posto marcado' : 'postos marcados'}`}
              {valor.length < postos.length && <button type="button" onClick={() => onChange(postos.map((p) => p.codigo))} className="ml-2 font-semibold text-[#1e3a5f] hover:underline dark:text-teal-300">Marcar todos</button>}
            </span>
            <button type="button" onClick={() => setAberto(false)} className="h-8 rounded-lg bg-[#1e3a5f] px-4 text-[12.5px] font-semibold text-white hover:bg-[#162d4a] dark:bg-teal-600 dark:hover:bg-teal-500">Pronto</button>
          </div>}
        </Pop.Content>
      </Pop.Portal>
    </Pop.Root>
  )
}

export default SeletorPostos
