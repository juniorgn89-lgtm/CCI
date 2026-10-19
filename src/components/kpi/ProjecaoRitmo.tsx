import InfoHint from '@/components/ui/InfoHint'
import { cn } from '@/lib/utils'

/**
 * Bloco de projeção dentro de um card de KPI (Central e abas de Vendas):
 * barra de ritmo (cheio = realizado, vazio = o que falta até a projeção),
 * "Fecha em X" comparado ao mês INTEIRO do ano/mês anterior, e o que falta
 * por dia. Período fechado → "Fechou em", sem barra.
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
  /** Sufixo do ritmo por dia (ex.: "/dia"). */
  sufixoDia?: string
  className?: string
}

const ProjecaoRitmo = ({ realizado, projetado, diasRestantes, cheioAnterior, cheioLabel, fmt, sufixoDia = '/dia', className }: ProjecaoRitmoProps) => {
  const fechado = diasRestantes <= 0
  const entregue = projetado > 0 ? Math.min(100, (realizado / projetado) * 100) : 0
  const falta = Math.max(0, projetado - realizado)
  const porDia = diasRestantes > 0 ? falta / diasRestantes : 0
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

  if (fechado) {
    return (
      <p className={cn('flex flex-wrap items-baseline gap-x-1.5 text-[12px] leading-snug', className)}>
        <span className="text-gray-500 dark:text-gray-400">Fechou em</span>
        <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">{fmt(realizado)}</span>
        {vs}
      </p>
    )
  }
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200/80 dark:bg-gray-700/80" title={`${Math.round(entregue)}% do projetado já realizado`}>
          <div className="h-full rounded-full bg-[#1e3a5f] dark:bg-blue-500" style={{ width: `${Math.max(2, entregue)}%` }} />
        </div>
        <span className="shrink-0 text-[10px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">{Math.round(entregue)}% do mês</span>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] leading-snug">
        <span className="text-gray-500 dark:text-gray-400">Fecha em</span>
        <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">{fmt(projetado)}</span>
        {vs}
      </p>
      <p className="hidden text-[11px] tabular-nums text-gray-500 sm:block dark:text-gray-400">
        faltam {fmt(falta)} · {fmt(porDia)}{sufixoDia} · {diasRestantes} dia{diasRestantes === 1 ? '' : 's'}
      </p>
    </div>
  )
}

export default ProjecaoRitmo
