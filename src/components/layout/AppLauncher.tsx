import { Grip, ExternalLink, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CCI_APPS, APP_ATUAL_ID } from '@/lib/appsCci'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface AppLauncherProps {
  /** Variante do gatilho: header claro do desktop ou header navy do mobile. */
  variant?: 'desktop' | 'mobile'
}

/**
 * Launcher da suíte CCI — o botão de grade (⋮⋮⋮) estilo Google. Abre um painel
 * com os apps da CCI; o app atual aparece marcado, os demais abrem em nova aba.
 * Lista vem de src/lib/appsCci.ts. Sem SSO nesta fase (ver comentário lá).
 */
const AppLauncher = ({ variant = 'desktop' }: AppLauncherProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Apps da CCI"
          aria-label="Abrir apps da CCI"
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            variant === 'desktop'
              ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300'
              : 'text-white/85 hover:bg-white/10 hover:text-white',
          )}
        >
          <Grip className="h-[18px] w-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px] p-3">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Apps da CCI
        </p>
        <div className="grid grid-cols-3 gap-2">
          {CCI_APPS.map((app) => {
            const atual = app.id === APP_ATUAL_ID
            const Icon = app.Icon
            const tile = (
              <>
                <span
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
                    app.tile,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-1.5 block truncate text-[11.5px] font-semibold text-gray-800 dark:text-gray-100">
                  {app.nome}
                </span>
                {atual ? (
                  <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9.5px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="h-2.5 w-2.5" /> aqui
                  </span>
                ) : app.badge ? (
                  <span className="mt-0.5 block text-[9.5px] text-gray-400">{app.badge}</span>
                ) : (
                  <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9.5px] text-gray-400">
                    abrir <ExternalLink className="h-2.5 w-2.5" />
                  </span>
                )}
              </>
            )
            const base =
              'flex flex-col items-center rounded-xl px-1 py-2.5 text-center transition-colors'
            if (atual || app.badge) {
              return (
                <div
                  key={app.id}
                  title={atual ? 'Você está aqui' : app.badge}
                  className={cn(base, atual ? 'bg-gray-50 dark:bg-gray-800/60' : 'opacity-50')}
                >
                  {tile}
                </div>
              )
            }
            return (
              <a
                key={app.id}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                title={app.descricao}
                className={cn(base, 'hover:bg-gray-100 dark:hover:bg-gray-800')}
              >
                {tile}
              </a>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default AppLauncher
