import type { ReactNode } from 'react'
import { Package } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { GUIAS } from '@/lib/guiasModais'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import { STATUS_ESTOQUE, fmtUnidades, fmtDataBR, fmtMes } from '@/pages/Estoques/components/estoqueComum'

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
const ProdutoDetalheModal = ({ produto, janelaDias, coberturaDias, onClose }: {
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
      </DialogContent>
    </Dialog>
  )
}

export default ProdutoDetalheModal
