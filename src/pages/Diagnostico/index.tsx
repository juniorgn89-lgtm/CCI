import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { AlertTriangle, TrendingUp, Info, Droplets, Store, Wrench, CalendarRange, ArrowRight, Loader2, Target, Database, X, ChevronDown, ChevronUp, MessageSquareText, HelpCircle, Users, Wallet, MessageCircle, Building2, type LucideIcon } from 'lucide-react'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useFilterStore } from '@/store/filters'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { narrar, type Narrativa } from '@/pages/Diagnostico/lib/narrativa'
import useDiagnosticoExtras from '@/pages/Diagnostico/hooks/useDiagnosticoExtras'
import type { Equipe, Financeiro, StatusPilar } from '@/pages/Diagnostico/lib/pilares'
import { useChartTheme } from '@/lib/chartTheme'
import { formatCurrency, formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import ShareReportButton from '@/components/feedback/ShareReportButton'
import type { ReportPayload, ReportRow } from '@/lib/report/reportTypes'
import useDiagnostico from '@/pages/Diagnostico/hooks/useDiagnostico'
import { addMeses, deJanelaB, mesLabel, mesLabelExtenso, mesLabelLongo, periodoCustomPadrao, type Achado, type Diagnostico, type ModoJanela, type PeriodoCustom, type ProdutoLoja } from '@/pages/Diagnostico/lib/diagnostico'
import type { PostoAPosto } from '@/pages/Diagnostico/lib/postos'
import SaudeCard from '@/pages/Diagnostico/components/SaudeCard'
import Capa from '@/pages/Diagnostico/components/Capa'
import AlemDoVisor from '@/pages/Diagnostico/components/AlemDoVisor'
import Recomendacoes from '@/pages/Diagnostico/components/Recomendacoes'
import { recomendar, type Recomendacao } from '@/pages/Diagnostico/lib/recomendacoes'
import useCciServicos from '@/hooks/useCciServicos'
import { NOME_SERVICO_CCI } from '@/api/supabase/cciServicos'
import { SecaoTitulo, NumeroBola, Sobrelinha, SimboloCCI } from '@/pages/Diagnostico/components/Marca'
import { CCI, FONTE_TITULO, carregarFonteMarca } from '@/pages/Diagnostico/lib/marca'
import { calcularSaude, rotuloNivel } from '@/pages/Diagnostico/lib/saude'
import { todayLocal } from '@/lib/period'

const CHAVE_INTRO = 'visor360.diagnostico.intro.v1'
const lerIntro = () => { try { return localStorage.getItem(CHAVE_INTRO) !== 'ok' } catch { return true } }

/**
 * Diagnóstico do posto: um ano contra o anterior, do jeito que a consultoria
 * precisa pra abrir a primeira reunião. Só cache apurado; comparação pareada
 * (mês com dado nos dois anos); meses que faltam são ditos, não inventados.
 */

const card = 'rounded-2xl border border-[#0F766E]/15 bg-white p-5 shadow-[0_10px_30px_rgba(11,74,68,.06)] dark:border-white/10 dark:bg-[#0b2e2b]'
const pct = (v: number, casas = 2) => `${v.toFixed(casas).replace('.', ',')}%`
const varPct = (a: number, b: number | null | undefined) => (b && b > 0 ? ((a - b) / b) * 100 : null)

const Delta = ({ atual, anterior, invert, casas = 1, suffix = '' }: { atual: number; anterior: number | null | undefined; invert?: boolean; casas?: number; suffix?: string }) => {
  const v = varPct(atual, anterior)
  if (v === null) return <span className="text-[11px] text-gray-400">sem base</span>
  const bom = invert ? v <= 0 : v >= 0
  return <span className={cn('text-[12px] font-semibold tabular-nums', Math.abs(v) < 0.05 ? 'text-gray-500' : bom ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{v > 0 ? '+' : ''}{v.toFixed(casas).replace('.', ',')}%{suffix}</span>
}

const DeltaPp = ({ atual, anterior }: { atual: number; anterior: number | null | undefined }) => {
  if (anterior == null) return <span className="text-[11px] text-gray-400">sem base</span>
  const d = atual - anterior
  return <span className={cn('text-[12px] font-semibold tabular-nums', Math.abs(d) < 0.05 ? 'text-gray-500' : d >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{d > 0 ? '+' : ''}{d.toFixed(2).replace('.', ',')} pp</span>
}

const TIPO: Record<Achado['tipo'], { label: string; cls: string; Icon: typeof AlertTriangle }> = {
  alerta: { label: 'Atenção', cls: 'border-red-200 bg-red-50/70 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200', Icon: AlertTriangle },
  oportunidade: { label: 'Oportunidade', cls: 'border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200', Icon: Target },
  destaque: { label: 'Ponto forte', cls: 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200', Icon: TrendingUp },
  nota: { label: 'Para saber', cls: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-white/[0.04] dark:text-gray-200', Icon: Info },
}

const Diagnostico = () => {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  // A tela abre em guia nova a partir da Central: "Fechar" fecha a guia e o
  // Visor que já estava aberto continua lá. Se a guia foi aberta direto pela
  // URL (o navegador não deixa fechar), volta para a Central.
  const fecharGuia = () => {
    window.close()
    window.setTimeout(() => { if (!window.closed) navigate('/dashboard') }, 250)
  }
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const canApurar = useAuthStore((s) => s.canApurar || s.isMaster)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const empresas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const nomeDe = useCallback((c: number) => { const e = empresas.find((x) => x.codigo === c); return e ? e.fantasia || e.razao || `Posto ${c}` : `Posto ${c}` }, [empresas])

  // Escopo: um posto (código) ou a rede inteira ('rede').
  const paramEmpresa = params.get('empresa')
  const [empresaSel, setEmpresa] = useState<number | 'rede' | null>(paramEmpresa === 'rede' ? 'rede' : Number(paramEmpresa) || null)
  const modoParam = params.get('modo')
  const [modo, setModo] = useState<ModoJanela>(modoParam === 'ano' ? 'ano' : modoParam === 'custom' ? 'custom' : modoParam === 'mes' ? 'mes' : modoParam === 'cci' ? 'cci' : '12m')
  // Modo "mês": o mês escolhido (só mês fechado; o atual ainda está em andamento).
  const ultimoFechado = addMeses(todayLocal().slice(0, 7), -1)
  const [mesSel, setMesSel] = useState<string>(() => { const v = params.get('mes'); return v && /^\d{4}-\d{2}$/.test(v) && v <= ultimoFechado ? v : ultimoFechado })
  // Período personalizado: mês inicial/final do atual e início do comparativo.
  const [custom, setCustom] = useState<PeriodoCustom>(() => {
    const padrao = periodoCustomPadrao(todayLocal())
    const ok = (v: string | null) => (v && /^\d{4}-\d{2}$/.test(v) ? v : null)
    return { de: ok(params.get('de')) ?? padrao.de, ate: ok(params.get('ate')) ?? padrao.ate, base: ok(params.get('base')) ?? padrao.base }
  })
  // Fonte de título da marca (Bricolage), só enquanto o Diagnóstico está aberto.
  useEffect(() => carregarFonteMarca(), [])
  // Os números detalhados ficam dobrados: o texto é o produto; a tabela, a prova.
  const [verNumeros, setVerNumeros] = useState(false)
  const rede = useTenantStore((st) => st.rede)
  const isMaster = useAuthStore((st) => st.isMaster)
  // Explicação da apuração: aparece até o usuário dispensar (volta pelo "?").
  const [introAberta, setIntroAberta] = useState(lerIntro)
  const fecharIntro = () => { setIntroAberta(false); try { localStorage.setItem(CHAVE_INTRO, 'ok') } catch { /* sem storage */ } }
  // Posto efetivo: o escolhido (ou a rede); senão o do filtro global (se único); senão o primeiro permitido.
  const empresa = useMemo<number | 'rede' | null>(() => {
    if (empresaSel === 'rede') return empresas.length > 1 ? 'rede' : empresas[0]?.codigo ?? null
    if (empresaSel != null) return empresaSel
    if (empresas.length === 0) return null
    const unico = empresaCodigos.length === 1 ? empresaCodigos[0] : null
    return unico && empresas.some((e) => e.codigo === unico) ? unico : empresas[0].codigo
  }, [empresaSel, empresas, empresaCodigos])
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (empresa != null) next.set('empresa', String(empresa)); else next.delete('empresa')
    next.set('modo', modo)
    if (modo === 'custom') { next.set('de', custom.de); next.set('ate', custom.ate); next.set('base', custom.base) } else { next.delete('de'); next.delete('ate'); next.delete('base') }
    if (modo === 'mes') next.set('mes', mesSel); else next.delete('mes')
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [empresa, modo, custom, mesSel, params, setParams])

  const escopoRede = empresa === 'rede'
  const codes = useMemo<number[] | null>(() => (escopoRede ? empresas.map((e) => e.codigo) : typeof empresa === 'number' ? [empresa] : null), [escopoRede, empresas, empresa])
  // Marco do "antes e depois da CCI": data informada em Admin › Redes; sem ela, o cadastro da rede no Visor.
  const marcoCci = rede?.cliente_desde ?? (rede?.created_at ? rede.created_at.slice(0, 10) : null)
  const marcoOrigem: 'admin' | 'cadastro' | null = rede?.cliente_desde ? 'admin' : rede?.created_at ? 'cadastro' : null
  const { diagnostico: d, mesAnterior, postos, achadosPorPosto, isLoading, isError, a, b } = useDiagnostico(codes, modo, modo === 'custom' ? custom : undefined, modo === 'mes' ? mesSel : null, escopoRede ? 'rede' : 'posto', nomeDe, marcoCci)
  const mesesFaltando = d ? [...d.cobertura.faltamB, ...d.cobertura.faltamA] : []
  const extras = useDiagnosticoExtras(codes, d?.temDados ? d : null)
  // Serviços da CCI contratados por posto (cópia diária do Prospecção360).
  const cci = useCciServicos()
  const nomeRede = rede?.nome ? (/^rede\b/i.test(rede.nome) ? rede.nome : `Rede ${rede.nome}`) : 'Toda a rede'
  const nomePosto = escopoRede ? nomeRede : typeof empresa === 'number' ? nomeDe(empresa) : ''
  // Modo "mês": leitura extra contra o mês imediatamente anterior.
  const mesAnt = mesAnterior?.totB ? { tot: mesAnterior.totB, rotulo: mesAnterior.b.rotulo } : null

  const build = (): ReportPayload => {
    if (!d) return { title: 'Diagnóstico do posto', kpis: [], sections: [] }
    const tb = d.totB
    const kv = (label: string, va: string, vb: string | null) => ({ label, value: vb ? `${va} (antes ${vb})` : va })
    const rows = (xs: ReportRow[]) => xs
    const nar = narrar(d, nomePosto, mesAnt, modo)
    const txt = (xs: string[]): ReportRow[] => xs.map((t) => ({ label: t, value: '' }))
    return {
      title: `Diagnóstico ${escopoRede ? 'da' : 'do'} ${nomePosto}`,
      subtitle: `${d.a.rotulo} contra ${d.b.rotulo}${mesAnt ? ` e contra ${mesAnt.rotulo}` : ''} · ${d.pareados.a.length === 1 ? '1 mês comparável' : `${d.pareados.a.length} meses comparáveis`} · venda fiscal apurada`,
      kpis: [
        kv('Litros', formatLiters(d.totA.litros), tb ? formatLiters(tb.litros) : null),
        kv('Faturamento', formatCurrencyInt(d.totA.faturamento), tb ? formatCurrencyInt(tb.faturamento) : null),
        kv('Lucro bruto', formatCurrencyInt(d.totA.lucroBruto), tb ? formatCurrencyInt(tb.lucroBruto) : null),
        kv('Margem', pct(d.totA.margem), tb ? pct(tb.margem) : null),
      ],
      sections: [
        ...(extras.pilares ? [(() => {
          const s = calcularSaude(extras.pilares)
          return { title: escopoRede ? 'Saúde da rede' : 'Saúde do posto', rows: [
            { label: s.pontos != null ? `${s.pontos} de 100 · ${rotuloNivel(s.nivel)}` : 'Sem base para a nota', value: '', strong: true },
            { label: 'Faixas: Crítico 0 a 49 · Em atenção 50 a 74 · Saudável 75 a 100. Pesos: venda e margem 35, financeiro 25, loja 15, equipe da pista 15, equipe da loja 10. Pilar sem dado fica fora da conta.', value: '' },
            ...(s.pesam.length ? [{ label: `O que pesa: ${s.pesam.map((p) => `${p.nome.toLowerCase()} (${STATUS_LABEL[p.status].toLowerCase()})`).join(', ')}.`, value: '' }] : []),
          ] }
        })()] : []),
        { title: 'Em uma conversa', rows: txt([nar.abertura, nar.veredito]) },
        ...(nar.bem.length ? [{ title: 'O que está indo bem', rows: txt(nar.bem) }] : []),
        ...(nar.preocupa.length ? [{ title: 'O que preocupa', rows: txt(nar.preocupa) }] : []),
        { title: 'Por onde eu começaria', rows: nar.prioridades.map((p, i) => ({ label: `${i + 1}. ${p.acao}`, value: p.ganho ?? '', sub: p.porque })) },
        ...(extras.pilares ? [{ title: 'Os pilares', rows: extras.pilares.map((p) => ({ label: p.nome, value: STATUS_LABEL[p.status], sub: p.frase })) }] : []),
        ...(postos && postos.postos.length >= 2 ? [{ title: 'Posto a posto', rows: [...txt(postos.frases), ...postos.postos.map((p) => ({ label: p.nome, value: `${formatCurrencyInt(p.lucroMes)}${d.a.meses.length === 1 ? '' : '/mês'}${p.varLucro != null ? ` (${p.varLucro >= 0 ? '+' : ''}${p.varLucro.toFixed(0)}%)` : ''}`, sub: `${formatLiters(p.litrosMes)} · ${formatCurrency(p.lbPorLitro)}/L · margem ${pct(p.margem)}${p.lucroLojaMes > 0 ? ` · loja ${pct(p.shareLoja, 0)} do lucro` : ' · sem loja'}` }))] }] : []),
        ...(extras.financeiro ? [{ title: 'Financeiro', rows: txt(extras.financeiro.frases) }] : []),
        ...(extras.equipe ? [{ title: 'Equipe da pista', rows: txt(extras.equipe.pista.frases) }, { title: 'Equipe da loja', rows: txt(extras.equipe.loja.frases) }] : []),
        { title: 'O que ainda não dá para afirmar', rows: txt(nar.limites) },
        { title: 'Próximo passo com a CCI', rows: txt([PROXIMO_PASSO, 'Está em dúvida do que fazer? Entre em contato com os consultores da CCI: WhatsApp (27) 99724-5222. Eles vão te ajudar.']) },
        { title: 'Onde a consultoria entra', rows: rows(d.achados.map((x) => ({ label: `${TIPO[x.tipo].label} · ${x.titulo}`, value: x.impactoMes && x.impactoMes >= 50 ? `${formatCurrencyInt(x.impactoMes)}/mês` : '', sub: `${x.detalhe}${x.alavanca ? ` Alavanca: ${x.alavanca}` : ''}` }))) },
        { title: 'Mês a mês · lucro bruto', rows: rows(d.mesAMes.map((m) => ({ label: `${mesLabel(m.mesA)} vs ${mesLabel(m.mesB)}`, value: m.a ? formatCurrencyInt(m.a.lb) : 'sem dado', sub: m.b ? `antes ${formatCurrencyInt(m.b.lb)} · litros ${formatLiters(m.a?.litros ?? 0)} vs ${formatLiters(m.b.litros)}` : 'sem dado no período de comparação' }))) },
        { title: 'Combustíveis', rows: rows(d.combustiveis.filter((p) => p.a).map((p) => ({ label: p.nome, value: `${formatCurrency(p.a!.margemL)}/L`, sub: `${formatLiters(p.a!.litros)} · preço ${formatCurrency(p.a!.preco)} · custo ${formatCurrency(p.a!.custo)}${p.b ? ` · antes ${formatCurrency(p.b.margemL)}/L em ${formatLiters(p.b.litros)}` : ''}` }))) },
        { title: 'Loja · maiores lucros', rows: rows(d.loja.top.map((p) => ({ label: p.nome, value: formatCurrencyInt(p.a!.lb), sub: `fat. ${formatCurrencyInt(p.a!.fat)} · margem ${pct(p.a!.margem)}${p.b ? ` · antes LB ${formatCurrencyInt(p.b.lb)}` : ''}` }))) },
      ],
      footnote: 'Visor360 · venda fiscal apurada · comparação só entre meses com dado nos dois anos · somente leitura.',
    }
  }

  // Master sem rede escolhida: a tela não tem o seletor do layout padrão.
  if (isMaster && !rede) return <Navigate to="/painel/selecionar-rede" replace />

  const narrativa = d && d.temDados ? narrar(d, nomePosto, mesAnt, modo) : null
  // Número da seção "Os números": depois da Saúde (01), das seções que o Artigo mostrar e do "Além dos números".
  // Serviços da CCI que este diagnóstico justifica (só com o sinal nos números).
  // Serviços CCI já contratados (Prospecção): contratado em TODOS os postos do escopo sai da lista;
  // em parte deles, fica com o aviso de onde já existe.
  const postosEscopo = codes ?? []
  const servicosAtivos = [...new Set(postosEscopo.flatMap((c) => [...(cci.ativosPorPosto.get(c) ?? [])]))].map((id) => NOME_SERVICO_CCI[id] ?? id)
  const recs: Recomendacao[] = (d?.temDados && !extras.carregandoEquipe && !extras.carregandoFinanceiro && !cci.carregando ? recomendar({ d, pilares: extras.pilares, financeiro: extras.financeiro, equipe: extras.equipe }) : [])
    .flatMap((r) => {
      const em = postosEscopo.filter((c) => cci.ativosPorPosto.get(c)?.has(r.id))
      if (postosEscopo.length > 0 && em.length === postosEscopo.length) return []
      return [em.length > 0 ? { ...r, contratado: { em: em.map(nomeDe), total: postosEscopo.length } } : r]
    })
  const secNumeros = 3 + (recs.length > 0 ? 1 : 0) + (narrativa ? [narrativa.bem.length + narrativa.preocupa.length > 0, narrativa.prioridades.length > 0, (d?.achados.length ?? 0) > 0, !!postos && postos.postos.length >= 2, !!extras.equipe || !!extras.financeiro].filter(Boolean).length : 0)
  const seletorCls = 'h-9 rounded-lg border border-white/20 bg-white/10 px-2 text-sm text-white focus:border-white/50 focus:outline-none [&>option]:text-gray-900'

  return (
    <div className="min-h-screen bg-[#F2F5F4] text-gray-900 dark:bg-[#061e1c] dark:text-gray-100">
      {/* Barra própria: sem menu lateral, sem cabeçalho do Visor. */}
      <header className="sticky top-0 z-20 text-white shadow-md" style={{ background: `linear-gradient(90deg, ${CCI.tealFundo}, ${CCI.tealEscuro})` }}>
        <div className="mx-auto max-w-5xl px-4 pb-3 pt-2.5">
          {/* Linha 1: identificação à esquerda, Compartilhar à direita (no celular ele desce). */}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={fecharGuia} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-white/80 hover:bg-white/10 hover:text-white" title="Fecha esta guia; o Visor360 continua aberto na outra">
              <X className="h-4 w-4" /> Fechar
            </button>
            <span className="hidden text-[12px] font-semibold text-white/60 sm:inline">Visor<span className="text-[#14b8a6]">360</span></span>
            <div className="flex min-w-0 flex-1 items-center gap-2 border-l border-white/15 pl-3">
              <SimboloCCI className="h-6 w-6 shrink-0" claro />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight">{escopoRede ? 'Diagnóstico da rede' : 'Diagnóstico do posto'}</p>
                <p className="truncate text-[11px] text-white/70">{modo === 'cci' ? 'o que mudou desde que a CCI entrou · ' : ''}{a.rotulo} <span className="text-white/45">contra</span> {b.rotulo}{modo === 'mes' ? <> <span className="text-white/45">e contra</span> {mesLabelExtenso(addMeses(mesSel, -1))}</> : null}{modo === 'custom' ? <> · {a.meses.length} {a.meses.length === 1 ? 'mês' : 'meses'}</> : null}</p>
              </div>
            </div>
            {d?.temDados && <ShareReportButton filename={`diagnostico-${(nomePosto || 'posto').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`} build={build} className="ml-auto h-9 shrink-0 border-white/20 bg-white/10 text-white hover:border-white hover:text-white dark:border-white/20 dark:bg-white/10 dark:text-white" />}
          </div>
          {/* Linha 2: filtros, sempre alinhados à esquerda; mês/personalizado entram na mesma linha. */}
          <div className="mt-2.5 flex flex-wrap items-end gap-x-3 gap-y-2">
            <label className="flex flex-col text-[10px] font-semibold uppercase tracking-wider text-white/60">
              Posto
              <select value={empresa ?? ''} onChange={(e) => setEmpresa(e.target.value === 'rede' ? 'rede' : Number(e.target.value) || null)} className={cn(seletorCls, 'mt-1 min-w-[200px]')}>
                {empresas.length > 1 && <option value="rede">Toda a rede ({empresas.length} postos)</option>}
                {empresas.map((e) => <option key={e.codigo} value={e.codigo}>{e.fantasia || e.razao}</option>)}
              </select>
            </label>
            <div className="flex flex-col text-[10px] font-semibold uppercase tracking-wider text-white/60">
              Janela
              <div className="mt-1 inline-flex min-h-9 max-w-full flex-wrap rounded-lg bg-white/10 p-0.5">
                {([['mes', 'Mês'], ['12m', 'Últimos 12 meses'], ['ano', 'Ano até o mês passado'], ['cci', 'Antes e depois da CCI'], ['custom', 'Personalizar']] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setModo(id)} className={cn('h-8 whitespace-nowrap rounded-md px-3 text-[12px] font-semibold normal-case tracking-normal transition-colors', modo === id ? 'bg-[#FCB619] text-[#0B4A44] shadow-sm' : 'text-white/80 hover:text-white')}>{label}</button>
                ))}
              </div>
            </div>
            {modo === 'mes' && (
              <>
                <label className="flex flex-col text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  Mês
                  <input type="month" value={mesSel} max={ultimoFechado} onChange={(e) => e.target.value && e.target.value <= ultimoFechado && setMesSel(e.target.value)} className={cn(seletorCls, 'mt-1')} />
                </label>
              </>
            )}
            {modo === 'cci' && (
              <p className="pb-2 text-[11px] text-white/70">
                {marcoCci
                  ? <>Cliente CCI desde <b className="text-white">{new Date(`${marcoCci}T12:00:00`).toLocaleDateString('pt-BR')}</b>{marcoOrigem === 'cadastro' ? <span className="text-white/50"> (data do cadastro no Visor; a data real se ajusta em Admin › Redes)</span> : null}</>
                  : 'Sem data de início da CCI cadastrada: informe em Admin › Redes.'}
              </p>
            )}
            {modo === 'custom' && (
              <>
                <label className="flex flex-col text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  Período atual · de
                  <input type="month" value={custom.de} max={custom.ate} onChange={(e) => e.target.value && setCustom({ ...custom, de: e.target.value })} className={cn(seletorCls, 'mt-1')} />
                </label>
                <label className="flex flex-col text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  até
                  <input type="month" value={custom.ate} min={custom.de} onChange={(e) => e.target.value && setCustom({ ...custom, ate: e.target.value })} className={cn(seletorCls, 'mt-1')} />
                </label>
                <label className="flex flex-col text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  Comparar com · a partir de
                  <input type="month" value={custom.base} onChange={(e) => e.target.value && setCustom({ ...custom, base: e.target.value })} className={cn(seletorCls, 'mt-1')} />
                </label>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-6 sm:py-8">
        {/* Capa: o veredito e os 4 números que contam a história. */}
        {narrativa && d && <Capa d={d} n={narrativa} servicosCci={servicosAtivos} posto={nomePosto} periodo={`${d.a.rotulo} · contra ${d.b.rotulo}`} sujeito={escopoRede ? 'rede' : 'posto'} />}

        {/* O que é a apuração e por que o diagnóstico depende dela */}
        {introAberta && (
          <div className={cn(card, 'relative border-[#0F766E]/30 dark:border-teal-500/30')}>
            <button type="button" onClick={fecharIntro} aria-label="Fechar explicação" className="absolute right-3 top-3 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
            <p className="inline-flex items-center gap-2 text-sm font-semibold"><Database className="h-4 w-4 text-[#0F766E] dark:text-teal-300" /> Antes de ler: de onde vêm estes números</p>
            <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-gray-700 dark:text-gray-300">
              <p>Tudo aqui sai da <b>apuração</b>: o Visor lê a venda fiscal do WebPosto dia a dia e guarda o resultado por mês e produto. É a mesma base da Central e das abas de vendas.</p>
              <p>Só mês apurado entra. O diagnóstico não consulta o ERP ao vivo nem estima: mês que não foi apurado aparece como "falta", e mês apurado pela metade fica fora da comparação.</p>
              <p><b>Cliente novo:</b> para comparar ano contra ano, apure também os 12 meses anteriores em <b>Painel › Apuração</b> (um clique por mês). Leva alguns minutos por mês e só precisa ser feito uma vez.</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {canApurar
                ? <Link to="/painel/apuracao" className="inline-flex items-center gap-1 rounded-lg bg-[#0F766E] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0B4F4A] dark:bg-teal-700 dark:hover:bg-teal-600">Abrir a Apuração <ArrowRight className="h-3.5 w-3.5" /></Link>
                : <span className="text-[12px] text-gray-500">Quem apura é o perfil com permissão de apuração (master ou supervisor).</span>}
              <button type="button" onClick={fecharIntro} className="text-[12px] font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">Entendi, não mostrar de novo</button>
            </div>
          </div>
        )}
        {!introAberta && mesesFaltando.length > 0 && d?.temDados && (
          <div className={cn(card, 'flex flex-wrap items-center gap-3 border-amber-300 dark:border-amber-800')}>
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="min-w-0 flex-1 text-[12.5px] text-gray-700 dark:text-gray-200">
              <b>Faltam {mesesFaltando.length} {mesesFaltando.length === 1 ? 'mês apurado' : 'meses apurados'}</b> para a comparação completa: {mesesFaltando.map(mesLabel).join(', ')}.
            </p>
            {canApurar && <Link to="/painel/apuracao" className="inline-flex items-center gap-1 rounded-lg bg-[#0F766E] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0B4F4A] dark:bg-teal-700 dark:hover:bg-teal-600">Apurar agora <ArrowRight className="h-3.5 w-3.5" /></Link>}
            <button type="button" onClick={() => setIntroAberta(true)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"><HelpCircle className="h-3.5 w-3.5" /> Como funciona?</button>
          </div>
        )}

        {isLoading && <div className={cn(card, 'flex items-center gap-2 text-sm text-gray-500')}><Loader2 className="h-4 w-4 animate-spin" /> Lendo os meses apurados…</div>}
        {isError && <div className={cn(card, 'text-sm text-red-600')}>Não foi possível ler a apuração deste posto.</div>}

        {d && !d.temDados && (
          <div className={cn(card, 'border-amber-300 dark:border-amber-800')}>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200"><AlertTriangle className="h-4 w-4" /> {escopoRede ? 'A rede' : 'Este posto'} ainda não tem venda apurada em {a.rotulo}.</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">O diagnóstico lê só o que já foi apurado (a venda fiscal consolidada por mês). Apure os meses de {mesLabel(b.ini)} a {mesLabel(a.fim)} em Painel › Apuração e volte aqui.</p>
            {canApurar && <Link to="/painel/apuracao" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#1e3a5f] hover:underline dark:text-blue-300">Abrir a Apuração <ArrowRight className="h-4 w-4" /></Link>}
          </div>
        )}


        {/* 01 · Saúde: a nota dos pilares, com as faixas à vista. */}
        {d?.temDados && (
          <section>
            <SecaoTitulo n={1} sobre={escopoRede ? 'Saúde da rede' : 'Saúde do posto'} titulo="A nota tirada dos cinco pilares" />
            <SaudeCard pilares={extras.pilares} sujeito={escopoRede ? 'rede' : 'posto'} carregando={extras.carregandoEquipe || extras.carregandoFinanceiro} Enfase={Enfase} />
          </section>
        )}

        {narrativa && d && <Artigo n={narrativa} posto={nomePosto} postos={postos} equipe={extras.equipe} financeiro={extras.financeiro} achados={d.achados} recs={recs} sujeito={escopoRede ? 'rede' : 'posto'} inicio={1} ondeAparece={achadosPorPosto ? (x: Achado) => {
          // Postos em que o MESMO achado (regra + produto, mesmo sentido) aparece, do maior impacto ao menor.
          const out: { nome: string; impacto: number | null }[] = []
          for (const [c, lista] of achadosPorPosto) {
            const y = lista.find((z) => z.chave === x.chave && z.tipo === x.tipo)
            if (y) out.push({ nome: nomeDe(c), impacto: y.impactoMes != null && y.impactoMes >= 50 ? y.impactoMes : null })
          }
          return out.sort((p, q) => (q.impacto ?? 0) - (p.impacto ?? 0))
        } : undefined} />}

        {d && d.temDados && (
          <section>
            <SecaoTitulo n={secNumeros} sobre="Os números" titulo="O que sustenta cada frase" sub="Resumo, mês a mês, combustíveis e loja, sobre os meses comparáveis." acao={
              <button type="button" onClick={() => setVerNumeros((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#0F766E]/30 bg-white px-4 py-2 text-[13px] font-bold text-[#0B4A44] shadow-sm hover:border-[#0F766E] dark:border-white/15 dark:bg-[#0b2e2b] dark:text-white">
                {verNumeros ? <>Esconder <ChevronUp className="h-4 w-4" /></> : <>Ver os números <ChevronDown className="h-4 w-4" /></>}
              </button>
            } />
            {verNumeros && <div className="space-y-4"><Corpo d={d} nomePosto={nomePosto} canApurar={canApurar} /></div>}
          </section>
        )}

        {/* Rodapé como o dos slides */}
        <footer className="flex flex-wrap items-center gap-2 border-t border-[#0F766E]/15 pt-4 text-[11px] tracking-[0.2em] text-gray-500 dark:border-white/10">
          <SimboloCCI className="h-4 w-4" />
          <b className="font-extrabold text-[#0F766E] dark:text-teal-300" style={{ fontFamily: FONTE_TITULO }}>CCI</b>
          <span>·</span>
          <span>{escopoRede ? 'Diagnóstico da rede' : 'Diagnóstico do posto'}</span>
        </footer>
      </main>
    </div>
  )
}

/** Posto a posto (só no diagnóstico da rede): frases + tabela enxuta, valores por mês. */
const PostoAPostoSecao = ({ dados }: { dados: PostoAPosto }) => {
  const umMes = dados.postos[0]?.meses === 1
  return (
    <section className="mt-6">
      <Titulo Icon={Building2} cor={TIT}>Posto a posto</Titulo>
      {dados.frases.length > 0 && <Lista itens={dados.frases} cor={DOT} />}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12.5px]">
          <thead className="text-[10px] uppercase tracking-wider text-gray-400">
            <tr>
              <th className="py-1.5 pr-3 text-left font-semibold">Posto</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">{umMes ? 'Litros' : 'Litros/mês'}</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">{umMes ? 'Lucro' : 'Lucro/mês'}</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">Δ lucro</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">R$/L</th>
              <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">Margem</th>
              <th className="whitespace-nowrap py-1.5 pl-2 text-right font-semibold">Loja no lucro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {dados.postos.map((p) => (
              <tr key={p.codigo} className="text-gray-800 dark:text-gray-200">
                <td className="py-1.5 pr-3 font-medium">{p.nome}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatNumber(Math.round(p.litrosMes))}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums">{formatCurrencyInt(p.lucroMes)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right"><Delta atual={p.lucroMes} anterior={p.lucroMesB} casas={0} /></td>
                <td className={cn('whitespace-nowrap px-2 py-1.5 text-right tabular-nums', p.lbPorLitro < dados.lbPorLitroRede - 0.03 && 'text-red-600 dark:text-red-400')}>{formatCurrency(p.lbPorLitro)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{pct(p.margem, 1)}</td>
                <td className="whitespace-nowrap py-1.5 pl-2 text-right tabular-nums">{p.lucroLojaMes > 0 ? pct(p.shareLoja, 0) : <span className="text-gray-400">sem loja</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11px] text-gray-400">R$/L em vermelho = abaixo da média da rede ({formatCurrency(dados.lbPorLitroRede)}). Δ lucro contra o período de comparação, sobre os mesmos meses.</p>
    </section>
  )
}

const STATUS_LABEL: Record<StatusPilar, string> = { bom: 'Bem', atencao: 'Atenção', critico: 'Crítico', sem_dado: 'Sem dado' }

/** WhatsApp dos consultores da CCI para dúvidas sobre o diagnóstico. */
const CCI_WHATSAPP = '5527997245222'
const linkWhatsapp = (posto: string, prioridade: string | null) =>
  `https://wa.me/${CCI_WHATSAPP}?text=${encodeURIComponent(`Olá! Vi o Diagnóstico do ${posto} no Visor360 e quero ajuda dos consultores da CCI.${prioridade ? ` Primeiro ponto: ${prioridade}` : ''}`)}`

const PROXIMO_PASSO = 'Este é o primeiro olhar, feito só com os números já apurados. A consultoria da CCI senta com o posto, confere o que precisa de ajuste (custos lançados, cadastros, meses que faltam, loja e equipe fora do cupom) e transforma estes pontos num plano com dono, prazo e meta.'

/**
 * Destaque nos números, com a cor do sentido: vermelho no que é negativo
 * (vencido, atraso, caiu, custo absorvido, quem saiu), verde no positivo
 * (subiu, cresceu, no prazo, quem entrou), azul no neutro. A cor vem da palavra
 * mais próxima do número dentro da mesma oração — regra fixa, sem tocar no texto.
 */
const RE_NUM = /(R\$\s?[\d.,]+(?:\s?(?:milh(?:ão|ões)|mil))?(?:\/L)?|[-+]?[\d.,]+\s?%|[\d.,]+\s?(?:mil |milh(?:ão|ões) de )?litros|[\d.,]+\s?pontos?\b|\d+(?:,\d+)?\s(?:meses|mês|dias|dia|frentistas?|vendedor(?:es)?|produtos|títulos?|cupons)\b|\d+,\d+×)/g
const NEG = ['custo subiu', 'não foram repassados', 'não repassad', 'parados na rua', 'em atraso', 'vencid', 'atrasad', 'absorveu', 'caiu', 'caíram', 'queda', 'sumiram', 'saíram', 'saiu', 'abaixo', 'perdeu', 'perda', 'devem', 'deve ', 'tira ', 'a pagar', 'só ', 'menos', 'ruptura', 'venda perdida']
const POS = ['subiu', 'subiram', 'subir', 'cresceu', 'cresceram', 'ganho', 'no prazo', 'entraram', 'entrou', 'coloca', 'acima', 'lidera', 'bem distribuído', 'vale cerca', 'vale muito', 'recuperado', 'não perdeu', 'ganhar']
type Tom = 'neg' | 'pos' | 'neutro'
const tomDe = (texto: string, idx: number, len: number): Tom => {
  const token = texto.slice(idx, idx + len)
  if (/^[-−]/.test(token)) return 'neg'
  if (/^\+/.test(token)) return 'pos'
  // Oração = entre pontuações fortes em volta do número. Dois-pontos e as
  // viradas ", mas" / ", ou seja" também cortam, pra "caiu X, mas o lucro foi de Y pra Z"
  // não pintar Y e Z de vermelho.
  const antes = texto.slice(0, idx), depois = texto.slice(idx + len)
  const CORTES = ['. ', '; ', '! ', ': ', ', mas ', ', ou seja', ', porém ']
  const iniO = Math.max(-1, ...CORTES.map((c) => { const p = antes.lastIndexOf(c); return p < 0 ? -1 : p + c.length - 1 })) + 1
  const fimRel = depois.search(/[.;!:]|, mas |, ou seja|, porém /)
  const fimO = idx + len + (fimRel < 0 ? depois.length : fimRel)
  const oracao = texto.slice(iniO, fimO).toLowerCase()
  const pos = idx - iniO
  const candidatos: { dist: number; len: number; tom: Tom }[] = []
  const varre = (lista: string[], tom: Tom) => {
    for (const k of lista) {
      let at = oracao.indexOf(k)
      while (at >= 0) {
        const dist = at < pos ? pos - (at + k.length) : at - (pos + len)
        candidatos.push({ dist, len: k.length, tom })
        at = oracao.indexOf(k, at + 1)
      }
    }
  }
  varre(NEG, 'neg'); varre(POS, 'pos')
  // A palavra mais próxima manda; em empate, a frase mais longa ("custo subiu" > "subiu").
  candidatos.sort((x, y) => x.dist - y.dist || y.len - x.len)
  const melhor = candidatos[0]
  return melhor && melhor.dist <= 60 ? melhor.tom : 'neutro'
}
const ENFASE_BASE = 'font-semibold text-gray-900 underline decoration-[1.5px] underline-offset-[3px] dark:text-white'
const COR_TOM: Record<Tom, string> = {
  neg: cn(ENFASE_BASE, 'decoration-red-500/70'),
  pos: cn(ENFASE_BASE, 'decoration-emerald-500/70'),
  neutro: cn(ENFASE_BASE, 'decoration-gray-400/70 dark:decoration-gray-500'),
}
const Enfase = ({ t }: { t: string }) => {
  const out: React.ReactNode[] = []
  let last = 0, i = 0
  for (const m of t.matchAll(RE_NUM)) {
    const idx = m.index ?? 0
    if (idx > last) out.push(<span key={i++}>{t.slice(last, idx)}</span>)
    out.push(<b key={i++} className={COR_TOM[tomDe(t, idx, m[0].length)]}>{m[0]}</b>)
    last = idx + m[0].length
  }
  if (last < t.length) out.push(<span key={i++}>{t.slice(last)}</span>)
  return <>{out}</>
}

/** Um tom só para títulos e marcadores: a cor fica reservada ao traço sob os números e ao ponto de status dos pilares. */
const TIT = 'text-gray-800 dark:text-gray-100'
const DOT = 'bg-gray-400 dark:bg-gray-500'

const Lista = ({ itens, cor }: { itens: string[]; cor: string }) => (
  <ul className="mt-2.5 space-y-2 text-[14px] leading-relaxed text-gray-700 dark:text-gray-300">
    {itens.map((t, i) => <li key={i} className="flex gap-2.5"><span className={cn('mt-[9px] h-1 w-1 shrink-0 rounded-full', cor)} /><span><Enfase t={t} /></span></li>)}
  </ul>
)

const Titulo = ({ Icon, cor, children }: { Icon: LucideIcon; cor: string; children: React.ReactNode }) => (
  <h2 className={cn('flex items-center gap-2 border-b border-gray-200 pb-1.5 text-[12px] font-bold uppercase tracking-wider dark:border-gray-800', cor)}><Icon className="h-3.5 w-3.5" /> {children}</h2>
)

/** O diagnóstico em seções numeradas, como a apresentação da CCI: o que vai bem e o que preocupa, por onde começar, onde a consultoria entra, a rede posto a posto, equipe e financeiro. */
const Artigo = ({ n, posto, postos, equipe, financeiro, achados, recs, sujeito, inicio, ondeAparece }: { n: Narrativa; posto: string; postos: PostoAPosto | null; equipe: Equipe | null; financeiro: Financeiro | null; achados: Achado[]; recs: Recomendacao[]; sujeito: 'posto' | 'rede'; inicio: number; ondeAparece?: (x: Achado) => { nome: string; impacto: number | null }[] }) => {
  // Resto do veredito (a manchete já está na capa).
  const corte = n.veredito.indexOf(':')
  const restoBruto = corte > 0 && corte < 60 ? n.veredito.slice(corte + 1).trim() : n.veredito
  const resto = restoBruto.charAt(0).toUpperCase() + restoBruto.slice(1)
  const emJogo = achados.reduce((s, x) => s + (x.impactoMes && x.impactoMes >= 50 && (x.tipo === 'alerta' || x.tipo === 'oportunidade') ? x.impactoMes : 0), 0)
  let sec = inicio
  return (
    <div className="space-y-12">
      {/* Veredito por extenso */}
      <p className="rounded-2xl border-l-4 border-[#FCB619] bg-white px-5 py-4 text-[17px] font-medium leading-relaxed text-[#0B4A44] shadow-[0_10px_30px_rgba(11,74,68,.06)] dark:bg-[#0b2e2b] dark:text-white"><Enfase t={resto} /></p>

      {(n.bem.length > 0 || n.preocupa.length > 0) && (
        <section>
          <SecaoTitulo n={++sec} sobre="Como está hoje" titulo={`${n.bem.length} ${n.bem.length === 1 ? 'ponto forte' : 'pontos fortes'} e ${n.preocupa.length} ${n.preocupa.length === 1 ? 'ponto de atenção' : 'pontos de atenção'}`} />
          <div className="grid gap-4 lg:grid-cols-2">
            {n.bem.length > 0 && (
              <div className={cn(card, 'border-t-4 border-t-[#0F766E]')}>
                <Sobrelinha className="text-[#0F766E] dark:text-teal-300">O que está indo bem</Sobrelinha>
                <ol className="mt-3 space-y-3">
                  {n.bem.map((t, i) => <li key={i} className="flex gap-3"><NumeroBola n={i + 1} tom="teal" /><p className="pt-1 text-[14px] leading-relaxed text-gray-700 dark:text-gray-200"><Enfase t={t} /></p></li>)}
                </ol>
              </div>
            )}
            {n.preocupa.length > 0 && (
              <div className={cn(card, 'border-t-4 border-t-[#E4572E]')}>
                <Sobrelinha className="text-[#C2410C] dark:text-orange-300">O que me preocupa</Sobrelinha>
                <ol className="mt-3 space-y-3">
                  {n.preocupa.map((t, i) => <li key={i} className="flex gap-3"><NumeroBola n={i + 1} tom="coral" /><p className="pt-1 text-[14px] leading-relaxed text-gray-700 dark:text-gray-200"><Enfase t={t} /></p></li>)}
                </ol>
              </div>
            )}
          </div>
        </section>
      )}

      {n.prioridades.length > 0 && (
        <section>
          <SecaoTitulo n={++sec} sobre="Por onde eu começaria" titulo={n.prioridades.length === 1 ? 'Um passo para começar' : `${n.prioridades.length} passos, em ordem`} />
          <ol className={cn('grid gap-3', n.prioridades.length >= 3 ? 'lg:grid-cols-3' : n.prioridades.length === 2 ? 'lg:grid-cols-2' : '')}>
            {n.prioridades.map((p, i) => (
              <li key={i} className={cn(card, 'relative flex flex-col gap-2 border-[#FCB619]/60')}>
                <div className="flex items-center justify-between">
                  <NumeroBola n={i + 1} />
                  {p.ganho && <span className="rounded-full bg-[#FCB619]/15 px-2.5 py-1 text-[12px] font-bold text-[#8a5a00] dark:text-[#FCD35E]">{p.ganho}</span>}
                </div>
                <p className="text-[16px] font-extrabold leading-snug text-[#0B4A44] dark:text-white" style={{ fontFamily: FONTE_TITULO }}><Enfase t={p.acao} /></p>
                <p className="text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-300"><Enfase t={p.porque} /></p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {achados.length > 0 && (
        <section>
          <SecaoTitulo n={++sec} sobre="Onde a consultoria entra"
            titulo={emJogo > 0 ? <>Cerca de <span className="text-[#C2410C] dark:text-orange-300">{formatCurrencyInt(emJogo)}</span> por mês em jogo</> : 'Os pontos fora da curva'}
            sub={<span className="inline-flex items-center gap-1">Regras fixas sobre os números apurados, com o impacto no ritmo atual. <InfoHint text="Queda ou ganho de volume, margem por litro, custo não repassado, loja, ticket, meses fora da curva, sazonalidade e concentração. O R$/mês é o impacto no ritmo atual do posto; a soma do título conta só os pontos de atenção e as oportunidades. Nada aqui é opinião de IA." /></span>} />
          <div className="grid gap-3 lg:grid-cols-2">
            {achados.map((x, i) => {
              const t = TIPO[x.tipo]
              const temValor = x.impactoMes != null && x.impactoMes >= 50
              return (
                <div key={i} className={cn(card, 'flex flex-col')}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', t.cls)}><t.Icon className="h-3 w-3" />{t.label}</span>
                    {temValor && <span className={cn('text-right text-[26px] font-extrabold leading-none tabular-nums', x.tipo === 'destaque' ? 'text-[#0F766E] dark:text-teal-300' : 'text-[#C2410C] dark:text-orange-300')} style={{ fontFamily: FONTE_TITULO }}>{formatCurrencyInt(x.impactoMes!)}<span className="block text-[11px] font-semibold text-gray-400">por mês</span></span>}
                  </div>
                  <p className="mt-2 text-[16px] font-extrabold leading-snug text-[#0B4A44] dark:text-white" style={{ fontFamily: FONTE_TITULO }}>{x.titulo}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-300">{x.detalhe}</p>
                  {ondeAparece && x.chave !== 'semBase' && (() => {
                    const onde = ondeAparece(x)
                    return (
                      <div className="mt-2.5 rounded-xl bg-[#F3F7F6] px-3 py-2 dark:bg-white/[0.04]">
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{onde.length === 0 ? 'Onde aparece' : `Onde aparece · ${onde.length} ${onde.length === 1 ? 'posto' : 'postos'}`}</p>
                        {onde.length === 0 ? (
                          <p className="mt-0.5 text-[12.5px] text-gray-600 dark:text-gray-300">Só na soma da rede: nenhum posto sozinho passa da régua deste ponto.</p>
                        ) : (
                          <ul className="mt-1 flex flex-wrap gap-1.5">
                            {onde.map((o) => (
                              <li key={o.nome} className="inline-flex items-center gap-1.5 rounded-full border border-[#0F766E]/20 bg-white px-2.5 py-0.5 text-[12px] font-semibold text-[#0B4A44] dark:border-white/15 dark:bg-[#0b2e2b] dark:text-white">
                                {o.nome}{o.impacto != null && <span className="font-normal tabular-nums text-gray-500 dark:text-gray-400">{formatCurrencyInt(o.impacto)}/mês</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })()}
                  {x.alavanca && <p className="mt-auto border-t border-gray-100 pt-2.5 text-[13px] font-semibold text-[#0F766E] dark:border-white/10 dark:text-teal-300">O que fazer: <span className="font-normal text-gray-700 dark:text-gray-200">{x.alavanca}</span></p>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Rede: o que a soma esconde. */}
      {postos && postos.postos.length >= 2 && (
        <section>
          <SecaoTitulo n={++sec} sobre="Posto a posto" titulo="O que a soma da rede esconde" />
          <PostoAPostoSecao dados={postos} />
        </section>
      )}

      {(equipe || financeiro) && (
        <section>
          <SecaoTitulo n={++sec} sobre="Equipe e financeiro" titulo="Quem vende e o que está na rua" />
          <div className="grid gap-4 lg:grid-cols-3">
            {equipe && (
              <div className={card}>
                <Sobrelinha className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Equipe da pista</Sobrelinha>
                <Lista itens={equipe.pista.frases} cor={DOT} />
              </div>
            )}
            {equipe && (
              <div className={card}>
                <Sobrelinha className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5" /> Equipe da loja</Sobrelinha>
                <Lista itens={equipe.loja.frases} cor={DOT} />
              </div>
            )}
            {financeiro && (
              <div className={card}>
                <Sobrelinha className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Financeiro</Sobrelinha>
                <Lista itens={financeiro.frases} cor={DOT} />
              </div>
            )}
          </div>
        </section>
      )}

      {(n.limites.length > 0 || n.fechamento) && (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {n.limites.length > 0 && (
            <div className={cn(card, 'bg-[#F3F7F6] dark:bg-white/[0.03]')}>
              <Sobrelinha className="flex items-center gap-1.5"><MessageSquareText className="h-3.5 w-3.5" /> O que ainda não dá para afirmar</Sobrelinha>
              <Lista itens={n.limites} cor={DOT} />
            </div>
          )}
          {n.fechamento && (
            <blockquote className="flex items-center rounded-2xl border-l-4 border-[#0F766E] bg-white px-5 py-4 text-[15px] leading-relaxed text-[#0B4A44] shadow-[0_10px_30px_rgba(11,74,68,.06)] dark:bg-[#0b2e2b] dark:text-gray-100"><span><Enfase t={n.fechamento} /></span></blockquote>
          )}
        </section>
      )}

      {/* O que só a consultoria cobre (cadastros, conciliação, DRE, treinamento). */}
      <AlemDoVisor n={++sec} />

      {/* Serviços da CCI que os números deste diagnóstico justificam. */}
      {recs.length > 0 && <Recomendacoes recs={recs} n={++sec} posto={posto} sujeito={sujeito} />}

      {/* Próximo passo — faixa escura como o "Resultado" dos slides */}
      <section className="relative overflow-hidden rounded-2xl text-white shadow-[0_20px_50px_rgba(8,59,55,.3)]" style={{ background: `linear-gradient(120deg, ${CCI.tealEscuro}, ${CCI.tealFundo})` }}>
        <span className="absolute inset-y-0 left-0 w-1.5 bg-[#FCB619]" />
        <div className="flex flex-wrap items-center gap-5 px-6 py-6 sm:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold uppercase tracking-[0.25em] text-[#FCB619]">Próximo passo com a CCI</p>
            <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-white/85">{PROXIMO_PASSO}</p>
          </div>
          <a href={linkWhatsapp(posto, n.prioridades[0]?.acao ?? null)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#FCB619] px-5 py-3 text-[14px] font-extrabold text-[#0B4A44] shadow-[0_8px_24px_rgba(252,182,25,.35)] transition-transform hover:-translate-y-0.5" style={{ fontFamily: FONTE_TITULO }}><MessageCircle className="h-4 w-4" /> Falar com a CCI</a>
        </div>
      </section>
      <p className="-mt-8 text-[11px] text-gray-400">Texto gerado por regras fixas sobre os dados apurados. Sem IA, sem estimativa: cada frase tem um número por trás, e os números estão logo abaixo.</p>
    </div>
  )
}
const Corpo = ({ d, nomePosto, canApurar }: { d: Diagnostico; nomePosto: string; canApurar: boolean }) => {
  const ct = useChartTheme()
  const tb = d.totB
  const n = Math.max(1, d.totA.meses)
  const nB = Math.max(1, tb?.meses ?? 1)
  const parcial = d.cobertura.faltamA.length > 0 || d.cobertura.faltamB.length > 0 || d.cobertura.parciais.length > 0

  const serie = useMemo(() => d.mesAMes.map((m) => ({
    mes: mesLabel(m.mesA),
    lbA: m.a?.lb ?? null, lbB: m.b?.lb ?? null,
    litrosA: m.a?.litros ?? null, litrosB: m.b?.litros ?? null,
  })), [d.mesAMes])

  const kpis = [
    { label: 'Litros', a: formatLiters(d.totA.litros), b: tb ? formatLiters(tb.litros) : null, delta: <Delta atual={d.totA.litros} anterior={tb?.litros} /> },
    { label: 'Faturamento', a: formatCurrencyInt(d.totA.faturamento), b: tb ? formatCurrencyInt(tb.faturamento) : null, delta: <Delta atual={d.totA.faturamento} anterior={tb?.faturamento} /> },
    { label: 'Lucro bruto', a: formatCurrencyInt(d.totA.lucroBruto), b: tb ? formatCurrencyInt(tb.lucroBruto) : null, delta: <Delta atual={d.totA.lucroBruto} anterior={tb?.lucroBruto} /> },
    { label: 'Margem bruta', a: pct(d.totA.margem), b: tb ? pct(tb.margem) : null, delta: <DeltaPp atual={d.totA.margem} anterior={tb?.margem} /> },
    { label: 'Lucro por litro', a: formatCurrency(d.totA.lbPorLitro), b: tb ? formatCurrency(tb.lbPorLitro) : null, delta: <Delta atual={d.totA.lbPorLitro} anterior={tb?.lbPorLitro} /> },
    { label: 'Lucro da loja', a: formatCurrencyInt(d.totA.lbLoja), b: tb ? formatCurrencyInt(tb.lbLoja) : null, delta: <Delta atual={d.totA.lbLoja} anterior={tb?.lbLoja} /> },
    { label: 'Loja no lucro total', a: pct(d.totA.shareLojaLb, 1), b: tb ? pct(tb.shareLojaLb, 1) : null, delta: <DeltaPp atual={d.totA.shareLojaLb} anterior={tb?.shareLojaLb} /> },
    { label: 'Ticket médio da loja', a: d.totA.cuponsLoja > 0 ? formatCurrency(d.totA.ticketLoja) : '—', b: tb && tb.cuponsLoja > 0 ? formatCurrency(tb.ticketLoja) : null, delta: <Delta atual={d.totA.ticketLoja} anterior={tb?.ticketLoja} /> },
  ]

  return (
    <>
      {/* Cobertura */}
      <div className={cn(card, parcial ? 'border-amber-300 dark:border-amber-800' : '')}>
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"><CalendarRange className="h-4 w-4 text-[#0F766E] dark:text-teal-300" /> {nomePosto} · {d.a.rotulo} contra {d.b.rotulo}</p>
        <p className="mt-1 text-[12px] text-gray-600 dark:text-gray-300">
          {tb ? <>Comparação sobre <b>{d.pareados.a.length} {d.pareados.a.length === 1 ? 'mês' : 'meses'}</b> com dado nos dois períodos.</> : <>Nenhum mês {d.b.nome === 'período de comparação' ? 'do período de comparação' : 'do ano anterior'} apurado: os números abaixo são só do período atual.</>}
          {d.cobertura.faltamA.length > 0 && <> Faltam no período atual: {d.cobertura.faltamA.map(mesLabel).join(', ')}.</>}
          {d.cobertura.faltamB.length > 0 && <> Faltam {deJanelaB(d.b).replace(/^do /, 'no ')}: {d.cobertura.faltamB.map(mesLabel).join(', ')}.</>}
          {d.cobertura.parciais.length > 0 && <> Apurados só em parte (fora da comparação): {d.cobertura.parciais.map((p) => `${mesLabel(p.mes)} (${p.dias} dias)`).join(', ')}.</>}
          {parcial && canApurar && <> <Link to="/painel/apuracao" className="font-semibold text-[#1e3a5f] hover:underline dark:text-blue-300">Apurar os meses que faltam</Link>.</>}
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={card}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{k.label}</p>
            <p className="mt-1 text-[20px] font-extrabold tabular-nums leading-tight text-gray-900 dark:text-gray-100">{k.a}</p>
            <p className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-gray-400">{k.b ? <span>antes {k.b}</span> : <span>—</span>}{k.delta}</p>
          </div>
        ))}
      </div>

      {/* Mês a mês */}
      <section className={card}>
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"><TrendingUp className="h-4 w-4 text-[#0F766E] dark:text-teal-300" /> Mês a mês <span className="text-[11px] font-normal text-gray-400">lucro bruto (barras) e litros (linhas), período atual contra {d.b.nome ?? 'ano anterior'}</span></h2>
        <div className="mt-3 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="lb" tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} width={44} />
              <YAxis yAxisId="l" orientation="right" tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} width={44} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, ...ct.tooltip }} formatter={((v: number, name: string) => [name.startsWith('Litros') ? formatLiters(v) : formatCurrencyInt(v), name]) as never} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="lb" dataKey="lbB" name={`Lucro bruto · ${d.b.nome ?? 'ano anterior'}`} fill={ct.dark ? '#475569' : '#cbd5e1'} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              <Bar yAxisId="lb" dataKey="lbA" name="Lucro bruto · atual" fill={CCI.teal} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              <Line yAxisId="l" type="monotone" dataKey="litrosB" name={`Litros · ${d.b.nome ?? 'ano anterior'}`} stroke={ct.dark ? '#94a3b8' : '#64748b'} strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line yAxisId="l" type="monotone" dataKey="litrosA" name="Litros · atual" stroke={CCI.ouro} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: CCI.ouro }} isAnimationActive={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12px]">
            <thead className="text-[10px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="py-1.5 pr-3 text-left font-semibold">Mês</th>
                <th className="px-2 py-1.5 text-right font-semibold">Litros</th>
                <th className="px-2 py-1.5 text-right font-semibold">Antes</th>
                <th className="px-2 py-1.5 text-right font-semibold">Δ</th>
                <th className="px-2 py-1.5 text-right font-semibold">Lucro bruto</th>
                <th className="px-2 py-1.5 text-right font-semibold">Antes</th>
                <th className="px-2 py-1.5 text-right font-semibold">Δ</th>
                <th className="px-2 py-1.5 text-right font-semibold">Margem</th>
                <th className="py-1.5 pl-2 text-right font-semibold">Antes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {d.mesAMes.map((m) => (
                <tr key={m.mesA} className="text-gray-800 dark:text-gray-200">
                  <td className="py-1.5 pr-3 font-medium">{mesLabel(m.mesA)} <span className="text-[10px] font-normal text-gray-400">vs {mesLabel(m.mesB)}</span></td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{m.a ? formatNumber(Math.round(m.a.litros)) : <span className="text-gray-400">sem dado</span>}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{m.b ? formatNumber(Math.round(m.b.litros)) : '—'}</td>
                  <td className="px-2 py-1.5 text-right">{m.a && m.b ? <Delta atual={m.a.litros} anterior={m.b.litros} /> : <span className="text-gray-400">—</span>}</td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{m.a ? formatCurrencyInt(m.a.lb) : <span className="font-normal text-gray-400">sem dado</span>}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{m.b ? formatCurrencyInt(m.b.lb) : '—'}</td>
                  <td className="px-2 py-1.5 text-right">{m.a && m.b ? <Delta atual={m.a.lb} anterior={m.b.lb} /> : <span className="text-gray-400">—</span>}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{m.a ? pct(m.a.margem) : '—'}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums text-gray-500">{m.b ? pct(m.b.margem) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
              <tr>
                <td className="py-2 pr-3">Média mensal <span className="text-[10px] font-normal text-gray-400">(meses comparáveis)</span></td>
                <td className="px-2 py-2 text-right tabular-nums">{formatNumber(Math.round(d.totA.litros / n))}</td>
                <td className="px-2 py-2 text-right tabular-nums text-gray-500">{tb ? formatNumber(Math.round(tb.litros / nB)) : '—'}</td>
                <td className="px-2 py-2 text-right"><Delta atual={d.totA.litros} anterior={tb?.litros} /></td>
                <td className="px-2 py-2 text-right tabular-nums">{formatCurrencyInt(d.totA.lucroBruto / n)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-gray-500">{tb ? formatCurrencyInt(tb.lucroBruto / nB) : '—'}</td>
                <td className="px-2 py-2 text-right"><Delta atual={d.totA.lucroBruto} anterior={tb?.lucroBruto} /></td>
                <td className="px-2 py-2 text-right tabular-nums">{pct(d.totA.margem)}</td>
                <td className="py-2 pl-2 text-right tabular-nums text-gray-500">{tb ? pct(tb.margem) : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Combustíveis */}
      <section className={card}>
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100"><Droplets className="h-4 w-4 text-blue-600" /> Combustíveis <InfoHint text="Por produto: litros, preço médio de venda, custo médio e margem por litro, nos meses comparáveis. 'Fatia' é a parte do produto no volume do posto." /></h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-[12px]">
            <thead className="text-[10px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="py-1.5 pr-3 text-left font-semibold">Produto</th>
                <th className="px-2 py-1.5 text-right font-semibold">Litros/mês</th>
                <th className="px-2 py-1.5 text-right font-semibold">Δ volume</th>
                <th className="px-2 py-1.5 text-right font-semibold">Fatia</th>
                <th className="px-2 py-1.5 text-right font-semibold">Preço médio</th>
                <th className="px-2 py-1.5 text-right font-semibold">Custo médio</th>
                <th className="px-2 py-1.5 text-right font-semibold">Margem/L</th>
                <th className="px-2 py-1.5 text-right font-semibold">Antes</th>
                <th className="py-1.5 pl-2 text-right font-semibold">Lucro/mês</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {d.combustiveis.map((p) => (
                <tr key={p.codigo} className="text-gray-800 dark:text-gray-200">
                  <td className="py-1.5 pr-3 font-medium">{p.nome}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{p.a ? formatNumber(Math.round(p.a.litros / n)) : <span className="text-gray-400">não vende mais</span>}</td>
                  <td className="px-2 py-1.5 text-right">{p.a && p.b ? <Delta atual={p.a.litros} anterior={p.b.litros} /> : <span className="text-gray-400">{p.a && !p.b && tb ? 'novo' : '—'}</span>}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{p.a ? pct(p.a.share, 0) : '—'}{p.b && p.a ? <span className="text-[10px]"> ({pct(p.b.share, 0)})</span> : null}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{p.a ? formatCurrency(p.a.preco) : '—'}{p.b ? <span className="block text-[10px] text-gray-400">antes {formatCurrency(p.b.preco)}</span> : null}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{p.a ? formatCurrency(p.a.custo) : '—'}{p.b ? <span className="block text-[10px] text-gray-400">antes {formatCurrency(p.b.custo)}</span> : null}</td>
                  <td className={cn('px-2 py-1.5 text-right font-semibold tabular-nums', p.a && p.b && p.a.margemL < p.b.margemL - 0.03 && 'text-red-600 dark:text-red-400', p.a && p.b && p.a.margemL > p.b.margemL + 0.03 && 'text-emerald-600 dark:text-emerald-400')}>{p.a ? formatCurrency(p.a.margemL) : '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{p.b ? formatCurrency(p.b.margemL) : '—'}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{p.a ? formatCurrencyInt(p.a.lb / n) : '—'}{p.b ? <span className="block text-[10px] text-gray-400">antes {formatCurrencyInt(p.b.lb / nB)}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Loja e automotivos */}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <TabelaLoja titulo="Conveniência" Icon={Store} cor="text-emerald-600" dados={d.loja} n={n} nB={nB} temB={!!tb} />
        <TabelaLoja titulo="Automotivos" Icon={Wrench} cor="text-amber-600" dados={d.auto} n={n} nB={nB} temB={!!tb} />
      </div>

      <p className="pb-2 text-[11px] text-gray-400">
        Fonte: venda fiscal apurada ({mesLabelLongo(d.b.ini)} a {mesLabelLongo(d.a.fim)}). Médias mensais sobre os meses comparáveis. Custo = custo médio ponderado registrado na venda. O diagnóstico não usa estimativa nem dado ao vivo.
      </p>
    </>
  )
}

const TabelaLoja = ({ titulo, Icon, cor, dados, n, nB, temB }: { titulo: string; Icon: typeof Store; cor: string; dados: { top: ProdutoLoja[]; sumiram: ProdutoLoja[]; novos: ProdutoLoja[] }; n: number; nB: number; temB: boolean }) => (
  <section className={card}>
    <h2 className={cn('inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100')}><Icon className={cn('h-4 w-4', cor)} /> {titulo} <span className="text-[11px] font-normal text-gray-400">maiores lucros · valores por mês</span></h2>
    {dados.top.length === 0 ? (
      <p className="mt-2 text-sm text-gray-500">Sem venda apurada neste setor.</p>
    ) : (
      <table className="mt-3 w-full table-fixed text-[12px]">
        <colgroup><col className="w-[40%]" /><col className="w-[16%]" /><col className="w-[16%]" /><col className="w-[13%]" /><col className="w-[15%]" /></colgroup>
        <thead className="text-[10px] uppercase tracking-wider text-gray-400">
          <tr>
            <th className="py-1.5 pr-3 text-left font-semibold">Produto</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">Fat.</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">Lucro</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">Marg.</th>
            <th className="whitespace-nowrap py-1.5 pl-2 text-right font-semibold" title="Variação do lucro mensal contra o período de comparação">Δ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {dados.top.map((p) => (
            <tr key={p.codigo} className="text-gray-800 dark:text-gray-200">
              <td className="truncate py-1.5 pr-3 font-medium" title={p.nome}>{p.nome}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatCurrencyInt(p.a!.fat / n)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums">{formatCurrencyInt(p.a!.lb / n)}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{pct(p.a!.margem, 1)}</td>
              <td className="whitespace-nowrap py-1.5 pl-2 text-right">{p.b ? <Delta atual={p.a!.lb / n} anterior={p.b.lb / nB} /> : <span className="text-[11px] text-gray-400">{temB ? 'novo' : '—'}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
    {(dados.sumiram.length > 0 || dados.novos.length > 0) && (
      <div className="mt-3 grid gap-2 border-t border-gray-100 pt-3 text-[11px] text-gray-600 dark:border-gray-800 dark:text-gray-300 sm:grid-cols-2">
        {dados.sumiram.length > 0 && <p><b className="text-red-600 dark:text-red-400">Sumiram:</b> {dados.sumiram.map((p) => `${p.nome} (${formatCurrencyInt(p.b!.fat / nB)}/mês)`).join(' · ')}</p>}
        {dados.novos.length > 0 && <p><b className="text-emerald-600 dark:text-emerald-400">Novos:</b> {dados.novos.map((p) => `${p.nome} (${formatCurrencyInt(p.a!.lb / n)}/mês de lucro)`).join(' · ')}</p>}
      </div>
    )}
  </section>
)

export default Diagnostico
