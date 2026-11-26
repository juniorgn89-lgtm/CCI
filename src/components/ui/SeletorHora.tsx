import { useEffect, useRef, useState } from 'react'
import * as Pop from '@radix-ui/react-dropdown-menu'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Campo de hora (HH:MM) no lugar do <input type="time"> nativo, cuja lista
 * cinza do navegador destoa do app. Abre um cartão com duas colunas — horas
 * (00–23) e minutos (de 5 em 5) — com o escolhido destacado e centralizado,
 * mais atalhos de horários comuns. Escolher a hora mantém aberto; escolher o
 * minuto (ou um atalho) fecha.
 *
 * Usa o Radix DropdownMenu como popover: funciona dentro de modais (camadas
 * do Radix se entendem) e posiciona sozinho perto da borda da tela.
 */

const pad = (n: number) => String(n).padStart(2, '0')
const HORAS = Array.from({ length: 24 }, (_, i) => i)
const MINUTOS = Array.from({ length: 12 }, (_, i) => i * 5)
const ATALHOS = ['06:00', '08:00', '12:00', '18:00', '22:00', '23:59']

const separar = (v: string) => {
  const [h, m] = (v || '').split(':').map(Number)
  return { h: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : null, m: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : null }
}

interface Props {
  value: string
  onChange: (v: string) => void
  id?: string
  className?: string
  disabled?: boolean
  /** Texto quando vazio. */
  placeholder?: string
  'aria-label'?: string
}

const SeletorHora = ({ value, onChange, id, className, disabled, placeholder = '--:--', ...rest }: Props) => {
  const [aberto, setAberto] = useState(false)
  const { h, m } = separar(value)
  const horasRef = useRef<HTMLDivElement>(null)
  const minRef = useRef<HTMLDivElement>(null)
  // Minuto "quebrado" (ex.: 23:59) também aparece na coluna, no lugar certo.
  const minutos = m !== null && !MINUTOS.includes(m) ? [...MINUTOS, m].sort((a, b) => a - b) : MINUTOS

  // Ao abrir, centraliza o escolhido em cada coluna.
  useEffect(() => {
    if (!aberto) return
    const id = requestAnimationFrame(() => {
      for (const col of [horasRef.current, minRef.current]) {
        const sel = col?.querySelector<HTMLElement>('[data-sel="1"]')
        if (col && sel) col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.clientHeight / 2
      }
    })
    return () => cancelAnimationFrame(id)
  }, [aberto])

  const escolher = (nh: number | null, nm: number | null, fechar: boolean) => {
    onChange(`${pad(nh ?? 0)}:${pad(nm ?? 0)}`)
    if (fechar) setAberto(false)
  }

  const celula = (ativo: boolean) => cn(
    'flex h-8 w-full items-center justify-center rounded-lg text-[13.5px] tabular-nums transition-colors',
    ativo
      ? 'bg-[#1e3a5f] font-bold text-white dark:bg-[#115e59]'
      : 'text-gray-700 hover:bg-gray-100 dark:text-[#cbd5e1] dark:hover:bg-[#2f3b4f]',
  )

  return (
    <Pop.Root open={aberto} onOpenChange={setAberto}>
      <Pop.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          aria-label={rest['aria-label']}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold tabular-nums text-gray-900 transition-colors hover:border-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] disabled:opacity-60 dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100 dark:hover:border-gray-500',
            aberto && 'border-[#1e3a5f] ring-1 ring-[#1e3a5f] dark:border-teal-500 dark:ring-teal-500',
            className,
          )}
        >
          <Clock className="h-4 w-4 shrink-0 text-gray-400" />
          <span className={cn(!value && 'font-normal text-gray-400')}>{value ? `${pad(h ?? 0)}:${pad(m ?? 0)}` : placeholder}</span>
        </button>
      </Pop.Trigger>
      <Pop.Portal>
        <Pop.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="z-[300] w-[232px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#2f3b4f] dark:bg-[#1e293b]"
        >
          {/* Hora escolhida, grande */}
          <div className="flex items-baseline justify-center gap-1 border-b border-gray-100 py-3 dark:border-[#2f3b4f]">
            <span className="text-[28px] font-bold leading-none tabular-nums text-gray-900 dark:text-[#f1f5f9]">{h !== null ? pad(h) : '--'}</span>
            <span className="text-[24px] font-bold leading-none text-gray-300 dark:text-[#64748b]">:</span>
            <span className="text-[28px] font-bold leading-none tabular-nums text-gray-900 dark:text-[#f1f5f9]">{m !== null ? pad(m) : '--'}</span>
          </div>

          <div className="grid grid-cols-2 gap-1 px-2 pt-2">
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-[#64748b]">Hora</span>
            <span className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-[#64748b]">Minuto</span>
          </div>
          <div className="grid grid-cols-2 gap-1 px-2 pb-2">
            <div ref={horasRef} className="relative h-48 space-y-0.5 overflow-y-auto overscroll-contain pr-0.5">
              {HORAS.map((x) => (
                <button key={x} type="button" data-sel={x === h ? '1' : undefined} onClick={() => escolher(x, m, false)} className={celula(x === h)}>{pad(x)}</button>
              ))}
            </div>
            <div ref={minRef} className="relative h-48 space-y-0.5 overflow-y-auto overscroll-contain pr-0.5">
              {minutos.map((x) => (
                <button key={x} type="button" data-sel={x === m ? '1' : undefined} onClick={() => escolher(h, x, true)} className={celula(x === m)}>{pad(x)}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 border-t border-gray-100 px-2 py-2 dark:border-[#2f3b4f]">
            {ATALHOS.map((a) => (
              <button key={a} type="button" onClick={() => { const s = separar(a); escolher(s.h, s.m, true) }}
                className={cn('rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors',
                  value === a ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:border-[#115e59] dark:bg-[#115e59]' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-[#2f3b4f] dark:text-[#94a3b8] dark:hover:bg-[#172234]')}>
                {a}
              </button>
            ))}
          </div>
        </Pop.Content>
      </Pop.Portal>
    </Pop.Root>
  )
}

export default SeletorHora
