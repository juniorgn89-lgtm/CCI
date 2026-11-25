import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import useVisivel from '@/hooks/useVisivel'
import { useNavigate } from 'react-router-dom'
import {
  X, Sparkles, Users, Fuel, Package, Scale, Wallet, Gauge, TrendingUp, TrendingDown, ChevronRight, Droplets, Lock, LayoutDashboard,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { nomeLegivel } from '@/lib/nomeLegivel'
import useResumoOntem, { type GrupoRecebimento } from '@/components/briefing/useResumoOntem'
import DetalheOntem, { type TipoDetalhe } from '@/components/briefing/DetalheOntem'
import { linkFinanceiro } from '@/pages/Financeiro/lib/filtroLink'

/**
 * Briefing do dia — "Resumo de ontem" da REDE (Central), no padrão visual dos
 * apps CCI. Cada ponto, cartão, barra e linha é clicável: leva para a área do
 * Visor já filtrada em ONTEM (todos os postos). Números só do que foi apurado;
 * o que não tem fonte não aparece (nada de zero falso).
 */

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const dataLonga = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${DIAS[new Date(y, m - 1, d).getDay()]}, ${d} de ${MESES[m - 1]}`
}
const diaCurto = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return DIAS[new Date(y, m - 1, d).getDay()].split('-')[0].toLowerCase()
}
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }
const pct = (v: number) => `${Math.round(v)}%`
const pct1 = (v: number) => `${v.toFixed(1).replace('.', ',')}%`
const litros = (v: number) => `${formatNumber(Math.round(v))} L`

const SETOR = {
  combustivel: { label: 'Combustíveis', cor: '#3b82f6', tab: 'combustivel' },
  automotivos: { label: 'Automotivos (pista)', cor: '#f97316', tab: 'pista' },
  conveniencia: { label: 'Conveniência', cor: '#10b981', tab: 'conveniencia' },
} as const
const RECEB: Record<GrupoRecebimento, string> = { cartao: 'Cartões e PIX', dinheiro: 'Dinheiro', outros: 'Outros', prazo: 'A prazo' }

const CARD = 'rounded-2xl border border-[#2f3b4f] bg-[#1e293b]'
const ROTULO = 'flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]'

interface Ponto { chave: string; Icone: ComponentType<{ className?: string }>; texto: ReactNode; alerta?: boolean; ir: () => void }

const BriefingModal = () => {
  const navigate = useNavigate()
  const seenToday = useAuthStore((s) => s.briefingSeenToday)
  const setSeen = useAuthStore((s) => s.setBriefingSeenToday)
  const onboardingSeen = useAuthStore((s) => s.onboardingSeen)
  const fullName = useAuthStore((s) => s.fullName)
  const rede = useTenantStore((s) => s.rede)
  const setPeriodo = useFilterStore((s) => s.setPeriodo)
  const setEmpresas = useFilterStore((s) => s.setEmpresas)

  // Fechar sem marcar não reabre na hora; reabrir pelo menu ("Briefing do dia")
  // zera o seenToday e o efeito abaixo reabre.
  const [closed, setClosed] = useState(false)
  const prevSeen = useRef(seenToday)
  useEffect(() => {
    if (prevSeen.current === true && seenToday === false) setClosed(false)
    prevSeen.current = seenToday
  }, [seenToday])

  const open = !seenToday && onboardingSeen && !!rede && !closed
  const r = useResumoOntem(open)
  const [naoMostrar, setNaoMostrar] = useState(true)
  // Detalhe dentro do resumo (caixas/recebimento): a lista exata do que foi contado.
  const [detalhe, setDetalhe] = useState<TipoDetalhe | null>(null)
  const ver = (d: TipoDetalhe) => setDetalhe(d)

  const dismiss = () => {
    setDetalhe(null)
    setClosed(true)
    if (naoMostrar) {
      setSeen(true)
      supabase?.rpc('mark_briefing_seen').then(({ error }) => { if (error) console.warn('[briefing] mark error:', error.message) })
    }
  }
  /** Vai para a área com ONTEM e todos os postos (períodoDeOntem=false: não mexe no período, ex.: títulos em aberto). */
  const ir = (path: string, periodoDeOntem = true) => {
    if (periodoDeOntem) setPeriodo(r.ontem, r.ontem)
    setEmpresas([])
    dismiss()
    navigate(path)
  }

  const vis = useVisivel()
  const receberVisivel = vis.aba('/financeiro', 'receber')
  const RECEBER_VENCIDOS = linkFinanceiro('receber', { faixas: ['vencidas'], rotulo: 'Vencidos (resumo de ontem)' })
  const RECEBER_HOJE = linkFinanceiro('receber', { faixas: ['hoje'], rotulo: 'Vencem hoje (resumo de ontem)' })
  const RECEBER_ABERTO = '/financeiro?tab=receber'

  // ── Principais pontos (alertas primeiro; no máximo 3) ──
  const pontos: Ponto[] = []
  if (receberVisivel && r.prazo && r.prazo.vencidosQtd > 0) {
    pontos.push({ chave: 'vencidos', Icone: Users, alerta: true, ir: () => ir(RECEBER_VENCIDOS, false),
      texto: <>{formatNumber(r.prazo.vencidosQtd)} {r.prazo.vencidosQtd === 1 ? 'título vencido' : 'títulos vencidos'} de clientes a prazo · <b className="font-semibold">{formatCurrency(r.prazo.vencidosValor)}</b></> })
  }
  if (r.caixa && Math.abs(r.caixa.diferenca) >= 20) {
    pontos.push({ chave: 'caixa', Icone: Scale, alerta: r.caixa.diferenca < 0, ir: () => ver({ tipo: 'diferenca' }),
      texto: <>Caixa {r.caixa.diferenca < 0 ? 'faltou' : 'sobrou'} <b className="font-semibold">{formatCurrency(Math.abs(r.caixa.diferenca))}</b> ontem, somando {r.caixa.caixas} {r.caixa.caixas === 1 ? 'caixa' : 'caixas'}</> })
  }
  if (r.caixa && r.caixa.abertos > 0) {
    pontos.push({ chave: 'abertos', Icone: Lock, alerta: true, ir: () => ver({ tipo: 'abertos' }),
      texto: <>{r.caixa.abertos} {r.caixa.abertos === 1 ? 'caixa de ontem ainda está aberto' : 'caixas de ontem ainda estão abertos'}</> })
  }
  if (r.vendasSemanaPassada && vis.aba('/dashboard', 'setor')) {
    const d = ((r.vendas - r.vendasSemanaPassada) / r.vendasSemanaPassada) * 100
    const dia = diaCurto(r.ontem)
    const passada = dia === 'domingo' || dia === 'sábado' ? 'passado' : 'passada'
    pontos.push({ chave: 'semana', Icone: d >= 0 ? TrendingUp : TrendingDown, alerta: d <= -10, ir: () => ir('/dashboard?tab=setor'),
      texto: <>Vendas {d >= 0 ? 'subiram' : 'caíram'} <b className="font-semibold">{pct1(Math.abs(d))}</b> em relação a {dia} {passada}</> })
  }
  const comb = r.setores.find((s) => s.id === 'combustivel')
  if (comb && r.vendas > 0 && vis.aba('/dashboard', 'combustivel')) {
    pontos.push({ chave: 'comb', Icone: Fuel, ir: () => ir('/dashboard?tab=combustivel'),
      texto: <>Combustíveis foram <b className="font-semibold">{pct1((comb.valor / r.vendas) * 100)}</b> das vendas · {litros(r.litros)}</> })
  }
  const tabTop = r.topProduto?.setor === 'automotivos' ? 'pista' : 'conveniencia'
  if (r.topProduto && vis.aba('/dashboard', tabTop)) {
    const tab = tabTop
    pontos.push({ chave: 'top', Icone: Package, ir: () => ir(`/dashboard?tab=${tab}`),
      texto: <>Mais vendido fora os combustíveis: <b className="font-semibold">{nomeLegivel(r.topProduto.nome)}</b> · {formatCurrency(r.topProduto.valor)}</> })
  }
  const principais = [...pontos.filter((p) => p.alerta), ...pontos.filter((p) => !p.alerta)].slice(0, 3)

  const nome = fullName ? fullName.split(' ')[0] : ''

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss() }}>
      <DialogContent className="flex max-h-[92dvh] max-w-xl flex-col gap-0 overflow-hidden rounded-[28px] border border-[#2f3b4f] bg-[#0f172a] p-0 text-[#f1f5f9] shadow-2xl [&>button]:hidden">
        {/* Cabeçalho petróleo com a marca */}
        <div className="relative shrink-0 overflow-hidden px-6 pb-5 pt-5" style={{ background: 'radial-gradient(520px 260px at 85% -20%, #2a7c74 0%, #134e4a 45%, #1e293b 100%)' }}>
          <div className="flex items-start gap-3">
            <img src="/brand/visor360-icon-512.png" alt="Visor360" className="h-11 w-11 shrink-0 rounded-xl bg-[#0f172a]/60 p-1.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Resumo de ontem</p>
              <DialogTitle className="text-[19px] font-bold leading-tight text-white">{dataLonga(r.ontem)}</DialogTitle>
              <DialogDescription className="text-[12.5px] text-white/75">{saudacao()}{nome ? `, ${nome}` : ''} · os principais pontos da rede{rede?.nome ? ` ${nomeLegivel(rede.nome)}` : ''}</DialogDescription>
            </div>
            <button type="button" onClick={dismiss} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <button type="button" onClick={() => ir('/dashboard?tab=setor')} className="group text-left">
              <p className="text-[12px] text-white/75">Vendas do dia</p>
              <p className="text-[34px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-white group-hover:underline group-hover:decoration-white/40 group-hover:underline-offset-4">
                {r.carregando ? '…' : formatCurrency(r.vendas)}
              </p>
            </button>
            <div className="flex gap-6 text-right">
              {r.recebido > 0 && (
                <button type="button" onClick={() => ver({ tipo: 'recebido' })} className="text-right hover:opacity-80">
                  <p className="text-[11.5px] text-white/70">Recebido</p>
                  <p className="text-[15px] font-bold tabular-nums text-white">{formatCurrency(r.recebido)}</p>
                </button>
              )}
              {r.litros > 0 && (
                <button type="button" onClick={() => ir('/dashboard?tab=combustivel')} className="text-right hover:opacity-80">
                  <p className="text-[11.5px] text-white/70">Combustível</p>
                  <p className="text-[15px] font-bold tabular-nums text-white">{litros(r.litros)}</p>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Corpo */}
        {/* Rolagem sem barra visível: a pessoa rola por intuição (roda do mouse/dedo). */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {detalhe ? (
            <DetalheOntem detalhe={detalhe} caixas={r.caixasRows} formas={r.formasRows} nomePosto={r.nomePosto} onVoltar={() => setDetalhe(null)} />
          ) : r.carregando ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#1e293b]" />)}</div>
          ) : !r.temDados ? (
            <div className={cn(CARD, 'p-6 text-center text-[13px] text-[#94a3b8]')}>Ontem ainda não fechou na apuração. Confira mais tarde.</div>
          ) : (
            <>
              {principais.length > 0 && (
                <section className={cn(CARD, 'p-4')}>
                  <p className={ROTULO}><Sparkles className="h-4 w-4" /> Principais pontos</p>
                  <div className="mt-3 space-y-2">
                    {principais.map((p) => (
                      <button key={p.chave} type="button" onClick={p.ir}
                        className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                          p.alerta ? 'border-rose-400/40 bg-rose-500/10 hover:bg-rose-500/15' : 'border-[#2f3b4f] bg-[#172234] hover:bg-[#1f2d44]')}>
                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', p.alerta ? 'bg-rose-500/20 text-[#fda4af]' : 'bg-white/[0.06] text-[#cbd5e1]')}>
                          <p.Icone className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-[#e2e8f0]">{p.texto}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#64748b]" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <div className="grid grid-cols-2 gap-3">
                {r.caixa && (
                  <Kpi Icone={Scale} titulo="Diferença de caixa" onClick={() => ver({ tipo: 'diferenca' })}
                    valor={`${r.caixa.diferenca > 0 ? '+' : r.caixa.diferenca < 0 ? '−' : ''}${formatCurrency(Math.abs(r.caixa.diferenca))}`}
                    corValor={Math.abs(r.caixa.diferenca) < 1 ? 'text-[#5eead4]' : r.caixa.diferenca < 0 ? 'text-[#fda4af]' : 'text-[#5eead4]'}
                    sub={Math.abs(r.caixa.diferenca) < 1 ? 'caixa batido' : `${r.caixa.caixas} ${r.caixa.caixas === 1 ? 'caixa' : 'caixas'}`} />
                )}
                {r.recebido > 0 && (
                  <Kpi Icone={Wallet} titulo="Recebido" valor={formatCurrency(r.recebido)} onClick={() => ver({ tipo: 'recebido' })}
                    sub={r.vendas > 0 ? `${pct((r.recebido / r.vendas) * 100)} das vendas` : undefined} />
                )}
                {r.litros > 0 && (
                  <Kpi Icone={Droplets} titulo="Lucro no combustível" valor={formatCurrency(r.lucroBruto)} onClick={() => ir('/dashboard?tab=combustivel')}
                    sub={`R$ ${(r.lucroBruto / r.litros).toFixed(2).replace('.', ',')} por litro`} />
                )}
                <Kpi Icone={Gauge} titulo="Aferições" valor={litros(r.afericoes.litros)} onClick={() => ir('/operacao?tab=afericoes')}
                  sub={`${r.afericoes.qtd} ${r.afericoes.qtd === 1 ? 'aferição' : 'aferições'}`} />
              </div>

              {r.setores.length > 0 && (
                <section className={cn(CARD, 'p-4')}>
                  <p className={ROTULO}><TrendingUp className="h-4 w-4" /> Onde vendeu</p>
                  <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[#172234]">
                    {r.setores.map((s) => (
                      <button key={s.id} type="button" onClick={() => ir(`/dashboard?tab=${SETOR[s.id].tab}`)} aria-label={`Ver ${SETOR[s.id].label}`}
                        className="h-full transition-opacity hover:opacity-80" style={{ width: `${(s.valor / r.vendas) * 100}%`, background: SETOR[s.id].cor }} />
                    ))}
                  </div>
                  <div className="mt-2.5 grid gap-1 sm:grid-cols-2">
                    {r.setores.map((s) => (
                      <button key={s.id} type="button" onClick={() => ir(`/dashboard?tab=${SETOR[s.id].tab}`)}
                        className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[13px] hover:bg-white/[0.04]">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SETOR[s.id].cor }} />
                        <span className="min-w-0 flex-1 truncate text-[#e2e8f0]">{SETOR[s.id].label}</span>
                        <span className="text-[11.5px] tabular-nums text-[#64748b]">{pct((s.valor / r.vendas) * 100)}</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(s.valor)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {r.recebimento.length > 0 && (
                <section className={cn(CARD, 'p-4')}>
                  <p className={ROTULO}><Wallet className="h-4 w-4" /> Como recebeu</p>
                  <div className="mt-3 space-y-2.5">
                    {r.recebimento.map((x) => (
                      <button key={x.grupo} type="button" onClick={() => ver({ tipo: 'recebido', grupo: x.grupo })} className="block w-full rounded-lg px-1 py-0.5 text-left hover:bg-white/[0.04]">
                        <span className="flex items-baseline gap-2 text-[13.5px]">
                          <span className="min-w-0 flex-1 text-[#e2e8f0]">{RECEB[x.grupo]}</span>
                          <span className="text-[11.5px] tabular-nums text-[#64748b]">{pct((x.valor / r.recebido) * 100)}</span>
                          <span className="font-semibold tabular-nums">{formatCurrency(x.valor)}</span>
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#172234]">
                          <span className="block h-full rounded-full bg-[#0d9488]" style={{ width: `${Math.max(2, (x.valor / r.recebido) * 100)}%` }} />
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {receberVisivel && (r.prazo || r.carregandoPrazo) && (
                <section className={cn(CARD, 'p-4')}>
                  <div className="flex items-center justify-between">
                    <p className={ROTULO}><Users className="h-4 w-4" /> Clientes a prazo</p>
                    <button type="button" onClick={() => ir(RECEBER_ABERTO, false)} className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-[#5eead4] hover:underline">
                      Ver <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {r.prazo ? (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Caixinha titulo="Vencidos" valor={formatCurrency(r.prazo.vencidosValor)} sub={`${r.prazo.vencidosQtd} ${r.prazo.vencidosQtd === 1 ? 'título' : 'títulos'}`}
                        alerta={r.prazo.vencidosQtd > 0} onClick={() => ir(RECEBER_VENCIDOS, false)} />
                      <Caixinha titulo="Vencem hoje" valor={formatCurrency(r.prazo.hojeValor)} sub={`${r.prazo.hojeQtd} ${r.prazo.hojeQtd === 1 ? 'título' : 'títulos'}`} onClick={() => ir(RECEBER_HOJE, false)} />
                      <Caixinha titulo="Em aberto" valor={formatCurrency(r.prazo.abertoValor)} onClick={() => ir(RECEBER_ABERTO, false)} />
                    </div>
                  ) : (
                    <div className="mt-3 h-16 animate-pulse rounded-xl bg-[#172234]" />
                  )}
                </section>
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#2f3b4f] bg-[#111a2b] px-5 py-3.5">
          <button type="button" role="switch" aria-checked={naoMostrar} onClick={() => setNaoMostrar((v) => !v)} className="flex items-center gap-2.5 text-[12.5px] text-[#94a3b8]">
            <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', naoMostrar ? 'bg-[#0f766e]' : 'bg-[#3e4c63]')}>
              <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-[#fff] shadow transition-all', naoMostrar ? 'left-6' : 'left-1')} />
            </span>
            Não mostrar mais hoje
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => ir('/dashboard?tab=setor')}
              className="hidden items-center gap-1.5 rounded-xl border border-[#2f3b4f] px-4 py-2.5 text-[13px] font-semibold text-[#e2e8f0] transition-colors hover:bg-white/[0.05] sm:inline-flex">
              <LayoutDashboard className="h-4 w-4" /> Ver na Central
            </button>
            <button type="button" onClick={dismiss}
              className="rounded-xl bg-[#0f766e] px-5 py-2.5 text-[13.5px] font-bold text-[#fff] transition-colors hover:bg-[#0d9488]">
              Entendi
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Kpi = ({ Icone, titulo, valor, sub, corValor, onClick }: { Icone: ComponentType<{ className?: string }>; titulo: string; valor: string; sub?: string; corValor?: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className={cn(CARD, 'p-3.5 text-left transition-colors hover:border-[#3e4c63] hover:bg-[#223049]')}>
    <p className="flex items-center gap-1.5 text-[12px] text-[#94a3b8]"><Icone className="h-3.5 w-3.5" /> {titulo}</p>
    <p className={cn('mt-1.5 text-[19px] font-bold tabular-nums leading-tight', corValor ?? 'text-[#f1f5f9]')}>{valor}</p>
    {sub && <p className="mt-0.5 text-[11.5px] text-[#64748b]">{sub}</p>}
  </button>
)

const Caixinha = ({ titulo, valor, sub, alerta, onClick }: { titulo: string; valor: string; sub?: string; alerta?: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick}
    className={cn('rounded-xl px-2 py-3 text-center transition-colors', alerta ? 'bg-rose-500/15 hover:bg-rose-500/20' : 'bg-[#0f172a] hover:bg-[#131d31]')}>
    <p className={cn('text-[12px]', alerta ? 'text-[#fda4af]' : 'text-[#94a3b8]')}>{titulo}</p>
    <p className={cn('mt-1 text-[14.5px] font-bold tabular-nums', alerta ? 'text-[#fda4af]' : 'text-[#f1f5f9]')}>{valor}</p>
    {sub && <p className="mt-0.5 text-[11px] text-[#64748b]">{sub}</p>}
  </button>
)

export default BriefingModal
