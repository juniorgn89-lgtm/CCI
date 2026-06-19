import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import useCaixaGeral from '@/pages/CaixasTurnos/hooks/useCaixaGeral'
import useEmpresaAtual from '@/hooks/useEmpresaAtual'
import { useFilterStore } from '@/store/filters'
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from '@/lib/formatters'
import { cn } from '@/lib/utils'

/* ──────────────────────────────────────────────────────────────────────────
 * Relatório "Caixa Geral" — réplica do relatório do webPosto.
 * Visual de relatório (denso, cabeçalho cinza, tabelas com bordas finas).
 * READ-ONLY: só leitura/agregação de dados. Nenhuma ação de escrita.
 * ────────────────────────────────────────────────────────────────────────── */

/** Volume com 2 casas (litros) — padrão dos prints. */
const fmtVol = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

/** Volume com 3 casas (quantidade vendida nos blocos de venda). */
const fmtQty3 = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)

/** Encerrante — inteiro (litros acumulados na bomba). */
const fmtEnc = (v: number): string => formatNumber(Math.round(v))

const fmtPreco = (v: number): string =>
  'R$ ' + new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)

/* ── Blocos visuais reutilizáveis ── */

interface SectionProps {
  title: string
  children: React.ReactNode
  /** Inicia expandida. Default: recolhida. */
  defaultOpen?: boolean
  /** Totalizador mostrado no cabeçalho quando o bloco está recolhido. */
  summary?: React.ReactNode
}

const Section = ({ title, children, defaultOpen = false, summary }: SectionProps) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 bg-gray-100 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
          open && 'border-b border-gray-300 dark:border-gray-700',
        )}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <span>{title}</span>
        {!open && summary != null && (
          <span className="ml-auto normal-case tabular-nums text-gray-600 dark:text-gray-300">{summary}</span>
        )}
      </button>
      {open && <div className="overflow-x-auto">{children}</div>}
    </section>
  )
}

const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th className={cn('px-3 py-1.5 text-left font-medium', className)}>{children}</th>
)

const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <td className={cn('px-3 py-1 tabular-nums', className)}>{children}</td>
)

/* ── Skeleton de carregamento ── */

const ReportSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-20 w-full rounded-lg" />
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-40 w-full rounded-lg" />
    ))}
  </div>
)

/* ── Componente principal ── */

const CaixaGeralReport = () => {
  const { data, isLoading } = useCaixaGeral()
  const empresa = useEmpresaAtual()
  const { dataInicial, dataFinal } = useFilterStore()

  const agora = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date()),
    [],
  )

  if (isLoading) return <ReportSkeleton />

  const {
    bicos,
    bicoTotais,
    vendasCombustivel,
    vendasCombustivelTotais,
    vendasGrupos,
    vendasGruposTotais,
    cobrar,
    cobrarTotal,
    saidas,
    saidasTotal,
    entradas,
    entradasTotal,
    diferencasFechamento,
  } = data

  const temSaldo = vendasCombustivel.some((r) => r.saldo !== null)

  return (
    <div className="space-y-4 text-sm">
      {/* ── BLOCO 1 — Cabeçalho ── */}
      <header className="rounded-lg border border-gray-300 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">Caixa Geral</h1>
            <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
              {empresa?.nome ?? 'Posto'}
            </p>
            {empresa?.cnpj && (
              <p className="text-xs text-gray-500 dark:text-gray-400">CNPJ: {empresa.cnpj}</p>
            )}
          </div>
          <div className="text-right text-xs text-gray-600 dark:text-gray-400">
            <p>
              <span className="font-medium text-gray-500 dark:text-gray-400">Data Inicial: </span>
              {dataInicial ? formatDate(dataInicial) : '—'}
            </p>
            <p>
              <span className="font-medium text-gray-500 dark:text-gray-400">Data Final: </span>
              {dataFinal ? formatDate(dataFinal) : '—'}
            </p>
            <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">por Data de Movimento</p>
            <p className="mt-1 text-[11px] text-gray-400">Emitido em {agora}</p>
          </div>
        </div>
      </header>

      {/* ── BLOCO 2 — Movimentação de Bicos / Valores (R$) ── */}
      <Section title="Movimentação de Bicos / Valores (R$)" summary={formatCurrency(bicoTotais.totalLiquido)}>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            <tr>
              <Th>Bico</Th>
              <Th className="text-right">Enc. Inicial</Th>
              <Th className="text-right">Enc. Final</Th>
              <Th className="text-right">Aferição</Th>
              <Th className="text-right">Vol. Vendas</Th>
              <Th className="text-right">Preço Médio</Th>
              <Th className="text-right">Total Líquido</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {bicos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  Nenhuma movimentação de bicos no período.
                </td>
              </tr>
            ) : (
              bicos.map((b) => (
                <tr key={b.label} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <Td className="font-medium text-gray-900 dark:text-gray-100">{b.label}</Td>
                  <Td className="text-right text-gray-600 dark:text-gray-400">{fmtEnc(b.encInicial)}</Td>
                  <Td className="text-right text-gray-600 dark:text-gray-400">{fmtEnc(b.encFinal)}</Td>
                  <Td className="text-right text-gray-700 dark:text-gray-300">{fmtVol(b.afericao)}</Td>
                  <Td className="text-right text-gray-700 dark:text-gray-300">{fmtVol(b.volVendas)}</Td>
                  <Td className="text-right text-gray-700 dark:text-gray-300">{fmtPreco(b.precoMedio)}</Td>
                  <Td className="text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(b.totalLiquido)}</Td>
                </tr>
              ))
            )}
          </tbody>
          {bicos.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold dark:border-gray-700 dark:bg-gray-800/60">
                <Td className="text-gray-800 dark:text-gray-100">Total</Td>
                <Td className="text-right" />
                <Td className="text-right" />
                <Td className="text-right text-gray-900 dark:text-gray-100">{fmtVol(bicoTotais.afericao)}</Td>
                <Td className="text-right text-gray-900 dark:text-gray-100">{fmtVol(bicoTotais.volVendas)}</Td>
                <Td className="text-right" />
                <Td className="text-right text-gray-900 dark:text-gray-100">{formatCurrency(bicoTotais.totalLiquido)}</Td>
              </tr>
            </tfoot>
          )}
        </table>
      </Section>

      {/* ── BLOCO 3a — Vendas de Combustíveis ── */}
      <Section title="Vendas de Combustíveis" summary={formatCurrency(vendasCombustivelTotais.total)}>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            <tr>
              <Th>Combustível</Th>
              <Th className="text-right">Quantidade</Th>
              <Th className="text-right">Pr. Custo Médio</Th>
              <Th className="text-right">Total Custo Médio</Th>
              <Th className="text-right">Total (R$)</Th>
              <Th className="text-right">Margem Bruta (R$)</Th>
              <Th className="text-right">Saldo</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {vendasCombustivel.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  Nenhuma venda de combustível no período.
                </td>
              </tr>
            ) : (
              vendasCombustivel.map((r) => (
                <tr key={r.produtoNome} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <Td className="font-medium text-gray-900 dark:text-gray-100">{r.produtoNome}</Td>
                  <Td className="text-right text-gray-700 dark:text-gray-300">{fmtQty3(r.quantidade)}</Td>
                  <Td className="text-right text-gray-600 dark:text-gray-400">{fmtPreco(r.precoCustoMedio)}</Td>
                  <Td className="text-right text-gray-700 dark:text-gray-300">{formatCurrency(r.totalCustoMedio)}</Td>
                  <Td className="text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(r.total)}</Td>
                  <Td className={cn('text-right font-medium', r.margemBruta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>{formatCurrency(r.margemBruta)}</Td>
                  <Td className="text-right text-gray-600 dark:text-gray-400">
                    {r.saldo === null ? '—' : fmtVol(r.saldo)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
          {vendasCombustivel.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold dark:border-gray-700 dark:bg-gray-800/60">
                <Td className="text-gray-800 dark:text-gray-100">Total</Td>
                <Td className="text-right text-gray-900 dark:text-gray-100">{fmtQty3(vendasCombustivelTotais.quantidade)}</Td>
                <Td className="text-right" />
                <Td className="text-right text-gray-900 dark:text-gray-100">{formatCurrency(vendasCombustivelTotais.totalCusto)}</Td>
                <Td className="text-right text-gray-900 dark:text-gray-100">{formatCurrency(vendasCombustivelTotais.total)}</Td>
                <Td className={cn('text-right', vendasCombustivelTotais.margemBruta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>{formatCurrency(vendasCombustivelTotais.margemBruta)}</Td>
                <Td className="text-right" />
              </tr>
            </tfoot>
          )}
        </table>
        {!temSaldo && vendasCombustivel.length > 0 && (
          <p className="border-t border-gray-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700 dark:border-gray-700 dark:bg-amber-950/30 dark:text-amber-400">
            Coluna "Saldo" indisponível — sem fonte de estoque de tanque (/TANQUE) para este posto.
          </p>
        )}
      </Section>

      {/* ── BLOCO 3b — Vendas por Grupos ── */}
      <Section title="Vendas por Grupos" summary={formatCurrency(vendasGruposTotais.total)}>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            <tr>
              <Th>Grupo</Th>
              <Th className="text-right">Quantidade</Th>
              <Th className="text-right">Total (R$)</Th>
              <Th className="text-right">Margem Bruta (R$)</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {vendasGrupos.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                  Nenhuma venda no período.
                </td>
              </tr>
            ) : (
              vendasGrupos.map((g) => (
                <tr key={g.grupoNome} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <Td className="font-medium text-gray-900 dark:text-gray-100">{g.grupoNome}</Td>
                  <Td className="text-right text-gray-700 dark:text-gray-300">{fmtQty3(g.quantidade)}</Td>
                  <Td className="text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(g.total)}</Td>
                  <Td className={cn('text-right font-medium', g.margemBruta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>{formatCurrency(g.margemBruta)}</Td>
                </tr>
              ))
            )}
          </tbody>
          {vendasGrupos.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold dark:border-gray-700 dark:bg-gray-800/60">
                <Td className="text-gray-800 dark:text-gray-100">Total</Td>
                <Td className="text-right text-gray-900 dark:text-gray-100">{fmtQty3(vendasGruposTotais.quantidade)}</Td>
                <Td className="text-right text-gray-900 dark:text-gray-100">{formatCurrency(vendasGruposTotais.total)}</Td>
                <Td className={cn('text-right', vendasGruposTotais.margemBruta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>{formatCurrency(vendasGruposTotais.margemBruta)}</Td>
              </tr>
            </tfoot>
          )}
        </table>
      </Section>

      {/* ── BLOCO 4a — Vendas a Cobrar ── */}
      <Section title="Vendas a Cobrar" summary={formatCurrency(cobrarTotal)}>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            <tr>
              <Th>Responsável</Th>
              <Th>Documento</Th>
              <Th className="text-right">Valor (R$)</Th>
              <Th className="text-right">Vencimento</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {cobrar.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                  Nenhum título a cobrar no período.
                </td>
              </tr>
            ) : (
              cobrar.map((c, i) => (
                <tr key={`${c.documento}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <Td className="font-medium text-gray-900 dark:text-gray-100">{c.responsavel}</Td>
                  <Td className="text-gray-600 dark:text-gray-400">{c.documento}</Td>
                  <Td className="text-right text-gray-900 dark:text-gray-100">{formatCurrency(c.valor)}</Td>
                  <Td className="text-right text-gray-600 dark:text-gray-400">{c.vencimento ? formatDate(c.vencimento) : '—'}</Td>
                </tr>
              ))
            )}
          </tbody>
          {cobrar.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold dark:border-gray-700 dark:bg-gray-800/60">
                <Td className="text-gray-800 dark:text-gray-100">Total</Td>
                <Td />
                <Td className="text-right text-gray-900 dark:text-gray-100">{formatCurrency(cobrarTotal)}</Td>
                <Td />
              </tr>
            </tfoot>
          )}
        </table>
      </Section>

      {/* ── BLOCO 4b — Movimentação Financeira dos Caixas ── */}
      <Section title="Movimentação Financeira dos Caixas" defaultOpen summary={formatCurrency(saidasTotal)}>
        <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:divide-x md:divide-gray-200 md:dark:divide-gray-700">
          {/* Entradas */}
          <div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <Th>Entradas</Th>
                  <Th className="text-right">Valor (R$)</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {entradas.map((e) => (
                  <tr key={e.nome} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <Td className="text-gray-700 dark:text-gray-300">{e.nome}</Td>
                    <Td className="text-right text-gray-900 dark:text-gray-100">{formatCurrency(e.valor)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold dark:border-gray-700 dark:bg-gray-800/60">
                  <Td className="text-gray-800 dark:text-gray-100">Total Entradas</Td>
                  <Td className="text-right text-gray-900 dark:text-gray-100">{formatCurrency(entradasTotal)}</Td>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Saídas */}
          <div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <Th>Saídas</Th>
                  <Th className="text-right">Valor (R$)</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {saidas.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-gray-400">
                      Sem fechamento de caixa conferido no período.
                    </td>
                  </tr>
                ) : (
                  saidas.map((s) => (
                    <tr key={s.nome} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <Td className="text-gray-700 dark:text-gray-300">{s.nome}</Td>
                      <Td className="text-right text-gray-900 dark:text-gray-100">{formatCurrency(s.valor)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold dark:border-gray-700 dark:bg-gray-800/60">
                  <Td className="text-gray-800 dark:text-gray-100">Total Saídas</Td>
                  <Td className="text-right text-gray-900 dark:text-gray-100">{formatCurrency(saidasTotal)}</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        {/* Fechamento de Caixas: Diferenças */}
        <div className="flex items-center justify-between border-t-2 border-gray-300 bg-gray-100 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
            Fechamento de Caixas: Diferenças
          </span>
          <span className={cn('text-sm font-bold tabular-nums', diferencasFechamento >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>
            {formatCurrency(diferencasFechamento)}
          </span>
        </div>
      </Section>
    </div>
  )
}

export default CaixaGeralReport
