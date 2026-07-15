import { useState } from 'react'
import { FileText, Copy, Check, Download, CircleCheck, Undo2, BadgeCheck, TriangleAlert, Scale, Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { DetalheItem, DivergenciaLote } from '@/pages/Cartoes/hooks/useCartoesConciliacao'
import type { TratadaRow } from '@/api/supabase/cartoesConciliacao'

const fmtSigned = (v: number) => `${v < 0 ? '−' : '+'}${formatCurrency(Math.abs(v))}`

const linhaTexto = (it: DetalheItem, posto: string): string =>
  `Venda #${it.vendaCodigo} | ${posto} | ${formatCurrency(it.valor)} | ${it.bandeira} | Vendedor ${it.vendedor} | Dia ${formatDate(it.dia)} | Aut ${it.aut} | NSU ${it.nsu} | Motivo: ${it.motivoTexto}`

const exportCsv = (itens: DetalheItem[], empresaNome: Map<number, string>) => {
  const posto = (c: number) => empresaNome.get(c) || `Posto ${c}`
  const head = ['Venda', 'Posto', 'Valor', 'Bandeira', 'Vendedor', 'Dia', 'Aut', 'NSU', 'Motivo']
  const linhas = itens.map((it) => [it.vendaCodigo, posto(it.empresaCodigo), it.valor.toFixed(2).replace('.', ','), it.bandeira, it.vendedor, formatDate(it.dia), it.aut, it.nsu, it.motivoTexto])
  const csv = [head, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = 'cartoes-sem-conciliar.csv'; a.click()
  URL.revokeObjectURL(url)
}

export interface DetalheFiltro { empresaCodigo: number; bandeira: string; dia: string }

interface DetalhamentoTabProps {
  semRepasse: DetalheItem[]
  divergencias: DivergenciaLote[]
  filtro?: DetalheFiltro | null
  onClearFiltro?: () => void
  isLoading: boolean
  activeTratadas: TratadaRow[]
  tratadasByVenda: Map<number, TratadaRow>
  vendasPendentes: Set<number>
  empresaNome: Map<number, string>
  canWrite: boolean
  onMarcar: (item: DetalheItem) => Promise<void> | void
  onDesfazer: (id: string) => Promise<void> | void
}

const ItemCard = ({ it, posto, canWrite, onMarcar }: { it: DetalheItem; posto: string; canWrite: boolean; onMarcar: (it: DetalheItem) => void }) => {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const copy = () => navigator.clipboard?.writeText(linhaTexto(it, posto)).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600) })
  const marcar = async () => { setBusy(true); try { await onMarcar(it) } finally { setBusy(false) } }
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 border-l-[3px] border-l-red-500 bg-white p-3.5 dark:border-gray-700 dark:border-l-red-500 dark:bg-gray-900">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900 dark:text-gray-100">Venda #{it.vendaCodigo}</span>
          <span className="font-bold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(it.valor)}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">{it.bandeira}</span>
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#1e3a5f] dark:bg-blue-950/40 dark:text-blue-300">{posto}</span>
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-gray-500 dark:text-gray-400">
          <span>Vendedor <span className="font-medium text-gray-700 dark:text-gray-300">{it.vendedor}</span></span>
          <span>Dia <span className="tabular-nums">{formatDate(it.dia)}</span></span>
          <span>Aut <span className="tabular-nums">{it.aut}</span></span>
          <span>NSU <span className="tabular-nums">{it.nsu}</span></span>
        </p>
        <p className="mt-1 text-[12px] font-medium text-red-600 dark:text-red-400">Motivo: {it.motivoTexto}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copiado' : 'Copiar detalhe'}
        </button>
        {canWrite && (
          <button type="button" onClick={marcar} disabled={busy} title="Reconhecer que você já lançou este item no ERP — sai das pendências. Não altera valor." className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#162a44] disabled:opacity-50">
            <BadgeCheck className="h-3.5 w-3.5" />{busy ? '...' : 'Marcar como tratado'}
          </button>
        )}
      </div>
    </div>
  )
}

/** Card de divergência de LOTE (bandeira×dia×posto) — não é por venda. */
const DivergenciaCard = ({ d, posto }: { d: DivergenciaLote; posto: string }) => (
  <div className="rounded-xl border border-gray-200 border-l-[3px] border-l-amber-500 bg-white p-3.5 dark:border-gray-700 dark:border-l-amber-500 dark:bg-gray-900">
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <Scale className="h-4 w-4 text-amber-500" />
      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">{d.bandeira}</span>
      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#1e3a5f] dark:bg-blue-950/40 dark:text-blue-300">{posto}</span>
      <span className="tabular-nums text-gray-500 dark:text-gray-400">liquidação {formatDate(d.diaLiq)}</span>
      <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{d.registros} {d.registros === 1 ? 'venda' : 'vendas'} no lote</span>
    </p>
    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
      <span className="text-gray-500 dark:text-gray-400">Sistema <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">{formatCurrency(d.sistema)}</span></span>
      <span className="text-gray-500 dark:text-gray-400">Repasse <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">{formatCurrency(d.repasse)}</span></span>
      <span className="text-gray-500 dark:text-gray-400">Δ <span className="font-bold tabular-nums text-red-600 dark:text-red-400">{fmtSigned(d.delta)}</span></span>
    </div>
    <p className="mt-1.5 text-[12px] text-amber-700 dark:text-amber-400">
      Diferença no lote do dia — confira por lote no WebPosto. Se for <strong>lote deslocado</strong> (dia trocado no EDI), ligue a <strong>Revisão automática</strong> no topo.
    </p>
  </div>
)

const TratadaCard = ({ t, posto, resolvido, onDesfazer }: { t: TratadaRow; posto: string; resolvido: boolean; onDesfazer: (id: string) => void }) => {
  const [busy, setBusy] = useState(false)
  const desfazer = async () => { setBusy(true); try { await onDesfazer(t.id) } finally { setBusy(false) } }
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 dark:bg-gray-900', resolvido ? 'border-emerald-200 dark:border-emerald-800/50' : 'border-gray-200 dark:border-gray-700')}>
      <div className="min-w-0 text-[12px]">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-gray-100">Venda #{t.venda_codigo}</span>
          <span className="font-bold tabular-nums text-gray-700 dark:text-gray-200">{formatCurrency(t.valor)}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">{t.bandeira}</span>
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#1e3a5f] dark:bg-blue-950/40 dark:text-blue-300">{posto}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          tratado por <span className="font-medium text-gray-600 dark:text-gray-300">{t.tratado_por_nome}</span> em {formatDate((t.tratado_em || '').slice(0, 10))}
          {resolvido && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400" title="O repasse foi carregado no EDI depois do carimbo — a conciliação automática assumiu.">
              <CircleCheck className="h-3 w-3" /> repasse chegou depois
            </span>
          )}
        </p>
      </div>
      <button type="button" onClick={desfazer} disabled={busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
        <Undo2 className="h-3.5 w-3.5" />{busy ? '...' : 'Desfazer'}
      </button>
    </div>
  )
}

const DetalhamentoTab = ({ semRepasse, divergencias, filtro, onClearFiltro, isLoading, activeTratadas, tratadasByVenda, vendasPendentes, empresaNome, canWrite, onMarcar, onDesfazer }: DetalhamentoTabProps) => {
  const nomePosto = (c: number) => empresaNome.get(c) || `Posto ${c}`
  const fItem = (x: { empresaCodigo: number; bandeira: string; diaLiq: string }) => !filtro || (x.empresaCodigo === filtro.empresaCodigo && x.bandeira === filtro.bandeira && x.diaLiq === filtro.dia)
  const fTratada = (t: TratadaRow) => !filtro || (t.empresa_codigo === filtro.empresaCodigo && t.bandeira === filtro.bandeira && (t.dia || '').slice(0, 10) === filtro.dia)
  const pendentes = semRepasse.filter((it) => !tratadasByVenda.has(it.vendaCodigo) && fItem(it))
  const divergenciasF = divergencias.filter(fItem)
  const tratadosPendentes = activeTratadas.filter((t) => vendasPendentes.has(t.venda_codigo) && fTratada(t))
  const tratadosResolvidos = activeTratadas.filter((t) => !vendasPendentes.has(t.venda_codigo) && fTratada(t))

  if (isLoading && semRepasse.length === 0 && divergencias.length === 0 && activeTratadas.length === 0) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}</div>
  }
  const vazio = pendentes.length === 0 && divergenciasF.length === 0 && tratadosPendentes.length === 0 && tratadosResolvidos.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/15">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white"><FileText className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Detalhe para lançamento</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
            Vendas <strong>sem repasse</strong> (cada uma pode precisar de lançamento) e <strong>divergências de lote</strong> (nível bandeira×dia×posto). Copie e confira no ERP. "Marcar como tratado" só reconhece o lançamento — <strong>não altera valor</strong> e o automático prevalece se o repasse chegar depois.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Detalhe para lançamento</h3>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Copie e confira; o lançamento é feito no ERP.</p>
          </div>
          <button type="button" onClick={() => exportCsv(pendentes, empresaNome)} disabled={pendentes.length === 0} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
        </div>

        {filtro && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-[12px] dark:border-blue-900/40 dark:bg-blue-950/20">
            <Filter className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
            <span className="text-gray-600 dark:text-gray-300">Filtrado por lote:</span>
            <span className="rounded bg-white/70 px-1.5 py-0.5 font-semibold text-[#1e3a5f] dark:bg-gray-800/70 dark:text-blue-200">{nomePosto(filtro.empresaCodigo)}</span>
            <span className="rounded bg-white/70 px-1.5 py-0.5 font-semibold uppercase text-gray-600 dark:bg-gray-800/70 dark:text-gray-300">{filtro.bandeira}</span>
            <span className="tabular-nums text-gray-500 dark:text-gray-400">liquidação {formatDate(filtro.dia)}</span>
            <button type="button" onClick={onClearFiltro} className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
              <X className="h-3 w-3" /> limpar
            </button>
          </div>
        )}

        {vazio ? (
          <div className="mt-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-8 text-center dark:border-emerald-800/50 dark:bg-emerald-950/10">
            <Check className="mx-auto h-6 w-6 text-emerald-500" />
            <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">Nada pendente de lançamento</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Tudo conciliou, está aguardando repasse, ou já foi tratado.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {pendentes.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                  <span className="h-2.5 w-2.5 rounded-sm bg-red-600" /> Sem repasse (vencido)
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{pendentes.length} {pendentes.length === 1 ? 'venda' : 'vendas'}</span>
                </p>
                <div className="space-y-2.5">{pendentes.map((it) => <ItemCard key={`${it.empresaCodigo}-${it.vendaCodigo}-${it.diaLiq}`} it={it} posto={nomePosto(it.empresaCodigo)} canWrite={canWrite} onMarcar={onMarcar} />)}</div>
              </div>
            )}

            {divergenciasF.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Valor divergente (por lote)
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{divergenciasF.length} {divergenciasF.length === 1 ? 'lote' : 'lotes'}</span>
                </p>
                <div className="space-y-2.5">{divergenciasF.map((d) => <DivergenciaCard key={d.key} d={d} posto={nomePosto(d.empresaCodigo)} />)}</div>
              </div>
            )}

            {tratadosPendentes.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                  <BadgeCheck className="h-4 w-4 text-[#1e3a5f] dark:text-blue-300" /> Tratados (lançados no ERP)
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{tratadosPendentes.length}</span>
                </p>
                <div className="space-y-2">{tratadosPendentes.map((t) => <TratadaCard key={t.id} t={t} posto={nomePosto(t.empresa_codigo)} resolvido={false} onDesfazer={onDesfazer} />)}</div>
              </div>
            )}

            {tratadosResolvidos.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                  <TriangleAlert className="h-4 w-4 text-amber-500" /> Tratados manualmente · repasse chegou depois
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{tratadosResolvidos.length}</span>
                </p>
                <p className="mb-2 text-[11px] text-gray-400 dark:text-gray-500">Já conciliaram sozinhos (o EDI carregou o repasse depois do carimbo). O carimbo perdeu a função — pode desfazer.</p>
                <div className="space-y-2">{tratadosResolvidos.map((t) => <TratadaCard key={t.id} t={t} posto={nomePosto(t.empresa_codigo)} resolvido onDesfazer={onDesfazer} />)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DetalhamentoTab
