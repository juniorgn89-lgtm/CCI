import { Clock, CheckCircle2, Lock, History, FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { fmt } from './formatters'

export interface SobrasFaltasDetail {
  responsavel: string
  data: string
  turno: string
  pdv: string
  abertura: string // ISO
  fechamento: string // ISO
  fechado: boolean
  consolidado: boolean
  bloqueado: boolean
  tipoBloqueio?: string
  apurado: number
  sobra: number
  falta: number
  diferenca: number
  observacao?: string
  composicao: {
    vendas: number
    sangria: number
    suprimento: number
    contagem: number
  }
  alteracoes: Array<{
    quando: string // ISO
    quem: string
    campo: string
    de: string
    para: string
  }>
}

interface SobrasFaltasDetailModalProps {
  open: boolean
  onClose: () => void
  detail: SobrasFaltasDetail | null
}

const fmtDateTime = (iso: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fmtTimeOnly = (iso: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const SobrasFaltasDetailModal = ({ open, onClose, detail }: SobrasFaltasDetailModalProps) => {
  if (!detail) return null

  const diffColor = detail.diferenca < 0
    ? 'text-red-700 dark:text-red-400'
    : detail.diferenca > 0
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-gray-600 dark:text-gray-400'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{detail.responsavel}</DialogTitle>
          <DialogDescription>
            {detail.data} · Turno {detail.turno} · {detail.pdv}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-auto">
          {/* Janela de tempo + status */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/50">
            <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              {fmtTimeOnly(detail.abertura)} — {fmtTimeOnly(detail.fechamento)}
            </span>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            {detail.fechado && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Fechado
              </span>
            )}
            {detail.consolidado && (
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Consolidado
              </span>
            )}
            {detail.bloqueado && (
              <span
                className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                title={detail.tipoBloqueio}
              >
                <Lock className="h-3 w-3" /> Bloqueado {detail.tipoBloqueio ? `· ${detail.tipoBloqueio}` : ''}
              </span>
            )}
          </div>

          {/* KPIs mini */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Apurado" value={`R$ ${fmt(detail.apurado)}`} />
            <Kpi label="Sobra" value={detail.sobra > 0 ? `R$ ${fmt(detail.sobra)}` : '—'} valueClass={detail.sobra > 0 ? 'text-emerald-700 dark:text-emerald-400' : undefined} />
            <Kpi label="Falta" value={detail.falta < 0 ? `R$ ${fmt(detail.falta)}` : '—'} valueClass={detail.falta < 0 ? 'text-red-700 dark:text-red-400' : undefined} />
            <Kpi label="Diferença" value={`R$ ${fmt(detail.diferenca)}`} valueClass={diffColor} />
          </div>

          {/* Composição */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Composição do caixa
            </div>
            <table className="w-full text-sm">
              <tbody>
                <CompRow label="Vendas" value={detail.composicao.vendas} sign="+" />
                <CompRow label="Suprimento" value={detail.composicao.suprimento} sign="+" />
                <CompRow label="Sangria" value={detail.composicao.sangria} sign="−" />
                <CompRow label="Contagem física" value={detail.composicao.contagem} sign="−" />
                <tr className="border-t border-gray-200 bg-gray-50 font-bold dark:border-gray-600 dark:bg-gray-800">
                  <td className="px-4 py-2 text-left text-gray-900 dark:text-gray-100">Diferença</td>
                  <td className={cn('px-4 py-2 text-right tabular-nums', diffColor)}>
                    {fmt(detail.diferenca)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Observação */}
          {detail.observacao && (
            <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Observação
                  </p>
                  <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-300">{detail.observacao}</p>
                </div>
              </div>
            </section>
          )}

          {/* Histórico de alterações */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <History className="h-3.5 w-3.5" />
              Histórico de alterações
            </div>
            {detail.alteracoes.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                Sem alterações registradas pra este fechamento.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {detail.alteracoes.map((a, i) => (
                  <li key={i} className="px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{a.campo}</span>
                      <span className="tabular-nums text-gray-500 dark:text-gray-400">{fmtDateTime(a.quando)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <span className="tabular-nums line-through opacity-70">{a.de}</span>
                      <span>→</span>
                      <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{a.para}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-400">por {a.quem}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface KpiProps {
  label: string
  value: string
  valueClass?: string
}

const Kpi = ({ label, value, valueClass }: KpiProps) => (
  <div className="rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
    <p className={cn('mt-0.5 text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100', valueClass)}>
      {value}
    </p>
  </div>
)

const CompRow = ({ label, value, sign }: { label: string; value: number; sign: '+' | '−' }) => (
  <tr className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
    <td className="px-4 py-1.5 text-left text-gray-700 dark:text-gray-300">{label}</td>
    <td className="px-4 py-1.5 text-right text-sm tabular-nums text-gray-800 dark:text-gray-200">
      <span className="mr-1 text-gray-400">{sign}</span>
      {fmt(value)}
    </td>
  </tr>
)

export default SobrasFaltasDetailModal
