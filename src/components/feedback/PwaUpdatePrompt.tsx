import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X, Check, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { RELEASE_NOTES, type ReleaseNote } from '@/releaseNotes'
import { NovidadesLista, NovidadesModal, novidadesDesde, SeloVersao, IconeApp } from '@/components/feedback/Novidades'

// Checa por nova versão de tempos em tempos (além do check no load). Importante
// pro PWA instalado no celular, que pode ficar aberto por horas sem recarregar.
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000 // 30 min

/** Última versão que rodou neste navegador — pra saber, após o reinício, o que é novo. */
const CHAVE_VERSAO = 'visor360.versao'
/** Versão cujas novidades já foram mostradas na tela de atualização (não repetir no reinício). */
const CHAVE_VISTAS = 'visor360.novidadesVistas'

const ler = (storage: Storage, chave: string) => {
  try { return storage.getItem(chave) } catch { return null }
}
const gravar = (storage: Storage, chave: string, valor: string) => {
  try { storage.setItem(chave, valor) } catch { /* sem storage: só perde a memória da versão */ }
}

/**
 * Atualização do PWA com "o que há de novo" — no espírito do iPhone.
 *
 * 1. Deploy novo → o Service Worker novo fica em "waiting" e aparece o banner.
 * 2. "Atualizar" abre a tela cheia AtualizacaoOverlay: busca as notas da versão
 *    NOVA em /release-notes.json (o bundle atual não as conhece), mostra a lista
 *    e uma barra de progresso com ritmo pra dar tempo de ler; no fim manda o
 *    skipWaiting — o plugin recarrega assim que o SW novo assume ("controlling").
 * 3. Depois do reinício, se a versão mudou e as notas ainda não foram vistas
 *    (reload automático, busca falhou), abre o modal "Visor360 atualizado".
 *
 * Também força um `registration.update()` periódico e ao voltar o foco pro app,
 * pra detectar deploys novos sem depender do usuário recarregar na mão.
 */
const PwaUpdatePrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      const check = () => { void registration.update().catch(() => { /* offline/noop */ }) }
      setInterval(check, UPDATE_CHECK_INTERVAL)
      // Voltou pro app (reabriu o PWA, trocou de aba) → checa update na hora.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

  // O registro/checagem do SW roda sempre (acima), mas o BANNER só aparece
  // depois do login — não deve poluir a landing/tela de login.
  const session = useAuthStore((s) => s.session)
  const [instalando, setInstalando] = useState(false)

  // Pós-reinício: "Visor360 atualizado" com o que mudou desde a versão anterior.
  const [posAtualizacao, setPosAtualizacao] = useState<ReleaseNote[] | null>(null)
  useEffect(() => {
    if (!session) return
    const anterior = ler(localStorage, CHAVE_VERSAO)
    if (anterior === __APP_VERSION__) return
    gravar(localStorage, CHAVE_VERSAO, __APP_VERSION__)
    // Primeira vez neste navegador: não há "antes", nada a comparar.
    if (!anterior) return
    if (ler(sessionStorage, CHAVE_VISTAS) === __APP_VERSION__) return
    setPosAtualizacao(novidadesDesde(anterior))
  }, [session])

  if (!session) return null

  return (
    <>
      <NovidadesModal
        open={posAtualizacao !== null}
        onClose={() => setPosAtualizacao(null)}
        releases={posAtualizacao ?? []}
        titulo="O Visor360 foi atualizado"
      />

      {instalando && <AtualizacaoOverlay aplicar={() => void updateServiceWorker(true)} />}

      {needRefresh && !instalando && (
        <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
          <div className="flex w-full max-w-lg items-center gap-3 rounded-2xl border border-white/10 bg-[#1e293b] px-4 py-3 text-white shadow-2xl">
            <IconeApp className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-tight">Nova versão disponível</p>
              <p className="text-[12px] leading-snug text-[#94a3b8]">Atualize e veja o que mudou.</p>
            </div>
            <button
              type="button"
              onClick={() => setInstalando(true)}
              className="shrink-0 rounded-lg bg-[#115e59] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0f766e] active:scale-95"
            >
              Atualizar
            </button>
            <button
              type="button"
              aria-label="Depois"
              onClick={() => setNeedRefresh(false)}
              className="shrink-0 rounded-md p-1.5 text-[#64748b] transition-colors hover:bg-white/10 hover:text-white/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/* ---------------------------------------------------------------- overlay */

type Fase = 'preparando' | 'instalando' | 'pronto' | 'reiniciando'

const ROTULO: Record<Fase, string> = {
  preparando: 'Preparando a atualização…',
  instalando: 'Instalando a nova versão…',
  pronto: 'Pronto para reiniciar',
  reiniciando: 'Reiniciando o Visor360…',
}

/** Duração da barra de instalação; depois ela para em "Pronto" e ESPERA o OK —
 *  quem decide quando reiniciar é o usuário (tempo de ler as novidades). */
const TEMPO_INSTALACAO_MS = 2500
const TEMPO_PREPARO_MIN_MS = 900
const TIMEOUT_NOTAS_MS = 2500
/** Se o SW novo não assumir (e o plugin não recarregar), recarrega na marra. */
const TIMEOUT_REINICIO_MS = 4000

interface NotasPublicadas {
  versao: string
  notas: ReleaseNote[]
}

/** Busca /release-notes.json do deploy NOVO (fora do precache, sem cache HTTP). */
const buscarNotasNovas = async (): Promise<NotasPublicadas | null> => {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_NOTAS_MS)
  try {
    const res = await fetch(`/release-notes.json?v=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal })
    if (!res.ok) return null
    const json = (await res.json()) as Partial<NotasPublicadas>
    if (!json.versao || !Array.isArray(json.notas)) return null
    return { versao: json.versao, notas: json.notas }
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

const AtualizacaoOverlay = ({ aplicar }: { aplicar: () => void }) => {
  const [fase, setFase] = useState<Fase>('preparando')
  const [progresso, setProgresso] = useState(4)
  const [versaoNova, setVersaoNova] = useState<string | null>(null)
  const [releases, setReleases] = useState<ReleaseNote[] | null>(null)
  const aplicado = useRef(false)
  // `aplicar` muda de identidade a cada render do pai; o fluxo roda UMA vez.
  const aplicarRef = useRef(aplicar)
  // Disparado pelo botão OK (definido dentro do efeito, que tem os timers).
  const reiniciarRef = useRef<() => void>(() => {})
  aplicarRef.current = aplicar

  useEffect(() => {
    let vivo = true
    const timers: number[] = []
    const depois = (ms: number, fn: () => void) => { timers.push(window.setTimeout(() => { if (vivo) fn() }, ms)) }

    const rodar = async () => {
      const inicio = Date.now()
      // Fase 1 — busca as notas da versão nova (a versão atual não as conhece).
      const publicadas = await buscarNotasNovas()
      if (!vivo) return
      if (publicadas) {
        setVersaoNova(publicadas.versao)
        // Mesma versão (deploy só com ajustes): nada novo para ler; não repete a
        // lista inteira da versão atual a cada publicação.
        setReleases(publicadas.versao === __APP_VERSION__ ? [] : novidadesDesde(__APP_VERSION__, publicadas.notas))
        // Já vistas aqui → o reinício não repete o modal.
        gravar(sessionStorage, CHAVE_VISTAS, publicadas.versao)
      } else {
        // Sem as notas novas: não inventa — mostra o que este bundle conhece e o
        // reinício abre o "Visor360 atualizado" com as certas.
        setReleases(novidadesDesde(null, RELEASE_NOTES))
      }
      const espera = Math.max(0, TEMPO_PREPARO_MIN_MS - (Date.now() - inicio))

      depois(espera, () => {
        setFase('instalando')
        // Barra avança em passos até 100% e para em "Pronto": o reinício só
        // acontece no OK do usuário.
        const passos = 12
        for (let i = 1; i <= passos; i++) {
          depois((TEMPO_INSTALACAO_MS * i) / passos, () => setProgresso(18 + Math.round((82 * i) / passos)))
        }
        depois(TEMPO_INSTALACAO_MS + 150, () => setFase('pronto'))
      })
    }

    // OK → skipWaiting → SW novo assume → o plugin recarrega a página.
    reiniciarRef.current = () => {
      if (aplicado.current) return
      aplicado.current = true
      setFase('reiniciando')
      aplicarRef.current()
      depois(TIMEOUT_REINICIO_MS, () => window.location.reload())
    }

    setProgresso(12)
    void rodar()
    return () => {
      vivo = false
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [])

  const itens = releases?.flatMap((r) => r.itens) ?? []

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atualizando o Visor360"
      className="fixed inset-0 z-[200] overflow-y-auto bg-[#0b1220] text-[#f1f5f9]"
    >
      <div className="mx-auto flex min-h-full w-full max-w-[500px] flex-col px-4 pb-10 pt-12 sm:justify-center sm:pt-10">
        <div className="overflow-hidden rounded-2xl border border-[#2f3b4f] bg-[#1e293b] shadow-2xl">
          {/* Cabeçalho: ícone, título e versão */}
          <div className="px-6 pb-5 pt-6">
            <div className="flex items-center gap-4">
              <span className="relative">
                {fase !== 'pronto' && <span className="absolute -inset-1 rounded-2xl bg-teal-500/20 motion-safe:animate-ping [animation-duration:2.4s]" />}
                <IconeApp className="relative h-12 w-12" />
              </span>
              <div className="min-w-0">
                <h1 className="text-[19px] font-bold leading-tight">{fase === 'pronto' || fase === 'reiniciando' ? 'Atualização pronta' : 'Atualizando o Visor360'}</h1>
                <span className="mt-1.5 inline-flex items-center gap-2">
                  {versaoNova ? <SeloVersao versao={versaoNova} /> : <span className="text-[12.5px] text-[#94a3b8]">Nova versão</span>}
                  <span className="text-[12.5px] text-[#64748b]">você está na {__APP_VERSION__}</span>
                </span>
              </div>
            </div>

            {/* Progresso */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2 font-medium text-[#cbd5e1]">
                  {fase === 'pronto'
                    ? <Check className="h-3.5 w-3.5 text-teal-300" />
                    : <RefreshCw className={fase === 'reiniciando' ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 motion-safe:animate-spin [animation-duration:1.6s]'} />}
                  {ROTULO[fase]}
                </span>
                <span className="tabular-nums text-[#94a3b8]">{progresso}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0f172a]">
                <div className="h-full rounded-full bg-teal-500 transition-[width] duration-500 ease-out" style={{ width: `${progresso}%` }} />
              </div>
            </div>
          </div>

          {/* O que há de novo, agrupado por tipo */}
          <div className="border-t border-[#2f3b4f] px-6 py-5">
            {releases === null ? (
              <div className="space-y-2 motion-safe:animate-pulse">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-[#2f3b4f] bg-[#172033] p-3.5">
                    <span className="h-9 w-9 shrink-0 rounded-lg bg-white/10" />
                    <div className="flex-1 space-y-1.5 pt-1">
                      <span className="block h-3 w-2/3 rounded bg-white/10" />
                      <span className="block h-2.5 w-full rounded bg-white/[0.07]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {releases.length === 0 && <p className="text-[14px] leading-snug text-[#cbd5e1]">Esta atualização traz só ajustes e correções. Nada novo para ler: é só reiniciar.</p>}
                {releases[0] && <p className="mb-4 text-[14px] leading-snug text-[#cbd5e1]">{releases[0].resumo}</p>}
                <NovidadesLista itens={itens} tom="escuro" />
              </>
            )}
          </div>

          {/* Continuar: libera quando a instalação termina; até lá o usuário lê com calma. */}
          <div className="border-t border-[#2f3b4f] px-6 py-4">
            <button
              type="button"
              onClick={() => reiniciarRef.current()}
              disabled={fase !== 'pronto'}
              className={cn(
                'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-all',
                fase === 'pronto' ? 'bg-[#115e59] text-white hover:bg-[#0f766e] active:scale-[0.99]' : 'cursor-default bg-white/[0.06] text-white/40',
              )}
            >
              {fase === 'reiniciando' ? 'Reiniciando…' : fase === 'pronto' ? <>Continuar <ArrowRight className="h-4 w-4" /></> : 'Instalando…'}
            </button>
            <p className="mt-2.5 text-center text-[11.5px] text-[#64748b]">
              {fase === 'pronto' ? 'Leia com calma. O app só reinicia quando você tocar em Continuar.' : 'Não feche o app enquanto a atualização é instalada.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PwaUpdatePrompt
