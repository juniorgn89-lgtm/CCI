import { useState } from 'react'
import { AlertTriangle, ArrowRight, Receipt, TrendingDown, FileWarning } from 'lucide-react'
import PainelLateral from '@/components/ui/PainelLateral'
import { GUIAS } from '@/lib/guiasModais'
import InfoHint from '@/components/ui/InfoHint'
import ShareReportButton from '@/components/feedback/ShareReportButton'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import type { ReportPayload } from '@/lib/report/reportTypes'
import type { TipoAchado } from '@/pages/Estoques/lib/analiseProdutos'
import { SETOR_ESTOQUE_LABEL } from '@/pages/Estoques/hooks/useSetorProduto'
import { SETORES_RELATORIO, type RelatorioEstoque, type BlocoRelatorio, type LinhaSinal, type SetorRelatorio } from '@/pages/Estoques/lib/relatorioEstoque'

interface Props {
  open: boolean
  onClose: () => void
  relatorio: RelatorioEstoque
  posto: string
  janelaDias: number
  /** Ainda carregando as notas de compra (sinais de custo incompletos). */
  carregandoCompras: boolean
  /** "Ver na tabela": liga o sinal (e o setor, se vier de um setor). */
  onVerSinal: (tipo: TipoAchado, setor: SetorRelatorio | null) => void
  /** Setor que estava filtrado na tabela (null = todos). */
  setorInicial?: SetorRelatorio | null
}

type Escopo = 'todos' | SetorRelatorio
const nomeEscopo = (e: Escopo) => (e === 'todos' ? 'automotivos e conveniência' : SETOR_ESTOQUE_LABEL[e].toLowerCase())

/** Valor de cada sinal com o que ele significa (a unidade muda conforme o tipo). */
const valorDe = (l: LinhaSinal) => {
  if (l.tipo === 'abaixo_custo') return { v: `${formatCurrencyInt(l.valor)}/mês`, oQue: 'de prejuízo', tom: 'neg' as const }
  if (l.tipo === 'preco_nao_acompanhou') return { v: `${formatCurrencyInt(l.valor)}/mês`, oQue: 'de lucro a menos', tom: 'neg' as const }
  if (l.tipo === 'compra_fora') {
    // Só notas mais baratas: não há valor pago a mais — o recado é conferir.
    if (l.valor <= 0) return { v: `${l.abaixo ?? l.produtos} ${(l.abaixo ?? l.produtos) === 1 ? 'nota' : 'notas'}`, oQue: 'para conferir', tom: 'alerta' as const }
    return { v: formatCurrencyInt(l.valor), oQue: 'pagos a mais', tom: 'alerta' as const }
  }
  return { v: `${formatCurrencyInt(l.valor)}/mês`, oQue: 'em vendas com lucro errado', tom: 'neutro' as const }
}

const hojeBR = () => new Date().toLocaleDateString('pt-BR')

/** Payload do PDF: mesmo conteúdo da tela, em tabela simples. */
const montarPdf = (r: RelatorioEstoque, posto: string, janelaDias: number, escopo: Escopo): ReportPayload => {
  const g = escopo === 'todos' ? r.geral : r.setores[escopo]
  const linhasDe = (b: BlocoRelatorio) => b.linhas.map((l) => {
    const v = valorDe(l)
    return { label: `${l.titulo} · ${l.produtos} ${l.produtos === 1 ? 'produto' : 'produtos'}`, value: `${v.v} ${v.oQue}`, sub: `${l.frase} O que fazer: ${l.oQueFazer}` }
  })
  return {
    title: 'Análise do estoque',
    subtitle: `${posto} · ${hojeBR()} · ${nomeEscopo(escopo)}`,
    kpis: [
      { label: 'Em jogo por mês', value: formatCurrencyInt(g.emJogoMes), tone: 'neg' },
      { label: 'Pago a mais (últimas notas)', value: formatCurrencyInt(g.pagoAMais), tone: 'neg' },
      { label: 'Vendas com lucro errado/mês', value: formatCurrencyInt(g.vendaComLucroErrado) },
    ],
    sections: [
      { title: escopo === 'todos' ? 'Geral' : SETOR_ESTOQUE_LABEL[escopo], rows: linhasDe(g).length ? linhasDe(g) : [{ label: 'Nenhum sinal encontrado', value: '—' }] },
      ...(escopo !== 'todos' ? [] : SETORES_RELATORIO).map((s) => ({
        title: SETOR_ESTOQUE_LABEL[s],
        rows: linhasDe(r.setores[s]).length ? linhasDe(r.setores[s]) : [{ label: 'Nenhum sinal encontrado', value: '—' }],
        note: `${r.setores[s].produtosAnalisados} produtos analisados.`,
      })),
    ],
    footnote: `Vendas dos últimos ${janelaDias} dias, levadas para 30 dias. Custos pelas notas de entrada do último ano. Dados lidos do ERP; nada foi alterado.`,
  }
}

const RelatorioEstoqueModal = ({ open, onClose, relatorio: r, posto, janelaDias, carregandoCompras, onVerSinal, setorInicial }: Props) => {
  const [escopo, setEscopo] = useState<Escopo>(setorInicial ?? 'todos')
  const g = escopo === 'todos' ? r.geral : r.setores[escopo]
  const setorDoEscopo = escopo === 'todos' ? null : escopo
  const maior = [...g.linhas].filter((l) => l.tipo === 'abaixo_custo' || l.tipo === 'preco_nao_acompanhou').sort((a, b) => b.valor - a.valor)[0]
  return (
    <PainelLateral open={open} onClose={onClose} largura="max-w-[860px]" guia={GUIAS.relatorioEstoque}
      titulo={<span className="flex flex-wrap items-center gap-3">Análise do estoque <EscolhaEscopo valor={escopo} onChange={setEscopo} /></span>}
      subtitulo={`${posto} · ${hojeBR()} · ${nomeEscopo(escopo)}`}
      rodape={<>
        <span className="mr-auto text-[11.5px] text-gray-500 dark:text-gray-400">Vendas dos últimos {janelaDias} dias, levadas para 30 dias.</span>
        <ShareReportButton filename="analise-do-estoque.pdf" build={() => montarPdf(r, posto, janelaDias, escopo)} label="PDF" />
      </>}>
      <div className="space-y-7">
        {carregandoCompras && (
          <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Ainda lendo as notas de compra: os sinais de custo podem aumentar quando terminar.
          </p>
        )}

        {/* Resumo: 3 números */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Resumo Icon={TrendingDown} tom="neg" rotulo="Em jogo por mês" valor={formatCurrencyInt(g.emJogoMes)}
            ajuda="Prejuízo de quem vende abaixo do custo + o lucro que deixa de entrar onde o custo subiu e o preço não. É o que se perde todo mês se nada mudar." />
          <Resumo Icon={Receipt} tom="alerta" rotulo="Pago a mais nas últimas notas" valor={formatCurrencyInt(g.pagoAMais)}
            ajuda="Quanto as últimas notas fora do normal custaram acima do preço de sempre (mediana das compras anteriores). Já foi pago: serve para cobrar o fornecedor ou conferir a nota." />
          <Resumo Icon={FileWarning} tom="neutro" rotulo="Vendas com lucro errado/mês" valor={formatCurrencyInt(g.vendaComLucroErrado)}
            ajuda="Vendas de produtos sem estoque no sistema ou sem custo no cadastro. Não é prejuízo direto: é venda cujo lucro aparece errado no Visor até o cadastro ser corrigido." />
        </div>

        {g.produtosVendidos === 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-[13px] leading-relaxed text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {g.produtosAnalisados === 0
                ? <>Este posto não tem produtos de {nomeEscopo(escopo)} no estoque.</>
                : <>Este posto <b>não vendeu nada de {nomeEscopo(escopo)}</b> nos últimos {janelaDias} dias. {g.produtosAnalisados === 1 ? 'O único produto' : `Os ${g.produtosAnalisados} produtos`} no estoque {g.produtosAnalisados === 1 ? 'está parado' : 'estão parados'}: veja em Situação › Parados.</>}
            </span>
          </p>
        )}

        {g.linhas.length === 0 ? (g.produtosVendidos === 0 ? null : (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            Nenhum sinal encontrado nos {g.produtosAnalisados} produtos de {nomeEscopo(escopo)}. Estoque e preços em ordem.
          </p>
        )) : (
          <>
            {maior && maior.valor >= 1 && (
              <p className="text-[14px] leading-relaxed text-gray-700 dark:text-gray-200">
                Analisamos <b>{g.produtosAnalisados} produtos</b>. O que mais pesa no bolso é <b>{maior.titulo.toLowerCase()}</b>: {formatCurrencyInt(maior.valor)} por mês. Comece por ele.
              </p>
            )}

            {/* Geral: três grupos; cada sinal num bloco próprio, com faixa e número em destaque. */}
            {GRUPOS.map((gr) => {
              const linhas = g.linhas.filter((l) => gr.tipos.includes(l.tipo))
              if (linhas.length === 0) return null
              return (
                <section key={gr.id} className="space-y-3">
                  <h3 className="flex items-baseline gap-2 text-[12px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <span className={cn('h-2 w-2 shrink-0 self-center rounded-full', FAIXA[gr.tom].ponto)} />{gr.titulo}
                    <span className="font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">· {gr.sub}</span>
                  </h3>
                  {linhas.map((l) => <CartaoSinal key={l.tipo} l={l} tom={gr.tom} onVer={() => onVerSinal(l.tipo, setorDoEscopo)} />)}
                </section>
              )
            })}

            {/* Por setor: tabela curta (só quando o relatório é dos dois setores) */}
            {escopo === 'todos' && <section className="space-y-2.5">
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Por setor</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {SETORES_RELATORIO.map((s) => <TabelaSetor key={s} setor={s} b={r.setores[s]} onVer={(t) => onVerSinal(t, s)} />)}
              </div>
            </section>}
          </>
        )}
      </div>
    </PainelLateral>
  )
}

/** Todos · Automotivos · Conveniência, ao lado do título. */
const EscolhaEscopo = ({ valor, onChange }: { valor: Escopo; onChange: (e: Escopo) => void }) => (
  <span className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-white/[0.06]" role="group" aria-label="Setor do relatório">
    {(['todos', ...SETORES_RELATORIO] as Escopo[]).map((e) => (
      <button key={e} type="button" onClick={() => onChange(e)} aria-pressed={valor === e}
        className={cn('h-7 rounded-md px-2.5 text-[12px] font-semibold transition-colors', valor === e ? 'bg-white text-gray-900 shadow-sm dark:bg-teal-600 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white')}>
        {e === 'todos' ? 'Todos' : SETOR_ESTOQUE_LABEL[e]}
      </button>
    ))}
  </span>
)

const TOM = {
  neg: { caixa: 'border-red-200 bg-red-50/70 dark:border-red-500/25 dark:bg-red-500/[0.07]', valor: 'text-red-700 dark:text-red-300', icone: 'text-red-500 dark:text-red-300' },
  alerta: { caixa: 'border-amber-200 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/[0.07]', valor: 'text-amber-800 dark:text-amber-200', icone: 'text-amber-500 dark:text-amber-300' },
  neutro: { caixa: 'border-gray-200 dark:border-[#2f3b4f]', valor: 'text-gray-900 dark:text-white', icone: 'text-gray-400' },
}

const Resumo = ({ Icon, tom, rotulo, valor, ajuda }: { Icon: typeof Receipt; tom: keyof typeof TOM; rotulo: string; valor: string; ajuda: string }) => (
  <div className={cn('rounded-xl border p-3.5', TOM[tom].caixa)}>
    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400"><Icon className={cn('h-3.5 w-3.5', TOM[tom].icone)} />{rotulo} <InfoHint text={ajuda} /></p>
    <p className={cn('mt-1 text-[22px] font-bold tabular-nums', TOM[tom].valor)}>{valor}</p>
  </div>
)

type TomGrupo = 'perde' | 'pago' | 'cadastro'
/** Os sinais do relatório em três grupos (o que mais custa primeiro). */
const GRUPOS: { id: TomGrupo; titulo: string; sub: string; tom: TomGrupo; tipos: TipoAchado[] }[] = [
  { id: 'perde', titulo: 'Perde dinheiro todo mês', sub: 'corrigir o preço', tom: 'perde', tipos: ['abaixo_custo', 'preco_nao_acompanhou'] },
  { id: 'pago', titulo: 'Já foi pago', sub: 'conferir as notas', tom: 'pago', tipos: ['compra_fora'] },
  { id: 'cadastro', titulo: 'Cadastro para corrigir', sub: 'o lucro aparece errado', tom: 'cadastro', tipos: ['sem_estoque', 'custo_zerado'] },
]
const FAIXA: Record<TomGrupo, { borda: string; bordaFraca: string; fundo: string; ponto: string; numero: string }> = {
  perde: { borda: 'border-l-red-500', bordaFraca: 'border-l-red-500/25', fundo: 'bg-red-500/[0.05] dark:bg-red-500/[0.08]', ponto: 'bg-red-500', numero: 'text-red-600 dark:text-red-300' },
  pago: { borda: 'border-l-amber-500', bordaFraca: 'border-l-amber-500/25', fundo: 'bg-amber-500/[0.05] dark:bg-amber-500/[0.08]', ponto: 'bg-amber-500', numero: 'text-amber-600 dark:text-amber-300' },
  cadastro: { borda: 'border-l-sky-500', bordaFraca: 'border-l-sky-500/25', fundo: 'bg-sky-500/[0.05] dark:bg-sky-500/[0.08]', ponto: 'bg-sky-500', numero: 'text-sky-600 dark:text-sky-300' },
}

const CartaoSinal = ({ l, tom, onVer }: { l: LinhaSinal; tom: TomGrupo; onVer: () => void }) => {
  const v = valorDe(l)
  const f = FAIXA[tom]
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-[#2f3b4f]">
      {/* Faixa do sinal: número em destaque + título + valor */}
      <div className={cn('flex items-center gap-3.5 border-l-[3px] px-4 py-3', f.borda, f.fundo)}>
        <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-white leading-none shadow-sm ring-1 ring-gray-200 dark:bg-[#0f172a] dark:ring-white/[0.08]">
          <b className={cn('text-[17px] font-bold tabular-nums', f.numero)}>{l.produtos}</b>
          <span className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-gray-400">{l.produtos === 1 ? 'produto' : 'produtos'}</span>
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[14.5px] font-semibold leading-tight text-gray-900 dark:text-white">{l.titulo}</b>
          <span className="text-[12px] text-gray-500 dark:text-gray-400">{v.oQue}</span>
        </span>
        <b className={cn('shrink-0 text-[19px] font-bold tabular-nums', TOM[v.tom].valor)}>{v.v}</b>
      </div>
      {/* Conteúdo: a frase, quem mais pesa (um por linha) e o que fazer */}
      <div className={cn('space-y-2.5 border-l-[3px] px-4 py-3', f.bordaFraca)}>
        <p className="text-[13px] leading-snug text-gray-700 dark:text-gray-300">{l.frase}</p>
        {l.top.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{l.top.length === 1 ? 'Mais pesa' : 'Mais pesam'}</p>
            <ul className="mt-1 space-y-0.5">
              {l.top.map((p, i) => (
                <li key={i} className="flex items-baseline gap-2 text-[12.5px]">
                  <span className="tabular-nums text-gray-400">{i + 1}.</span>
                  <span className="min-w-0 truncate text-gray-800 dark:text-gray-100">{p.nome}</span>
                  {p.ref && <span className="shrink-0 font-mono text-[10.5px] text-gray-400">Ref. {p.ref}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5 dark:border-white/[0.06]">
          <p className="min-w-0 flex-1 text-[12px] text-gray-600 dark:text-gray-400"><b className="font-semibold text-gray-700 dark:text-gray-200">O que fazer:</b> {l.oQueFazer}</p>
          <button type="button" onClick={onVer} className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[#0d9488] hover:underline dark:text-[#5eead4]">
            {l.produtos === 1 ? 'Ver o produto na tabela' : `Ver os ${l.produtos} na tabela`} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

const TabelaSetor = ({ setor, b, onVer }: { setor: SetorRelatorio; b: BlocoRelatorio; onVer: (t: TipoAchado) => void }) => (
  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-[#2f3b4f]">
    <div className="flex items-baseline justify-between gap-2 bg-gray-50 px-3.5 py-2.5 dark:bg-white/[0.03]">
      <b className="text-[13.5px] text-gray-900 dark:text-white">{SETOR_ESTOQUE_LABEL[setor]}</b>
      <span className="text-[11.5px] text-gray-500 dark:text-gray-400">{b.produtosAnalisados} produtos · em jogo <b className="tabular-nums text-red-700 dark:text-red-300">{formatCurrencyInt(b.emJogoMes)}/mês</b></span>
    </div>
    {b.linhas.length === 0 ? (
      <p className="px-3.5 py-3 text-[12.5px] text-emerald-700 dark:text-emerald-300">Nenhum sinal.</p>
    ) : (
      <ul>
        {b.linhas.map((l) => {
          const v = valorDe(l)
          return (
            <li key={l.tipo} className="border-t border-gray-100 dark:border-white/[0.05]">
              <button type="button" onClick={() => onVer(l.tipo)} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[12.5px] transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                <span className="min-w-0 flex-1 text-gray-700 dark:text-gray-200">{l.titulo} <span className="tabular-nums text-gray-400">({l.produtos})</span></span>
                <span className={cn('shrink-0 font-semibold tabular-nums', TOM[v.tom].valor)}>{v.v}</span>
              </button>
            </li>
          )
        })}
      </ul>
    )}
  </div>
)

export default RelatorioEstoqueModal
