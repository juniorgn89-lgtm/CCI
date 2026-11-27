import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SITUACOES, type GrupoSituacao, type SituacaoProduto } from '@/pages/Estoques/components/estoqueComum'

const GRUPOS: GrupoSituacao[] = ['Estoque', 'Venda', 'Giro × margem']

/**
 * Situação da lista de produtos: um botão suspenso com busca, em três grupos
 * (Estoque · Venda · Giro × margem) e uma dica curta em cada opção. Substitui a
 * antiga Visão de Estoques: Curva ABC, Giro × Margem e mais vendidos são daqui.
 */
const SituacaoSelect = ({ valor, onChange }: { valor: SituacaoProduto; onChange: (v: SituacaoProduto) => void }) => {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])
  const atual = SITUACOES.find((x) => x.v === valor) ?? SITUACOES[0]
  const b = busca.trim().toLowerCase()
  const casa = (x: (typeof SITUACOES)[number]) => !b || x.l.toLowerCase().includes(b) || (x.dica ?? '').toLowerCase().includes(b) || x.grupo.toLowerCase().includes(b)
  const escolher = (v: SituacaoProduto) => { onChange(v); setAberto(false); setBusca('') }
  const ativo = valor !== 'todos'

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-haspopup="listbox" aria-expanded={aberto} aria-label="Situação"
        className={cn('inline-flex h-9 min-w-[220px] max-w-[340px] items-center gap-2 rounded-lg border px-2.5 text-left text-[12.5px] transition-colors',
          ativo ? 'border-[#1e3a5f] bg-[#1e3a5f]/[0.06] font-semibold text-[#1e3a5f] dark:border-teal-500 dark:bg-teal-500/10 dark:text-teal-200'
            : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:bg-[#0f172a] dark:text-gray-300')}>
        <span className="min-w-0 flex-1 truncate">{atual.grupo !== 'Estoque' && <span className="font-normal opacity-70">{atual.grupo} · </span>}{atual.l}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-60 transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <div role="listbox" className="absolute left-0 top-[calc(100%+6px)] z-30 w-[340px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-[#2f3b4f] dark:bg-[#0f172a]">
          <div className="relative border-b border-gray-100 p-2 dark:border-[#2f3b4f]">
            <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar: curva A, mais vendidos, parados…"
              className="h-8 w-full rounded-lg bg-gray-50 pl-7 pr-2 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none dark:bg-white/[0.05] dark:text-gray-100" />
          </div>
          <div className="max-h-[360px] overflow-y-auto py-1">
            {GRUPOS.map((g) => {
              const itens = SITUACOES.filter((x) => x.grupo === g && casa(x))
              if (itens.length === 0) return null
              return (
                <div key={g} className="py-1">
                  <p className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">{g}</p>
                  {itens.map((x) => (
                    <button key={x.v} type="button" role="option" aria-selected={x.v === valor} onClick={() => escolher(x.v)}
                      className={cn('flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.05]', x.v === valor && 'bg-teal-50/60 dark:bg-teal-500/10')}>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-[13px]', x.v === valor ? 'font-semibold text-[#1e3a5f] dark:text-teal-200' : 'text-gray-800 dark:text-gray-100')}>{x.l}</span>
                        {x.dica && <span className="block text-[11.5px] leading-snug text-gray-500 dark:text-gray-400">{x.dica}</span>}
                      </span>
                      {x.v === valor && <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-300" />}
                    </button>
                  ))}
                </div>
              )
            })}
            {GRUPOS.every((g) => SITUACOES.filter((x) => x.grupo === g && casa(x)).length === 0) && (
              <p className="px-3 py-2 text-[12.5px] text-gray-500">Nenhuma opção com esse nome.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SituacaoSelect
