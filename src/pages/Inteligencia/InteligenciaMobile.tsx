import CaduMobile from '@/pages/Inteligencia/CaduMobile'

/**
 * Inteligência da Rede — versão mobile. Só Cadu IA (o Radar de Preços foi pro
 * módulo Comercial). Ocupa a altura toda do shell (flex) pra o input do chat
 * ficar acima da barra inferior, sem cortar.
 */
const InteligenciaMobile = () => {
  return (
    <div className="flex h-full flex-col gap-3">
      <h1 className="shrink-0 text-[19px] font-bold text-gray-900 dark:text-gray-100">Inteligência da Rede</h1>
      <div className="min-h-0 flex-1">
        <CaduMobile />
      </div>
    </div>
  )
}

export default InteligenciaMobile
