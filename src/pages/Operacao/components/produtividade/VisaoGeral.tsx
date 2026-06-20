import { Fragment, useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import { formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import { fuelLabel } from '@/lib/fuel'
import BarCell from '@/components/tables/BarCell'
import FrentistaDetalheModal from '@/pages/Operacao/components/produtividade/FrentistaDetalheModal'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import type { AbastecimentoRow as AbastecimentoComCusto } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import type { FrentistaDescAcr } from '@/pages/Operacao/hooks/useFuelVendaCost'

interface Props {
  /** Abastecimentos crus do período — pro modal de detalhe por produto. */
  abastecimentos: AbastecimentoRow[]
  /** Linhas com custo/lucro (analytics) — fonte das métricas financeiras. */
  abastComCusto?: AbastecimentoComCusto[]
  /** Acréscimo/desconto reais por frentista+produto (`func|prod`) — combustível. */
  descAcrByFrentista?: Map<string, FrentistaDescAcr>
}

type SortKey =
  | 'nome'
  | 'litros'
  | 'abastecimentos'
  | 'convertidos'
  | 'faturamento'
  | 'custo'
  | 'lucroBruto'
  | 'acresDesc'
  | 'margemPct'
  | 'ticketMedio'
type SortDir = 'asc' | 'desc'

// ── Helpers ──
const upper = (s: string) => (s ?? '').toUpperCase()
const isAutomotivo = (n: string): boolean => {
  const u = upper(n)
  return u.includes('GASOLINA') || u.includes('ETANOL') || u.includes('ALCOOL') || u.includes('ÁLCOOL') ||
    u.includes('DIESEL') || u.includes('S-10') || u.includes('S10') || u.includes('S500')
}

/** Família só pra ORDENAR as pills (Gasolina → Etanol → Diesel → resto). */
const fuelFamily = (nome: string): string | null => {
  const u = upper(nome)
  if (u.includes('GASOLINA')) return 'Gasolina'
  if (u.includes('ETANOL') || u.includes('ALCOOL') || u.includes('ÁLCOOL')) return 'Etanol'
  if (u.includes('DIESEL') || u.includes('S-10') || u.includes('S10') || u.includes('S500')) return 'Diesel'
  return null
}
const FUEL_ORDER = ['Gasolina', 'Etanol', 'Diesel']

/** Quebra por combustível dentro de um frentista (visão expandida). */
interface CombustivelRow {
  produtoCodigo: number
  nome: string
  litros: number
  abastecimentos: number
  faturamento: number
  custo: number
  lucroBruto: number | null
  margemPct: number | null
  ticketMedio: number
}

/** Linha consolidada por frentista no período. */
interface FrentistaConsolidado {
  codigo: number
  nome: string
  litros: number
  automotivo: number
  abastecimentos: number
  /** Nº de abastecimentos que casaram com um item de venda. */
  convertidos: number
  faturamento: number
  /** Custo total — null quando nenhum custo do período carregou ainda. */
  custo: number | null
  lucroBruto: number | null
  /** Acréscimo − desconto (R$) reais do frentista no período (combustível). */
  acresDesc: number
  margemPct: number | null
  ticketMedio: number
  combustiveis: CombustivelRow[]
}

const compareRow = (a: FrentistaConsolidado, b: FrentistaConsolidado, key: SortKey, dir: SortDir): number => {
  let av: number | string = 0
  let bv: number | string = 0
  switch (key) {
    case 'nome': av = a.nome; bv = b.nome; break
    case 'litros': av = a.litros; bv = b.litros; break
    case 'abastecimentos': av = a.abastecimentos; bv = b.abastecimentos; break
    case 'convertidos': av = a.convertidos; bv = b.convertidos; break
    case 'faturamento': av = a.faturamento; bv = b.faturamento; break
    case 'custo': av = a.custo ?? -Infinity; bv = b.custo ?? -Infinity; break
    case 'lucroBruto': av = a.lucroBruto ?? -Infinity; bv = b.lucroBruto ?? -Infinity; break
    case 'acresDesc': av = a.acresDesc; bv = b.acresDesc; break
    case 'margemPct': av = a.margemPct ?? -Infinity; bv = b.margemPct ?? -Infinity; break
    case 'ticketMedio': av = a.ticketMedio; bv = b.ticketMedio; break
    default: av = a.litros; bv = b.litros
  }
  if (typeof av === 'string' && typeof bv === 'string') {
    return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  }
  return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
}

const fmtPct = (v: number | null): string =>
  v === null ? '—' : `${v.toFixed(2).replace('.', ',')}%`

const VisaoGeral = ({ abastecimentos, abastComCusto, descAcrByFrentista }: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>('litros')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  // Filtro por combustível — multi-seleção por produtoCodigo. Vazio = todos.
  const [fuelSel, setFuelSel] = useState<Set<number>>(new Set())
  const toggleFuel = (codigo: number) =>
    setFuelSel((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  // Frentistas expandidos (mostram a quebra por combustível).
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  // Frentista aberto no modal de detalhe por produto/dia.
  const [modalFrentista, setModalFrentista] = useState<{ codigo: number; nome: string } | null>(null)

  const toggleExpand = (codigo: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })

  // Consolidação por frentista no período (sem quebra diária). Métricas
  // financeiras (custo/lucro/margem) e "convertidos em venda" vêm das linhas
  // com custo do analytics; litros/faturamento/abast/ticket têm fallback nas
  // linhas cruas (mostradas mesmo enquanto o custo carrega).
  const frentistas = useMemo<FrentistaConsolidado[]>(() => {
    const hasCusto = (abastComCusto?.length ?? 0) > 0

    interface Acc {
      codigo: number
      nome: string
      litros: number
      automotivo: number
      abast: number
      convertidos: number
      fat: number
      custo: number
      hasAnyCusto: boolean
      // produtoCodigo → combustível
      comb: Map<number, { nome: string; litros: number; abast: number; fat: number; custo: number; hasCusto: boolean }>
    }
    const map = new Map<number, Acc>()

    const ensure = (codigo: number, nome: string): Acc => {
      const cur = map.get(codigo) ?? {
        codigo, nome,
        litros: 0, automotivo: 0, abast: 0, convertidos: 0, fat: 0, custo: 0, hasAnyCusto: false,
        comb: new Map(),
      }
      map.set(codigo, cur)
      return cur
    }

    if (hasCusto) {
      for (const r of abastComCusto ?? []) {
        if (fuelSel.size > 0 && !fuelSel.has(r.produtoCodigo)) continue
        const acc = ensure(r.frentistaCodigo, r.frentistaNome)
        acc.litros += r.litros
        acc.abast += 1
        acc.fat += r.valorTotal
        if (r.vendaItemCodigo > 0) acc.convertidos += 1
        if (isAutomotivo(r.combustivelNome)) acc.automotivo += r.litros
        const rowHasCusto = r.precoCusto > 0
        if (rowHasCusto) { acc.custo += r.precoCusto * r.litros; acc.hasAnyCusto = true }
        const c = acc.comb.get(r.produtoCodigo) ?? {
          nome: r.combustivelNome, litros: 0, abast: 0, fat: 0, custo: 0, hasCusto: false,
        }
        c.litros += r.litros
        c.abast += 1
        c.fat += r.valorTotal
        if (rowHasCusto) { c.custo += r.precoCusto * r.litros; c.hasCusto = true }
        acc.comb.set(r.produtoCodigo, c)
      }
    } else {
      // Fallback sem custo — só litros/fat/abast/ticket a partir das linhas cruas.
      for (const a of abastecimentos) {
        if (fuelSel.size > 0 && !fuelSel.has(a.produtoCodigo)) continue
        const acc = ensure(a.frentistaCodigo, a.frentistaNome)
        acc.litros += a.litros
        acc.abast += 1
        acc.fat += a.valorTotal
        if (isAutomotivo(a.produtoNome)) acc.automotivo += a.litros
        const c = acc.comb.get(a.produtoCodigo) ?? {
          nome: a.produtoNome, litros: 0, abast: 0, fat: 0, custo: 0, hasCusto: false,
        }
        c.litros += a.litros
        c.abast += 1
        c.fat += a.valorTotal
        acc.comb.set(a.produtoCodigo, c)
      }
    }

    // Acréscimo − desconto REAIS (R$) por produto do frentista (func|prod).
    const acrDescOf = (codigo: number, prod: number): number => {
      const d = descAcrByFrentista?.get(`${codigo}|${prod}`)
      return (d?.acrescimo ?? 0) - (d?.desconto ?? 0)
    }

    const rows = Array.from(map.values()).map((acc) => {
      // acc.fat vem BRUTO (o hook não abate o desconto no valorTotal — o lookup
      // do desconto erra por mismatch de tipo no código do produto). O líquido
      // = bruto + (acréscimo − desconto) EXATOS do item de venda → bate com o
      // Vendas/Combustível. acc.comb já está filtrado por fuelSel.
      const acresDesc = Array.from(acc.comb.keys()).reduce((s, prod) => s + acrDescOf(acc.codigo, prod), 0)
      const faturamento = acc.fat + acresDesc
      const custo = acc.hasAnyCusto ? acc.custo : null
      const lucroBruto = custo === null ? null : faturamento - custo
      const margemPct = lucroBruto === null || faturamento <= 0 ? null : (lucroBruto / faturamento) * 100
      const combustiveis: CombustivelRow[] = Array.from(acc.comb.entries())
        .map(([produtoCodigo, c]) => {
          const cFat = c.fat + acrDescOf(acc.codigo, produtoCodigo)
          const cCusto = c.hasCusto ? c.custo : null
          const cLucro = cCusto === null ? null : cFat - cCusto
          return {
            produtoCodigo,
            nome: c.nome,
            litros: c.litros,
            abastecimentos: c.abast,
            faturamento: cFat,
            custo: cCusto ?? 0,
            lucroBruto: cLucro,
            margemPct: cLucro === null || cFat <= 0 ? null : (cLucro / cFat) * 100,
            ticketMedio: c.abast > 0 ? cFat / c.abast : 0,
          }
        })
        .sort((a, b) => b.litros - a.litros)
      return {
        codigo: acc.codigo,
        nome: acc.nome,
        litros: acc.litros,
        automotivo: acc.automotivo,
        abastecimentos: acc.abast,
        convertidos: acc.convertidos,
        faturamento,
        custo,
        lucroBruto,
        acresDesc,
        margemPct,
        ticketMedio: acc.abast > 0 ? faturamento / acc.abast : 0,
        combustiveis,
      }
    })
    rows.sort((a, b) => compareRow(a, b, sortKey, sortDir))
    return rows
  }, [abastecimentos, abastComCusto, sortKey, sortDir, fuelSel, descAcrByFrentista])

  // Combustíveis presentes no período (pras pills do filtro), por produto.
  // Ordena por família (Gasolina → Etanol → Diesel → resto) e depois por nome.
  const availableFuels = useMemo(() => {
    const m = new Map<number, string>()
    if ((abastComCusto?.length ?? 0) > 0) {
      for (const r of abastComCusto ?? []) if (!m.has(r.produtoCodigo)) m.set(r.produtoCodigo, r.combustivelNome)
    } else {
      for (const a of abastecimentos) if (!m.has(a.produtoCodigo)) m.set(a.produtoCodigo, a.produtoNome)
    }
    const famIdx = (n: string) => {
      const i = FUEL_ORDER.indexOf(fuelFamily(n) ?? '')
      return i < 0 ? FUEL_ORDER.length : i
    }
    return [...m].map(([codigo, nome]) => ({ codigo, nome }))
      .sort((a, b) => famIdx(a.nome) - famIdx(b.nome) || a.nome.localeCompare(b.nome))
  }, [abastecimentos, abastComCusto])

  // Mostra a coluna "Convertidos" só quando há base de custo (de onde sai o
  // vínculo com a venda); sem ela, o valor seria sempre 0 e enganaria.
  const showConvertidos = (abastComCusto?.length ?? 0) > 0

  // Totais do período (rodapé).
  const totals = useMemo(() => {
    const hasCusto = frentistas.some((f) => f.custo !== null)
    const fat = frentistas.reduce((s, f) => s + f.faturamento, 0)
    const custo = hasCusto ? frentistas.reduce((s, f) => s + (f.custo ?? 0), 0) : null
    const lucro = custo === null ? null : fat - custo
    const abast = frentistas.reduce((s, f) => s + f.abastecimentos, 0)
    return {
      litros: frentistas.reduce((s, f) => s + f.litros, 0),
      abastecimentos: abast,
      convertidos: frentistas.reduce((s, f) => s + f.convertidos, 0),
      faturamento: fat,
      custo,
      lucroBruto: lucro,
      acresDesc: frentistas.reduce((s, f) => s + f.acresDesc, 0),
      margemPct: lucro === null || fat <= 0 ? null : (lucro / fat) * 100,
      ticketMedio: abast > 0 ? fat / abast : 0,
    }
  }, [frentistas])

  const colMax = useMemo(() => ({
    litros: Math.max(...frentistas.map((f) => f.litros), 0),
    abastecimentos: Math.max(...frentistas.map((f) => f.abastecimentos), 0),
    faturamento: Math.max(...frentistas.map((f) => f.faturamento), 0),
    lucroBruto: Math.max(...frentistas.map((f) => f.lucroBruto ?? 0), 0),
    ticketMedio: Math.max(...frentistas.map((f) => f.ticketMedio), 0),
  }), [frentistas])

  const handleColumnSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'nome' ? 'asc' : 'desc')
    }
  }

  // Nº de colunas da tabela (pra colspans). 1 expand + # + nome + litros +
  // abast (+ convertidos?) + fat + custo + lucro + margem + ticket.
  const colCount = showConvertidos ? 12 : 11

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Comparativo de Frentistas
              </h3>
              <InfoHint
                text="Consolidado do período por frentista. Clique na seta pra ver a quebra por combustível, ou no nome pra abrir o detalhe diário por produto."
                align="start"
              />
            </div>
            <p className="mt-0.5 text-xs italic text-gray-400">
              Desempenho consolidado no período · expanda pra ver por combustível
            </p>
          </div>
          <div className="inline-flex max-w-full flex-wrap items-center justify-end gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            <button
              onClick={() => setFuelSel(new Set())}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                fuelSel.size === 0
                  ? 'bg-[#1e3a5f] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
              )}
            >
              Todos
            </button>
            {availableFuels.map((f) => (
              <button
                key={f.codigo}
                onClick={() => toggleFuel(f.codigo)}
                aria-pressed={fuelSel.has(f.codigo)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  fuelSel.has(f.codigo)
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                {fuelLabel(f.nome)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {/* Títulos de grupo (padrão Operação · Financeiro · Eficiência) */}
              <tr className="border-b border-gray-100 bg-gray-50/60 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-500">
                <th colSpan={3} className="px-2 py-1.5" />
                <th colSpan={showConvertidos ? 3 : 2} className="px-3 py-1.5 text-center">Operação</th>
                <th colSpan={5} className="border-l border-gray-200 px-3 py-1.5 text-center dark:border-gray-700">Financeiro</th>
                <th colSpan={1} className="border-l border-gray-200 px-3 py-1.5 text-center dark:border-gray-700">Eficiência</th>
              </tr>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="w-8 px-2 py-2" />
                <Th className="w-10">#</Th>
                <ThSort label="Frentista" k="nome" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('nome')} align="left" />
                <ThSort label="Litros" k="litros" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('litros')} help="Litros de combustível vendidos pelo frentista no período." />
                <ThSort label="Abastec." k="abastecimentos" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('abastecimentos')} help="Número de abastecimentos realizados pelo frentista." />
                {showConvertidos && (
                  <ThSort label="Convertidos" k="convertidos" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('convertidos')} help="Abastecimentos que casaram com um item de venda autorizado." />
                )}
                <ThSort label="Faturamento" k="faturamento" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('faturamento')} groupStart help="Faturamento líquido = Bruto + Acréscimo − Desconto (o desconto já está abatido)." />
                <ThSort label="Custo" k="custo" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('custo')} help="CMV — custo da mercadoria vendida (preço de custo × litros)." />
                <ThSort label="Lucro bruto" k="lucroBruto" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('lucroBruto')} help="Faturamento − Custo (CMV)." />
                <ThSort label="Acrés./Desc." k="acresDesc" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('acresDesc')} help="Acréscimos − descontos reais do frentista no período (combustível). Valor negativo = desconto predominou." />
                <ThSort label="% Margem" k="margemPct" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('margemPct')} help="(Lucro bruto ÷ faturamento) × 100." />
                <ThSort label="Ticket méd." k="ticketMedio" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('ticketMedio')} groupStart help="Faturamento ÷ número de abastecimentos." />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {frentistas.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="py-8 text-center text-sm text-gray-400">
                    Sem dados de frentistas no período.
                  </td>
                </tr>
              ) : (
                frentistas.map((f, idx) => {
                  const isExpanded = expanded.has(f.codigo)
                  return (
                    <Fragment key={f.codigo}>
                      <tr
                        className={cn(
                          'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40',
                          idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30',
                        )}
                      >
                        <td className="px-2 py-2.5">
                          <button
                            onClick={() => toggleExpand(f.codigo)}
                            aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                            aria-expanded={isExpanded}
                            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                          >
                            <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-xs tabular-nums text-gray-400">{idx + 1}</td>
                        <td
                          onClick={() => setModalFrentista({ codigo: f.codigo, nome: f.nome })}
                          title="Ver detalhe diário por produto"
                          className="cursor-pointer px-4 py-2.5 text-sm font-medium text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                        >
                          {f.nome}
                        </td>
                        <td className="px-2 py-2.5">
                          <BarCell value={f.litros} max={colMax.litros} formatted={formatLiters(f.litros)} color="blue" align="near" />
                        </td>
                        <td className="px-2 py-2.5">
                          <BarCell value={f.abastecimentos} max={colMax.abastecimentos} formatted={formatNumber(f.abastecimentos)} color="blue" align="near" />
                        </td>
                        {showConvertidos && (
                          <td className="px-4 py-2.5 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                            {formatNumber(f.convertidos)}
                          </td>
                        )}
                        <td className="border-l border-gray-200 px-2 py-2.5 dark:border-gray-700">
                          <BarCell value={f.faturamento} max={colMax.faturamento} formatted={formatCurrencyInt(f.faturamento)} color="green" align="near" />
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">
                          {f.custo === null ? '—' : formatCurrencyInt(f.custo)}
                        </td>
                        <td className="px-2 py-2.5">
                          {f.lucroBruto === null
                            ? <div className="text-right text-sm text-gray-400">—</div>
                            : <BarCell value={f.lucroBruto} max={colMax.lucroBruto} formatted={formatCurrencyInt(f.lucroBruto)} color="green" align="near" />}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-500 dark:text-gray-400">
                          {f.acresDesc === 0 ? '—' : formatCurrencyInt(f.acresDesc)}
                        </td>
                        <td className={cn(
                          'px-4 py-2.5 text-right text-sm font-medium tabular-nums',
                          f.margemPct === null ? 'text-gray-400'
                            : f.margemPct >= 0 ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400',
                        )}>
                          {fmtPct(f.margemPct)}
                        </td>
                        <td className="border-l border-gray-200 px-2 py-2.5 dark:border-gray-700">
                          <BarCell value={f.ticketMedio} max={colMax.ticketMedio} formatted={formatCurrencyInt(f.ticketMedio)} color="amber" align="near" />
                        </td>
                      </tr>

                      {/* Quebra por combustível (linha expandida) */}
                      {isExpanded && f.combustiveis.map((c) => (
                        <tr
                          key={`${f.codigo}-${c.produtoCodigo}`}
                          className="bg-gray-50/60 text-xs dark:bg-gray-800/40"
                        >
                          <td />
                          <td />
                          <td className="py-2 pl-8 pr-4 text-gray-600 dark:text-gray-400">{c.nome}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{formatLiters(c.litros)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{formatNumber(c.abastecimentos)}</td>
                          {showConvertidos && <td />}
                          <td className="border-l border-gray-200 px-4 py-2 text-right tabular-nums text-gray-600 dark:border-gray-700 dark:text-gray-400">{formatCurrencyInt(c.faturamento)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{c.lucroBruto === null ? '—' : formatCurrencyInt(c.custo)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{c.lucroBruto === null ? '—' : formatCurrencyInt(c.lucroBruto)}</td>
                          <td />
                          <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">{fmtPct(c.margemPct)}</td>
                          <td className="border-l border-gray-200 px-4 py-2 text-right tabular-nums text-gray-600 dark:border-gray-700 dark:text-gray-400">{formatCurrencyInt(c.ticketMedio)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })
              )}
            </tbody>
            {frentistas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200">
                  <td />
                  <td />
                  <td className="px-4 py-2.5">Total do período</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatLiters(totals.litros)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(totals.abastecimentos)}</td>
                  {showConvertidos && <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(totals.convertidos)}</td>}
                  <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{formatCurrencyInt(totals.faturamento)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{totals.custo === null ? '—' : formatCurrencyInt(totals.custo)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{totals.lucroBruto === null ? '—' : formatCurrencyInt(totals.lucroBruto)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{totals.acresDesc === 0 ? '—' : formatCurrencyInt(totals.acresDesc)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtPct(totals.margemPct)}</td>
                  <td className="border-l border-gray-200 px-4 py-2.5 text-right tabular-nums dark:border-gray-700">{formatCurrencyInt(totals.ticketMedio)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <FrentistaDetalheModal
        open={modalFrentista !== null}
        onClose={() => setModalFrentista(null)}
        nome={modalFrentista?.nome ?? ''}
        codigo={modalFrentista?.codigo ?? -1}
        abastecimentos={abastecimentos}
      />
    </div>
  )
}

interface ThProps {
  children: React.ReactNode
  className?: string
}

const Th = ({ children, className }: ThProps) => (
  <th className={cn('px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400', className)}>
    {children}
  </th>
)

interface ThSortProps {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onClick: () => void
  align?: 'left' | 'right' | 'center'
  /** Marca o início de um grupo de colunas — desenha um divisor vertical sutil. */
  groupStart?: boolean
  /** Texto de ajuda ("?") ao lado do rótulo. */
  help?: string
}

const ThSort = ({ label, k, sortKey, sortDir, onClick, align = 'right', groupStart, help }: ThSortProps) => {
  const isActive = sortKey === k
  return (
    <th className={cn(
      'whitespace-nowrap px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400',
      align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right',
      groupStart && 'border-l border-gray-200 dark:border-gray-700',
    )}>
      <span className={cn(
        'inline-flex items-center gap-1',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center',
      )}>
        <button
          onClick={onClick}
          className={cn(
            'inline-flex items-center gap-1 transition-colors hover:text-gray-700 dark:hover:text-gray-200',
            align === 'right' && 'flex-row-reverse',
            isActive && 'text-gray-900 dark:text-gray-100'
          )}
        >
          {label}
          {isActive ? (
            sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-30" />
          )}
        </button>
        {help && <InfoHint text={help} />}
      </span>
    </th>
  )
}

export default VisaoGeral
