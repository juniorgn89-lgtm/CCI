import { Plus, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CAMPO } from './estiloForm'

/** Bloco numerado do formulário ("1 · O QUÊ"), com linha separando do anterior. */
export const BlocoForm = ({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) => (
  <section className="space-y-4 border-t border-gray-100 pt-5 first:border-t-0 first:pt-0 dark:border-white/[0.06]">
    <h3 className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10.5px] tabular-nums text-gray-600 dark:bg-white/[0.08] dark:text-gray-300">{n}</span>{titulo}
    </h3>
    {children}
  </section>
)

/**
 * Lista de etapas numeradas + campo "próxima etapa e Enter". Etapa já feita
 * (edição de tarefa) aparece com ✓.
 */
export const EtapasCampo = ({ itens, onRemover, novo, onNovo, onAdd, placeholderVazio = 'Ex.: Medir o tanque 1 e Enter…' }: {
  itens: { texto: string; feito?: boolean }[]
  onRemover: (i: number) => void
  novo: string
  onNovo: (v: string) => void
  onAdd: () => void
  placeholderVazio?: string
}) => (
  <div>
    {itens.length > 0 && (
      <ol className="mb-2 overflow-hidden rounded-xl border border-gray-200 dark:border-white/[0.08]">
        {itens.map((c, i) => (
          <li key={i} className="group flex items-center gap-3 border-b border-gray-100 px-3.5 py-2.5 last:border-b-0 dark:border-white/[0.06]">
            <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums', c.feito ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-gray-300')}>
              {c.feito ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn('min-w-0 flex-1 text-[13.5px] text-gray-800 dark:text-gray-100', c.feito && 'text-gray-400 line-through dark:text-gray-500')}>{c.texto}</span>
            <button type="button" aria-label="Remover etapa" onClick={() => onRemover(i)}
              className="rounded-md p-1 text-gray-400 opacity-60 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-500/10"><X className="h-4 w-4" /></button>
          </li>
        ))}
      </ol>
    )}
    <div className="flex gap-2">
      <input className={CAMPO} placeholder={itens.length ? 'Próxima etapa e Enter…' : placeholderVazio} value={novo} onChange={(e) => onNovo(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd() } }} />
      <button type="button" aria-label="Adicionar etapa" onClick={onAdd} disabled={!novo.trim()}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-[#3e4c63] dark:text-gray-300 dark:hover:bg-white/[0.05]"><Plus className="h-4 w-4" /></button>
    </div>
  </div>
)

/** Asterisco vermelho de campo obrigatório (vai logo depois do rótulo). */
export const Obrigatorio = () => <span className="text-red-500" aria-label="obrigatório">*</span>
