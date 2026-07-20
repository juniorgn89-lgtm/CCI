import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, CloudOff } from 'lucide-react'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import useConcorrencia from '@/pages/Comercial/hooks/useConcorrencia'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { todayLocal } from '@/lib/period'
import GuerraPreco from './GuerraPreco'
import RadarVisaoGeral from './RadarVisaoGeral'

/**
 * Aba "Radar de Preços" do módulo Comercial. Roteia entre:
 *  - Visão Geral (entrada): todos os postos × combustíveis por situação;
 *  - Análise (drill): um posto/combustível a fundo (preço, margem, simulador).
 * O drill é alcançado por "Analisar" (parâmetros `?posto=&fuel=` na URL, então é
 * compartilhável e o "voltar" do navegador retorna à Visão Geral).
 * Análise baseada no abastecimento da PRÓPRIA rede (sem preço de concorrente).
 */

/** Drill: um posto por vez (o abastecimento cru é gated a 1 posto). Trava no mês
 *  corrente (decisão "pra frente"). Só monta quando a análise está aberta. */
const RadarAnalise = ({ postoCodigo, fuelInicial, onVoltar, onTrocarPosto }: {
  postoCodigo: number
  fuelInicial?: string
  onVoltar: () => void
  onTrocarPosto: (codigo: number) => void
}) => {
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const postos = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const postoCodes = postos.map((p) => p.codigo)
  const selectedCodigo = postoCodes.includes(postoCodigo) ? postoCodigo : (postos[0]?.codigo ?? null)

  const monthStart = `${todayLocal().slice(0, 7)}-01`
  const hoje = todayLocal()
  const { rows, fuelTypeData, isLoading, fisicoIndisponivel } = useAbastecimentosAnalytics(selectedCodigo, { periodo: { dataInicial: monthStart, dataFinal: hoje } })
  // Preço de praça (concorrência) do posto — amarra o preço observado do
  // concorrente ao drill por combustível. Lê o mesmo `concorrencia_precos` da aba
  // Concorrência; não depende da Quality (é dado manual em Supabase).
  const concorrencia = useConcorrencia(selectedCodigo)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 transition-colors hover:border-[#2563eb] hover:text-[#2563eb] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />Visão Geral
        </button>
        {postos.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {postos.map((e) => (
              <button
                key={e.codigo}
                type="button"
                onClick={() => onTrocarPosto(e.codigo)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
                  e.codigo === selectedCodigo
                    ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700'
                    : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-400 dark:hover:bg-gray-800',
                )}
              >
                {e.fantasia}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-md" />)}
          </div>
        ) : fisicoIndisponivel ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500 dark:bg-amber-950/30 dark:text-amber-400">
              <CloudOff className="h-6 w-6" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Análise do mês indisponível agora</p>
              <p className="mx-auto max-w-md text-[12px] leading-snug text-gray-500 dark:text-gray-400">
                A análise por posto usa o abastecimento do mês corrente, que vem ao vivo do sistema da Quality — e ele está <span className="font-medium">fora do ar</span> no momento (não é um problema do Visor360). Assim que voltar, esta tela carrega sozinha.
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Enquanto isso, a <span className="font-medium">Visão Geral</span> (botão acima) segue funcionando — ela lê do cache fiscal.</p>
            </div>
          </div>
        ) : (
          <GuerraPreco rows={rows} fuelTypes={fuelTypeData} dataInicial={monthStart} fuelInicial={fuelInicial} concorrenciaByFuel={concorrencia.byFuel} />
        )}
      </section>
    </div>
  )
}

const RadarPrecos = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const postoParam = searchParams.get('posto')
  const fuelParam = searchParams.get('fuel') ?? undefined

  const abrirAnalise = (postoCodigo: number, fuel: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('posto', String(postoCodigo))
    if (fuel) next.set('fuel', fuel); else next.delete('fuel')
    setSearchParams(next)
  }
  const voltar = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('posto'); next.delete('fuel')
    setSearchParams(next)
  }

  if (postoParam == null) {
    return <RadarVisaoGeral onAnalisar={abrirAnalise} />
  }
  return (
    <RadarAnalise
      postoCodigo={Number(postoParam)}
      fuelInicial={fuelParam}
      onVoltar={voltar}
      onTrocarPosto={(c) => abrirAnalise(c, fuelParam ?? '')}
    />
  )
}

export default RadarPrecos
