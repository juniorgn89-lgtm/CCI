import type { ReactNode } from 'react'
import InfoHint from '@/components/ui/InfoHint'
import LinhaRitmo from '@/components/kpi/LinhaRitmo'
import type { SerieRitmo } from '@/lib/serieRitmo'
import { cn } from '@/lib/utils'

/**
 * Bloco de projeção dentro de um card de KPI das abas de Vendas, no padrão da
 * Central: "Fecha em X" comparado ao mês INTEIRO do ano/mês anterior e, no
 * miolo do cartão, a linha do dia a dia com a projeção sazonal tracejada.
 * (A barra "% do mês" e o "faltam" saíram — ficam no cartão "Como o mês vai fechar".)
 * Período fechado → "Fechou em", linha sem projeção.
 *
 * `cheioAnterior` null = sem base no cache → diz "sem base", não inventa.
 */
interface ProjecaoRitmoProps {
  realizado: number
  projetado: number
  diasRestantes: number
  cheioAnterior: number | null
  /** Rótulo do mês comparativo ("out/25" ou "ano ant." / "mês ant."). */
  cheioLabel: string
  fmt: (v: number) => string
  /** Linha do dia a dia (null = período que não é um mês só → sem linha). */
  serie?: SerieRitmo | null
  /** Projeção por item (combustível/categoria/grupo), logo abaixo do "Fecha em". */
  detalhe?: ReactNode
  className?: string
}

const ProjecaoRitmo = ({ realizado, projetado, diasRestantes, cheioAnterior, cheioLabel, fmt, serie, detalhe, className }: ProjecaoRitmoProps) => {
  const fechado = diasRestantes <= 0
  const vsCheio = cheioAnterior && cheioAnterior > 0 ? (((fechado ? realizado : projetado) - cheioAnterior) / cheioAnterior) * 100 : null
  // Elemento (não componente) pra não recriar tipo a cada render.
  const vs = vsCheio === null ? (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-normal text-gray-400">
      sem base de {cheioLabel}
      <InfoHint text={`Não há apuração de ${cheioLabel} inteiro no cache para comparar. Sem base, não inventamos número.`} />
    </span>
  ) : (
    <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', vsCheio >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      {vsCheio >= 0 ? '▲ +' : '▼ '}{vsCheio.toFixed(1).replace('.', ',')}% vs {cheioLabel}
      <InfoHint text={`${fechado ? 'Fechamento' : 'Projeção de fechamento'} comparado ao mês INTEIRO de ${cheioLabel} (${fmt(cheioAnterior ?? 0)}). É a resposta para "vou fechar melhor que ${cheioLabel}?". O selo acima compara só os mesmos dias já decorridos.`} />
    </span>
  )

  return (
    <div className={cn('flex flex-1 flex-col', className)}>
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] leading-snug">
        <span className="text-gray-500 dark:text-gray-400">{fechado ? 'Fechou em' : 'Fecha em'}</span>
        <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">{fmt(fechado ? realizado : projetado)}</span>
        {vs}
      </p>
      {detalhe}
      {/* Centralizada no espaço livre entre a previsão e o rodapé (igual à Central). */}
      {serie && serie.diario.length > 0 && (
        <div className="flex min-h-[88px] flex-1 items-center py-3">
          <LinhaRitmo diario={serie.diario} projecao={fechado ? null : serie.projecao} diasNoMes={serie.diasNoMes} cor={serie.cor} fmt={fmt} />
        </div>
      )}
    </div>
  )
}

export default ProjecaoRitmo
