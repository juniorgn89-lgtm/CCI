import { useState } from 'react'
import { ShieldCheck, ChevronDown, Lock, KeyRound, Server, History, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SecurityItem {
  Icon: typeof Lock
  title: string
  description: string
}

const items: SecurityItem[] = [
  {
    Icon: Lock,
    title: 'Conexão HTTPS + HSTS',
    description: 'Todo tráfego é criptografado (TLS 1.3). O navegador é instruído a nunca aceitar HTTP.',
  },
  {
    Icon: KeyRound,
    title: 'Senhas com bcrypt',
    description: 'Sua senha é guardada como hash bcrypt no Supabase Auth — nunca em texto puro.',
  },
  {
    Icon: Server,
    title: 'Sessão com JWT PKCE',
    description: 'Tokens curtos com refresh automático e fluxo PKCE no reset de senha.',
  },
  {
    Icon: ShieldCheck,
    title: 'Headers de segurança',
    description: 'CSP, X-Frame-Options, Referrer-Policy e Permissions-Policy aplicados em todas as páginas.',
  },
  {
    Icon: History,
    title: 'Throttle de login',
    description: 'Após 5 tentativas inválidas, o login bloqueia por 5 min — bloqueia força bruta.',
  },
  {
    Icon: Eye,
    title: 'Somente leitura',
    description: 'O sistema só faz requisições GET — não há endpoints que alterem dados na origem.',
  },
]

const SecurityBadge = () => {
  const [open, setOpen] = useState(false)

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
          'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/70',
          'dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/30',
        )}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            Conexão segura · Nível Profissional
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-emerald-600 transition-transform dark:text-emerald-400',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Camadas ativas para proteger seu acesso:
          </p>
          <ul className="space-y-2">
            {items.map((item) => {
              const Icon = item.Icon
              return (
                <li key={item.title} className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-900/30">
                    <Icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">
                      {item.title}
                    </p>
                    <p className="text-[10px] leading-snug text-gray-500 dark:text-gray-400">
                      {item.description}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default SecurityBadge
