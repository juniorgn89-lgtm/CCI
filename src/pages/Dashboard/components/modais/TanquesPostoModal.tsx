import { useMemo } from 'react'
import { Fuel, Loader2, Gauge, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { useAuthStore } from '@/store/auth'
import useReabastecimento, { type ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'
import { COR_NIVEL, MEDICAO_VELHA_DIAS } from '@/pages/Dashboard/components/tanqueNivel'
import TanqueDetalheCard from '@/pages/Dashboard/components/TanqueDetalheCard'
import { agruparPorCombustivel } from '@/pages/Dashboard/components/pedidoCombustivel'
import PedidoSugeridoCombustivel from '@/pages/Dashboard/components/PedidoSugeridoCombustivel'
import { GUIAS } from '@/lib/guiasModais'
import { brDateShort, diffDias, MODAL_CLS } from '@/pages/Dashboard/components/modais/util'

interface Props {
  open: boolean
  onClose: () => void
  empresaCodigo: number | null
  empresaNome: string
  /** Tanques do posto já carregados no card (escritural) — aparecem na hora. */
  tanquesIniciais: ReabastTanque[]
  /** Tanque clicado (destaque). */
  tanqueFoco: number | null
}

/**
 * Central → Tanques → clique no posto/tanque: o detalhe AO VIVO daquele posto,
 * sem trocar de tela. Abre na hora com o escritural do card e, em seguida,
 * busca LMC + compras SÓ desse posto (físico estimado, consumo/dia, dias
 * restantes, última compra, necessidade até o fim do mês) — mesma conta da
 * aba Reabastecimento, cache compartilhado com ela.
 */
const TanquesPostoModal = (p: Props) => {
  if (!p.open || p.empresaCodigo == null) return null
  return <Inner {...p} empresaCodigo={p.empresaCodigo} />
}

const Inner = ({ onClose, empresaCodigo, empresaNome, tanquesIniciais, tanqueFoco }: Props & { empresaCodigo: number }) => {
  const live = useReabastecimento({ empresaCodigo, includeDetalhes: true })
  const canReabast = useAuthStore((s) => s.canVerReabastecimento)
  const aoVivo = live.tanques.length > 0
  const tanques = useMemo(() => {
    const base = aoVivo ? live.tanques : tanquesIniciais
    return [...base].sort((a, b) => a.tanqueNome.localeCompare(b.tanqueNome, 'pt-BR', { numeric: true }))
  }, [aoVivo, live.tanques, tanquesIniciais])
  const buscando = live.isLoadingDetalhes || (!aoVivo && live.isLoading)
  const pedido = useMemo(() => agruparPorCombustivel(tanques), [tanques])

  const total = useMemo(() => {
    const atual = tanques.reduce((s, t) => s + t.estoqueAtual, 0)
    const capacidade = tanques.reduce((s, t) => s + t.capacidade, 0)
    const necessidade = tanques.reduce((s, t) => s + t.necessidadeFimDoMes, 0)
    const criticos = tanques.filter((t) => t.nivel === 'critico').length
    const baixos = tanques.filter((t) => t.nivel === 'alerta').length
    const medicoes = tanques.map((t) => t.medicaoData).filter((d): d is string => !!d).sort()
    return { atual, capacidade, cabe: Math.max(0, capacidade - atual), pct: capacidade > 0 ? (atual / capacidade) * 100 : 0, necessidade, criticos, baixos, ultimaMedicao: medicoes[medicoes.length - 1] ?? null }
  }, [tanques])
  // Medição do LMC antiga: avisa uma vez no topo (os cards não repetem).
  const medicaoDias = total.ultimaMedicao ? -diffDias(total.ultimaMedicao) : null
  const medicaoVelha = aoVivo && medicaoDias != null && medicaoDias > MEDICAO_VELHA_DIAS

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent guia={GUIAS.tanquesPosto} className={MODAL_CLS}>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f]/[0.07] text-[#1e3a5f] dark:bg-white/10 dark:text-blue-300"><Fuel className="h-4 w-4" /></span>
            {empresaNome}
            <span className="text-sm font-normal text-gray-400">· {tanques.length} tanque{tanques.length === 1 ? '' : 's'}</span>
            {total.criticos > 0 && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', COR_NIVEL.critico.badge)}>{total.criticos} crítico{total.criticos > 1 ? 's' : ''}</span>}
            {total.baixos > 0 && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', COR_NIVEL.alerta.badge)}>{total.baixos} baixo{total.baixos > 1 ? 's' : ''}</span>}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Em tanque <b className="text-gray-700 dark:text-gray-200">{formatNumber(Math.round(total.atual))} L</b> de {formatNumber(Math.round(total.capacidade))} L ({Math.round(total.pct)}%) · cabe <b className="text-blue-700 dark:text-blue-400">{formatNumber(Math.round(total.cabe))} L</b></span>
            {buscando ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> buscando medições e compras do posto…</span>
            ) : aoVivo ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <Gauge className="h-3 w-3" /> ao vivo{total.ultimaMedicao ? ` · última medição ${brDateShort(total.ultimaMedicao)}` : ' · sem medição no LMC (escritural)'}
                <InfoHint text="Físico estimado = última medição do LMC + o que o livro movimentou desde então. Consumo por dia = venda no bico no mês. Última compra vem das notas de entrada (90 dias). Necessidade = consumo projetado até o fim do mês menos o que está no tanque." />
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
          {medicaoVelha && (
            <p className="mb-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>A última medição no LMC é de <b>{brDateShort(total.ultimaMedicao ?? '')}</b> ({medicaoDias} dias atrás). Os litros em tanque são <b>estimados</b> a partir dela. <b>Confira a régua antes de pedir.</b></span>
            </p>
          )}
          {canReabast && aoVivo && pedido.length > 0 && <PedidoSugeridoCombustivel empresaCodigo={empresaCodigo} pedido={pedido} tanques={tanques} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tanques.map((t) => (
              <TanqueDetalheCard key={t.tanqueCodigo} t={t} foco={t.tanqueCodigo === tanqueFoco} buscando={buscando} aoVivo={aoVivo} avisoMedicao={!medicaoVelha} />
            ))}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-6 py-3 text-[11px] text-gray-400 dark:border-gray-800">
          <span>
            {total.necessidade > 0
              ? <>Precisa comprar <b className="text-amber-600 dark:text-amber-400">{formatNumber(Math.round(total.necessidade))} L</b> até o fim do mês, somando os tanques.</>
              : aoVivo && !buscando ? 'O estoque cobre o mês no ritmo atual.' : 'Crítico abaixo de 20% · baixo entre 20% e 30%.'}
          </span>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

export default TanquesPostoModal
