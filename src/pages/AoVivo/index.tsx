import { useEffect } from 'react'
import { useTopbarUi } from '@/store/topbarUi'
import AoVivoRede from '@/pages/AoVivo/components/AoVivoRede'

/**
 * Módulo "Ao Vivo" — o agora da rede (turnos abertos + faturamento fiscal de
 * hoje), separado da Central. Período sempre HOJE; o posto segue o seletor do
 * topo (um posto só, vários ou todos os permitidos). Rota lazy → os dados só são buscados quando o usuário entra aqui,
 * então não pesa o resto do app. Enquanto montado, `liveLock` fixa/desabilita
 * os filtros do header (período "no agora").
 */
const AoVivo = () => {
  const setLiveLock = useTopbarUi((s) => s.setLiveLock)
  useEffect(() => {
    setLiveLock(true)
    return () => setLiveLock(false)
  }, [setLiveLock])

  return (
    <div className="space-y-4">
      <AoVivoRede />
    </div>
  )
}

export default AoVivo
