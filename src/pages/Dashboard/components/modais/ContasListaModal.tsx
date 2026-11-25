import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Users, ListOrdered, ChevronLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import type { ContaItem, Horizonte } from '@/pages/Dashboard/hooks/useContasResumo'
import { linkFinanceiro } from '@/pages/Financeiro/lib/filtroLink'
import { GUIAS } from '@/lib/guiasModais'
import { brDateShort, relDias, todayISO, MODAL_CLS } from '@/pages/Dashboard/components/modais/util'
import FiltrosDiaModal from '@/pages/Financeiro/components/shared/FiltrosDiaModal'
import { opcoesDe, norm } from '@/pages/Financeiro/components/shared/filtrosDia'
import BarraTarefaTitulos from '@/pages/Financeiro/components/shared/BarraTarefaTitulos'
import { usePodeCriarTarefa, type TituloSelecionado } from '@/pages/Financeiro/components/shared/tarefaTitulos'

export type TomLista = 'red' | 'orange' | 'amber' | 'blue' | 'gray' | 'rose' | 'emerald'

const TOM: Record<TomLista, string> = {
  red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300',
  orange: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  gray: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
  rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
}

export interface ListaSel {
  titulo: string
  subtitulo: string
  /** Rótulo do selo (ex.: "Vencidas", "Boleto"). */
  selo: string
  tom: TomLista
  lado: 'pagar' | 'receber'
  itens: ContaItem[]
  /** O recorte que gerou a lista — vai junto no "Abrir em Contas a …". */
  filtro?: { faixas?: Horizonte[]; cat?: string }
}

interface Props {
  sel: ListaSel | null
  onClose: () => void
}

const PAGINA = 120
const docs = (n: number) => `${n} ${n === 1 ? 'título' : 'títulos'}`

interface Grupo { nome: string; total: number; count: number; postos: Set<string>; cats: Set<string>; maisAntigo: string; ids: string[] }

type Ordem = 'valor' | 'nome' | 'venc'
const ORDENS: { id: Ordem; label: string }[] = [
  { id: 'valor', label: 'Maior valor' },
  { id: 'nome', label: 'Nome (A–Z)' },
  { id: 'venc', label: 'Vencimento mais antigo' },
]
const caixa = 'h-4 w-4 cursor-pointer rounded border-gray-300 accent-[#0d9488] dark:border-[#3e4c63]'
/** Caixinha que aceita o estado "parcial" (alguns marcados). */
const Caixa = ({ checked, parcial, onChange, rotulo }: { checked: boolean; parcial?: boolean; onChange: () => void; rotulo: string }) => (
  <input type="checkbox" className={caixa} aria-label={rotulo} checked={checked}
    ref={(el) => { if (el) el.indeterminate = !!parcial && !checked }}
    onClick={(e) => e.stopPropagation()} onChange={onChange} />
)

/**
 * Lista os títulos de uma faixa/categoria do card de Contas (Central), sem
 * trocar de tela. Dois jeitos de ler: "Por nome" (quem concentra o valor) e
 * "Título a título" (paginado, com busca). Clicar num nome filtra a lista.
 */
const ContasListaModal = ({ sel, onClose }: Props) => {
  if (!sel) return null
  // `key` troca a instância a cada seleção nova → busca/modo/paginação zeram sozinhos.
  return <Inner key={`${sel.lado}|${sel.selo}|${sel.subtitulo}|${sel.itens.length}`} sel={sel} onClose={onClose} />
}

const Inner = ({ sel, onClose }: { sel: ListaSel; onClose: () => void }) => {
  const [modo, setModo] = useState<'nomes' | 'titulos'>('nomes')
  const [busca, setBusca] = useState('')
  const [posto, setPosto] = useState('')
  const [cat, setCat] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('valor')
  const [limite, setLimite] = useState(PAGINA)
  // Seleção para criar tarefa (só com o módulo Tarefas ligado e permissão de criar).
  const podeTarefa = usePodeCriarTarefa()
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set())
  const marcar = (ids: string[], ligar: boolean) => setMarcados((m) => { const n = new Set(m); ids.forEach((id) => (ligar ? n.add(id) : n.delete(id))); return n })

  const hoje = todayISO()
  const itens = sel.itens
  const postos = useMemo(() => opcoesDe(itens, (i) => String(i.empresaCodigo), (k) => itens.find((i) => String(i.empresaCodigo) === k)?.posto ?? `Posto ${k}`), [itens])
  const cats = useMemo(() => opcoesDe(itens, (i) => i.catLabel, (k) => k), [itens])

  const filtrados = useMemo(() => {
    const q = norm(busca.trim())
    const base = itens.filter((i) => {
      if (posto && String(i.empresaCodigo) !== posto) return false
      if (cat && i.catLabel !== cat) return false
      return !q || norm(`${i.nome} ${i.posto} ${i.documento} ${i.detalhe}`).includes(q)
    })
    return base.sort((a, b) => ordem === 'nome' ? a.nome.localeCompare(b.nome, 'pt-BR') || a.venc.localeCompare(b.venc)
      : ordem === 'valor' ? b.valor - a.valor
      : a.venc.localeCompare(b.venc) || b.valor - a.valor)
  }, [itens, busca, posto, cat, ordem])

  const grupos = useMemo(() => {
    const m = new Map<string, Grupo>()
    for (const i of filtrados) {
      const g = m.get(i.nome) ?? { nome: i.nome, total: 0, count: 0, postos: new Set<string>(), cats: new Set<string>(), maisAntigo: i.venc, ids: [] }
      g.total += i.valor; g.count++; g.postos.add(i.posto); g.cats.add(i.catLabel); g.ids.push(i.id)
      if (i.venc && i.venc < g.maisAntigo) g.maisAntigo = i.venc
      m.set(i.nome, g)
    }
    return [...m.values()].sort((a, b) => ordem === 'nome' ? a.nome.localeCompare(b.nome, 'pt-BR') : ordem === 'venc' ? a.maisAntigo.localeCompare(b.maisAntigo) : b.total - a.total)
  }, [filtrados, ordem])

  const idsVisiveis = filtrados.map((i) => i.id)
  const todos = idsVisiveis.length > 0 && idsVisiveis.every((id) => marcados.has(id))
  const alguns = idsVisiveis.some((id) => marcados.has(id))
  const escolhidos = itens.filter((i) => marcados.has(i.id))
  const selecionados: TituloSelecionado[] = escolhidos.map((i) => ({ nome: i.nome, documento: i.documento, valor: i.valor, empresaCodigo: i.empresaCodigo, posto: i.posto, venc: i.venc }))
  const temVencido = escolhidos.some((i) => i.horizonte === 'vencidas')

  const resumo = useMemo(() => {
    const total = filtrados.reduce((s, i) => s + i.valor, 0)
    const postos = new Set(filtrados.map((i) => i.posto)).size
    const porCat = new Map<string, number>()
    for (const i of filtrados) porCat.set(i.catLabel, (porCat.get(i.catLabel) ?? 0) + i.valor)
    return { total, postos, cats: [...porCat.entries()].sort((a, b) => b[1] - a[1]) }
  }, [filtrados])

  const maxGrupo = grupos[0]?.total ?? 0

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent guia={podeTarefa ? GUIAS.contasListaTarefa : GUIAS.contasLista} className={cn(MODAL_CLS, 'w-[96vw] max-w-7xl')}>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {sel.titulo}
            <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', TOM[sel.tom])}>{sel.selo}</span>
          </DialogTitle>
          <DialogDescription>
            {sel.subtitulo} · <b className="text-gray-700 dark:text-gray-200">{formatCurrencyInt(resumo.total)}</b> em {docs(filtrados.length)}{resumo.postos > 1 ? ` · ${resumo.postos} postos` : ''}
          </DialogDescription>
          {resumo.cats.length > 1 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {resumo.cats.map(([c, v]) => (
                <span key={c} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">{c} <b className="tabular-nums">{formatCurrencyInt(v)}</b></span>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-2 px-6">
          <FiltrosDiaModal<Ordem>
            inicio={(
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
            {([['nomes', 'Por nome', Users], ['titulos', 'Título a título', ListOrdered]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setModo(id)}
                className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors', modo === id ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-600' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white')}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
            )}
            busca={busca} onBusca={(v) => { setBusca(v); setLimite(PAGINA) }} placeholder="Buscar nome, posto ou documento…"
            postos={postos} posto={posto} onPosto={(v) => { setPosto(v); setLimite(PAGINA) }}
            extra={{ label: 'Categoria', opcoes: cats, valor: cat, onChange: (v) => { setCat(v); setLimite(PAGINA) } }}
            ordem={ordem} onOrdem={setOrdem} ordens={ORDENS}
            mostrando={filtrados.length} total={itens.length} onLimpar={() => { setBusca(''); setPosto(''); setCat(''); setLimite(PAGINA) }}
          />
          {busca && modo === 'titulos' && (
            <button type="button" onClick={() => { setBusca(''); setModo('nomes') }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e3a5f] hover:underline dark:text-blue-300"><ChevronLeft className="h-3.5 w-3.5" /> todos os nomes</button>
          )}
          {podeTarefa && (
            <BarraTarefaTitulos tipo={sel.lado} dia={null} selecionados={selecionados} vencido={temVencido} onLimpar={() => setMarcados(new Set())} />
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 pb-2">
          {filtrados.length === 0 ? (
            <p className="py-10 text-center text-xs text-gray-400">Nada encontrado.</p>
          ) : modo === 'nomes' ? (
            <table className="w-full min-w-[640px] text-[12px]">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-gray-400 dark:bg-gray-900">
                <tr>
                  {podeTarefa && (
                    <th className="w-8 py-2 pr-2 text-left">
                      <Caixa rotulo="Selecionar todos os títulos visíveis" checked={todos} parcial={alguns} onChange={() => marcar(idsVisiveis, !todos)} />
                    </th>
                  )}
                  <th className="py-2 pr-3 text-left font-semibold">{sel.lado === 'pagar' ? 'Fornecedor' : 'Cliente / administradora'}</th>
                  <th className="px-3 py-2 text-left font-semibold">Postos</th>
                  <th className="px-3 py-2 text-right font-semibold">Títulos</th>
                  <th className="px-3 py-2 text-right font-semibold">Mais antigo</th>
                  <th className="py-2 pl-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {grupos.slice(0, limite).map((g) => {
                  const nMarc = g.ids.filter((id) => marcados.has(id)).length
                  const cheio = nMarc === g.ids.length
                  return (
                  <tr key={g.nome} className={cn('cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5', nMarc > 0 && 'bg-teal-50/60 dark:!bg-[#0d9488]/[0.10]')} onClick={() => { setBusca(g.nome); setModo('titulos'); setLimite(PAGINA) }} title="Ver os títulos deste nome">
                    {podeTarefa && (
                      <td className="w-8 py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                        <Caixa rotulo={`Selecionar os títulos de ${g.nome}`} checked={cheio} parcial={nMarc > 0} onChange={() => marcar(g.ids, !cheio)} />
                      </td>
                    )}
                    <td className="py-2 pr-3">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{g.nome}</p>
                      <p className="text-[10px] text-gray-400">{[...g.cats].join(' · ')}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{g.postos.size === 1 ? [...g.postos][0] : `${g.postos.size} postos`}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{g.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{brDateShort(g.maisAntigo)} <span className="text-[10px] text-gray-400">{relDias(g.maisAntigo, hoje)}</span></td>
                    <td className="py-2 pl-3 text-right">
                      <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(g.total)}</span>
                      <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><span className="block h-full rounded-full bg-[#1e3a5f] dark:bg-blue-500" style={{ width: `${maxGrupo > 0 ? Math.max(2, (g.total / maxGrupo) * 100) : 0}%` }} /></span>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[640px] text-[12px]">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-gray-400 dark:bg-gray-900">
                <tr>
                  {podeTarefa && (
                    <th className="w-8 py-2 pr-2 text-left">
                      <Caixa rotulo="Selecionar todos os títulos visíveis" checked={todos} parcial={alguns} onChange={() => marcar(idsVisiveis, !todos)} />
                    </th>
                  )}
                  <th className="py-2 pr-3 text-left font-semibold">{sel.lado === 'pagar' ? 'Fornecedor' : 'Cliente / administradora'}</th>
                  <th className="px-3 py-2 text-left font-semibold">Posto</th>
                  <th className="px-3 py-2 text-left font-semibold">Documento</th>
                  <th className="px-3 py-2 text-right font-semibold">Vencimento</th>
                  <th className="py-2 pl-3 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtrados.slice(0, limite).map((i) => {
                  const vencido = i.horizonte === 'vencidas'
                  return (
                    <tr key={i.id} className={cn(podeTarefa && 'cursor-pointer', marcados.has(i.id) && 'bg-teal-50/60 dark:!bg-[#0d9488]/[0.10]')} onClick={podeTarefa ? () => marcar([i.id], !marcados.has(i.id)) : undefined}>
                      {podeTarefa && (
                        <td className="w-8 py-2 pr-2">
                          <Caixa rotulo="Selecionar título" checked={marcados.has(i.id)} onChange={() => marcar([i.id], !marcados.has(i.id))} />
                        </td>
                      )}
                      <td className="py-2 pr-3">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{i.nome}</p>
                        <p className="text-[10px] text-gray-400">{i.detalhe}</p>
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{i.posto}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium dark:bg-gray-800">{i.catLabel}</span> <span className="tabular-nums">{i.documento}</span></td>
                      <td className={cn('px-3 py-2 text-right tabular-nums', vencido ? (sel.lado === 'receber' ? 'font-semibold text-orange-600 dark:text-orange-400' : 'font-semibold text-red-600 dark:text-red-400') : 'text-gray-600 dark:text-gray-300')}>
                        {brDateShort(i.venc)} <span className="text-[10px] font-normal text-gray-400">{relDias(i.venc, hoje)}</span>
                      </td>
                      <td className="py-2 pl-3 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrency(i.valor)}
                        {i.bruto != null && i.bruto > i.valor && <span className="block text-[10px] font-normal text-gray-400">bruto {formatCurrency(i.bruto)}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {(modo === 'nomes' ? grupos.length : filtrados.length) > limite && (
            <div className="py-3 text-center">
              <button type="button" onClick={() => setLimite((l) => l + PAGINA)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5">
                Mostrar mais ({(modo === 'nomes' ? grupos.length : filtrados.length) - limite} restantes)
              </button>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-6 py-3 text-[11px] text-gray-400 dark:border-gray-800">
          <span>{sel.lado === 'receber' ? 'Cartões e apps pelo líquido estimado (bruto menos taxa). ' : 'Saldo = valor + acréscimo − desconto − pago. '}Fonte: pendentes no ERP.</span>
          <Link to={linkFinanceiro(sel.lado, { ...sel.filtro, q: busca, rotulo: sel.selo })} onClick={onClose} className="inline-flex items-center gap-1 font-semibold text-[#1e3a5f] hover:underline dark:text-blue-300">Abrir em Contas a {sel.lado === 'pagar' ? 'pagar' : 'receber'} <ArrowRight className="h-3.5 w-3.5" /></Link>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

export default ContasListaModal
