import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { useTenantStore } from '@/store/tenant'
import { fetchUltimaApuracao } from '@/api/supabase/apuracao'

/** Formata ISO → "DD/MM/AAAA às HH:MM" (igual ao "Atualizado em…" do BI). */
const fmt = (iso: string): string => {
  const d = new Date(iso)
  if (!isFinite(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Mostra a data/hora da última apuração da rede — referência de frescor do dado
 * pra todos os usuários, em todas as telas (vive no Header global). Igual ao
 * "Atualizado em…" do BI de referência. Some sozinho se não houver rede/apuração.
 */
const UltimaApuracaoInfo = () => {
  const rede = useTenantStore((s) => s.rede)
  const { data } = useQuery({
    queryKey: ['ultima-apuracao', rede?.id],
    queryFn: () => (rede ? fetchUltimaApuracao(rede.id) : null),
    enabled: !!rede,
    staleTime: 60 * 1000,
  })
  if (!data) return null
  return (
    <span
      className="hidden items-center gap-1 whitespace-nowrap text-[11px] text-gray-400 dark:text-gray-500 sm:inline-flex"
      title="Data e hora da última apuração desta rede (dias fechados gravados no cache). O dia corrente continua ao vivo."
    >
      <Clock className="h-3 w-3" />
      Apurado em {fmt(data)}
    </span>
  )
}

export default UltimaApuracaoInfo
