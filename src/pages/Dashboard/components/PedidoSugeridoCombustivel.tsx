import { useState } from 'react'
import { ShoppingCart, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { useTenantStore } from '@/store/tenant'
import { usePedidos } from '@/pages/Compras/hooks/usePedidos'
import NovoPedidoModal from '@/pages/Compras/NovoPedidoModal'
import type { ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'
import { COR_NIVEL, produtoBonito } from '@/pages/Dashboard/components/tanqueNivel'
import { secaTexto, secaCls, type CombustivelPedido } from '@/pages/Dashboard/components/pedidoCombustivel'
import { brDateShort } from '@/pages/Dashboard/components/modais/util'

interface Props {
  empresaCodigo: number
  pedido: CombustivelPedido[]
  tanques: ReabastTanque[]
}

const soNumero = (v: string) => Number(v.replace(/\D/g, '')) || 0

/**
 * Pedido de combustível DIGITADO: por combustível, quem compra escreve os
 * litros (é o jeito que o posto já trabalha). Do lado, o que ajuda a decidir:
 * quanto cabe no tanque, a última compra (atalho de um clique) e quantos dias o
 * estoque dura com o que foi digitado. Nada vem preenchido; passar do que cabe
 * bloqueia o pedido. Em rede com Compras ligado, vira um pedido de compra.
 */
const PedidoSugeridoCombustivel = ({ empresaCodigo, pedido, tanques }: Props) => {
  const rede = useTenantStore((s) => s.rede)
  const comprasOn = !!rede?.compras_habilitado
  const compras = usePedidos(comprasOn ? rede?.id ?? null : null)
  const [qtds, setQtds] = useState<Record<number, number>>({})
  const [abrirPedido, setAbrirPedido] = useState(false)
  const [criado, setCriado] = useState(false)

  const linhas = pedido.map((g) => {
    // A última compra é por combustível no posto (vem igual em todos os tanques dele).
    const uc = tanques.find((t) => t.produtoCodigo === g.produtoCodigo && t.ultimaCompra)?.ultimaCompra ?? null
    const cabe = Math.max(0, Math.floor(g.capacidade - g.atual))
    const qtd = qtds[g.produtoCodigo] ?? 0
    const dura = g.consumoDia > 0 ? Math.floor((g.atual + qtd) / g.consumoDia) : null
    return { g, uc, cabe, qtd, dura, passa: qtd > cabe }
  })
  const itens = linhas.filter((l) => l.qtd > 0)
  const totalL = itens.reduce((n, l) => n + l.qtd, 0)
  const algumPassa = linhas.some((l) => l.passa)
  const setQtd = (cod: number, v: number) => { setQtds((q) => ({ ...q, [cod]: v })); setCriado(false) }

  const inicial = {
    empresa: empresaCodigo,
    setor: 'combustivel' as const,
    itens: itens.map((l) => ({
      produto_codigo: l.g.produtoCodigo,
      produto_nome: produtoBonito(l.g.produto),
      unidade: 'L',
      qtd_solicitada: l.qtd,
      custo_unit: l.uc ? Number(l.uc.precoCusto.toFixed(4)) : 0,
      justificativa: `Tanques: ${formatNumber(Math.round(l.g.atual))} de ${formatNumber(Math.round(l.g.capacidade))} L, consumo ${formatNumber(Math.round(l.g.consumoDia))} L/dia.${l.dura != null ? ` Com o pedido, dura ~${l.dura} dias.` : ''}`,
    })),
  }

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 dark:border-white/[0.08]">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <ShoppingCart className="h-4 w-4 text-[#1e3a5f] dark:text-teal-300" />
        <h4 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">Pedido de combustível</h4>
        <InfoHint text="Digite quantos litros quer pedir de cada combustível. Ao lado: quanto cabe no tanque agora, a última compra (clique para usar o mesmo volume) e quantos dias o estoque dura com o que você digitou, no ritmo de venda atual." />
        {totalL > 0 && <span className="ml-auto text-[12.5px] text-gray-500 dark:text-gray-400">total <b className="tabular-nums text-gray-900 dark:text-white">{formatNumber(totalL)} L</b></span>}
      </div>

      <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
        {linhas.map((l) => (
          <div key={l.g.produtoCodigo} className="grid items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_200px_120px]">
            {/* Combustível e situação do tanque */}
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold text-gray-900 dark:text-gray-100">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', COR_NIVEL[l.g.nivel].dot)} />{produtoBonito(l.g.produto)}
                <span className={cn('text-[12px] font-semibold', secaCls(l.g))}>{secaTexto(l.g)}</span>
              </p>
              <div className="mt-1.5 flex items-center gap-2 pl-4">
                <span className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.08]">
                  <span className={cn('block h-full rounded-full', COR_NIVEL[l.g.nivel].dot)} style={{ width: `${l.g.capacidade > 0 ? Math.min(100, (l.g.atual / l.g.capacidade) * 100) : 0}%` }} />
                </span>
                <span className="text-[12px] tabular-nums text-gray-500 dark:text-gray-400">{formatNumber(Math.round(l.g.atual))} de {formatNumber(Math.round(l.g.capacidade))} L</span>
              </div>
            </div>

            {/* Litros a pedir (digitado) + atalhos */}
            <div>
              <label className="relative block">
                <span className="sr-only">Litros de {produtoBonito(l.g.produto)}</span>
                <input inputMode="numeric" placeholder="0" value={l.qtd ? formatNumber(l.qtd) : ''}
                  onChange={(e) => setQtd(l.g.produtoCodigo, soNumero(e.target.value))} onFocus={(e) => e.currentTarget.select()}
                  className={cn('h-10 w-full rounded-lg border bg-white pl-3 pr-8 text-right text-[15px] font-semibold tabular-nums text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 dark:bg-[#0f172a] dark:text-gray-100 dark:placeholder:text-gray-600',
                    l.passa ? 'border-red-400 focus:ring-red-500/20 dark:border-red-500/70' : 'border-gray-300 focus:border-[#1e3a5f] focus:ring-[#1e3a5f]/15 dark:border-[#3e4c63] dark:focus:border-teal-500 dark:focus:ring-teal-500/20')} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-gray-400">L</span>
              </label>
              <p className="mt-1 flex flex-wrap gap-x-2.5 text-[11.5px] text-gray-500 dark:text-gray-400">
                <button type="button" onClick={() => setQtd(l.g.produtoCodigo, l.cabe)} className="hover:text-gray-800 hover:underline dark:hover:text-gray-200">cabe <b className="tabular-nums">{formatNumber(l.cabe)}</b></button>
                {l.uc && <button type="button" onClick={() => setQtd(l.g.produtoCodigo, Math.round(l.uc!.volume))} className="hover:text-gray-800 hover:underline dark:hover:text-gray-200" title={`Última compra em ${brDateShort(l.uc.data)}`}>última <b className="tabular-nums">{formatNumber(Math.round(l.uc.volume))}</b></button>}
                {l.qtd > 0 && <button type="button" onClick={() => setQtd(l.g.produtoCodigo, 0)} className="text-gray-400 hover:text-red-600">limpar</button>}
              </p>
            </div>

            {/* Resultado do que foi digitado */}
            <div className="text-right">
              {l.passa ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-red-600 dark:text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> passa do que cabe</span>
              ) : l.dura != null ? (
                <>
                  <span className={cn('block text-[15px] font-bold tabular-nums', l.dura < 3 ? 'text-red-600 dark:text-red-400' : l.dura < 7 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>~{l.dura} {l.dura === 1 ? 'dia' : 'dias'}</span>
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400">{l.qtd > 0 ? 'dura com o pedido' : 'dura sem pedido'}</span>
                </>
              ) : <span className="text-[11.5px] text-gray-400">sem venda no mês</span>}
            </div>
          </div>
        ))}
      </div>

      {comprasOn && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
          {criado && <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400"><Check className="h-4 w-4" /> Pedido criado no Compras</span>}
          {algumPassa && <span className="text-[12px] text-red-600 dark:text-red-400">Ajuste os litros que passam do que cabe no tanque.</span>}
          {!algumPassa && totalL === 0 && !criado && <span className="text-[12px] text-gray-500 dark:text-gray-400">Digite os litros para montar o pedido.</span>}
          <button type="button" disabled={itens.length === 0 || algumPassa} onClick={() => setAbrirPedido(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 text-[13px] font-semibold text-white hover:bg-[#172d4a] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-600 dark:hover:bg-teal-500">
            <ShoppingCart className="h-4 w-4" /> Criar pedido de compra{totalL > 0 && <span className="font-normal opacity-85">· {formatNumber(totalL)} L</span>}
          </button>
        </div>
      )}
      {abrirPedido && (
        <NovoPedidoModal open onClose={() => setAbrirPedido(false)} pedido={null} inicial={inicial} tetos={compras.tetos} pedidos={compras.pedidos}
          onSalvo={() => { compras.invalidar(); setAbrirPedido(false); setCriado(true); setQtds({}) }} />
      )}
    </div>
  )
}

export default PedidoSugeridoCombustivel
