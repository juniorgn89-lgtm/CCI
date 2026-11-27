import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Bug, Camera, ImagePlus, Loader2, Maximize2, Pencil, Undo2, X, Send, CheckCircle2, Timer, ArrowLeft, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { useThemeStore } from '@/store/theme'
import { errosRecentes } from '@/lib/errosRecentes'
import { criarChamado, TIPO_LABEL, TIPO_AJUDA, type ChamadoTipo, type ChamadoContexto } from '@/api/supabase/chamados'

/**
 * Botão do topo "Reportar". Fluxo:
 *  1. clique → tira o print da tela como está (pelo próprio Visor, sem pedir
 *     permissão de compartilhar tela);
 *  2. a tela congela escurecida: arrasta para recortar, ou "Tela inteira";
 *  3. no formulário dá para riscar com a caneta, escolher o tipo e escrever;
 *  4. MAIS PRINTS: "Tirar print de outra tela do Visor" recolhe o chamado numa
 *     barrinha (o rascunho fica guardado) para a pessoa navegar e tirar outro;
 *     "Anexar print de fora do Visor" aceita arquivo, colar (Ctrl+V) ou arrastar
 *     (ex.: a tela do WebPosto, para comparar);
 *  5. envia → tabela `chamados` + print no bucket privado, com o contexto.
 *
 * Vários prints viram UMA imagem (um embaixo do outro, com legenda): assim o
 * chamado segue o mesmo contrato com a Central CCI (um print por chamado), sem
 * mudar banco nem Edge Function.
 */

type Rect = { x: number; y: number; w: number; h: number }
type Modo = 'capturando' | 'recorte' | 'form' | 'minimizado'

interface PrintItem {
  id: string
  origem: 'visor' | 'externo'
  /** Tela do Visor (pathname) ou nome do arquivo de fora. */
  rotulo: string
  base: HTMLCanvasElement
  tinta: HTMLCanvasElement
  recorte?: Rect | 'tela inteira'
  /** Print da tela inteira (só do Visor): permite recortar de novo. */
  tela?: HTMLCanvasElement
}

const TIPOS: ChamadoTipo[] = ['bug', 'melhoria', 'numero', 'duvida']
const MIN_LADO = 16
/** Lado maior de uma imagem de fora (o resto é reduzido). */
const MAX_EXTERNO = 2000
/** Limite do print enviado (a Central aceita até 5 MB). */
const MAX_BYTES = 4.5 * 1024 * 1024

const novoCanvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()))

/** Print da tela atual do Visor (sem o que estiver marcado como fora do print). */
const capturarTela = async (): Promise<HTMLCanvasElement> => {
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
  try {
    return await domToCanvas(document.body, {
      width: window.innerWidth,
      height: window.innerHeight,
      scale: Math.min(2, window.devicePixelRatio || 1),
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
}

/** Recorta o print da tela (rect em px da tela) na resolução do print. */
const recortar = (shot: HTMLCanvasElement, r: Rect | 'tela inteira'): HTMLCanvasElement => {
  const k = shot.width / window.innerWidth
  const a = r === 'tela inteira' ? { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight } : r
  const w = Math.max(1, Math.round(a.w * k)), h = Math.max(1, Math.round(a.h * k))
  const c = novoCanvas(w, h)
  c.getContext('2d')!.drawImage(shot, Math.round(a.x * k), Math.round(a.y * k), w, h, 0, 0, w, h)
  return c
}

/** Imagem de fora (arquivo/colar/arrastar) → canvas, reduzida se for enorme. */
const imagemParaCanvas = (arquivo: Blob): Promise<HTMLCanvasElement> => new Promise((res, rej) => {
  const url = URL.createObjectURL(arquivo)
  const img = new Image()
  img.onload = () => {
    const k = Math.min(1, MAX_EXTERNO / Math.max(img.naturalWidth, img.naturalHeight))
    const c = novoCanvas(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k))
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    URL.revokeObjectURL(url)
    res(c)
  }
  img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não deu para abrir essa imagem.')) }
  img.src = url
})

const legendaDe = (p: PrintItem, i: number, n: number) =>
  `${i + 1} de ${n} · ${p.origem === 'visor' ? `Print do Visor · ${p.rotulo}` : `Imagem de fora do Visor${p.rotulo ? ` · ${p.rotulo}` : ''}`}`

/** Junta os prints (com os riscos) numa imagem só; com 1 print, sai igual ao de sempre. */
const montarImagem = async (prints: PrintItem[]): Promise<Blob | null> => {
  if (prints.length === 0) return null
  const planos = prints.map((p) => {
    const c = novoCanvas(p.base.width, p.base.height)
    const ctx = c.getContext('2d')!
    ctx.drawImage(p.base, 0, 0); ctx.drawImage(p.tinta, 0, 0)
    return c
  })
  const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((res) => c.toBlob((b) => res(b), 'image/png'))
  for (let reduz = 1; reduz > 0.2; reduz *= 0.75) {
    let out: HTMLCanvasElement
    if (planos.length === 1) {
      const p = planos[0]
      out = novoCanvas(Math.round(p.width * reduz), Math.round(p.height * reduz))
      out.getContext('2d')!.drawImage(p, 0, 0, out.width, out.height)
    } else {
      const W = Math.round(Math.min(1600, Math.max(...planos.map((p) => p.width))) * reduz)
      const FAIXA = Math.round(40 * Math.max(0.6, reduz)), PAD = Math.round(16 * Math.max(0.6, reduz))
      const tam = planos.map((p) => { const k = Math.min(1, W / p.width); return { w: Math.round(p.width * k), h: Math.round(p.height * k) } })
      out = novoCanvas(W + PAD * 2, tam.reduce((s, t) => s + FAIXA + t.h + PAD, PAD))
      const ctx = out.getContext('2d')!
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, out.width, out.height)
      let y = PAD
      planos.forEach((p, i) => {
        ctx.fillStyle = '#e2e8f0'
        ctx.font = `600 ${Math.round(FAIXA * 0.42)}px Inter, system-ui, sans-serif`
        ctx.textBaseline = 'middle'
        ctx.fillText(legendaDe(prints[i], i, prints.length), PAD, y + FAIXA / 2)
        y += FAIXA
        ctx.drawImage(p, PAD, y, tam[i].w, tam[i].h)
        y += tam[i].h + PAD
      })
    }
    const b = await toBlob(out)
    if (!b || b.size <= MAX_BYTES) return b
  }
  throw new Error('Os prints juntos ficaram grandes demais. Tire algum ou recorte um pedaço menor.')
}

const ReportarChamado = () => {
  const podeAbrir = useAuthStore((s) => s.canAbrirChamados)
  const { pathname } = useLocation()
  const [modo, setModo] = useState<Modo | null>(null)
  const [shot, setShot] = useState<HTMLCanvasElement | null>(null)
  const [prints, setPrints] = useState<PrintItem[]>([])
  const [ativo, setAtivo] = useState<string | null>(null)
  const [tipo, setTipo] = useState<ChamadoTipo>('bug')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  /** Print que está sendo recortado de novo (null = print novo). */
  const [refazendo, setRefazendo] = useState<string | null>(null)

  const capturar = async () => {
    setErro(null)
    setModo('capturando')
    try {
      setShot(await capturarTela())
      setModo('recorte')
    } catch (e) {
      // Sem print, o chamado ainda pode ir só com o texto.
      setShot(null)
      setErro(`Não foi possível tirar o print (${e instanceof Error ? e.message : String(e)}). Dá para enviar só com o texto.`)
      setModo('form')
    }
  }

  const fechar = useCallback(() => {
    setModo(null); setShot(null); setPrints([]); setAtivo(null); setTipo('bug'); setDescricao(''); setErro(null); setRefazendo(null)
  }, [])

  const confirmarRecorte = (r: Rect | 'tela inteira') => {
    if (!shot) return
    const base = recortar(shot, r)
    const antigo = refazendo ? prints.find((p) => p.id === refazendo) : undefined
    const p: PrintItem = { id: novoId(), origem: 'visor', rotulo: antigo?.rotulo ?? pathname, base, tinta: novoCanvas(base.width, base.height), recorte: r, tela: shot }
    setPrints((ps) => (antigo ? ps.map((x) => (x.id === antigo.id ? p : x)) : [...ps, p]))
    setAtivo(p.id); setShot(null); setRefazendo(null); setModo('form')
  }
  // Cancelar o recorte: com prints já no chamado, volta para ele; senão desiste de tudo.
  const cancelarRecorte = () => { setShot(null); setRefazendo(null); if (prints.length > 0) setModo('form'); else fechar() }

  const anexarExterno = async (arquivo: Blob, nome: string) => {
    try {
      const base = await imagemParaCanvas(arquivo)
      const p: PrintItem = { id: novoId(), origem: 'externo', rotulo: nome, base, tinta: novoCanvas(base.width, base.height) }
      setPrints((ps) => [...ps, p]); setAtivo(p.id); setErro(null)
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
  }

  const remover = (id: string) => {
    const resto = prints.filter((p) => p.id !== id)
    setPrints(resto)
    if (ativo === id) setAtivo(resto[resto.length - 1]?.id ?? null)
  }

  if (!podeAbrir) return null
  const emAndamento = modo !== null
  return (
    <>
      <button
        type="button"
        data-fora-do-print
        onClick={() => { if (modo === 'minimizado') setModo('form'); else if (!emAndamento) void capturar() }}
        disabled={emAndamento && modo !== 'minimizado'}
        aria-label="Reportar"
        className={cn('relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300', modo === 'minimizado' && 'text-teal-500 dark:text-teal-300')}
      >
        {modo === 'capturando' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
        {modo === 'minimizado' && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-teal-400" />}
      </button>

      {modo === 'recorte' && shot && createPortal(<Recorte shot={shot} varios={prints.length > 0} onConfirmar={confirmarRecorte} onCancelar={cancelarRecorte} />, document.body)}

      {modo === 'minimizado' && createPortal(
        <BarraMinimizada n={prints.length} onPrint={() => void capturar()} onVoltar={() => setModo('form')} onDescartar={fechar} />,
        document.body,
      )}

      {modo === 'form' && createPortal(
        <Formulario
          prints={prints} ativo={ativo} setAtivo={setAtivo} onRemover={remover}
          tipo={tipo} setTipo={setTipo} descricao={descricao} setDescricao={setDescricao}
          erro={erro} setErro={setErro}
          onFechar={fechar}
          onOutroPrintVisor={() => setModo('minimizado')}
          onAnexarExterno={(b, nome) => void anexarExterno(b, nome)}
          onRefazer={(id) => {
            // Recortar de novo: volta ao print da tela inteira daquele momento.
            const p = prints.find((x) => x.id === id)
            if (!p?.tela) return
            setRefazendo(id); setShot(p.tela); setModo('recorte')
          }}
        />,
        document.body,
      )}
    </>
  )
}

/* ─── recorte ──────────────────────────────────────────────────────────── */

const Recorte = ({ shot, varios, onConfirmar, onCancelar }: {
  shot: HTMLCanvasElement
  varios: boolean
  onConfirmar: (r: Rect | 'tela inteira') => void
  onCancelar: () => void
}) => {
  const [rect, setRect] = useState<Rect | null>(null)
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const [url] = useState(() => shot.toDataURL('image/png'))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancelar])

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
        if (rect && rect.w >= MIN_LADO && rect.h >= MIN_LADO) onConfirmar(rect)
        else setRect(null)
      }}
    >
      <img src={url} alt="" className="pointer-events-none absolute inset-0 h-full w-full" draggable={false} />
      {rect && rect.w > 0 ? (
        <div className="pointer-events-none absolute rounded-sm border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/55" />
      )}
      <div data-barra className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-[#161616] px-3 py-2 text-[13px] text-gray-100 shadow-2xl">
        <span className="px-1">Arraste para recortar o que quer mostrar</span>
        <button type="button" onClick={() => onConfirmar('tela inteira')} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold hover:bg-white/20">
          <Maximize2 className="h-3.5 w-3.5" /> Tela inteira
        </button>
        <button type="button" onClick={onCancelar} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-gray-300 hover:bg-white/10">
          <X className="h-3.5 w-3.5" /> {varios ? 'Voltar ao chamado' : 'Cancelar'} <kbd className="text-[10px] text-gray-500">Esc</kbd>
        </button>
      </div>
    </div>
  )
}

/* ─── barra do chamado recolhido (enquanto navega para tirar outro print) ── */

const BarraMinimizada = ({ n, onPrint, onVoltar, onDescartar }: { n: number; onPrint: () => void; onVoltar: () => void; onDescartar: () => void }) => (
  <div data-fora-do-print className="fixed inset-x-0 bottom-5 z-[9998] flex justify-center px-4">
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-teal-500/40 bg-[#0f1b2b] py-2 pl-4 pr-2 text-white shadow-[0_18px_44px_-12px_rgba(0,0,0,0.75)] animate-in fade-in slide-in-from-bottom-3 duration-200">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300"><Bug className="h-4 w-4" /></span>
      <div className="mr-2 min-w-0">
        <p className="text-[13px] font-semibold leading-tight">Chamado em andamento · {n} {n === 1 ? 'print' : 'prints'}</p>
        <p className="text-[11.5px] text-white/65">Vá até a tela que quer mostrar e clique em Tirar print.</p>
      </div>
      <button type="button" onClick={onPrint} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-3 py-2 text-[13px] font-semibold text-[#062925] hover:bg-teal-400">
        <Camera className="h-4 w-4" /> Tirar print desta tela
      </button>
      <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] text-white/80 hover:bg-white/10 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Voltar ao chamado
      </button>
      <button type="button" onClick={onDescartar} aria-label="Descartar chamado" className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
    </div>
  </div>
)

/* ─── formulário ──────────────────────────────────────────────────────── */

const Formulario = ({ prints, ativo, setAtivo, onRemover, tipo, setTipo, descricao, setDescricao, erro, setErro, onFechar, onOutroPrintVisor, onAnexarExterno, onRefazer }: {
  prints: PrintItem[]
  ativo: string | null
  setAtivo: (id: string) => void
  onRemover: (id: string) => void
  tipo: ChamadoTipo
  setTipo: (t: ChamadoTipo) => void
  descricao: string
  setDescricao: (v: string) => void
  erro: string | null
  setErro: (e: string | null) => void
  onFechar: () => void
  onOutroPrintVisor: () => void
  onAnexarExterno: (b: Blob, nome: string) => void
  onRefazer: (id: string) => void
}) => {
  const { pathname, search } = useLocation()
  const user = useAuthStore((s) => s.user)
  const fullName = useAuthStore((s) => s.fullName)
  const rede = useTenantStore((s) => s.rede)
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const dark = useThemeStore((s) => s.dark)

  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)

  const atual = prints.find((p) => p.id === ativo) ?? prints[prints.length - 1] ?? null

  // Canvas do print ativo (base) + camada da caneta por cima.
  const base = useRef<HTMLCanvasElement>(null)
  const tinta = useRef<HTMLCanvasElement>(null)
  const tracos = useRef<ImageData[]>([])
  const desenhando = useRef(false)
  const [temTraco, setTemTraco] = useState(false)

  const escala = atual && atual.origem === 'visor' ? atual.base.width / window.innerWidth : Math.max(1, (atual?.base.width ?? 1) / 900)
  // Tamanho na tela: cabe no modal sem distorcer (o canvas em si fica na resolução do print).
  const exibir = atual ? (() => {
    const wCss = atual.base.width / (atual.origem === 'visor' ? escala : 1), hCss = atual.base.height / (atual.origem === 'visor' ? escala : 1)
    const k = Math.min(1, Math.min(720, window.innerWidth - 80) / wCss, (window.innerHeight * (prints.length > 1 ? 0.38 : 0.44)) / hCss)
    return { width: Math.round(wCss * k), height: Math.round(hCss * k) }
  })() : undefined

  // Troca de print: desenha o print e os riscos dele; o desfazer recomeça.
  useEffect(() => {
    if (!atual || !base.current || !tinta.current) return
    for (const c of [base.current, tinta.current]) { c.width = atual.base.width; c.height = atual.base.height }
    base.current.getContext('2d')!.drawImage(atual.base, 0, 0)
    tinta.current.getContext('2d')!.drawImage(atual.tinta, 0, 0)
    tracos.current = []
    setTemTraco(false)
  }, [atual])

  // Guarda os riscos no próprio print (para trocar de print sem perder).
  const salvarTinta = () => {
    if (!atual || !tinta.current) return
    const ctx = atual.tinta.getContext('2d')!
    ctx.clearRect(0, 0, atual.tinta.width, atual.tinta.height)
    ctx.drawImage(tinta.current, 0, 0)
  }

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
  const parar = () => { if (desenhando.current) { desenhando.current = false; setTemTraco(true); salvarTinta() } }
  const desfazer = () => {
    const ultimo = tracos.current.pop()
    if (ultimo && tinta.current) tinta.current.getContext('2d')!.putImageData(ultimo, 0, 0)
    setTemTraco(tracos.current.length > 0)
    salvarTinta()
  }

  // Colar (Ctrl+V) uma imagem de fora, com o formulário aberto.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const img = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      const f = img?.getAsFile()
      if (f) { e.preventDefault(); onAnexarExterno(f, 'colada da área de transferência') }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [onAnexarExterno])

  const enviar = async () => {
    if (!descricao.trim()) { setErro('Escreva em uma frase o que aconteceu.'); return }
    if (!user) { setErro('Sessão expirada: entre de novo.'); return }
    setErro(null); setEnviando(true)
    try {
      const primeiro = prints[0]
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
        recorte: primeiro?.recorte,
        ...(prints.length > 1 ? { prints: prints.map((p, i) => ({ ordem: i + 1, origem: p.origem, rotulo: p.rotulo })) } : {}),
        erros: errosRecentes(),
      }
      await criarChamado({
        tipo, descricao, print: await montarImagem(prints), contexto,
        redeId: rede?.id ?? null,
        autor: { userId: user.id, nome: fullName ?? user.email ?? 'Diretor' },
      })
      setEnviado(true)
      window.setTimeout(onFechar, 1400)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally { setEnviando(false) }
  }

  const btnAnexo = 'flex flex-1 items-start gap-2.5 rounded-xl border border-dashed px-3 py-2.5 text-left transition-colors'

  return (
    <div data-fora-do-print className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div
        className={cn('flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-[#111]', arrastando ? 'border-teal-400 ring-2 ring-teal-400/40' : 'border-gray-200 dark:border-gray-800')}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setArrastando(true) } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastando(false) }}
        onDrop={(e) => {
          e.preventDefault(); setArrastando(false)
          for (const f of Array.from(e.dataTransfer.files)) if (f.type.startsWith('image/')) onAnexarExterno(f, f.name)
        }}
      >
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
          {atual && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5 text-red-500" /> Risque em cima do print para apontar o problema</span>
                <span className="flex gap-1">
                  <button type="button" onClick={desfazer} disabled={!temTraco} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"><Undo2 className="h-3.5 w-3.5" /> Desfazer traço</button>
                  {atual.tela && (
                    <button type="button" onClick={() => onRefazer(atual.id)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"><Maximize2 className="h-3.5 w-3.5" /> Recortar de novo</button>
                  )}
                </span>
              </div>
              <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <canvas ref={base} className="block" style={exibir} />
                <canvas ref={tinta} className="absolute inset-0 h-full w-full cursor-crosshair touch-none" onPointerDown={comecar} onPointerMove={mover} onPointerUp={parar} onPointerLeave={parar} />
              </div>
            </div>
          )}

          {/* Prints do chamado (quando há mais de um) */}
          {prints.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {prints.map((p, i) => (
                <div key={p.id} className="group relative shrink-0">
                  <button type="button" onClick={() => setAtivo(p.id)}
                    className={cn('block w-[132px] overflow-hidden rounded-lg border-2 text-left transition-colors', p.id === atual?.id ? 'border-teal-500' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-500')}>
                    <Miniatura p={p} />
                    <span className="block truncate bg-gray-50 px-1.5 py-1 text-[10.5px] text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
                      <b>{i + 1}</b> · {p.origem === 'visor' ? 'Visor' : 'De fora'}
                    </span>
                  </button>
                  <button type="button" onClick={() => onRemover(p.id)} aria-label={`Tirar o print ${i + 1}`}
                    className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100 focus:opacity-100">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Mais prints: dois caminhos, bem explícitos */}
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-gray-700 dark:text-gray-300">
              {prints.length === 0 ? 'Quer mostrar uma imagem?' : 'Quer mostrar mais alguma coisa?'}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={onOutroPrintVisor} className={cn(btnAnexo, 'border-teal-500/50 hover:border-teal-500 hover:bg-teal-50/60 dark:hover:bg-teal-500/[0.07]')}>
                <Camera className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-300" />
                <span>
                  <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">Tirar print de outra tela do Visor</span>
                  <span className="block text-[11.5px] leading-snug text-gray-500 dark:text-gray-400">O chamado fica guardado num cantinho enquanto você vai até a outra tela.</span>
                </span>
              </button>
              <button type="button" onClick={() => arquivo.current?.click()} className={cn(btnAnexo, 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-white/[0.04]')}>
                <ImagePlus className="mt-0.5 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-300" />
                <span>
                  <span className="block text-[13px] font-semibold text-gray-900 dark:text-gray-100">Anexar print de fora do Visor</span>
                  <span className="block text-[11.5px] leading-snug text-gray-500 dark:text-gray-400">Ex.: a tela do WebPosto. Escolha o arquivo, arraste aqui ou cole com Ctrl+V.</span>
                </span>
              </button>
              <input ref={arquivo} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { for (const f of Array.from(e.target.files ?? [])) onAnexarExterno(f, f.name); e.target.value = '' }} />
            </div>
          </div>

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

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <p className="mr-auto inline-flex items-center gap-1.5 text-[11.5px] text-gray-500 dark:text-gray-400">
            <Timer className="h-3.5 w-3.5 shrink-0" />
            {prints.length > 1 ? `Os ${prints.length} prints vão juntos e ficam guardados por 90 dias.` : 'O print fica guardado por 90 dias e depois é apagado automaticamente.'}
          </p>
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

/** Miniatura do print (com os riscos), para a fileira de prints. */
const Miniatura = ({ p }: { p: PrintItem }) => {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const k = Math.min(132 / p.base.width, 74 / p.base.height)
    c.width = Math.max(1, Math.round(p.base.width * k)); c.height = Math.max(1, Math.round(p.base.height * k))
    const ctx = c.getContext('2d')!
    ctx.drawImage(p.base, 0, 0, c.width, c.height); ctx.drawImage(p.tinta, 0, 0, c.width, c.height)
  })
  return <div className="flex h-[74px] items-center justify-center bg-gray-100 dark:bg-black/40"><canvas ref={ref} className="block max-h-full max-w-full" /></div>
}

export default ReportarChamado
