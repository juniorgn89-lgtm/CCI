import { useState } from 'react'
import { ScrollTabs } from '@/components/mobile/primitives'
import { EmptyCard } from '@/components/mobile/states'
import RadarMobile from '@/pages/Inteligencia/RadarMobile'

const TABS = [
  { id: 'radar', label: 'Radar de Preços' },
  { id: 'assistente', label: 'Cadu IA' },
]

/**
 * Inteligência da Rede — versão mobile. Radar de Preços pronto (flagship);
 * Cadu IA chega numa próxima fase (placeholder). Análise & Comparação NÃO entra
 * no mobile (decisão do produto).
 */
const InteligenciaMobile = () => {
  const [tab, setTab] = useState('radar')
  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Inteligência da Rede</h1>
      <ScrollTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'radar' ? (
        <RadarMobile />
      ) : (
        <div className="py-8">
          <EmptyCard
            title={`${TABS.find((t) => t.id === tab)?.label} em breve`}
            desc="Esta área da Inteligência chega ao mobile nas próximas atualizações. Use o Radar de Preços ou abra no desktop."
          />
        </div>
      )}
    </div>
  )
}

export default InteligenciaMobile
