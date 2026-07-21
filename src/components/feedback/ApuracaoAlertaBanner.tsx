import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import useApuracaoAtrasada from '@/hooks/useApuracaoAtrasada'
import { useAuthStore } from '@/store/auth'

const brDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')

/**
 * Aviso URGENTE de apuração atrasada. Aparece quando o período aplicado tem dias
 * FECHADOS que a apuração automática não cobriu — os números do período estão
 * incompletos e a data do filtro estaria enganando o usuário ("até dia X") se
 * ficasse quieta. Princípio anti-engano: sinalizar o dado fraco, não esconder.
 */
const ApuracaoAlertaBanner = () => {
  const { atrasada, faltando, ultimoApurado } = useApuracaoAtrasada()
  const isMaster = useAuthStore((s) => s.isMaster)
  if (!atrasada) return null

  const diasTxt = `${faltando} dia${faltando === 1 ? '' : 's'} fechado${faltando === 1 ? '' : 's'}`
  const cobertura = ultimoApurado
    ? `apurado só até ${brDate(ultimoApurado)}`
    : 'nenhum dia do período foi apurado'

  return (
    <div
      role="alert"
      className="mx-4 mt-3 flex flex-col gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 shadow-sm dark:border-red-800/60 dark:bg-red-950/30 sm:flex-row sm:items-center md:mx-6"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-red-800 dark:text-red-200">
          Apuração atrasada — os números deste período estão INCOMPLETOS.
        </p>
        <p className="text-[12px] leading-snug text-red-700 dark:text-red-300">
          A apuração automática não rodou para {diasTxt} ({cobertura}). A data mostra o período inteiro, mas os dados só existem até onde a apuração alcançou.{' '}
          {isMaster ? 'Rode a apuração manual agora.' : 'Avise o administrador para rodar a apuração.'}
        </p>
      </div>
      {isMaster && (
        <Link
          to="/admin/apuracao"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
        >
          Apurar agora <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

export default ApuracaoAlertaBanner
