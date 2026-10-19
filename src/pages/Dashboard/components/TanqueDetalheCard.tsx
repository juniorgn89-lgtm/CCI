import type { ReactNode } from 'react'
import { Loader2, Truck, CalendarClock, ShoppingCart, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber, formatCurrency } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import type { ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'
import { TanqueSvg } from '@/pages/Dashboard/components/TanqueIcone'
import { COR_NIVEL, produtoBonito, MEDICAO_VELHA_DIAS } from '@/pages/Dashboard/components/tanqueNivel'
import { brDateShort, relDias, diffDias } from '@/pages/Dashboard/components/modais/util'

const Linha = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <div className="flex items-baseline justify-between gap-2 text-[12px]">
    <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">{label}{hint && <InfoHint text={hint} />}</span>
    <span className="text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{children}</span>
  </div>
)

/**
 * Card de UM tanque: nível (ícone + %), atual/capacidade/cabe, consumo por dia,
 * quanto dura, última compra e quanto comprar até o fim do mês. Mesmo card no
 * modal de tanques da Central e na aba Reabastecimento da Operação.
 */
const TanqueDetalheCard = ({ t, foco = false, buscando = false, aoVivo = true, avisoMedicao = true }: {
  t: ReabastTanque
  /** Destaque (tanque clicado no modal). */
  foco?: boolean
  /** Consumo/compras ainda chegando (mostra o aviso no lugar). */
  buscando?: boolean
  aoVivo?: boolean
  /** false quando a tela já avisa da medição velha no topo (evita repetir em todo card). */
  avisoMedicao?: boolean
}) => {
  const cor = COR_NIVEL[t.nivel]
  const pct = Math.max(0, Math.min(100, t.nivelPct))
  const dias = t.diasRestantes
  // Litros estimados a partir de uma medição antiga: avisa, não esconde.
  const medicaoDias = t.estoqueFonte === 'estimado' && t.medicaoData ? -diffDias(t.medicaoData) : null
  const medicaoVelha = avisoMedicao && medicaoDias != null && medicaoDias > MEDICAO_VELHA_DIAS
  const diasCls = dias == null ? 'text-gray-400' : dias < 3 ? COR_NIVEL.critico.text : dias < 7 ? COR_NIVEL.alerta.text : 'text-gray-900 dark:text-gray-100'
  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-transparent', foco && 'ring-2 ring-[#1e3a5f] dark:ring-blue-400')}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <TanqueSvg pct={pct} nivel={t.nivel} id={`tq-detalhe-${t.empresaCodigo}-${t.tanqueCodigo}`} className="h-14 w-14" />
          <span className={cn('text-sm font-extrabold tabular-nums', cor.text)}>{Math.round(pct)}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-gray-900 dark:text-gray-100" title={t.produtoNome}>{produtoBonito(t.produtoNome)}</p>
          <p className="text-[11px] text-gray-400">{t.tanqueNome}</p>
          <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold', cor.badge)}>
            {t.nivel === 'critico' ? 'Crítico' : t.nivel === 'alerta' ? 'Baixo' : 'Normal'}
          </span>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className={cn('h-full rounded-full', cor.bar)} style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
        <Linha label="Atual">
          {formatNumber(Math.round(t.estoqueAtual))} L
          <span className="ml-1 text-[10px] font-normal text-gray-400">{t.estoqueFonte === 'estimado' ? `físico est. · med. ${brDateShort(t.medicaoData ?? '')}` : 'escritural'}</span>
        </Linha>
        {medicaoVelha && (
        <p className="flex items-start gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10.5px] leading-snug text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          Medição de {medicaoDias} dias atrás: o atual é estimado. Confira a régua antes de pedir.
        </p>
      )}
      <Linha label="Capacidade">{formatNumber(Math.round(t.capacidade))} L</Linha>
        <Linha label="Cabe"><span className="text-blue-700 dark:text-blue-400">{formatNumber(Math.round(Math.max(0, t.capacidade - t.estoqueAtual)))} L</span></Linha>
      </div>

      <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2 dark:border-gray-800">
        {buscando && !aoVivo ? (
          <p className="inline-flex items-center gap-1 text-[11px] text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> consumo e compras chegando…</p>
        ) : (
          <>
            <Linha label="Consumo por dia" hint="Média do mês atual pela venda medida no bico deste tanque.">{t.consumoDiarioMedio > 0 ? `${formatNumber(Math.round(t.consumoDiarioMedio))} L` : <span className="font-normal text-gray-400">sem venda no mês</span>}</Linha>
            <Linha label="Dura"><span className={cn('inline-flex items-center gap-1', diasCls)}><CalendarClock className="h-3.5 w-3.5" />{dias == null ? '—' : t.estoqueAtual <= 0 ? 'vazio' : dias === 0 ? 'menos de 1 dia' : `~${dias} dia${dias === 1 ? '' : 's'}`}</span></Linha>
            <Linha label="Última compra" hint="Nota de entrada mais recente deste produto no posto (90 dias). Valor estimado = litros × custo da nota.">
              {t.ultimaCompra ? (
                <span className="inline-flex flex-col items-end leading-tight">
                  <span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-gray-400" />{brDateShort(t.ultimaCompra.data)} <span className="text-[10px] font-normal text-gray-400">{relDias(t.ultimaCompra.data)}</span></span>
                  <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">{formatNumber(Math.round(t.ultimaCompra.volume))} L a {formatCurrency(t.ultimaCompra.precoCusto)}/L</span>
                </span>
              ) : <span className="font-normal text-gray-400">nenhuma em 90 dias</span>}
            </Linha>
            <Linha label="Comprar até fim do mês" hint="Consumo projetado até o fim do mês (mínimo 7 dias) menos o que está no tanque. Zero = o estoque cobre.">
              {t.necessidadeFimDoMes > 0
                ? <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><ShoppingCart className="h-3.5 w-3.5" />{formatNumber(Math.round(t.necessidadeFimDoMes))} L</span>
                : <span className="text-emerald-600 dark:text-emerald-400">coberto</span>}
            </Linha>
          </>
        )}
      </div>
    </div>
  )
}

export default TanqueDetalheCard
