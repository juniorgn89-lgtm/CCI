import { Grip, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
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
 * Launcher da suíte CCI — o botão de grade (⋮⋮⋮) estilo Google. Painel
 * arredondado com cabeçalho e ícones grandes "soltos" com o nome embaixo; o
 * primeiro tile é o site da CCI (como a "Conta" do Google), o app atual fica
 * marcado e os demais abrem em nova aba. Lista em src/lib/appsCci.ts. Sem SSO
 * nesta fase (ver comentário lá).
 */
const AppLauncher = ({ variant = 'desktop' }: AppLauncherProps) => {
  // Tiles marcados visivelPara: "master" (ex.: portal interno) só pra dono/diretores.
  const isMaster = useAuthStore((s) => s.isMaster)
  const apps = CCI_APPS.filter((a) => a.visivelPara !== 'master' || isMaster)

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

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[324px] rounded-3xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-[#1f1f22]"
      >
        {/* Cabeçalho (como o "Faça login para organizar os apps" do Google) */}
        <p className="px-3 pb-2.5 pt-2.5 text-center text-[13px] text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-[#0F766E] dark:text-[#14b8a6]">CCI Consultoria</span> · seus apps
        </p>

        {/* Bandeja interna com os ícones */}
        <div className="rounded-2xl bg-gray-50 p-1.5 dark:bg-white/[0.05]">
          <div className="grid grid-cols-3">
            {apps.map((app) => {
              const atual = app.id === APP_ATUAL_ID
              const Icon = app.Icon
              const icone = app.img ? (
                <img src={app.img} alt="" className="h-12 w-12 object-contain drop-shadow-sm" />
              ) : (
                <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm', app.tile)}>
                  {Icon && <Icon className="h-6 w-6" />}
                </span>
              )
              const conteudo = (
                <>
                  {icone}
                  <span className="mt-2 block w-full truncate text-[12.5px] font-medium text-gray-800 dark:text-gray-100">
                    {app.nome}
                  </span>
                  {atual && (
                    <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9.5px] font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="h-2.5 w-2.5" /> aqui
                    </span>
                  )}
                  {app.badge && <span className="mt-0.5 block text-[9.5px] text-gray-400">{app.badge}</span>}
                </>
              )
              const base = 'flex flex-col items-center rounded-2xl px-1 pb-3 pt-3.5 text-center transition-colors'
              if (atual || app.badge) {
                return (
                  <div key={app.id} title={atual ? 'Você está aqui' : app.badge} className={cn(base, atual ? 'bg-black/[0.04] dark:bg-white/[0.08]' : 'opacity-50')}>
                    {conteudo}
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
                  className={cn(base, 'hover:bg-black/[0.05] dark:hover:bg-white/10')}
                >
                  {conteudo}
                </a>
              )
            })}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default AppLauncher
