import { useEffect, useState } from 'react'
import { Copy, Check, ExternalLink, AlertTriangle, Info } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { IssueSeverity } from '@/pages/QualidadeDados/components/IssueSection'

export interface DetailField {
  label: string
  value: string | number | null | undefined
  /** Quando true, valor aparece destacado (cor da severidade do issue). */
  highlight?: boolean
  /** Quando true, usa tabular-nums + alinhamento direito (pra valores monetários/quantitativos). */
  numeric?: boolean
}

export interface LancamentoDetalheData {
  /** Título principal do modal (ex: "Abastecimento #4521"). */
  title: string
  /** Subtítulo opcional logo abaixo (ex: data + posto). */
  subtitle?: string
  /** Label do código (ex: "Código do abastecimento"). */
  codigoLabel: string
  /** Código copiável (string ou número convertido). Mostra grande + botão copy. */
  codigoValue: string
  /** Texto curto explicando ONDE buscar no Quality (caminho/menu). */
  qualityHint: string
  /** Frase explicando POR QUE foi sinalizado. */
  motivo: string
  /** Severidade pra colorir o chip do motivo. */
  severidade: IssueSeverity
  /** Lista de detalhes do lançamento (renderiza como key-value). */
  details: DetailField[]
}

interface LancamentoDetalheModalProps {
  open: boolean
  onClose: () => void
  data: LancamentoDetalheData | null
}

const severityStyle: Record<IssueSeverity, { bg: string; text: string; Icon: typeof AlertTriangle; label: string }> = {
  high: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', Icon: AlertTriangle, label: 'Crítico' },
  medium: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', Icon: AlertTriangle, label: 'Atenção' },
  low: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', Icon: Info, label: 'Info' },
}

/**
 * Modal de drill-down de um lançamento sinalizado pela Qualidade de Dados.
 * Mostra o código pra busca no Quality (com botão de copy) + motivo do alerta
 * + tabela key-value com todos os campos relevantes. Objetivo: usuário acha o
 * registro errado no Quality em poucos cliques.
 */
const LancamentoDetalheModal = ({ open, onClose, data }: LancamentoDetalheModalProps) => {
  const [copied, setCopied] = useState(false)

  // Reseta o feedback de "Copiado" quando o modal fecha ou troca de registro,
  // pra evitar que um clique rápido em outra linha mostre "Copiado" do anterior.
  useEffect(() => {
    setCopied(false)
  }, [open, data?.codigoValue])

  if (!data) return null
  const sev = severityStyle[data.severidade]

  const copyCode = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    navigator.clipboard.writeText(data.codigoValue).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => { /* clipboard bloqueado — falha silenciosa */ },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{data.title}</DialogTitle>
          {data.subtitle && <DialogDescription>{data.subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-auto">
          {/* Motivo do alerta */}
          <div className={cn('flex items-start gap-2 rounded-lg px-3 py-2 text-xs', sev.bg)}>
            <sev.Icon className={cn('mt-0.5 h-4 w-4 shrink-0', sev.text)} />
            <div className="min-w-0 flex-1">
              <p className={cn('text-[10px] font-semibold uppercase tracking-wider', sev.text)}>
                {sev.label} · Motivo do alerta
              </p>
              <p className="mt-0.5 text-gray-800 dark:text-gray-200">{data.motivo}</p>
            </div>
          </div>

          {/* Card de código + ação copiar */}
          <section className="rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-4 dark:border-gray-700 dark:from-blue-950/20 dark:to-gray-900">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {data.codigoLabel}
            </p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="font-mono text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {data.codigoValue}
              </p>
              <button
                type="button"
                onClick={copyCode}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  copied
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
                )}
                title="Copiar pro clipboard"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{data.qualityHint}</span>
            </p>
          </section>

          {/* Detalhes do lançamento */}
          <section className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Detalhes do lançamento
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.details.map((field, i) => (
                  <tr key={i}>
                    <td className="w-2/5 px-3 py-2 text-left text-gray-500 dark:text-gray-400">
                      {field.label}
                    </td>
                    <td className={cn(
                      'px-3 py-2',
                      field.numeric ? 'text-right tabular-nums' : 'text-left',
                      field.highlight
                        ? cn('font-semibold', sev.text)
                        : 'text-gray-900 dark:text-gray-100',
                    )}>
                      {field.value === null || field.value === undefined || field.value === '' ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        field.value
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LancamentoDetalheModal
