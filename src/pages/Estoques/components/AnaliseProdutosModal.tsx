import { useMemo, useState } from 'react'
import { Sparkles, Loader2, CheckCircle2, ChevronRight, ArrowLeft, CalendarRange, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import SelectBusca from '@/components/filters/SelectBusca'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import type { UltimaCompra } from '@/pages/Estoques/hooks/useUltimaCompra'
import { SETOR_ESTOQUE_LABEL, type SetorEstoque } from '@/pages/Estoques/hooks/useSetorProduto'
import { analisarProdutos, variacaoUltimaCompra, faixaVariacao, TIPOS, ORDEM_TIPOS, LIMITE_COMPRA, type Achado } from '@/pages/Estoques/lib/analiseProdutos'
import { ULTIMA_COMPRA_DIAS } from '@/pages/Estoques/hooks/useUltimaCompra'
import { todayLocal } from '@/lib/period'

const dataBR = (iso: string) => iso.split('-').reverse().join('/')
const menosDias = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(y, m - 1, d - n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` }
const un = (v: number) => (Math.round(v * 100) / 100).toLocaleString('pt-BR')
const COR_FAIXA = {
  alta: 'text-red-600 dark:text-[#e3a3a3]',
  subiu: 'text-amber-600 dark:text-amber-300',
  caiu: 'text-sky-700 dark:text-[#9db5d6]',
  normal: 'text-gray-800 dark:text-[#e2e8f0]',
} as const

const QUANTOS = [5, 10, 15, 20] as const
const sel = 'h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-800 outline-none focus:border-teal-500 dark:border-[#2f3b4f] dark:bg-[#0b1220] dark:text-[#e2e8f0]'

/**
 * "Analisar produtos": a pessoa escolhe o recorte (os N que mais vendem, setor,
 * categoria) e a tela aponta o que está estranho nos produtos que VENDEM.
 */
const AnaliseProdutosModal = ({ open, onClose, data, categorias, setorDe, historico, carregandoCompras, onAbrirProduto, janelaDias }: {
  /** Janela de venda usada (dias até hoje). */
  janelaDias: number
  open: boolean
  onClose: () => void
  data: ProductAnalyticsRow[]
  categorias: string[]
  setorDe: (codigo: number) => SetorEstoque
  historico: Map<number, UltimaCompra[]>
  carregandoCompras: boolean
  onAbrirProduto: (codigo: number) => void
}) => {
  const [quantos, setQuantos] = useState<number | 'todos'>(10)
  const [setor, setSetor] = useState<SetorEstoque | ''>('')
  const [categoria, setCategoria] = useState('')
  const [rodou, setRodou] = useState(false)
  const [vista, setVista] = useState<'produto' | 'sinal'>('produto')
  const hoje = todayLocal()
  const periodo = `Vendas de ${dataBR(menosDias(hoje, janelaDias - 1))} a ${dataBR(hoje)} (${janelaDias} dias) · notas de entrada desde ${dataBR(menosDias(hoje, ULTIMA_COMPRA_DIAS))} · saldo de hoje`

  const escopo = useMemo(() => {
    const vendem = data
      .filter((r) => r.vendasJanela > 0)
      .filter((r) => (!setor || setorDe(r.produtoCodigo) === setor) && (!categoria || r.categoria === categoria))
      .sort((a, b) => b.receitaJanela - a.receitaJanela)
    return quantos === 'todos' ? vendem : vendem.slice(0, quantos)
  }, [data, setor, categoria, quantos, setorDe])
  const achados = useMemo(() => (rodou ? analisarProdutos(escopo, historico) : []), [rodou, escopo, historico])
  const porTipo = useMemo(() => {
    const m = new Map<string, Achado[]>()
    for (const a of achados) m.set(a.tipo, [...(m.get(a.tipo) ?? []), a])
    return ORDEM_TIPOS.filter((t) => m.has(t)).map((t) => ({ tipo: t, lista: m.get(t)! }))
  }, [achados])
  const produtosComAchado = new Set(achados.map((a) => a.produto.produtoCodigo)).size
  const achadosDe = useMemo(() => {
    const m = new Map<number, Achado[]>()
    for (const a of achados) m.set(a.produto.produtoCodigo, [...(m.get(a.produto.produtoCodigo) ?? []), a])
    return m
  }, [achados])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setRodou(false); onClose() } }}>
      <DialogContent className={cn('flex max-h-[88vh] w-[96vw] max-w-4xl flex-col', rodou ? 'overflow-hidden' : 'overflow-visible')}>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2"><Sparkles className="h-5 w-5 text-teal-600 dark:text-[#5eead4]" /> Analisar produtos</DialogTitle>
          <DialogDescription>Só produtos que venderam no período. Procura o que está estranho no estoque, no custo e nas notas de entrada.</DialogDescription>
        </DialogHeader>

        {!rodou ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-[12px] font-semibold text-gray-600 dark:text-[#94a3b8]">Quantos produtos
                <select className={cn(sel, 'mt-1')} value={String(quantos)} onChange={(e) => setQuantos(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}>
                  {QUANTOS.map((n) => <option key={n} value={n}>Os {n} que mais vendem</option>)}
                  <option value="todos">Todos os que venderam</option>
                </select>
              </label>
              <label className="block text-[12px] font-semibold text-gray-600 dark:text-[#94a3b8]">Setor
                <select className={cn(sel, 'mt-1')} value={setor} onChange={(e) => setSetor(e.target.value as SetorEstoque | '')}>
                  <option value="">Todos os setores</option>
                  {(Object.keys(SETOR_ESTOQUE_LABEL) as SetorEstoque[]).map((k) => <option key={k} value={k}>{SETOR_ESTOQUE_LABEL[k]}</option>)}
                </select>
              </label>
              <div className="block text-[12px] font-semibold text-gray-600 dark:text-[#94a3b8]">Categoria
                <SelectBusca className="mt-1" valor={categoria} onChange={setCategoria} opcoes={categorias} rotuloTodos="Todas as categorias" placeholder="Buscar categoria…" ariaLabel="Categoria" />
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-[12.5px] leading-relaxed text-gray-600 dark:bg-[#0b1220] dark:text-[#94a3b8]">
              <p className="mb-1 font-semibold text-gray-800 dark:text-[#e2e8f0]">O que a análise procura</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {ORDEM_TIPOS.map((t) => <li key={t}>{TIPOS[t].titulo}</li>)}
              </ul>
              <p className="mt-1.5 text-[11.5px]">"Fora do normal" = a última nota {Math.round(LIMITE_COMPRA * 100)}% acima ou abaixo da mediana das compras anteriores do ano.</p>
            </div>
            <p className="inline-flex items-start gap-1.5 text-[12px] text-gray-500 dark:text-[#94a3b8]"><CalendarRange className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {periodo}</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-gray-500 dark:text-[#94a3b8]">{escopo.length} {escopo.length === 1 ? 'produto entra' : 'produtos entram'} na análise</span>
              <button type="button" disabled={escopo.length === 0 || carregandoCompras} onClick={() => setRodou(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-[13px] font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                {carregandoCompras ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando as notas…</> : <><Sparkles className="h-4 w-4" /> Analisar</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            {/* Cabeçalho fixo: resumo, datas e forma de ver */}
            <div className="sticky top-0 z-10 space-y-2 border-b border-gray-100 bg-white pb-3 dark:border-[#2f3b4f] dark:bg-[#1e293b]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-gray-700 dark:text-[#e2e8f0]">
                  {achados.length === 0
                    ? <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-[#86c5aa]"><CheckCircle2 className="h-4 w-4" /> Nenhum sinal estranho nos {escopo.length} produtos analisados.</span>
                    : <><b className="font-semibold">{escopo.length} produtos analisados</b> · {produtosComAchado} com sinal · {achados.length} {achados.length === 1 ? 'sinal' : 'sinais'}</>}
                </p>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-[#2f3b4f]">
                    {([['produto', 'Por produto'], ['sinal', 'Por sinal']] as const).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setVista(v)}
                        className={cn('rounded-md px-2.5 py-1 text-[12px] font-semibold', vista === v ? 'bg-teal-600 text-white dark:bg-[#0d9488]/25 dark:text-[#5eead4]' : 'text-gray-500 hover:text-gray-800 dark:text-[#94a3b8] dark:hover:text-white')}>{l}</button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setRodou(false)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-teal-700 hover:underline dark:text-[#5eead4]"><ArrowLeft className="h-3.5 w-3.5" /> Mudar o recorte</button>
                </div>
              </div>
              <p className="inline-flex items-start gap-1.5 text-[11.5px] text-gray-500 dark:text-[#94a3b8]"><CalendarRange className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {periodo}</p>
            </div>

            {vista === 'produto' ? (
              /* Todos os produtos do recorte, na ordem de venda, com os sinais de cada um */
              <ul className="mt-3 space-y-2">
                {escopo.map((p, idx) => {
                  const lista = achadosDe.get(p.produtoCodigo) ?? []
                  const vc = variacaoUltimaCompra(historico.get(p.produtoCodigo))
                  const ultima = historico.get(p.produtoCodigo)?.slice(-1)[0]
                  const faixa = vc ? faixaVariacao(vc.varia) : 'normal'
                  const preco = p.precoVendaCadastro > 0 ? p.precoVendaCadastro : p.precoMedioVenda
                  return (
                    <li key={p.produtoCodigo}>
                      <button type="button" onClick={() => onAbrirProduto(p.produtoCodigo)}
                        className={cn('w-full rounded-xl border p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]', lista.length > 0 ? 'border-amber-200 dark:border-[#c79a4a]/40' : 'border-gray-200 dark:border-[#2f3b4f]')}>
                        <span className="flex items-start gap-3">
                          <span className="mt-0.5 w-6 shrink-0 text-right text-[12px] font-semibold tabular-nums text-gray-400">{idx + 1}º</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                              <span className="truncate text-[13.5px] font-semibold text-gray-900 dark:text-[#f1f5f9]">{p.produtoNome}</span>
                              {lista.length === 0
                                ? <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700 dark:text-[#86c5aa]"><CheckCircle2 className="h-3.5 w-3.5" /> Nenhum sinal</span>
                                : <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> {lista.length} {lista.length === 1 ? 'sinal' : 'sinais'}</span>}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-gray-500 dark:text-[#94a3b8]">
                              <span>Vendeu <b className="font-semibold text-gray-800 dark:text-[#e2e8f0]">{un(p.vendasJanela)}</b> · {formatCurrencyInt(p.receitaJanela)}</span>
                              <span>Saldo <b className={cn('font-semibold', p.saldoAtual <= 0 ? 'text-red-600 dark:text-[#e3a3a3]' : 'text-gray-800 dark:text-[#e2e8f0]')}>{un(p.saldoAtual)}</b></span>
                              <span>Preço <b className="font-semibold text-gray-800 dark:text-[#e2e8f0]">{preco > 0 ? formatCurrency(preco) : '—'}</b></span>
                              <span>Últ. compra {ultima
                                ? <><b className={cn('font-semibold', COR_FAIXA[faixa])}>{formatCurrency(ultima.custo)}</b>{vc && faixa !== 'normal' && <b className={cn('ml-1 font-semibold', COR_FAIXA[faixa])}>{vc.varia > 0 ? '▲' : '▼'} {Math.abs(vc.varia * 100).toFixed(0)}%</b>} <span className="text-gray-400">em {dataBR(ultima.data)}</span></>
                                : <b className="font-semibold text-gray-400">sem nota no ano</b>}</span>
                            </span>
                            {lista.length > 0 && (
                              <span className="mt-2 block space-y-1">
                                {lista.map((a) => (
                                  <span key={a.tipo} className="block rounded-md bg-amber-50 px-2 py-1 text-[12px] text-amber-900 dark:bg-amber-400/[0.08] dark:text-amber-100">
                                    <b className="font-semibold">{TIPOS[a.tipo].titulo}:</b> {a.detalhe}
                                  </span>
                                ))}
                              </span>
                            )}
                          </span>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="mt-3 space-y-4">
                {porTipo.length === 0 && <p className="py-6 text-center text-[13px] text-gray-500">Nenhum sinal para agrupar.</p>}
                {porTipo.map(({ tipo, lista }) => (
                  <section key={tipo} className="overflow-hidden rounded-xl border border-gray-200 dark:border-[#2f3b4f]">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 bg-gray-50 px-4 py-2.5 dark:bg-[#0b1220]">
                      <p className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-gray-900 dark:text-[#f1f5f9]">{TIPOS[tipo].titulo} <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">{lista.length}</span></p>
                      <p className="text-[12px] text-gray-500 dark:text-[#94a3b8]">O que fazer: {TIPOS[tipo].oQueFazer}</p>
                    </div>
                    <ul className="divide-y divide-gray-100 dark:divide-[#2f3b4f]">
                      {lista.map((a) => (
                        <li key={`${a.tipo}-${a.produto.produtoCodigo}`}>
                          <button type="button" onClick={() => onAbrirProduto(a.produto.produtoCodigo)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold text-gray-900 dark:text-[#f1f5f9]">{a.produto.produtoNome}</span>
                              <span className="block text-[12px] text-gray-600 dark:text-[#cbd5e1]">{a.detalhe}</span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-[13px] font-semibold tabular-nums text-gray-900 dark:text-[#f1f5f9]">{formatCurrencyInt(a.impacto)}</span>
                              <span className="inline-flex items-center gap-1 text-[10.5px] text-gray-400">em jogo <InfoHint text="Valor aproximado envolvido: venda do período (sem estoque / custo zerado), prejuízo do período (abaixo do custo), diferença × quantidade da nota (compra fora do normal) ou margem perdida no período (preço não acompanhou)." /></span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AnaliseProdutosModal
