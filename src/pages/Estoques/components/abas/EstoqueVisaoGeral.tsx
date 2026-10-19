import { useMemo, useState } from 'react'
import { Fuel, Wrench, Store, DollarSign, AlertTriangle, Clock, Zap, TrendingUp, TrendingDown, BarChart3, Target, Layers, Star, Gem, Cog, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import { todayLocal } from '@/lib/period'
import InfoHint from '@/components/ui/InfoHint'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import { SETOR_ESTOQUE_LABEL, type SetorEstoque } from '@/pages/Estoques/hooks/useSetorProduto'
import {
  DIAS_PARADO, FATOR_EXCESSO, custoUnit, precoUnit, ehParado, ehRuptura, ehCritico, valorExcedente, fmtUnidades, fmtDataBR, type SituacaoProduto,
} from '@/pages/Estoques/components/estoqueComum'

export interface AbrirProdutos { situacao?: SituacaoProduto; categoria?: string; setor?: SetorEstoque }

interface Props {
  data: ProductAnalyticsRow[]
  setorDe: (codigo: number) => SetorEstoque
  coberturaDias: number
  janelaDias: number
  onAbrirProdutos: (f: AbrirProdutos) => void
}

const SETORES: { id: SetorEstoque; Icon: typeof Fuel }[] = [
  { id: 'combustivel', Icon: Fuel },
  { id: 'automotivos', Icon: Wrench },
  { id: 'conveniencia', Icon: Store },
]

const painelCls = 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black'
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const mediana = (v: number[]) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

/** Margem bruta % do que foi vendido; sem venda no período, a do cadastro. */
const margemPct = (r: ProductAnalyticsRow) =>
  r.precoMedioVenda > 0 && r.custoMedio > 0 ? ((r.precoMedioVenda - r.custoMedio) / r.precoMedioVenda) * 100 : r.lucroBrutoPctCadastro

/**
 * Visão Geral do Estoques — UM posto, um setor por vez: quanto vale o estoque,
 * quanto está em risco (parado + excesso), o que está faltando, e onde o
 * dinheiro está (Curva ABC, Giro × Margem, grupos). Cada bloco abre a aba
 * Produtos com o mesmo filtro, então os números batem.
 */
const EstoqueVisaoGeral = ({ data, setorDe, coberturaDias, janelaDias, onAbrirProdutos }: Props) => {
  const hoje = todayLocal()
  const porSetor = useMemo(() => {
    const m: Record<SetorEstoque, ProductAnalyticsRow[]> = { combustivel: [], automotivos: [], conveniencia: [] }
    for (const r of data) m[setorDe(r.produtoCodigo)].push(r)
    return m
  }, [data, setorDe])
  // Setor inicial: o de maior valor em estoque.
  const [setorSel, setSetorSel] = useState<SetorEstoque | null>(null)
  const setor: SetorEstoque = (setorSel && porSetor[setorSel].length > 0 ? setorSel : null) ?? (SETORES.map((s) => s.id).sort((a, b) =>
    porSetor[b].reduce((n, r) => n + Math.max(0, r.valorEstoque), 0) - porSetor[a].reduce((n, r) => n + Math.max(0, r.valorEstoque), 0))[0])
  const rows = porSetor[setor]
  const ehComb = setor === 'combustivel'

  const m = useMemo(() => {
    const comSaldo = rows.filter((r) => r.saldoAtual > 0)
    const valor = comSaldo.reduce((n, r) => n + r.saldoAtual * custoUnit(r), 0)
    const semCustoMedio = comSaldo.filter((r) => r.custoMedio <= 0).length
    const valorCustoMedio = comSaldo.reduce((n, r) => n + r.saldoAtual * (r.custoMedio > 0 ? r.custoMedio : custoUnit(r)), 0)
    const valorVenda = comSaldo.reduce((n, r) => n + r.saldoAtual * precoUnit(r), 0)

    const parados = comSaldo.filter((r) => ehParado(r, hoje)).sort((a, b) => b.saldoAtual * custoUnit(b) - a.saldoAtual * custoUnit(a))
    const valorParado = parados.reduce((n, r) => n + r.saldoAtual * custoUnit(r), 0)
    const excesso = rows.map((r) => ({ r, v: valorExcedente(r, coberturaDias, hoje) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v)
    const valorExcesso = excesso.reduce((n, x) => n + x.v, 0)

    const ruptura = rows.filter(ehRuptura)
    const criticos = rows.filter(ehCritico)
    const faltando = [...ruptura, ...criticos].sort((a, b) => b.mediaDiariaVendas * precoUnit(b) - a.mediaDiariaVendas * precoUnit(a))
    const vendaPerdidaDia = ruptura.reduce((n, r) => n + r.mediaDiariaVendas * precoUnit(r), 0)

    // Cobertura: só quem vende (os parados entram à parte, senão viram "210 dias").
    const vendem = comSaldo.filter((r) => r.mediaDiariaVendas > 0)
    const vendaDiaValor = vendem.reduce((n, r) => n + r.mediaDiariaVendas * custoUnit(r), 0)
    const cobertura = vendaDiaValor > 0 ? vendem.reduce((n, r) => n + r.saldoAtual * custoUnit(r), 0) / vendaDiaValor : null
    const semVenda = comSaldo.length - vendem.length
    const vendidoJanelaCusto = rows.reduce((n, r) => n + r.vendasJanela * custoUnit(r), 0)
    const giroAno = valor > 0 ? (vendidoJanelaCusto / valor) * (365 / janelaDias) : null

    // Curva ABC pela receita de 6 meses.
    const porReceita = [...rows].sort((a, b) => b.receitaUltimos6m - a.receitaUltimos6m)
    const receitaTotal = porReceita.reduce((n, r) => n + r.receitaUltimos6m, 0)
    const abc = { A: { n: 0, receita: 0, imob: 0 }, B: { n: 0, receita: 0, imob: 0 }, C: { n: 0, receita: 0, imob: 0 } }
    let acum = 0
    for (const r of porReceita) {
      acum += r.receitaUltimos6m
      const share = receitaTotal > 0 ? acum / receitaTotal : 1
      const cls = r.receitaUltimos6m <= 0 ? 'C' : share <= 0.8 ? 'A' : share <= 0.95 ? 'B' : 'C'
      abc[cls].n += 1; abc[cls].receita += r.receitaUltimos6m; abc[cls].imob += Math.max(0, r.saldoAtual) * custoUnit(r)
    }

    // Matriz Giro × Margem: só quem vendeu na janela; corte na mediana do setor.
    const comVenda = rows.filter((r) => r.vendasJanela > 0)
    const giroMed = mediana(comVenda.map((r) => r.giroJanela))
    const margMed = mediana(comVenda.map(margemPct))
    const quad = { estrelas: { n: 0, v: 0 }, mina: { n: 0, v: 0 }, tracao: { n: 0, v: 0 }, reduzir: { n: 0, v: 0 } }
    for (const r of comVenda) {
      const altoGiro = r.giroJanela >= giroMed, altaMarg = margemPct(r) >= margMed
      const k = altoGiro && altaMarg ? 'estrelas' : !altoGiro && altaMarg ? 'mina' : altoGiro ? 'tracao' : 'reduzir'
      quad[k].n += 1; quad[k].v += Math.max(0, r.saldoAtual) * custoUnit(r)
    }

    // Imobilizado por grupo (top 10).
    const g = new Map<string, number>()
    for (const r of comSaldo) g.set(r.categoria, (g.get(r.categoria) ?? 0) + r.saldoAtual * custoUnit(r))
    const grupos = [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)

    return {
      comSaldo: comSaldo.length, valor, valorCustoMedio, semCustoMedio, valorVenda,
      parados, valorParado, excesso, valorExcesso, risco: valorParado + valorExcesso,
      faltando, nRuptura: ruptura.length, nCritico: criticos.length, vendaPerdidaDia,
      cobertura, semVenda, giroAno, abc, receitaTotal, quad, comVenda: comVenda.length, semVendaJanela: rows.length - comVenda.length, grupos,
    }
  }, [rows, coberturaDias, janelaDias, hoje])

  const abrir = (f: Omit<AbrirProdutos, 'setor'>) => onAbrirProdutos({ ...f, setor })
  const maxGrupo = Math.max(1, ...m.grupos.map(([, v]) => v))

  return (
    <div className="space-y-4">
      {/* Setor */}
      <div className={cn(painelCls, 'flex flex-wrap gap-1 p-1.5')}>
        {SETORES.filter(({ id }) => porSetor[id].length > 0 || id === setor).map(({ id, Icon }) => (
          <button key={id} type="button" onClick={() => setSetorSel(id)} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
            setor === id ? 'bg-[#1e3a5f] text-white dark:bg-blue-600' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60')}>
            <Icon className="h-4 w-4" />{SETOR_ESTOQUE_LABEL[id]}<span className={cn('text-[11px] font-normal tabular-nums', setor === id ? 'text-white/75' : 'text-gray-400')}>{formatNumber(porSetor[id].length)}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className={cn(painelCls, 'px-4 py-8 text-center text-[13px] text-gray-500')}>Nenhum produto de {SETOR_ESTOQUE_LABEL[setor].toLowerCase()} neste posto.</p>
      ) : (<>
        {/* Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="Valor do inventário" hint="Soma de saldo × custo do cadastro (o mesmo valor do imobilizado no ERP). Só produtos com saldo positivo."
            valor={formatCurrency(m.valor)} sub={`${formatNumber(m.comSaldo)} produtos com saldo`} Icon={DollarSign} tom="verde" onClick={() => abrir({ situacao: 'com_saldo' })} />
          <Card label="Valor em risco" hint={`Dinheiro empatado sem retorno: produtos parados (com saldo e sem venda há mais de ${DIAS_PARADO} dias) + o que passa da meta de ${coberturaDias} dias nos produtos que duram mais de ${FATOR_EXCESSO * coberturaDias} dias (excesso). O mesmo produto não conta duas vezes.`}
            valor={formatCurrency(m.risco)} sub={`parado ${formatCurrencyInt(m.valorParado)} · excesso ${formatCurrencyInt(m.valorExcesso)}`} Icon={AlertTriangle} tom="vermelho" />
          <Card label="Cobertura média" hint={`Quantos dias o estoque dura no ritmo de venda dos últimos ${janelaDias} dias, ponderado pelo valor. Só conta quem vende: produtos com saldo e sem venda ficam à parte (senão a média vira centenas de dias). Giro por ano = custo do que vendeu ÷ valor do estoque, anualizado.`}
            valor={m.cobertura == null ? '—' : `${Math.round(m.cobertura)} dias`} sub={[m.giroAno != null ? `giro ${m.giroAno.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× por ano` : null, m.semVenda > 0 ? `+ ${formatNumber(m.semVenda)} sem venda em ${janelaDias}d` : null].filter(Boolean).join(' · ')} Icon={Clock} tom="ambar" />
          <Card label="Ruptura + crítico" hint="Ruptura = zerado (ou negativo) e ainda vende: está perdendo venda. Crítico = tem saldo, mas dura menos da metade da meta de cobertura."
            valor={formatNumber(m.nRuptura + m.nCritico)} sub={`${formatNumber(m.nRuptura)} ruptura · ${formatNumber(m.nCritico)} crítico`} Icon={Zap} tom="laranja" onClick={() => abrir({ situacao: 'ruptura' })} />
        </div>

        {/* Valorização */}
        <section className={cn(painelCls, 'p-4')}>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 dark:text-gray-100"><DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Valorização do estoque <span className="text-[11px] font-normal text-gray-400">{SETOR_ESTOQUE_LABEL[setor]} · saldo de agora</span></p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Valoriz titulo="A custo médio" valor={m.valorCustoMedio} sub={`custo médio do que foi vendido (6 meses)${m.semCustoMedio > 0 ? ` · ${formatNumber(m.semCustoMedio)} sem venda usam o do cadastro` : ''}`} cls="border-teal-200 bg-teal-50/50 dark:border-teal-800/50 dark:bg-teal-950/20" tituloCls="text-teal-700 dark:text-teal-300" />
            <Valoriz titulo="A custo atual" selo="ERP" valor={m.valor} sub="custo do cadastro · base dos cálculos · = imobilizado do ERP" cls="border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-400/40 dark:border-emerald-600 dark:bg-emerald-950/25" tituloCls="text-emerald-700 dark:text-emerald-300" />
            <Valoriz titulo="A preço de venda" valor={m.valorVenda} sub="preço do cadastro (tabela A); sem ele, o preço médio vendido" cls="border-violet-200 bg-violet-50/50 dark:border-violet-800/50 dark:bg-violet-950/20" tituloCls="text-violet-700 dark:text-violet-300" />
          </div>
        </section>

        {/* Listas */}
        <div className={cn('grid gap-3', ehComb ? 'md:grid-cols-1' : 'lg:grid-cols-3')}>
          <Lista titulo="Em ruptura ou crítico" Icon={Zap} tom="vermelho" vazio="Nada faltando: tudo que vende tem saldo."
            itens={m.faltando.slice(0, 5).map((r) => ({ k: r.produtoCodigo, nome: r.produtoNome, dir: `${fmtUnidades(r.saldoAtual)} un · vende ${fmtUnidades(r.mediaDiariaVendas)}/dia` }))}
            rodape={m.vendaPerdidaDia > 0 ? <>Venda perdida estimada: <b className="font-semibold">{formatCurrency(m.vendaPerdidaDia)} por dia</b> enquanto zerados <InfoHint text="Estimativa: venda média por dia × preço, somada dos produtos zerados que vendem. É quanto deixa de entrar por dia, não um valor apurado." /></> : null}
            total={m.faltando.length} onVerTodos={() => abrir({ situacao: 'ruptura' })} />
          {!ehComb && (<>
            <Lista titulo="Excesso de estoque" Icon={TrendingUp} tom="azul" vazio={`Nenhum produto dura mais de ${FATOR_EXCESSO * coberturaDias} dias.`}
              itens={m.excesso.slice(0, 5).map((x) => ({ k: x.r.produtoCodigo, nome: x.r.produtoNome, dir: `${formatCurrencyInt(x.v)} · ${Math.round(x.r.diasCobertura)}d` }))}
              rodape={m.valorExcesso > 0 ? <>Acima da meta de {coberturaDias} dias: <b className="font-semibold">{formatCurrency(m.valorExcesso)}</b> <InfoHint text={`Produtos que vendem, mas duram mais de ${FATOR_EXCESSO * coberturaDias} dias. O valor é só a parte que passa da meta de ${coberturaDias} dias, a custo do cadastro.`} /></> : null}
              total={m.excesso.length} onVerTodos={() => abrir({ situacao: 'excesso' })} />
            <Lista titulo="Produtos parados" Icon={TrendingDown} tom="roxo" vazio={`Nenhum produto com saldo está sem venda há mais de ${DIAS_PARADO} dias.`}
              itens={m.parados.slice(0, 5).map((r) => ({ k: r.produtoCodigo, nome: r.produtoNome, dir: `${formatCurrencyInt(r.saldoAtual * custoUnit(r))} · ${r.ultimaVenda ? `últ. ${fmtDataBR(r.ultimaVenda).slice(0, 5)}` : 'sem venda em 6m'}` }))}
              rodape={m.valorParado > 0 ? <>Sem venda há +{DIAS_PARADO} dias: <b className="font-semibold">{formatCurrency(m.valorParado)}</b></> : null}
              total={m.parados.length} onVerTodos={() => abrir({ situacao: 'parados' })} />
          </>)}
        </div>

        {/* Onde está o dinheiro */}
        {!ehComb && (
          <div className="grid gap-3 lg:grid-cols-3">
            <section className={cn(painelCls, 'p-4')}>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 dark:text-gray-100"><BarChart3 className="h-4 w-4 text-[#2563eb]" /> Curva ABC
                <InfoHint text="Produtos em ordem de faturamento dos últimos 6 meses. A = os que somam os primeiros 80% do faturamento; B = até 95%; C = o resto (e quem não vendeu). Imobilizado = valor em estoque de cada classe." />
              </p>
              <div className="mt-3 space-y-3">
                {(['A', 'B', 'C'] as const).map((k) => {
                  const c = m.abc[k]
                  const share = m.receitaTotal > 0 ? c.receita / m.receitaTotal : 0
                  const cor = k === 'A' ? 'bg-emerald-500' : k === 'B' ? 'bg-amber-500' : 'bg-gray-400'
                  return (
                    <div key={k} className="flex items-start gap-3">
                      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-white', cor)}>{k}</span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline justify-between gap-2 text-[12px]"><span className="text-gray-700 dark:text-gray-200">{formatNumber(c.n)} produtos · {pct(rows.length ? (c.n / rows.length) * 100 : 0)}</span><span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(c.receita)}</span></p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className={cn('h-full rounded-full', cor)} style={{ width: `${share * 100}%` }} /></div>
                        <p className="mt-0.5 text-[10.5px] text-gray-400">{pct(share * 100)} do faturamento · imobilizado {formatCurrencyInt(c.imob)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className={cn(painelCls, 'p-4')}>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 dark:text-gray-100"><Target className="h-4 w-4 text-violet-500" /> Giro × Margem
                <InfoHint text={`Só os ${formatNumber(m.comVenda)} produtos que venderam nos últimos ${janelaDias} dias (os outros estão em Parados). Alto/baixo = acima/abaixo da mediana deste setor no posto. Margem = (preço médio vendido − custo médio) ÷ preço. O valor é o que está em estoque em cada grupo.`} />
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Quad titulo="Estrelas" sub="vende muito · margem alta" Icon={Star} q={m.quad.estrelas} cls="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-950/20" />
                <Quad titulo="Mina de ouro" sub="vende pouco · margem alta" Icon={Gem} q={m.quad.mina} cls="border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20" />
                <Quad titulo="Tração" sub="vende muito · margem baixa" Icon={Cog} q={m.quad.tracao} cls="border-sky-200 bg-sky-50/50 dark:border-sky-800/50 dark:bg-sky-950/20" />
                <Quad titulo="Reduzir" sub="vende pouco · margem baixa" Icon={AlertTriangle} q={m.quad.reduzir} cls="border-red-200 bg-red-50/50 dark:border-red-800/50 dark:bg-red-950/20" />
              </div>
            </section>

            <section className={cn(painelCls, 'p-4')}>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 dark:text-gray-100"><Layers className="h-4 w-4 text-[#2563eb]" /> Imobilizado por grupo <span className="text-[11px] font-normal text-gray-400">top 10</span></p>
              <ul className="mt-3 space-y-1.5">
                {m.grupos.map(([nome, v]) => (
                  <li key={nome}>
                    <button type="button" onClick={() => abrir({ categoria: nome })} className="group block w-full text-left">
                      <span className="flex items-baseline justify-between gap-2 text-[11.5px]"><span className="truncate text-gray-700 group-hover:text-[#2563eb] dark:text-gray-200 dark:group-hover:text-blue-300">{nome}</span><span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">{formatCurrencyInt(v)}</span></span>
                      <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><span className="block h-full rounded-full bg-[#2563eb]" style={{ width: `${(v / maxGrupo) * 100}%` }} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </>)}
    </div>
  )
}

const TONS = {
  verde: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  vermelho: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  ambar: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  laranja: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  azul: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  roxo: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
}

const Card = ({ label, hint, valor, sub, Icon, tom, onClick }: { label: string; hint: string; valor: string; sub: string; Icon: typeof Fuel; tom: keyof typeof TONS; onClick?: () => void }) => {
  const corpo = (
    <>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}<InfoHint text={hint} /></p>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', TONS[tom])}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{valor}</p>
      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{sub}</p>
    </>
  )
  const cls = cn(painelCls, 'p-4 text-left')
  return onClick ? <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter') onClick() }} className={cn(cls, 'cursor-pointer transition-colors hover:border-[#2563eb]/50')}>{corpo}</div> : <div className={cls}>{corpo}</div>
}

const Valoriz = ({ titulo, selo, valor, sub, cls, tituloCls }: { titulo: string; selo?: string; valor: number; sub: string; cls: string; tituloCls: string }) => (
  <div className={cn('rounded-lg border px-4 py-3', cls)}>
    <p className={cn('flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide', tituloCls)}>{titulo}{selo && <span className="rounded bg-emerald-600 px-1.5 py-px text-[9.5px] text-white">{selo}</span>}</p>
    <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(valor)}</p>
    <p className="mt-0.5 text-[10.5px] text-gray-500 dark:text-gray-400">{sub}</p>
  </div>
)

const LISTA_TOM = {
  vermelho: 'border-red-200 dark:border-red-900/50',
  azul: 'border-blue-200 dark:border-blue-900/50',
  roxo: 'border-violet-200 dark:border-violet-900/50',
}

const Lista = ({ titulo, Icon, tom, itens, rodape, vazio, total, onVerTodos }: {
  titulo: string; Icon: typeof Fuel; tom: keyof typeof LISTA_TOM; itens: { k: number; nome: string; dir: string }[]; rodape: React.ReactNode; vazio: string; total: number; onVerTodos: () => void
}) => (
  <section className={cn(painelCls, LISTA_TOM[tom], 'flex flex-col p-4')}>
    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 dark:text-gray-100"><span className={cn('flex h-6 w-6 items-center justify-center rounded-md', TONS[tom])}><Icon className="h-3.5 w-3.5" /></span>{titulo}
      {total > 0 && <button type="button" onClick={onVerTodos} className="ml-auto inline-flex items-center text-[11.5px] font-semibold text-[#2563eb] hover:underline dark:text-blue-300">Ver os {formatNumber(total)} <ChevronRight className="h-3.5 w-3.5" /></button>}
    </p>
    {itens.length === 0 ? <p className="mt-3 text-[12px] text-gray-400">{vazio}</p> : (
      <ul className="mt-2 space-y-1">
        {itens.map((i) => (
          <li key={i.k} className="flex items-baseline justify-between gap-3 rounded-md bg-gray-50 px-2.5 py-1.5 text-[11.5px] dark:bg-gray-800/40">
            <span className="min-w-0 truncate font-medium text-gray-800 dark:text-gray-200">{i.nome}</span>
            <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-300">{i.dir}</span>
          </li>
        ))}
      </ul>
    )}
    {rodape && <p className="mt-auto pt-2 text-[11px] text-gray-500 dark:text-gray-400">{rodape}</p>}
  </section>
)

const Quad = ({ titulo, sub, Icon, q, cls }: { titulo: string; sub: string; Icon: typeof Fuel; q: { n: number; v: number }; cls: string }) => (
  <div className={cn('rounded-lg border px-3 py-2.5', cls)}>
    <p className="flex items-center gap-1 text-[12px] font-semibold text-gray-900 dark:text-gray-100"><Icon className="h-3.5 w-3.5" /> {titulo}</p>
    <p className="text-[10px] text-gray-500 dark:text-gray-400">{sub}</p>
    <p className="mt-1.5 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(q.n)}</p>
    <p className="text-[10.5px] tabular-nums text-gray-500 dark:text-gray-400">{formatCurrencyInt(q.v)} em estoque</p>
  </div>
)

export default EstoqueVisaoGeral
