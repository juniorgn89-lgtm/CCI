import { formatNumber } from '@/lib/formatters'

/* ─── Cobertura de estoque ─── */

/** Dias inteiros entre duas datas ISO (inclusivo nos dois extremos). */
export const diasEntreDatas = (inicio: string, fim: string): number => {
  const a = new Date(`${inicio}T00:00:00`)
  const b = new Date(`${fim}T00:00:00`)
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1)
}

export interface CoberturaInfo {
  bg: string
  text: string
  label: string
  tooltip?: string
}

/**
 * Calcula o badge de cobertura pra uma combinação (saldo atual, quantidade
 * vendida, dias do período). Retorna null quando não há registro de estoque
 * pro produto (ex.: serviços) — o caller decide se mostra "—" ou nada.
 *
 * Faixas:
 *  - Sem estoque (saldo = 0)            → cinza
 *  - Estoque sem vendas (qtd vendida 0) → verde "> 90d"
 *  - < 7 dias                            → vermelho
 *  - 7 a 30 dias                         → âmbar
 *  - > 30 dias                           → verde
 */
export const coberturaBadgeData = (
  saldo: number | undefined,
  quantidade: number,
  diasPeriodo: number,
  /** "compact" usa "Xd" pra caber em tabelas estreitas; "long" usa "X dias". */
  format: 'compact' | 'long' = 'compact',
): CoberturaInfo | null => {
  if (saldo === undefined) return null
  if (saldo === 0) {
    return {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      label: 'Sem estoque',
    }
  }
  const suffix = format === 'compact' ? 'd' : ' dias'
  if (quantidade <= 0) {
    return {
      bg: 'bg-emerald-100 dark:bg-emerald-900/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      label: format === 'compact' ? '> 90d' : '> 90 dias',
      tooltip: `Saldo: ${formatNumber(saldo)} un · sem vendas no período`,
    }
  }
  const d = (saldo * diasPeriodo) / quantidade
  const tooltip = `Saldo: ${formatNumber(saldo)} un · venda média: ${(quantidade / diasPeriodo).toFixed(1).replace('.', ',')} un/dia`
  const label = `${Math.floor(d)}${suffix}`
  if (d < 7) {
    return {
      bg: 'bg-red-100 dark:bg-red-900/40',
      text: 'text-red-700 dark:text-red-300',
      label,
      tooltip,
    }
  }
  if (d < 30) {
    return {
      bg: 'bg-amber-100 dark:bg-amber-900/40',
      text: 'text-amber-700 dark:text-amber-300',
      label,
      tooltip,
    }
  }
  return {
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    label,
    tooltip,
  }
}
