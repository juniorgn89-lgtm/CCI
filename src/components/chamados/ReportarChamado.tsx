import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Bug, Loader2, Maximize2, Pencil, Undo2, X, Send, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { useThemeStore } from '@/store/theme'
import { errosRecentes } from '@/lib/errosRecentes'
import { criarChamado, TIPO_LABEL, TIPO_AJUDA, type ChamadoTipo, type ChamadoContexto } from '@/api/supabase/chamados'

/**
 * Botão do topo "Reportar" (só diretores da CCI). Fluxo:
 *  1. clique → tira o print da tela como está (pelo próprio Visor, sem pedir
 *     permissão de compartilhar tela);
 *  2. a tela congela escurecida: arrasta para recortar, ou "Tela inteira";
 *  3. no recorte dá para riscar com a caneta, escolher o tipo e escrever;
 *  4. envia → tabela `chamados` + print no bucket privado, com o contexto
 *     (tela, filtros, rede, versão, navegador, erros recentes) junto.
 */

type Rect = { x: number; y: number; w: number; h: number }
type Fase = 'capturando' | 'recorte' | 'form' | 'enviando' | 'enviado'

const TIPOS: ChamadoTipo[] = ['bug', 'melhoria', 'numero', 'duvida']
const MIN_LADO = 16

const ReportarChamado = () => {
  const podeAbrir = useAuthStore((s) => s.canAbrirChamados)
  const [fase, setFase] = useState<Fase | null>(null)
  const [shot, setShot] = useState<HTMLCanvasElement | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const abrir = async () => {
    setErro(null)
    setFase('capturando')
    try {
      const { domToCanvas } = await import('modern-screenshot')
      // A cópia da página usada no print perde a rolagem dos containers internos
      // (sairia sempre o topo). Marca quem está rolado e reaplica a rolagem na cópia.
      const rolados: HTMLElement[] = []
      document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
        if (el.scrollTop > 0 || el.scrollLeft > 0) {
          el.dataset.printScroll = `${el.scrollTop},${el.scrollLeft}`
          rolados.push(el)
        }
      })
      let canvas: HTMLCanvasElement
      try {
        canvas = await domToCanvas(document.body, {
          width: window.innerWidth,
          height: window.innerHeight,
          scale: Math.min(2, window.devicePixelRatio || 1),
          // O próprio botão e qualquer coisa marcada como fora do print não entram.
          filter: (n) => !(n instanceof HTMLElement && n.dataset.foraDoPrint !== undefined),
          onCloneNode: (copia) => {
            if (!(copia instanceof HTMLElement)) return
            // A cópia ganha a margem padrão do navegador (8px): desloca e aperta o layout.
            copia.style.margin = '0'
            copia.querySelectorAll<HTMLElement>('[data-print-scroll]').forEach((el) => {
              const [top, left] = (el.dataset.printScroll ?? '0,0').split(',').map(Number)
              el.style.overflow = 'hidden'
              for (const filho of Array.from(el.children) as HTMLElement[]) {
                filho.style.transform = `translate(${-left}px, ${-top}px)`
              }
            })
          },
        })
      } finally {
        for (const el of rolados) delete el.dataset.printScroll
      }
      setShot(canvas)
      setFase('recorte')
    } catch (e) {
      // Sem print, o chamado ainda pode ir só com o texto.
      setShot(null)
      setErro(`Não foi possível tirar o print (${e instanceof Error ? e.message : String(e)}). Dá para enviar só com o texto.`)
      setFase('form')
    }
  }

  const fechar = () => { setFase(null); setShot(null); setErro(null) }

  if (!podeAbrir) return null
  return (
    <>
      <button
        type="button"
        data-fora-do-print
        onClick={() => void abrir()}
        disabled={fase !== null}
        title="Reportar bug, melhoria, número estranho ou dúvida (com print da tela)"
        aria-label="Reportar"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
      >
        {fase === 'capturando' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
      </button>
      {fase && fase !== 'capturando' && createPortal(
        <Fluxo shot={shot} faseInicial={fase} erroInicial={erro} onFechar={fechar} />,
        document.body,
      )}
    </>
  )
}

/* ─── recorte + formulário ───────────────────────────────────────────── */

const Fluxo = ({ shot, faseInicial, erroInicial, onFechar }: {
  shot: HTMLCanvasElement | null
  faseInicial: Fase
  erroInicial: string | null
  onFechar: () => void
}) => {
  const [fase, setFase] = useState<Fase>(faseInicial)
  const [rect, setRect] = useState<Rect | null>(null)
  const [recorte, setRecorte] = useState<Rect | 'tela inteira' | null>(null)
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const [url] = useState(() => shot?.toDataURL('image/png') ?? null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onFechar])

  const confirmarRecorte = (r: Rect | 'tela inteira') => { setRecorte(r); setFase('form') }

  if (fase === 'recorte' && shot && url) {
    return (
      <div
        data-fora-do-print
        className="fixed inset-0 z-[9999] cursor-crosshair select-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-barra]')) return
          inicio.current = { x: e.clientX, y: e.clientY }
          setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 })
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!inicio.current) return
          const a = inicio.current
          setRect({ x: Math.min(a.x, e.clientX), y: Math.min(a.y, e.clientY), w: Math.abs(e.clientX - a.x), h: Math.abs(e.clientY - a.y) })
        }}
        onPointerUp={() => {
          inicio.current = null
          if (rect && rect.w >= MIN_LADO && rect.h >= MIN_LADO) confirmarRecorte(rect)
          else setRect(null)
        }}
      >
        <img src={url!} alt="" className="pointer-events-none absolute inset-0 h-full w-full" draggable={false} />
        {rect && rect.w > 0 ? (
          <div className="pointer-events-none absolute rounded-sm border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-black/55" />
        )}
        <div data-barra className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-[#161616] px-3 py-2 text-[13px] text-gray-100 shadow-2xl">
          <span className="px-1">Arraste para recortar o que quer mostrar</span>
          <button type="button" onClick={() => confirmarRecorte('tela inteira')} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold hover:bg-white/20">
            <Maximize2 className="h-3.5 w-3.5" /> Tela inteira
          </button>
          <button type="button" onClick={onFechar} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-gray-300 hover:bg-white/10">
            <X className="h-3.5 w-3.5" /> Cancelar <kbd className="text-[10px] text-gray-500">Esc</kbd>
          </button>
        </div>
      </div>
    )
  }

  return <Formulario shot={shot} recorte={recorte} erroInicial={erroInicial} onFechar={onFechar} onRefazer={shot ? () => { setRect(null); setFase('recorte') } : undefined} />
}

const Formulario = ({ shot, recorte, erroInicial, onFechar, onRefazer }: {
  shot: HTMLCanvasElement | null
  recorte: Rect | 'tela inteira' | null
  erroInicial: string | null
  onFechar: () => void
  onRefazer?: () => void
}) => {
  const { pathname, search } = useLocation()
  const user = useAuthStore((s) => s.user)
  const fullName = useAuthStore((s) => s.fullName)
  const rede = useTenantStore((s) => s.rede)
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const dark = useThemeStore((s) => s.dark)

  const [tipo, setTipo] = useState<ChamadoTipo>('bug')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(erroInicial)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  // Canvas do recorte (base) + camada da caneta por cima.
  const base = useRef<HTMLCanvasElement>(null)
  const tinta = useRef<HTMLCanvasElement>(null)
  const tracos = useRef<ImageData[]>([])
  const desenhando = useRef(false)
  const [temTraco, setTemTraco] = useState(false)

  const escala = shot ? shot.width / window.innerWidth : 1
  const area: Rect | null = shot ? (recorte && recorte !== 'tela inteira' ? recorte : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight }) : null
  // Tamanho na tela: cabe no modal sem distorcer (o canvas em si fica na resolução do print).
  const exibir = area ? (() => { const k = Math.min(1, Math.min(720, window.innerWidth - 80) / area.w, (window.innerHeight * 0.44) / area.h); return { width: Math.round(area.w * k), height: Math.round(area.h * k) } })() : undefined

  useEffect(() => {
    if (!shot || !area || !base.current || !tinta.current) return
    const w = Math.round(area.w * escala), h = Math.round(area.h * escala)
    for (const c of [base.current, tinta.current]) { c.width = w; c.height = h }
    base.current.getContext('2d')!.drawImage(shot, Math.round(area.x * escala), Math.round(area.y * escala), w, h, 0, 0, w, h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, recorte])

  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget, r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }
  }
  const comecar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext('2d')!
    tracos.current.push(ctx.getImageData(0, 0, e.currentTarget.width, e.currentTarget.height))
    desenhando.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = ponto(e)
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4 * escala; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
  }
  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!desenhando.current) return
    const ctx = e.currentTarget.getContext('2d')!, p = ponto(e)
    ctx.lineTo(p.x, p.y); ctx.stroke()
  }
  const parar = () => { if (desenhando.current) { desenhando.current = false; setTemTraco(true) } }
  const desfazer = () => {
    const ultimo = tracos.current.pop()
    if (ultimo && tinta.current) tinta.current.getContext('2d')!.putImageData(ultimo, 0, 0)
    setTemTraco(tracos.current.length > 0)
  }

  const montarPrint = useCallback(async (): Promise<Blob | null> => {
    if (!base.current || !tinta.current || !shot) return null
    const out = document.createElement('canvas')
    out.width = base.current.width; out.height = base.current.height
    const ctx = out.getContext('2d')!
    ctx.drawImage(base.current, 0, 0); ctx.drawImage(tinta.current, 0, 0)
    return new Promise((res) => out.toBlob((b) => res(b), 'image/png'))
  }, [shot])

  const enviar = async () => {
    if (!descricao.trim()) { setErro('Escreva em uma frase o que aconteceu.'); return }
    if (!user) { setErro('Sessão expirada: entre de novo.'); return }
    setErro(null); setEnviando(true)
    try {
      const contexto: ChamadoContexto = {
        url: `${pathname}${search}`,
        tela: pathname,
        titulo: document.title,
        rede: { id: rede?.id ?? null, nome: rede?.nome ?? null },
        filtros: { empresaCodigos, dataInicial, dataFinal },
        versao: __APP_VERSION__,
        navegador: navigator.userAgent,
        viewport: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
        tema: dark ? 'escuro' : 'claro',
        recorte: recorte ?? undefined,
        erros: errosRecentes(),
      }
      await criarChamado({
        tipo, descricao, print: await montarPrint(), contexto,
        redeId: rede?.id ?? null,
        autor: { userId: user.id, nome: fullName ?? user.email ?? 'Diretor' },
      })
      setEnviado(true)
      window.setTimeout(onFechar, 1400)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally { setEnviando(false) }
  }

  return (
    <div data-fora-do-print className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !enviando) onFechar() }}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#111]">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f] text-white"><Bug className="h-4 w-4" /></span>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Novo chamado</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">A tela, os filtros, a rede e a versão vão junto automaticamente</p>
            </div>
          </div>
          <button type="button" onClick={onFechar} disabled={enviando} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {shot && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5 text-red-500" /> Risque em cima do print para apontar o problema</span>
                <span className="flex gap-1">
                  <button type="button" onClick={desfazer} disabled={!temTraco} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"><Undo2 className="h-3.5 w-3.5" /> Desfazer traço</button>
                  {onRefazer && <button type="button" onClick={onRefazer} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"><Maximize2 className="h-3.5 w-3.5" /> Recortar de novo</button>}
                </span>
              </div>
              <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <canvas ref={base} className="block" style={exibir} />
                <canvas ref={tinta} className="absolute inset-0 h-full w-full cursor-crosshair touch-none" onPointerDown={comecar} onPointerMove={mover} onPointerUp={parar} onPointerLeave={parar} />
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-gray-700 dark:text-gray-300">Tipo</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left transition-colors',
                    tipo === t ? 'border-[#2563eb] bg-blue-50 dark:border-blue-500 dark:bg-blue-500/10' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600',
                  )}
                >
                  <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">{TIPO_LABEL[t]}</span>
                  <span className="block text-[11px] leading-snug text-gray-500 dark:text-gray-400">{TIPO_AJUDA[t]}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="chamado-desc" className="mb-1.5 block text-[12px] font-semibold text-gray-700 dark:text-gray-300">O que aconteceu?</label>
            <textarea
              id="chamado-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              autoFocus
              placeholder={tipo === 'numero' ? 'Ex.: o lucro bruto do Itapoã em outubro aqui dá R$ 116 mil; no WebPosto dá R$ 109 mil.' : tipo === 'melhoria' ? 'Ex.: queria poder filtrar por bandeira nesta tabela.' : tipo === 'duvida' ? 'Ex.: o que significa esta coluna?' : 'Ex.: cliquei em Exportar e nada aconteceu.'}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20 dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100"
            />
          </div>

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:bg-red-950/40 dark:text-red-300">{erro}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          {enviado ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Chamado enviado</span>
          ) : (
            <>
              <button type="button" onClick={onFechar} disabled={enviando} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">Cancelar</button>
              <button type="button" onClick={() => void enviar()} disabled={enviando} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#27496f] disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500">
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportarChamado
