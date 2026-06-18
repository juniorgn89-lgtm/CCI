import { useMemo, useState } from 'react'
import {
  Receipt, DollarSign, TrendingUp, Wallet, Scale, CreditCard, Users,
  AlertTriangle, Check, ChevronDown,
} from 'lucide-react'
import useOperacaoData, { type TurnoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import { useFilterStore } from '@/store/filters'
import { formatNumber, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { KpiCard, Section, Segmented, Badge } from '@/components/mobile/primitives'
import { DonutMobile } from '@/components/mobile/charts'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brl, brlShort, pct } from '@/components/mobile/format'

const fmtBRDate = (iso: string): string => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-')
const caixaKey = (c: { caixaCodigo: number; dataMovimento: string }) => `${c.caixaCodigo}-${c.dataMovimento.slice(0, 10)}`

/* ── Picker de caixas (colapsável, agrupado por dia) ── */
interface PickerProps {
  caixas: TurnoRow[]
  selectedKeys: string[]
  onChange: (keys: string[]) => void
  includeAbertos: boolean
  onIncludeAbertosChange: (v: boolean) => void
}
const CaixaPicker = ({ caixas, selectedKeys, onChange, includeAbertos, onIncludeAbertosChange }: PickerProps) => {
  const [open, setOpen] = useState(false)
  const selectedSet = new Set(selectedKeys)

  const porData = useMemo(() => {
    const map = new Map<string, TurnoRow[]>()
    for (const c of caixas) {
      const dia = c.dataMovimento.slice(0, 10)
      if (!map.has(dia)) map.set(dia, [])
      map.get(dia)!.push(c)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dia, lista]) => ({ dia, lista: [...lista].sort((x, y) => x.turnoCodigo - y.turnoCodigo) }))
  }, [caixas])

  const toggle = (key: string) =>
    onChange(selectedSet.has(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key])
  const toggleDay = (lista: TurnoRow[]) => {
    const dayKeys = lista.map(caixaKey)
    const allOn = dayKeys.every((k) => selectedSet.has(k))
    onChange(allOn ? selectedKeys.filter((k) => !dayKeys.includes(k)) : [...new Set([...selectedKeys, ...dayKeys])])
  }

  return (
    <Section
      Icon={Receipt}
      title="Caixas selecionados"
      accent="navy"
      right={<Badge tone="navy">{selectedKeys.length}/{caixas.length}</Badge>}
      flush
    >
      <div className="space-y-2.5 p-3">
        <Segmented
          value={includeAbertos ? 'abertos' : 'fechados'}
          onChange={(v) => onIncludeAbertosChange(v === 'abertos')}
          options={[{ value: 'fechados', label: 'Só fechados' }, { value: 'abertos', label: 'Incluir abertos' }]}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex flex-1 items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12.5px] font-medium text-gray-700 dark:border-[#3a3a3a] dark:bg-[#242424] dark:text-gray-200"
          >
            <span>{open ? 'Fechar lista' : 'Escolher caixas'}</span>
            <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
          </button>
          <button type="button" onClick={() => onChange(caixas.map(caixaKey))} className="text-[12px] font-medium text-blue-600 dark:text-blue-400">Todos</button>
          <button type="button" onClick={() => onChange([])} className="text-[12px] font-medium text-gray-400 dark:text-gray-500">Limpar</button>
        </div>
      </div>

      {open && (
        <div className="max-h-[50vh] overflow-y-auto border-t border-gray-100 dark:border-[#303030]">
          {caixas.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-[12px] text-gray-400">Nenhum caixa no período.</p>
          ) : (
            porData.map(({ dia, lista }) => {
              const allDayOn = lista.every((c) => selectedSet.has(caixaKey(c)))
              return (
                <div key={dia} className="border-b border-gray-100 last:border-0 dark:border-[#303030]">
                  <div className="flex items-center justify-between bg-gray-50 px-3.5 py-1.5 dark:bg-[#1c1c1c]">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{fmtBRDate(dia)}</span>
                    <button type="button" onClick={() => toggleDay(lista)} className="text-[10.5px] font-medium text-blue-600 dark:text-blue-400">
                      {allDayOn ? 'Desmarcar dia' : 'Selecionar dia'}
                    </button>
                  </div>
                  {lista.map((c) => {
                    const on = selectedSet.has(caixaKey(c))
                    return (
                      <button
                        key={caixaKey(c)}
                        type="button"
                        onClick={() => toggle(caixaKey(c))}
                        className={cn('flex w-full items-start gap-2.5 px-3.5 py-2 text-left active:bg-gray-50 dark:active:bg-white/5', !c.fechado && 'border-l-2 border-amber-400 dark:border-amber-500/70')}
                      >
                        <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-[#2563eb] bg-[#2563eb]' : 'border-gray-300 dark:border-gray-600')}>
                          {on && <Check className="h-3 w-3 text-white" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{c.turno} · #{c.caixaCodigo}</span>
                            {!c.fechado && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Aberto</span>}
                          </div>
                          <p className="truncate text-[10.5px] text-gray-400 dark:text-gray-500">{c.funcionarioNome} · A {c.abertura || '-'} F {c.fechamento || '-'}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className="text-[11.5px] font-semibold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(c.apurado)}</span>
                          {c.fechado && Math.abs(c.diferenca) > 0.005 && (
                            <Badge tone={c.diferenca > 0 ? 'emerald' : 'rose'}>{c.diferenca > 0 ? '+' : ''}{brl(c.diferenca)}</Badge>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      )}
    </Section>
  )
}

/**
 * Fechamentos — versão mobile. Reusa useOperacaoData (turnoRows). Picker de
 * caixas colapsável (agrupado por dia, marca dia/todos/limpa), e relatório
 * agregado dos caixas selecionados: KPIs, formas de pagamento, frentistas e
 * sobras/faltas. Mesmos cálculos da Visão Geral desktop.
 */
const FechamentosMobile = () => {
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const empresaKey = empresaCodigos.join(',')
  const { turnoRows, isLoading } = useOperacaoData()

  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [includeAbertos, setIncludeAbertos] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Reset quando troca de empresa.
  const [prevEmpresaKey, setPrevEmpresaKey] = useState(empresaKey)
  if (prevEmpresaKey !== empresaKey) {
    setPrevEmpresaKey(empresaKey)
    setSelectedKeys([])
    setInitialized(false)
  }

  // Ao tirar "incluir abertos", remove os abertos da seleção.
  const [prevInclude, setPrevInclude] = useState(includeAbertos)
  if (prevInclude !== includeAbertos) {
    setPrevInclude(includeAbertos)
    if (!includeAbertos) setSelectedKeys((prev) => prev.filter((k) => turnoRows.find((r) => caixaKey(r) === k)?.fechado))
  }

  const caixasFiltrados = useMemo(() => {
    return turnoRows
      .filter((r) => includeAbertos || r.fechado)
      .sort((a, b) => {
        const d = b.dataMovimento.localeCompare(a.dataMovimento)
        return d !== 0 ? d : a.turnoCodigo - b.turnoCodigo
      })
  }, [turnoRows, includeAbertos])

  // Default mobile: pré-seleciona o dia mais recente (vê relatório na hora;
  // editável no picker). Difere do desktop (que começa vazio).
  if (!initialized && !isLoading && caixasFiltrados.length > 0) {
    setInitialized(true)
    const latestDay = caixasFiltrados[0].dataMovimento.slice(0, 10)
    setSelectedKeys(caixasFiltrados.filter((c) => c.dataMovimento.slice(0, 10) === latestDay).map(caixaKey))
  }

  const selectedCaixas = useMemo(
    () => caixasFiltrados.filter((c) => selectedKeys.includes(caixaKey(c))),
    [caixasFiltrados, selectedKeys],
  )

  const agg = useMemo(() => {
    const apurado = selectedCaixas.reduce((s, c) => s + c.apurado, 0)
    const diferencaFechados = selectedCaixas.filter((c) => c.fechado).reduce((s, c) => s + c.diferenca, 0)

    // Formas: contadas 1× por dia (o balde de formas é do dia, não do caixa).
    const pgtoMap = new Map<string, { tipo: string; nome: string; valor: number; quantidade: number }>()
    const diasContados = new Set<string>()
    for (const c of selectedCaixas) {
      const dia = c.dataMovimento?.slice(0, 10) ?? String(c.caixaCodigo)
      if (diasContados.has(dia)) continue
      diasContados.add(dia)
      for (const p of c.pagamentos) {
        const prev = pgtoMap.get(p.tipo) ?? { tipo: p.tipo, nome: p.nome, valor: 0, quantidade: 0 }
        prev.valor += p.valor
        prev.quantidade += p.quantidade
        pgtoMap.set(p.tipo, prev)
      }
    }
    const pagamentos = Array.from(pgtoMap.values()).sort((a, b) => b.valor - a.valor)
    const totalPagamentos = pagamentos.reduce((s, p) => s + p.valor, 0)

    const frentMap = new Map<string, { nome: string; litros: number; atendimentos: number; faturamento: number }>()
    for (const c of selectedCaixas) {
      for (const f of c.frentistas) {
        const prev = frentMap.get(f.nome) ?? { nome: f.nome, litros: 0, atendimentos: 0, faturamento: 0 }
        prev.litros += f.litros
        prev.atendimentos += f.atendimentos
        prev.faturamento += f.faturamento
        frentMap.set(f.nome, prev)
      }
    }
    const frentistas = Array.from(frentMap.values()).sort((a, b) => b.faturamento - a.faturamento)
    const totalCombustivel = frentistas.reduce((s, f) => s + f.faturamento, 0)
    const conveniencia = Math.max(0, apurado - totalCombustivel)

    // Vendedores de loja (conveniência) — cache por DIA × funcionário, então
    // dedup por dia evita somar o mesmo vendedor quando há vários caixas de loja.
    const vendMap = new Map<number, { funcionarioCodigo: number; nome: string; faturamento: number; itens: number; cupons: number }>()
    const diasVend = new Set<string>()
    for (const c of selectedCaixas) {
      if (c.vendedores.length === 0) continue
      const dia = c.dataMovimento?.slice(0, 10) ?? String(c.caixaCodigo)
      if (diasVend.has(dia)) continue
      diasVend.add(dia)
      for (const v of c.vendedores) {
        const prev = vendMap.get(v.funcionarioCodigo) ?? { funcionarioCodigo: v.funcionarioCodigo, nome: v.nome, faturamento: 0, itens: 0, cupons: 0 }
        prev.faturamento += v.faturamento
        prev.itens += v.itens
        prev.cupons += v.cupons
        vendMap.set(v.funcionarioCodigo, prev)
      }
    }
    const vendedores = Array.from(vendMap.values()).sort((a, b) => b.faturamento - a.faturamento)
    const totalVendedores = vendedores.reduce((s, v) => s + v.faturamento, 0)

    return { apurado, diferencaFechados, pagamentos, totalPagamentos, frentistas, totalCombustivel, conveniencia, vendedores, totalVendedores }
  }, [selectedCaixas])

  const caixasComDiferenca = useMemo(
    () => selectedCaixas.filter((c) => c.fechado && Math.abs(c.diferenca) > 0.005).sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca)),
    [selectedCaixas],
  )

  if (isLoading) return <LoadingScreen message="Carregando fechamentos…" />

  const dif = agg.diferencaFechados
  const difTone = dif < -0.005 ? 'rose' : dif > 0.005 ? 'amber' : 'navy'
  const donut = (() => {
    const top = agg.pagamentos.slice(0, 5).map((p) => ({ nome: p.nome, valor: p.valor }))
    const resto = agg.pagamentos.slice(5).reduce((s, p) => s + p.valor, 0)
    if (resto > 0) top.push({ nome: 'Outros', valor: resto })
    return top
  })()
  const fechadosCount = selectedCaixas.filter((c) => c.fechado).length

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Fechamentos</h1>

      <CaixaPicker
        caixas={caixasFiltrados}
        selectedKeys={selectedKeys}
        onChange={setSelectedKeys}
        includeAbertos={includeAbertos}
        onIncludeAbertosChange={setIncludeAbertos}
      />

      {selectedKeys.length === 0 ? (
        <EmptyCard title="Selecione um ou mais caixas" desc="Use o seletor acima — pode marcar dias inteiros ou caixas individuais." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard span2 big label="Apurado total" tone="blue" Icon={DollarSign}
              value={brlShort(agg.apurado)} sub={`${selectedKeys.length} ${selectedKeys.length === 1 ? 'caixa' : 'caixas'}`} />
            <KpiCard label="Combustível" tone="emerald" Icon={TrendingUp}
              value={brlShort(agg.totalCombustivel)} sub={agg.apurado > 0 ? `${pct((agg.totalCombustivel / agg.apurado) * 100)} do apurado` : '—'} />
            <KpiCard label="Conveniência" tone="violet" Icon={Wallet}
              value={brlShort(agg.conveniencia)} sub="Apurado − combustível" />
            <KpiCard span2 label="Diferença (fechados)" tone={difTone} Icon={Scale}
              value={`${dif > 0 ? '+' : ''}${brl(dif)}`} sub={`${fechadosCount}/${selectedKeys.length} fechados`} />
          </div>

          {donut.length > 0 && (
            <Section Icon={CreditCard} title="Formas de pagamento" accent="blue"
              right={<span className="text-[11px] tabular-nums text-gray-400">{brlShort(agg.totalPagamentos)}</span>}>
              <DonutMobile data={donut} centerTop={brlShort(agg.totalPagamentos)} centerSub="total" />
            </Section>
          )}

          {agg.frentistas.length > 0 && (
            <Section Icon={Users} title="Frentistas" accent="amber" flush>
              <div className="divide-y divide-gray-100 dark:divide-[#303030]">
                {agg.frentistas.map((f) => {
                  const ptc = agg.totalCombustivel > 0 ? (f.faturamento / agg.totalCombustivel) * 100 : 0
                  return (
                    <div key={f.nome} className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{f.nome}</span>
                        <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(f.faturamento)}</span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] tabular-nums text-gray-400 dark:text-gray-500">
                        {formatNumber(f.atendimentos)} abast. · {formatLiters(f.litros)} · {pct(ptc)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {agg.vendedores.length > 0 && (
            <Section Icon={Users} title="Vendedores da loja" accent="violet"
              right={<span className="text-[11px] tabular-nums text-gray-400">{brlShort(agg.totalVendedores)}</span>} flush>
              <div className="divide-y divide-gray-100 dark:divide-[#303030]">
                {agg.vendedores.map((v) => {
                  const ptc = agg.totalVendedores > 0 ? (v.faturamento / agg.totalVendedores) * 100 : 0
                  return (
                    <div key={v.funcionarioCodigo} className="px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{v.nome}</span>
                        <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(v.faturamento)}</span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] tabular-nums text-gray-400 dark:text-gray-500">
                        {formatNumber(v.cupons)} cupons · {formatNumber(v.itens)} itens · {pct(ptc)}
                      </p>
                    </div>
                  )
                })}
              </div>
              <p className="border-t border-gray-100 px-3.5 py-1.5 text-[9.5px] leading-snug text-gray-400 dark:border-[#303030] dark:text-gray-500">
                Vendedores de loja são atribuídos pelo dia (a apuração por funcionário não separa por caixa/PDV).
              </p>
            </Section>
          )}

          {caixasComDiferenca.length > 0 && (
            <Section Icon={AlertTriangle} title="Sobras e faltas" accent="rose"
              right={<Badge tone="rose">{caixasComDiferenca.length}</Badge>} flush>
              <div className="divide-y divide-gray-100 dark:divide-[#303030]">
                {caixasComDiferenca.map((c) => (
                  <div key={caixaKey(c)} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{c.turno} · #{c.caixaCodigo}</p>
                      <p className="truncate text-[10.5px] text-gray-400 dark:text-gray-500">{fmtBRDate(c.dataMovimento)} · {c.funcionarioNome}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-[11px] tabular-nums text-gray-400">{brlShort(c.apurado)}</span>
                      <Badge tone={c.diferenca > 0 ? 'emerald' : 'rose'}>{c.diferenca > 0 ? '+' : ''}{brl(c.diferenca)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  )
}

export default FechamentosMobile
