import { Fuel } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import type { Diagnostico } from '@/pages/Diagnostico/lib/diagnostico'
import type { Narrativa } from '@/pages/Diagnostico/lib/narrativa'
import { CCI, FONTE_TITULO } from '@/pages/Diagnostico/lib/marca'
import { LogoCCI, TriangulosCapa } from '@/pages/Diagnostico/components/Marca'

const varPct = (a: number, b: number | null | undefined) => (b && b > 0 ? ((a - b) / b) * 100 : null)

const Variacao = ({ v, pp }: { v: number | null; pp?: boolean }) => {
  if (v == null) return <span className="text-white/50">sem base</span>
  const neutro = Math.abs(v) < 0.05
  return (
    <span className={cn('font-semibold', neutro ? 'text-white/70' : v > 0 ? 'text-[#7DE3C9]' : 'text-[#FFB4A1]')}>
      {v > 0 ? '+' : ''}{v.toFixed(pp ? 2 : 1).replace('.', ',')}{pp ? ' pp' : '%'}
    </span>
  )
}

/**
 * Capa do diagnóstico, no estilo da apresentação da CCI: verde-petróleo com
 * triângulos, o veredito em manchete e os 4 números que contam a história.
 * Valores por mês (médias dos meses comparáveis).
 */
const Capa = ({ d, n, posto, periodo, sujeito, servicosCci = [] }: { d: Diagnostico; n: Narrativa; posto: string; periodo: string; sujeito: 'posto' | 'rede'; servicosCci?: string[] }) => {
  const meses = Math.max(1, d.totA.meses)
  const mesesB = Math.max(1, d.totB?.meses ?? 1)
  const tb = d.totB
  const porMes = meses === 1 ? '' : '/mês'
  const corte = n.veredito.indexOf(':')
  const manchete = corte > 0 && corte < 60 ? n.veredito.slice(0, corte) : (sujeito === 'rede' ? 'Diagnóstico da rede' : 'Diagnóstico do posto')
  const kpis = [
    { rotulo: `Lucro bruto${porMes}`, valor: formatCurrencyInt(d.totA.lucroBruto / meses), v: <Variacao v={varPct(d.totA.lucroBruto / meses, tb ? tb.lucroBruto / mesesB : null)} /> },
    { rotulo: `Litros${porMes}`, valor: formatNumber(Math.round(d.totA.litros / meses)), v: <Variacao v={varPct(d.totA.litros / meses, tb ? tb.litros / mesesB : null)} /> },
    { rotulo: 'Lucro por litro', valor: formatCurrency(d.totA.lbPorLitro), v: <Variacao v={varPct(d.totA.lbPorLitro, tb?.lbPorLitro)} /> },
    d.totA.fatLoja > 0
      ? { rotulo: 'Loja no lucro', valor: `${d.totA.shareLojaLb.toFixed(1).replace('.', ',')}%`, v: <Variacao v={tb && tb.fatLoja > 0 ? d.totA.shareLojaLb - tb.shareLojaLb : null} pp /> }
      : { rotulo: 'Loja', valor: 'Sem loja', v: <span className="text-white/50">nenhuma venda de loja apurada</span> },
  ]
  return (
    <section className="relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_24px_60px_rgba(8,59,55,.35)] sm:p-8" style={{ background: `linear-gradient(135deg, ${CCI.teal} 0%, ${CCI.tealEscuro} 55%, ${CCI.tealFundo} 100%)` }}>
      <TriangulosCapa />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end">
        {/* Cartão de vidro com a identificação, como na capa da apresentação */}
        <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-5 backdrop-blur-sm sm:p-7">
          <LogoCCI />
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.3em] text-[#FCB619]">{sujeito === 'rede' ? 'Diagnóstico da rede' : 'Diagnóstico do posto'}</p>
          <h1 className="mt-2 text-[32px] font-extrabold leading-[1.05] [text-wrap:balance] sm:text-[42px]" style={{ fontFamily: FONTE_TITULO }}>{manchete}</h1>
          <span className="mt-4 block h-1 w-14 rounded-full bg-[#FCB619]" />
          <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-white/85">{n.abertura}</p>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">{sujeito === 'rede' ? 'Rede' : 'Cliente'}</p>
              <p className="mt-0.5 text-[14px] font-bold">{posto}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">Período</p>
              <p className="mt-0.5 text-[14px] font-bold">{periodo}</p>
            </div>
          </div>
          {servicosCci.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">Com a CCI</span>
              {servicosCci.map((s) => <span key={s} className="rounded-full border border-[#FCB619]/50 bg-[#FCB619]/15 px-2.5 py-0.5 text-[11.5px] font-semibold text-[#FCD35E]">{s}</span>)}
            </div>
          )}
        </div>

        {/* Os números que contam a história */}
        <div className="space-y-3">
          <span className="relative hidden h-16 w-16 place-items-center rounded-full border border-white/25 bg-white/10 shadow-[0_0_40px_rgba(252,182,25,.25)] backdrop-blur lg:ml-auto lg:grid"><Fuel className="h-7 w-7 text-white" /></span>
          <div className="grid grid-cols-2 gap-3">
            {kpis.map((k) => (
              <div key={k.rotulo} className="rounded-2xl border border-white/15 bg-[#083B37]/55 p-3.5 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">{k.rotulo}</p>
                <p className="mt-1 text-[22px] font-extrabold leading-tight tabular-nums" style={{ fontFamily: FONTE_TITULO }}>{k.valor}</p>
                <p className="mt-0.5 text-[11.5px] tabular-nums text-white/60">{k.v}{k.rotulo !== 'Loja' && <span className="text-white/45"> contra antes</span>}</p>
              </div>
            ))}
          </div>
          <p className="text-right text-[11px] text-white/55">Consultoria financeira e BPO para postos de combustíveis</p>
        </div>
      </div>
    </section>
  )
}

export default Capa
