import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import useConcorrenciaPostos from '@/pages/Comercial/hooks/useConcorrenciaPostos'

const dataBR = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/**
 * Liga/desliga, para UM posto, o uso dos vizinhos cadastrados como referência
 * do Radar. A decisão é do dono, posto a posto, e vale para toda a rede (salva
 * no sistema). Usado na aba Concorrência e na análise do posto no Radar.
 */
const UsoVizinhosToggle = ({ empresaCodigo, posto, temVizinhos, compacto }: {
  empresaCodigo: number
  posto: string
  temVizinhos: boolean
  compacto?: boolean
}) => {
  const cfg = useConcorrenciaPostos()
  const usar = cfg.usa(empresaCodigo)
  const info = cfg.porPosto.get(empresaCodigo)
  const ocupado = cfg.salvando === empresaCodigo
  const bloqueado = !temVizinhos && !usar

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-4 py-2.5',
      usar ? 'border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-[#0f0f0f]',
      compacto && 'px-3 py-2',
    )}>
      {!compacto && (
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white', usar ? 'bg-[#2563eb]' : 'bg-gray-400 dark:bg-gray-600')}>
          <Users className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[13px] font-semibold text-gray-800 dark:text-gray-100">
          Usar os vizinhos do {posto} como referência
          <InfoHint text="Vale só para este posto. Ligado, o Radar compara o preço deste posto com a média dos vizinhos cadastrados para ele (preços de até 7 dias). Desligado, compara com a média da própria rede. Cada posto tem a sua escolha, e todos da rede veem a mesma." />
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {bloqueado
            ? 'Cadastre os vizinhos deste posto na aba Concorrência para poder ligar.'
            : usar
              ? 'Ligado: o Radar deste posto usa a média dos vizinhos.'
              : 'Desligado: o Radar deste posto usa a média da própria rede.'}
          {info?.porNome && <span className="text-gray-400 dark:text-gray-500"> · alterado por {info.porNome} em {dataBR(info.em)}</span>}
        </p>
        {cfg.erro && <p className="text-[11px] text-red-600 dark:text-red-400">{cfg.erro}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={usar}
        disabled={ocupado || bloqueado || cfg.isLoading}
        onClick={() => cfg.alternar(empresaCodigo)}
        className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50', usar ? 'bg-[#2563eb]' : 'bg-gray-300 dark:bg-gray-600')}
        aria-label={`Usar os vizinhos do ${posto} como referência`}
      >
        <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', usar ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}

export default UsoVizinhosToggle
