/**
 * Filtro no cabeçalho da tabela, estilo Excel (portado da Central CCI / NotaOK,
 * src/components/ui/FiltroColuna.jsx): um funil ao lado do nome da coluna.
 * Clicou → lista dos valores daquela coluna (com quantas linhas cada um tem),
 * busca, "Selecionar tudo", Limpar e Aplicar. Os filtros se somam entre as
 * colunas, e a lista de uma coluna mostra só os valores que sobram depois dos
 * filtros das OUTRAS (como no Excel).
 *
 * Uso:
 *   const COLUNAS = {
 *     quem: (c) => c.autor_nome,
 *     quando: { valor: (c) => fmtData(c.criado_em), ordem: (c) => c.criado_em },
 *   }   // fora do componente (ou useMemo)
 *   const f = useFiltrosColuna(linhas, COLUNAS)
 *   <th><CabecalhoFiltro rotulo="Quem" filtro={f.de('quem')} /></th>
 *   ... f.filtradas.map(...)
 *
 * A lista abre num portal (fora da tabela), para não ser cortada pela rolagem.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Check, ListFilter, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VAZIO, type FiltroDeColuna } from '@/lib/filtroColuna'

/** Rótulo da coluna + funil. `alinhar="direita"` para colunas numéricas. */
export const CabecalhoFiltro = ({ rotulo, filtro, alinhar = 'esquerda' }: { rotulo: string; filtro: FiltroDeColuna; alinhar?: 'esquerda' | 'direita' }) => {
  const [aberto, setAberto] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const fechar = useCallback(() => setAberto(false), [])
  return (
    <span className={cn('inline-flex items-center gap-1', alinhar === 'direita' && 'flex-row-reverse')}>
      <span>{rotulo}</span>
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={filtro.ativo ? `Filtrando ${rotulo} (${filtro.marcados?.size ?? 0})` : `Filtrar ${rotulo}`}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className={cn(
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors',
          filtro.ativo ? 'bg-[#1e3a5f] text-white dark:bg-blue-500 dark:text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200',
        )}
      >
        <ListFilter className="h-3 w-3" strokeWidth={2.5} />
      </button>
      {aberto && <Painel ancora={botao} rotulo={rotulo} filtro={filtro} alinhar={alinhar} onFechar={fechar} />}
    </span>
  )
}

const LARGURA = 264

const Painel = ({ ancora, rotulo, filtro, alinhar, onFechar }: {
  ancora: RefObject<HTMLButtonElement | null>
  rotulo: string
  filtro: FiltroDeColuna
  alinhar: 'esquerda' | 'direita'
  onFechar: () => void
}) => {
  const [valores] = useState(() => filtro.valores())
  // Rascunho: começa no que está aplicado (ou tudo marcado, se a coluna não tem filtro).
  const [marcados, setMarcados] = useState(() => new Set(filtro.marcados ?? valores.map((v) => v.valor)))
  const [busca, setBusca] = useState('')
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const caixa = useRef<HTMLDivElement>(null)

  // Posição: logo abaixo do funil, sem sair da tela.
  useLayoutEffect(() => {
    const r = ancora.current?.getBoundingClientRect()
    if (!r) return
    let left = alinhar === 'direita' ? r.right - LARGURA : r.left - 8
    left = Math.max(8, Math.min(left, window.innerWidth - LARGURA - 8))
    const cabeEmbaixo = window.innerHeight - r.bottom > 320
    // eslint-disable-next-line react-hooks/set-state-in-effect -- medir o DOM antes de pintar
    setPos(cabeEmbaixo ? { left, top: r.bottom + 6 } : { left, bottom: window.innerHeight - r.top + 6 })
  }, [ancora, alinhar])

  // Fecha ao clicar fora, no Esc e ao rolar a página (a lista ficaria solta no lugar).
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node
      if (caixa.current?.contains(alvo) || ancora.current?.contains(alvo)) return
      onFechar()
    }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    const rolou = (e: Event) => { if (!caixa.current?.contains(e.target as Node)) onFechar() }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', rolou, true)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', rolou, true)
    }
  }, [ancora, onFechar])

  const q = busca.trim().toLowerCase()
  const visiveis = q ? valores.filter((v) => v.valor.toLowerCase().includes(q)) : valores
  const todosVisiveis = visiveis.length > 0 && visiveis.every((v) => marcados.has(v.valor))

  const alternar = (valor: string) => setMarcados((m) => {
    const n = new Set(m)
    if (n.has(valor)) n.delete(valor)
    else n.add(valor)
    return n
  })
  const alternarTodos = () => setMarcados((m) => {
    const n = new Set(m)
    for (const v of visiveis) { if (todosVisiveis) n.delete(v.valor); else n.add(v.valor) }
    return n
  })

  const aplicar = () => {
    // Com busca: aplica só os marcados que aparecem na busca (como no Excel).
    const escolhidos = q ? new Set(visiveis.filter((v) => marcados.has(v.valor)).map((v) => v.valor)) : marcados
    const tudo = valores.every((v) => escolhidos.has(v.valor))
    filtro.aplicar(tudo ? null : escolhidos)
    onFechar()
  }
  const limpar = () => { filtro.aplicar(null); onFechar() }

  if (!pos) return null
  return createPortal(
    <div
      ref={caixa}
      role="dialog"
      aria-label={`Filtrar ${rotulo}`}
      style={{ ...pos, width: LARGURA }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 flex max-h-[360px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left text-sm font-normal normal-case tracking-normal text-gray-800 shadow-2xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <span className="truncate text-[12px] font-semibold">Filtrar: {rotulo}</span>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"><X className="h-3.5 w-3.5" /></button>
      </div>
      {/* Busca SEMPRE visível: as colunas crescem (cliente, data, quem…) e
          digitar é mais rápido que rolar. Enter aplica o que a busca achou. */}
      <div className="px-2 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && visiveis.length > 0) { e.preventDefault(); aplicar() } }}
            placeholder="Pesquisar… (Enter aplica)"
            className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-[13px] outline-none focus:border-[#2563eb] dark:border-gray-700 dark:bg-[#0f0f0f]"
          />
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {visiveis.length === 0 ? (
          <li className="px-2 py-4 text-center text-[12px] text-gray-400">Nada encontrado</li>
        ) : (
          <>
            <li>
              <Opcao marcada={todosVisiveis} onClick={alternarTodos} forte>
                {q ? 'Selecionar resultados' : 'Selecionar tudo'}
              </Opcao>
            </li>
            {visiveis.map((v) => (
              <li key={v.valor}>
                <Opcao marcada={marcados.has(v.valor)} onClick={() => alternar(v.valor)} qtd={v.qtd} vazio={v.valor === VAZIO}>
                  {v.valor}
                </Opcao>
              </li>
            ))}
          </>
        )}
      </ul>
      <div className="flex gap-2 border-t border-gray-100 p-2 dark:border-gray-800">
        <button type="button" onClick={limpar} disabled={!filtro.ativo} className="h-8 flex-1 rounded-lg border border-gray-200 text-[12.5px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Limpar</button>
        <button type="button" onClick={aplicar} disabled={marcados.size === 0} className="h-8 flex-1 rounded-lg bg-[#1e3a5f] text-[12.5px] font-semibold text-white hover:bg-[#172d4a] dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-40">Aplicar</button>
      </div>
    </div>,
    document.body,
  )
}

const Opcao = ({ marcada, onClick, children, qtd, forte, vazio }: {
  marcada: boolean
  onClick: () => void
  children: ReactNode
  qtd?: number
  forte?: boolean
  vazio?: boolean
}) => (
  <button type="button" role="checkbox" aria-checked={marcada} onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800">
    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', marcada ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:border-blue-500 dark:bg-blue-500' : 'border-gray-300 dark:border-gray-600')}>
      {marcada && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
    <span className={cn('min-w-0 flex-1 truncate text-[13px]', forte && 'font-semibold', vazio && 'italic text-gray-400')}>{children}</span>
    {qtd != null && <span className="shrink-0 text-[11px] tabular-nums text-gray-400">{qtd}</span>}
  </button>
)

/** Aviso "N filtros nas colunas · Limpar", para pôr perto da tabela. */
export const AvisoFiltros = ({ qtd, onLimpar }: { qtd: number; onLimpar: () => void }) => {
  if (!qtd) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1e3a5f]/10 px-2.5 py-1 text-[12px] font-medium text-[#1e3a5f] dark:bg-blue-400/10 dark:text-blue-300">
      <ListFilter className="h-3.5 w-3.5" />
      {qtd === 1 ? '1 filtro nas colunas' : `${qtd} filtros nas colunas`}
      <button type="button" onClick={onLimpar} className="ml-0.5 rounded px-1 underline-offset-2 hover:underline">Limpar</button>
    </span>
  )
}
