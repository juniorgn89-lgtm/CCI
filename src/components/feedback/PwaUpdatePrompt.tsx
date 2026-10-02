import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { RELEASE_NOTES, type ReleaseNote } from '@/releaseNotes'
import { NovidadesLista, NovidadesModal, novidadesDesde } from '@/components/feedback/Novidades'

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
        titulo="Visor360 atualizado"
      />

      {instalando && <AtualizacaoOverlay aplicar={() => void updateServiceWorker(true)} />}

      {needRefresh && !instalando && (
        <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
          <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-white/10 bg-[#1e3a5f] px-4 py-3 text-white shadow-2xl">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <RefreshCw className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Nova versão disponível</p>
              <p className="text-[11.5px] leading-snug text-white/70">Atualize e veja o que mudou.</p>
            </div>
            <button
              type="button"
              onClick={() => setInstalando(true)}
              className="shrink-0 rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1d4ed8] active:scale-95"
            >
              Atualizar
            </button>
            <button
              type="button"
              aria-label="Depois"
              onClick={() => setNeedRefresh(false)}
              className="shrink-0 rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
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
        setReleases(novidadesDesde(__APP_VERSION__, publicadas.notas))
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
      className="fixed inset-0 z-[200] overflow-y-auto bg-gradient-to-b from-[#0b1526] via-[#16293f] to-[#1e3a5f] text-white"
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center px-6 pb-10 pt-14 sm:justify-center sm:pt-10">
        {/* Logo com halo pulsando */}
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 rounded-[28px] bg-white/10 motion-safe:animate-ping [animation-duration:2.4s]" />
          <span className="absolute inset-2 rounded-3xl bg-white/5" />
          <img src="/brand/visor360-icon-192.png" alt="" className="relative h-16 w-16 rounded-2xl shadow-2xl" />
        </div>

        <h1 className="text-center text-[22px] font-bold tracking-[-0.01em]">Atualizando o Visor360</h1>
        <p className="mt-1 text-center text-[13px] text-white/60">
          {versaoNova ? `Versão ${versaoNova}` : 'Nova versão'}
          <span className="mx-1.5 text-white/30">·</span>
          você está na {__APP_VERSION__}
        </p>

        {/* Progresso */}
        <div className="mt-7 w-full">
          <div className="mb-2 flex items-center justify-between text-[12.5px]">
            <span className="flex items-center gap-2 font-medium text-white/85">
              {fase === 'pronto'
                ? <Check className="h-3.5 w-3.5 text-emerald-300" />
                : <RefreshCw className={fase === 'reiniciando' ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 motion-safe:animate-spin [animation-duration:1.6s]'} />}
              {ROTULO[fase]}
            </span>
            <span className="tabular-nums text-white/60">{progresso}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-[#FCB619] transition-[width] duration-500 ease-out"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>

        {/* O que há de novo */}
        <div className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#FCB619]">O que há de novo</p>
          {releases === null ? (
            <div className="space-y-3 pt-2 motion-safe:animate-pulse">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="h-9 w-9 shrink-0 rounded-xl bg-white/10" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <span className="block h-3 w-2/3 rounded bg-white/10" />
                    <span className="block h-2.5 w-full rounded bg-white/[0.07]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {releases[0] && <p className="mb-4 text-[13px] leading-snug text-white/75">{releases[0].resumo}</p>}
              <NovidadesLista itens={itens} tom="escuro" />
            </>
          )}
        </div>

        {/* OK: aparece quando a instalação termina; até lá o usuário lê com calma. */}
        <button
          type="button"
          onClick={() => reiniciarRef.current()}
          disabled={fase !== 'pronto'}
          className={cn(
            'mt-6 inline-flex h-11 w-full max-w-xs items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all',
            fase === 'pronto'
              ? 'bg-[#FCB619] text-[#1e3a5f] shadow-lg shadow-black/20 hover:bg-[#ffc733] active:scale-[0.98]'
              : 'cursor-default bg-white/10 text-white/40',
          )}
        >
          {fase === 'reiniciando' ? 'Reiniciando…' : fase === 'pronto' ? 'OK, reiniciar agora' : 'Instalando…'}
        </button>
        <p className="mt-3 text-center text-[11.5px] text-white/45">
          {fase === 'pronto'
            ? 'Leia com calma. O app só reinicia quando você tocar em OK.'
            : 'Não feche o app enquanto a atualização é instalada.'}
        </p>
      </div>
    </div>
  )
}

export default PwaUpdatePrompt
