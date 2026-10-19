import { useMemo, useState } from 'react'
import { ShoppingCart, Check } from 'lucide-react'
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

type Opcao = 'ultima' | 'cabe' | 'mes'
const OPCAO_LABEL: Record<Opcao, string> = { ultima: 'Última compra', cabe: 'O que cabe', mes: 'Até o fim do mês' }

interface Props {
  empresaCodigo: number
  pedido: CombustivelPedido[]
  tanques: ReabastTanque[]
}

/**
 * Pedido sugerido dos tanques: por combustível, a quantidade parte da ÚLTIMA
 * COMPRA (o jeito que o posto compra), limitada ao que cabe no tanque. Três
 * atalhos trocam a base; ao lado, quanto o estoque dura com o pedido. Em rede
 * com Compras ligado, vira um pedido de compra (categoria Combustível).
 */
const PedidoSugeridoCombustivel = ({ empresaCodigo, pedido, tanques }: Props) => {
  const rede = useTenantStore((s) => s.rede)
  const comprasOn = !!rede?.compras_habilitado
  const compras = usePedidos(comprasOn ? rede?.id ?? null : null)
  const [escolha, setEscolha] = useState<Record<number, Opcao>>({})
  const [abrirPedido, setAbrirPedido] = useState(false)
  const [criado, setCriado] = useState(false)

  const linhas = useMemo(() => pedido.map((g) => {
    // A última compra é por combustível no posto (vem igual em todos os tanques dele).
    const uc = tanques.find((t) => t.produtoCodigo === g.produtoCodigo && t.ultimaCompra)?.ultimaCompra ?? null
    const cabe = Math.max(0, Math.floor(g.capacidade - g.atual))
    const opcoes: Record<Opcao, number | null> = {
      ultima: uc ? Math.min(Math.round(uc.volume), cabe) : null,
      cabe,
      mes: g.comprar > 0 ? Math.min(Math.round(g.comprar), cabe) : 0,
    }
    const padrao: Opcao = uc ? 'ultima' : 'cabe'
    const op = escolha[g.produtoCodigo] ?? padrao
    const qtd = g.comprar > 0 || escolha[g.produtoCodigo] ? opcoes[op] ?? 0 : 0
    const dura = g.consumoDia > 0 ? Math.floor((g.atual + qtd) / g.consumoDia) : null
    return { g, uc, cabe, opcoes, op, qtd, dura, faltaNoMes: g.comprar > cabe ? Math.round(g.comprar) : null }
  }), [pedido, tanques, escolha])

  const itens = linhas.filter((l) => l.qtd > 0)
  const totalL = itens.reduce((n, l) => n + l.qtd, 0)

  const inicial = {
    empresa: empresaCodigo,
    setor: 'combustivel' as const,
    itens: itens.map((l) => ({
      produto_codigo: l.g.produtoCodigo,
      produto_nome: produtoBonito(l.g.produto),
      unidade: 'L',
      qtd_solicitada: l.qtd,
      custo_unit: l.uc ? Number(l.uc.precoCusto.toFixed(4)) : 0,
      justificativa: `Tanques: ${formatNumber(Math.round(l.g.atual))} de ${formatNumber(Math.round(l.g.capacidade))} L, consumo ${formatNumber(Math.round(l.g.consumoDia))} L/dia. Base: ${OPCAO_LABEL[l.op].toLowerCase()}${l.op === 'ultima' && l.uc ? ` (${formatNumber(Math.round(l.uc.volume))} L em ${brDateShort(l.uc.data)})` : ''}.${l.dura != null ? ` Com o pedido, dura ~${l.dura} dias.` : ''}`,
    })),
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/10">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <ShoppingCart className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h4 className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Pedido sugerido</h4>
        <InfoHint text="Por combustível, somando os tanques do posto. A quantidade parte da última compra (o tamanho de carga que o posto costuma pedir) e nunca passa do que cabe no tanque. Troque a base em cada linha: última compra, o que cabe ou até o fim do mês. 'Dura' é quantos dias o estoque aguenta com o pedido, no ritmo de venda atual." />
        <span className="ml-auto text-[12px] text-gray-500 dark:text-gray-400">pedir <b className="tabular-nums text-amber-600 dark:text-amber-400">{formatNumber(totalL)} L</b></span>
      </div>
      <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
        {linhas.map((l) => (
          <div key={l.g.produtoCodigo} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[12.5px]">
            <span className="inline-flex min-w-[140px] items-center gap-2 font-semibold text-gray-800 dark:text-gray-100"><span className={cn('h-2 w-2 rounded-full', COR_NIVEL[l.g.nivel].dot)} />{produtoBonito(l.g.produto)}</span>
            <span className="tabular-nums text-gray-600 dark:text-gray-300">{formatNumber(Math.round(l.g.atual))} de {formatNumber(Math.round(l.g.capacidade))} L</span>
            <span className={cn('font-semibold', secaCls(l.g))}>{secaTexto(l.g)}</span>
            {l.g.comprar <= 0 && !escolha[l.g.produtoCodigo] ? (
              <span className="ml-auto text-emerald-600 dark:text-emerald-400">coberto</span>
            ) : (
              <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <span className="inline-flex rounded-lg border border-amber-200 bg-white p-0.5 dark:border-amber-900/50 dark:bg-black/30">
                  {(Object.keys(OPCAO_LABEL) as Opcao[]).map((o) => {
                    const v = l.opcoes[o]
                    const off = v == null
                    return (
                      <button key={o} type="button" disabled={off} onClick={() => setEscolha((e) => ({ ...e, [l.g.produtoCodigo]: o }))}
                        title={off ? 'Sem compra deste combustível nos últimos 90 dias' : undefined}
                        className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                          l.op === o && !off ? 'bg-amber-500 text-white dark:bg-amber-600' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white')}>
                        {OPCAO_LABEL[o]}{v != null && <span className="ml-1 font-normal tabular-nums opacity-80">{formatNumber(v)}</span>}
                      </button>
                    )
                  })}
                </span>
                <span className="min-w-[88px] text-right">
                  <b className="block tabular-nums text-amber-600 dark:text-amber-400">{formatNumber(l.qtd)} L</b>
                  {l.dura != null && <span className={cn('block text-[10.5px]', l.dura < 3 ? 'font-semibold text-red-600 dark:text-red-400' : l.dura < 7 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400')}>dura ~{l.dura} {l.dura === 1 ? 'dia' : 'dias'}</span>}
                </span>
              </span>
            )}
            {(l.faltaNoMes || (!l.uc && l.g.comprar > 0)) && (
              <p className="w-full pl-4 text-[11px] text-gray-500 dark:text-gray-400">
                {!l.uc && 'Sem compra deste combustível nos últimos 90 dias. '}
                {l.faltaNoMes && <>Precisa de {formatNumber(l.faltaNoMes)} L até o fim do mês, mas cabem {formatNumber(l.cabe)} L agora: vai precisar de outra entrega.</>}
              </p>
            )}
          </div>
        ))}
      </div>
      {comprasOn && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-amber-100 pt-2 dark:border-amber-900/30">
          {criado && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> Pedido criado no Compras</span>}
          <button type="button" disabled={itens.length === 0} onClick={() => setAbrirPedido(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#172d4a] disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500">
            <ShoppingCart className="h-4 w-4" /> Criar pedido de compra{itens.length > 0 && <span className="font-normal opacity-80">· {formatNumber(totalL)} L</span>}
          </button>
        </div>
      )}
      {abrirPedido && (
        <NovoPedidoModal open onClose={() => setAbrirPedido(false)} pedido={null} inicial={inicial} tetos={compras.tetos} pedidos={compras.pedidos}
          onSalvo={() => { compras.invalidar(); setAbrirPedido(false); setCriado(true) }} />
      )}
    </div>
  )
}

export default PedidoSugeridoCombustivel
