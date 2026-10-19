import { useMemo, useState } from 'react'
import { Radar, ArrowRight, ChevronDown, AlertTriangle, CheckCircle2, TrendingUp, Hand, ArrowDownRight, ShoppingBag, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import InfoHint from '@/components/ui/InfoHint'
import useReguaPreco, { milShort, moneyL, FRESCOR_OK, FRESCOR_WARN, type CardPreco, type Veredito, type Frescor } from '@/pages/Comercial/hooks/useReguaPreco'

/**
 * Radar de Preços · Visão Geral — a régua de preço, no estilo lista: cada posto
 * e combustível com UM veredito (Subir / Segurar / Pode ceder / Confirmar o
 * custo), o número da ação, a conta por trás e o botão Analisar. Substitui as
 * duas leituras antigas (Oportunidades e Radar), que podiam discordar.
 */

const pct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`
const custoIdadeLabel = (dias: number | null) => (dias == null ? 'custo sem data' : dias <= 0 ? 'custo de hoje' : dias === 1 ? 'custo de ontem' : `custo de ${dias} dias atrás`)
const FRESCOR_CLS: Record<Frescor, string> = { ok: 'text-emerald-600 dark:text-emerald-400', warn: 'text-amber-600 dark:text-amber-400', old: 'text-red-600 dark:text-red-400', unknown: 'text-gray-400 dark:text-gray-500' }
const CustoFrescor = ({ c }: { c: CardPreco }) => {
  const Icon = c.frescor === 'ok' ? CheckCircle2 : AlertTriangle
  return <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium', FRESCOR_CLS[c.frescor])}><Icon className="h-3 w-3 shrink-0" />{custoIdadeLabel(c.custoStaleDays)}</span>
}

const GRUPOS: { id: Veredito; titulo: string; sub: string; Icon: typeof TrendingUp; tone: 'emerald' | 'red' | 'blue' | 'amber' }[] = [
  { id: 'subir', titulo: 'Subir o preço', sub: 'abaixo da referência: dinheiro deixado na bomba', Icon: TrendingUp, tone: 'emerald' },
  { id: 'segurar', titulo: 'Segurar', sub: 'na referência ou perto do piso: não corte', Icon: Hand, tone: 'red' },
  { id: 'ceder', titulo: 'Pode ceder', sub: 'acima da referência com margem saudável: munição se a rua apertar', Icon: ArrowDownRight, tone: 'blue' },
  { id: 'confirmar', titulo: 'Confirmar o custo', sub: 'daria para ceder, mas o custo é velho ou sem data', Icon: HelpCircle, tone: 'amber' },
]
const TONE = {
  emerald: { text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' },
  red: { text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500', pill: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' },
  blue: { text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' },
  amber: { text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
  gray: { text: 'text-gray-700 dark:text-gray-200', dot: 'bg-gray-400', pill: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
} as const

const Sel = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
  <div className="relative">
    <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-[12px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800">{children}</select>
    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
  </div>
)

const Chip = ({ label, value, sub, tone, hint }: { label: string; value: string | number; sub?: string; tone?: keyof typeof TONE; hint?: string }) => (
  <div className={cn('rounded-xl border px-3 py-2 text-center', tone ? 'border-gray-200 dark:border-gray-700' : 'border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/40')}>
    <p className={cn('flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-wider', tone ? TONE[tone].text : 'text-gray-400')}>{label}{hint && <InfoHint text={hint} />}</p>
    <p className={cn('text-lg font-bold tabular-nums leading-tight', tone ? TONE[tone].text : 'text-gray-800 dark:text-gray-100')}>{value}</p>
    {sub && <p className="text-[10px] tabular-nums text-gray-400">{sub}</p>}
  </div>
)

interface Props { onAnalisar: (postoCodigo: number, fuel: string) => void }

const RadarVisaoGeral = ({ onAnalisar }: Props) => {
  const r = useReguaPreco()
  const [fPosto, setFPosto] = useState<number | 'todos'>('todos')
  const [fFuel, setFFuel] = useState('todos')
  const [fVer, setFVer] = useState<Veredito | 'todos'>('todos')
  const [aberto, setAberto] = useState<string | null>(null)

  const postos = useMemo(() => { const m = new Map<number, string>(); for (const c of r.cards) if (!m.has(c.empresaCodigo)) m.set(c.empresaCodigo, c.posto); return [...m.entries()].map(([codigo, nome]) => ({ codigo, nome })) }, [r.cards])
  const fuels = useMemo(() => [...new Set(r.cards.map((c) => c.fuel))], [r.cards])
  const filtrados = useMemo(() => r.cards.filter((c) => (fPosto === 'todos' || c.empresaCodigo === fPosto) && (fFuel === 'todos' || c.fuel === fFuel) && (fVer === 'todos' || c.veredito === fVer)), [r.cards, fPosto, fFuel, fVer])
  const ordenar = (v: Veredito, lista: CardPreco[]) => [...lista].sort((a, b) => (v === 'subir' ? b.valor - a.valor : v === 'ceder' || v === 'confirmar' ? b.quantoL - a.quantoL : a.margemPct - b.margemPct))

  if (r.isLoading) return <div className="space-y-4"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>
  if (!r.hasRede || r.cards.length === 0) return <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">Sem venda de combustível com custo no período para montar a régua.</div>

  const t = r.totais
  const refTexto = r.postosComVizinhos > 0
    ? `Referência: ${r.postosComVizinhos} de ${r.totalPostos} postos usam os próprios vizinhos (${r.comPraca} ${r.comPraca === 1 ? 'combustível' : 'combustíveis'} com vizinho atualizado); nos demais, a média da rede.`
    : 'Referência: média da rede em todos os postos. Para um posto usar os vizinhos dele, ligue na análise do posto ou na aba Concorrência.'

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] text-white shadow-sm shadow-blue-500/20"><Radar className="h-5 w-5" /></span>
          <div>
            <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-gray-100">Radar de Preços <InfoHint text="Uma régua só por posto e combustível, em R$/L: o piso (custo), a referência (praça do posto quando cadastrada e ligada; senão a média da rede) e o preço atual. Subir = abaixo da referência com volume, e o valor é (alvo − preço) × litros; Segurar = na referência ou perto do piso; Pode ceder = acima da referência com margem saudável, até não passar da referência nem descer de 9% de margem; Confirmar o custo = daria para ceder, mas o custo é velho ou sem data. Regra fixa sobre venda e custo apurados." /></h3>
            <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">Cada posto, cada combustível: subir, segurar ou ceder, com o número. Clique em <span className="font-medium">Analisar</span> para abrir o posto.</p>
            <p className="mt-0.5 text-[11px] text-gray-400">{refTexto}</p>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2 sm:grid-cols-5">
          <Chip label="Postos" value={t.postos} />
          <Chip label="Subir" value={t.subir} sub={t.subirValor > 0 ? `+${milShort(t.subirValor)} no período` : undefined} tone="emerald" hint="Combustíveis abaixo da referência. O valor soma (alvo − preço) × litros do período, com o litro constante." />
          <Chip label="Segurar" value={t.segurar} tone="red" hint="Na referência ou perto do piso. Aqui não se corta preço." />
          <Chip label="Pode ceder" value={t.ceder} tone="blue" hint="Acima da referência com margem saudável e custo fresco: dá para baixar se a rua apertar." />
          <Chip label="Confirmar" value={t.confirmar} tone="amber" hint="Daria para ceder, mas o custo é velho ou sem data. Confirmar o custo antes de cortar." />
        </div>
      </div>

      {(t.custoVelho > 0 || t.semData > 0) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-[11px] leading-snug text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Quem manda na régua é o custo. {t.custoVelho > 0 ? `${t.custoVelho} ${t.custoVelho === 1 ? 'combustível está' : 'combustíveis estão'} com custo de mais de ${FRESCOR_WARN} dias` : ''}{t.custoVelho > 0 && t.semData > 0 ? ' e ' : ''}{t.semData > 0 ? `${t.semData} sem data confirmada` : ''}. Nesses, "ceder" vira "confirmar o custo"; "subir" continua válido. <InfoHint text={`Frescor do custo: até ${FRESCOR_OK} dias verde, até ${FRESCOR_WARN} amarelo, acima vermelho. Sem data = o sistema tem o valor do custo mas não a data dele (fonte indisponível). Custo velho pode inflar a margem.`} /></span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Filtrar</span>
        <Sel value={String(fPosto)} onChange={(v) => setFPosto(v === 'todos' ? 'todos' : Number(v))}><option value="todos">Todos os postos</option>{postos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}</Sel>
        <Sel value={fFuel} onChange={setFFuel}><option value="todos">Todos os combustíveis</option>{fuels.map((f) => <option key={f} value={f}>{f}</option>)}</Sel>
        <Sel value={fVer} onChange={(v) => setFVer(v as Veredito | 'todos')}><option value="todos">Todos os vereditos</option>{GRUPOS.map((g) => <option key={g.id} value={g.id}>{g.titulo}</option>)}</Sel>
        <span className="text-[11px] text-gray-400">{filtrados.length} {filtrados.length === 1 ? 'item' : 'itens'}</span>
      </div>

      {/* Grupos por veredito */}
      <div className="space-y-5">
        {GRUPOS.map((g) => {
          const lista = ordenar(g.id, filtrados.filter((c) => c.veredito === g.id))
          if (lista.length === 0) return null
          const tc = TONE[g.tone]
          const soma = g.id === 'subir' ? lista.reduce((s, c) => s + c.valor, 0) : 0
          return (
            <div key={g.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', tc.dot)} />
                <h4 className={cn('inline-flex items-center gap-1.5 text-sm font-bold', tc.text)}><g.Icon className="h-4 w-4" /> {g.titulo}</h4>
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-300">{lista.length}</span>
                <span className="text-[11px] text-gray-400">{g.sub}</span>
                {soma > 0 && <span className={cn('ml-auto text-[12px] font-bold tabular-nums', tc.text)}>+{milShort(soma)} no período</span>}
              </div>
              <div className="space-y-2">
                {lista.map((c) => {
                  const ab = aberto === c.id
                  return (
                    <div key={c.id} className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
                      <span className={cn('absolute inset-y-0 left-0 w-[3px]', tc.dot)} />
                      <div className="flex items-center gap-4 px-4 py-3 pl-5">
                        <div className="w-44 shrink-0">
                          <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{c.posto}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">{c.fuel}</p>
                          <CustoFrescor c={c} />
                        </div>
                        <button type="button" onClick={() => setAberto(ab ? null : c.id)} className="min-w-0 flex-1 text-left" title="Ver a conta">
                          <p className={cn('text-[13px] font-bold', tc.text)}>{c.acao}</p>
                          <p className="text-[12px] leading-snug text-gray-600 dark:text-gray-300">{c.motivo}</p>
                        </button>
                        <div className="hidden w-24 shrink-0 text-right md:block">
                          <p className="flex items-center justify-end gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400">Preço · ref.<InfoHint align="end" text="Em cima, o preço de bomba de hoje deste posto (o de tabela; é o mesmo da aba Concorrência e da análise do posto). Embaixo, a referência que a régua usa para comparar: a média dos vizinhos DESTE posto (cada vizinho pesa igual, só preços de até 7 dias) quando a concorrência está ligada e cadastrada, ou senão o preço médio da própria rede para o mesmo combustível." /></p>
                          <p className="text-[12px] font-semibold tabular-nums text-gray-800 dark:text-gray-200">{moneyL(c.preco)}</p>
                          <p className="text-[10px] tabular-nums text-gray-400">{c.referencia ? `${c.referencia.tipo === 'praca' ? (c.referencia.n === 1 ? '1 vizinho' : `${c.referencia.n} vizinhos`) : 'rede'} ${moneyL(c.referencia.preco)}` : 'sem ref.'}</p>
                        </div>
                        <div className="hidden w-16 shrink-0 text-right sm:block">
                          <p className="flex items-center justify-end gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400">Margem<InfoHint align="end" text="Quanto sobra do preço de bomba depois do custo do combustível, em % do preço. Embaixo, o mesmo em reais por litro. Vermelho abaixo de 5%, âmbar abaixo de 9%. É o mesmo número da aba Margem por posto (lá, ao abrir o posto)." /></p>
                          <p className={cn('text-[13px] font-bold tabular-nums', c.margemPct < 5 ? 'text-red-600 dark:text-red-400' : c.margemPct < 9 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-100')}>{pct(c.margemPct)}</p>
                          <p className="text-[10px] tabular-nums text-gray-400">{moneyL(c.lbL)}/L</p>
                        </div>
                        <div className="hidden w-24 shrink-0 text-right sm:block">
                          <p className="flex items-center justify-end gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400">{c.veredito === 'subir' ? 'Vale' : c.quantoL > 0 ? 'Até' : 'Volume/dia'}<InfoHint align="end" text={c.veredito === 'subir' ? 'Quanto a mais de lucro bruto a alta sugerida teria trazido no período filtrado: a alta por litro × os litros vendidos, supondo que o volume não caia.' : c.quantoL > 0 ? 'Até quanto por litro dá para baixar o preço com segurança: o menor entre voltar à referência e manter a margem mínima de segurança.' : 'Litros vendidos por dia, em média, neste combustível e posto. Serve para medir o peso de qualquer mudança de preço.'} /></p>
                          <p className={cn('text-[13px] font-bold tabular-nums', c.veredito === 'subir' ? tc.text : 'text-gray-800 dark:text-gray-100')}>{c.veredito === 'subir' ? `+${milShort(c.valor)}` : c.quantoL > 0 ? `${moneyL(c.quantoL)}/L` : `${Math.round(c.volumeDia).toLocaleString('pt-BR')} L`}</p>
                        </div>
                        <button type="button" onClick={() => onAnalisar(c.empresaCodigo, c.fuel)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 transition-colors hover:border-[#2563eb] hover:text-[#2563eb] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-300">Analisar <ArrowRight className="h-3.5 w-3.5" /></button>
                      </div>
                      {ab && (
                        <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-3 text-[12px] dark:border-gray-800 dark:bg-gray-800/30">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Como a régua chegou nisso</p>
                          <ul className="mt-1 space-y-1 text-gray-700 dark:text-gray-300">{c.porque.map((l, i) => <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{l}</li>)}</ul>
                          {c.risco && <p className="mt-2 inline-flex items-start gap-1.5 text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><b className="font-semibold">Atenção:</b> {c.risco}</span></p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {filtrados.length === 0 && <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700">Nada com estes filtros.</p>}
      </div>

      {/* Loja: a oportunidade que não é de bomba */}
      {r.loja.length > 0 && fVer === 'todos' && fFuel === 'todos' && (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
            <h4 className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 dark:text-teal-300"><ShoppingBag className="h-4 w-4" /> Loja com margem abaixo da rede</h4>
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-300">{r.loja.filter((l) => fPosto === 'todos' || l.empresaCodigo === fPosto).length}</span>
            <span className="text-[11px] text-gray-400">é mix e exposição, não preço de bomba</span>
          </div>
          <div className="space-y-2">
            {r.loja.filter((l) => fPosto === 'todos' || l.empresaCodigo === fPosto).map((l) => (
              <div key={l.empresaCodigo} className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-gray-200 bg-white px-4 py-3 pl-5 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
                <span className="absolute inset-y-0 left-0 w-[3px] bg-teal-500" />
                <div className="w-44 shrink-0"><p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{l.posto}</p><p className="text-[11px] text-gray-500 dark:text-gray-400">Conveniência</p></div>
                <div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-teal-700 dark:text-teal-300">Puxar a margem da loja para {l.redeMargemPct.toFixed(0)}%</p><p className="text-[12px] leading-snug text-gray-600 dark:text-gray-300">{l.porque[0]} {l.porque[1]}</p></div>
                <div className="hidden w-24 shrink-0 text-right sm:block"><p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Vale</p><p className="text-[13px] font-bold tabular-nums text-teal-700 dark:text-teal-300">+{milShort(l.valor)}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default RadarVisaoGeral
