import CaduMobile from '@/pages/Inteligencia/CaduMobile'

/**
 * Inteligência da Rede — versão mobile. Só Cadu IA (o Radar de Preços foi pro
 * módulo Comercial).
 */
const InteligenciaMobile = () => {
  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Inteligência da Rede</h1>
      <CaduMobile />
    </div>
  )
}

export default InteligenciaMobile
