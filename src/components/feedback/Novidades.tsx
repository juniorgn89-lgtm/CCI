import { useState } from 'react'
import { Grip, EyeOff, Sparkles, Smartphone, RefreshCw, Wrench, ShieldCheck, FileText, X, ChevronDown, type LucideIcon } from 'lucide-react'
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

/** Cor do ícone por tipo (tom claro/escuro do app; a tela de atualização navy usa o dourado). */
const TINTA: Record<NovidadeIcone, string> = {
  apps: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300',
  demo: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  ia: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  mobile: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  atualizacao: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  ajuste: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
  seguranca: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  relatorio: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
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
              tom === 'escuro' ? 'bg-white/10 text-[#FCB619]' : TINTA[item.icone],
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
 * Modal "o que há de novo" — depois do reinício ("Visor360 atualizado"), no
 * sino do topo e em Configurações › Sobre › Novidades. Linha do tempo: a versão
 * mais nova aberta e em destaque; as anteriores fechadas (data + resumo), um
 * toque abre. Até 2 versões (caso da atualização), tudo aberto.
 */
export const NovidadesModal = ({ open, onClose, releases, titulo = 'Novidades' }: NovidadesModalProps) => {
  if (!open || !releases.length) return null
  return <NovidadesModalCorpo onClose={onClose} releases={releases} titulo={titulo} />
}

const NovidadesModalCorpo = ({ onClose, releases, titulo }: { onClose: () => void; releases: ReleaseNote[]; titulo: string }) => {
  const ordenadas = [...releases].sort((a, b) => compararVersao(b.versao, a.versao))
  const [abertas, setAbertas] = useState<Set<string>>(
    () => new Set(ordenadas.length <= 2 ? ordenadas.map((r) => r.versao) : [ordenadas[0].versao]),
  )
  const alternar = (v: string) => setAbertas((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n })
  const [atual, ...anteriores] = ordenadas

  return (
    <div onClick={onClose} className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center sm:px-4">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl"
      >
        <div className="relative shrink-0 bg-[#1e3a5f] px-5 py-4 text-white">
          <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <img src="/brand/visor360-icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
            <div>
              <h2 className="text-base font-bold leading-tight">{titulo}</h2>
              <p className="text-[11px] text-white/70">Você está na versão {atual.versao}</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {/* Destaque: a versão mais nova */}
          <section className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-500/25 dark:bg-teal-500/[0.06]">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Nesta versão</span>
              <span className="text-[11.5px] tabular-nums text-gray-500 dark:text-gray-400">{atual.versao} · {formatarData(atual.data)}</span>
            </div>
            <p className="mb-4 text-[14px] font-medium leading-snug text-gray-900 dark:text-gray-100">{atual.resumo}</p>
            <NovidadesLista itens={atual.itens} />
          </section>

          {anteriores.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Versões anteriores</p>
              <ol className="relative border-l border-gray-200 dark:border-gray-700">
                {anteriores.map((r) => {
                  const aberta = abertas.has(r.versao)
                  return (
                    <li key={r.versao} className="relative pb-1 pl-5">
                      <span className={cn('absolute -left-[5px] top-[14px] h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-gray-900', aberta ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600')} />
                      <button
                        type="button"
                        onClick={() => alternar(r.versao)}
                        aria-expanded={aberta}
                        className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11.5px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                            {r.versao} · {formatarData(r.data)}
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-gray-800 dark:text-gray-200">{r.resumo}</span>
                        </span>
                        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform', aberta && 'rotate-180')} />
                      </button>
                      {aberta && <NovidadesLista itens={r.itens} className="px-2 pb-3 pt-2" />}
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-3 dark:border-gray-800" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#1e3a5f] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#16293f] dark:bg-teal-600 dark:hover:bg-teal-700"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
