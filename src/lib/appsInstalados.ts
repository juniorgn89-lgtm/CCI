import { useEffect, useState } from 'react'
import { CCI_APPS, APP_ATUAL_ID } from '@/lib/appsCci'
import { isStandalone } from '@/components/pwa/InstallAppModal'

/**
 * Quais apps da suíte estão instalados NESTE navegador/aparelho (mesma lógica
 * do Prospecção360, src/lib/appsInstalados.ts lá).
 *
 * Uma página não enxerga o Windows: o que existe é `getInstalledRelatedApps`,
 * que só responde sobre apps declarados em `related_applications` do nosso
 * manifesto — e, entre origens diferentes, só quando o outro manifesto aponta
 * de volta. O resultado é uma lista do que foi CONFIRMADO: app fora dela não é
 * "não instalado", é "não sei". Por isso o hook também devolve `respondeu`:
 * sem resposta, o launcher não afirma nada (nem "instalado", nem "instalar").
 *
 * O app atual tem um atalho: rodando em janela própria, está instalado.
 */
interface RelatedApp {
  platform: string
  url?: string
  id?: string
}

type NavegadorComApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<RelatedApp[]>
}

const normalizar = (url: string) => url.replace(/\/+$/, '').toLowerCase()

export const useAppsInstalados = () => {
  const [instalados, setInstalados] = useState<Set<string>>(() => new Set(isStandalone() ? [APP_ATUAL_ID] : []))
  const [respondeu, setRespondeu] = useState(false)

  useEffect(() => {
    let vivo = true
    const nav = navigator as NavegadorComApps
    if (!nav.getInstalledRelatedApps) return
    nav
      .getInstalledRelatedApps()
      .then((lista) => {
        if (!vivo) return
        const confirmados = new Set<string>(isStandalone() ? [APP_ATUAL_ID] : [])
        for (const rel of lista) {
          if (rel.platform !== 'webapp' || !rel.url) continue
          const alvo = normalizar(rel.url)
          const app = CCI_APPS.find((a) => a.manifest && normalizar(a.manifest) === alvo)
          if (app) confirmados.add(app.id)
        }
        setInstalados(confirmados)
        setRespondeu(true)
      })
      .catch(() => {
        /* navegador sem a API ou fora de contexto seguro: fica só o app atual */
      })
    return () => {
      vivo = false
    }
  }, [])

  return { instalados, respondeu }
}
