import { Layers, Sparkles, Rocket, Check, ArrowUpRight, BadgeCheck, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTenantStore } from '@/store/tenant'
import { PLANOS, getPlano, recursosAcumulados, type PlanoId, type PlanoDef } from '@/lib/planos'
import { useRedeNomeExibicao } from '@/hooks/useDemo'

/** Guardado para quando voltarmos a trabalhar com planos (saiu de Parâmetros em 24/11/2026). */
/* ─── Meu plano ─────────────────────────────────────────────────────────────
 * Mostra o plano comercial da rede ativa (redes.plano) + o que está incluído
 * (acumulado) + solicitar troca. Informativo — não trava módulo. Preço sob
 * consulta (CTA pro comercial). Fonte: src/lib/planos.ts. */

const PLAN_TINT: Record<PlanoId, { icon: typeof Layers; iconWrap: string; ring: string }> = {
  basic: {
    icon: Layers,
    iconWrap: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    ring: 'border-slate-300 dark:border-slate-600',
  },
  premium: {
    icon: Sparkles,
    iconWrap: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    ring: 'border-amber-300 dark:border-amber-500/40',
  },
  pro: {
    icon: Rocket,
    iconWrap: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    ring: 'border-teal-300 dark:border-teal-500/40',
  },
}

const COMERCIAL_MAIL = 'comercial@cci.app.br'

const MeuPlanoSection = () => {
  const rede = useTenantStore((s) => s.rede)
  const atual = getPlano(rede?.plano)
  const redeNome = useRedeNomeExibicao(rede?.nome) ?? 'minha rede'

  const mailFor = (alvo?: PlanoDef) => {
    const subject = alvo ? `Interesse no plano ${alvo.nome} — Visor360` : 'Troca de plano — Visor360'
    const body =
      `Olá! Quero falar sobre o plano da rede "${redeNome}".\n` +
      `Plano atual: ${atual?.nome ?? 'não definido'}.` +
      (alvo ? `\nTenho interesse no plano: ${alvo.nome}.` : '') +
      '\n\n'
    return `mailto:${COMERCIAL_MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const AtualIcon = atual ? PLAN_TINT[atual.id].icon : Info

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Meu plano
      </h2>

      {/* Banner do plano atual + o que está incluído (acumulado) */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700">
        {atual ? (
          <>
            <div className="flex items-start gap-3">
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', PLAN_TINT[atual.id].iconWrap)}>
                <AtualIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Plano atual</p>
                <p className="text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">
                  Visor360 {atual.nome}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{atual.tagline}</p>
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                sob consulta
              </span>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="mb-3 text-xs font-semibold text-gray-700 dark:text-gray-300">O que está incluído</p>
              <div className="grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
              {recursosAcumulados(atual.id).map(({ plano, recursos }) => (
                <div key={plano.id}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">{plano.nome}</p>
                  <ul className="mt-1 space-y-1">
                    {recursos.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-[13px] text-gray-600 dark:text-gray-300">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800">
              <Info className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Plano ainda não definido</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Fale com o comercial pra confirmar o plano da sua rede.
              </p>
              <a href={mailFor()} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
                Falar com o comercial <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Trocar de plano — os 3 planos, o atual destacado */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Quer trocar de plano?</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANOS.map((p) => {
            const isAtual = atual?.id === p.id
            const T = PLAN_TINT[p.id]
            const Icon = T.icon
            return (
              <div
                key={p.id}
                className={cn(
                  'flex flex-col rounded-xl border bg-white p-4 shadow-sm',
                  isAtual ? cn(T.ring, 'ring-2 ring-blue-500/20') : 'border-gray-200 dark:border-gray-700',
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', T.iconWrap)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{p.nome}</p>
                  {p.destaque && !isAtual && (
                    <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Recomendado
                    </span>
                  )}
                </div>
                <p className="mt-2 flex-1 text-[12px] leading-snug text-gray-500 dark:text-gray-400">{p.tagline}</p>
                {isAtual ? (
                  <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 dark:text-blue-400">
                    <BadgeCheck className="h-4 w-4" /> Seu plano
                  </span>
                ) : (
                  <a
                    href={mailFor(p)}
                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Solicitar <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
          Preços sob consulta. A troca é liberada pelo seu representante CCI.
        </p>
      </div>
    </section>
  )
}


export default MeuPlanoSection
