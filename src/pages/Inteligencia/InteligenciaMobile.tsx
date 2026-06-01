import { useState } from 'react'
import { ScrollTabs } from '@/components/mobile/primitives'
import RadarMobile from '@/pages/Inteligencia/RadarMobile'
import CaduMobile from '@/pages/Inteligencia/CaduMobile'

const TABS = [
  { id: 'radar', label: 'Radar de Preços' },
  { id: 'assistente', label: 'Cadu IA' },
]

/**
 * Inteligência da Rede — versão mobile. Radar de Preços + Cadu IA.
 * Análise & Comparação NÃO entra no mobile (decisão do produto).
 */
const InteligenciaMobile = () => {
  const [tab, setTab] = useState('radar')
  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Inteligência da Rede</h1>
      <ScrollTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'radar' ? <RadarMobile /> : <CaduMobile />}
    </div>
  )
}

export default InteligenciaMobile
