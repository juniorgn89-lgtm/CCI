import { useMemo, useState } from 'react'
import { Search, AlertTriangle, AlertCircle, CheckCircle2, AlertOctagon, ShoppingCart } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { usePedidos } from '@/pages/Compras/hooks/usePedidos'
import { fetchItensAbertosDoPosto, STATUS_LABEL } from '@/api/supabase/compras'
import NovoPedidoModal from '@/pages/Compras/NovoPedidoModal'
import DataTable, { type Column } from '@/components/tables/DataTable'
import InfoHint from '@/components/ui/InfoHint'
import CaduHint from '@/components/cadu/CaduHint'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import ProdutoDetalheModal from '@/pages/Estoques/components/ProdutoDetalheModal'
import { STATUS_ESTOQUE, fmtUnidades, casaBusca } from '@/pages/Estoques/components/estoqueComum'

interface Props {
  data: ProductAnalyticsRow[]
  categorias: string[]
  coberturaDias: number
  janelaDias: number
  onCoberturaChange: (dias: number) => void
  /** Posto da pílula (o pedido de compra vai para ele). */
  empresaCodigo: number | null
}


type StatusFilter = 'todos' | 'comprar' | 'negativo' | 'critico' | 'baixo' | 'ok' | 'sem_movimento'


interface SelecaoCfg {
  ativo: boolean
  marcados: Set<number>
  alternar: (codigo: number) => void
  emPedido: Map<number, { numero: number; status: string }>
}
/** Dá para mandar ao Compras? Só o que tem sugestão (negativo/ok/sem movimento não). */
const selecionavel = (r: ProductAnalyticsRow) => r.necessidadeUnidades > 0

const buildColumns = (coberturaDias: number, sel: SelecaoCfg): Column<ProductAnalyticsRow>[] => [
  ...(sel.ativo ? [{
    key: '_sel', label: '',
    render: (r: ProductAnalyticsRow) => (
      <span onClick={(e) => e.stopPropagation()} className="inline-flex">
        <input type="checkbox" aria-label={`Selecionar ${r.produtoNome}`} disabled={!selecionavel(r)} checked={sel.marcados.has(r.produtoCodigo)} onChange={() => sel.alternar(r.produtoCodigo)}
          className="h-4 w-4 cursor-pointer accent-[#1e3a5f] disabled:cursor-not-allowed disabled:opacity-30" />
      </span>
    ),
  } as Column<ProductAnalyticsRow>] : []),
  {
    key: 'produtoNome', label: 'Produto', sortable: true,
    render: (r) => {
      const ped = sel.emPedido.get(r.produtoCodigo)
      return (
        <span>
          <span className="block font-medium">{r.produtoNome}</span>
          <span className="block font-mono text-[10.5px] text-gray-400">{[r.codigoSku && `Ref. ${r.codigoSku}`, r.codigoBarras].filter(Boolean).join(' · ') || '—'}</span>
          {ped && <span className="mt-0.5 inline-flex rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#2563eb] dark:bg-blue-950/30 dark:text-blue-300">em pedido nº {ped.numero} ({ped.status})</span>}
        </span>
      )
    },
  },
  {
    key: 'saldoAtual',
    label: 'Saldo',
    align: 'right',
    sortable: true,
    render: (r) => (
      <span className={cn('tabular-nums', r.saldoAtual < 0 ? 'font-bold text-red-800 dark:text-red-300' : r.saldoAtual === 0 ? 'text-red-600 dark:text-red-400' : '')}>
        {fmtUnidades(r.saldoAtual)}
      </span>
    ),
  },
  {
    key: 'mediaDiariaVendas',
    label: 'Média/dia',
    align: 'right',
    sortable: true,
    render: (r) => <span className="tabular-nums text-gray-700 dark:text-gray-300">{r.mediaDiariaVendas > 0 ? fmtUnidades(r.mediaDiariaVendas) : '—'}</span>,
  },
  {
    key: 'diasCobertura',
    label: 'Cobertura',
    align: 'right',
    sortable: true,
    render: (r) => {
      if (r.mediaDiariaVendas === 0) return <span className="text-gray-400">—</span>
      const dias = r.diasCobertura
      const color = dias < coberturaDias / 2 ? 'text-red-600 dark:text-red-400'
        : dias < coberturaDias ? 'text-amber-600 dark:text-amber-400'
        : 'text-green-600 dark:text-green-400'
      return <span className={cn('tabular-nums font-medium', color)}>{Math.round(dias)} dias</span>
    },
  },
  {
    key: 'necessidadeUnidades',
    label: 'Comprar',
    align: 'right',
    sortable: true,
    render: (r) => {
      if (r.necessidadeUnidades <= 0) return <span className="text-gray-400">—</span>
      const valor = r.necessidadeUnidades * r.custoMedio
      return (
        <div className="text-right">
          <p className="tabular-nums font-bold text-blue-700 dark:text-blue-400">{fmtUnidades(r.necessidadeUnidades)}</p>
          {valor > 0 && <p className="tabular-nums text-[10px] text-gray-400">{formatCurrencyInt(valor)}</p>}
        </div>
      )
    },
  },
  {
    key: 'necessidadeStatus',
    label: 'Status',
    align: 'center',
    sortable: true,
    render: (r) => {
      const meta = STATUS_ESTOQUE[r.necessidadeStatus]
      return (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', meta.bg, meta.color)}>
          {meta.label}
        </span>
      )
    },
  },
]

/** Aba "Comprar" (antiga Necessidade): o que pedir, com o vocabulário único do módulo. */
const ComprarEstoque = ({ data, categorias, coberturaDias, janelaDias, onCoberturaChange, empresaCodigo }: Props) => {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusFilter>('comprar')
  const [coberturaInput, setCoberturaInput] = useState(String(coberturaDias))
  // Guarda só o código: o detalhe lê a linha ATUAL (não congela dado em carregamento).
  const [abertoCodigo, setAbertoCodigo] = useState<number | null>(null)
  const aberto = abertoCodigo == null ? null : data.find((r) => r.produtoCodigo === abertoCodigo) ?? null

  const filtered = useMemo(() => {
    const result = data.filter((r) => {
      if (categoria && r.categoria !== categoria) return false
      if (!casaBusca(r, busca)) return false
      if (filtroStatus === 'comprar' && r.necessidadeUnidades <= 0) return false
      if (filtroStatus !== 'todos' && filtroStatus !== 'comprar' && r.necessidadeStatus !== filtroStatus) return false
      return true
    })
    // Quando vendo negativos, ordena pelo mais negativo (saldo crescente).
    // Para os outros filtros, prioriza maior necessidade de compra.
    if (filtroStatus === 'negativo') {
      return result.sort((a, b) => a.saldoAtual - b.saldoAtual)
    }
    return result.sort((a, b) => b.necessidadeUnidades - a.necessidadeUnidades)
  }, [data, busca, categoria, filtroStatus])

  const totals = useMemo(() => {
    const aComprar = data.filter((r) => r.necessidadeUnidades > 0)
    const totalUnidades = aComprar.reduce((s, r) => s + r.necessidadeUnidades, 0)
    const valorEstimado = aComprar.reduce((s, r) => s + r.necessidadeUnidades * r.custoMedio, 0)
    const negativos = data.filter((r) => r.necessidadeStatus === 'negativo').length
    const criticos = data.filter((r) => r.necessidadeStatus === 'critico').length
    const baixos = data.filter((r) => r.necessidadeStatus === 'baixo').length
    const oks = data.filter((r) => r.necessidadeStatus === 'ok').length
    return { aComprar: aComprar.length, totalUnidades, valorEstimado, negativos, criticos, baixos, oks }
  }, [data])

  // ── Enviar para o Compras (só na rede com o módulo Compras ligado) ──
  const rede = useTenantStore((st) => st.rede)
  const comprasOn = !!rede?.compras_habilitado
  const redeCompras = comprasOn ? rede?.id ?? null : null
  const compras = usePedidos(redeCompras)
  const abertos = useQuery({
    queryKey: ['compras-itens', 'abertos', redeCompras, empresaCodigo],
    queryFn: () => fetchItensAbertosDoPosto(redeCompras!, empresaCodigo!),
    enabled: !!redeCompras && empresaCodigo != null,
    staleTime: 30_000,
  })
  const emPedido = useMemo(() => {
    const m = new Map<number, { numero: number; status: string }>()
    for (const i of abertos.data ?? []) if (!m.has(i.produto_codigo)) m.set(i.produto_codigo, { numero: i.numero, status: STATUS_LABEL[i.status].toLowerCase() })
    return m
  }, [abertos.data])
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const [pedidoAberto, setPedidoAberto] = useState(false)
  const alternar = (codigo: number) => setMarcados((m) => { const n = new Set(m); if (n.has(codigo)) n.delete(codigo); else n.add(codigo); return n })
  const columns = useMemo(() => buildColumns(coberturaDias, { ativo: comprasOn, marcados, alternar, emPedido }), [coberturaDias, comprasOn, marcados, emPedido])
  const visiveisSelecionaveis = filtered.filter(selecionavel)
  const selecionados = data.filter((r) => marcados.has(r.produtoCodigo))
  const selUnidades = selecionados.reduce((n, r) => n + Math.ceil(r.necessidadeUnidades), 0)
  const custoUn = (r: ProductAnalyticsRow) => (r.precoCustoCadastro > 0 ? r.precoCustoCadastro : r.custoMedio)
  const selValor = selecionados.reduce((n, r) => n + Math.ceil(r.necessidadeUnidades) * custoUn(r), 0)
  const inicialPedido = empresaCodigo != null ? {
    empresa: empresaCodigo,
    itens: selecionados.map((r) => ({
      produto_codigo: r.produtoCodigo,
      produto_nome: r.produtoNome,
      unidade: null,
      qtd_solicitada: Math.ceil(r.necessidadeUnidades),
      custo_unit: Number(custoUn(r).toFixed(2)),
      justificativa: `do Estoques: ${STATUS_ESTOQUE[r.necessidadeStatus].label.toLowerCase()}, saldo ${fmtUnidades(r.saldoAtual)}, dura ${Math.round(r.diasCobertura)} dias (meta ${coberturaDias})`,
    })),
  } : undefined

  const applyCobertura = () => {
    const n = Number(coberturaInput)
    if (n > 0) onCoberturaChange(n)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setFiltroStatus('negativo')}
          className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-left transition-all hover:shadow-md dark:border-red-800/60 dark:bg-red-900/20"
        >
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-red-800 dark:text-red-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Saldo negativo</span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-800 dark:text-red-400">
            {totals.negativos}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">provável erro de lançamento: investigar</p>
        </button>
        <button
          type="button"
          onClick={() => setFiltroStatus('critico')}
          className="rounded-xl border border-red-200 bg-red-50/40 p-4 text-left transition-all hover:shadow-md dark:border-red-800/40 dark:bg-red-900/10"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Urgentes</span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">{totals.criticos}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">zerado com venda ou dura menos da metade da meta</p>
        </button>
        <button
          type="button"
          onClick={() => setFiltroStatus('baixo')}
          className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-left transition-all hover:shadow-md dark:border-amber-800/40 dark:bg-amber-900/10"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Cobertura curta</span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{totals.baixos}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">dura menos que a meta de dias</p>
        </button>
        <button
          type="button"
          onClick={() => setFiltroStatus('ok')}
          className="rounded-xl border border-green-200 bg-green-50/40 p-4 text-left transition-all hover:shadow-md dark:border-green-800/40 dark:bg-green-900/10"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">OK</span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">{totals.oks}</p>
        </button>
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-800/40 dark:bg-blue-900/10">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Custo estimado da compra</span>
          <p className="mt-1 text-xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
            {formatCurrency(totals.valorEstimado)}
          </p>
          <p className="text-[10px] text-gray-500">{totals.aComprar} produtos · {fmtUnidades(totals.totalUnidades)} unidades</p>
        </div>
      </div>

      <CaduHint
        exemplos={['Quero 5 produtos parados há mais de 90 dias no meu estoque pra montar uma promoção.']}
        storageKey="cadu-hint:estoques-necessidade"
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h3 className="flex items-center gap-1.5 text-base font-semibold text-gray-900 dark:text-gray-100">
              O que comprar
              <InfoHint text={`Compara o saldo com a venda dos últimos ${janelaDias} dias para sugerir quanto comprar até cobrir ${coberturaDias} dias. Cobertura = quantos dias o saldo dura no ritmo de venda. Urgente = zerado com venda ou dura menos da metade da meta; Cobertura curta = dura menos que a meta; Saldo negativo = provável erro de lançamento (não vira sugestão de compra). Clique num produto para o detalhe.`} />
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Compara o saldo atual com a média de venda dos últimos {janelaDias} dias para sugerir compra de cobertura de {coberturaDias} dias
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              Cobertura:
              <input
                type="number"
                min={1}
                max={365}
                value={coberturaInput}
                onChange={(e) => setCoberturaInput(e.target.value)}
                onBlur={applyCobertura}
                onKeyDown={(e) => { if (e.key === 'Enter') applyCobertura() }}
                className="h-8 w-16 rounded-md border border-gray-200 bg-white px-2 text-center text-xs tabular-nums text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200"
              />
              dias
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar produto, Ref. ou cód. barras..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-8 w-48 rounded-md border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200"
              />
            </div>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none dark:border-gray-700 dark:bg-[#0f0f0f] dark:hover:bg-gray-800 dark:text-gray-200"
            >
              <option value="">Todas categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800/50">
          {([
            { v: 'comprar', l: 'Precisam comprar' },
            { v: 'negativo', l: 'Saldo negativo' },
            { v: 'critico', l: 'Urgentes' },
            { v: 'baixo', l: 'Cobertura curta' },
            { v: 'ok', l: 'OK' },
            { v: 'sem_movimento', l: 'Sem movimento' },
            { v: 'todos', l: 'Todos' },
          ] as { v: StatusFilter; l: string }[]).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setFiltroStatus(opt.v)}
              className={cn(
                'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                filtroStatus === opt.v
                  ? 'bg-[#1e3a5f] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              )}
            >
              {opt.l}
            </button>
          ))}
        </div>

        {comprasOn && visiveisSelecionaveis.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-2 text-[12px] dark:border-gray-700">
            <button type="button" onClick={() => setMarcados((m) => { const n = new Set(m); for (const r of visiveisSelecionaveis) n.add(r.produtoCodigo); return n })} className="font-semibold text-[#2563eb] hover:underline dark:text-blue-300">
              Selecionar os {visiveisSelecionaveis.length} da lista
            </button>
            {marcados.size > 0 && <button type="button" onClick={() => setMarcados(new Set())} className="text-gray-500 hover:underline dark:text-gray-400">Limpar seleção</button>}
            <span className="text-gray-400">Marque os produtos e crie o pedido de compra direto daqui.</span>
          </div>
        )}
        <DataTable columns={columns} data={filtered} keyExtractor={(r) => r.produtoCodigo} enableRowHighlight onRowClick={(r) => setAbertoCodigo(r.produtoCodigo)} />
      </div>

      {/* Barra da seleção → Compras */}
      {comprasOn && marcados.size > 0 && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-[#1e3a5f]/30 bg-white px-4 py-3 shadow-xl dark:border-blue-400/30 dark:bg-gray-900">
          <ShoppingCart className="h-5 w-5 text-[#1e3a5f] dark:text-blue-300" />
          <span className="text-[13px] text-gray-700 dark:text-gray-200">
            <b className="font-semibold">{marcados.size} {marcados.size === 1 ? 'produto' : 'produtos'}</b> · {fmtUnidades(selUnidades)} unidades · {formatCurrency(selValor)}
          </span>
          <span className="text-[11px] text-gray-400">o fornecedor vem da última compra de cada produto; itens de fornecedores diferentes viram pedidos separados</span>
          <button type="button" onClick={() => setPedidoAberto(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#172d4a]">
            <ShoppingCart className="h-4 w-4" /> Criar pedido de compra
          </button>
        </div>
      )}
      {pedidoAberto && inicialPedido && (
        <NovoPedidoModal open onClose={() => setPedidoAberto(false)} pedido={null} inicial={inicialPedido} tetos={compras.tetos} pedidos={compras.pedidos}
          onSalvo={() => { compras.invalidar(); setPedidoAberto(false); setMarcados(new Set()) }} />
      )}

      <ProdutoDetalheModal produto={aberto} janelaDias={janelaDias} coberturaDias={coberturaDias} onClose={() => setAbertoCodigo(null)} />
    </div>
  )
}

export default ComprarEstoque
