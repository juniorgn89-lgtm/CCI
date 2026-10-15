import { useState } from 'react'
import { AlertTriangle, Building2, User } from 'lucide-react'
import { estaAtrasada, type TarefaRow, type TarefaStatus } from '@/api/supabase/gestaoTarefas'
import { containerCls, fmtDataHora } from './comum'
import { cn } from '@/lib/utils'

/* Kanban (arrastar entre colunas). A Agenda mensal vive em Agenda.tsx. */

interface Ctx {
  nomePosto: (c: number | null) => string | null
  nomeUsuario: (id: string | null) => string | null
  nomeSetor: (id: string | null) => string | null
}

const COLUNAS: { status: TarefaStatus; label: string; cor: string }[] = [
  { status: 'a_fazer', label: 'A fazer', cor: 'border-gray-300 dark:border-gray-600' },
  { status: 'em_andamento', label: 'Em andamento', cor: 'border-blue-400' },
  { status: 'concluida', label: 'Concluída', cor: 'border-emerald-400' },
]

const Cartao = ({ t, ctx, onAbrir, arrastavel }: { t: TarefaRow; ctx: Ctx; onAbrir: (t: TarefaRow) => void; arrastavel?: boolean }) => {
  const atrasada = estaAtrasada(t)
  const feitos = t.checklist.filter((c) => c.feito).length
  return (
    <button
      type="button"
      draggable={arrastavel}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move' }}
      onClick={() => onAbrir(t)}
      className={cn(
        'w-full rounded-lg border bg-white p-2.5 text-left text-xs shadow-sm transition-colors hover:border-[#1e3a5f]/40 dark:bg-[#161616]',
        atrasada ? 'border-red-300 dark:border-red-900/60' : 'border-gray-200 dark:border-gray-700',
        arrastavel && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <p className="font-semibold text-gray-900 dark:text-gray-100">{t.titulo}</p>
      <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
        {t.empresa_codigo !== null && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{ctx.nomePosto(t.empresa_codigo)}</span>}
        {t.responsavel_id && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{ctx.nomeUsuario(t.responsavel_id)}</span>}
        {t.checklist.length > 0 && <span>{feitos}/{t.checklist.length}</span>}
      </p>
      <p className={cn('mt-1 text-[11px] tabular-nums', atrasada ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500')}>
        {atrasada && <AlertTriangle className="mr-1 inline h-3 w-3" />}{fmtDataHora(t.vence_em)}
      </p>
    </button>
  )
}

export const Kanban = ({ tarefas, ctx, onAbrir, onMudar }: {
  tarefas: TarefaRow[]; ctx: Ctx
  onAbrir: (t: TarefaRow) => void
  onMudar: (t: TarefaRow, s: TarefaStatus) => void
}) => {
  const [sobre, setSobre] = useState<TarefaStatus | null>(null)
  const soltar = (status: TarefaStatus) => (e: React.DragEvent) => {
    e.preventDefault()
    setSobre(null)
    const id = e.dataTransfer.getData('text/plain')
    const t = tarefas.find((x) => x.id === id)
    if (t && t.status !== status) onMudar(t, status)
  }
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLUNAS.map((col) => {
        const itens = tarefas.filter((t) => t.status === col.status)
        return (
          <div
            key={col.status}
            onDragOver={(e) => { e.preventDefault(); if (sobre !== col.status) setSobre(col.status) }}
            onDragLeave={() => setSobre(null)}
            onDrop={soltar(col.status)}
            className={cn(containerCls, 'flex min-h-[16rem] flex-col border-t-4 p-3 transition-colors', col.cor, sobre === col.status && 'bg-blue-50/60 dark:bg-blue-950/20')}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">{col.label}</span>
              <span className="rounded-full bg-gray-100 px-1.5 text-[11px] tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">{itens.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {itens.length === 0 && <p className="py-6 text-center text-[11px] text-gray-400">Arraste uma tarefa para cá</p>}
              {itens.map((t) => <Cartao key={t.id} t={t} ctx={ctx} onAbrir={onAbrir} arrastavel />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
