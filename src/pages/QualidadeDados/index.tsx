import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Fuel, Receipt, Wallet, Boxes, Landmark, CheckCircle2, Archive, ListChecks, ChevronDown, ChevronRight } from 'lucide-react'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import PostoLocalSelect from '@/components/filters/PostoLocalSelect'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, formatLiters, formatNumber } from '@/lib/formatters'
import IssueSection, { type Issue } from '@/pages/QualidadeDados/components/IssueSection'
import QualidadeKpis from '@/pages/QualidadeDados/components/QualidadeKpis'
import SherlockHero from '@/pages/QualidadeDados/components/SherlockHero'
import LancamentoDetalheModal, { type LancamentoDetalheData } from '@/pages/QualidadeDados/components/LancamentoDetalheModal'
import ArquivadosView from '@/pages/QualidadeDados/components/ArquivadosView'
import CupomMontagemDetalhe from '@/pages/QualidadeDados/components/CupomMontagemDetalhe'
import { nivelCupom } from '@/pages/QualidadeDados/lib/cupomNivel'
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
  type CupomMultiAbast,
} from '@/pages/QualidadeDados/hooks/useQualidadeDados'
import useQualidadeArquivados, { keyOf } from '@/pages/QualidadeDados/hooks/useQualidadeArquivados'
import useIsMobile from '@/hooks/useIsMobile'
import QualidadeMobile from '@/pages/QualidadeDados/QualidadeMobile'
import {
  identityAbastecimento,
  identityPrecoSuspeito,
  identityVendaItem,
  identityCaixaAberto,
  identityCaixaDiferenca,
  identityEstoqueNegativo,
  identityTitulo,
  identityCupomMultiAbast,
  type ArquivadoIdentity,
} from '@/pages/QualidadeDados/lib/arquivadoIdentity'
import type { ArquivarInput } from '@/api/supabase/qualidadeArquivados'

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
      { label: 'Desvio', value: `${desvioPct > 0 ? '+' : ''}${desvioPct.toFixed(2).replace('.', ',')}% (${r.zScore.toFixed(1).replace('.', ',')}σ)`, numeric: true, highlight: true },
      { label: 'Data', value: formatDate(day) },
      { label: 'Bomba / Bico', value: r.bombaDescricao },
      { label: 'Frentista', value: r.frentistaNome },
      { label: 'Cliente', value: r.clienteNome },
      { label: 'Forma de pagamento', value: r.formaPagamento },
      { label: 'Adquirente / bandeira', value: r.adquirente },
      { label: 'Placa', value: r.placa },
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

/** Contexto da lista navegável aberta no modal (adaptação lazy do item atual). */
interface NavContext {
  items: unknown[]
  index: number
  adapt: (item: unknown, qi: QualidadeIssue) => LancamentoDetalheData
  qi: QualidadeIssue
}

/**
 * Abre o modal de detalhe com o CONTEXTO da lista (itens visíveis + índice
 * clicado + adaptador), pra permitir navegar ‹ › sem fechar. A adaptação é
 * lazy (só o item atual é adaptado, no render do modal).
 */
interface RowClickable {
  onOpen: <T,>(items: T[], index: number, adapt: (item: T, qi: QualidadeIssue) => LancamentoDetalheData, qi: QualidadeIssue) => void
}

/**
 * Props de seleção pra arquivamento. Quando ausente, a coluna de checkbox
 * fica escondida (modo legado / visão arquivados).
 */
interface SelectionProps<T> {
  tipoIssue: string
  identityOf: (item: T) => ArquivadoIdentity
  selectedKeys: Set<string>
  onToggle: (key: string, rotulo: string) => void
  onToggleAll: (items: { key: string; rotulo: string }[]) => void
}

const RowCheck = ({
  checked, onChange, ariaLabel,
}: { checked: boolean; onChange: () => void; ariaLabel: string }) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={onChange}
    onClick={(e) => e.stopPropagation()}
    aria-label={ariaLabel}
    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
  />
)

/**
 * Header checkbox que reflete o estado dos visíveis: checked = todos
 * marcados, indeterminate = parcial, vazio = nenhum.
 */
const HeaderCheck = ({
  totalVisible, totalSelectedVisible, onToggle,
}: { totalVisible: number; totalSelectedVisible: number; onToggle: () => void }) => {
  const allChecked = totalVisible > 0 && totalSelectedVisible === totalVisible
  const partial = totalSelectedVisible > 0 && totalSelectedVisible < totalVisible
  return (
    <input
      type="checkbox"
      checked={allChecked}
      ref={(el) => { if (el) el.indeterminate = partial }}
      onChange={onToggle}
      aria-label="Marcar todos visíveis"
      title={allChecked ? 'Desmarcar todos visíveis' : 'Marcar todos visíveis'}
      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
    />
  )
}

const AbastecimentoTable = ({
  items, qi, onOpen, withPlaca = true, selection,
}: { items: AbastecimentoRow[]; qi: QualidadeIssue; withPlaca?: boolean; selection?: SelectionProps<AbastecimentoRow> } & RowClickable) => {
  const visible = items.slice(0, 100)
  const visibleIds = visible.map((r) => {
    const id = selection?.identityOf(r)
    return id ? { key: keyOf(selection!.tipoIssue, id.codigo), rotulo: id.rotulo } : null
  })
  const totalSelectedVisible = selection
    ? visibleIds.filter((v) => v && selection.selectedKeys.has(v.key)).length
    : 0
  return (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-transparent dark:text-gray-400">
        <tr>
          {selection && (
            <th className="w-8 px-3 py-2 text-left">
              <HeaderCheck
                totalVisible={visible.length}
                totalSelectedVisible={totalSelectedVisible}
                onToggle={() => selection.onToggleAll(visibleIds.filter((v): v is { key: string; rotulo: string } => !!v))}
              />
            </th>
          )}
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
        {visible.map((r, idx) => {
          const day = r.dataHora.split('T')[0] || r.dataHora.slice(0, 10)
          const vid = visibleIds[idx]
          const isSel = selection && vid ? selection.selectedKeys.has(vid.key) : false
          return (
            <tr
              key={r.codigo}
              className={cn(
                'cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40',
                isSel && 'bg-blue-50/60 dark:bg-blue-900/20',
              )}
              onClick={() => onOpen(visible, idx, adaptAbastecimento, qi)}
            >
              {selection && vid && (
                <td className="px-3 py-1.5">
                  <RowCheck checked={isSel} onChange={() => selection.onToggle(vid.key, vid.rotulo)} ariaLabel={`Selecionar ${vid.rotulo}`} />
                </td>
              )}
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
}

const PrecoSuspeitoTable = ({
  items, qi, onOpen, selection,
}: { items: AbastecimentoPrecoSuspeito[]; qi: QualidadeIssue; selection?: SelectionProps<AbastecimentoPrecoSuspeito> } & RowClickable) => {
  const visible = items.slice(0, 100)
  const visibleIds = visible.map((r) => {
    const id = selection?.identityOf(r)
    return id ? { key: keyOf(selection!.tipoIssue, id.codigo), rotulo: id.rotulo } : null
  })
  const totalSelectedVisible = selection ? visibleIds.filter((v) => v && selection.selectedKeys.has(v.key)).length : 0
  return (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-transparent dark:text-gray-400">
        <tr>
          {selection && (
            <th className="w-8 px-3 py-2 text-left">
              <HeaderCheck totalVisible={visible.length} totalSelectedVisible={totalSelectedVisible} onToggle={() => selection.onToggleAll(visibleIds.filter((v): v is { key: string; rotulo: string } => !!v))} />
            </th>
          )}
          <th className="px-3 py-2 text-left font-medium">Código</th>
          <th className="px-3 py-2 text-left font-medium">Data</th>
          <th className="px-3 py-2 text-left font-medium">Combustível</th>
          <th className="px-3 py-2 text-left font-medium">Cliente</th>
          <th className="px-3 py-2 text-left font-medium">Forma pgto</th>
          <th className="px-3 py-2 text-right font-medium">Preço unit.</th>
          <th className="px-3 py-2 text-right font-medium">Média</th>
          <th className="px-3 py-2 text-right font-medium">Z-score</th>
          <th className="px-3 py-2 text-right font-medium">Litros</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {visible.map((r, idx) => {
          const day = r.dataHora.split('T')[0] || r.dataHora.slice(0, 10)
          const vid = visibleIds[idx]
          const isSel = selection && vid ? selection.selectedKeys.has(vid.key) : false
          return (
            <tr
              key={r.codigo}
              className={cn('cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40', isSel && 'bg-blue-50/60 dark:bg-blue-900/20')}
              onClick={() => onOpen(visible, idx, adaptPrecoSuspeito, qi)}
            >
              {selection && vid && (
                <td className="px-3 py-1.5">
                  <RowCheck checked={isSel} onChange={() => selection.onToggle(vid.key, vid.rotulo)} ariaLabel={`Selecionar ${vid.rotulo}`} />
                </td>
              )}
              <td className="px-3 py-1.5 font-mono tabular-nums text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">#{r.codigo}</td>
              <td className="px-3 py-1.5 font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatDate(day)}</td>
              <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{r.combustivelNome}</td>
              <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{r.clienteNome}</td>
              <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{r.formaPagamento}</td>
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
}

/* ─── Adapter Cupom Multi-Abast ─── */
const adaptCupomMultiAbast = (c: CupomMultiAbast, _qi: QualidadeIssue): LancamentoDetalheData => {
  void _qi
  const day = c.dataHora.split('T')[0] || c.dataHora.slice(0, 10)
  const hora = c.dataHora.includes('T') ? c.dataHora.split('T')[1]?.substring(0, 5) : c.dataHora.substring(11, 16)
  // O corpo é um relatório próprio (CupomMontagemDetalhe): veredito, sinais,
  // linha do tempo, fechamento e o que fazer. Os campos genéricos ficam
  // preenchidos só por compatibilidade de tipo.
  return {
    title: `Cupom ${c.vendaCodigo}`,
    subtitle: `${formatDate(day)} ${hora} · ${c.funcionarioNome}`,
    codigoLabel: 'Código da venda (no Quality)',
    codigoValue: String(c.vendaCodigo),
    qualityHint: 'Quality › Vendas › buscar pelo código.',
    motivo: '',
    severidade: c.riscoScore === 3 ? 'high' : c.riscoScore === 2 ? 'medium' : 'low',
    details: [],
    selo: nivelCupom(c.riscoScore),
    corpo: <CupomMontagemDetalhe c={c} />,
  }
}


const minutosCurto = (min: number | null) => {
  if (min == null) return null
  if (min < 1) return '<1 min'
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}
const nomeBonito = (s: string) => s.trim().replace(/[\s.]+$/, '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())

/**
 * Cupons "montados" agrupados por frentista: quem mais aparece vem primeiro,
 * com o resumo do grupo (cupons, risco alto, dinheiro) e as linhas enxutas:
 * risco, cupom, quando, itens por combustível, intervalo, total e dinheiro.
 */
const CupomMultiAbastTable = ({
  items, qi, onOpen, selection,
}: { items: CupomMultiAbast[]; qi: QualidadeIssue; selection?: SelectionProps<CupomMultiAbast> } & RowClickable) => {
  // Grupos começam RECOLHIDOS: a visão de entrada é o resumo por frentista; abre quem interessa.
  const [abertos, setAbertos] = useState<Set<number>>(new Set())
  const LIMITE_POR_GRUPO = 40

  // Grupos por frentista, ordenados por risco alto e depois por dinheiro.
  const grupos = (() => {
    const m = new Map<number, { codigo: number; nome: string; cupons: CupomMultiAbast[] }>()
    for (const c of items) {
      const g = m.get(c.funcionarioCodigo) ?? { codigo: c.funcionarioCodigo, nome: c.funcionarioNome, cupons: [] }
      g.cupons.push(c)
      m.set(c.funcionarioCodigo, g)
    }
    return [...m.values()].map((g) => ({
      ...g,
      altos: g.cupons.filter((c) => c.riscoScore === 3).length,
      medios: g.cupons.filter((c) => c.riscoScore === 2).length,
      dinheiro: g.cupons.reduce((s, c) => s + c.dinheiro, 0),
      total: g.cupons.reduce((s, c) => s + c.totalVenda, 0),
      itens: g.cupons.reduce((s, c) => s + c.abastecimentos.length, 0),
    })).sort((a, b) => b.altos - a.altos || b.dinheiro - a.dinheiro || b.cupons.length - a.cupons.length)
  })()

  const idDe = (c: CupomMultiAbast) => {
    const id = selection?.identityOf(c)
    return id ? { key: keyOf(selection!.tipoIssue, id.codigo), rotulo: id.rotulo } : null
  }
  const todosVisiveis = grupos.flatMap((g) => g.cupons.slice(0, LIMITE_POR_GRUPO))
  const idsVisiveis = todosVisiveis.map(idDe)
  const totalSelectedVisible = selection ? idsVisiveis.filter((v) => v && selection.selectedKeys.has(v.key)).length : 0
  const toggleGrupo = (codigo: number) => setAbertos((prev) => { const n = new Set(prev); if (n.has(codigo)) n.delete(codigo); else n.add(codigo); return n })
  const nCols = 9 + (selection ? 1 : 0)

  const combustiveisDe = (c: CupomMultiAbast) => {
    const m = new Map<string, number>()
    for (const a of c.abastecimentos) { const k = nomeBonito(a.tipoCombustivel || a.produtoNome.split(' ')[0]); m.set(k, (m.get(k) ?? 0) + a.quantidade) }
    return [...m.entries()].map(([k, l]) => `${k} ${formatNumber(l)} L`).join(' · ')
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-transparent dark:text-gray-400">
          <tr>
            {selection && (
              <th className="w-8 px-3 py-2 text-left">
                <HeaderCheck totalVisible={todosVisiveis.length} totalSelectedVisible={totalSelectedVisible} onToggle={() => selection.onToggleAll(idsVisiveis.filter((v): v is { key: string; rotulo: string } => !!v))} />
              </th>
            )}
            <th className="px-3 py-2 text-left font-medium">Risco</th>
            <th className="px-3 py-2 text-left font-medium">Cupom</th>
            <th className="px-3 py-2 text-left font-medium">Quando</th>
            <th className="px-3 py-2 text-right font-medium">Itens</th>
            <th className="px-3 py-2 text-left font-medium">Combustíveis</th>
            <th className="px-3 py-2 text-right font-medium">Intervalo</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 text-right font-medium">Dinheiro</th>
            <th className="px-3 py-2 text-right font-medium">Sinais</th>
          </tr>
        </thead>
        {grupos.map((g) => {
          const fechado = !abertos.has(g.codigo)
          const lista = g.cupons.slice(0, LIMITE_POR_GRUPO)
          return (
            <tbody key={g.codigo} className="divide-y divide-gray-100 border-t border-gray-200 dark:divide-gray-800 dark:border-gray-700">
              <tr className="cursor-pointer bg-gray-50/80 hover:bg-gray-100/70 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]" onClick={() => toggleGrupo(g.codigo)}>
                <td colSpan={nCols} className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-gray-900 dark:text-white">
                      {fechado ? <ChevronRight className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                      {nomeBonito(g.nome)}
                    </span>
                    <span className="text-[11px] text-gray-600 dark:text-gray-300">{g.cupons.length} {g.cupons.length === 1 ? 'cupom' : 'cupons'} · {g.itens} abastecimentos</span>
                    {g.altos > 0 && <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">{g.altos} risco alto</span>}
                    {g.medios > 0 && <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{g.medios} médio</span>}
                    <span className="ml-auto text-[11px] text-gray-600 dark:text-gray-300">Total <b className="font-semibold text-gray-900 dark:text-white">{formatCurrency(g.total)}</b> · Dinheiro <b className={cn('font-semibold', g.dinheiro > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400')}>{formatCurrency(g.dinheiro)}</b></span>
                  </div>
                </td>
              </tr>
              {!fechado && lista.map((c, idx) => {
                const day = c.dataHora.split('T')[0] || c.dataHora.slice(0, 10)
                const hora = c.dataHora.includes('T') ? c.dataHora.split('T')[1]?.substring(0, 5) : c.dataHora.substring(11, 16)
                const vid = idDe(c)
                const isSel = selection && vid ? selection.selectedKeys.has(vid.key) : false
                const nivel = nivelCupom(c.riscoScore)
                return (
                  <tr
                    key={c.vendaCodigo}
                    className={cn('cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40', c.riscoScore === 3 && 'border-l-2 border-red-400 dark:border-red-500/70', isSel && 'bg-blue-50/60 dark:bg-blue-900/20')}
                    onClick={() => onOpen(lista, idx, adaptCupomMultiAbast, qi)}
                  >
                    {selection && vid && (
                      <td className="px-3 py-1.5">
                        <RowCheck checked={isSel} onChange={() => selection.onToggle(vid.key, vid.rotulo)} ariaLabel={`Selecionar ${vid.rotulo}`} />
                      </td>
                    )}
                    <td className="px-3 py-1.5"><span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold', nivel.cls)}><span className={cn('h-1.5 w-1.5 rounded-full', nivel.dot)} />{nivel.label.replace('Risco ', '')}</span></td>
                    <td className="px-3 py-1.5 font-mono tabular-nums text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">{c.vendaCodigo}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-gray-900 dark:text-gray-100">{formatDate(day)} <span className="text-gray-500 dark:text-gray-400">{hora}</span></td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{c.abastecimentos.length}</td>
                    <td className={cn('px-3 py-1.5', c.mixCombustiveis ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300')}>{combustiveisDe(c)}</td>
                    <td className={cn('px-3 py-1.5 text-right tabular-nums', c.espalhado ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400')}>{minutosCurto(c.spreadMin) ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(c.totalVenda)}</td>
                    <td className={cn('px-3 py-1.5 text-right tabular-nums', c.mixPagamentos ? 'font-semibold text-gray-900 dark:text-gray-100' : c.dinheiro > 0 ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400')}>{c.formasPagamento.length === 0 ? 'sem registro' : formatCurrency(c.dinheiro)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <span className="inline-flex items-center gap-0.5" title={`${c.nSinais} de 4 sinais`}>
                        {[true, c.mixCombustiveis, c.espalhado, c.mixPagamentos].map((on, i) => <span key={i} className={cn('h-1.5 w-1.5 rounded-full', on ? nivel.dot : 'bg-gray-200 dark:bg-gray-700')} />)}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {!fechado && g.cupons.length > LIMITE_POR_GRUPO && (
                <tr><td colSpan={nCols} className="px-3 py-1.5 text-[11px] text-gray-400">… e mais {g.cupons.length - LIMITE_POR_GRUPO} cupons de {nomeBonito(g.nome)} neste período. Reduza o período para ver todos.</td></tr>
              )}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

const VendaItemSemProdutoTable = ({
  items, qi, onOpen, selection,
}: { items: VendaItem[]; qi: QualidadeIssue; selection?: SelectionProps<VendaItem> } & RowClickable) => {
  const visible = items.slice(0, 100)
  const visibleIds = visible.map((v) => {
    const id = selection?.identityOf(v)
    return id ? { key: keyOf(selection!.tipoIssue, id.codigo), rotulo: id.rotulo } : null
  })
  const totalSelectedVisible = selection ? visibleIds.filter((v) => v && selection.selectedKeys.has(v.key)).length : 0
  return (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-transparent dark:text-gray-400">
        <tr>
          {selection && (
            <th className="w-8 px-3 py-2 text-left">
              <HeaderCheck totalVisible={visible.length} totalSelectedVisible={totalSelectedVisible} onToggle={() => selection.onToggleAll(visibleIds.filter((v): v is { key: string; rotulo: string } => !!v))} />
            </th>
          )}
          <th className="px-3 py-2 text-left font-medium">Venda #</th>
          <th className="px-3 py-2 text-left font-medium">Data</th>
          <th className="px-3 py-2 text-left font-medium">Cód. produto</th>
          <th className="px-3 py-2 text-right font-medium">Qtd</th>
          <th className="px-3 py-2 text-right font-medium">Valor</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {visible.map((v, idx) => {
          const vid = visibleIds[idx]
          const isSel = selection && vid ? selection.selectedKeys.has(vid.key) : false
          return (
          <tr
            key={`${v.vendaCodigo}-${v.vendaItemCodigo}`}
            className={cn('cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40', isSel && 'bg-blue-50/60 dark:bg-blue-900/20')}
            onClick={() => onOpen(visible, idx, adaptVendaItem, qi)}
          >
            {selection && vid && (
              <td className="px-3 py-1.5">
                <RowCheck checked={isSel} onChange={() => selection.onToggle(vid.key, vid.rotulo)} ariaLabel={`Selecionar ${vid.rotulo}`} />
              </td>
            )}
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
          )
        })}
      </tbody>
    </table>
  </div>
  )
}

const CaixaAbertoTable = ({
  items, qi, onOpen, selection,
}: { items: CaixaAbertoDetalhe[]; qi: QualidadeIssue; selection?: SelectionProps<CaixaAbertoDetalhe> } & RowClickable) => {
  const visible = items.slice(0, 100)
  const visibleIds = visible.map((c) => {
    const id = selection?.identityOf(c)
    return id ? { key: keyOf(selection!.tipoIssue, id.codigo), rotulo: id.rotulo } : null
  })
  const totalSelectedVisible = selection ? visibleIds.filter((v) => v && selection.selectedKeys.has(v.key)).length : 0
  return (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-transparent dark:text-gray-400">
        <tr>
          {selection && (
            <th className="w-8 px-3 py-2 text-left">
              <HeaderCheck totalVisible={visible.length} totalSelectedVisible={totalSelectedVisible} onToggle={() => selection.onToggleAll(visibleIds.filter((v): v is { key: string; rotulo: string } => !!v))} />
            </th>
          )}
          <th className="px-3 py-2 text-left font-medium">Caixa #</th>
          <th className="px-3 py-2 text-left font-medium">Data</th>
          <th className="px-3 py-2 text-left font-medium">Turno</th>
          <th className="px-3 py-2 text-left font-medium">PDV</th>
          <th className="px-3 py-2 text-right font-medium">Dias aberto</th>
          <th className="px-3 py-2 text-right font-medium">Apurado</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {visible.map((c, idx) => {
          const vid = visibleIds[idx]
          const isSel = selection && vid ? selection.selectedKeys.has(vid.key) : false
          return (
          <tr
            key={c.caixaCodigo}
            className={cn('cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40', isSel && 'bg-blue-50/60 dark:bg-blue-900/20')}
            onClick={() => onOpen(visible, idx, adaptCaixaAberto, qi)}
          >
            {selection && vid && (
              <td className="px-3 py-1.5">
                <RowCheck checked={isSel} onChange={() => selection.onToggle(vid.key, vid.rotulo)} ariaLabel={`Selecionar ${vid.rotulo}`} />
              </td>
            )}
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
          )
        })}
      </tbody>
    </table>
  </div>
  )
}

const CaixaDiferencaTable = ({
  items, qi, onOpen, selection,
}: { items: Caixa[]; qi: QualidadeIssue; selection?: SelectionProps<Caixa> } & RowClickable) => {
  const visible = items.slice(0, 100)
  const visibleIds = visible.map((c) => {
    const id = selection?.identityOf(c)
    return id ? { key: keyOf(selection!.tipoIssue, id.codigo), rotulo: id.rotulo } : null
  })
  const totalSelectedVisible = selection ? visibleIds.filter((v) => v && selection.selectedKeys.has(v.key)).length : 0
  return (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-transparent dark:text-gray-400">
        <tr>
          {selection && (
            <th className="w-8 px-3 py-2 text-left">
              <HeaderCheck totalVisible={visible.length} totalSelectedVisible={totalSelectedVisible} onToggle={() => selection.onToggleAll(visibleIds.filter((v): v is { key: string; rotulo: string } => !!v))} />
            </th>
          )}
          <th className="px-3 py-2 text-left font-medium">Caixa #</th>
          <th className="px-3 py-2 text-left font-medium">Data</th>
          <th className="px-3 py-2 text-left font-medium">Turno</th>
          <th className="px-3 py-2 text-left font-medium">PDV</th>
          <th className="px-3 py-2 text-right font-medium">Apurado</th>
          <th className="px-3 py-2 text-right font-medium">Diferença</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {visible.map((c, idx) => {
          const vid = visibleIds[idx]
          const isSel = selection && vid ? selection.selectedKeys.has(vid.key) : false
          return (
          <tr
            key={c.caixaCodigo}
            className={cn('cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40', isSel && 'bg-blue-50/60 dark:bg-blue-900/20')}
            onClick={() => onOpen(visible, idx, adaptCaixaDiferenca, qi)}
          >
            {selection && vid && (
              <td className="px-3 py-1.5">
                <RowCheck checked={isSel} onChange={() => selection.onToggle(vid.key, vid.rotulo)} ariaLabel={`Selecionar ${vid.rotulo}`} />
              </td>
            )}
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
          )
        })}
      </tbody>
    </table>
  </div>
  )
}

const EstoqueNegativoTable = ({
  items, qi, onOpen, selection,
}: { items: ProdutoEstoqueNegativo[]; qi: QualidadeIssue; selection?: SelectionProps<ProdutoEstoqueNegativo> } & RowClickable) => {
  const visible = items.slice(0, 100)
  const visibleIds = visible.map((p) => {
    const id = selection?.identityOf(p)
    return id ? { key: keyOf(selection!.tipoIssue, id.codigo), rotulo: id.rotulo } : null
  })
  const totalSelectedVisible = selection ? visibleIds.filter((v) => v && selection.selectedKeys.has(v.key)).length : 0
  return (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-transparent dark:text-gray-400">
        <tr>
          {selection && (
            <th className="w-8 px-3 py-2 text-left">
              <HeaderCheck totalVisible={visible.length} totalSelectedVisible={totalSelectedVisible} onToggle={() => selection.onToggleAll(visibleIds.filter((v): v is { key: string; rotulo: string } => !!v))} />
            </th>
          )}
          <th className="px-3 py-2 text-left font-medium">Código</th>
          <th className="px-3 py-2 text-left font-medium">Produto</th>
          <th className="px-3 py-2 text-right font-medium">Saldo</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {visible.map((p, idx) => {
          const vid = visibleIds[idx]
          const isSel = selection && vid ? selection.selectedKeys.has(vid.key) : false
          return (
          <tr
            key={p.produtoCodigo}
            className={cn('cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40', isSel && 'bg-blue-50/60 dark:bg-blue-900/20')}
            onClick={() => onOpen(visible, idx, adaptEstoqueNegativo, qi)}
          >
            {selection && vid && (
              <td className="px-3 py-1.5">
                <RowCheck checked={isSel} onChange={() => selection.onToggle(vid.key, vid.rotulo)} ariaLabel={`Selecionar ${vid.rotulo}`} />
              </td>
            )}
            <td className="px-3 py-1.5 font-mono tabular-nums text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
              #{p.produtoCodigo}
            </td>
            <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">{p.nome}</td>
            <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-red-700 dark:text-red-400">
              {formatNumber(p.saldo)}
            </td>
          </tr>
          )
        })}
      </tbody>
    </table>
  </div>
  )
}

const TituloSemVencTable = ({
  items, qi, onOpen, selection,
}: { items: TituloSemVenc[]; qi: QualidadeIssue; selection?: SelectionProps<TituloSemVenc> } & RowClickable) => {
  const visible = items.slice(0, 100)
  const visibleIds = visible.map((t) => {
    const id = selection?.identityOf(t)
    return id ? { key: keyOf(selection!.tipoIssue, id.codigo), rotulo: id.rotulo } : null
  })
  const totalSelectedVisible = selection ? visibleIds.filter((v) => v && selection.selectedKeys.has(v.key)).length : 0
  return (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-transparent dark:text-gray-400">
        <tr>
          {selection && (
            <th className="w-8 px-3 py-2 text-left">
              <HeaderCheck totalVisible={visible.length} totalSelectedVisible={totalSelectedVisible} onToggle={() => selection.onToggleAll(visibleIds.filter((v): v is { key: string; rotulo: string } => !!v))} />
            </th>
          )}
          <th className="px-3 py-2 text-left font-medium">Código</th>
          <th className="px-3 py-2 text-left font-medium">Tipo</th>
          <th className="px-3 py-2 text-left font-medium">Documento</th>
          <th className="px-3 py-2 text-left font-medium">Cliente/Fornecedor</th>
          <th className="px-3 py-2 text-right font-medium">Valor</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {visible.map((t, idx) => {
          const codigo = t._tipo === 'receber' ? t.tituloCodigo : t.tituloPagarCodigo
          const vid = visibleIds[idx]
          const isSel = selection && vid ? selection.selectedKeys.has(vid.key) : false
          return (
            <tr
              key={`${t._tipo}-${codigo}`}
              className={cn('cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40', isSel && 'bg-blue-50/60 dark:bg-blue-900/20')}
              onClick={() => onOpen(visible, idx, adaptTitulo, qi)}
            >
              {selection && vid && (
                <td className="px-3 py-1.5">
                  <RowCheck checked={isSel} onChange={() => selection.onToggle(vid.key, vid.rotulo)} ariaLabel={`Selecionar ${vid.rotulo}`} />
                </td>
              )}
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
}

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
  // Fraude/Sherlock é por-posto → um posto por vez, com seletor quando o filtro
  // tem mais de um (Todos/subconjunto).
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))
  const [activeCodigo, setActiveCodigo] = useState<number | null>(null)
  const postoCodes = postos.map((p) => p.codigo)
  const selectedCodigo = activeCodigo != null && postoCodes.includes(activeCodigo)
    ? activeCodigo
    : (postos[0]?.codigo ?? null)

  const data = useQualidadeDados(selectedCodigo)
  const arquivamento = useQualidadeArquivados(selectedCodigo)
  const [view, setView] = useState<'ativos' | 'arquivados'>('ativos')
  // Modal navegável: guarda a lista clicada + índice + adaptador (adaptação lazy
  // do item atual). As setas ‹ › só andam no índice, sem fechar o modal.
  const [nav, setNav] = useState<NavContext | null>(null)
  // selectedKeys mantém key → rotulo (precisa do rótulo na hora de arquivar)
  const [selectedKeys, setSelectedKeys] = useState<Map<string, string>>(new Map())
  const [arquivando, setArquivando] = useState(false)
  const isMobile = useIsMobile()
  // Mobile: tela de triagem própria (overview das inconsistências).
  if (isMobile) return <QualidadeMobile />

  const openAt = <T,>(
    items: T[],
    index: number,
    adapt: (item: T, qi: QualidadeIssue) => LancamentoDetalheData,
    qi: QualidadeIssue,
  ) => {
    setNav({
      items: items as unknown[],
      index,
      adapt: adapt as (item: unknown, qi: QualidadeIssue) => LancamentoDetalheData,
      qi,
    })
  }
  const navData = nav ? nav.adapt(nav.items[nav.index], nav.qi) : null
  const canPrev = !!nav && nav.index > 0
  const canNext = !!nav && nav.index < nav.items.length - 1
  const goPrev = () => setNav((n) => (n && n.index > 0 ? { ...n, index: n.index - 1 } : n))
  const goNext = () => setNav((n) => (n && n.index < n.items.length - 1 ? { ...n, index: n.index + 1 } : n))
  const navPosition = nav ? `${nav.index + 1} / ${nav.items.length}` : undefined

  // Filtra items removendo os já arquivados (não-restaurados)
  const filterArchived = <T,>(
    items: T[],
    tipoIssue: string,
    identityOf: (item: T) => ArquivadoIdentity,
  ): T[] => items.filter((item) => {
    const id = identityOf(item)
    return !arquivamento.keysAtivas.has(keyOf(tipoIssue, id.codigo))
  })

  const toggleKey = (key: string, rotulo: string) => {
    setSelectedKeys((curr) => {
      const next = new Map(curr)
      if (next.has(key)) next.delete(key)
      else next.set(key, rotulo)
      return next
    })
  }

  const toggleAll = (items: { key: string; rotulo: string }[]) => {
    setSelectedKeys((curr) => {
      const next = new Map(curr)
      const allSelected = items.every((it) => next.has(it.key))
      if (allSelected) {
        for (const it of items) next.delete(it.key)
      } else {
        for (const it of items) next.set(it.key, it.rotulo)
      }
      return next
    })
  }

  const makeSelection = <T,>(
    tipoIssue: string,
    identityOf: (item: T) => ArquivadoIdentity,
  ): SelectionProps<T> | undefined => arquivamento.canArchive
    ? {
        tipoIssue,
        identityOf,
        selectedKeys: new Set(selectedKeys.keys()),
        onToggle: toggleKey,
        onToggleAll: toggleAll,
      }
    : undefined

  // Monta os issues prontos pra renderizar com detail + seleção
  const abastIssues: Issue[] = data.abastecimentos.map((qi) => {
    if (qi.id === 'preco-anormal') {
      const items = filterArchived(qi.items as AbastecimentoPrecoSuspeito[], qi.id, identityPrecoSuspeito)
      return toIssue(
        { ...qi, count: items.length, items },
        <PrecoSuspeitoTable
          items={items}
          qi={qi}
          onOpen={openAt}
          selection={makeSelection<AbastecimentoPrecoSuspeito>(qi.id, identityPrecoSuspeito)}
        />,
      )
    }
    const items = filterArchived(qi.items as AbastecimentoRow[], qi.id, identityAbastecimento)
    return toIssue(
      { ...qi, count: items.length, items },
      <AbastecimentoTable
        items={items}
        qi={qi}
        onOpen={openAt}
        selection={makeSelection<AbastecimentoRow>(qi.id, identityAbastecimento)}
      />,
    )
  })
  // Sherlock (cupom-multi-abast) é ISOLADO — herói anti-fraude próprio, fora das
  // categorias (sem double-count). Os cupons ativos alimentam o drill e a leitura
  // do "Padrão".
  const cupomQi = data.vendas.find((q) => q.id === 'cupom-multi-abast')
  const cupomItems = cupomQi
    ? filterArchived(cupomQi.items as CupomMultiAbast[], cupomQi.id, identityCupomMultiAbast)
    : []
  const cupomIssue: Issue | null = cupomQi
    ? toIssue(
        { ...cupomQi, count: cupomItems.length, items: cupomItems },
        <CupomMultiAbastTable
          items={cupomItems}
          qi={cupomQi}
          onOpen={openAt}
          selection={makeSelection<CupomMultiAbast>(cupomQi.id, identityCupomMultiAbast)}
        />,
      )
    : null

  // "Padrão" determinístico: concentração de cupons por frentista (fato derivável
  // do funcionarioNome). Só aparece quando é relevante (≥3 cupons, líder com ≥2 e
  // ≥40% de concentração); senão omite a caixa — nada de prescrição inventada.
  const sherlockPadrao: string | null = (() => {
    if (cupomItems.length < 3) return null
    const porFrentista = new Map<string, number>()
    for (const c of cupomItems) porFrentista.set(c.funcionarioNome, (porFrentista.get(c.funcionarioNome) ?? 0) + 1)
    let topNome = '', topN = 0
    for (const [nome, n] of porFrentista) if (n > topN) { topN = n; topNome = nome }
    const share = topN / cupomItems.length
    if (topN < 2 || share < 0.4) return null
    return `${topNome} concentra ${topN} de ${cupomItems.length} cupons (${Math.round(share * 100)}%).`
  })()

  // Categoria "Vendas" = detectores de venda que NÃO são o Sherlock.
  const vendasIssues: Issue[] = data.vendas.filter((q) => q.id !== 'cupom-multi-abast').map((qi) => {
    const items = filterArchived(qi.items as VendaItem[], qi.id, identityVendaItem)
    return toIssue(
      { ...qi, count: items.length, items },
      <VendaItemSemProdutoTable
        items={items}
        qi={qi}
        onOpen={openAt}
        selection={makeSelection<VendaItem>(qi.id, identityVendaItem)}
      />,
    )
  })
  const caixaIssues: Issue[] = data.caixa.map((qi) => {
    if (qi.id === 'caixa-aberto-muito') {
      const items = filterArchived(qi.items as CaixaAbertoDetalhe[], qi.id, identityCaixaAberto)
      return toIssue(
        { ...qi, count: items.length, items },
        <CaixaAbertoTable
          items={items}
          qi={qi}
          onOpen={openAt}
          selection={makeSelection<CaixaAbertoDetalhe>(qi.id, identityCaixaAberto)}
        />,
      )
    }
    const items = filterArchived(qi.items as Caixa[], qi.id, identityCaixaDiferenca)
    return toIssue(
      { ...qi, count: items.length, items },
      <CaixaDiferencaTable
        items={items}
        qi={qi}
        onOpen={openAt}
        selection={makeSelection<Caixa>(qi.id, identityCaixaDiferenca)}
      />,
    )
  })
  const estoqueIssues: Issue[] = data.estoque.map((qi) => {
    const items = filterArchived(qi.items as ProdutoEstoqueNegativo[], qi.id, identityEstoqueNegativo)
    return toIssue(
      { ...qi, count: items.length, items },
      <EstoqueNegativoTable
        items={items}
        qi={qi}
        onOpen={openAt}
        selection={makeSelection<ProdutoEstoqueNegativo>(qi.id, identityEstoqueNegativo)}
      />,
    )
  })
  const financeiroIssues: Issue[] = data.financeiro.map((qi) => {
    const items = filterArchived(qi.items as TituloSemVenc[], qi.id, identityTitulo)
    return toIssue(
      { ...qi, count: items.length, items },
      <TituloSemVencTable
        items={items}
        qi={qi}
        onOpen={openAt}
        selection={makeSelection<TituloSemVenc>(qi.id, identityTitulo)}
      />,
    )
  })

  // Totais ativos (excluindo arquivados) — re-agrega a partir das listas filtradas.
  // O Sherlock (cupomIssue) está fora das categorias, então entra explícito aqui.
  const categoriaIssues = [abastIssues, vendasIssues, caixaIssues, estoqueIssues, financeiroIssues].flat()
  const allFiltered = cupomIssue ? [...categoriaIssues, cupomIssue] : categoriaIssues
  const totalAtivo = allFiltered.reduce((s, i) => s + i.count, 0)
  const totalCriticosAtivo = allFiltered.filter((i) => i.severity === 'high').reduce((s, i) => s + i.count, 0)
  const totalAtencaoAtivo = allFiltered.filter((i) => i.severity === 'medium').reduce((s, i) => s + i.count, 0)
  const totalInfoAtivo = allFiltered.filter((i) => i.severity === 'low').reduce((s, i) => s + i.count, 0)

  // Guard-rail (dev): com o Sherlock isolado, o Total tem que FECHAR com
  // Sherlock + as categorias e com a partição por severidade. Se algum período
  // não bater, é double-count remanescente — melhor gritar aqui que descobrir
  // na tela. (cupom-multi-abast = Sherlock; sai da soma das categorias.)
  if (import.meta.env.DEV && !data.isLoading) {
    const sherlock = cupomIssue?.count ?? 0
    const categorias = categoriaIssues.reduce((s, i) => s + i.count, 0)
    const severitySum = totalCriticosAtivo + totalAtencaoAtivo + totalInfoAtivo
    if (totalAtivo !== sherlock + categorias || totalAtivo !== severitySum) {
      // eslint-disable-next-line no-console
      console.error('[Qualidade] reconciliação falhou — possível double-count', { totalAtivo, sherlock, categorias, severitySum })
    }
  }

  // Quantas seleções estão entre os ativos (relevante pra contador da action bar)
  const selectedCount = selectedKeys.size

  const handleArquivar = async () => {
    if (selectedCount === 0 || !arquivamento.canArchive) return
    setArquivando(true)
    try {
      // Cada selectedKey tem o formato "tipo:codigo"
      const items: ArquivarInput[] = Array.from(selectedKeys.entries()).map(([key, rotulo]) => {
        const idx = key.indexOf(':')
        return {
          tipo_issue: key.substring(0, idx),
          registro_codigo: key.substring(idx + 1),
          rotulo,
        }
      })
      await arquivamento.arquivar(items)
      setSelectedKeys(new Map())
    } finally {
      setArquivando(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Seletor de posto — só quando o filtro tem mais de um (Todos/subconjunto). */}
      {postos.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <PostoLocalSelect postos={postos} value={selectedCodigo} onChange={setActiveCodigo} />
        </div>
      )}

      {postos.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          Nenhum posto disponível.
        </p>
      )}

      {data.hasEmpresa && (
        <>
          {/* Tab switcher: Ativos | Arquivados */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f] w-fit">
            <button
              type="button"
              onClick={() => setView('ativos')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'ativos'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
              )}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Ativos
              {!data.isLoading && totalAtivo > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-200 px-1 text-[10px] font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  {totalAtivo}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setView('arquivados')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'arquivados'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
              )}
            >
              <Archive className="h-3.5 w-3.5" />
              Arquivados
              {arquivamento.ativos.length > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-200 px-1 text-[10px] font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  {arquivamento.ativos.length}
                </span>
              )}
            </button>
          </div>

          {view === 'arquivados' ? (
            <ArquivadosView
              arquivados={arquivamento.arquivados}
              isLoading={arquivamento.isLoading}
              onReabrir={arquivamento.reabrir}
            />
          ) : (
            <>
              {/* KPIs principais — herói (Total + distribuição) + cards de severidade */}
              <QualidadeKpis
                total={data.isLoading ? null : totalAtivo}
                criticos={totalCriticosAtivo}
                atencao={totalAtencaoAtivo}
                info={totalInfoAtivo}
              />

              {/* Banner discreto quando tudo limpo */}
              {!data.isLoading && totalAtivo === 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      Tudo limpo — sem inconsistências ativas no período
                    </p>
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                      {arquivamento.ativos.length > 0
                        ? `${arquivamento.ativos.length} arquivados — veja na aba ao lado.`
                        : 'Os 9 detectores rodaram e nada foi sinalizado.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Sherlock — herói anti-fraude isolado (só cupom-multi-abast) */}
              <SherlockHero issue={cupomIssue} padrao={sherlockPadrao} />

              {/* Inconsistências por categoria — checks rotineiros */}
              <div className="grid grid-cols-1 gap-4">
                <IssueSection title="Abastecimentos" subtitle="Erros nos lançamentos de bomba" Icon={Fuel} issues={abastIssues} isLoading={data.isLoading} />
                <IssueSection title="Vendas" subtitle="Itens de venda com cadastro inconsistente" Icon={Receipt} issues={vendasIssues} isLoading={data.isLoading} />
                <IssueSection title="Caixa" subtitle="Fechamentos, diferenças e caixas pendurados" Icon={Wallet} issues={caixaIssues} isLoading={data.isLoading} />
                <IssueSection title="Estoque" subtitle="Saldos negativos e divergências de inventário" Icon={Boxes} issues={estoqueIssues} isLoading={data.isLoading} />
                <IssueSection title="Financeiro" subtitle="Títulos a receber e a pagar com problemas de cadastro" Icon={Landmark} issues={financeiroIssues} isLoading={data.isLoading} />
              </div>

              {/* Rodapé */}
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Clique numa linha pra ver o código no Quality. Marque pra arquivar — fica registrado quem arquivou e quando.
                {!arquivamento.canArchive && ' (Arquivamento desabilitado: faltam credenciais Supabase no .env)'}
              </p>
            </>
          )}
        </>
      )}

      {/* Action bar flutuante — aparece quando há seleção */}
      {selectedCount > 0 && view === 'ativos' && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {selectedCount} {selectedCount === 1 ? 'lançamento selecionado' : 'lançamentos selecionados'}
          </span>
          <button
            type="button"
            onClick={() => setSelectedKeys(new Map())}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={handleArquivar}
            disabled={arquivando}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1e3a5f] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#162d4a] disabled:opacity-50"
          >
            <Archive className={cn('h-3.5 w-3.5', arquivando && 'animate-pulse')} />
            {arquivando ? 'Arquivando...' : `Arquivar ${selectedCount}`}
          </button>
        </div>
      )}

      {/* Modal de detalhe de lançamento — abre ao clicar em qualquer linha */}
      <LancamentoDetalheModal
        open={nav !== null}
        onClose={() => setNav(null)}
        data={navData}
        onPrev={goPrev}
        onNext={goNext}
        canPrev={canPrev}
        canNext={canNext}
        position={navPosition}
      />
    </div>
  )
}

export default QualidadeDados
