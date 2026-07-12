import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { useThemeStore, type ThemeMode } from '@/store/theme'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'system', label: 'Sistema', icon: Monitor },
  { value: 'dark', label: 'Escuro', icon: Moon },
]

/**
 * Botão de tema no Header — abre as MESMAS opções das Configurações
 * (Claro / Sistema / Escuro). O ícone do gatilho reflete o modo escolhido.
 */
const ThemeToggle = () => {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const Current = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Alterar tema"
          aria-label="Alterar tema"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <Current className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Tema
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => {
          const active = mode === opt.value
          const Icon = opt.icon
          return (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => setMode(opt.value)}
              className={cn('gap-2 text-[13px]', active && 'font-semibold text-[#1e3a5f] dark:text-blue-200')}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
              <span className="flex-1">{opt.label}</span>
              <Check className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-[#2563eb] opacity-100' : 'opacity-0')} />
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ThemeToggle
