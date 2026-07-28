import { useEffect, useState } from 'react'
import { Sparkles, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const PASSOS_PADRAO = [
  'Lendo os caixas e turnos do dia',
  'Conferindo dinheiro, cartão, PIX e vouchers',
  'Comparando com o histórico de 90 dias',
  'Sinalizando o que merece a sua atenção',
]

/**
 * Overlay "a IA está analisando os documentos" — mostrado SOBRE o conteúdo enquanto
 * o copiloto carrega os dados. Os passos avançam no tempo (leitura visual do trabalho
 * em curso), não são etapas reais de fetch. READ-ONLY: a IA só confere, não altera
 * nada — daí a legenda honesta. Pensado pra ficar `absolute inset-0` num pai `relative`.
 */
const IAAnalisando = ({
  titulo = 'A IA está analisando os documentos',
  passos = PASSOS_PADRAO,
}: {
  titulo?: string
  passos?: string[]
}) => {
  const [ativo, setAtivo] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setAtivo((p) => Math.min(p + 1, passos.length - 1)), 1300)
    return () => clearInterval(id)
  }, [passos.length])

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm dark:bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900/95">
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-14 w-14 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-2xl bg-violet-400/40" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
              <Sparkles className="h-7 w-7 text-white" />
            </span>
          </div>
          <p className="mt-4 text-[15px] font-semibold text-gray-900 dark:text-gray-100">{titulo}</p>
          <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500">
            Leva alguns segundos — nada é alterado, só conferido.
          </p>
        </div>

        <ul className="mt-5 space-y-2.5">
          {passos.map((txt, i) => {
            const feito = i < ativo
            const atual = i === ativo
            return (
              <li key={txt} className="flex items-center gap-2.5 text-[13px]">
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors',
                    feito
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : atual
                        ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300'
                        : 'bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-600',
                  )}
                >
                  {feito ? (
                    <Check className="h-3 w-3" />
                  ) : atual ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span
                  className={cn(
                    'transition-colors',
                    feito
                      ? 'text-gray-500 dark:text-gray-400'
                      : atual
                        ? 'font-medium text-gray-800 dark:text-gray-200'
                        : 'text-gray-400 dark:text-gray-600',
                  )}
                >
                  {txt}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

export default IAAnalisando
