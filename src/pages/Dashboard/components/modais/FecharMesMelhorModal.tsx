import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePodeCriarTarefa } from '@/pages/Financeiro/components/shared/tarefaTitulos'
import useUltimaCompra from '@/pages/Estoques/hooks/useUltimaCompra'
import { montarTarefaDestravar } from '@/pages/Estoques/lib/tarefaPreco'
import { Link, useNavigate } from 'react-router-dom'
import { useFilterStore } from '@/store/filters'
import { ArrowLeft, ArrowRight, Droplets, Wrench, Store, Loader2, PackageOpen, Gift, Info, Fuel, ChevronDown, Check, Search, ClipboardPlus, CheckCircle2, X } from 'lucide-react'

// O formulário é o mesmo do módulo Tarefas (carrega só quando abrir).
const TarefaForm = lazy(() => import('@/pages/Gestao/Tarefas').then((m) => ({ default: m.TarefaForm })))
import { nomeLegivel } from '@/lib/nomeLegivel'
import PainelLateral from '@/components/ui/PainelLateral'
import { GUIAS } from '@/lib/guiasModais'
import InfoHint from '@/components/ui/InfoHint'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { todayLocal } from '@/lib/period'
import useEstoqueAnalytics from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import useSetorProduto from '@/pages/Estoques/hooks/useSetorProduto'
import { fmtUnidades, fmtDataBR } from '@/pages/Estoques/components/estoqueComum'
import useCestasVenda, { DIAS_CESTAS } from '@/pages/Dashboard/hooks/useCestasVenda'
import { travadosDe, montarKits, DIAS_ENCALHANDO, MIN_CUPONS, type Setor, type Kit, type Travado } from '@/pages/Dashboard/lib/destravarEstoque'

type Etapa = 'escolha' | Setor

interface Props {
  open: boolean
  onClose: () => void
  /** Lucro bruto previsto no fechamento, por setor (o mesmo do cartão). Sem ela, a janela não mostra a escolha. */
  previsao?: { combustivel: number; automotivos: number; conveniencia: number }
  /** Abre direto num setor (telas de Automotivos e Conveniência). */
  setorInicial?: Setor
  diasRestantes: number
  radarVisivel: boolean
  postos: { codigo: number; nome: string }[]
}

const SETOR_UI: Record<Setor, { nome: string; Icon: typeof Wrench }> = {
  automotivos: { nome: 'Automotivos', Icon: Wrench },
  conveniencia: { nome: 'Conveniência', Icon: Store },
}

/**
 * "Como fechar o mês ainda melhor?": a previsão soma os três setores, então a
 * ajuda também tem três caminhos — combustível (Radar de Preços) e, para
 * automotivos e conveniência, destravar o estoque parado com kits.
 */
const FecharMesMelhorModal = ({ open, onClose, previsao, setorInicial, diasRestantes, radarVisivel, postos }: Props) => {
  // Quem usa monta a janela só quando abre: cada abertura começa na escolha.
  const [etapa, setEtapa] = useState<Etapa>(setorInicial ?? (previsao ? 'escolha' : 'automotivos'))
  const [posto, setPosto] = useState<number | null>(postos[0]?.codigo ?? null)
  const podeTarefa = usePodeCriarTarefa()

  const titulo = etapa === 'escolha' ? 'Como fechar o mês ainda melhor?' : `${SETOR_UI[etapa].nome}: destravar o estoque`
  const subtitulo = etapa === 'escolha'
    ? 'A previsão soma os três setores. Escolha por onde começar.'
    : 'Produtos que pararam de vender e kits para fazê-los girar até o fim do mês.'

  return (
    <PainelLateral open={open} onClose={onClose} titulo={titulo} subtitulo={subtitulo} largura="max-w-[920px]"
      guia={etapa === 'escolha' ? GUIAS.fecharMesMelhor : podeTarefa ? GUIAS.destravarEstoqueTarefa : GUIAS.destravarEstoque}>
      {etapa === 'escolha'
        ? (previsao ? <Escolha previsao={previsao} diasRestantes={diasRestantes} radarVisivel={radarVisivel} onSetor={setEtapa} onClose={onClose} /> : null)
        : <Destravar key={etapa} setor={etapa} onSetor={setEtapa} radarVisivel={radarVisivel} onClose={onClose} postos={postos} posto={posto} onPosto={setPosto} diasRestantes={diasRestantes} onVoltar={previsao ? () => setEtapa('escolha') : undefined} />}
    </PainelLateral>
  )
}

// ─── Escolha do setor ─────────────────────────────────────────────────────────

const Escolha = ({ previsao, diasRestantes, radarVisivel, onSetor, onClose }: {
  previsao: NonNullable<Props['previsao']>; diasRestantes: number; radarVisivel: boolean; onSetor: (s: Setor) => void; onClose: () => void
}) => {
  const total = previsao.combustivel + previsao.automotivos + previsao.conveniencia
  const cartao = 'group flex w-full items-start gap-3.5 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-[#0d9488]/60 hover:bg-teal-50/40 dark:border-[#2f3b4f] dark:bg-[#0f172a] dark:hover:border-[#2dd4bf]/50 dark:hover:bg-[#0d9488]/[0.06]'
  const icone = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'
  return (
    <div className="space-y-3">
      {radarVisivel ? (
        <Link to="/comercial?tab=radar" onClick={onClose} className={cartao}>
          <span className={cn(icone, 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300')}><Droplets className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2"><b className="text-[15px] text-gray-900 dark:text-white">Combustível</b><Peso v={previsao.combustivel} total={total} /></span>
            <span className="mt-1 block text-[13px] text-gray-600 dark:text-gray-300">Ver no Radar de Preços em qual posto dá para subir o preço, segurar ou ceder nos {diasRestantes} dias que faltam.</span>
            <span className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#0d9488] dark:text-[#5eead4]">Abrir o Radar de Preços <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
          </span>
        </Link>
      ) : (
        <div className={cn(cartao, 'cursor-default opacity-70 hover:border-gray-200 hover:bg-white dark:hover:border-[#2f3b4f] dark:hover:bg-[#0f172a]')}>
          <span className={cn(icone, 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300')}><Droplets className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2"><b className="text-[15px] text-gray-900 dark:text-white">Combustível</b><Peso v={previsao.combustivel} total={total} /></span>
            <span className="mt-1 block text-[13px] text-gray-600 dark:text-gray-300">O Radar de Preços não está liberado no seu acesso. Peça ao administrador da rede.</span>
          </span>
        </div>
      )}
      {(['automotivos', 'conveniencia'] as Setor[]).map((s) => {
        const { nome, Icon } = SETOR_UI[s]
        return (
          <button key={s} type="button" onClick={() => onSetor(s)} className={cartao}>
            <span className={cn(icone, s === 'automotivos' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300')}><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2"><b className="text-[15px] text-gray-900 dark:text-white">{nome}</b><Peso v={previsao[s]} total={total} /></span>
              <span className="mt-1 block text-[13px] text-gray-600 dark:text-gray-300">Ver os produtos que pararam de vender, quanto dinheiro está parado neles e kits para fazê-los sair junto com o que já vende bem.</span>
              <span className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#0d9488] dark:text-[#5eead4]">Ver produtos parados e kits <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

const Peso = ({ v, total }: { v: number; total: number }) => (
  <span className="text-[12px] text-gray-500 dark:text-gray-400">
    <b className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">{formatCurrencyInt(v)}</b> previstos · {total > 0 ? Math.round((v / total) * 100) : 0}% do mês
  </span>
)

// ─── Destravar estoque (automotivos / conveniência) ──────────────────────────

const KITS_INICIAIS = 6
const TRAVADOS_INICIAIS = 12

const Destravar = ({ setor, onSetor, radarVisivel, onClose, postos, posto, onPosto, diasRestantes, onVoltar }: {
  setor: Setor; onSetor: (s: Setor) => void; radarVisivel: boolean; onClose: () => void; postos: Props['postos']
  posto: number | null; onPosto: (c: number) => void; diasRestantes: number; onVoltar?: () => void
}) => {
  // Caixinhas: kits (pelo código do produto parado) e produtos travados → uma tarefa.
  const podeTarefa = usePodeCriarTarefa()
  const [kitsMarcados, setKitsMarcados] = useState<Set<number>>(() => new Set())
  const [travMarcados, setTravMarcados] = useState<Set<number>>(() => new Set())
  const [tarefaAberta, setTarefaAberta] = useState(false)
  const [tarefaOk, setTarefaOk] = useState<string | null>(null)
  const qc = useQueryClient()
  const alternar = (set: (f: (m: Set<number>) => Set<number>) => void) => (c: number) => set((m) => { const n = new Set(m); if (n.has(c)) n.delete(c); else n.add(c); return n })
  const alternarKit = alternar(setKitsMarcados)
  const alternarTrav = alternar(setTravMarcados)
  const limparSelecao = () => { setKitsMarcados(new Set()); setTravMarcados(new Set()) }
  const [todosKits, setTodosKits] = useState(false)
  const [todosTravados, setTodosTravados] = useState(false)
  const navigate = useNavigate()
  const setEmpresas = useFilterStore((st) => st.setEmpresas)
  // Abre o Estoques no MESMO posto, setor e lista (situação "Travados", mesma regra desta tela).
  const abrirNoEstoques = () => {
    if (posto == null) return
    setEmpresas([posto])
    onClose()
    navigate(`/estoques?tab=produtos&setor=${setor}&situacao=travados`)
  }
  const trocarPosto = (c: number) => { onPosto(c); setTodosKits(false); setTodosTravados(false); limparSelecao(); setTarefaOk(null) }

  const hoje = todayLocal()
  const est = useEstoqueAnalytics(30, 30, posto)
  const { setorDe, carregando: carregandoSetor } = useSetorProduto()
  const cestas = useCestasVenda(posto)
  const { porProduto: ultimaCompra } = useUltimaCompra(posto)

  const noSetor = useMemo(() => (c: number) => setorDe(c) === setor, [setorDe, setor])
  const travados = useMemo(() => travadosDe(est.productAnalytics, noSetor, hoje), [est.productAnalytics, noSetor, hoje])
  const kits = useMemo(
    () => (cestas.data ? montarKits({ travados, rows: est.productAnalytics, noSetor, cestas: cestas.data.cestas, diasRestantes }) : []),
    [cestas.data, travados, est.productAnalytics, noSetor, diasRestantes],
  )

  const carregando = est.isLoading || carregandoSetor
  const empatado = travados.reduce((s, t) => s + t.empatado, 0)
  // O total conta só kits com cupom que comprove; sugestão fica fora (anti-enganação).
  const comprovados = kits.filter((k) => k.fonte !== 'sugestao')
  const lucroMes = comprovados.reduce((s, k) => s + k.lucroMes, 0)
  const caixaMes = comprovados.reduce((s, k) => s + k.caixaMes, 0)
  const nomeSetor = SETOR_UI[setor].nome.toLowerCase()
  const sugestoes = kits.filter((k) => k.fonte === 'sugestao')
  const lucroSugestoes = sugestoes.reduce((s, k) => s + k.lucroMes, 0)
  const nomePosto = postos.find((p) => p.codigo === posto)?.nome ?? ''
  const nSel = kitsMarcados.size + travMarcados.size

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {onVoltar && <button type="button" onClick={onVoltar} className="inline-flex h-10 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-[#2f3b4f] dark:text-gray-200 dark:hover:bg-white/5">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>}
        {postos.length > 0 && <SeletorPosto postos={postos} valor={posto} onChange={trocarPosto} />}
        <TrocaSetor setor={setor} onSetor={onSetor} radarVisivel={radarVisivel} onClose={onClose} />
      </div>

      {posto == null ? (
        <p className="text-[13px] text-gray-500">Nenhum posto no filtro.</p>
      ) : carregando ? (
        <Carregando texto="Lendo o estoque e as vendas dos últimos 6 meses deste posto…" />
      ) : travados.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          Nenhum produto de {nomeSetor} parado ou encalhando neste posto. O estoque está girando.
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Numero rotulo="Produtos travados" valor={String(travados.length)} ajuda={`Com saldo e sem venda há mais de 90 dias, ou vendendo devagar com estoque para mais de ${DIAS_ENCALHANDO} dias.`} />
            <Numero rotulo="Dinheiro parado na prateleira" valor={formatCurrencyInt(empatado)} ajuda="Quanto você pagou pelos produtos travados que ainda estão no estoque (quantidade × custo). É dinheiro que já saiu do caixa e só volta quando o produto vender." />
            <Numero
              rotulo="A mais no mês com os kits"
              valor={cestas.isLoading ? '…' : comprovados.length > 0 ? `até ${formatCurrencyInt(lucroMes)}` : 'Nenhum comprovado'}
              nota={!cestas.isLoading && sugestoes.length > 0 ? `Sugestões: até ${formatCurrencyInt(lucroSugestoes)}, sem cupom que comprove` : undefined}
              destaque
              ajuda={`Soma do lucro a mais dos kits comprovados por cupom (as sugestões ficam fora), se cada cliente que levar o produto parceiro até o fim do mês levar o kit. É o teto, não uma promessa. Volta para o caixa: até ${formatCurrencyInt(caixaMes)}.`}
            />
          </div>

          {/* Kits */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Gift className="h-4 w-4" /> Kits para montar
              <InfoHint text={`O par de cada kit vem dos cupons dos últimos ${DIAS_CESTAS} dias deste posto (só vendas autorizadas): primeiro, o que já sai junto com o produto; depois, o que leva quem compra a mesma categoria. Sem cupom que comprove, o kit aparece como sugestão. O desconto vai no produto parado e nunca passa de 60% da margem dele.`} />
            </h3>
            {cestas.isLoading ? (
              <Carregando texto={`Lendo os cupons dos últimos ${DIAS_CESTAS} dias para achar o que sai junto…`} />
            ) : cestas.isError ? (
              <p className="rounded-lg bg-amber-50 p-3 text-[12.5px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Não deu para ler os cupons agora. A lista de produtos travados abaixo continua valendo; tente de novo em instantes.</p>
            ) : kits.length === 0 ? (
              <p className="text-[13px] text-gray-500 dark:text-gray-400">Sem kit possível: os produtos travados não têm preço e custo no cadastro, ou nenhum outro produto de {nomeSetor} está vendendo neste posto.</p>
            ) : (
              <div className="space-y-2.5">
                {(todosKits ? kits : kits.slice(0, KITS_INICIAIS)).map((k, i, arr) => (
                  <div key={k.t.r.produtoCodigo}>
                    {k.fonte === 'sugestao' && (i === 0 || arr[i - 1].fonte !== 'sugestao') && (
                      <p className="mb-2 mt-4 text-[12px] font-semibold text-gray-500 dark:text-gray-400">Sugestões sem cupom que comprove <span className="font-normal">· mesmo tipo de produto; não entram no total</span></p>
                    )}
                    <CartaoKit k={k} diasRestantes={diasRestantes} marcado={podeTarefa ? kitsMarcados.has(k.t.r.produtoCodigo) : undefined} onMarcar={() => alternarKit(k.t.r.produtoCodigo)} />
                  </div>
                ))}
                {kits.length > KITS_INICIAIS && (
                  <button type="button" onClick={() => setTodosKits((v) => !v)} className="text-[12.5px] font-semibold text-[#2563eb] hover:underline dark:text-blue-300">
                    {todosKits ? 'Mostrar menos' : `Ver os ${kits.length} kits`}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Travados */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <PackageOpen className="h-4 w-4" /> Produtos travados <span className="font-normal normal-case tracking-normal">· os que mais prendem dinheiro aparecem primeiro</span>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-[#2f3b4f]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
                  <tr>
                    {podeTarefa && <th className="w-8 py-2 pl-3"><span className="sr-only">Marcar</span></th>}
                    <th className="px-3 py-2 text-left font-semibold">Produto</th>
                    <th className="px-3 py-2 text-left font-semibold">Situação</th>
                    <th className="px-3 py-2 text-right font-semibold">Saldo</th>
                    <th className="px-3 py-2 text-right font-semibold">Dinheiro parado <InfoHint text="Quanto você pagou por este produto que ainda está no estoque (quantidade × custo). Só volta para o caixa quando ele vender." /></th>
                    <th className="px-3 py-2 text-right font-semibold">Lucro se vender</th>
                  </tr>
                </thead>
                <tbody>
                  {(todosTravados ? travados : travados.slice(0, TRAVADOS_INICIAIS)).map((t) => (
                    <tr key={t.r.produtoCodigo} className={cn('border-t border-gray-100 dark:border-white/[0.05]', travMarcados.has(t.r.produtoCodigo) && 'bg-teal-50/50 dark:bg-[#0d9488]/[0.07]')}>
                      {podeTarefa && <td className="py-2 pl-3"><Caixa marcado={travMarcados.has(t.r.produtoCodigo)} onChange={() => alternarTrav(t.r.produtoCodigo)} rotulo="Marcar este produto" /></td>}
                      <td className="px-3 py-2">
                        <span className="block font-medium text-gray-900 dark:text-gray-100">{t.r.produtoNome}</span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400"><Ref r={t.r} />{t.r.categoria}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2"><Situacao t={t} /></td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtUnidades(t.r.saldoAtual)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(t.empatado)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{t.lucroSeVender > 0 ? formatCurrencyInt(t.lucroSeVender) : <span className="text-gray-400">sem preço/custo</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {travados.length > TRAVADOS_INICIAIS ? (
                <button type="button" onClick={() => setTodosTravados((v) => !v)} className="text-[12.5px] font-semibold text-[#2563eb] hover:underline dark:text-blue-300">
                  {todosTravados ? 'Mostrar menos' : `Ver os ${travados.length} produtos`}
                </button>
              ) : <span />}
              <span />
            </div>
          </section>

          <button type="button" onClick={abrirNoEstoques}
            className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3.5 text-left transition-colors hover:border-[#0d9488]/60 hover:bg-teal-50/40 dark:border-[#2f3b4f] dark:hover:border-[#2dd4bf]/50 dark:hover:bg-[#0d9488]/[0.06]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"><PackageOpen className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <b className="block text-[13.5px] text-gray-900 dark:text-white">Abrir estes {travados.length} produtos no Estoques</b>
              <span className="block text-[12px] leading-snug text-gray-600 dark:text-gray-400">Mesma lista, deste posto. Lá você clica no produto para ver as vendas mês a mês e a margem, vê a última compra e quanto o custo mudou, filtra qualquer coluna e pede a análise dos produtos.</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#0d9488] transition-transform group-hover:translate-x-0.5 dark:text-[#5eead4]" />
          </button>

          <p className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-[12px] leading-snug text-gray-600 dark:bg-white/[0.03] dark:text-gray-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {podeTarefa ? 'Marque os kits e os produtos que você decidiu fazer e crie uma tarefa para alguém executar. ' : ''}O Visor só lê o seu sistema: para vender um kit, cadastre-o no ERP com o preço sugerido e deixe à vista no caixa e na pista.
            {cestas.data && ` Cupons lidos de ${fmtDataBR(cestas.data.dataInicial)} a ${fmtDataBR(cestas.data.dataFinal)}: ${cestas.data.totalCupons.toLocaleString('pt-BR')} autorizados, ${cestas.data.cestas.length.toLocaleString('pt-BR')} com 2 produtos ou mais${cestas.data.fonte === 'venda_item' ? ' (itens lidos do /VENDA_ITEM)' : ''}.`}
          </p>
        </>
      )}

      {podeTarefa && posto != null && (
        <BarraTarefa nKits={kitsMarcados.size} nProdutos={travMarcados.size} ok={tarefaOk}
          onCriar={() => { setTarefaOk(null); setTarefaAberta(true) }} onLimpar={limparSelecao} onFecharOk={() => setTarefaOk(null)} />
      )}
      {tarefaAberta && posto != null && nSel > 0 && (
        <Suspense fallback={null}>
          <TarefaForm
            inicial={montarTarefaDestravar({
              kits: kits.filter((k) => kitsMarcados.has(k.t.r.produtoCodigo)).map((k) => ({ travado: k.t.r, parceiro: k.parceiro, precoKit: k.precoKit, desconto: k.desconto, comprovado: k.fonte !== 'sugestao' })),
              produtos: travados.filter((t) => travMarcados.has(t.r.produtoCodigo)).map((t) => t.r),
              ultimaCompra: (c) => ultimaCompra.get(c)?.custo ?? null,
              empresaCodigo: posto,
              posto: nomeLegivel(nomePosto),
              setorNome: SETOR_UI[setor].nome,
            })}
            onClose={() => setTarefaAberta(false)}
            onSalva={(t) => {
              setTarefaAberta(false)
              limparSelecao()
              setTarefaOk(t ? `Tarefa criada: ${t.titulo}` : 'Tarefa criada.')
              void qc.invalidateQueries({ queryKey: ['gestao-tarefas'] })
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

/** Atalhos entre os setores dentro da tela: combustível vai para o Radar de Preços. */
const TrocaSetor = ({ setor, onSetor, radarVisivel, onClose }: { setor: Setor; onSetor: (s: Setor) => void; radarVisivel: boolean; onClose: () => void }) => {
  const item = 'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-colors'
  return (
    <div className="ml-auto inline-flex items-center gap-0.5 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-[#2f3b4f] dark:bg-white/[0.03]" role="group" aria-label="Setor">
      {radarVisivel && (
        <Link to="/comercial?tab=radar" onClick={onClose} className={cn(item, 'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white')}>
          <Droplets className="h-3.5 w-3.5" /> Combustível <ArrowRight className="h-3 w-3 opacity-60" />
        </Link>
      )}
      {(['automotivos', 'conveniencia'] as Setor[]).map((s) => {
        const { nome, Icon } = SETOR_UI[s]
        return (
          <button key={s} type="button" onClick={() => onSetor(s)} aria-pressed={setor === s}
            className={cn(item, setor === s ? 'bg-white text-gray-900 shadow-sm dark:bg-teal-600 dark:text-white' : 'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white')}>
            <Icon className="h-3.5 w-3.5" /> {nome}
          </button>
        )
      })}
    </div>
  )
}

/** "Ref. 004342" — a Referência do cadastro de produtos do WebPosto. */
const Ref = ({ r, sep = true }: { r: Kit['parceiro']; sep?: boolean }) =>
  r.codigoSku ? <span className="font-mono tabular-nums">Ref. {r.codigoSku}{sep && <span className="font-sans"> · </span>}</span> : null

/** Posto: o mesmo botão suspenso do topo (ícone + "POSTO" + nome), com busca quando a lista é grande. */
const SeletorPosto = ({ postos, valor, onChange }: { postos: Props['postos']; valor: number | null; onChange: (c: number) => void }) => {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAberto(false) } }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc, true) }
  }, [aberto])
  const atual = postos.find((p) => p.codigo === valor)
  const b = busca.trim().toLowerCase()
  const lista = b ? postos.filter((p) => p.nome.toLowerCase().includes(b)) : postos
  return (
    <div ref={ref} className="relative min-w-0 flex-1 sm:max-w-[320px]">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-haspopup="listbox" aria-expanded={aberto}
        className={cn('flex h-10 w-full items-center gap-2.5 rounded-xl border pl-1.5 pr-3 text-left transition-colors',
          aberto ? 'border-[#2563eb] bg-blue-50 dark:border-blue-500/60 dark:bg-blue-950/30' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-[#0f0f0f] dark:hover:border-gray-600 dark:hover:bg-gray-800')}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f] text-white dark:bg-blue-600"><Fuel className="h-4 w-4" /></span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Posto{postos.length > 1 ? ` · ${postos.length} no filtro` : ''}</span>
          <span className="truncate text-[14px] font-semibold text-gray-900 dark:text-white">{atual ? nomeLegivel(atual.nome) : 'Escolha o posto'}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <div role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-[#2f3b4f] dark:bg-[#0f172a]">
          {postos.length > 6 && (
            <div className="relative border-b border-gray-100 p-2 dark:border-[#2f3b4f]">
              <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar posto…"
                className="h-8 w-full rounded-lg bg-gray-50 pl-7 pr-2 text-[13px] text-gray-900 focus:outline-none dark:bg-white/[0.05] dark:text-gray-100" />
            </div>
          )}
          <ul className="max-h-72 overflow-y-auto py-1">
            {lista.map((p) => (
              <li key={p.codigo}>
                <button type="button" role="option" aria-selected={p.codigo === valor} onClick={() => { onChange(p.codigo); setAberto(false); setBusca('') }}
                  className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.05]',
                    p.codigo === valor ? 'font-semibold text-[#1e3a5f] dark:text-teal-300' : 'text-gray-700 dark:text-gray-200')}>
                  <span className="min-w-0 flex-1 truncate">{nomeLegivel(p.nome)}</span>
                  {p.codigo === valor && <Check className="h-4 w-4 shrink-0" />}
                </button>
              </li>
            ))}
            {lista.length === 0 && <li className="px-3 py-2 text-[12.5px] text-gray-500">Nenhum posto com esse nome.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Barra fixa no pé da janela: o que está marcado → criar tarefa. */
const BarraTarefa = ({ nKits, nProdutos, ok, onCriar, onLimpar, onFecharOk }: { nKits: number; nProdutos: number; ok: string | null; onCriar: () => void; onLimpar: () => void; onFecharOk: () => void }) => {
  if (!ok && nKits + nProdutos === 0) return null
  return (
    <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-2 border-t border-gray-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-[#2f3b4f] dark:bg-[#1e293b]/95">
      {ok ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-emerald-800 dark:text-[#86c5aa]">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {ok}
          <Link to="/gestao?tab=tarefas" className="ml-auto font-semibold hover:underline">Ver em Tarefas</Link>
          <button type="button" onClick={onFecharOk} aria-label="Fechar aviso" className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/5"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-gray-700 dark:text-gray-200">
            <b className="font-semibold">{[nKits ? `${nKits} kit${nKits > 1 ? 's' : ''}` : null, nProdutos ? `${nProdutos} produto${nProdutos > 1 ? 's' : ''}` : null].filter(Boolean).join(' e ')}</b> {nKits + nProdutos > 1 ? 'marcados' : 'marcado'}
          </span>
          <button type="button" onClick={onLimpar} className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"><X className="h-3.5 w-3.5" /> Limpar</button>
          <button type="button" onClick={onCriar} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0d9488] px-3.5 text-[13px] font-semibold text-white hover:bg-[#0f766e]">
            <ClipboardPlus className="h-4 w-4" /> Criar tarefa
          </button>
        </div>
      )}
    </div>
  )
}

const Carregando = ({ texto }: { texto: string }) => (
  <p className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 text-[12.5px] text-gray-600 dark:bg-white/[0.03] dark:text-gray-400">
    <Loader2 className="h-4 w-4 animate-spin" /> {texto}
  </p>
)

const Numero = ({ rotulo, valor, ajuda, destaque, nota }: { rotulo: string; valor: string; ajuda: string; destaque?: boolean; nota?: string }) => (
  <div className={cn('rounded-xl border p-3', destaque ? 'border-[#0d9488]/40 bg-teal-50/60 dark:border-[#2dd4bf]/30 dark:bg-[#0d9488]/10' : 'border-gray-200 dark:border-[#2f3b4f]')}>
    <p className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{rotulo} <InfoHint text={ajuda} /></p>
    <p className={cn('mt-0.5 text-[19px] font-bold tabular-nums', destaque ? 'text-[#0f766e] dark:text-[#5eead4]' : 'text-gray-900 dark:text-white')}>{valor}</p>
    {nota && <p className="mt-0.5 text-[11.5px] leading-snug text-gray-500 dark:text-gray-400">{nota}</p>}
  </div>
)

const Situacao = ({ t }: { t: Travado }) => {
  const encalhando = t.motivo === 'encalhando'
  const texto = encalhando
    ? `Estoque para ${Math.round(t.r.diasCobertura)} dias`
    : t.diasSemVenda == null ? 'Sem venda em 6 meses' : `Parado há ${t.diasSemVenda} dias`
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium', encalhando ? 'text-amber-700 dark:text-amber-300' : 'text-red-600 dark:text-red-300')}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', encalhando ? 'bg-amber-500' : 'bg-red-500')} />{texto}
    </span>
  )
}

const FONTE: Record<Kit['fonte'], (k: Kit) => { texto: string; cls: string }> = {
  produto: (k) => ({ texto: `Saem juntos em ${k.cupons} cupons`, cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' }),
  categoria: (k) => ({ texto: `Quem compra ${k.t.r.categoria.toLowerCase()} leva este em ${k.cupons} cupons`, cls: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300' }),
  sugestao: () => ({ texto: `Sugestão · menos de ${MIN_CUPONS} cupons juntos`, cls: 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400' }),
}

/** Caixinha de seleção no padrão das tabelas. */
const Caixa = ({ marcado, onChange, rotulo }: { marcado: boolean; onChange: () => void; rotulo: string }) => (
  <input type="checkbox" checked={marcado} onChange={onChange} aria-label={rotulo}
    className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-teal-600 dark:border-gray-600" />
)

const CartaoKit = ({ k, diasRestantes, marcado, onMarcar }: { k: Kit; diasRestantes: number; marcado?: boolean; onMarcar?: () => void }) => {
  const f = FONTE[k.fonte](k)
  const semMargem = k.t.preco <= k.t.custo
  const selecionavel = marcado !== undefined && onMarcar
  return (
    <div className={cn('flex gap-3 rounded-xl border p-3.5 transition-colors', marcado ? 'border-teal-500/70 bg-teal-50/40 dark:border-[#2dd4bf]/50 dark:bg-[#0d9488]/[0.07]' : 'border-gray-200 dark:border-[#2f3b4f]')}>
      {selecionavel && <span className="pt-0.5"><Caixa marcado={marcado} onChange={onMarcar} rotulo="Marcar este kit" /></span>}
      <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1 text-[13.5px] leading-snug text-gray-900 dark:text-gray-100">
          <p><b className="font-semibold">{k.t.r.produtoNome}</b> <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400"><Ref r={k.t.r} sep={false} /></span></p>
          <p><span className="mr-1.5 text-gray-400">+</span><b className="font-semibold">{k.parceiro.produtoNome}</b> <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400"><Ref r={k.parceiro} sep={false} /></span></p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', f.cls)}>{f.texto}</span>
      </div>
      <div className="mt-2 grid gap-x-4 gap-y-1 text-[12.5px] text-gray-600 dark:text-gray-300 sm:grid-cols-2">
        <p>
          Separados {formatCurrency(k.t.preco)} + {formatCurrency(k.precoParceiro)} = <span className="tabular-nums">{formatCurrency(k.precoCheio)}</span>
          <br />
          <b className="text-[14px] font-bold text-gray-900 dark:text-white">Kit por {formatCurrency(k.precoKit)}</b>
          {k.desconto > 0 && <span className="text-gray-500 dark:text-gray-400"> ({formatCurrency(k.desconto)} de desconto no parado)</span>}
        </p>
        <p className="sm:text-right">
          {semMargem
            ? <span className="text-amber-700 dark:text-amber-300">O parado custa mais do que o preço de venda no cadastro: kit sem desconto, só para liberar o dinheiro. Vale rever o preço.<br /></span>
            : <>Lucro a mais por kit: <b className="tabular-nums text-gray-900 dark:text-white">{formatCurrency(k.lucroExtra)}</b><br /></>}
          {k.kitsMes > 0
            ? <span>Até <b className="tabular-nums text-gray-900 dark:text-white">{k.kitsMes} kits</b> em {diasRestantes} dias → <b className="tabular-nums text-[#0f766e] dark:text-[#5eead4]">até {formatCurrencyInt(k.lucroMes)}</b></span>
            : <span className="text-gray-500 dark:text-gray-400">{k.parceiroOcupado ? `Quem vai levar ${k.parceiro.produtoNome.toLowerCase()} até o fim do mês já está contado num kit acima: troque o par ou deixe para o mês que vem.` : `${k.parceiro.produtoNome} não deve sair até o fim do mês.`}</span>}
        </p>
      </div>
      </div>
    </div>
  )
}

export default FecharMesMelhorModal
