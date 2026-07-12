import { useState } from 'react'
import { FileText, Copy, Check, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { CartoesResult, DetalheItem } from '@/pages/Cartoes/hooks/useCartoesConciliacao'

/** Linha de texto pronta pra colar no ERP (cópia manual — nada é lançado aqui). */
const linhaTexto = (it: DetalheItem): string =>
  `Venda #${it.vendaCodigo} | ${formatCurrency(it.valor)} | ${it.bandeira} | Vendedor ${it.vendedor} | Dia ${formatDate(it.dia)} | Aut ${it.aut} | NSU ${it.nsu} | Motivo: ${it.motivoTexto}`

const exportCsv = (itens: DetalheItem[]) => {
  const head = ['Venda', 'Valor', 'Bandeira', 'Vendedor', 'Dia', 'Aut', 'NSU', 'Motivo']
  const linhas = itens.map((it) => [it.vendaCodigo, it.valor.toFixed(2).replace('.', ','), it.bandeira, it.vendedor, formatDate(it.dia), it.aut, it.nsu, it.motivoTexto])
  const csv = [head, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'cartoes-sem-conciliar.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const ItemCard = ({ it }: { it: DetalheItem }) => {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(linhaTexto(it)).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    })
  }
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 border-l-[3px] border-l-red-500 bg-white p-3.5 dark:border-gray-700 dark:border-l-red-500 dark:bg-gray-900">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900 dark:text-gray-100">Venda #{it.vendaCodigo}</span>
          <span className="font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(it.valor)}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">{it.bandeira}</span>
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-gray-500 dark:text-gray-400">
          <span>Vendedor <span className="font-medium text-gray-700 dark:text-gray-300">{it.vendedor}</span></span>
          <span>Dia <span className="tabular-nums">{formatDate(it.dia)}</span></span>
          <span>Aut <span className="tabular-nums">{it.aut}</span></span>
          <span>NSU <span className="tabular-nums">{it.nsu}</span></span>
        </p>
        <p className="mt-1 text-[12px] font-medium text-red-600 dark:text-red-400">Motivo: {it.motivoTexto}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copiado' : 'Copiar detalhe'}
      </button>
    </div>
  )
}

const DetalhamentoTab = ({ data, isLoading }: { data?: CartoesResult; isLoading: boolean }) => {
  if (isLoading && !data) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}</div>
  }
  const grupos = data?.detalhe ?? []
  const todos = grupos.flatMap((g) => g.itens)

  return (
    <div className="space-y-4">
      {/* Faixa "Detalhe para lançamento" */}
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/15">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Detalhe para lançamento</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
            Todas as vendas que <strong>não conciliaram</strong>, com Aut, NSU e vendedor. Copie e confira; o <strong>lançamento é feito no ERP</strong> pelo gestor — nada é gravado aqui.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Detalhe para lançamento</h3>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Vendas sem conciliar — copie e confira; o lançamento é feito no ERP.</p>
          </div>
          <button
            type="button"
            onClick={() => exportCsv(todos)}
            disabled={todos.length === 0}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
        </div>

        {todos.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-8 text-center dark:border-emerald-800/50 dark:bg-emerald-950/10">
            <Check className="mx-auto h-6 w-6 text-emerald-500" />
            <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">Nada pendente de lançamento</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Todas as vendas conciliaram ou estão aguardando repasse (prazo ainda não venceu).</p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {grupos.map((g) => (
              <div key={g.grupo}>
                <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                  <span className={cn('h-2.5 w-2.5 rounded-sm', g.grupo === 'valor_divergente' ? 'bg-red-500' : 'bg-red-600')} />
                  {g.label}
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {g.itens.length} {g.itens.length === 1 ? 'venda' : 'vendas'}
                  </span>
                </p>
                <div className="space-y-2.5">
                  {g.itens.map((it) => <ItemCard key={`${g.grupo}-${it.vendaCodigo}-${it.dia}`} it={it} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DetalhamentoTab
