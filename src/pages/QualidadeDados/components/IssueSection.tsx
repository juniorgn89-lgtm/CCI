import { useState, type ReactNode } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type IssueSeverity = 'high' | 'medium' | 'low'

export interface Issue {
  /** Identificador único do tipo de erro (ex: 'data-futura'). */
  id: string
  /** Título curto que aparece na linha do item dentro da seção. */
  label: string
  /** Explicação de 1 linha do que é o erro e como corrigir. */
  description: string
  severity: IssueSeverity
  count: number
  /**
   * Conteúdo expansível com os registros (tabela ou lista). Cada detector
   * gera seu próprio render. Quando count = 0, este conteúdo é ignorado.
   */
  detail?: ReactNode
}

interface IssueSectionProps {
  /** Nome da categoria (ex: "Abastecimentos"). */
  title: string
  /** Pequena descrição da categoria. */
  subtitle: string
  /** Ícone da categoria (lucide). */
  Icon: typeof AlertTriangle
  issues: Issue[]
  /** Quando true, mostra skeletons no lugar dos issues (queries pendentes). */
  isLoading?: boolean
  /**
   * Quando true, omite o card-wrapper (border/shadow/bg) — usado quando a
   * IssueSection está dentro de um container que já forneceu o cartão (ex:
   * a seção destacada do Sherlock Holmes).
   */
  embedded?: boolean
}

const severityStyle: Record<IssueSeverity, { bg: string; text: string; chip: string; label: string }> = {
  high: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    label: 'Crítico',
  },
  medium: {
    bg: 'bg-gray-50 dark:bg-gray-900/40',
    text: 'text-gray-700 dark:text-gray-300',
    chip: 'border border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300',
    label: 'Atenção',
  },
  low: {
    bg: 'bg-gray-50 dark:bg-gray-900/40',
    text: 'text-gray-600 dark:text-gray-400',
    chip: 'border border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400',
    label: 'Info',
  },
}

/**
 * Seção colapsável de uma categoria de inconsistências (Abastecimentos,
 * Caixa, Estoque etc.). Mostra um header com o nome + total agregado e,
 * dentro, uma lista de issues com chevron pra expandir o detalhe de cada
 * uma. Items com count = 0 mostram um ✓ verde discreto.
 */
const IssueSection = ({ title, subtitle, Icon, issues, isLoading = false, embedded = false }: IssueSectionProps) => {
  const totalIssues = issues.reduce((s, i) => s + i.count, 0)
  const issuesAtivas = issues.filter((i) => i.count > 0)
  const [open, setOpen] = useState(true)

  const Wrapper = embedded ? 'div' : 'section'
  const wrapperClass = embedded
    ? ''
    : 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900'

  return (
    <Wrapper className={wrapperClass}>
      {!embedded && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 text-left transition-colors hover:bg-gray-50/60 dark:border-gray-800 dark:hover:bg-gray-800/30"
          aria-expanded={open}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              isLoading
                ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                : totalIssues > 0
                  ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
            )}>
              {isLoading
                ? <Icon className="h-5 w-5" />
                : totalIssues > 0
                  ? <Icon className="h-5 w-5" />
                  : <CheckCircle2 className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              {isLoading ? (
                <Skeleton className="h-5 w-10" />
              ) : (
                <>
                  <p className={cn(
                    'text-lg font-bold tabular-nums',
                    totalIssues > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400',
                  )}>
                    {totalIssues}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {totalIssues === 1 ? 'ocorrência' : 'ocorrências'}
                  </p>
                </>
              )}
            </div>
            {open
              ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
              : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
          </div>
        </button>
      )}
      {(embedded || open) && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {isLoading ? (
            <div className="space-y-2 px-5 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          ) : issues.length === 0 ? (
            <div className="px-5 py-6 text-center text-xs text-gray-400">Sem detectores nesta categoria.</div>
          ) : issuesAtivas.length === 0 ? (
            <div className="flex items-center gap-2 px-5 py-4 text-xs text-gray-600 dark:text-gray-400">
              <CheckCircle2 className="h-4 w-4" />
              Tudo limpo nesta categoria.
            </div>
          ) : (
            issuesAtivas.map((issue) => <IssueRow key={issue.id} issue={issue} />)
          )}
        </div>
      )}
    </Wrapper>
  )
}

const IssueRow = ({ issue }: { issue: Issue }) => {
  const [expanded, setExpanded] = useState(false)
  const style = severityStyle[issue.severity]
  return (
    <div>
      <button
        type="button"
        onClick={() => issue.detail && setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 px-5 py-3 text-left transition-colors',
          issue.detail ? 'hover:bg-gray-50/60 dark:hover:bg-gray-800/30' : 'cursor-default',
        )}
        disabled={!issue.detail}
      >
        <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums', style.chip)}>
          {style.label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{issue.label}</p>
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{issue.description}</p>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
          {issue.count}
        </span>
        {issue.detail && (
          expanded
            ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
            : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>
      {expanded && issue.detail && (
        <div className="border-t border-gray-100 bg-gray-50/40 dark:border-gray-800 dark:bg-gray-900/40">
          {issue.detail}
        </div>
      )}
    </div>
  )
}

export default IssueSection
