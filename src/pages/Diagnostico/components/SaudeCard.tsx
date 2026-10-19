import { Loader2, Fuel, Store, Users, ShoppingBag, Wallet, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import type { Pilar, StatusPilar } from '@/pages/Diagnostico/lib/pilares'
import { calcularSaude, FAIXAS_SAUDE, PESO_PILAR, rotuloNivel, type NivelSaude } from '@/pages/Diagnostico/lib/saude'
import { FONTE_TITULO } from '@/pages/Diagnostico/lib/marca'
import { IconeOuro } from '@/pages/Diagnostico/components/Marca'

/**
 * Saúde do posto / da rede (seção 01): a nota num anel, o nível, a régua das
 * faixas e os pilares em cards com ícone dourado — cada um com a frase que
 * sustenta o status. Regra fixa (pesos declarados no "?"), sem IA.
 */

const COR_NIVEL: Record<NivelSaude, { anel: string; texto: string; faixa: string }> = {
  saudavel: { anel: '#10B981', texto: 'text-emerald-700 dark:text-emerald-300', faixa: 'bg-emerald-500/80' },
  atencao: { anel: '#F59E0B', texto: 'text-amber-700 dark:text-amber-300', faixa: 'bg-amber-400/80' },
  critico: { anel: '#EF4444', texto: 'text-red-700 dark:text-red-300', faixa: 'bg-red-500/80' },
  sem_dado: { anel: '#9CA3AF', texto: 'text-gray-500', faixa: 'bg-gray-300' },
}
const STATUS_SELO: Record<StatusPilar, { txt: string; cls: string }> = {
  bom: { txt: 'Bem', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50' },
  atencao: { txt: 'Atenção', cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50' },
  critico: { txt: 'Crítico', cls: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/50' },
  sem_dado: { txt: 'Sem dado', cls: 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-white/5 dark:text-gray-400 dark:ring-white/10' },
}
const ICONE_PILAR: Record<string, LucideIcon> = { venda: Fuel, loja: Store, pista: Users, vendedores: ShoppingBag, financeiro: Wallet }

const SaudeCard = ({ pilares, sujeito, carregando, Enfase }: { pilares: Pilar[] | null; sujeito: 'posto' | 'rede'; carregando: boolean; Enfase: (p: { t: string }) => React.ReactNode }) => {
  const card = 'rounded-2xl border border-[#0F766E]/15 bg-white p-5 shadow-[0_10px_30px_rgba(11,74,68,.06)] dark:border-white/10 dark:bg-[#0b2e2b]'
  // Enquanto equipe e financeiro não chegaram, a nota seria provisória: melhor não mostrar.
  if (!pilares || carregando) {
    return (
      <div className={cn(card, 'flex items-center gap-2 text-sm text-gray-500')}>
        <Loader2 className="h-4 w-4 animate-spin" /> Medindo a {sujeito === 'rede' ? 'saúde da rede' : 'saúde do posto'}…
      </div>
    )
  }
  const s = calcularSaude(pilares)
  const cor = COR_NIVEL[s.nivel]
  const pesoDe = (p: Pilar) => PESO_PILAR[p.id] ?? 10
  const R = 46, C = 2 * Math.PI * R
  const frac = s.pontos != null ? s.pontos / 100 : 0

  return (
    <div className="space-y-4">
      <div className={cn(card, 'flex flex-wrap items-center gap-x-8 gap-y-5')}>
        {/* Anel da nota */}
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeWidth="10" className="text-gray-100 dark:text-white/10" />
            <circle cx="60" cy="60" r={R} fill="none" stroke={cor.anel} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-[38px] font-extrabold leading-none tabular-nums text-[#0B4A44] dark:text-white" style={{ fontFamily: FONTE_TITULO }}>{s.pontos ?? '—'}</p>
              <p className="text-[11px] text-gray-400">de 100</p>
            </div>
          </div>
        </div>
        <div className="min-w-[220px] flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
            {sujeito === 'rede' ? 'Saúde da rede' : 'Saúde do posto'}
            <InfoHint text="Nota de 0 a 100 tirada dos cinco pilares, com pesos fixos: venda e margem 35, financeiro 25, loja 15, equipe da pista 15, equipe da loja 10. Pilar em 'Bem' vale 100, em 'Atenção' 50, em 'Crítico' 0. Pilar sem dado fica fora da conta. Saudável de 75 a 100, Em atenção de 50 a 74, Crítico abaixo de 50. Regra fixa, sem IA." />
          </p>
          <p className={cn('mt-1 text-[24px] font-extrabold', cor.texto)} style={{ fontFamily: FONTE_TITULO }}>{rotuloNivel(s.nivel)}</p>
          <p className="mt-1 text-[13.5px] leading-snug text-gray-600 dark:text-gray-300">
            {s.pontos != null ? FAIXAS_SAUDE.find((f) => f.nivel === s.nivel)!.descricao : 'Nenhum pilar com dado ainda; a nota aparece quando a venda estiver apurada.'}
          </p>
          {/* Régua com as faixas */}
          <div className="relative mt-3 h-2 w-full max-w-[360px] overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
            {FAIXAS_SAUDE.map((f) => (
              <div key={f.nivel} className={cn('absolute top-0 h-full', COR_NIVEL[f.nivel].faixa)} style={{ left: `${f.de}%`, width: `${f.ate - f.de + 1}%` }} />
            ))}
            {s.pontos != null && <div className="absolute top-0 h-full w-1 rounded-full bg-[#0B4A44] ring-2 ring-white dark:bg-white dark:ring-[#0b2e2b]" style={{ left: `calc(${s.pontos}% - 2px)` }} />}
          </div>
          <div className="mt-1 flex max-w-[360px] justify-between text-[10px] text-gray-400">
            {FAIXAS_SAUDE.map((f) => <span key={f.nivel}>{f.rotulo} {f.de}–{f.ate}</span>)}
          </div>
          {s.pesam.length > 0 && (
            <p className="mt-2 text-[12.5px] text-gray-700 dark:text-gray-300"><b className="font-semibold text-[#0B4A44] dark:text-white">O que pesa:</b> {s.pesam.map((p) => `${p.nome.toLowerCase()} (${STATUS_SELO[p.status].txt.toLowerCase()})`).join(', ')}.</p>
          )}
        </div>
      </div>

      {/* Os pilares, um card cada */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pilares.map((p) => {
          const Icone = ICONE_PILAR[p.id] ?? Fuel
          const selo = STATUS_SELO[p.status]
          return (
            <div key={p.id} className={cn(card, 'p-4', p.status === 'sem_dado' && 'border-dashed opacity-80')}>
              <div className="flex items-start justify-between gap-3">
                <IconeOuro><Icone className="h-5 w-5" /></IconeOuro>
                <span className="text-right">
                  <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', selo.cls)}>{selo.txt}</span>
                  <span className="mt-1 block text-[10.5px] tabular-nums text-gray-400">peso {pesoDe(p)}</span>
                </span>
              </div>
              <p className="mt-3 text-[16px] font-extrabold text-[#0B4A44] dark:text-white" style={{ fontFamily: FONTE_TITULO }}>{p.nome}</p>
              <p className="mt-1 text-[13px] leading-snug text-gray-600 dark:text-gray-300"><Enfase t={p.frase} /></p>
            </div>
          )
        })}
      </div>
      {s.semDado.length > 0 && (
        <p className="text-[11.5px] text-gray-400">Fora da nota por falta de dado: {s.semDado.map((p) => p.nome.toLowerCase()).join(', ')}. Nota sobre {s.consideradas} de {s.total} pilares.</p>
      )}
    </div>
  )
}

export default SaudeCard
