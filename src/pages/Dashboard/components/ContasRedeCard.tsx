import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, AlertTriangle, Clock, CalendarDays, CalendarRange, ArrowRight, Loader2, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import useContasResumo, { type Bucket, type Categoria, type LadoResumo, type Horizonte } from '@/pages/Dashboard/hooks/useContasResumo'
import ContasListaModal, { type ListaSel, type TomLista } from '@/pages/Dashboard/components/modais/ContasListaModal'
import SaldoJanelaModal, { type SaldoSel } from '@/pages/Dashboard/components/modais/SaldoJanelaModal'
import ShareReportButton from '@/components/feedback/ShareReportButton'
import type { ReportPayload, ReportRow } from '@/lib/report/reportTypes'

/**
 * Central → Visão Geral: três cards separados — "Saldo da janela" (o que entra
 * cobre o que sai, por horizonte), "Contas a pagar" e "Contas a receber", cada
 * um com as faixas de vencimento (vencidas / hoje / 7 dias / 8–30 dias) e a
 * quebra por categoria. Mesma base da aba Financeiro; "Ver todas" abre a aba.
 */

const BUCKETS: { id: Bucket; label: string; Icon: typeof Clock; tom: 'red' | 'amber' | 'blue' | 'gray' }[] = [
  { id: 'vencidas', label: 'Vencidas', Icon: AlertTriangle, tom: 'red' },
  { id: 'hoje', label: 'Hoje', Icon: Clock, tom: 'amber' },
  { id: 'd7', label: 'Próximos 7 dias', Icon: CalendarDays, tom: 'blue' },
  { id: 'd30', label: '8 a 30 dias', Icon: CalendarRange, tom: 'gray' },
]
// Vencido: vermelho no a pagar (risco), LARANJA no a receber (é cobrar, não perder).
const TOM = {
  red: { txt: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' },
  orange: { txt: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500' },
  amber: { txt: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },
  blue: { txt: 'text-blue-700 dark:text-blue-400', bar: 'bg-blue-500' },
  gray: { txt: 'text-gray-700 dark:text-gray-300', bar: 'bg-gray-400' },
} as const

const docs = (n: number) => `${n} ${n === 1 ? 'doc.' : 'docs.'}`
const pctFmt = (v: number) => `${v.toFixed(1).replace('.', ',')}%`
const cardCls = 'overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black'

/** Card de um lado (a pagar OU a receber): cabeçalho, 4 faixas de vencimento e a tabela por categoria. */
const LadoCard = ({ lado, titulo, Icon, tom, tab, hint, subtitulo, rodape, onFaixa, onCategoria, carregando }: {
  lado: LadoResumo; titulo: string; Icon: typeof ArrowUpRight; tom: 'rose' | 'emerald'; tab: 'pagar' | 'receber'; hint: string; subtitulo: string
  /** Texto extra do rodapé (ex.: aviso dos cartões). */
  rodape?: string
  /** Clique numa faixa de vencimento / numa categoria → modal com os títulos. */
  onFaixa: (h: Horizonte) => void
  onCategoria: (c: Categoria) => void
  /** Títulos deste lado ainda carregando → não mostra zero como se fosse zero. */
  carregando?: boolean
}) => {
  const total30 = lado.buckets.vencidas.total + lado.buckets.hoje.total + lado.buckets.d7.total + lado.buckets.d30.total
  const count30 = lado.buckets.vencidas.count + lado.buckets.hoje.count + lado.buckets.d7.count + lado.buckets.d30.count
  const maxBucket = Math.max(...BUCKETS.map((b) => lado.buckets[b.id].total), 0)
  const iconCls = tom === 'rose'
    ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300'
    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
  return (
    <section className={cardCls}>
      <header className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3">
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', iconCls)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{titulo} <InfoHint text={hint} /></h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {subtitulo}{carregando ? ' · buscando no ERP…' : <> · janela de 30 dias · total <b className="text-gray-700 dark:text-gray-300">{formatCurrencyInt(total30)}</b> em {docs(count30)}</>}
            {!carregando && lado.depois30.total > 0 && <> · <button type="button" onClick={() => onFaixa('depois')} className="underline decoration-dotted underline-offset-2 hover:text-[#1e3a5f] dark:hover:text-blue-300" title="Ver os títulos que vencem depois de 30 dias">depois de 30 dias: {formatCurrencyInt(lado.depois30.total)}</button></>}
          </p>
        </div>
        <Link to={`/financeiro?tab=${tab}`} className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-[#1e3a5f] hover:underline dark:text-blue-300">Ver todas <ArrowRight className="h-3.5 w-3.5" /></Link>
      </header>
      {carregando && (
        <p className="inline-flex items-center gap-2 border-t border-gray-100 px-5 py-4 text-[12px] text-gray-500 dark:border-gray-800 dark:text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Buscando os títulos no ERP… os números aparecem assim que terminar.</p>
      )}
      {!carregando && (<>

      {/* Faixas de vencimento */}
      <div className="grid grid-cols-2 divide-gray-100 border-y border-gray-100 md:grid-cols-4 md:divide-x dark:divide-gray-800 dark:border-gray-800">
        {BUCKETS.map((b) => {
          const v = lado.buckets[b.id]
          const tomEfetivo = b.id === 'vencidas' && tab === 'receber' ? 'orange' : b.tom
          const t = TOM[tomEfetivo]
          const share = total30 > 0 ? (v.total / total30) * 100 : 0
          return (
            <button type="button" key={b.id} onClick={() => onFaixa(b.id)} title="Ver os títulos desta faixa" className="px-5 py-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1e3a5f] dark:hover:bg-white/5">
              <p className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5"><b.Icon className={cn('h-3.5 w-3.5', t.txt)} /> {b.label}</span>
                {total30 > 0 && <span className="tabular-nums text-gray-400">{Math.round(share)}%</span>}
              </p>
              <p className={cn('mt-1 text-[20px] font-extrabold tabular-nums leading-tight', v.total > 0 && b.id === 'vencidas' ? t.txt : 'text-gray-900 dark:text-gray-100')}>{formatCurrencyInt(v.total)}</p>
              <p className="flex items-center gap-2 text-[11px] text-gray-400">
                <span className="shrink-0">{docs(v.count)}</span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <span className={cn('block h-full rounded-full', t.bar)} style={{ width: `${maxBucket > 0 ? Math.max(v.total > 0 ? 3 : 0, (v.total / maxBucket) * 100) : 0}%` }} />
                </span>
              </p>
            </button>
          )
        })}
      </div>

      {/* Por categoria */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="text-[10px] uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-5 py-2 text-left font-semibold">Categoria</th>
              <th className="px-3 py-2 text-right font-semibold">Vencidas</th>
              <th className="px-3 py-2 text-right font-semibold">Hoje</th>
              <th className="px-3 py-2 text-right font-semibold">A vencer (30d)</th>
              <th className="px-5 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {lado.categorias.filter((c) => c.total > 0).map((c: Categoria) => (
              <tr key={c.id} className="cursor-pointer text-gray-800 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5" onClick={() => onCategoria(c)} title="Ver os títulos desta categoria">
                <td className="px-5 py-2">
                  <span className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', c.dot)} />
                    <span className="font-medium">{c.label}</span>
                    <span className="text-[10px] text-gray-400">{pctFmt(total30 > 0 ? (c.total / total30) * 100 : 0)} do total</span>
                  </span>
                </td>
                <td className={cn('px-3 py-2 text-right tabular-nums', c.vencidas > 0 ? cn('font-semibold', tab === 'receber' ? TOM.orange.txt : TOM.red.txt) : 'text-gray-400')}>{c.vencidas > 0 ? formatCurrencyInt(c.vencidas) : '—'}</td>
                <td className={cn('px-3 py-2 text-right tabular-nums', c.hoje > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-400')}>{c.hoje > 0 ? formatCurrencyInt(c.hoje) : '—'}</td>
                <td className={cn('px-3 py-2 text-right tabular-nums', c.aVencer > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400')}>{c.aVencer > 0 ? formatCurrencyInt(c.aVencer) : '—'}</td>
                <td className="px-5 py-2 text-right font-semibold tabular-nums">{formatCurrencyInt(c.total)} <span className="ml-1 text-[10px] font-normal text-gray-400">{docs(c.count)}</span></td>
              </tr>
            ))}
            {lado.categorias.every((c) => c.total === 0) && (
              <tr><td colSpan={5} className="px-5 py-4 text-center text-[11px] text-gray-400">Nada em aberto nesta janela.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </>)}
      <p className="border-t border-gray-100 px-5 py-2 text-[10px] text-gray-400 dark:border-gray-800 dark:text-gray-500">
        {tab === 'receber' ? 'Laranja = vencido a cobrar (não é perda). ' : ''}Vencidas = antes de hoje · Hoje = vence hoje · Próximos 7 = amanhã a 7 dias · 8 a 30 = o resto da janela.{tab === 'receber' ? '' : ' Saldo = valor + acréscimo − desconto − pago.'} Fonte: pendentes no ERP, atualizados ao abrir a tela.{rodape ? ` ${rodape}` : ''}
      </p>
    </section>
  )
}

const FAIXA_LABEL: Record<Horizonte, string> = { vencidas: 'Vencidas', hoje: 'Vencem hoje', d7: 'Próximos 7 dias', d30: '8 a 30 dias', depois: 'Depois de 30 dias' }
const FAIXA_DESC: Record<Horizonte, string> = {
  vencidas: 'Venceram antes de hoje e seguem em aberto',
  hoje: 'Vencem hoje',
  d7: 'Vencem de amanhã a 7 dias',
  d30: 'Vencem de 8 a 30 dias',
  depois: 'Vencem depois de 30 dias',
}
const SALDO_HORIZ: Record<string, Horizonte[]> = {
  vencido: ['vencidas'],
  hoje: ['hoje'],
  d7: ['hoje', 'd7'],
  d30: ['hoje', 'd7', 'd30'],
  tudo: ['vencidas', 'hoje', 'd7', 'd30', 'depois'],
}

const ContasRedeCard = () => {
  const r = useContasResumo()
  const [lista, setLista] = useState<ListaSel | null>(null)
  const [saldoSel, setSaldoSel] = useState<SaldoSel | null>(null)

  const tituloLado = (lado: 'pagar' | 'receber') => (lado === 'pagar' ? 'Contas a pagar' : 'Contas a receber')
  const abrirFaixa = (lado: 'pagar' | 'receber', h: Horizonte) => {
    const tom: TomLista = h === 'vencidas' ? (lado === 'receber' ? 'orange' : 'red') : h === 'hoje' ? 'amber' : h === 'd7' ? 'blue' : 'gray'
    setLista({ titulo: tituloLado(lado), subtitulo: FAIXA_DESC[h], selo: FAIXA_LABEL[h], tom, lado, itens: r.itens[lado].filter((i) => i.horizonte === h), filtro: { faixas: [h] } })
  }
  const abrirCategoria = (lado: 'pagar' | 'receber', c: Categoria) => {
    setLista({ titulo: tituloLado(lado), subtitulo: 'Janela de 30 dias: vencidas, hoje e até 30 dias', selo: c.label, tom: lado === 'pagar' ? 'rose' : 'emerald', lado, itens: r.itens[lado].filter((i) => i.cat === c.id && i.horizonte !== 'depois'), filtro: { faixas: ['vencidas', 'hoje', 'd7', 'd30'], cat: c.id } })
  }
  const abrirSaldo = (s: { id: string; label: string; hint: string }) => {
    const hs = SALDO_HORIZ[s.id] ?? []
    setSaldoSel({ label: s.label, hint: s.hint, entra: r.itens.receber.filter((i) => hs.includes(i.horizonte)), sai: r.itens.pagar.filter((i) => hs.includes(i.horizonte)) })
  }
  const verListaDoSaldo = (lado: 'receber' | 'pagar') => {
    if (!saldoSel) return
    const itens = lado === 'receber' ? saldoSel.entra : saldoSel.sai
    const faixas = [...new Set(itens.map((i) => i.horizonte))]
    setSaldoSel(null)
    setLista({ titulo: tituloLado(lado), subtitulo: `Saldo da janela · ${saldoSel.label}`, selo: saldoSel.label, tom: lado === 'pagar' ? 'rose' : 'emerald', lado, itens, filtro: { faixas } })
  }

  if (r.isLoading) {
    return (
      <section className="flex h-28 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </section>
    )
  }
  if (!r.temDados) return null

  const saldos = [
    { id: 'vencido', label: 'Vencido', entra: r.receber.buckets.vencidas.total, sai: r.pagar.buckets.vencidas.total, hint: 'Clientes e cartões em atraso contra contas que já venceram. Positivo: cobrar o atrasado paga o que está atrasado.' },
    { id: 'hoje', label: 'Hoje', entra: r.receber.buckets.hoje.total, sai: r.pagar.buckets.hoje.total, hint: 'O que vence hoje dos dois lados.' },
    { id: 'd7', label: '7 dias', entra: r.receber.buckets.hoje.total + r.receber.buckets.d7.total, sai: r.pagar.buckets.hoje.total + r.pagar.buckets.d7.total, hint: 'De hoje a 7 dias: entradas previstas menos saídas previstas.' },
    { id: 'd30', label: '30 dias', entra: r.receber.buckets.hoje.total + r.receber.buckets.d7.total + r.receber.buckets.d30.total, sai: r.pagar.buckets.hoje.total + r.pagar.buckets.d7.total + r.pagar.buckets.d30.total, hint: 'De hoje a 30 dias: entradas previstas menos saídas previstas. Não inclui o que já está vencido.' },
    { id: 'tudo', label: 'Tudo em aberto', entra: r.receber.tudo.total, sai: r.pagar.tudo.total, hint: 'Posição líquida total: tudo a receber (clientes e cartões líquidos) menos tudo a pagar, sem janela, incluindo vencidos e o que vence depois de 30 dias.' },
  ]
  // PDF determinístico com os três cards (WhatsApp / download).
  const buildReport = (): ReportPayload => {
    const faixas = (l: LadoResumo): ReportRow[] => [
      ...BUCKETS.map((b) => ({ label: b.label, value: formatCurrencyInt(l.buckets[b.id].total), sub: docs(l.buckets[b.id].count) })),
      { label: 'Depois de 30 dias', value: formatCurrencyInt(l.depois30.total), sub: docs(l.depois30.count) },
      { label: 'Tudo em aberto', value: formatCurrencyInt(l.tudo.total), sub: docs(l.tudo.count), strong: true },
    ]
    const cats = (l: LadoResumo): ReportRow[] => l.categorias.filter((c) => c.total > 0).map((c) => ({
      label: c.label, value: formatCurrencyInt(c.total),
      sub: `vencidas ${formatCurrencyInt(c.vencidas)} · hoje ${formatCurrencyInt(c.hoje)} · a vencer ${formatCurrencyInt(c.aVencer)} · ${docs(c.count)}`,
    }))
    const postos = new Set([...r.itens.receber, ...r.itens.pagar].map((i) => i.empresaCodigo)).size
    const saldoTudo = r.receber.tudo.total - r.pagar.tudo.total
    const hojeBr = new Date().toLocaleDateString('pt-BR')
    return {
      title: 'Contas a pagar e a receber',
      subtitle: `Posição em ${hojeBr} · ${postos} ${postos === 1 ? 'posto' : 'postos'}`,
      kpis: [
        { label: 'A receber · tudo em aberto', value: formatCurrencyInt(r.receber.tudo.total), tone: 'pos' },
        { label: 'A pagar · tudo em aberto', value: formatCurrencyInt(r.pagar.tudo.total), tone: 'neg' },
        { label: 'Saldo', value: `${saldoTudo >= 0 ? '+' : '−'}${formatCurrencyInt(Math.abs(saldoTudo))}`, tone: saldoTudo >= 0 ? 'pos' : 'neg' },
        { label: 'Vencido a receber', value: formatCurrencyInt(r.receber.buckets.vencidas.total), tone: 'neutral' },
        { label: 'Vencido a pagar', value: formatCurrencyInt(r.pagar.buckets.vencidas.total), tone: 'neg' },
      ],
      sections: [
        { title: 'Saldo da janela', rows: saldos.map((s) => { const v = s.entra - s.sai; return { label: s.label, value: `${v >= 0 ? '+' : '−'}${formatCurrencyInt(Math.abs(v))}`, sub: `entra ${formatCurrencyInt(s.entra)} · sai ${formatCurrencyInt(s.sai)}` } }), note: 'A receber menos a pagar, por horizonte de vencimento.' },
        { title: 'Contas a pagar · faixas de vencimento', rows: faixas(r.pagar), note: 'Saldo = valor + acréscimo − desconto − pago.' },
        { title: 'Contas a pagar · por categoria (30 dias)', rows: cats(r.pagar) },
        { title: 'Contas a receber · faixas de vencimento', rows: faixas(r.receber), note: 'Clientes mais cartões e apps pelo líquido estimado de taxa.' },
        { title: 'Contas a receber · por categoria (30 dias)', rows: cats(r.receber) },
      ],
      footnote: 'Visor360 · pendentes no ERP no momento da geração · somente leitura.',
    }
  }
  const taxaCartoes = r.cartoes.bruto - r.cartoes.liquido
  const avisoCartoes = r.cartoes.bruto > 0
    ? `Cartões e apps pelo líquido estimado: bruto ${formatCurrencyInt(r.cartoes.bruto)} menos taxa ${formatCurrencyInt(taxaCartoes)}.${r.cartoes.vencidoLiquido > 0 ? ` Os ${formatCurrencyInt(r.cartoes.vencidoLiquido)} de cartões vencidos provavelmente já caíram na conta; falta só a baixa no sistema.` : ''}`
    : undefined

  return (
    <>
      {/* Saldo da janela — o que entra cobre o que sai, por horizonte. */}
      <section className={cardCls}>
        <header className="flex items-center gap-3 px-5 pt-4 pb-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/[0.07] text-[#1e3a5f] dark:bg-white/10 dark:text-blue-300">
            <Scale className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Saldo da janela
              <InfoHint text="A receber menos a pagar, por horizonte, pela data de vencimento dos títulos em aberto. A receber inclui clientes e cartões/apps líquidos de taxa; a pagar inclui títulos abertos e parciais pelo saldo. Mesma base da aba Financeiro." />
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {r.carregando.receber || r.carregando.pagar
                ? `Ainda buscando ${r.carregando.receber && r.carregando.pagar ? 'os dois lados' : r.carregando.receber ? 'o a receber' : 'o a pagar'} no ERP; o saldo fecha quando terminar.`
                : 'O que entra cobre o que sai?'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ShareReportButton filename="contas-a-pagar-e-receber.pdf" build={buildReport} />
          </div>
        </header>
        <div className="grid grid-cols-2 gap-px border-t border-gray-100 bg-gray-100 md:grid-cols-5 dark:border-gray-800 dark:bg-gray-800">
          {saldos.map((s) => {
            const saldo = s.entra - s.sai
            const ok = saldo >= 0
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                title="Ver entra × sai por categoria"
                onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; abrirSaldo(s) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirSaldo(s) } }}
                className={cn('cursor-pointer bg-white px-5 py-3 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1e3a5f] dark:bg-[#0b0b0b] dark:hover:bg-white/5', s.id === 'tudo' && 'bg-gray-50 dark:bg-white/[0.03]')}
              >
                <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label} <InfoHint text={s.hint} /></p>
                <p className={cn('mt-0.5 text-[18px] font-extrabold tabular-nums leading-tight', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{ok ? '+' : '−'}{formatCurrencyInt(Math.abs(saldo))}</p>
                <p className="text-[11px] tabular-nums text-gray-400">entra {formatCurrencyInt(s.entra)} · sai {formatCurrencyInt(s.sai)}</p>
              </div>
            )
          })}
        </div>
      </section>

      <LadoCard carregando={r.carregando.pagar} onFaixa={(h) => abrirFaixa('pagar', h)} onCategoria={(c) => abrirCategoria('pagar', c)} lado={r.pagar} titulo="Contas a pagar" subtitulo="Títulos em aberto pelo saldo" Icon={ArrowUpRight} tom="rose" tab="pagar" hint="Títulos a pagar em aberto (abertos e parciais) pelo saldo que falta pagar, agrupados pela data de vencimento. Categoria pelo tipo de lançamento do título." />
      <LadoCard carregando={r.carregando.receber} onFaixa={(h) => abrirFaixa('receber', h)} onCategoria={(c) => abrirCategoria('receber', c)} lado={r.receber} titulo="Contas a receber" subtitulo="Clientes e cartões a compensar" Icon={ArrowDownLeft} tom="emerald" tab="receber" rodape={avisoCartoes} hint="Clientes (notas a prazo, faturas, outros) pelo valor em aberto, mais cartões e apps a compensar pela administradora, já descontada a taxa. Cartões em atraso são repasses que a administradora ainda não fez." />

      <ContasListaModal sel={lista} onClose={() => setLista(null)} />
      <SaldoJanelaModal sel={saldoSel} onClose={() => setSaldoSel(null)} onVerLista={verListaDoSaldo} />
    </>
  )
}

export default ContasRedeCard
