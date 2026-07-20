import { useMemo, useState } from 'react'
import { Radar, ArrowRight, LayoutGrid, List, ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import useComercialData from '@/pages/Comercial/hooks/useComercialData'
import {
  classificar, acaoDe, SITUACAO_META, ACAO_META, TONE_CLASSES,
  type Situacao, type Acao,
} from '@/lib/radarClassificacao'

const moneyL = (v: number) => `R$ ${v.toFixed(3).replace('.', ',')}`
const pct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`
const litros = (v: number) => `${Math.round(v).toLocaleString('pt-BR')} L`

// ── Frescor do custo de reposição (LMC) ──────────────────────────────────────
// TODA a leitura do Radar (margem, folga, "pode ceder") depende do custo. Se o
// custo é velho (o posto não lançou nota nova), a margem aparece mais gorda do
// que é — e o dono pode cortar preço vendendo quase no custo. O DIA é fato; a
// cor é só um alerta. Custo velho NUNCA deve ler como "seguro pra cortar".
const FRESCOR_OK = 3   // ≤3 dias → verde
const FRESCOR_WARN = 10 // 4–10 dias → amarelo · >10 → vermelho
type Frescor = 'ok' | 'warn' | 'old' | 'unknown'
const frescorDe = (dias: number | null): Frescor =>
  dias == null ? 'unknown' : dias <= FRESCOR_OK ? 'ok' : dias <= FRESCOR_WARN ? 'warn' : 'old'
const custoIdadeLabel = (dias: number | null): string =>
  dias == null ? 'custo sem data'
    : dias <= 0 ? 'custo de hoje'
      : dias === 1 ? 'custo de ontem'
        : `custo de ${dias} dias atrás`
const FRESCOR_CLASSES: Record<Frescor, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  old: 'text-red-600 dark:text-red-400',
  unknown: 'text-gray-400 dark:text-gray-500',
}

/** Selo de frescor do custo — o dado que sustenta (ou desmente) a margem. */
const CustoFrescor = ({ dias, className }: { dias: number | null; className?: string }) => {
  const f = frescorDe(dias)
  const Icon = f === 'ok' ? CheckCircle2 : AlertTriangle
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium', FRESCOR_CLASSES[f], className)}>
      <Icon className="h-3 w-3 shrink-0" />{custoIdadeLabel(dias)}
    </span>
  )
}

interface RadarItem {
  postoCodigo: number
  posto: string
  fuel: string
  precoMedio: number
  custo: number
  folgaL: number
  margemPct: number
  volumeDia: number
  situacao: Situacao
  /** Dias desde o último custo de reposição lançado (LMC). null = sem data. */
  custoStaleDays: number | null
}

const ACOES: Acao[] = ['cuidado', 'atencao', 'oportunidade']

/** Frase explicativa da linha do Resumo (por situação, com os números). */
const explicar = (it: RadarItem): string => {
  if (it.situacao === 'piso') return `Margem ${pct(it.margemPct)} encosta no piso ${moneyL(it.custo)}. Cortar aqui vende no prejuízo.`
  if (it.situacao === 'apertada') return `Margem ${pct(it.margemPct)} apertada — só corte se trouxer volume (folga de só ${moneyL(it.folgaL)}/L).`
  return `Folga de ${moneyL(it.folgaL)}/L sobre o custo — dá pra ceder se a concorrência apertar.`
}

/** Ressalva vermelha quando a leitura de "pode ceder" se apoia em custo velho —
 *  o caso em que o dono corta preço confiando num custo que pode ter subido. */
const ressalvaCusto = (it: RadarItem): string | null =>
  acaoDe(it.situacao) === 'oportunidade' && frescorDe(it.custoStaleDays) === 'old'
    ? `O custo é de ${it.custoStaleDays} dias atrás. Confirme o custo real antes de cortar — se subiu, essa folga pode não existir.`
    : null

/** Select estilizado dos filtros (aba Todos os cards). */
const Sel = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
  <div className="relative">
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-[12px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200 dark:hover:bg-gray-800">
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
  </div>
)

const AnalisarBtn = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 transition-colors hover:border-[#2563eb] hover:text-[#2563eb] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
  >
    Analisar <ArrowRight className="h-3.5 w-3.5" />
  </button>
)

/** Mini-KPI dentro do card (aba Todos os cards). */
const StatMini = ({ label, value, foot, tone }: { label: string; value: string; foot?: string; tone?: string }) => (
  <div className="rounded-lg bg-gray-50/70 px-2.5 py-2 dark:bg-gray-800/40">
    <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
    <p className={cn('text-[15px] font-bold tabular-nums text-gray-900 dark:text-gray-100', tone)}>{value}</p>
    {foot && <p className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">{foot}</p>}
  </div>
)

interface RadarVisaoGeralProps {
  /** Abre a análise (drill) pré-filtrada no posto+combustível clicado. */
  onAnalisar: (postoCodigo: number, fuel: string) => void
}

const RadarVisaoGeral = ({ onAnalisar }: RadarVisaoGeralProps) => {
  const data = useComercialData()
  const [view, setView] = useState<'resumo' | 'cards'>('resumo')
  const [fPosto, setFPosto] = useState<number | 'todos'>('todos')
  const [fFuel, setFFuel] = useState<string>('todos')
  const [fSit, setFSit] = useState<Situacao | 'todas'>('todas')

  const itens = useMemo<RadarItem[]>(() => {
    const out: RadarItem[] = []
    for (const p of data.postos) {
      for (const f of p.produtos) {
        if (!f.comCusto || f.litros <= 0) continue
        const margemPct = f.faturamento > 0 ? (f.lucroBruto / f.faturamento) * 100 : 0
        out.push({
          postoCodigo: p.empresaCodigo,
          posto: p.posto,
          fuel: f.nome,
          precoMedio: f.precoVenda,
          custo: f.precoCusto,
          folgaL: f.margemL,
          margemPct,
          volumeDia: p.diasOperados > 0 ? f.litros / p.diasOperados : f.litros,
          situacao: classificar(margemPct),
          custoStaleDays: p.custoStaleDays,
        })
      }
    }
    return out
  }, [data.postos])

  // Piso de referência por combustível (custo médio ponderado por volume da rede).
  const pisoPorFuel = useMemo(() => {
    const acc = new Map<string, { cad: number; vol: number }>()
    for (const p of data.postos) {
      for (const f of p.produtos) {
        if (!f.comCusto || f.litros <= 0) continue
        const e = acc.get(f.nome) ?? { cad: 0, vol: 0 }
        e.cad += f.precoCusto * f.litros; e.vol += f.litros
        acc.set(f.nome, e)
      }
    }
    const m = new Map<string, number>()
    for (const [nome, e] of acc) m.set(nome, e.vol > 0 ? e.cad / e.vol : 0)
    return m
  }, [data.postos])

  const postos = useMemo(() => {
    const seen = new Map<number, string>()
    for (const it of itens) if (!seen.has(it.postoCodigo)) seen.set(it.postoCodigo, it.posto)
    return [...seen.entries()].map(([codigo, nome]) => ({ codigo, nome }))
  }, [itens])
  const fuels = useMemo(() => {
    const set = new Set(itens.map((i) => i.fuel))
    return [...set]
  }, [itens])

  const kpiPiso = itens.filter((i) => i.situacao === 'piso').length
  const kpiFolga = itens.filter((i) => i.situacao === 'folga').length
  // Quantos combustíveis apoiam a leitura num custo defasado (>FRESCOR_WARN dias).
  const custoVelhoCount = itens.filter((i) => frescorDe(i.custoStaleDays) === 'old').length

  // Filtros compartilhados pelos dois modos (Resumo e Todos os cards).
  const itensFiltrados = useMemo(() => itens.filter((i) =>
    (fPosto === 'todos' || i.postoCodigo === fPosto) &&
    (fFuel === 'todos' || i.fuel === fFuel) &&
    (fSit === 'todas' || i.situacao === fSit),
  ), [itens, fPosto, fFuel, fSit])

  if (data.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }
  if (!data.hasRede || itens.length === 0) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">Sem dados de combustível no período pra montar o radar.</div>
  }

  const ChipKpi = ({ label, value, tone }: { label: string; value: number; tone?: 'red' | 'green' }) => (
    <div className={cn(
      'rounded-xl border px-3 py-2 text-center',
      tone === 'red' ? 'border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/15'
        : tone === 'green' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/15'
          : 'border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/40',
    )}>
      <p className={cn('text-[9px] font-semibold uppercase tracking-wider', tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400')}>{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', tone === 'red' ? 'text-red-700 dark:text-red-300' : tone === 'green' ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-800 dark:text-gray-100')}>{value}<span className="text-[10px] font-medium text-gray-400"> {label === 'POSTOS' ? '' : 'cards'}</span></p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] text-white shadow-sm shadow-blue-500/20">
            <Radar className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Radar de Preços · Visão Geral</h3>
            <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">Cada posto, cada combustível — o que fazer no preço, num olhar.<br />Clique em <span className="font-medium">Analisar</span> pra abrir o posto direto.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-stretch gap-2">
          <ChipKpi label="POSTOS" value={postos.length} />
          <ChipKpi label="PERTO DO PISO" value={kpiPiso} tone="red" />
          <ChipKpi label="COM FOLGA" value={kpiFolga} tone="green" />
        </div>
      </div>

      {/* Aviso de integridade — as situações são referência; o custo manda. Sem
          selo de "sem erro": o dado velho é sinalizado, não escondido. */}
      <div className={cn(
        'flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[11px] leading-snug',
        custoVelhoCount > 0
          ? 'border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'
          : 'border-gray-200 bg-gray-50/70 text-gray-500 dark:border-gray-700 dark:bg-gray-800/30 dark:text-gray-400',
      )}>
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          As situações (No limite / Folga) são <span className="font-semibold">referência pela margem, não regra</span> — quem manda é o <span className="font-semibold">custo</span>.
          {custoVelhoCount > 0
            ? ` ${custoVelhoCount} ${custoVelhoCount === 1 ? 'combustível está' : 'combustíveis estão'} com custo de mais de ${FRESCOR_WARN} dias — confirme antes de mexer no preço.`
            : ' Confira o frescor do custo em cada card antes de mexer no preço.'}
        </span>
      </div>

      {/* Toggle de visão */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
        {([['resumo', 'Resumo', List], ['cards', 'Todos os cards', LayoutGrid]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setView(id)}
            className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors',
              view === id ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200')}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Filtros — compartilhados pelos dois modos. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Filtrar</span>
        <Sel value={String(fPosto)} onChange={(v) => setFPosto(v === 'todos' ? 'todos' : Number(v))}>
          <option value="todos">Todos os postos</option>
          {postos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
        </Sel>
        <Sel value={fFuel} onChange={setFFuel}>
          <option value="todos">Todos os combustíveis</option>
          {fuels.map((f) => <option key={f} value={f}>{f}</option>)}
        </Sel>
        <Sel value={fSit} onChange={(v) => setFSit(v as Situacao | 'todas')}>
          <option value="todas">Todas as situações</option>
          <option value="piso">No limite</option>
          <option value="apertada">Aperto</option>
          <option value="saudavel">Estável</option>
          <option value="folga">Folga</option>
        </Sel>
        <span className="text-[11px] text-gray-400">{itensFiltrados.length} {itensFiltrados.length === 1 ? 'item' : 'itens'}</span>
      </div>

      {/* ── RESUMO — agrupado por ação ── */}
      {view === 'resumo' && (
        <div className="space-y-5">
          {ACOES.map((acao) => {
            const meta = ACAO_META[acao]
            const lista = itensFiltrados.filter((i) => acaoDe(i.situacao) === acao)
            if (lista.length === 0) return null
            const tc = TONE_CLASSES[meta.tone]
            return (
              <div key={acao}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', tc.dot)} />
                  <h4 className={cn('text-sm font-bold', tc.text)}>{meta.titulo}</h4>
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-300">{lista.length}</span>
                  <span className="text-[11px] text-gray-400">{meta.sub}</span>
                </div>
                <div className="space-y-3">
                  {/* Subgrupo por combustível, do MELHOR pro pior (maior margem 1º). */}
                  {[...new Set(lista.map((i) => i.fuel))]
                    .map((fuel) => {
                      const rowsF = [...lista].filter((i) => i.fuel === fuel).sort((a, b) => b.margemPct - a.margemPct)
                      const media = rowsF.reduce((s, i) => s + i.margemPct, 0) / rowsF.length
                      return { fuel, rowsF, media }
                    })
                    .sort((a, b) => b.media - a.media)
                    .map(({ fuel, rowsF }) => {
                      return (
                      <div key={fuel}>
                        <p className="mb-1.5 flex items-center gap-1.5 pl-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {fuel}
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-300">{rowsF.length}</span>
                        </p>
                        <div className="space-y-2">
                          {rowsF.map((it) => {
                            const sm = SITUACAO_META[it.situacao]
                            const stc = TONE_CLASSES[sm.tone]
                            const rc = ressalvaCusto(it)
                            return (
                              <div key={`${it.postoCodigo}:${it.fuel}`} className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-gray-200 bg-white px-4 py-3 pl-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                <span className={cn('absolute inset-y-0 left-0 w-[3px]', stc.dot)} />
                                <div className="w-40 shrink-0">
                                  <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{it.posto}</p>
                                  <CustoFrescor dias={it.custoStaleDays} className="mt-0.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={cn('text-[13px] font-bold', stc.text)}>{sm.titulo}</p>
                                  <p className="text-[12px] leading-snug text-gray-500 dark:text-gray-400">{explicar(it)}</p>
                                  {rc && (
                                    <p className="mt-1 inline-flex items-start gap-1 text-[11px] font-semibold leading-snug text-red-600 dark:text-red-400">
                                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{rc}
                                    </p>
                                  )}
                                </div>
                                <div className="hidden w-16 shrink-0 text-right sm:block">
                                  <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Margem</p>
                                  <p className={cn('text-[13px] font-bold tabular-nums', stc.text)}>{pct(it.margemPct)}</p>
                                </div>
                                <div className="hidden w-20 shrink-0 text-right sm:block">
                                  <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Folga/L</p>
                                  <p className="text-[13px] font-bold tabular-nums text-gray-700 dark:text-gray-200">{moneyL(it.folgaL)}</p>
                                </div>
                                <AnalisarBtn onClick={() => onAnalisar(it.postoCodigo, it.fuel)} />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TODOS OS CARDS — agrupado por combustível, com filtros ── */}
      {view === 'cards' && (() => {
        const porFuel = fuels
          .filter((nome) => fFuel === 'todos' || nome === fFuel)
          .map((nome) => ({ nome, cards: itensFiltrados.filter((i) => i.fuel === nome).sort((a, b) => b.margemPct - a.margemPct) }))
          .filter((g) => g.cards.length > 0)
        return (
          <div className="space-y-5">
            {porFuel.map((g) => (
              <div key={g.nome}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#2563eb]" />
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{g.nome}</h4>
                  <span className="text-[11px] text-gray-400">piso {moneyL(pisoPorFuel.get(g.nome) ?? 0)}/L</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {g.cards.map((it) => {
                    const sm = SITUACAO_META[it.situacao]
                    const stc = TONE_CLASSES[sm.tone]
                    const rc = ressalvaCusto(it)
                    return (
                      <div key={`${it.postoCodigo}:${it.fuel}`} className="relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                        <span className={cn('absolute inset-x-0 top-0 h-[3px]', stc.dot)} />
                        <div className="flex flex-col gap-2 p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{it.posto}</p>
                            <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold', stc.pill)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full', stc.dot)} />{sm.pill}
                            </span>
                          </div>
                          <p className={cn('text-[12px] font-semibold leading-snug', stc.text)}>{sm.frase}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <StatMini label="Preço médio" value={moneyL(it.precoMedio)} />
                            <StatMini label="Margem" value={pct(it.margemPct)} foot={`L.B. ${moneyL(it.folgaL)}/L`} tone={stc.text} />
                            <StatMini label="Custo (piso)" value={moneyL(it.custo)} foot={`folga ${moneyL(it.folgaL)}/L`} />
                            <StatMini label="Volume/dia" value={litros(it.volumeDia)} />
                          </div>
                          <CustoFrescor dias={it.custoStaleDays} />
                          {rc && (
                            <p className="inline-flex items-start gap-1 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] font-semibold leading-snug text-red-700 dark:bg-red-950/30 dark:text-red-300">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{rc}
                            </p>
                          )}
                        </div>
                        <button type="button" onClick={() => onAnalisar(it.postoCodigo, it.fuel)}
                          className="mt-auto border-t border-gray-100 py-2 text-center text-[12px] font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-[#2563eb] dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-blue-300">
                          Analisar →
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

export default RadarVisaoGeral
