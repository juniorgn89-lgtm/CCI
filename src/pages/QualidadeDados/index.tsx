import { useState } from 'react'
import { ShieldAlert, Fuel, Search, Wallet, Boxes, Landmark, CheckCircle2, AlertTriangle, Info, Archive, ListChecks, Banknote, CreditCard, Smartphone, HelpCircle } from 'lucide-react'
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
import ArquivadosView from '@/pages/QualidadeDados/components/ArquivadosView'
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
      { label: 'Desvio', value: `${desvioPct > 0 ? '+' : ''}${desvioPct.toFixed(1).replace('.', ',')}% (${r.zScore.toFixed(1).replace('.', ',')}σ)`, numeric: true, highlight: true },
      { label: 'Data', value: formatDate(day) },
      { label: 'Bomba / Bico', value: r.bombaDescricao },
      { label: 'Frentista', value: r.frentistaNome },
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

interface RowClickable {
  onSelect: (data: LancamentoDetalheData) => void
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
  items, qi, onSelect, withPlaca = true, selection,
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
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
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
              onClick={() => onSelect(adaptAbastecimento(r, qi))}
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
  items, qi, onSelect, selection,
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
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
        <tr>
          {selection && (
            <th className="w-8 px-3 py-2 text-left">
              <HeaderCheck totalVisible={visible.length} totalSelectedVisible={totalSelectedVisible} onToggle={() => selection.onToggleAll(visibleIds.filter((v): v is { key: string; rotulo: string } => !!v))} />
            </th>
          )}
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
        {visible.map((r, idx) => {
          const day = r.dataHora.split('T')[0] || r.dataHora.slice(0, 10)
          const vid = visibleIds[idx]
          const isSel = selection && vid ? selection.selectedKeys.has(vid.key) : false
          return (
            <tr
              key={r.codigo}
              className={cn('cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40', isSel && 'bg-blue-50/60 dark:bg-blue-900/20')}
              onClick={() => onSelect(adaptPrecoSuspeito(r, qi))}
            >
              {selection && vid && (
                <td className="px-3 py-1.5">
                  <RowCheck checked={isSel} onChange={() => selection.onToggle(vid.key, vid.rotulo)} ariaLabel={`Selecionar ${vid.rotulo}`} />
                </td>
              )}
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
}

/* ─── Adapter Cupom Multi-Abast ─── */
// Mapeia tipo/nome de FPG pro ícone visual. Tenta nome primeiro (mais específico),
// cai pra tipo se não bater. Default = HelpCircle (não conseguimos classificar).
const fpgIcon = (tipo: string, nome: string) => {
  const s = `${tipo} ${nome}`.toLowerCase()
  if (s.includes('dinheiro') || s.includes('especie')) return Banknote
  if (s.includes('pix')) return Smartphone
  if (s.includes('cart') || s.includes('credit') || s.includes('debit') || s.includes('prime')) return CreditCard
  return HelpCircle
}

const adaptCupomMultiAbast = (c: CupomMultiAbast, _qi: QualidadeIssue): LancamentoDetalheData => {
  void _qi
  const day = c.dataHora.split('T')[0] || c.dataHora.slice(0, 10)
  const hora = c.dataHora.includes('T') ? c.dataHora.split('T')[1]?.substring(0, 8) : c.dataHora.substring(11, 19)

  // Calcula o "spread" — intervalo entre o primeiro e o último abastecimento
  // do mesmo cupom. Cliente real abastece de uma vez (poucos minutos);
  // cupom "montado" tem itens espalhados pelo turno.
  const tsMs = c.abastecimentos
    .map((a) => (a.dataHoraAbastecimento ? new Date(a.dataHoraAbastecimento).getTime() : NaN))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)
  let spreadLabel: string | null = null
  let spreadCritical = false
  if (tsMs.length >= 2) {
    const diffMin = (tsMs[tsMs.length - 1] - tsMs[0]) / 60000
    spreadCritical = diffMin > 15
    if (diffMin < 1) spreadLabel = '< 1 min (normal)'
    else if (diffMin < 60) spreadLabel = `${Math.round(diffMin)} min`
    else {
      const h = Math.floor(diffMin / 60)
      const m = Math.round(diffMin % 60)
      spreadLabel = m > 0 ? `${h}h ${m}min` : `${h}h`
    }
  }

  // Soma por tipo de combustível pra mostrar resumo no topo da lista de abastecimentos.
  const porCombustivel = new Map<string, { litros: number; total: number }>()
  c.abastecimentos.forEach((a) => {
    const key = a.tipoCombustivel || a.produtoNome
    const prev = porCombustivel.get(key) ?? { litros: 0, total: 0 }
    porCombustivel.set(key, { litros: prev.litros + a.quantidade, total: prev.total + a.totalVenda })
  })

  const abastecimentosNode = (
    <div className="space-y-2">
      {/* Resumo por combustível (só aparece quando tem mix) */}
      {c.mixCombustiveis && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from(porCombustivel.entries()).map(([nome, agg]) => (
            <span
              key={nome}
              className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <Fuel className="h-2.5 w-2.5 text-gray-400" />
              {nome} · {formatNumber(agg.litros)}L · {formatCurrency(agg.total)}
            </span>
          ))}
        </div>
      )}
      {/* Lista de itens */}
      <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
        {c.abastecimentos.map((a, idx) => {
          const horaAbast = a.dataHoraAbastecimento
            ? a.dataHoraAbastecimento.includes('T')
              ? a.dataHoraAbastecimento.split('T')[1]?.substring(0, 5)
              : a.dataHoraAbastecimento.substring(11, 16)
            : null
          return (
            <li key={idx} className="flex items-center gap-2 px-2 py-1">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[9px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {idx + 1}
              </span>
              <Fuel className="h-3 w-3 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[11px] font-medium text-gray-900 dark:text-gray-100">
                  {a.produtoNome}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  {a.bombaDescricao} · {formatNumber(a.quantidade)} L × {formatCurrency(a.precoVenda)}
                </p>
              </div>
              <div className="flex shrink-0 items-baseline gap-2">
                {horaAbast ? (
                  <span className="font-mono text-[10px] font-medium tabular-nums text-gray-600 dark:text-gray-400">
                    {horaAbast}
                  </span>
                ) : (
                  <span className="text-[9px] text-gray-400">—</span>
                )}
                <span className="w-16 text-right font-mono text-[11px] font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {formatCurrency(a.totalVenda)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )

  const formasPagamentoNode = c.formasPagamento.length > 0 ? (
    <div className="flex flex-wrap gap-1.5">
      {c.formasPagamento.map((f, idx) => {
        const Icon = fpgIcon(f.tipo, f.nome)
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <Icon className="h-3 w-3 text-gray-400" />
            <span className="capitalize">{f.nome.toLowerCase().replace(/\.+$/, '')}</span>
            <span className="font-mono font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(f.valor)}</span>
          </span>
        )
      })}
    </div>
  ) : null

  const motivoBase = `Esse cupom tem ${c.abastecimentos.length} abastecimentos no mesmo lançamento.`
  const motivoExtra = c.riscoScore === 3
    ? ' ⚠ Combina combustíveis diferentes E mistura formas de pagamento — sinal forte de "montagem" pra ocultar fraude.'
    : c.mixCombustiveis
    ? ' Combustíveis diferentes no mesmo cupom (ex.: gasolina + diesel) — incomum num cliente real.'
    : c.mixPagamentos
    ? ' Mix de formas de pagamento (ex.: cartão + dinheiro) — pode ser legítimo, mas vale conferir.'
    : ' Mesmo combustível repetido — pode ser caminhão/frota, mas vale conferir o cliente.'
  return {
    title: `Cupom Venda #${c.vendaCodigo}`,
    subtitle: `${formatDate(day)} ${hora} · ${c.funcionarioNome}`,
    codigoLabel: 'Código da venda (no Quality)',
    codigoValue: String(c.vendaCodigo),
    qualityHint: 'Acesse Quality → Vendas → buscar pelo código acima. Confirme com o frentista e revise o cupom físico.',
    motivo: motivoBase + motivoExtra,
    severidade: c.riscoScore === 3 ? 'high' : c.riscoScore === 2 ? 'medium' : 'low',
    details: [
      { label: 'Data', value: formatDate(day) },
      { label: 'Hora', value: hora || '—' },
      { label: 'Frentista', value: c.funcionarioNome },
      { label: 'Abastecimentos', value: abastecimentosNode },
      ...(spreadLabel
        ? [{
            label: 'Intervalo 1º → último',
            value: spreadCritical ? `${spreadLabel} ⚠` : spreadLabel,
            highlight: spreadCritical,
          }]
        : []),
      { label: 'Total cupom', value: formatCurrency(c.totalVenda), numeric: true },
      { label: 'Formas de pagamento', value: formasPagamentoNode },
      { label: 'Combustíveis diferentes', value: c.mixCombustiveis ? 'Sim ⚠' : 'Não', highlight: c.mixCombustiveis },
      { label: 'Score de risco', value: c.riscoScore === 3 ? '3 (ALTO)' : c.riscoScore === 2 ? '2 (MÉDIO)' : '1 (BAIXO)' },
    ],
  }
}

const RiscoBadge = ({ score }: { score: 1 | 2 | 3 }) => {
  // Só fonte colorida (sem fundo de pílula) — menos poluição visual.
  const base = 'text-[10px] font-bold uppercase tracking-wider'
  if (score === 3) return <span className={`${base} text-red-600 dark:text-red-400`}>Alto</span>
  if (score === 2) return <span className={`${base} text-amber-600 dark:text-amber-400`}>Médio</span>
  return <span className={`${base} text-blue-600 dark:text-blue-400`}>Baixo</span>
}

const CupomMultiAbastTable = ({
  items, qi, onSelect, selection,
}: { items: CupomMultiAbast[]; qi: QualidadeIssue; selection?: SelectionProps<CupomMultiAbast> } & RowClickable) => {
  const visible = items.slice(0, 100)
  const visibleIds = visible.map((c) => {
    const id = selection?.identityOf(c)
    return id ? { key: keyOf(selection!.tipoIssue, id.codigo), rotulo: id.rotulo } : null
  })
  const totalSelectedVisible = selection
    ? visibleIds.filter((v) => v && selection.selectedKeys.has(v.key)).length
    : 0
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
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
            <th className="px-3 py-2 text-left font-medium">Risco</th>
            <th className="px-3 py-2 text-left font-medium">Venda #</th>
            <th className="px-3 py-2 text-left font-medium">Data / Hora</th>
            <th className="px-3 py-2 text-left font-medium">Frentista</th>
            <th className="px-3 py-2 text-left font-medium">Combustíveis</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 text-left font-medium">Pagamento</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {visible.map((c, idx) => {
            const day = c.dataHora.split('T')[0] || c.dataHora.slice(0, 10)
            const hora = c.dataHora.includes('T') ? c.dataHora.split('T')[1]?.substring(0, 5) : c.dataHora.substring(11, 16)
            const vid = visibleIds[idx]
            const isSel = selection && vid ? selection.selectedKeys.has(vid.key) : false
            const combustiveisLabel = c.abastecimentos
              .map((a) => `${a.tipoCombustivel || a.produtoNome.split(' ')[0]} ${formatNumber(a.quantidade)}L`)
              .join(' + ')
            const pagamentoLabel = c.formasPagamento.length > 0
              ? c.formasPagamento.map((f) => `${f.tipo} ${formatCurrency(f.valor)}`).join(' · ')
              : '—'
            return (
              <tr
                key={c.vendaCodigo}
                className={cn(
                  'cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/40',
                  // Linha inteira com fundo vermelho uniforme quando há mistura
                  // (combustível ou pagamento) — sem destaque remendado por célula.
                  (c.mixCombustiveis || c.mixPagamentos) && 'bg-red-50/60 dark:bg-red-900/15',
                  c.riscoScore === 3 && 'border-l-2 border-red-400 dark:border-red-500/70',
                  isSel && 'bg-blue-50/60 dark:bg-blue-900/20',
                )}
                onClick={() => onSelect(adaptCupomMultiAbast(c, qi))}
              >
                {selection && vid && (
                  <td className="px-3 py-1.5">
                    <RowCheck checked={isSel} onChange={() => selection.onToggle(vid.key, vid.rotulo)} ariaLabel={`Selecionar ${vid.rotulo}`} />
                  </td>
                )}
                <td className="px-3 py-1.5">
                  <RiscoBadge score={c.riscoScore} />
                </td>
                <td className="px-3 py-1.5 font-mono tabular-nums text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
                  #{c.vendaCodigo}
                </td>
                <td className="px-3 py-1.5 tabular-nums text-gray-900 dark:text-gray-100">
                  {formatDate(day)} {hora && <span className="text-gray-500 dark:text-gray-400">{hora}</span>}
                </td>
                <td className="px-3 py-1.5 font-medium text-gray-700 dark:text-gray-300">{c.funcionarioNome}</td>
                <td className={cn(
                  'px-3 py-1.5 text-xs',
                  c.mixCombustiveis ? 'font-medium text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300',
                )}>
                  {combustiveisLabel}
                  <span className="ml-1 text-[10px] text-gray-400">({c.abastecimentos.length} itens)</span>
                </td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {formatCurrency(c.totalVenda)}
                </td>
                <td className={cn(
                  'px-3 py-1.5 text-[11px]',
                  c.mixPagamentos ? 'font-medium text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400',
                )}>
                  {pagamentoLabel}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const VendaItemSemProdutoTable = ({
  items, qi, onSelect, selection,
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
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
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
            onClick={() => onSelect(adaptVendaItem(v, qi))}
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
  items, qi, onSelect, selection,
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
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
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
            onClick={() => onSelect(adaptCaixaAberto(c, qi))}
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
  items, qi, onSelect, selection,
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
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
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
            onClick={() => onSelect(adaptCaixaDiferenca(c, qi))}
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
  items, qi, onSelect, selection,
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
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
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
            onClick={() => onSelect(adaptEstoqueNegativo(p, qi))}
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
  items, qi, onSelect, selection,
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
      <thead className="bg-gray-100/50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
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
              onClick={() => onSelect(adaptTitulo(t, qi))}
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
  const empresaNome = useEmpresaNome()
  const data = useQualidadeDados()
  const arquivamento = useQualidadeArquivados()
  const [view, setView] = useState<'ativos' | 'arquivados'>('ativos')
  const [selected, setSelected] = useState<LancamentoDetalheData | null>(null)
  // selectedKeys mantém key → rotulo (precisa do rótulo na hora de arquivar)
  const [selectedKeys, setSelectedKeys] = useState<Map<string, string>>(new Map())
  const [arquivando, setArquivando] = useState(false)
  const isMobile = useIsMobile()
  // Mobile: tela de triagem própria (overview das inconsistências).
  if (isMobile) return <QualidadeMobile />
  const onSelect = setSelected

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
          onSelect={onSelect}
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
        onSelect={onSelect}
        selection={makeSelection<AbastecimentoRow>(qi.id, identityAbastecimento)}
      />,
    )
  })
  const vendasIssues: Issue[] = data.vendas.map((qi) => {
    if (qi.id === 'cupom-multi-abast') {
      const items = filterArchived(qi.items as CupomMultiAbast[], qi.id, identityCupomMultiAbast)
      return toIssue(
        { ...qi, count: items.length, items },
        <CupomMultiAbastTable
          items={items}
          qi={qi}
          onSelect={onSelect}
          selection={makeSelection<CupomMultiAbast>(qi.id, identityCupomMultiAbast)}
        />,
      )
    }
    const items = filterArchived(qi.items as VendaItem[], qi.id, identityVendaItem)
    return toIssue(
      { ...qi, count: items.length, items },
      <VendaItemSemProdutoTable
        items={items}
        qi={qi}
        onSelect={onSelect}
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
          onSelect={onSelect}
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
        onSelect={onSelect}
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
        onSelect={onSelect}
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
        onSelect={onSelect}
        selection={makeSelection<TituloSemVenc>(qi.id, identityTitulo)}
      />,
    )
  })

  // Totais ativos (excluindo arquivados) — re-agrega a partir das listas filtradas
  const allFiltered = [abastIssues, vendasIssues, caixaIssues, estoqueIssues, financeiroIssues].flat()
  const totalAtivo = allFiltered.reduce((s, i) => s + i.count, 0)
  const totalCriticosAtivo = allFiltered.filter((i) => i.severity === 'high').reduce((s, i) => s + i.count, 0)
  const totalAtencaoAtivo = allFiltered.filter((i) => i.severity === 'medium').reduce((s, i) => s + i.count, 0)
  const totalInfoAtivo = allFiltered.filter((i) => i.severity === 'low').reduce((s, i) => s + i.count, 0)

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
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
            <ShieldAlert className="h-4 w-4 text-white" />
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
              {/* KPIs principais — totais por severidade */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiQD
                  label="Total de inconsistências"
                  value={data.isLoading ? null : totalAtivo}
                  hint="Soma das categorias no período (exclui arquivados)"
                  Icon={ShieldAlert}
                  tone="neutral"
                />
                <KpiQD
                  label="Críticos"
                  value={data.isLoading ? null : totalCriticosAtivo}
                  hint="Quebram cálculos — corrigir já"
                  Icon={AlertTriangle}
                  tone="high"
                />
                <KpiQD
                  label="Atenção"
                  value={data.isLoading ? null : totalAtencaoAtivo}
                  hint="Suspeitos — investigar e validar"
                  Icon={AlertTriangle}
                  tone="medium"
                />
                <KpiQD
                  label="Info"
                  value={data.isLoading ? null : totalInfoAtivo}
                  hint="Heads-up de qualidade — não bloqueia"
                  Icon={Info}
                  tone="low"
                />
              </div>

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

              {/* Sherlock — seção destacada de detecção de fraude (vai antes do resto) */}
              <div className="rounded-xl border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f]">
                    <Search className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Sistema Sherlock Holmes</h2>
                      <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-600 dark:border-gray-600 dark:text-gray-400">
                        Anti-fraude
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Detecção de cupons "montados" e inconsistências no PDV — padrão associado a fraude em postos.
                    </p>
                  </div>
                </div>
                <IssueSection
                  title="Vendas"
                  subtitle="Cupons suspeitos e itens sem cadastro"
                  Icon={Search}
                  issues={vendasIssues}
                  isLoading={data.isLoading}
                  embedded
                />
              </div>

              {/* Outras categorias de qualidade — checks rotineiros */}
              <div className="grid grid-cols-1 gap-4">
                <IssueSection title="Abastecimentos" subtitle="Erros nos lançamentos de bomba" Icon={Fuel} issues={abastIssues} isLoading={data.isLoading} />
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
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
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
  // Só severidade crítica (high) mantém cor — outros viram cinza neutro pra não
  // poluir visualmente. Os números ainda comunicam a urgência sozinhos.
  const map = {
    high: { iconBg: 'bg-red-50 dark:bg-red-900/20', iconColor: 'text-red-600 dark:text-red-400', valueColor: 'text-red-700 dark:text-red-300' },
    medium: { iconBg: 'bg-gray-100 dark:bg-gray-800', iconColor: 'text-gray-600 dark:text-gray-300', valueColor: 'text-gray-900 dark:text-gray-100' },
    low: { iconBg: 'bg-gray-100 dark:bg-gray-800', iconColor: 'text-gray-600 dark:text-gray-300', valueColor: 'text-gray-900 dark:text-gray-100' },
    neutral: { iconBg: 'bg-gray-100 dark:bg-gray-800', iconColor: 'text-gray-600 dark:text-gray-300', valueColor: 'text-gray-900 dark:text-gray-100' },
  }
  const s = map[tone]
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
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
