import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt, formatCurrencyShort } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'

/**
 * Calendário de vencimentos (pagar OU receber): mês de segunda a domingo com o
 * total do dia, quantos títulos, os dois maiores nomes e a cor da situação
 * (vencido / vence em até 7 dias / a vencer). Semana ao clicar no cabeçalho
 * "Semana"; clique num dia abre a lista do dia (modal do chamador).
 *
 * Melhorias sobre o "calendário comum": subtotal por semana na lateral,
 * intensidade de fundo pelo valor (dia pesado salta aos olhos), selo do dia
 * mais pesado do mês, e o "fim de semana no próximo dia útil" que empurra
 * sábado/domingo pra segunda, dizendo quanto veio de lá.
 */

export interface ItemVencimento {
  id: string
  /** yyyy-MM-dd */
  venc: string
  valor: number
  nome: string
}

interface Props {
  titulo: string
  itens: ItemVencimento[]
  onDia: (dia: string, itens: ItemVencimento[]) => void
  /** Cor do vencido: vermelho (a pagar = risco) ou laranja (a receber = cobrar). */
  corVencido?: 'red' | 'orange'
  /** Rótulo do que são os itens: "títulos", "recebíveis". */
  nomeItens?: string
  nota?: string
  hint?: string
}

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const deIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addDias = (s: string, n: number) => { const d = deIso(s); d.setDate(d.getDate() + n); return iso(d) }
const segundaDe = (dia: string) => { const d = deIso(dia); const off = (d.getDay() + 6) % 7; return addDias(dia, -off) }
const hojeIso = () => iso(new Date())
const curto = (s: string, max = 26) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

type Situacao = 'vencido' | 'ate7' | 'aVencer'

const CalendarioVencimentos = ({ titulo, itens, onDia, corVencido = 'red', nomeItens = 'títulos', nota, hint }: Props) => {
  const hoje = hojeIso()
  const [modo, setModo] = useState<'mes' | 'semana'>('mes')
  const [ref, setRef] = useState(hoje)
  const [rolarFds, setRolarFds] = useState(true)

  const refDate = deIso(ref)
  const mesIni = iso(new Date(refDate.getFullYear(), refDate.getMonth(), 1))
  const mesFim = iso(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0))
  const gradeIni = segundaDe(mesIni)
  const semanaIni = segundaDe(ref)
  const de = modo === 'mes' ? gradeIni : semanaIni
  const dias: string[] = []
  for (let i = 0; i < (modo === 'mes' ? 42 : 7); i++) dias.push(addDias(de, i))

  // Agrupa por dia; fim de semana vai pra segunda seguinte quando ligado.
  const porDia = useMemo(() => {
    const m = new Map<string, { itens: ItemVencimento[]; total: number; doFds: number }>()
    for (const it of itens) {
      if (!it.venc) continue
      let dia = it.venc
      let veioFds = false
      if (rolarFds) {
        const dow = deIso(dia).getDay()
        if (dow === 6) { dia = addDias(dia, 2); veioFds = true }
        else if (dow === 0) { dia = addDias(dia, 1); veioFds = true }
      }
      const g = m.get(dia) ?? { itens: [], total: 0, doFds: 0 }
      g.itens.push(it)
      g.total += it.valor
      if (veioFds) g.doFds++
      m.set(dia, g)
    }
    for (const g of m.values()) g.itens.sort((a, b) => b.valor - a.valor)
    return m
  }, [itens, rolarFds])

  const situacaoDe = (dia: string): Situacao => (dia < hoje ? 'vencido' : dia <= addDias(hoje, 7) ? 'ate7' : 'aVencer')
  const COR: Record<Situacao, { barra: string; dot: string; txt: string; fundo: string }> = {
    vencido: corVencido === 'orange'
      ? { barra: 'bg-orange-500', dot: 'bg-orange-500', txt: 'text-orange-600 dark:text-orange-400', fundo: 'bg-orange-500' }
      : { barra: 'bg-red-500', dot: 'bg-red-500', txt: 'text-red-600 dark:text-red-400', fundo: 'bg-red-500' },
    ate7: { barra: 'bg-amber-500', dot: 'bg-amber-500', txt: 'text-amber-600 dark:text-amber-400', fundo: 'bg-amber-500' },
    aVencer: { barra: 'bg-emerald-500', dot: 'bg-emerald-500', txt: 'text-emerald-600 dark:text-emerald-400', fundo: 'bg-emerald-500' },
  }

  // Totais do que está visível (mês = só dias do mês; semana = os 7 dias).
  const visiveis = dias.filter((d) => modo === 'semana' || (d >= mesIni && d <= mesFim))
  const totalVisivel = visiveis.reduce((s, d) => s + (porDia.get(d)?.total ?? 0), 0)
  const countVisivel = visiveis.reduce((s, d) => s + (porDia.get(d)?.itens.length ?? 0), 0)
  const maxDia = Math.max(...visiveis.map((d) => porDia.get(d)?.total ?? 0), 0)
  const piorDia = visiveis.reduce<string | null>((best, d) => ((porDia.get(d)?.total ?? 0) > (best ? porDia.get(best)?.total ?? 0 : 0) ? d : best), null)

  const tituloPeriodo = modo === 'mes'
    ? (() => { const t = refDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1) })()
    : `${deIso(semanaIni).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${deIso(addDias(semanaIni, 6)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
  const navegar = (dir: -1 | 1) => {
    if (modo === 'semana') { setRef(addDias(ref, 7 * dir)); return }
    setRef(iso(new Date(refDate.getFullYear(), refDate.getMonth() + dir, 1)))
  }

  const semanas: string[][] = []
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))

  const Celula = ({ dia, altura }: { dia: string; altura: string }) => {
    const g = porDia.get(dia)
    const foraDoMes = modo === 'mes' && (dia < mesIni || dia > mesFim)
    const ehHoje = dia === hoje
    const sit = situacaoDe(dia)
    const intensidade = g && maxDia > 0 ? Math.min(0.22, 0.04 + (g.total / maxDia) * 0.18) : 0
    const mostrar = modo === 'mes' ? 2 : 8
    return (
      <button
        type="button"
        disabled={!g}
        onClick={() => g && onDia(dia, g.itens)}
        title={g ? 'Clique para ver todos os títulos do dia' : undefined}
        className={cn(
          'relative flex flex-col items-stretch overflow-hidden rounded-lg border p-2 text-left transition-colors',
          altura,
          g ? 'border-gray-200 bg-white hover:border-[#1e3a5f]/40 dark:border-gray-700 dark:bg-[#0b0b0b]' : 'border-dashed border-gray-200 bg-transparent dark:border-gray-800',
          foraDoMes && 'opacity-40',
          ehHoje && 'ring-2 ring-emerald-500/70',
          g && cn('border-l-[3px]', sit === 'vencido' ? (corVencido === 'orange' ? 'border-l-orange-500' : 'border-l-red-500') : sit === 'ate7' ? 'border-l-amber-500' : 'border-l-emerald-500'),
        )}
      >
        {g && intensidade > 0 && <span aria-hidden className={cn('pointer-events-none absolute inset-0', COR[sit].fundo)} style={{ opacity: intensidade }} />}
        <span className="relative flex items-center justify-between gap-1">
          <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums', ehHoje ? 'bg-emerald-500 text-white' : 'text-gray-500 dark:text-gray-400')}>{Number(dia.slice(8))}</span>
          {ehHoje && <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">hoje</span>}
          <span className="ml-auto flex items-center gap-1">
            {piorDia === dia && g && <Flame className="h-3 w-3 text-red-500" aria-label="Dia mais pesado" />}
            {g && <span className="rounded bg-gray-100 px-1 text-[10px] tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">{g.itens.length}</span>}
          </span>
        </span>
        {g && (
          <>
            <span className={cn('relative mt-0.5 text-[13px] font-extrabold tabular-nums leading-tight', COR[sit].txt)}>{formatCurrencyInt(g.total)}</span>
            <span className="relative mt-1 hidden flex-col gap-0.5 md:flex">
              {g.itens.slice(0, mostrar).map((it) => (
                <span key={it.id} className="flex items-center justify-between gap-1 text-[10px] leading-tight text-gray-600 dark:text-gray-300">
                  <span className="flex min-w-0 items-center gap-1"><span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', COR[sit].dot)} /><span className="truncate">{curto(it.nome)}</span></span>
                  <span className="shrink-0 tabular-nums text-gray-500">{formatCurrencyShort(it.valor)}</span>
                </span>
              ))}
              {g.itens.length > mostrar && <span className="text-[10px] text-gray-400">+{g.itens.length - mostrar} {nomeItens}</span>}
              {g.doFds > 0 && <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">inclui {g.doFds} do fim de semana</span>}
            </span>
            <span className="relative mt-auto pt-1">
              <span className="block h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <span className={cn('block h-full rounded-full', COR[sit].barra)} style={{ width: `${maxDia > 0 ? Math.max(4, (g.total / maxDia) * 100) : 0}%` }} />
              </span>
            </span>
          </>
        )}
      </button>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-gray-100">{titulo}{hint && <InfoHint text={hint} />}</span>
            <span className="block text-[11px] text-gray-500 dark:text-gray-400">
              {tituloPeriodo} · {countVisivel} {nomeItens} · <b className="text-gray-700 dark:text-gray-300">{formatCurrencyInt(totalVisivel)}</b>
              {piorDia && (porDia.get(piorDia)?.total ?? 0) > 0 && <> · dia mais pesado: <b className="text-gray-700 dark:text-gray-300">{deIso(piorDia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</b> ({formatCurrencyInt(porDia.get(piorDia)!.total)})</>}
            </span>
          </span>
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
            <input type="checkbox" className="h-3.5 w-3.5 accent-emerald-600" checked={rolarFds} onChange={(e) => setRolarFds(e.target.checked)} />
            Fim de semana no próximo dia útil
            <InfoHint text="Ligado: o que vence no sábado ou domingo aparece na segunda-feira, que é quando o banco processa. O dia mostra quantos vieram do fim de semana." />
          </label>
          <span className="inline-flex items-center gap-1">
            <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800" onClick={() => navegar(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" className="inline-flex h-7 items-center rounded-md border border-gray-200 px-2 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800" onClick={() => setRef(hoje)}>Hoje</button>
            <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800" onClick={() => navegar(1)} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></button>
          </span>
          <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
            {(['semana', 'mes'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setModo(m)}
                className={cn('rounded px-2.5 py-1 text-[11px] font-semibold', modo === m ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800')}>
                {m === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </span>
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_96px] gap-1.5">
            {DIAS.map((d) => <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">{d}</div>)}
            <div className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">Semana</div>
            {semanas.map((sem) => {
              const totSem = sem.reduce((s, d) => s + ((modo === 'semana' || (d >= mesIni && d <= mesFim)) ? (porDia.get(d)?.total ?? 0) : 0), 0)
              const nSem = sem.reduce((s, d) => s + ((modo === 'semana' || (d >= mesIni && d <= mesFim)) ? (porDia.get(d)?.itens.length ?? 0) : 0), 0)
              return [
                ...sem.map((dia) => <Celula key={dia} dia={dia} altura={modo === 'mes' ? 'min-h-[7.5rem]' : 'min-h-[16rem]'} />),
                <div key={`s-${sem[0]}`} className="flex flex-col items-end justify-center rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-right dark:border-gray-800 dark:bg-white/[0.03]">
                  <span className="text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-200">{totSem > 0 ? formatCurrencyShort(totSem) : '—'}</span>
                  <span className="text-[10px] text-gray-400">{nSem > 0 ? `${nSem} ${nomeItens}` : 'nada'}</span>
                  {totalVisivel > 0 && totSem > 0 && <span className="text-[10px] tabular-nums text-gray-400">{Math.round((totSem / totalVisivel) * 100)}%</span>}
                </div>,
              ]
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-400 dark:text-gray-500">
        <span className="inline-flex items-center gap-1"><span className={cn('h-2 w-2 rounded-full', corVencido === 'orange' ? 'bg-orange-500' : 'bg-red-500')} /> vencido</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> vence em até 7 dias</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> a vencer</span>
        <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-red-500" /> dia mais pesado</span>
        <span>· Fundo mais forte = dia mais pesado. Clique num dia para ver todos os {nomeItens}.</span>
        {nota && <span>· {nota}</span>}
      </div>
    </section>
  )
}

export default CalendarioVencimentos
