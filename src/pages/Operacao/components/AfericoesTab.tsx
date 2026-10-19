import { Fragment, useMemo, useState } from 'react'
import { FlaskConical, Droplet, Fuel, Users, Search, Eye, AlertTriangle, CalendarDays, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrencyInt, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import RowActionButton from '@/components/tables/RowAction'
import type { PostoOption } from '@/components/filters/PostoLocalSelect'
import type { AfericaoRow } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import useAfericoesCache from '@/pages/Operacao/hooks/useAfericoesCache'
import { volumeAtipico } from '@/lib/afericoes'
import { GUIAS } from '@/lib/guiasModais'

interface Rodada {
  chave: string
  dia: string
  empresaCodigo: number
  posto: string
  itens: AfericaoRow[]
  litros: number
  produtos: number
  bicos: number
  pessoas: string[]
  atipicas: number
}

type BicoInfo = ReturnType<typeof useAfericoesCache>['bicos'][number]

const filtroCls = 'h-9 max-w-[220px] rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-[12.5px] text-gray-700 focus:border-[#2563eb] focus:outline-none dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200 dark:[color-scheme:dark] [&>option]:bg-white [&>option]:font-normal [&>option]:text-gray-800 dark:[&>option]:bg-gray-900 dark:[&>option]:text-gray-100'
// Lista aberta com cor própria: as opções não herdam o azul do botão ativo (ficava ilegível no escuro).
const filtroAtivoCls = 'border-[#2563eb] bg-blue-50 font-semibold text-[#1e3a5f] dark:border-blue-500 dark:bg-blue-950/30 dark:text-blue-200'
const painelCls = 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black'
const brData = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const hora = (iso: string) => (iso && iso.length >= 16 ? iso.slice(11, 16) : '—')
const litrosFmt = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`
const nomeCurto = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : n }
const bicoLabel = (a: { bicoNumero?: string; bicoCodigo: number }) => `Bico ${a.bicoNumero || a.bicoCodigo}`

/**
 * Aba Aferições (Operação): cada linha é uma RODADA — um dia num posto, que é
 * como a aferição acontece (alguém afere vários bicos de uma vez). Clique abre
 * a rodada num modal, por combustível. Fonte: cache apuracao_afericoes.
 */
const AfericoesTab = ({ postos }: { postos: PostoOption[] }) => {
  const { afericoes: afericoesTodas, bicos: bicosTodos, isLoading } = useAfericoesCache(postos.map((p) => p.codigo))
  const [busca, setBusca] = useState('')
  // Filtros: combustível e quem aferiu recortam TUDO (cards, rodadas, bicos);
  // "bicos sem aferição" troca a tabela pela lista dos bicos que não foram testados.
  const [comb, setComb] = useState('')
  const [pessoa, setPessoa] = useState('')
  const [semAfer, setSemAfer] = useState(false)
  const opcoesComb = useMemo(() => [...new Set([...afericoesTodas.map((a) => a.combustivelNome), ...bicosTodos.map((b) => b.combustivel)])].filter((n) => n && n !== '—').sort((a, b) => a.localeCompare(b)), [afericoesTodas, bicosTodos])
  const afericoesComb = useMemo(() => (comb ? afericoesTodas.filter((a) => a.combustivelNome === comb) : afericoesTodas), [afericoesTodas, comb])
  // Só quem aferiu o combustível escolhido (senão a escolha dá zero).
  const opcoesPessoa = useMemo(() => [...new Set(afericoesComb.map((a) => a.frentistaNome))].filter((n) => n && n !== '—').sort((a, b) => a.localeCompare(b)), [afericoesComb])
  const afericoes = useMemo(() => (pessoa ? afericoesComb.filter((a) => a.frentistaNome === pessoa) : afericoesComb), [afericoesComb, pessoa])
  const bicos = useMemo(() => (comb ? bicosTodos.filter((b) => b.combustivel === comb) : bicosTodos), [bicosTodos, comb])
  // Sem aferição = nenhum teste no período (de ninguém), no combustível escolhido.
  const bicosSem = useMemo(() => {
    const feitos = new Set(afericoesComb.map((a) => `${a.empresaCodigo}-${a.bicoCodigo}`))
    const q = busca.trim().toLowerCase()
    return bicos.filter((b) => !feitos.has(`${b.empresaCodigo}-${b.bicoCodigo}`))
      .filter((b) => !q || b.empresaNome.toLowerCase().includes(q) || b.combustivel.toLowerCase().includes(q) || b.bicoNumero === q || b.bomba.toLowerCase().includes(q))
      .sort((x, y) => x.empresaNome.localeCompare(y.empresaNome) || Number(x.bicoNumero) - Number(y.bicoNumero))
  }, [bicos, afericoesComb, busca])
  const filtrando = !!comb || !!pessoa || semAfer
  const limparFiltros = () => { setComb(''); setPessoa(''); setSemAfer(false) }
  const [rodadaAberta, setRodadaAberta] = useState<string | null>(null)
  const [bicosAberto, setBicosAberto] = useState(false)

  const rodadas = useMemo<Rodada[]>(() => {
    const m = new Map<string, Rodada>()
    for (const a of afericoes) {
      const chave = `${a.dataFiscal}|${a.empresaCodigo}`
      const r = m.get(chave) ?? { chave, dia: a.dataFiscal, empresaCodigo: a.empresaCodigo, posto: a.empresaNome, itens: [], litros: 0, produtos: 0, bicos: 0, pessoas: [], atipicas: 0 }
      r.itens.push(a); r.litros += a.litros
      if (volumeAtipico(a.litros)) r.atipicas += 1
      m.set(chave, r)
    }
    for (const r of m.values()) {
      r.produtos = new Set(r.itens.map((a) => a.combustivelNome)).size
      r.bicos = new Set(r.itens.map((a) => a.bicoCodigo)).size
      r.pessoas = [...new Set(r.itens.map((a) => a.frentistaNome))]
    }
    return [...m.values()].sort((x, y) => y.dia.localeCompare(x.dia) || x.posto.localeCompare(y.posto))
  }, [afericoes])

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return rodadas
    return rodadas.filter((r) => r.posto.toLowerCase().includes(q) || r.itens.some((a) =>
      a.combustivelNome.toLowerCase().includes(q) || a.frentistaNome.toLowerCase().includes(q) || bicoLabel(a).toLowerCase().includes(q) || (a.bicoNumero ?? '') === q))
  }, [rodadas, busca])

  // Agrupa as rodadas visíveis por dia (mais recente primeiro): faixa do dia + os postos.
  const porDia = useMemo(() => {
    const m = new Map<string, Rodada[]>()
    for (const r of visiveis) { const l = m.get(r.dia) ?? []; l.push(r); m.set(r.dia, l) }
    return [...m.entries()].map(([dia, rs]) => ({
      dia, rs,
      count: rs.reduce((n, r) => n + r.itens.length, 0),
      litros: rs.reduce((n, r) => n + r.litros, 0),
      bicos: rs.reduce((n, r) => n + r.bicos, 0),
      atipicas: rs.reduce((n, r) => n + r.atipicas, 0),
    }))
  }, [visiveis])

  const totais = useMemo(() => {
    const aferidos = new Set(afericoes.map((a) => `${a.empresaCodigo}-${a.bicoCodigo}`))
    return {
      count: afericoes.length,
      litros: afericoes.reduce((n, a) => n + a.litros, 0),
      valor: afericoes.reduce((n, a) => n + a.valorEstimado, 0),
      bicosAferidos: bicos.filter((b) => aferidos.has(`${b.empresaCodigo}-${b.bicoCodigo}`)).length,
      bicosTotal: bicos.length,
      pessoas: [...new Set(afericoes.map((a) => a.frentistaNome))],
    }
  }, [afericoes, bicos])

  const rodada = rodadaAberta ? rodadas.find((r) => r.chave === rodadaAberta) ?? null : null

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Aferições no período" hint="Testes de bomba: o combustível sai pelo bico, é medido no balde aferidor e volta para o tanque. Não é venda." valor={formatNumber(totais.count)} sub={`${formatNumber(rodadas.length)} ${rodadas.length === 1 ? 'rodada' : 'rodadas'} (dia × posto)`} Icon={FlaskConical} tom="amber" />
        <Card label="Litros aferidos" hint="Soma do que passou pelo balde. Volta para o tanque, então não é perda; o valor é só referência, a preço de bomba." valor={litrosFmt(totais.litros)} sub={`≈ ${formatCurrencyInt(totais.valor)} a preço de bomba`} Icon={Droplet} tom="sky" />
        <Card label="Bicos aferidos" hint="Quantos bicos cadastrados nos postos do filtro tiveram pelo menos uma aferição no período. Clique para ver bico a bico, com a data do último teste." valor={totais.bicosTotal > 0 ? `${formatNumber(totais.bicosAferidos)} de ${formatNumber(totais.bicosTotal)}` : formatNumber(totais.bicosAferidos)} sub={pessoa ? `aferidos por ${nomeCurto(pessoa)}` : totais.bicosTotal > totais.bicosAferidos ? `${formatNumber(totais.bicosTotal - totais.bicosAferidos)} sem aferição no período` : 'todos aferidos no período'} Icon={Fuel} tom={totais.bicosTotal > totais.bicosAferidos ? 'red' : 'emerald'} onClick={() => setBicosAberto(true)} />
        <Card label="Pessoas envolvidas" hint="Quem estava logado na bomba durante a aferição." valor={formatNumber(totais.pessoas.length)} sub={totais.pessoas.slice(0, 2).map(nomeCurto).join(', ') + (totais.pessoas.length > 2 ? ` +${totais.pessoas.length - 2}` : '')} Icon={Users} tom="violet" />
      </div>

      {/* Rodadas */}
      <section className={painelCls}>
        <header className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 dark:text-gray-100"><FlaskConical className="h-4 w-4 text-amber-500" /> Aferições realizadas
            <InfoHint text="Agrupado por dia: a faixa traz o total do dia e, embaixo, cada posto que aferiu (uma rodada). Clique em Ver para abrir a rodada por combustível, com hora, bico e quem aferiu. Em âmbar: volume fora do padrão do balde (não fecha em múltiplo de 10 L)." />
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select value={comb} onChange={(e) => setComb(e.target.value)} aria-label="Combustível" className={cn(filtroCls, comb && filtroAtivoCls)}>
              <option value="">Todos os combustíveis</option>
              {opcoesComb.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} aria-label="Quem aferiu" disabled={semAfer} className={cn(filtroCls, pessoa && filtroAtivoCls, semAfer && 'opacity-50')}>
              <option value="">Quem aferiu: todos</option>
              {opcoesPessoa.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button type="button" onClick={() => setSemAfer((v) => !v)} aria-pressed={semAfer} className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-semibold transition-colors', semAfer ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200')}>
              <Fuel className="h-3.5 w-3.5" /> Bicos sem aferição{bicosSem.length > 0 && <span className={cn('rounded-full px-1.5 text-[10.5px] tabular-nums', semAfer ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300')}>{bicosSem.length}</span>}
            </button>
            {filtrando && <button type="button" onClick={limparFiltros} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563eb] hover:underline dark:text-blue-300"><X className="h-3.5 w-3.5" /> Limpar</button>}
          </div>
          <span className="relative block w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar combustível, bico, posto ou pessoa…" className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100" />
          </span>
        </header>
        {semAfer ? (
          bicosSem.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-gray-500 dark:text-gray-400">{bicos.length === 0 ? 'Nenhum bico cadastrado com esse filtro.' : 'Todos os bicos tiveram aferição no período.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-2 text-left font-semibold">Posto</th>
                    <th className="px-3 py-2 text-left font-semibold">Bico</th>
                    <th className="px-3 py-2 text-left font-semibold">Bomba</th>
                    <th className="px-3 py-2 text-left font-semibold">Combustível</th>
                    <th className="px-4 py-2 text-right font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {bicosSem.map((b) => (
                    <tr key={`${b.empresaCodigo}-${b.bicoCodigo}`} className="text-gray-800 dark:text-gray-200">
                      <td className="whitespace-nowrap px-4 py-2.5">{b.empresaNome}</td>
                      <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1 font-semibold"><Droplet className="h-3 w-3 text-sky-500" />{b.bicoNumero || b.bicoCodigo}</span></td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{b.bomba || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{b.combustivel}</td>
                      <td className="px-4 py-2.5 text-right"><span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">sem aferição no período</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : afericoes.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-gray-500 dark:text-gray-400">{filtrando ? 'Nenhuma aferição com esses filtros no período.' : 'Nenhuma aferição no período nos postos do filtro.'}</p>
        ) : visiveis.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-gray-500 dark:text-gray-400">Nada com "{busca.trim()}".</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-2 text-left font-semibold">Dia · posto</th>
                  <th className="px-3 py-2 text-right font-semibold">Combustíveis</th>
                  <th className="px-3 py-2 text-right font-semibold">Aferições</th>
                  <th className="px-3 py-2 text-right font-semibold">Bicos</th>
                  <th className="px-3 py-2 text-right font-semibold">Litros</th>
                  <th className="px-3 py-2 text-left font-semibold">Quem aferiu</th>
                  <th className="px-4 py-2 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {porDia.map((g) => (
                  <Fragment key={g.dia}>
                    <tr className="bg-gray-50/80 text-gray-900 dark:bg-gray-800/40 dark:text-gray-100">
                      <td className="whitespace-nowrap px-4 py-2 font-bold tabular-nums">
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-gray-400" />{brData(g.dia)}</span>
                        <span className="ml-2 text-[11px] font-normal text-gray-500 dark:text-gray-400">{g.rs.length} {g.rs.length === 1 ? 'posto' : 'postos'}</span>
                      </td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {g.count}
                        {g.atipicas > 0 && <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-px align-middle text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />{g.atipicas}</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{g.bicos}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums">{litrosFmt(g.litros)}</td>
                      <td className="px-3 py-2" colSpan={2} />
                    </tr>
                    {g.rs.map((r) => (
                      <tr key={r.chave} onClick={() => setRodadaAberta(r.chave)} className="cursor-pointer text-gray-800 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/40">
                        <td className="whitespace-nowrap py-2.5 pl-10 pr-3">{r.posto}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.produtos}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {r.itens.length}
                          {r.atipicas > 0 && <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-px align-middle text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />{r.atipicas}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.bicos}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{litrosFmt(r.litros)}</td>
                        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">{nomeCurto(r.pessoas[0] ?? '—')}{r.pessoas.length > 1 && <span className="text-gray-400"> +{r.pessoas.length - 1}</span>}</td>
                        <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}><RowActionButton icon={Eye} label="Ver" onClick={() => setRodadaAberta(r.chave)} /></td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {rodada && <RodadaModal r={rodada} onClose={() => setRodadaAberta(null)} />}
      {bicosAberto && <BicosModal bicos={bicos} afericoes={afericoes} onClose={() => setBicosAberto(false)} />}
    </div>
  )
}

const TONS = {
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
}

const Card = ({ label, hint, valor, sub, Icon, tom, onClick }: { label: string; hint: string; valor: string; sub: string; Icon: typeof Fuel; tom: keyof typeof TONS; onClick?: () => void }) => (
  <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(e) => { if (onClick && e.key === 'Enter') onClick() }}
    className={cn(painelCls, 'p-4', onClick && 'cursor-pointer transition-colors hover:border-[#2563eb]/50')}>
    <div className="flex items-center justify-between">
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}<InfoHint text={hint} /></p>
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', TONS[tom])}><Icon className="h-4 w-4" /></span>
    </div>
    <p className="mt-1.5 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{valor}</p>
    <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">{sub}</p>
  </div>
)

/** Uma rodada (dia × posto) por combustível. */
const RodadaModal = ({ r, onClose }: { r: Rodada; onClose: () => void }) => {
  const porProduto = useMemo(() => {
    const m = new Map<string, AfericaoRow[]>()
    for (const a of r.itens) { const l = m.get(a.combustivelNome) ?? []; l.push(a); m.set(a.combustivelNome, l) }
    return [...m.entries()].map(([nome, itens]) => ({ nome, itens: [...itens].sort((x, y) => (x.dataHora || '').localeCompare(y.dataHora || '') || x.bicoCodigo - y.bicoCodigo), litros: itens.reduce((n, a) => n + a.litros, 0) }))
      .sort((x, y) => y.itens.length - x.itens.length)
  }, [r])
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent guia={GUIAS.afericoesRodada} className="max-h-[88vh] w-[95vw] max-w-3xl gap-0 overflow-y-auto p-0">
        <DialogHeader className="space-y-0 border-b border-gray-100 px-6 pb-4 pt-5 text-left dark:border-gray-800">
          <div className="flex items-start gap-3 pr-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"><FlaskConical className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">Rodada de aferição</p>
              <DialogTitle className="text-[17px] font-bold text-gray-900 dark:text-gray-100">{brData(r.dia)} · {r.posto}</DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-gray-500 dark:text-gray-400">
                <span><b className="font-semibold text-gray-700 dark:text-gray-200">{r.itens.length}</b> aferições</span>
                <span><b className="font-semibold text-gray-700 dark:text-gray-200">{r.bicos}</b> bicos</span>
                <span><b className="font-semibold text-gray-700 dark:text-gray-200">{litrosFmt(r.litros)}</b></span>
                <span>{r.pessoas.join(', ')}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          {r.atipicas > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{r.atipicas} {r.atipicas === 1 ? 'aferição com volume' : 'aferições com volume'} fora do padrão do balde (não fecha em múltiplo de 10 L). Vale conferir.
            </p>
          )}
          {porProduto.map((g) => (
            <div key={g.nome} className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <p className="flex items-center gap-2 bg-gray-50 px-3 py-2 text-[12.5px] font-semibold text-gray-900 dark:bg-gray-800/40 dark:text-gray-100">
                <Fuel className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />{g.nome}
                <span className="ml-auto text-[11.5px] font-normal tabular-nums text-gray-500 dark:text-gray-400">{g.itens.length} {g.itens.length === 1 ? 'aferição' : 'aferições'} · <b className="font-semibold text-gray-800 dark:text-gray-100">{litrosFmt(g.litros)}</b></span>
              </p>
              <table className="w-full text-[12.5px]">
                <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                  <tr><th className="px-3 py-1.5 text-left font-semibold">Hora</th><th className="px-3 py-1.5 text-left font-semibold">Bico</th><th className="px-3 py-1.5 text-right font-semibold">Litros</th><th className="px-3 py-1.5 text-left font-semibold">Quem</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {g.itens.map((a) => {
                    const fora = volumeAtipico(a.litros)
                    return (
                      <tr key={a.codigo} className={cn(fora && 'bg-amber-50/60 dark:bg-amber-950/20')}>
                        <td className="px-3 py-1.5 tabular-nums text-gray-700 dark:text-gray-300">{hora(a.dataHora)}</td>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300"><span className="inline-flex items-center gap-1"><Droplet className="h-3 w-3 text-sky-500" />{a.bicoNumero || a.bicoCodigo}</span> <span className="text-[11px] text-gray-400">{a.bombaDescricao.split(' - ')[0]}</span></td>
                        <td className={cn('px-3 py-1.5 text-right font-semibold tabular-nums', fora ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-gray-100')}>{litrosFmt(a.litros)}</td>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-gray-300">{a.frentistaNome}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Bico a bico: último teste no período; os sem aferição primeiro. */
const BicosModal = ({ bicos, afericoes, onClose }: { bicos: BicoInfo[]; afericoes: AfericaoRow[]; onClose: () => void }) => {
  const linhas = useMemo(() => {
    const ult = new Map<string, { dia: string; n: number }>()
    for (const a of afericoes) {
      const k = `${a.empresaCodigo}-${a.bicoCodigo}`
      const u = ult.get(k) ?? { dia: '', n: 0 }
      u.n += 1; if (a.dataFiscal > u.dia) u.dia = a.dataFiscal
      ult.set(k, u)
    }
    return bicos.map((b) => ({ ...b, ult: ult.get(`${b.empresaCodigo}-${b.bicoCodigo}`) ?? null }))
      .sort((x, y) => (x.ult ? 1 : 0) - (y.ult ? 1 : 0) || x.empresaNome.localeCompare(y.empresaNome) || Number(x.bicoNumero) - Number(y.bicoNumero))
  }, [bicos, afericoes])
  const sem = linhas.filter((l) => !l.ult).length
  const variosPostos = new Set(bicos.map((b) => b.empresaCodigo)).size > 1
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent guia={GUIAS.afericoesBicos} className="max-h-[88vh] w-[95vw] max-w-2xl gap-0 overflow-y-auto p-0">
        <DialogHeader className="space-y-0 border-b border-gray-100 px-6 pb-4 pt-5 text-left dark:border-gray-800">
          <DialogTitle className="flex items-center gap-2 text-[16px] font-bold text-gray-900 dark:text-gray-100"><Fuel className="h-4 w-4 text-[#2563eb]" /> Bicos e a última aferição</DialogTitle>
          <DialogDescription className="text-[12px] text-gray-500 dark:text-gray-400">{sem > 0 ? `${sem} de ${linhas.length} bicos sem aferição no período selecionado.` : `Todos os ${linhas.length} bicos tiveram aferição no período.`} Mude o período no topo para olhar mais para trás.</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4">
          {linhas.length === 0 ? <p className="py-6 text-center text-[13px] text-gray-500">Nenhum bico cadastrado nos postos do filtro.</p> : (
            <table className="w-full text-[12.5px]">
              <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {variosPostos && <th className="py-1.5 pr-3 text-left font-semibold">Posto</th>}
                  <th className="py-1.5 pr-3 text-left font-semibold">Bico</th>
                  <th className="py-1.5 pr-3 text-left font-semibold">Combustível</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Aferições</th>
                  <th className="py-1.5 text-right font-semibold">Última</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {linhas.map((l) => (
                  <tr key={`${l.empresaCodigo}-${l.bicoCodigo}`} className={cn(!l.ult && 'bg-red-50/50 dark:bg-red-950/15')}>
                    {variosPostos && <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-300">{l.empresaNome}</td>}
                    <td className="py-1.5 pr-3 text-gray-800 dark:text-gray-200"><span className="inline-flex items-center gap-1 font-semibold"><Droplet className="h-3 w-3 text-sky-500" />{l.bicoNumero || l.bicoCodigo}</span> <span className="text-[11px] text-gray-400">{l.bomba}</span></td>
                    <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-300">{l.combustivel}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{l.ult?.n ?? 0}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.ult ? <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-200"><CalendarDays className="h-3 w-3 text-gray-400" />{brData(l.ult.dia)}</span> : <span className="font-semibold text-red-600 dark:text-red-400">sem aferição</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AfericoesTab
