export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('pt-BR').format(value)
}

/** Moeda sem centavos — pra valores grandes em cards (ex.: "R$ 41.276"). */
export const formatCurrencyInt = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

export const formatPercent = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100)
}

export const formatDate = (date: string): string => {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export const formatLiters = (value: number): string => {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)} L`
}

export const formatCurrencyShort = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`
  return `R$ ${value.toFixed(0)}`
}

export const formatLitersShort = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M L`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K L`
  return `${value.toFixed(0)} L`
}

export const formatCurrencyTooltip = (value: number): string => {
  return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
