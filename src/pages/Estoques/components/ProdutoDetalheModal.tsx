import type { ReactNode } from 'react'
import { Package, ShoppingCart, ArrowLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { GUIAS } from '@/lib/guiasModais'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import { STATUS_ESTOQUE, fmtUnidades, fmtDataBR, fmtMes } from '@/pages/Estoques/components/estoqueComum'
import { ULTIMA_COMPRA_DIAS, type UltimaCompra } from '@/pages/Estoques/hooks/useUltimaCompra'
import { variacaoUltimaCompra, faixaVariacao } from '@/pages/Estoques/lib/analiseProdutos'

const COR_FAIXA = { alta: 'text-red-600 dark:text-[#e3a3a3]', subiu: 'text-amber-600 dark:text-amber-300', caiu: 'text-sky-700 dark:text-[#9db5d6]', normal: 'text-gray-900 dark:text-gray-100' } as const
const AVISO_FAIXA = { alta: 'acima do normal: confira a nota (erro de digitação ou de unidade?) ou se o fornecedor aumentou', subiu: 'subiu em relação ao normal: veja se o preço de venda acompanhou', caiu: 'abaixo do normal: confira a nota (unidade ou digitação)', normal: '' } as const

const Linha = ({ label, children, destaque }: { label: string; children: ReactNode; destaque?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span className={cn('text-right tabular-nums text-gray-900 dark:text-gray-100', destaque ? 'font-bold' : 'font-semibold')}>{children}</span>
  </div>
)

const Bloco = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{titulo}</h4>
    <div className="space-y-1.5">{children}</div>
  </section>
)

/**
 * Tudo de UM produto num lugar: estoque (saldo, mínimo, valor, cobertura),
 * venda (janela, média/dia, giro, mês de pico, 6 meses mês a mês) e preço do
 * cadastro (custo, venda, margem). É o detalhe das abas Produtos e Comprar —
 * por isso as tabelas podem ficar enxutas.
 */
const ProdutoDetalheModal = ({ produto, janelaDias, coberturaDias, onClose, onGerarPedido, onVoltar, compras }: {
  /** Notas de entrada do produto no último ano (mais antiga → mais recente). */
  compras?: UltimaCompra[]
  /** Veio da análise de produtos: mostra "Voltar para a análise". */
  onVoltar?: () => void
  /** Presente = mostra "Gerar pedido de compra" (rede com Compras à vista). */
  onGerarPedido?: () => void
  produto: ProductAnalyticsRow | null
  janelaDias: number
  coberturaDias: number
  onClose: () => void
}) => {
  if (!produto) return null
  const p = produto
  const st = STATUS_ESTOQUE[p.necessidadeStatus]
  const maxMes = Math.max(1, ...p.vendasMensais.map((m) => m.quantidade))
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent guia={GUIAS.produtoEstoque} className="max-h-[88vh] w-[95vw] max-w-3xl overflow-y-auto">
        <DialogHeader>
          {onVoltar && (
            <button type="button" onClick={onVoltar} className="mb-1 inline-flex w-fit items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[12.5px] font-semibold text-teal-800 hover:bg-teal-100 dark:border-[#0d9488]/40 dark:bg-[#0d9488]/[0.10] dark:text-[#5eead4] dark:hover:bg-[#0d9488]/[0.18]">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a análise
            </button>
          )}
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-16">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f] text-white"><Package className="h-4 w-4" /></span>
            {p.produtoNome}
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', st.bg, st.color)}>{st.label}</span>
          </DialogTitle>
          <DialogDescription>
            {p.categoria}{p.codigoSku ? ` · Ref. ${p.codigoSku}` : ''}{p.codigoBarras ? ` · Cód. barras ${p.codigoBarras}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-3">
          <Bloco titulo="Estoque">
            <Linha label="Saldo atual" destaque>
              <span className={cn(p.saldoAtual < 0 ? 'text-red-700 dark:text-red-300' : p.saldoAtual === 0 ? 'text-red-600 dark:text-red-400' : '')}>{fmtUnidades(p.saldoAtual)}</span>
            </Linha>
            <Linha label="Mínimo cadastrado">{p.estoqueMinimo > 0 ? fmtUnidades(p.estoqueMinimo) : '—'}</Linha>
            <Linha label="Valor em estoque">{formatCurrencyInt(p.valorEstoque)}</Linha>
            <Linha label="Dura (cobertura)">{p.mediaDiariaVendas > 0 ? `${Math.round(p.diasCobertura)} dias` : '—'}</Linha>
            <Linha label={`Comprar (meta ${coberturaDias} dias)`}>{p.necessidadeUnidades > 0 ? fmtUnidades(p.necessidadeUnidades) : '—'}</Linha>
          </Bloco>
          <Bloco titulo={`Venda (${janelaDias} dias)`}>
            <Linha label="Vendido" destaque>{fmtUnidades(p.vendasJanela)}</Linha>
            <Linha label="Média por dia">{fmtUnidades(p.mediaDiariaVendas)}</Linha>
            <Linha label="Giro">{p.giroJanela > 0 ? `${p.giroJanela.toFixed(2)}x` : '—'}</Linha>
            <Linha label="Receita">{formatCurrencyInt(p.receitaJanela)}</Linha>
            <Linha label="Última venda">{fmtDataBR(p.ultimaVenda)}</Linha>
          </Bloco>
          <Bloco titulo="Preço do cadastro">
            <Linha label="Custo">{p.precoCustoCadastro > 0 ? formatCurrency(p.precoCustoCadastro) : '—'}</Linha>
            <Linha label="Venda">{p.precoVendaCadastro > 0 ? formatCurrency(p.precoVendaCadastro) : '—'}</Linha>
            <Linha label="Margem por unidade">{p.precoVendaCadastro > 0 ? formatCurrency(p.margemLucroCadastro) : '—'}</Linha>
            <Linha label="Lucro bruto">{p.precoVendaCadastro > 0 ? `${p.lucroBrutoPctCadastro.toFixed(1).replace('.', ',')}%` : '—'}</Linha>
          </Bloco>
        </div>

        {/* Compras (notas de entrada): última × normal + as últimas notas */}
        {compras !== undefined && (() => {
          const vc = variacaoUltimaCompra(compras)
          const ultima = compras[compras.length - 1]
          const faixa = vc ? faixaVariacao(vc.varia) : 'normal'
          const recentes = [...compras].reverse().slice(0, 6)
          return (
            <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Compras (notas de entrada · último ano)</h4>
              {!ultima ? (
                <p className="text-[12.5px] text-gray-500 dark:text-gray-400">Sem nota de entrada deste produto nos últimos {ULTIMA_COMPRA_DIAS} dias.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                  <div className="space-y-1.5">
                    <Linha label="Última compra" destaque>
                      <span className={COR_FAIXA[faixa]}>
                        {vc && faixa !== 'normal' && <span className="mr-1 text-[11px]">{vc.varia > 0 ? '▲' : '▼'} {Math.abs(vc.varia * 100).toFixed(0)}%</span>}
                        {formatCurrency(ultima.custo)}
                      </span>
                    </Linha>
                    <Linha label="Data da nota">{fmtDataBR(ultima.data)}</Linha>
                    <Linha label="Quantidade">{fmtUnidades(ultima.quantidade)}</Linha>
                    <Linha label={vc ? `Normal (mediana de ${compras.length - 1} ${compras.length - 1 === 1 ? 'compra anterior' : 'compras anteriores'})` : 'Normal'}>{vc ? formatCurrency(vc.normal) : '— (só 1 compra no ano)'}</Linha>
                    {faixa !== 'normal' && (
                      <p className={cn('rounded-md px-2 py-1.5 text-[12px] leading-snug', faixa === 'alta' ? 'bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-200' : faixa === 'subiu' ? 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200' : 'bg-sky-50 text-sky-800 dark:bg-sky-400/10 dark:text-sky-200')}>
                        Última compra {AVISO_FAIXA[faixa]}.
                      </p>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800">
                    <table className="w-full text-[12px]">
                      <thead className="text-[10px] uppercase tracking-wide text-gray-400">
                        <tr><th className="px-3 py-1.5 text-left font-semibold">Nota</th><th className="px-3 py-1.5 text-right font-semibold">Qtd.</th><th className="px-3 py-1.5 text-right font-semibold">Custo un.</th></tr>
                      </thead>
                      <tbody>
                        {recentes.map((c, i) => (
                          <tr key={`${c.data}-${i}`}>
                            <td className="px-3 py-1.5 tabular-nums text-gray-600 dark:text-gray-300">{fmtDataBR(c.data)}{i === 0 && <span className="ml-1 text-[10px] text-gray-400">(última)</span>}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{fmtUnidades(c.quantidade)}</td>
                            <td className={cn('px-3 py-1.5 text-right font-semibold tabular-nums', i === 0 ? COR_FAIXA[faixa] : 'text-gray-800 dark:text-gray-100')}>{formatCurrency(c.custo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {compras.length > recentes.length && <p className="border-t border-gray-100 px-3 py-1.5 text-[10.5px] text-gray-400 dark:border-gray-800">+ {compras.length - recentes.length} notas mais antigas no ano</p>}
                  </div>
                </div>
              )}
            </section>
          )
        })()}

        {p.vendasMensais.length > 0 && (
          <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h4 className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Vendas mês a mês (6 meses)
              {p.mesPico && <span className="normal-case tracking-normal text-gray-500 dark:text-gray-400">pico em {fmtMes(p.mesPico)}: {fmtUnidades(p.vendasPico)}</span>}
            </h4>
            <div className="flex h-28 items-end gap-2">
              {p.vendasMensais.map((m) => (
                <div key={m.mes} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">{fmtUnidades(m.quantidade)}</span>
                  <div className={cn('w-full rounded-t', m.mes === p.mesPico ? 'bg-[#2563eb]' : 'bg-[#2563eb]/40')} style={{ height: `${Math.max(3, (m.quantidade / maxMes) * 72)}px` }} />
                  <span className="text-[10px] text-gray-400">{fmtMes(m.mes)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {onGerarPedido && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-[#2f3b4f]">
            <p className="text-[12.5px] text-gray-500 dark:text-[#94a3b8]">
              {p.necessidadeUnidades > 0 ? <>Sugestão: comprar <b className="font-semibold text-gray-800 dark:text-[#e2e8f0]">{fmtUnidades(Math.ceil(p.necessidadeUnidades))}</b> para {coberturaDias} dias. Você ajusta no pedido.</> : 'O estoque cobre a meta de dias; o pedido abre com 1 unidade para você ajustar.'}
            </p>
            <button type="button" onClick={onGerarPedido}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 text-[13px] font-semibold text-white hover:bg-teal-700">
              <ShoppingCart className="h-4 w-4" /> Gerar pedido de compra
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ProdutoDetalheModal
