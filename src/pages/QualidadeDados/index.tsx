import { useState } from 'react'
import { ShieldAlert, Fuel, ShoppingCart, Wallet, Boxes, Landmark, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, formatLiters, formatNumber } from '@/lib/formatters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import IssueSection, { type Issue } from '@/pages/QualidadeDados/components/IssueSection'
import LancamentoDetalheModal, { type LancamentoDetalheData } from '@/pages/QualidadeDados/components/LancamentoDetalheModal'
import useQualidadeDados, {
  type QualidadeIssue,
  type AbastecimentoRow,
  type AbastecimentoPrecoSuspeito,
  type CaixaAbertoDetalhe,
  type Caixa,
  type ProdutoEstoqueNegativo,
  type VendaItem,
  type TituloReceber,
  type TituloPagar,
} from '@/pages/QualidadeDados/hooks/useQualidadeDados'

/* ─── Adapters: item bruto → LancamentoDetalheData ─── */

const adaptAbastecimento = (r: AbastecimentoRow, qi: QualidadeIssue): LancamentoDetalheData => {
  const day = r.dataHora.split('T')[0] || r.dataHora.slice(0, 10)
  const motivoMap: Record<string, string> = {
    'data-futura': `Data fiscal ${formatDate(day)} está no futuro — corrija a data no Quality pra esse lançamento entrar nos totais.`,
    'sem-frentista': 'Abastecimento sem frentista vinculado — atribua um frentista no Quality pra preservar o ranking de produtividade.',
    'litros-suspeito': r.litros < 1
      ? `Quantidade de ${r.litros} L é improvável — provável erro de cadastro/leitura.`
      : `Quantidade de ${formatLiters(r.litros)} é fora do esperado (> 200 L) — confirme se não é caminhão/transferência.`,
  }
  return {
    title: `Abastecimento #${r.codigo}`,
    subtitle: `${formatDate(day)} · ${r.empresaNome}`,
    codigoLabel: 'Código do abastecimento (no Quality)',
    codigoValue: String(r.codigo),
    qualityHint: 'Acesse Quality → Operações → Abastecimentos → buscar pelo código acima.',
    motivo: motivoMap[qi.id] ?? qi.description,
    severidade: qi.severity,
    details: [
      { label: 'Data fiscal', value: formatDate(day) },
      { label: 'Posto', value: r.empresaNome },
      { label: 'Frentista', value: r.frentistaNome, highlight: qi.id === 'sem-frentista' },
      { label: 'Bomba / Bico', value: r.bombaDescricao },
      { label: 'Combustível', value: r.combustivelNome },
      { label: 'Litros', value: formatLiters(r.litros), numeric: true, highlight: qi.id === 'litros-suspeito' },
      { label: 'Valor unitário', value: formatCurrency(r.valorUnitario), numeric: true },
      { label: 'Valor total', value: formatCurrency(r.valorTotal), numeric: true },
      { label: 'Placa', value: r.placa },
      { label: 'Preço de custo', value: formatCurrency(r.precoCusto), numeric: true },
      { label: 'Lucro bruto', value: formatCurrency(r.lucroBruto), numeric: true },
    ],
  }
}

const adaptPrecoSuspeito = (r: AbastecimentoPrecoSuspeito, qi: QualidadeIssue): LancamentoDetalheData => {
  const day = r.dataHora.split('T')[0] || r.dataHora.slice(0, 10)
  const desvioPct = r.precoMedio > 0 ? ((r.valorUnitario - r.precoMedio) / r.precoMedio) * 100 : 0
  return {
    title: `Abastecimento #${r.codigo}`,
    subtitle: `${formatDate(day)} · ${r.combustivelNome}`,
    codigoLabel: 'Código do abastecimento (no Quality)',
    codigoValue: String(r.codigo),
    qualityHint: 'Acesse Quality → Operações → Abastecimentos → buscar pelo código acima e verifique o preço aplicado.',
    motivo: `Preço unitário ${formatCurrency(r.valorUnitario)} está ${Math.abs(r.zScore).toFixed(1).replace('.', ',')}σ ${r.zScore > 0 ? 'acima' : 'abaixo'} da média do ${r.combustivelNome} no período. Provável digitação errada na bomba ou troca de preço sem reflexo no cadastro.`,
    severidade: qi.severity,
    details: [
      { label: 'Combustível', value: r.combustivelNome },
      { label: 'Preço unitário', value: formatCurrency(r.valorUnitario), numeric: true, highlight: true },
      { label: 'Preço médio do período', value: formatCurrency(r.precoMedio), numeric: true },
      { label: 'Desvio', value: `${desvioPct > 0 ? '+' : ''}${desvioPct.toFixed(1).replace('.', ',')}% (${r.zScore.toFixed(1).replace('.', ',')}σ)`, numeric: true, highlight: true },
      { label: 'Data', value: formatDate(day) },
      { label: 'Bomba / Bico', value: r.bombaDescricao },
      { label: 'Frentista', value: r.frentistaNome },
      { label: 'Litros', value: formatLiters(r.litros), numeric: true },
      { label: 'Valor total', value: formatCurrency(r.valorTotal), numeric: true },
    ],
  }
}

const adaptVendaItem = (v: VendaItem, qi: QualidadeIssue): LancamentoDetalheData => ({
  title: `Venda #${v.vendaCodigo} · Item ${v.vendaItemCodigo}`,
  subtitle: `${formatDate(v.dataMovimento.substring(0, 10))} · Produto código ${v.produtoCodigo}`,
  codigoLabel: 'Código da venda (no Quality)',
  codigoValue: String(v.vendaCodigo),
  qualityHint: 'Acesse Quality → Vendas → buscar pelo código acima. O item referencia um produto inexistente — recadastre o produto ou remova o item.',
  motivo: `O item referencia o produto código ${v.produtoCodigo}, que não existe em /PRODUTO. O registro de venda fica órfão (sem nome/grupo) e não entra nos relatórios por categoria.`,
  severidade: qi.severity,
  details: [
    { label: 'Venda #', value: v.vendaCodigo, numeric: true },
    { label: 'Item #', value: v.vendaItemCodigo, numeric: true },
    { label: 'Data', value: formatDate(v.dataMovimento.substring(0, 10)) },
    { label: 'Produto código (inexistente)', value: v.produtoCodigo, numeric: true, highlight: true },
    { label: 'Quantidade', value: formatNumber(v.quantidade), numeric: true },
    { label: 'Preço unitário', value: formatCurrency(v.precoVenda), numeric: true },
    { label: 'Valor total venda', value: formatCurrency(v.totalVenda), numeric: true },
    { label: 'Custo total', value: formatCurrency(v.totalCusto), numeric: true },
    { label: 'Desconto', value: formatCurrency(v.totalDesconto), numeric: true },
    { label: 'Acréscimo', value: formatCurrency(v.totalAcrescimo), numeric: true },
  ],
})

const adaptCaixaAberto = (c: CaixaAbertoDetalhe, qi: QualidadeIssue): LancamentoDetalheData => ({
  title: `Caixa #${c.caixaCodigo}`,
  subtitle: `${formatDate(c.dataMovimento.substring(0, 10))} · ${c.turno} · PDV ${c.pdvCodigo}`,
  codigoLabel: 'Código do caixa (no Quality)',
  codigoValue: String(c.caixaCodigo),
  qualityHint: 'Acesse Quality → Caixa → buscar pelo código acima e fechar manualmente. Caixas abertos por dias seguidos quebram o relatório de fechamento.',
  motivo: `Caixa aberto há ${c.diasAberto} dias sem fechamento. Operador esqueceu de encerrar o turno — o caixa precisa ser fechado pra apurar corretamente.`,
  severidade: qi.severity,
  details: [
    { label: 'Data do movimento', value: formatDate(c.dataMovimento.substring(0, 10)) },
    { label: 'Turno', value: c.turno },
    { label: 'PDV', value: `PDV ${c.pdvCodigo}` },
    { label: 'Funcionário', value: c.funcionarioCodigo ? `#${c.funcionarioCodigo}` : '—' },
    { label: 'Abertura', value: c.abertura?.substring(11, 16) ?? '—' },
    { label: 'Dias aberto', value: `${c.diasAberto} dias`, numeric: true, highlight: true },
    { label: 'Apurado parcial', value: formatCurrency(c.apurado), numeric: true },
  ],
})

const adaptCaixaDiferenca = (c: Caixa, qi: QualidadeIssue): LancamentoDetalheData => ({
  title: `Caixa #${c.caixaCodigo}`,
  subtitle: `${formatDate(c.dataMovimento.substring(0, 10))} · ${c.turno} · PDV ${c.pdvCodigo}`,
  codigoLabel: 'Código do caixa (no Quality)',
  codigoValue: String(c.caixaCodigo),
  qualityHint: 'Acesse Quality → Caixa → buscar pelo código acima. Confira sangria, suprimentos e contagem física pra entender a divergência.',
  motivo: `Diferença de ${formatCurrency(c.diferenca)} no fechamento — ${c.diferenca > 0 ? 'sobra' : 'falta'} acima do limite (R$ 100). Investigar erro de digitação, sangria não registrada ou irregularidade.`,
  severidade: qi.severity,
  details: [
    { label: 'Data do movimento', value: formatDate(c.dataMovimento.substring(0, 10)) },
    { label: 'Turno', value: c.turno },
    { label: 'PDV', value: `PDV ${c.pdvCodigo}` },
    { label: 'Funcionário', value: c.funcionarioCodigo ? `#${c.funcionarioCodigo}` : '—' },
    { label: 'Apurado', value: formatCurrency(c.apurado), numeric: true },
    { label: 'Diferença', value: formatCurrency(c.diferenca), numeric: true, highlight: true },
    { label: 'Consolidado', value: c.consolidado ? 'Sim' : 'Não' },
    { label: 'Bloqueado', value: c.bloqueado ? `Sim (${c.tipoBloqueio})` : 'Não' },
  ],
})

const adaptEstoqueNegativo = (p: ProdutoEstoqueNegativo, qi: QualidadeIssue): LancamentoDetalheData => ({
  title: p.nome,
  subtitle: `Produto código ${p.produtoCodigo}`,
  codigoLabel: 'Código do produto (no Quality)',
  codigoValue: String(p.produtoCodigo),
  qualityHint: 'Acesse Quality → Cadastros → Produtos → buscar pelo código acima. Verifique se houve venda sem entrada correspondente ou erro de baixa.',
  motivo: `Estoque com saldo ${formatNumber(p.saldo)} (negativo). Foi vendido mais do que tinha em estoque — entrada de nota pendente ou baixa equivocada.`,
  severidade: qi.severity,
  details: [
    { label: 'Produto', value: p.nome },
    { label: 'Código', value: p.produtoCodigo, numeric: true },
    { label: 'Saldo atual', value: formatNumber(p.saldo), numeric: true, highlight: true },
  ],
})

type TituloSemVenc = (TituloReceber & { _tipo: 'receber' }) | (TituloPagar & { _tipo: 'pagar' })

const adaptTitulo = (t: TituloSemVenc, qi: QualidadeIssue): LancamentoDetalheData => {
  const isReceber = t._tipo === 'receber'
  const codigo = isReceber ? t.tituloCodigo : t.tituloPagarCodigo
  const contraparte = isReceber ? t.nomeCliente : t.nomeFornecedor
  const doc = isReceber ? t.documento : t.numeroTitulo
  return {
    title: `Título ${isReceber ? 'a receber' : 'a pagar'} #${codigo}`,
    subtitle: `${contraparte || '—'} · ${formatCurrency(t.valor)}`,
    codigoLabel: `Código do título ${isReceber ? 'a receber' : 'a pagar'} (no Quality)`,
    codigoValue: String(codigo),
    qualityHint: `Acesse Quality → Financeiro → ${isReceber ? 'Contas a Receber' : 'Contas a Pagar'} → buscar pelo código acima e preencher a data de vencimento.`,
    motivo: 'Título sem data de vencimento válida — não entra no fluxo de caixa nem em alertas de inadimplência/pagamento. Corrigir pra que o título passe a ser projetado.',
    severidade: qi.severity,
    details: [
      { label: 'Tipo', value: isReceber ? 'A receber' : 'A pagar' },
      { label: 'Código', value: codigo, numeric: true },
      { label: 'Documento', value: doc || '—' },
      { label: isReceber ? 'Cliente' : 'Fornecedor', value: contraparte || '—' },
      { label: isReceber ? 'CPF/CNPJ' : 'CPF/CNPJ', value: isReceber ? t.cpfCnpjCliente : t.cpfCnpjFornecedor },
      { label: 'Data movimento', value: t.dataMovimento ? formatDate(t.dataMovimento.substring(0, 10)) : '—' },
      { label: 'Vencimento (faltante)', value: '—', highlight: true },
      { label: 'Valor', value: formatCurrency(t.valor), numeric: true },
    ],
  }
}

/* ─── Renderers de detail por tipo de issue ─── */

interface RowClickable {
  onSelect: (data: LancamentoDetalheData) => void
}

const AbastecimentoTable = ({
  items, qi, onSelect, withPlaca = true,
}: { items: AbastecimentoRow[]; qi: QualidadeIssue; withPlaca?: boolean } & RowClickable) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2 text-left font-medium">Código</th>
          <th className="px-3 py-2 text-left font-medium">Data</th>
          <th className="px-3 py-2 text-left font-medium">Posto</th>
          <th className="px-3 py-2 text-left font-medium">Frentista</th>
          <th className="px-3 py-2 text-left font-medium">Bomba/Bico</th>
          <th className="px-3 py-2 text-left font-medium">Combustível</th>
          <th className="px-3 py-2 text-right font-medium">Litros</th>
          <th className="px-3 py-2 text-right font-medium">Valor</th>
          {withPlaca && <th className="px-3 py-2 text-left font-medium">Placa</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.slice(0, 100).map((r) => {
          const day = r.dataHora.split('T')[0] || r.dataHora.slice(0, 10)
          return (
            <tr
              key={r.codigo}
              className="cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40"
              onClick={() => onSelect(adaptAbastecimento(r, qi))}
            >
              <td className="px-3 py-1.5 font-mono tabular-nums text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">#{r.codigo}</td>
              <td className="px-3 py-1.5 font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatDate(day)}</td>
              <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.empresaNome}</td>
              <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.frentistaNome}</td>
              <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.bombaDescricao}</td>
              <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.combustivelNome}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(r.litros)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(r.valorTotal)}</td>
              {withPlaca && <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.placa}</td>}
            </tr>
          )
        })}
      </tbody>
    </table>
    {items.length > 100 && (
      <p className="px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400">
        Exibindo 100 de {formatNumber(items.length)} — clique numa linha pra ver o código e os detalhes pra busca no Quality.
      </p>
    )}
  </div>
)

const PrecoSuspeitoTable = ({
  items, qi, onSelect,
}: { items: AbastecimentoPrecoSuspeito[]; qi: QualidadeIssue } & RowClickable) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2 text-left font-medium">Código</th>
          <th className="px-3 py-2 text-left font-medium">Data</th>
          <th className="px-3 py-2 text-left font-medium">Combustível</th>
          <th className="px-3 py-2 text-right font-medium">Preço unit.</th>
          <th className="px-3 py-2 text-right font-medium">Média</th>
          <th className="px-3 py-2 text-right font-medium">Z-score</th>
          <th className="px-3 py-2 text-right font-medium">Litros</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.slice(0, 100).map((r) => {
          const day = r.dataHora.split('T')[0] || r.dataHora.slice(0, 10)
          return (
            <tr
              key={r.codigo}
              className="cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40"
              onClick={() => onSelect(adaptPrecoSuspeito(r, qi))}
            >
              <td className="px-3 py-1.5 font-mono tabular-nums text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">#{r.codigo}</td>
              <td className="px-3 py-1.5 font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatDate(day)}</td>
              <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.combustivelNome}</td>
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-red-700 dark:text-red-400">
                {formatCurrency(r.valorUnitario)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatCurrency(r.precoMedio)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {r.zScore > 0 ? '+' : ''}{r.zScore.toFixed(1).replace('.', ',')}σ
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatLiters(r.litros)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
)

const VendaItemSemProdutoTable = ({
  items, qi, onSelect,
}: { items: VendaItem[]; qi: QualidadeIssue } & RowClickable) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2 text-left font-medium">Venda #</th>
          <th className="px-3 py-2 text-left font-medium">Data</th>
          <th className="px-3 py-2 text-left font-medium">Cód. produto</th>
          <th className="px-3 py-2 text-right font-medium">Qtd</th>
          <th className="px-3 py-2 text-right font-medium">Valor</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.slice(0, 100).map((v) => (
          <tr
            key={`${v.vendaCodigo}-${v.vendaItemCodigo}`}
            className="cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40"
            onClick={() => onSelect(adaptVendaItem(v, qi))}
          >
            <td className="px-3 py-1.5 font-mono tabular-nums text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
              #{v.vendaCodigo}
            </td>
            <td className="px-3 py-1.5 font-medium tabular-nums text-gray-900 dark:text-gray-100">
              {formatDate(v.dataMovimento.substring(0, 10))}
            </td>
            <td className="px-3 py-1.5 tabular-nums text-red-700 dark:text-red-400">{v.produtoCodigo}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatNumber(v.quantidade)}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(v.totalVenda)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const CaixaAbertoTable = ({
  items, qi, onSelect,
}: { items: CaixaAbertoDetalhe[]; qi: QualidadeIssue } & RowClickable) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2 text-left font-medium">Caixa #</th>
          <th className="px-3 py-2 text-left font-medium">Data</th>
          <th className="px-3 py-2 text-left font-medium">Turno</th>
          <th className="px-3 py-2 text-left font-medium">PDV</th>
          <th className="px-3 py-2 text-right font-medium">Dias aberto</th>
          <th className="px-3 py-2 text-right font-medium">Apurado</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.slice(0, 100).map((c) => (
          <tr
            key={c.caixaCodigo}
            className="cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40"
            onClick={() => onSelect(adaptCaixaAberto(c, qi))}
          >
            <td className="px-3 py-1.5 font-mono tabular-nums text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
              #{c.caixaCodigo}
            </td>
            <td className="px-3 py-1.5 font-medium tabular-nums text-gray-900 dark:text-gray-100">
              {formatDate(c.dataMovimento.substring(0, 10))}
            </td>
            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{c.turno}</td>
            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">PDV {c.pdvCodigo}</td>
            <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-red-700 dark:text-red-400">
              {c.diasAberto}d
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(c.apurado)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const CaixaDiferencaTable = ({
  items, qi, onSelect,
}: { items: Caixa[]; qi: QualidadeIssue } & RowClickable) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2 text-left font-medium">Caixa #</th>
          <th className="px-3 py-2 text-left font-medium">Data</th>
          <th className="px-3 py-2 text-left font-medium">Turno</th>
          <th className="px-3 py-2 text-left font-medium">PDV</th>
          <th className="px-3 py-2 text-right font-medium">Apurado</th>
          <th className="px-3 py-2 text-right font-medium">Diferença</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.slice(0, 100).map((c) => (
          <tr
            key={c.caixaCodigo}
            className="cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40"
            onClick={() => onSelect(adaptCaixaDiferenca(c, qi))}
          >
            <td className="px-3 py-1.5 font-mono tabular-nums text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
              #{c.caixaCodigo}
            </td>
            <td className="px-3 py-1.5 font-medium tabular-nums text-gray-900 dark:text-gray-100">
              {formatDate(c.dataMovimento.substring(0, 10))}
            </td>
            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{c.turno}</td>
            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">PDV {c.pdvCodigo}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(c.apurado)}</td>
            <td className={cn(
              'px-3 py-1.5 text-right tabular-nums font-semibold',
              c.diferenca >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400',
            )}>
              {formatCurrency(c.diferenca)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const EstoqueNegativoTable = ({
  items, qi, onSelect,
}: { items: ProdutoEstoqueNegativo[]; qi: QualidadeIssue } & RowClickable) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2 text-left font-medium">Código</th>
          <th className="px-3 py-2 text-left font-medium">Produto</th>
          <th className="px-3 py-2 text-right font-medium">Saldo</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.slice(0, 100).map((p) => (
          <tr
            key={p.produtoCodigo}
            className="cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40"
            onClick={() => onSelect(adaptEstoqueNegativo(p, qi))}
          >
            <td className="px-3 py-1.5 font-mono tabular-nums text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
              #{p.produtoCodigo}
            </td>
            <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">{p.nome}</td>
            <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-red-700 dark:text-red-400">
              {formatNumber(p.saldo)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const TituloSemVencTable = ({
  items, qi, onSelect,
}: { items: TituloSemVenc[]; qi: QualidadeIssue } & RowClickable) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2 text-left font-medium">Código</th>
          <th className="px-3 py-2 text-left font-medium">Tipo</th>
          <th className="px-3 py-2 text-left font-medium">Documento</th>
          <th className="px-3 py-2 text-left font-medium">Cliente/Fornecedor</th>
          <th className="px-3 py-2 text-right font-medium">Valor</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.slice(0, 100).map((t) => {
          const codigo = t._tipo === 'receber' ? t.tituloCodigo : t.tituloPagarCodigo
          return (
            <tr
              key={`${t._tipo}-${codigo}`}
              className="cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40"
              onClick={() => onSelect(adaptTitulo(t, qi))}
            >
              <td className="px-3 py-1.5 font-mono tabular-nums text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
                #{codigo}
              </td>
              <td className="px-3 py-1.5">
                <span className={cn(
                  'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                  t._tipo === 'receber'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
                )}>
                  {t._tipo === 'receber' ? 'A receber' : 'A pagar'}
                </span>
              </td>
              <td className="px-3 py-1.5 tabular-nums text-gray-700 dark:text-gray-300">
                {t._tipo === 'receber' ? t.documento : t.numeroTitulo}
              </td>
              <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                {t._tipo === 'receber' ? t.nomeCliente : t.nomeFornecedor}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(t.valor)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
)

/* ─── Adapta QualidadeIssue → Issue do componente IssueSection ─── */

const toIssue = (qi: QualidadeIssue, detail: React.ReactNode): Issue => ({
  id: qi.id,
  label: qi.label,
  description: qi.description,
  severity: qi.severity,
  count: qi.count,
  detail: qi.count > 0 ? detail : undefined,
})

/* ─── Página ─── */

const QualidadeDados = () => {
  const empresaNome = useEmpresaNome()
  const data = useQualidadeDados()
  const [selected, setSelected] = useState<LancamentoDetalheData | null>(null)
  const onSelect = setSelected

  // Monta os issues prontos pra renderizar (com detail apropriado)
  const abastIssues: Issue[] = data.abastecimentos.map((qi) => {
    if (qi.id === 'preco-anormal') {
      return toIssue(qi, <PrecoSuspeitoTable items={qi.items as AbastecimentoPrecoSuspeito[]} qi={qi} onSelect={onSelect} />)
    }
    return toIssue(qi, <AbastecimentoTable items={qi.items as AbastecimentoRow[]} qi={qi} onSelect={onSelect} />)
  })
  const vendasIssues: Issue[] = data.vendas.map((qi) =>
    toIssue(qi, <VendaItemSemProdutoTable items={qi.items as VendaItem[]} qi={qi} onSelect={onSelect} />),
  )
  const caixaIssues: Issue[] = data.caixa.map((qi) => {
    if (qi.id === 'caixa-aberto-muito') {
      return toIssue(qi, <CaixaAbertoTable items={qi.items as CaixaAbertoDetalhe[]} qi={qi} onSelect={onSelect} />)
    }
    return toIssue(qi, <CaixaDiferencaTable items={qi.items as Caixa[]} qi={qi} onSelect={onSelect} />)
  })
  const estoqueIssues: Issue[] = data.estoque.map((qi) =>
    toIssue(qi, <EstoqueNegativoTable items={qi.items as ProdutoEstoqueNegativo[]} qi={qi} onSelect={onSelect} />),
  )
  const financeiroIssues: Issue[] = data.financeiro.map((qi) =>
    toIssue(qi, <TituloSemVencTable items={qi.items as TituloSemVenc[]} qi={qi} onSelect={onSelect} />),
  )

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-900/30">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Qualidade de Dados{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Auditoria automática de erros de digitação e inconsistências nos dados do Quality
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {!data.hasEmpresa && <SelectCompanyState />}

      {data.hasEmpresa && (
        <>
          {/* KPIs principais — totais por severidade */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiQD
              label="Total de inconsistências"
              value={data.isLoading ? null : data.totalIssues}
              hint="Soma de todas as categorias no período"
              Icon={ShieldAlert}
              tone="neutral"
            />
            <KpiQD
              label="Críticos"
              value={data.isLoading ? null : data.totalCriticos}
              hint="Quebram cálculos — corrigir já"
              Icon={AlertTriangle}
              tone="high"
            />
            <KpiQD
              label="Atenção"
              value={data.isLoading ? null : data.totalAtencao}
              hint="Suspeitos — investigar e validar"
              Icon={AlertTriangle}
              tone="medium"
            />
            <KpiQD
              label="Info"
              value={data.isLoading ? null : data.totalInfo}
              hint="Heads-up de qualidade — não bloqueia"
              Icon={Info}
              tone="low"
            />
          </div>

          {/* Banner verde se tudo limpo */}
          {!data.isLoading && data.totalIssues === 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-5 py-4 dark:border-emerald-900/50 dark:bg-emerald-900/20">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  Tudo limpo — sem inconsistências detectadas no período
                </p>
                <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                  Os 9 detectores rodaram e nada foi sinalizado. Próxima verificação automática conforme você navega.
                </p>
              </div>
            </div>
          )}

          {/* Seções por categoria */}
          <div className="grid grid-cols-1 gap-4">
            <IssueSection
              title="Abastecimentos"
              subtitle="Erros nos lançamentos de bomba"
              Icon={Fuel}
              issues={abastIssues}
              isLoading={data.isLoading}
            />
            <IssueSection
              title="Vendas"
              subtitle="Inconsistências no PDV / itens vendidos"
              Icon={ShoppingCart}
              issues={vendasIssues}
              isLoading={data.isLoading}
            />
            <IssueSection
              title="Caixa"
              subtitle="Fechamentos, diferenças e caixas pendurados"
              Icon={Wallet}
              issues={caixaIssues}
              isLoading={data.isLoading}
            />
            <IssueSection
              title="Estoque"
              subtitle="Saldos negativos e divergências de inventário"
              Icon={Boxes}
              issues={estoqueIssues}
              isLoading={data.isLoading}
            />
            <IssueSection
              title="Financeiro"
              subtitle="Títulos a receber e a pagar com problemas de cadastro"
              Icon={Landmark}
              issues={financeiroIssues}
              isLoading={data.isLoading}
            />
          </div>

          {/* Rodapé com nota geral */}
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Clique em qualquer linha pra abrir o detalhe com o código pra busca direta no Quality. Tabelas exibem até 100 registros por detector.
          </p>
        </>
      )}

      {/* Modal de detalhe de lançamento — abre ao clicar em qualquer linha */}
      <LancamentoDetalheModal
        open={selected !== null}
        onClose={() => setSelected(null)}
        data={selected}
      />
    </div>
  )
}

/* ─── KPI compacto pro topo ─── */

interface KpiQDProps {
  label: string
  value: number | null
  hint: string
  Icon: typeof ShieldAlert
  tone: 'high' | 'medium' | 'low' | 'neutral'
}

const KpiQD = ({ label, value, hint, Icon, tone }: KpiQDProps) => {
  const map = {
    high: { bg: 'bg-gradient-to-br from-red-50/60 to-white dark:from-red-950/20 dark:to-gray-900', iconBg: 'bg-red-100 dark:bg-red-900/30', iconColor: 'text-red-600 dark:text-red-400', valueColor: 'text-red-700 dark:text-red-300' },
    medium: { bg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900', iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400', valueColor: 'text-amber-700 dark:text-amber-300' },
    low: { bg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400', valueColor: 'text-blue-700 dark:text-blue-300' },
    neutral: { bg: 'bg-gradient-to-br from-gray-50/60 to-white dark:from-gray-900/40 dark:to-gray-900', iconBg: 'bg-gray-200 dark:bg-gray-800', iconColor: 'text-gray-600 dark:text-gray-300', valueColor: 'text-gray-900 dark:text-gray-100' },
  }
  const s = map[tone]
  return (
    <div className={cn('rounded-xl border border-gray-200 p-5 shadow-sm dark:border-gray-700', s.bg)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', s.iconBg)}>
          <Icon className={cn('h-5 w-5', s.iconColor)} />
        </div>
      </div>
      {value === null ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className={cn('mt-2 text-2xl font-bold tabular-nums', s.valueColor)}>
          {formatNumber(value)}
        </p>
      )}
      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>
    </div>
  )
}

export default QualidadeDados
