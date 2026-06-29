import { useState } from 'react'
import { Search, ChevronDown, ChevronUp, Lightbulb, CheckCircle2 } from 'lucide-react'
import type { Issue } from '@/pages/QualidadeDados/components/IssueSection'

/**
 * Herói anti-fraude do Sherlock (Fase 2 do redesign). Fica FORA das categorias
 * (sem double-count) — é só o detector `cupom-multi-abast`. A regra é clicável e
 * expande o drill de cupons já existente. A caixa "Padrão" mostra apenas uma
 * leitura DETERMINÍSTICA da concentração por frentista (fato derivável do
 * funcionarioNome); a página omite `padrao` quando não há concentração
 * relevante. Nada de recomendação editorial inventada.
 */
const SherlockHero = ({ issue, padrao }: { issue: Issue | null; padrao: string | null }) => {
  const [open, setOpen] = useState(false)
  const count = issue?.count ?? 0
  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f2740] to-[#1e3a5f] text-white shadow-sm">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <Search className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold">Sistema Sherlock Holmes</h2>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/90">Anti-fraude</span>
          </div>
          <p className="text-[11px] text-white/60">Detecção de cupons "montados" e padrões associados a fraude no PDV.</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-extrabold leading-none tabular-nums">{count}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/50">{count === 1 ? 'suspeita' : 'suspeitas'}</p>
        </div>
      </div>

      {count === 0 ? (
        <div className="flex items-center gap-2 border-t border-white/10 px-5 py-3 text-[12px] text-white/70">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          Nenhum cupom suspeito no período.
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => issue?.detail && setOpen((v) => !v)}
            className="flex w-full items-center gap-3 border-t border-white/10 bg-white/[0.04] px-5 py-3 text-left transition-colors hover:bg-white/[0.08]"
            aria-expanded={open}
          >
            <span className="shrink-0 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Crítico</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">{issue?.label}</p>
              <p className="text-[11px] leading-snug text-white/55">{issue?.description}</p>
            </div>
            <span className="shrink-0 text-2xl font-extrabold tabular-nums">{count}</span>
            {issue?.detail && (open ? <ChevronUp className="h-4 w-4 shrink-0 text-white/60" /> : <ChevronDown className="h-4 w-4 shrink-0 text-white/60" />)}
          </button>
          {open && issue?.detail && (
            <div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
              {issue.detail}
              {padrao && (
                <div className="mx-3 mb-3 mt-1 flex items-start gap-2 rounded-lg border border-[#1e3a5f]/15 bg-[#1e3a5f]/[0.04] px-3 py-2 text-[12px] text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1e3a5f] dark:text-blue-300" />
                  <span><strong className="font-semibold">Padrão:</strong> {padrao}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default SherlockHero
