import { useState, type ReactNode } from 'react'
import { CalendarRange, Gauge, Hand, TrendingUp, ClipboardCheck, Shuffle, Store, Wrench, ShieldCheck, Info, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import useFechamentoMes from '@/pages/Dashboard/hooks/useFechamentoMes'
import type { CardPreco, CardLoja } from '@/pages/Comercial/hooks/useReguaPreco'

const CHAVE_ABERTO = 'visor360.radar.fechamento.aberto'
const pct = (v: number) => `${Math.abs(v).toFixed(1).replace('.', ',')}%`

/**
 * Topo do Radar de Preços: "Como o mês vai fechar" (mesmo número da Central) e
 * o que o Radar consegue fazer pelos dias que faltam — os aumentos sugeridos em
 * R$/dia × dias restantes, contra a diferença para o mês de referência.
 * Estimativa com o volume constante; dito na tela.
 */
const FechamentoMesRadar = ({ cards, segurar, loja = [], postoCodigo, postoNome, empresaCodigos }: { cards: CardPreco[]; segurar: number; loja?: CardLoja[]; postoCodigo?: number; postoNome?: string; empresaCodigos?: number[] }) => {
  // Com um posto escolhido no Radar, a previsão é a DESSE posto; com vários no topo,
  // a desses postos; senão, a rede.
  const f = useFechamentoMes({ empresaCodigos: postoCodigo != null ? [postoCodigo] : empresaCodigos ?? [] })
  // Detalhe abre/fecha; a escolha fica lembrada neste navegador.
  const [aberto, setAberto] = useState(() => { try { return localStorage.getItem(CHAVE_ABERTO) === '1' } catch { return false } })
  const alternar = (v: boolean) => { setAberto(v); try { localStorage.setItem(CHAVE_ABERTO, v ? '1' : '0') } catch { /* sem storage */ } }
  if (f.carregando || f.previsao <= 0) return null

  const subir = cards.filter((c) => c.veredito === 'subir' && c.quantoL > 0)
  const ganhoDia = subir.reduce((s, c) => s + c.quantoL * c.volumeDia, 0)
  const ganhoRestante = ganhoDia * Math.max(0, f.diasRestantes)
  const diferenca = f.cheioTotal != null ? f.cheioTotal - f.previsao : null // > 0 = vai fechar abaixo
  const abaixo = diferenca != null && diferenca > 0
  const cobre = abaixo && diferenca! > 0 ? Math.min(100, (ganhoRestante / diferenca!) * 100) : null
  const dias = `${f.diasRestantes} ${f.diasRestantes === 1 ? 'dia' : 'dias'}`

  // Onde está a diferença: setor a setor, previsão × mês de referência inteiro.
  const porSetor = f.setores.filter((x) => x.cheio != null).map((x) => ({ ...x, dif: x.previsao - (x.cheio ?? 0) }))
  const queda = porSetor.filter((x) => x.dif < 0).sort((a, b) => a.dif - b.dif)
  const pior = queda[0]
  // Alavancas que se aplicam (sem aumento sugerido): só o que tem número de verdade.
  const custoSemConfirmar = cards.filter((c) => c.frescor !== 'ok')
  const comMargem = cards.filter((c) => c.volumeDia > 0 && c.margemPct > 0).sort((a, b) => b.margemPct - a.margemPct)
  const mixAlto = comMargem[0]
  const mixBaixo = comMargem[comMargem.length - 1]
  const temMix = !!mixAlto && !!mixBaixo && mixAlto.id !== mixBaixo.id && mixAlto.margemPct - mixBaixo.margemPct >= 3
  const lojaValor = loja.reduce((acc, l) => acc + l.valor, 0)
  const autoCaiu = queda.some((x) => x.id === 'automotivos')
  const combCaiu = queda.some((x) => x.id === 'combustivel')
  // Empatar pede quanto acima do ritmo previsto?
  const esforco = f.paraEmpatar != null && f.ritmoPrevisto > 0 ? (f.paraEmpatar / f.ritmoPrevisto - 1) * 100 : null
  const nomeFuel = (c: CardPreco) => c.fuel.replace(/\.$/, '')

  // Ações que se aplicam (cada uma com o número). Com aumento sugerido, ele vem primeiro.
  const acoes: { chave: string; Icone: typeof TrendingUp; cor: string; titulo: string; texto: ReactNode }[] = []
  if (!f.fechado) {
    if (subir.length > 0) {
      acoes.push({ chave: 'subir', Icone: TrendingUp, cor: 'text-emerald-300', titulo: 'Subir o preço', texto: <>Aplicando hoje {subir.length === 1 ? 'o aumento sugerido' : `os ${subir.length} aumentos sugeridos`}, {postoNome ? 'o posto ganha' : 'a rede ganha'} cerca de <b className="font-semibold text-emerald-300">{formatCurrencyInt(ganhoRestante)}</b> nos {dias} ({formatCurrencyInt(ganhoDia)}/dia){cobre !== null && <>, o que cobre <b className="font-semibold">{Math.round(cobre)}%</b> da diferença</>}.</> })
      if (segurar > 0) acoes.push({ chave: 'segurar', Icone: Hand, cor: 'text-red-300', titulo: 'Segurar', texto: <>Não corte o preço em {segurar} {segurar === 1 ? 'combustível' : 'combustíveis'}: já estão na referência ou perto do custo.</> })
    } else {
      acoes.push({ chave: 'preco', Icone: ShieldCheck, cor: 'text-white/70', titulo: 'Não mexa no preço', texto: <>Nenhum combustível {postoNome ? 'deste posto ' : ''}está abaixo da referência. Subir para recuperar afastaria cliente sem respaldo.</> })
      if (abaixo && custoSemConfirmar.length > 0) acoes.push({ chave: 'custo', Icone: ClipboardCheck, cor: 'text-amber-300', titulo: 'Confirmar o custo', texto: <>{custoSemConfirmar.length === 1 ? `${nomeFuel(custoSemConfirmar[0])} está` : `${custoSemConfirmar.length} combustíveis estão`} com custo velho ou sem data. Lance a última compra no ERP: a margem real pode ser outra.</> })
      if (abaixo && combCaiu && temMix) acoes.push({ chave: 'mix', Icone: Shuffle, cor: 'text-sky-300', titulo: 'Mix na pista', texto: <>{nomeFuel(mixAlto!)} dá <b className="font-semibold">{mixAlto!.margemPct.toFixed(1).replace('.', ',')}%</b> de margem e {nomeFuel(mixBaixo!)} só {mixBaixo!.margemPct.toFixed(1).replace('.', ',')}%. Oriente os frentistas a oferecer o de maior margem.</> })
      if (abaixo && lojaValor > 0) acoes.push({ chave: 'loja', Icone: Store, cor: 'text-emerald-300', titulo: 'Loja', texto: <>Margem abaixo da média da rede. Ajustar mix e exposição vale cerca de <b className="font-semibold">{formatCurrencyInt(lojaValor)}</b> no período (veja no fim da tela).</> })
      if (abaixo && autoCaiu) acoes.push({ chave: 'auto', Icone: Wrench, cor: 'text-amber-300', titulo: 'Automotivos caiu', texto: <>Troca de óleo e serviços abaixo de {f.cheioLabel}. Confira na Produtividade quem está oferecendo na pista.</> })
    }
  }
  const nAcoes = acoes.filter((a) => a.chave !== 'preco').length
  const maxQueda = Math.max(1, ...porSetor.map((x) => Math.abs(x.dif)))

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#27496f] text-white shadow-lg dark:border dark:border-[#2f3b4f] dark:border-t-2 dark:border-t-[#0d9488] dark:bg-none dark:bg-[#1b2b35] dark:shadow-none">
      {/* Faixa compacta: tudo o que importa numa linha */}
      <div className="flex flex-wrap items-stretch gap-x-6 gap-y-3 px-5 py-4">
        <div className="min-w-[180px]">
          <p className="inline-flex items-center gap-1.5 text-[15px] font-bold">
            Como o mês vai fechar
            <InfoHint text="O mesmo cartão da Central: previsão do lucro bruto (combustível, automotivos e conveniência), pelo ritmo de cada dia da semana." className="text-white/60 hover:text-white dark:text-white/60 dark:hover:text-white" />
          </p>
          <p className="text-[11px] text-white/60">{postoNome ? postoNome : empresaCodigos?.length ? `${empresaCodigos.length} postos escolhidos` : 'Rede inteira'} · todos os setores</p>
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/60">
            <Gauge className="h-3.5 w-3.5" /> confiança <b className={cn('font-semibold', f.confiabilidade === 'alta' ? 'text-emerald-300' : f.confiabilidade === 'media' ? 'text-amber-300' : 'text-red-300')}>{f.confiabilidade === 'media' ? 'média' : f.confiabilidade}</b> ({Math.round(f.confiabilidadePct)}%)
          </p>
        </div>

        <div className="border-l border-white/10 pl-6">
          <p className="text-[10px] uppercase tracking-wider text-white/55">Já entrou</p>
          <p className="text-[19px] font-bold tabular-nums leading-tight">{formatCurrencyInt(f.jaEntrou)}</p>
          <p className="text-[11px] text-white/60">em {f.diasFechados} {f.diasFechados === 1 ? 'dia' : 'dias'}</p>
        </div>
        <div className="border-l border-white/10 pl-6">
          <p className="text-[10px] uppercase tracking-wider text-white/55">{f.fechado ? 'Fechou em' : 'Deve fechar em'}</p>
          <p className="text-[19px] font-bold tabular-nums leading-tight text-[#6ee7b7] dark:text-[#86c5aa]">{formatCurrencyInt(f.previsao)}</p>
          <p className="text-[11px] text-white/60">{f.fechado ? 'mês fechado' : `até ${f.fimMes}`}</p>
        </div>
        <div className="border-l border-white/10 pl-6">
          <p className="text-[10px] uppercase tracking-wider text-white/55">Contra {f.cheioLabel} inteiro</p>
          {f.vsCheio === null
            ? <p className="text-[13px] text-white/60">sem base</p>
            : <p className={cn('text-[19px] font-bold tabular-nums leading-tight', f.vsCheio >= 0 ? 'text-emerald-300' : 'text-red-300')}>{f.vsCheio >= 0 ? '▲' : '▼'} {pct(f.vsCheio)}</p>}
          <p className="text-[11px] text-white/60">{f.cheioTotal ? formatCurrencyInt(f.cheioTotal) : ''}</p>
        </div>
        {!f.fechado && abaixo && f.paraEmpatar != null && (
          <div className="border-l border-white/10 pl-6">
            <p className="text-[10px] uppercase tracking-wider text-white/55">Para empatar</p>
            <p className="text-[19px] font-bold tabular-nums leading-tight">{formatCurrencyInt(f.paraEmpatar)}<span className="text-[12px] font-medium text-white/60">/dia</span></p>
            <p className="text-[11px] text-white/60">previsto {formatCurrencyInt(f.ritmoPrevisto)}/dia</p>
          </div>
        )}

        {!f.fechado && (
          <button type="button" onClick={() => alternar(!aberto)} aria-expanded={aberto}
            className="ml-auto inline-flex items-center gap-2 self-center rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 text-left text-[12.5px] font-semibold transition-colors hover:border-[#5eead4]/50 hover:bg-white/[0.1]">
            <CalendarRange className="h-4 w-4 shrink-0 text-[#5eead4]" />
            <span className="flex flex-col leading-tight">
              <span>O que fazer nos {dias}</span>
              <span className="text-[11px] font-normal text-white/60">{subir.length === 0 ? `Não mexer no preço${nAcoes > 0 ? ` · ${nAcoes} ${nAcoes === 1 ? 'ação' : 'ações'} fora do preço` : ''}` : `${subir.length} ${subir.length === 1 ? 'aumento sugerido' : 'aumentos sugeridos'}`}</span>
            </span>
            <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', aberto && 'rotate-180')} />
          </button>
        )}
      </div>

      {/* Detalhe (abre/fecha): onde está a diferença + as ações */}
      {!f.fechado && aberto && (
        <div className="grid gap-4 border-t border-white/10 bg-black/10 px-5 py-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/60">{abaixo ? `Onde está a diferença para ${f.cheioLabel}` : `Setores contra ${f.cheioLabel}`}</p>
            {porSetor.length === 0 ? (
              <p className="text-[12px] text-white/60">Sem o mês de referência para comparar.</p>
            ) : (
              <div className="space-y-2">
                {porSetor.map((x) => (
                  <div key={x.id}>
                    <div className="flex items-baseline justify-between text-[12px]">
                      <span className={cn(x === pior ? 'font-semibold text-white' : 'text-white/75')}>{x.nome}</span>
                      <span className={cn('font-semibold tabular-nums', x.dif >= 0 ? 'text-emerald-300' : 'text-red-300')}>{x.dif >= 0 ? '+' : '−'}{formatCurrencyInt(Math.abs(x.dif))}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className={cn('h-full rounded-full', x.dif >= 0 ? 'bg-emerald-400/70' : 'bg-red-400/70')} style={{ width: `${Math.max(3, (Math.abs(x.dif) / maxQueda) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                {abaixo && diferenca != null && <p className="pt-1 text-[11.5px] text-white/70">Faltam <b className="font-semibold text-white">{formatCurrencyInt(diferenca)}</b> além da previsão para empatar.</p>}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <div className="grid gap-2 md:grid-cols-2">
              {acoes.map((a) => (
                <div key={a.chave} className={cn('flex items-start gap-2 rounded-lg bg-white/[0.06] p-2.5 text-[12.5px] leading-snug', a.chave === 'preco' && 'md:col-span-2')}>
                  <a.Icone className={cn('mt-0.5 h-4 w-4 shrink-0', a.cor)} />
                  <p className="text-white/90"><b className="font-semibold">{a.titulo}:</b> {a.texto}</p>
                </div>
              ))}
            </div>
            {subir.length === 0 && abaixo && esforco !== null && esforco > 15 && (
              <p className="flex items-start gap-1.5 text-[11.5px] text-white/75">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Empatar exige vender {Math.round(esforco)}% acima do ritmo previsto nos {dias}: dificilmente acontece só com essas ações. Foque em não perder mais e em preparar o mês que vem.
              </p>
            )}
            {subir.length > 0 && abaixo && cobre !== null && cobre < 100 && (
              <p className="text-[11.5px] text-white/70">O resto precisa vir de volume (mais litros) ou da loja: veja "Loja com margem abaixo da rede" no fim da tela.</p>
            )}
            <p className="text-[10.5px] text-white/50">Estimativa com o mesmo volume de litros por dia do período.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default FechamentoMesRadar
