import { useState, type ComponentType } from 'react'
import { LayoutDashboard, LineChart, Sparkles, Radar, type LucideProps } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

interface Slide {
  Icon: ComponentType<LucideProps>
  /** Gradiente do chip do ícone. */
  chip: string
  title: string
  desc: string
}

const SLIDES: Slide[] = [
  {
    Icon: LayoutDashboard,
    chip: 'from-sky-400 to-blue-600',
    title: 'Bem-vindo ao Visor360',
    desc: 'Toda a sua rede de postos em tempo real, num só lugar: faturamento, litros, margem e projeção do mês — consolidados e por posto.',
  },
  {
    Icon: LineChart,
    chip: 'from-emerald-400 to-teal-600',
    title: 'Vendas e margens com precisão',
    desc: 'Combustível, pista e conveniência com o número exato — ticket médio, lucro bruto e mix por produto, até o nível do grupo.',
  },
  {
    Icon: Sparkles,
    chip: 'from-violet-400 to-purple-600',
    title: 'Cadu IA, seu copiloto',
    desc: 'Pergunte em linguagem natural ("qual posto faturou mais essa semana?") e o Cadu responde na hora, lendo os dados do período selecionado.',
  },
  {
    Icon: Radar,
    chip: 'from-amber-400 to-orange-600',
    title: 'Inteligência e controle',
    desc: 'Radar de Guerra de Preço, produtividade de frentistas e vendedores, e a Qualidade de Dados que aponta cupons suspeitos. Tudo pronto pra agir.',
  },
]

interface WelcomeModalProps {
  userName?: string | null
}

/**
 * Tour de boas-vindas — mostra UMA vez por USUÁRIO (não por dispositivo). A flag
 * vem de `profiles.onboarding_seen` (auth store) e é marcada via RPC
 * `mark_onboarding_seen` no Supabase, então não reaparece em outro
 * dispositivo/navegador/URL de deploy.
 */
const WelcomeModal = ({ userName }: WelcomeModalProps) => {
  const seen = useAuthStore((s) => s.onboardingSeen)
  const setSeen = useAuthStore((s) => s.setOnboardingSeen)
  const [step, setStep] = useState(0)
  const open = !seen

  const finish = () => {
    setSeen(true)  // some na hora (otimista)
    if (supabase) supabase.rpc('mark_onboarding_seen').then(undefined, () => { /* noop */ })
  }

  const isLast = step === SLIDES.length - 1
  const slide = SLIDES[step]
  const Icon = slide.Icon
  const firstName = (userName ?? '').trim().split(/\s+/)[0]

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish() }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        {/* Ícone */}
        <div className="flex justify-center pt-10">
          <span className={cn('flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg', slide.chip)}>
            <Icon className="h-10 w-10 text-white" />
          </span>
        </div>

        {/* Texto */}
        <div className="px-8 pt-6 text-center">
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {step === 0 && firstName ? `Olá, ${firstName}! ` : ''}{slide.title}
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {slide.desc}
          </DialogDescription>
        </div>

        {/* Dots + ações */}
        <div className="mt-8 flex items-center justify-between gap-4 px-8 pb-8">
          <div className="flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir para o passo ${i + 1}`}
                onClick={() => setStep(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === step ? 'w-5 bg-[#2563eb] dark:bg-[#60a5fa]' : 'w-1.5 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600',
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                type="button"
                onClick={finish}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Pular
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
              className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-[#1e3a5f]/90 active:scale-95"
            >
              {isLast ? 'Começar' : 'Próximo'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default WelcomeModal
