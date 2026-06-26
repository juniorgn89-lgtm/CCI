import { useMemo, useState } from 'react'
import {
  Sparkles, TrendingUp, Percent, Zap, Fuel, ShoppingBag, ArrowRight,
  Check, AlertTriangle, Lock, SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import InfoHint from '@/components/ui/InfoHint'
import useOportunidades, { milShort, type Alavanca, type Oportunidade } from '@/pages/Comercial/hooks/useOportunidades'

const lbL = (v: number) => `R$ ${v.toFixed(3).replace('.', ',')}`
const ALAVANCA_META: Record<Alavanca, { label: string; Icon: typeof Fuel; chip: string }> = {
  praca: { label: 'Praça', Icon: Fuel, chip: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' },
  conveniencia: { label: 'Conveniência', Icon: ShoppingBag, chip: 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300' },
}

const DetailPanel = ({ op }: { op: Oportunidade }) => {
  const meta = ALAVANCA_META[op.alavanca]
  // Simular = what-if READ-ONLY: o potencial é linear na fração do gap fechada,
  // então recalcula em memória ao trocar a fração. Nada é gravado.
  const [frac, setFrac] = useState(op.fracBase)
  const opts = op.alavanca === 'praca' ? [0.5, 0.7, 0.9, 1] : [0.5, 0.75, 1]
  const fullGap = op.margemAtual != null && op.margemAlvo != null ? (op.margemAlvo - op.margemAtual) / op.fracBase : null
  const potencialSim = op.potencial * (frac / op.fracBase)
  const alvoSim = op.margemAtual != null && fullGap != null ? op.margemAtual + frac * fullGap : null
  const isBase = Math.abs(frac - op.fracBase) < 1e-9
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 bg-gradient-to-br from-[#1e3a5f] to-[#27496f] px-4 py-3 text-white">
        <meta.Icon className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{op.titulo}</p>
          <p className="truncate text-[11px] text-white/60">{op.posto}{op.subtitulo.includes('·') ? ` · ${op.subtitulo.split('·').slice(-1)[0].trim()}` : ''}</p>
        </div>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">{meta.label}</span>
      </div>

      <div className="space-y-3 bg-white p-4 dark:bg-gray-900">
        {/* lucro estimado */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-900/30 dark:bg-emerald-950/15">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-400/80">Lucro adicional estimado</p>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-gray-900 dark:text-emerald-300">confiança {op.confianca}%</span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+{milShort(potencialSim)}<span className="text-sm font-medium text-emerald-700/70">/período</span></p>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700/70 dark:text-emerald-400/70">estimativa · teto (volume constante)</p>
            {!isBase && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">what-if {Math.round(frac * 100)}% · base +{milShort(op.potencial)}</span>}
          </div>
        </div>

        {/* de → para (só margem) */}
        {op.margemAtual != null && op.margemAlvo != null && (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="rounded-xl border border-gray-200 p-3 text-center dark:border-gray-700">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Meu preço</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{lbL(op.margemAtual)}<span className="text-xs text-gray-400">/L</span></p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300" />
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-center dark:border-blue-900/40 dark:bg-blue-950/20">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">Praça</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-blue-700 dark:text-blue-300">{lbL(alvoSim ?? op.margemAlvo)}<span className="text-xs text-blue-400">/L</span></p>
            </div>
          </div>
        )}

        {/* como a IA estimou */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Como a IA estimou</p>
          <ul className="space-y-1.5">
            {op.comoEstimou.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] leading-snug text-gray-700 dark:text-gray-300">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{t}
              </li>
            ))}
          </ul>
        </div>

        {/* risco */}
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/15">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[11.5px] leading-snug text-amber-800 dark:text-amber-300"><span className="font-semibold">Risco:</span> {op.risco}</p>
        </div>

        {/* Simular = what-if read-only (recalcula em memória; não grava nada). */}
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <div className="mb-2 flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-gray-500" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Simular — fechar % do gap</p>
            <span className="ml-auto rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500 dark:bg-gray-800">what-if · não grava</span>
          </div>
          <div className="flex items-center gap-1">
            {opts.map((f) => (
              <button key={f} type="button" onClick={() => setFrac(f)}
                className={cn('flex-1 rounded-md px-2 py-1.5 text-[12px] font-semibold tabular-nums transition-colors',
                  Math.abs(frac - f) < 1e-9 ? 'bg-[#2563eb] text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300')}>
                {Math.round(f * 100)}%
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-gray-500 dark:text-gray-400">
            Fechando <span className="font-semibold">{Math.round(frac * 100)}%</span> do gap → ganho estimado <span className="font-bold text-emerald-600 dark:text-emerald-400">+{milShort(potencialSim)}</span>{!isBase && <span className="text-gray-400"> (base {Math.round(op.fracBase * 100)}%)</span>}
          </p>
        </div>

        {/* Criar plano — roadmap (implica escrita/persistência); fica desabilitado. */}
        <button type="button" disabled title="Execução na pista é roadmap — o módulo é read-only (diagnóstico e priorização)"
          className="inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[12px] font-semibold text-gray-400 dark:border-gray-700">
          <Lock className="h-3.5 w-3.5" /> Criar plano <span className="text-[10px] font-normal">(roadmap)</span>
        </button>
        <p className="text-center text-[10px] text-gray-400">A IA diagnostica, prioriza e simula; a decisão e a execução são do gestor.</p>
      </div>
    </div>
  )
}

const Oportunidades = () => {
  const data = useOportunidades()
  const [filtro, setFiltro] = useState<'todas' | Alavanca>('todas')
  const [selId, setSelId] = useState<string | null>(null)

  const lista = useMemo(
    () => (filtro === 'todas' ? data.oportunidades : data.oportunidades.filter((o) => o.alavanca === filtro)),
    [data.oportunidades, filtro],
  )
  const selecionada = useMemo(
    () => lista.find((o) => o.id === selId) ?? lista[0] ?? null,
    [lista, selId],
  )

  if (data.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /></div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }
  if (!data.hasRede) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">Sem dados suficientes no período pra varrer oportunidades.</div>
  }

  return (
    <div className="space-y-4">
      {/* Hero KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-transparent bg-gradient-to-br from-[#1e3a5f] to-[#27496f] p-4 text-white shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Potencial de lucro adicional</p>
                <InfoHint className="text-white/60 hover:text-white" text="Soma do lucro adicional estimado de todas as oportunidades priorizadas no período. É um TETO: alinhar cada posto à praça local a custo e volume constantes — o ganho real depende da reação de mercado (elasticidade)." />
              </div>
              <p className="text-[10px] text-white/50">estimativa · teto · no período</p>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10"><TrendingUp className="h-4 w-4" /></span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums">+{milShort(data.potencialTotal)}</p>
          <p className="mt-1 text-[11px] text-white/60">{data.oportunidades.length} oportunidades priorizadas</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Margem média</p>
            <InfoHint text="Margem média de combustível da rede, em R$ por litro (lucro bruto ÷ litros vendidos). Indicador geral — as oportunidades agora são medidas contra a praça LOCAL de cada posto, não contra esta média." />
          </div>
          <p className="text-[10px] text-gray-400">combustível · rede</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{lbL(data.redeMargemL)}<span className="text-sm text-gray-400">/L</span></p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Maior alavanca</p>
            <InfoHint text="A alavanca (Praça ou Conveniência) que concentra a maior fatia do potencial de lucro do período — por onde começar." />
          </div>
          <p className="text-[10px] text-gray-400">onde está o ganho</p>
          <p className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">{data.maiorAlavanca ? ALAVANCA_META[data.maiorAlavanca.alavanca].label : '—'}</p>
          <p className="mt-0.5 text-[11px] text-gray-500">{data.maiorAlavanca ? `${milShort(data.maiorAlavanca.total)} do potencial` : ''}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm dark:border-amber-900/30 dark:bg-amber-950/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700/80 dark:text-amber-400/80">Ação rápida</p>
                <InfoHint className="text-amber-600/70 hover:text-amber-700 dark:text-amber-400/70" text="Oportunidade com a melhor relação retorno/esforço — o maior ganho estimado com um único ajuste de preço." />
              </div>
              <p className="text-[10px] text-amber-700/60">maior R$/esforço</p>
            </div>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">{data.acaoRapida?.posto ?? '—'}</p>
          <p className="mt-0.5 text-[11px] text-gray-500">{data.acaoRapida ? `+${milShort(data.acaoRapida.potencial)} · 1 ajuste` : ''}</p>
        </div>
      </div>

      {/* Banner IA */}
      <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 dark:border-indigo-900/30 dark:bg-indigo-950/10">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#4f46e5] text-white"><Sparkles className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">
            A IA encontrou {data.oportunidades.length} oportunidades que somam <span className="text-emerald-600 dark:text-emerald-400">+{milShort(data.potencialTotal)}</span> de lucro adicional na rede.
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Cada uma é estimada sobre dados reais de volume e margem — a IA prioriza e quantifica; a decisão de preço/ação é sempre sua.</p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-indigo-600 dark:bg-gray-900 dark:text-indigo-300 sm:inline">Análise read-only</span>
      </div>

      {data.pracaIndisponivel && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-[12px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          Ainda não há preço de concorrência cadastrado (aba <strong>Concorrência</strong>) — sem praça não há régua pra medir oportunidade de preço por posto. Cadastre os preços da praça pra ativar a análise.
        </div>
      )}

      {/* Fila + detalhe */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Oportunidades de lucro</h3>
              <p className="text-[11px] text-gray-400">Ordenadas por R$/período · clique para ver a análise</p>
            </div>
            <div className="flex items-center gap-0.5 rounded-lg bg-gray-50 p-0.5 dark:bg-gray-800">
              {(['todas', 'praca', 'conveniencia'] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFiltro(f)}
                  className={cn('rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors', filtro === f ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400')}>
                  {f === 'todas' ? 'Todas' : ALAVANCA_META[f].label}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {lista.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-gray-400">Nenhuma oportunidade nessa alavanca — margens já na média ou acima. 👍</p>}
            {lista.map((o) => {
              const meta = ALAVANCA_META[o.alavanca]
              const active = selecionada?.id === o.id
              return (
                <button key={o.id} type="button" onClick={() => setSelId(o.id)}
                  className={cn('flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors',
                    active
                      ? 'border-[#2563eb] bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/5')}>
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', meta.chip)}><meta.Icon className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold text-gray-800 dark:text-gray-200">{o.titulo}</p>
                      <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase', meta.chip)}>{meta.label}</span>
                    </div>
                    <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{o.subtitulo}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+{milShort(o.potencial)}</p>
                    <p className="text-[10px] text-gray-400">confiança {o.confianca}%</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {selecionada ? <DetailPanel key={selecionada.id} op={selecionada} /> : (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-gray-200 p-10 text-center text-[12px] text-gray-400 dark:border-gray-700">
            Selecione uma oportunidade para ver a análise.
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 px-1 text-[11px] text-gray-400">
        <Percent className="h-3 w-3" /> Potencial = estimativa (teto): gap até a praça × volume, a custo e volume constantes (mesma base do "Ganho de pricing" da Concorrência). O resultado real depende da reação de mercado (elasticidade — roadmap).
      </p>
    </div>
  )
}

export default Oportunidades
