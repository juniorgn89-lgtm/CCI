import { useMemo, useState, type ReactNode } from 'react'
import { Search, Wallet, Percent, Receipt, ShoppingCart, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import NotaLeitura from '@/components/ui/NotaLeitura'
import ProjTend from '@/pages/Produtividade/components/ProjTend'
import PodioPeriodoSwitch, { type PodioPeriodo } from '@/pages/Produtividade/components/PodioPeriodoSwitch'
import type { LojaPodio, LojaRedeWideData } from '@/pages/Produtividade/hooks/useLojaRedeWide'

interface Props {
  data: LojaRedeWideData
  /** Rótulo de escopo ("Todos os postos" / "N postos" / nome do posto). */
  escopo?: string
  /** Clique numa linha/pódio → abre esse vendedor na sub-aba Funcionários DO
   *  POSTO DELE. Passa (funcionarioCodigo, empresaCodigo) porque o código sozinho
   *  colide entre postos (cada posto numera do 1). */
  onOpenVendedor?: (codigo: number, empresaCodigo?: number) => void
}

/** Identidade composta rede-wide: (empresaCodigo, funcionarioCodigo). */
const ck = (empresaCodigo: number, funcionarioCodigo: number) => `${empresaCodigo}:${funcionarioCodigo}`

const fmtR = (v: number) => formatCurrency(v)
const fmtRi = (v: number) => formatCurrencyInt(v)
const fmtN = (v: number) => formatNumber(v)
const fmtPct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`

const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?'

const semCadastro = (nome: string) => !nome || nome === '—' || /^Funcion[aá]rio\s+\d+$/i.test(nome)

/* ─── KPI (cards tintados; mesma pegada do ProdutividadeDash) ─── */
type KpiTone = 'green' | 'blue' | 'amber'
const KPI_TONE: Record<KpiTone, { card: string; chip: string; icon: string }> = {
  green: { card: 'from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900', chip: 'bg-emerald-100 dark:bg-emerald-900/30', icon: 'text-emerald-600 dark:text-emerald-400' },
  blue: { card: 'from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900', chip: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400' },
  amber: { card: 'from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900', chip: 'bg-amber-100 dark:bg-amber-900/30', icon: 'text-amber-600 dark:text-amber-400' },
}
const KpiCard = ({ label, value, Icon, tone, hint }: { label: string; value: string; Icon: typeof Wallet; tone: KpiTone; hint?: string }) => {
  const t = KPI_TONE[tone]
  return (
    <div className={cn('flex flex-col rounded-2xl border border-gray-200 bg-gradient-to-br px-5 py-[18px] shadow-sm dark:border-gray-800', t.card)}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}{hint && <InfoHint text={hint} />}</p>
        <div className={cn('flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg', t.chip)}>
          <Icon className={cn('h-4 w-4', t.icon)} />
        </div>
      </div>
      <p className="mt-3 text-[28px] font-bold leading-none tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  )
}

/* ─── Pódio (Top 3: 1º destacado + 2º/3º em linha; mostra o posto por colocado) ─── */
const PodiumCard = ({ title, Icon, items, fmt, contexto, onOpen }: {
  title: string; Icon: typeof Wallet; items: LojaPodio[]; fmt: (v: number) => string; contexto: (p: LojaPodio) => string; onOpen?: (p: LojaPodio) => void
}) => {
  const [first, second, third] = items
  const rest = [second, third].filter(Boolean) as LojaPodio[]
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <Icon className="h-4 w-4 text-gray-400" />
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-gray-400 dark:bg-gray-800 dark:text-gray-500">Top 3</span>
      </div>
      {!first ? (
        <p className="px-4 py-6 text-center text-[12px] text-gray-400">Sem dados no período.</p>
      ) : (
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3 dark:border-amber-500/20 dark:bg-amber-500/[0.07]">
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-[#7a4f00]" style={{ backgroundColor: '#FCB619' }}>
              {iniciais(first.nome)}
            </div>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => onOpen?.(first)} disabled={!onOpen} title="Ver detalhe do vendedor" className="block max-w-full truncate text-left text-[13px] font-bold text-gray-900 enabled:hover:underline disabled:cursor-default dark:text-gray-100">{first.nome}</button>
              {first.postoNome && <p className="truncate text-[10.5px] font-medium text-[#2563eb] dark:text-blue-300">{first.postoNome}</p>}
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{contexto(first)}</p>
            </div>
            <span className="shrink-0 text-[17px] font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmt(first.valor)}</span>
          </div>
          {rest.length > 0 && (
            <div className="mt-1.5 divide-y divide-gray-50 dark:divide-gray-800/60">
              {rest.map((p, i) => (
                <div key={ck(p.empresaCodigo, p.funcionarioCodigo)} className="flex items-center gap-2 px-1.5 py-2">
                  <span className="w-5 shrink-0 text-[11px] font-semibold tabular-nums text-gray-400">{i + 2}º</span>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => onOpen?.(p)} disabled={!onOpen} title="Ver detalhe do vendedor" className="block max-w-full truncate text-left text-[12.5px] text-gray-600 enabled:hover:underline disabled:cursor-default dark:text-gray-300">{p.nome}</button>
                    {p.postoNome && <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">{p.postoNome}</p>}
                  </div>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-gray-700 dark:text-gray-300">{fmt(p.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const Th = ({ children, right }: { children: ReactNode; right?: boolean }) => (
  <th className={cn('whitespace-nowrap px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500', right ? 'text-right' : 'text-left')}>{children}</th>
)

/**
 * Resumo REDE-WIDE dos VENDEDORES da LOJA (conveniência) — espelha o visual do
 * `ProdutividadeDash` da Pista: cartões somados (faturamento/margem/ticket/cupons)
 * + pódios cross-posto (faturamento/cupons/ticket) mostrando o posto por colocado
 * + tabela da equipe. Sem litros/mix (loja não tem). Clique → sub-aba Funcionários
 * do posto do vendedor. Ver [[useLojaRedeWide]].
 */
const ProdutividadeLojaDash = ({ data, escopo, onOpenVendedor }: Props) => {
  const [busca, setBusca] = useState('')
  // Chave dos PÓDIOS: mês atual (filtro) x mês-calendário anterior. Estado local,
  // default "atual" (idêntico ao comportamento de sempre). Só os pódios mudam.
  const [podioPeriodo, setPodioPeriodo] = useState<PodioPeriodo>('atual')
  const { kpis, podios, podiosPrev, rows, rowsPrev, mesAnteriorLabel, projFactor } = data
  const isPrev = podioPeriodo === 'anterior'
  const activePodios = isPrev ? podiosPrev : podios
  // Projeção de fim de mês (projFactor, vindo do hook). Só mostra quando a janela
  // é mês-a-data E já passou ~1/3 do mês (projFactor ≤ 3) — e só nos acumuláveis
  // (faturamento, cupons), nunca em razão (margem, ticket).
  const showProj = projFactor > 1 && projFactor <= 3

  const rowByCod = useMemo(() => new Map(rows.map((r) => [ck(r.empresaCodigo, r.funcionarioCodigo), r])), [rows])
  // Lookup do mês anterior — só pra o contexto dos pódios do mês anterior; a
  // tabela e os KPIs seguem no período do filtro.
  const rowByCodPrev = useMemo(() => new Map(rowsPrev.map((r) => [ck(r.empresaCodigo, r.funcionarioCodigo), r])), [rowsPrev])
  const activeRowByCod = isPrev ? rowByCodPrev : rowByCod
  // Campeão de cada pódio (1º lugar) — ganha troféu na tabela. Chave COMPOSTA.
  const champFat = podios.faturamento[0] ? ck(podios.faturamento[0].empresaCodigo, podios.faturamento[0].funcionarioCodigo) : ''
  const champCupons = podios.cupons[0] ? ck(podios.cupons[0].empresaCodigo, podios.cupons[0].funcionarioCodigo) : ''
  const champTicket = podios.ticket[0] ? ck(podios.ticket[0].empresaCodigo, podios.ticket[0].funcionarioCodigo) : ''

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return q ? rows.filter((r) => r.nome.toLowerCase().includes(q)) : rows
  }, [rows, busca])

  // Contexto do líder de cada pódio (métricas secundárias). Lookup composto, no
  // mesmo período do pódio ativo (atual x anterior).
  const ctxFat = (p: LojaPodio) => { const r = activeRowByCod.get(ck(p.empresaCodigo, p.funcionarioCodigo)); return r ? `ticket ${fmtR(r.ticketMedio)} · ${fmtN(r.cupons)} cupons` : '' }
  const ctxCupons = (p: LojaPodio) => { const r = activeRowByCod.get(ck(p.empresaCodigo, p.funcionarioCodigo)); return r ? `${fmtRi(r.faturamento)} · ticket ${fmtR(r.ticketMedio)}` : '' }
  const ctxTicket = (p: LojaPodio) => { const r = activeRowByCod.get(ck(p.empresaCodigo, p.funcionarioCodigo)); return r ? `${fmtRi(r.faturamento)} · ${fmtN(r.cupons)} cupons` : '' }

  return (
    <div className="space-y-4">
      {/* KPIs (4 cards) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Faturamento" value={fmtR(kpis.faturamento)} Icon={Wallet} tone="green" hint="Faturamento de conveniência somado de todos os vendedores do filtro no período." />
        <KpiCard label="Margem" value={fmtPct(kpis.margemPct)} Icon={Percent} tone="blue" hint="Margem bruta consolidada = (faturamento − custo) ÷ faturamento. Razão dos totais, não média de razões." />
        <KpiCard label="Ticket médio" value={fmtR(kpis.ticketMedio)} Icon={Receipt} tone="green" hint="Faturamento ÷ cupons (razão dos totais)." />
        <KpiCard label="Cupons" value={fmtN(kpis.cupons)} Icon={ShoppingCart} tone="amber" hint="Nº de cupons de conveniência somado no período." />
      </div>

      {/* Pódios (Top 3) — chave mês atual x mês anterior (só os pódios mudam) */}
      <PodioPeriodoSwitch value={podioPeriodo} onChange={setPodioPeriodo} mesAnteriorLabel={mesAnteriorLabel} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <PodiumCard title="Faturamento" Icon={Wallet} items={activePodios.faturamento} fmt={fmtRi} contexto={ctxFat} onOpen={(p) => onOpenVendedor?.(p.funcionarioCodigo, p.empresaCodigo)} />
        <PodiumCard title="Cupons" Icon={ShoppingCart} items={activePodios.cupons} fmt={fmtN} contexto={ctxCupons} onOpen={(p) => onOpenVendedor?.(p.funcionarioCodigo, p.empresaCodigo)} />
        <PodiumCard title="Ticket médio" Icon={Receipt} items={activePodios.ticket} fmt={fmtR} contexto={ctxTicket} onOpen={(p) => onOpenVendedor?.(p.funcionarioCodigo, p.empresaCodigo)} />
      </div>

      {/* Tabela de vendedores */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Vendedores · {escopo ?? 'rede'}</h3>
            <InfoHint text="Vendedores de conveniência da rede toda (filtro), ranqueados por faturamento. O posto de cada pessoa aparece abaixo do nome. Troféu ao lado do nome = 1º lugar da rede: dourado em faturamento, azul em cupons, verde em ticket médio." />
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{rows.length} vendedores</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar vendedor…"
              className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-[12px] text-gray-700 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] dark:border-gray-800 dark:bg-[#0f0f0f] dark:text-gray-200 sm:w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-gray-100 dark:border-gray-800">
              <tr>
                <Th>Vendedor</Th>
                <Th right>Faturamento <InfoHint text="Faturamento de conveniência do vendedor no período." /></Th>
                <Th right>Margem <InfoHint text="Margem bruta = (faturamento − custo) ÷ faturamento." /></Th>
                <Th right>Ticket <InfoHint text="Faturamento ÷ cupons." /></Th>
                <Th right>Cupons <InfoHint text="Nº de cupons de conveniência do vendedor no período." /></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-[13px] text-gray-400">Nenhum vendedor encontrado.</td></tr>
              ) : filtered.map((r) => {
                const key = ck(r.empresaCodigo, r.funcionarioCodigo)
                return (
                  <tr
                    key={key}
                    onClick={() => onOpenVendedor?.(r.funcionarioCodigo, r.empresaCodigo)}
                    title="Ver detalhe do vendedor"
                    className={cn('hover:bg-gray-50/60 dark:hover:bg-gray-800/30', onOpenVendedor && 'cursor-pointer')}
                  >
                    <td className="px-3 py-[11px]">
                      <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium', semCadastro(r.nome) ? 'text-gray-400' : 'text-gray-800 dark:text-gray-200')}>
                        {r.nome}
                        {key === champFat && <span title="1º em faturamento"><Trophy className="h-3.5 w-3.5 text-amber-500" /></span>}
                        {key === champCupons && <span title="1º em cupons"><Trophy className="h-3.5 w-3.5 text-blue-500" /></span>}
                        {key === champTicket && <span title="1º em ticket médio"><Trophy className="h-3.5 w-3.5 text-emerald-500" /></span>}
                      </span>
                      {r.postoNome && <span className="mt-0.5 block truncate text-[10.5px] text-gray-400 dark:text-gray-500">{r.postoNome}</span>}
                    </td>
                    <td className="px-3 py-[11px]">
                      <div className="flex flex-col items-end">
                        <span className="text-[12.5px] font-semibold tabular-nums text-gray-800 dark:text-gray-200">{fmtR(r.faturamento)}</span>
                        {showProj && <ProjTend value={fmtR(r.faturamentoTend)} />}
                      </div>
                    </td>
                    <td className="px-3 py-[11px] text-right text-[12.5px] tabular-nums text-gray-700 dark:text-gray-300">{fmtPct(r.margemPct)}</td>
                    <td className="px-3 py-[11px] text-right text-[12.5px] tabular-nums text-gray-700 dark:text-gray-300">{fmtR(r.ticketMedio)}</td>
                    <td className="px-3 py-[11px]">
                      <div className="flex flex-col items-end">
                        <span className="text-[12.5px] tabular-nums text-gray-700 dark:text-gray-300">{fmtN(r.cupons)}</span>
                        {showProj && <ProjTend value={fmtN(r.cuponsTend)} />}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <NotaLeitura variant="footer" icon={null}>
"proj." = projeção linear de fim de mês de faturamento e cupons, no ritmo atual (só aparece em janela mês-a-data, depois de ~1/3 do mês). Margem e ticket médio são razões e não projetam.
        </NotaLeitura>
      </div>
    </div>
  )
}

export default ProdutividadeLojaDash
