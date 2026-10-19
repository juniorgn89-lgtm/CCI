import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Trash2, Loader2, Send, Save, Check, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { Modal, ModalRodape, Erro, Segmentos } from '@/pages/Gestao/comumUi'
import { SETOR_LABEL, STATUS_TRANSF_LABEL, criarTransferencia, editarTransferencia, fetchTransfItens, type SetorCompra, type TransferenciaRow, type TransfItemInput } from '@/api/supabase/compras'
import { useComprasBase, inputCls, selectCls, labelCls, btnPrimary, btnGhost, nomeProprio } from './comum'
import { GUIAS } from '@/lib/guiasModais'
import { useSugestoes, type Sugestao } from './hooks/useSugestoes'

interface ItemLocal extends TransfItemInput { key: string }
const SETORES: { value: SetorCompra; label: string }[] = (['conveniencia', 'automotivos', 'outros'] as SetorCompra[]).map((s) => ({ value: s, label: s === 'outros' ? 'Todos' : SETOR_LABEL[s] }))
const fmtQ = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })

/**
 * Nova transferência: destino (quem precisa) e origem (quem tem sobrando).
 * A sugestão cruza as duas pontas: produto abaixo da cobertura no destino e
 * com folga na origem vem primeiro, com a conta dos dois lados.
 */
const NovaTransferenciaModal = ({ open, onClose, transferencia, onSalvo }: { open: boolean; onClose: () => void; transferencia: TransferenciaRow | null; onSalvo: () => void }) => {
  const base = useComprasBase()
  const itensQ = useQuery({ queryKey: ['compras-transf-itens', transferencia?.id], queryFn: () => fetchTransfItens(transferencia!.id), enabled: !!transferencia })
  if (transferencia && itensQ.isLoading) return <Modal fundo="" open={open} onClose={onClose} titulo={`Editar transferência nº ${transferencia.numero}`} largura="max-w-4xl"><p className="inline-flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p></Modal>
  return <Form key={transferencia?.id ?? 'nova'} open={open} onClose={onClose} transferencia={transferencia} itensIniciais={(itensQ.data ?? []).map((i) => ({ key: i.id, produto_codigo: i.produto_codigo, produto_nome: i.produto_nome, unidade: i.unidade, qtd: i.qtd, custo_ref: i.custo_ref, justificativa: i.justificativa }))} onSalvo={onSalvo} base={base} />
}

const Form = ({ open, onClose, transferencia, itensIniciais, onSalvo, base }: { open: boolean; onClose: () => void; transferencia: TransferenciaRow | null; itensIniciais: ItemLocal[]; onSalvo: () => void; base: ReturnType<typeof useComprasBase> }) => {
  const postos = base.postos
  const [destino, setDestino] = useState<number | null>(transferencia?.destino_codigo ?? postos[0]?.codigo ?? null)
  const [origem, setOrigem] = useState<number | null>(transferencia?.origem_codigo ?? postos.find((p) => p.codigo !== (transferencia?.destino_codigo ?? postos[0]?.codigo))?.codigo ?? null)
  const [setor, setSetor] = useState<SetorCompra>('conveniencia')
  const [itens, setItens] = useState<ItemLocal[]>(itensIniciais)
  const [obs, setObs] = useState(transferencia?.observacoes ?? '')
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<'rascunho' | 'solicitar' | null>(null)

  const dest = useSugestoes(destino, setor)
  const orig = useSugestoes(origem, setor)
  const origemPor = useMemo(() => new Map(orig.catalogo.map((s) => [s.produtoCodigo, s])), [orig.catalogo])
  const noPedido = useMemo(() => new Set(itens.map((i) => i.produto_codigo)), [itens])

  /** Cruza: precisa no destino × sobra na origem. */
  const cruzadas = useMemo(() => dest.sugestoes.map((d) => {
    const o = origemPor.get(d.produtoCodigo)
    const sobraOrigem = o ? Math.max(0, o.saldo - Math.max(o.minimo, o.vendaDia * 30)) : 0
    const podeMandar = Math.min(d.qtdSugerida, Math.floor(sobraOrigem))
    return { d, o, sobraOrigem, podeMandar }
  }).sort((a, b) => (b.podeMandar > 0 ? 1 : 0) - (a.podeMandar > 0 ? 1 : 0) || a.d.prioridade - b.d.prioridade), [dest.sugestoes, origemPor])

  const adicionar = (s: Sugestao, qtd: number) => {
    if (noPedido.has(s.produtoCodigo) || qtd <= 0) return
    const o = origemPor.get(s.produtoCodigo)
    setItens((xs) => [...xs, { key: `p${s.produtoCodigo}`, produto_codigo: s.produtoCodigo, produto_nome: s.nome, unidade: s.unidade, qtd, custo_ref: Number(s.custo.toFixed(2)), justificativa: `destino: ${s.justificativa}${o ? ` · origem: estoque ${fmtQ(o.saldo)}, cobre ${fmtQ(o.diasCobertura)} dias` : ''}` }])
  }
  const mudar = (key: string, patch: Partial<ItemLocal>) => setItens((xs) => xs.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  const remover = (key: string) => setItens((xs) => xs.filter((i) => i.key !== key))
  const total = itens.reduce((s, i) => s + i.qtd * i.custo_ref, 0)
  const podeSalvar = origem != null && destino != null && origem !== destino && itens.length > 0 && itens.every((i) => i.qtd > 0)

  const salvar = async (solicitar: boolean) => {
    if (!base.redeId || origem == null || destino == null) return
    setErro(null); setSalvando(solicitar ? 'solicitar' : 'rascunho')
    try {
      const input = { origem_codigo: origem, destino_codigo: destino, observacoes: obs.trim() || null, itens: itens.map(({ key: _k, ...i }) => { void _k; return i }) }
      if (transferencia) await editarTransferencia(transferencia, input, base.autor, solicitar)
      else await criarTransferencia(base.redeId, input, base.autor, solicitar)
      onSalvo()
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(null) }
  }
  const resultados = busca.trim() ? orig.buscar(busca) : []
  const Dot = ({ s }: { s: Sugestao['status'] }) => <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', s === 'critico' ? 'bg-red-500' : s === 'baixo' ? 'bg-amber-500' : s === 'ok' ? 'bg-emerald-500' : 'bg-gray-300')} />

  return (
    <Modal guia={GUIAS.novaTransferencia} fundo="" open={open} onClose={onClose} titulo={transferencia ? `Editar transferência nº ${transferencia.numero}` : 'Nova transferência entre postos'} descricao={transferencia ? `Situação atual: ${STATUS_TRANSF_LABEL[transferencia.status]}.` : 'Escolha quem recebe e quem manda; o Visor cruza o que falta num posto com o que sobra no outro.'} largura="max-w-4xl">
      <div className="space-y-4">
        <Erro msg={erro} />
        <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr_auto]">
          <label>
            <span className={labelCls}>Origem (quem manda)</span>
            <select value={origem ?? ''} onChange={(e) => { setOrigem(Number(e.target.value) || null); setItens([]) }} className={selectCls}>
              {postos.map((p) => <option key={p.codigo} value={p.codigo} disabled={p.codigo === destino}>{p.fantasia || p.razao}</option>)}
            </select>
          </label>
          <ArrowRight className="mb-2.5 hidden h-5 w-5 text-gray-400 md:block" />
          <label>
            <span className={labelCls}>Destino (quem recebe)</span>
            <select value={destino ?? ''} onChange={(e) => { setDestino(Number(e.target.value) || null); setItens([]) }} className={selectCls}>
              {postos.map((p) => <option key={p.codigo} value={p.codigo} disabled={p.codigo === origem}>{p.fantasia || p.razao}</option>)}
            </select>
          </label>
          <div>
            <span className={labelCls}>Setor</span>
            <Segmentos opcoes={SETORES} valor={setor} onChange={(v) => setSetor(v)} />
          </div>
        </div>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700">
          <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <p className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-900 dark:text-gray-100">O que o destino precisa e a origem tem <InfoHint text="Produtos abaixo da cobertura de 30 dias no destino. Para cada um, quanto a origem pode mandar sem ficar descoberta: saldo da origem menos o maior entre o mínimo cadastrado e 30 dias de venda dela. Produtos sem folga na origem aparecem por último, só para informação." /></p>
            {!dest.carregando && !orig.carregando && <span className="text-[11px] text-gray-400">{cruzadas.filter((c) => c.podeMandar > 0).length} com folga na origem</span>}
            {cruzadas.some((c) => c.podeMandar > 0) && <button type="button" onClick={() => cruzadas.filter((c) => c.podeMandar > 0).forEach((c) => adicionar(c.d, c.podeMandar))} className="ml-auto text-[11.5px] font-semibold text-[#1e3a5f] hover:underline dark:text-blue-300">Adicionar todas com folga</button>}
          </header>
          {origem == null || destino == null ? <p className="px-4 py-4 text-[12px] text-gray-400">Escolha origem e destino.</p>
            : dest.carregando || orig.carregando ? <p className="inline-flex items-center gap-2 px-4 py-4 text-[12px] text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Lendo estoque e vendas dos dois postos…</p>
            : cruzadas.length === 0 ? <p className="px-4 py-4 text-[12px] text-gray-500">O destino não tem produto abaixo da cobertura neste setor.</p>
            : (
              <ul className="max-h-72 divide-y divide-gray-100 overflow-auto dark:divide-gray-800">
                {cruzadas.slice(0, 40).map(({ d, o, podeMandar }) => {
                  const ja = noPedido.has(d.produtoCodigo)
                  return (
                    <li key={d.produtoCodigo} className={cn('flex items-center gap-3 px-4 py-2', podeMandar <= 0 && 'opacity-60')}>
                      <Dot s={d.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{nomeProprio(d.nome)}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Destino: {d.justificativa}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Origem: {o ? `estoque ${fmtQ(o.saldo)}${o.minimo > 0 ? ` (mínimo ${fmtQ(o.minimo)})` : ''}${o.vendaDia > 0 ? ` · vende ${fmtQ(o.vendaDia)} por dia · cobre ${fmtQ(o.diasCobertura)} dias` : ' · sem venda'} · ${podeMandar > 0 ? `pode mandar ${fmtQ(podeMandar)}` : 'sem folga'}` : 'produto não aparece no estoque da origem'}</p>
                      </div>
                      <button type="button" onClick={() => adicionar(d, podeMandar > 0 ? podeMandar : Math.max(1, d.qtdSugerida))} disabled={ja} className={cn('inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-semibold', ja ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800')}>{ja ? <><Check className="h-3 w-3" /> Na lista</> : <><Plus className="h-3 w-3" /> {podeMandar > 0 ? `Mandar ${fmtQ(podeMandar)}` : 'Adicionar'}</>}</button>
                    </li>
                  )
                })}
              </ul>
            )}
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700">
          <header className="border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar qualquer produto no estoque da origem" className={cn(inputCls, 'h-9 pl-9')} disabled={origem == null || orig.carregando} /></span>
          </header>
          {busca.trim() && (resultados.length === 0 ? <p className="px-4 py-3 text-[12px] text-gray-400">Nada com esse nome na origem.</p> : (
            <ul className="max-h-56 divide-y divide-gray-100 overflow-auto dark:divide-gray-800">
              {resultados.map((s) => {
                const ja = noPedido.has(s.produtoCodigo)
                return (
                  <li key={s.produtoCodigo} className="flex items-center gap-3 px-4 py-2">
                    <Dot s={s.status} />
                    <div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{nomeProprio(s.nome)} <span className="text-[10px] font-normal text-gray-400">#{s.produtoCodigo}</span></p><p className="text-[11px] text-gray-500 dark:text-gray-400">Origem: {s.justificativa}</p></div>
                    <button type="button" onClick={() => adicionar(s, 1)} disabled={ja} className={cn('inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-semibold', ja ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800')}>{ja ? <><Check className="h-3 w-3" /> Na lista</> : <><Plus className="h-3 w-3" /> Adicionar</>}</button>
                  </li>
                )
              })}
            </ul>
          ))}
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700">
          <header className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100">Itens ({itens.length})</p>
            <span className="ml-auto text-[12px] tabular-nums text-gray-600 dark:text-gray-300">Valor de referência <b className="font-semibold text-gray-900 dark:text-white">{formatCurrency(total)}</b> <InfoHint text="Só para medir o tamanho da transferência: quantidade × custo cadastrado. Não há compra nem venda entre os postos aqui." /></span>
          </header>
          {itens.length === 0 ? <p className="px-4 py-4 text-[12px] text-gray-400">Adicione itens pela lista acima ou pela busca.</p> : (
            <table className="w-full text-[12.5px]">
              <thead className="text-[10px] uppercase tracking-wider text-gray-400"><tr><th className="px-4 py-1.5 text-left font-semibold">Produto</th><th className="px-2 py-1.5 text-right font-semibold">Qtd</th><th className="px-2 py-1.5 text-right font-semibold">Custo ref.</th><th className="px-3 py-1.5" /></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {itens.map((i) => (
                  <tr key={i.key}>
                    <td className="px-4 py-1.5"><p className="font-medium text-gray-900 dark:text-gray-100">{nomeProprio(i.produto_nome)}</p>{i.justificativa && <p className="text-[10.5px] text-gray-400">{i.justificativa}</p>}</td>
                    <td className="px-2 py-1.5 text-right"><input inputMode="decimal" value={String(i.qtd)} onChange={(e) => mudar(i.key, { qtd: Number(e.target.value.replace(',', '.')) || 0 })} className={cn(inputCls, 'h-8 w-20 px-2 text-right tabular-nums')} /></td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatCurrency(i.custo_ref)}</td>
                    <td className="px-3 py-1.5 text-right"><button type="button" onClick={() => remover(i.key)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <label><span className={labelCls}>Observações</span><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Quem leva, quando, recado para a origem…" className={inputCls} /></label>
      </div>
      <ModalRodape>
        <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
        <button type="button" onClick={() => salvar(false)} disabled={!podeSalvar || !!salvando} className={btnGhost}>{salvando === 'rascunho' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar rascunho</button>
        <button type="button" onClick={() => salvar(true)} disabled={!podeSalvar || !!salvando} className={btnPrimary}>{salvando === 'solicitar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Solicitar à origem</button>
      </ModalRodape>
    </Modal>
  )
}

export default NovaTransferenciaModal
