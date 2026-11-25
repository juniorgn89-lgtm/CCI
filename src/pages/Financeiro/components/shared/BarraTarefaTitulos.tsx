import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ClipboardPlus, X } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { montarTarefaDeTitulos, type TituloSelecionado } from '@/pages/Financeiro/components/shared/tarefaTitulos'

// O formulário é o mesmo do módulo Tarefas (carrega só quando abrir).
const TarefaForm = lazy(() => import('@/pages/Gestao/Tarefas').then((m) => ({ default: m.TarefaForm })))

interface Props {
  tipo: 'receber' | 'pagar'
  /** Dia de vencimento (yyyy-MM-dd) da modal; null = títulos de dias variados. */
  dia: string | null
  selecionados: TituloSelecionado[]
  vencido: boolean
  onLimpar: () => void
}

/**
 * Faixa que aparece ao marcar títulos na modal do dia: quantos, quanto e o
 * botão "Criar tarefa" (formulário de Tarefas já preenchido, urgente, prazo hoje).
 * Só cria a tarefa no Visor — nada muda no ERP.
 */
const BarraTarefaTitulos = ({ tipo, dia, selecionados, vencido, onLimpar }: Props) => {
  const qc = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const [criada, setCriada] = useState<string | null>(null)
  const n = selecionados.length
  const total = selecionados.reduce((s, i) => s + i.valor, 0)

  if (n === 0 && !criada) return null

  return (
    <>
      {n > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2 dark:border-[#0d9488]/40 dark:bg-[#0d9488]/[0.08]">
          <span className="text-[12.5px] text-gray-700 dark:text-[#e2e8f0]">
            <b className="font-semibold">{n} título{n > 1 ? 's' : ''}</b> selecionado{n > 1 ? 's' : ''} · <b className="font-semibold tabular-nums">{formatCurrency(total)}</b>
          </span>
          <button type="button" onClick={onLimpar} className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-800 dark:text-[#94a3b8] dark:hover:text-[#f1f5f9]">
            <X className="h-3.5 w-3.5" /> Limpar seleção
          </button>
          <button type="button" onClick={() => { setCriada(null); setAberto(true) }}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0d9488] px-3 text-[12.5px] font-semibold text-white hover:bg-[#0f766e]">
            <ClipboardPlus className="h-4 w-4" /> Criar tarefa
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[12.5px] text-emerald-800 dark:border-[#4f9d84]/40 dark:bg-[#4f9d84]/[0.08] dark:text-[#86c5aa]">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {criada}
          <Link to="/gestao?tab=tarefas" className="ml-auto font-semibold underline-offset-2 hover:underline">Ver em Tarefas</Link>
          <button type="button" onClick={() => setCriada(null)} aria-label="Fechar aviso" className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/5"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {aberto && (
        <Suspense fallback={null}>
          <TarefaForm
            inicial={montarTarefaDeTitulos(tipo, dia, selecionados, vencido)}
            onClose={() => setAberto(false)}
            onSalva={(t) => {
              setAberto(false)
              setCriada(t ? `Tarefa criada: ${t.titulo}` : 'Tarefa criada.')
              onLimpar()
              void qc.invalidateQueries({ queryKey: ['gestao-tarefas'] })
            }}
          />
        </Suspense>
      )}
    </>
  )
}

export default BarraTarefaTitulos
