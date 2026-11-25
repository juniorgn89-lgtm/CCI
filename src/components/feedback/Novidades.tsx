import { useState } from 'react'
import { Grip, EyeOff, Sparkles, Smartphone, RefreshCw, Wrench, ShieldCheck, FileText, X, ChevronDown, ArrowRight, type LucideIcon } from 'lucide-react'
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

// Itens agrupados por tipo, no padrão dos avisos da CCI (NotaOK, Portal CCI).
const TIPOS: { id: NonNullable<Novidade['tipo']>; rotulo: string }[] = [
  { id: 'novidade', rotulo: 'Novidades' },
  { id: 'melhoria', rotulo: 'Melhorias' },
  { id: 'correcao', rotulo: 'Correções' },
]

interface NovidadesListaProps {
  itens: Novidade[]
  /** 'escuro' = tela de atualização (sempre ardósia); 'claro' = segue o tema do app. */
  tom?: 'claro' | 'escuro'
  className?: string
}

export const NovidadesLista = ({ itens, tom = 'claro', className }: NovidadesListaProps) => {
  const escuro = tom === 'escuro'
  return (
    <div className={cn('space-y-4', className)}>
      {TIPOS.map((t) => {
        const doTipo = itens.filter((i) => (i.tipo ?? 'novidade') === t.id)
        if (!doTipo.length) return null
        return (
          <section key={t.id}>
            <p className={cn('mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]', escuro ? 'text-[#64748b]' : 'text-gray-400 dark:text-[#64748b]')}>
              {t.rotulo} <span className="font-medium tabular-nums opacity-80">{doTipo.length}</span>
            </p>
            <ul className="space-y-2">
              {doTipo.map((item) => {
                const Icon = ICONES[item.icone] ?? Sparkles
                return (
                  <li
                    key={item.titulo}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3.5',
                      escuro ? 'border-[#2f3b4f] bg-[#172033]' : 'border-gray-200 bg-gray-50/70 dark:border-[#2f3b4f] dark:bg-[#172033]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                        escuro ? 'border-[#2f3b4f] bg-[#1e293b] text-[#94a3b8]' : 'border-gray-200 bg-white text-gray-500 dark:border-[#2f3b4f] dark:bg-[#1e293b] dark:text-[#94a3b8]',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className={cn('text-[14px] font-semibold leading-tight', escuro ? 'text-[#f1f5f9]' : 'text-gray-900 dark:text-[#f1f5f9]')}>{item.titulo}</p>
                      <p className={cn('mt-1 text-[13px] leading-snug', escuro ? 'text-[#94a3b8]' : 'text-gray-500 dark:text-[#94a3b8]')}>{item.descricao}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

const formatarData = (iso: string) => {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** Selo da versão (petróleo) + data, como nos avisos da CCI. */
export const SeloVersao = ({ versao, data, className }: { versao: string; data?: string; className?: string }) => (
  <span className={cn('inline-flex items-center gap-2', className)}>
    <span className="rounded-md bg-[#115e59] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-[#ccfbf1]">Versão {versao}</span>
    {data && <span className="text-[12.5px] tabular-nums text-gray-400 dark:text-[#64748b]">{formatarData(data)}</span>}
  </span>
)

/** Ícone do app num quadrado escuro (cabeçalho dos avisos). */
export const IconeApp = ({ className = 'h-12 w-12' }: { className?: string }) => (
  <span className={cn('flex shrink-0 items-center justify-center rounded-xl bg-[#0f172a] ring-1 ring-white/5', className)}>
    <img src="/brand/visor360-icon-192.png" alt="" className="h-[70%] w-[70%] rounded-lg" />
  </span>
)

interface NovidadesModalProps {
  open: boolean
  onClose: () => void
  releases: ReleaseNote[]
  /** Título do cabeçalho (ex.: "O Visor360 foi atualizado"). */
  titulo?: string
}

/**
 * Modal "o que há de novo" — depois do reinício ("O Visor360 foi atualizado"),
 * no sino do topo e em Configurações › Sobre › Novidades. A versão mais nova
 * vem aberta; com histórico longo, as anteriores ficam fechadas (selo + resumo)
 * e um toque abre. Até 2 versões (caso da atualização), tudo aberto.
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
    <div onClick={onClose} className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 sm:items-center sm:px-4">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#2f3b4f] dark:bg-[#1e293b] sm:max-h-[85vh] sm:max-w-[500px] sm:rounded-2xl"
      >
        <div className="relative shrink-0 px-6 pb-4 pt-6">
          <button onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-[#64748b] dark:hover:bg-[#172234] dark:hover:text-[#f1f5f9]">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-4 pr-8">
            <IconeApp />
            <div className="min-w-0">
              <h2 className="text-[19px] font-bold leading-tight text-gray-900 dark:text-[#f1f5f9]">{titulo}</h2>
              <SeloVersao versao={atual.versao} data={atual.data} className="mt-1.5" />
            </div>
          </div>
          <p className="mt-4 text-[14px] leading-snug text-gray-600 dark:text-[#94a3b8]">{atual.resumo}</p>
        </div>

        <div className="overflow-y-auto border-t border-gray-200 px-6 py-5 dark:border-[#2f3b4f]">
          <NovidadesLista itens={atual.itens} />

          {anteriores.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-[#64748b]">Versões anteriores</p>
              <ul className="space-y-1">
                {anteriores.map((r) => {
                  const aberta = abertas.has(r.versao)
                  return (
                    <li key={r.versao}>
                      <button
                        type="button"
                        onClick={() => alternar(r.versao)}
                        aria-expanded={aberta}
                        className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-[#172234]"
                      >
                        <span className="min-w-0 flex-1">
                          <SeloVersao versao={r.versao} data={r.data} />
                          <span className="mt-1 block text-[13px] leading-snug text-gray-700 dark:text-[#cbd5e1]">{r.resumo}</span>
                        </span>
                        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform', aberta && 'rotate-180')} />
                      </button>
                      {aberta && <NovidadesLista itens={r.itens} className="px-2 pb-3 pt-2" />}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-200 px-6 py-4 dark:border-[#2f3b4f]" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#115e59] text-[15px] font-semibold text-white transition-colors hover:bg-[#0f766e]"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
