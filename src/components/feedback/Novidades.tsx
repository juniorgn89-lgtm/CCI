import { Grip, EyeOff, Sparkles, Smartphone, RefreshCw, Wrench, ShieldCheck, FileText, X, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RELEASE_NOTES, compararVersao, type Novidade, type NovidadeIcone, type ReleaseNote } from '@/releaseNotes'

/** Ícone de cada tipo de novidade (as chaves vivem em src/releaseNotes.ts, sem imports). */
const ICONES: Record<NovidadeIcone, LucideIcon> = {
  apps: Grip,
  demo: EyeOff,
  ia: Sparkles,
  mobile: Smartphone,
  atualizacao: RefreshCw,
  ajuste: Wrench,
  seguranca: ShieldCheck,
  relatorio: FileText,
}

/**
 * Quais releases são "novidade" pra quem está na versão `desde`: tudo que é
 * mais novo. Sem nada mais novo (ex.: deploy sem mudar a versão), devolve a
 * release mais recente — sempre há algo honesto pra mostrar, sem inventar.
 */
export const novidadesDesde = (desde: string | null, notas: ReleaseNote[] = RELEASE_NOTES): ReleaseNote[] => {
  const ordenadas = [...notas].sort((a, b) => compararVersao(b.versao, a.versao))
  if (!ordenadas.length) return []
  const novas = desde ? ordenadas.filter((n) => compararVersao(n.versao, desde) > 0) : []
  return novas.length ? novas : [ordenadas[0]]
}

interface NovidadesListaProps {
  itens: Novidade[]
  /** 'escuro' = sobre fundo navy (tela de atualização); 'claro' = card normal. */
  tom?: 'claro' | 'escuro'
  className?: string
}

export const NovidadesLista = ({ itens, tom = 'claro', className }: NovidadesListaProps) => (
  <ul className={cn('space-y-3', className)}>
    {itens.map((item) => {
      const Icon = ICONES[item.icone]
      return (
        <li key={item.titulo} className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              tom === 'escuro' ? 'bg-white/10 text-[#FCB619]' : 'bg-[#1e3a5f]/[0.07] text-[#1e3a5f] dark:bg-white/10 dark:text-[#FCB619]',
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className={cn('text-[13.5px] font-semibold leading-tight', tom === 'escuro' ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>
              {item.titulo}
            </p>
            <p className={cn('mt-0.5 text-[12.5px] leading-snug', tom === 'escuro' ? 'text-white/70' : 'text-gray-500 dark:text-gray-400')}>
              {item.descricao}
            </p>
          </div>
        </li>
      )
    })}
  </ul>
)

const formatarData = (iso: string) => {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

interface NovidadesModalProps {
  open: boolean
  onClose: () => void
  releases: ReleaseNote[]
  /** Título do cabeçalho (ex.: "Visor360 atualizado"). */
  titulo?: string
}

/**
 * Modal "o que há de novo" — usado depois do reinício ("Visor360 atualizado")
 * e em Configurações › Sobre › Novidades. Uma seção por versão.
 */
export const NovidadesModal = ({ open, onClose, releases, titulo = 'Novidades' }: NovidadesModalProps) => {
  if (!open || !releases.length) return null
  return (
    <div onClick={onClose} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="relative bg-[#1e3a5f] px-5 py-4 text-white">
          <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <img src="/brand/visor360-icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
            <div>
              <h2 className="text-base font-bold leading-tight">{titulo}</h2>
              <p className="text-[11px] text-white/70">Versão {releases[0].versao} · {formatarData(releases[0].data)}</p>
            </div>
          </div>
        </div>
        <div className="space-y-5 overflow-y-auto px-5 py-4">
          {releases.map((r, i) => (
            <section key={r.versao}>
              {(releases.length > 1 || i > 0) && (
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Versão {r.versao} · {formatarData(r.data)}
                </p>
              )}
              <p className="mb-3 text-[13px] text-gray-600 dark:text-gray-300">{r.resumo}</p>
              <NovidadesLista itens={r.itens} />
            </section>
          ))}
        </div>
        <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#1e3a5f] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#16293f]"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
