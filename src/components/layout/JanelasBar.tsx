import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJanelas, chaveDe } from '@/store/janelas'
import { useAuthStore } from '@/store/auth'
import { navItems } from '@/components/layout/navConfig'
import { REGISTRY } from '@/lib/moduleRegistry'

/** Marca da sessão do navegador: o início do diretor (só a Configuração) já foi feito. */
const INICIO_DIRETOR = 'visor360.janelas.inicioDiretor'

/**
 * Barra de janelas do computador (fica no lugar da trilha "Módulo › Tela"):
 * uma aba por tela aberta, com o ícone do módulo e um × pequeno. Clicar volta
 * para a tela como ela estava na URL (aba + filtros da própria tela); o botão do
 * meio do mouse também fecha. Com muitas janelas, setinhas para rolar.
 *
 * `titulo` = nome exato que a tela aberta mostra (corrige o nome de partida).
 */
const iconeDe = (modulo: string | null) => {
  if (!modulo) return null
  return REGISTRY[modulo]?.Icon ?? navItems.find((i) => i.path === modulo)?.icon ?? null
}

const JanelasBar = ({ titulo }: { titulo: string }) => {
  const { pathname, search, key } = useLocation()
  const navigate = useNavigate()
  const janelas = useJanelas((s) => s.janelas)
  const ativa = useJanelas((s) => s.ativa)
  const visitar = useJanelas((s) => s.visitar)
  const renomear = useJanelas((s) => s.renomear)
  const fechar = useJanelas((s) => s.fechar)
  const fecharTodas = useJanelas((s) => s.fecharTodas)
  const aviso = useJanelas((s) => s.aviso)
  const limparAviso = useJanelas((s) => s.limparAviso)

  const isMaster = useAuthStore((s) => s.isMaster)

  // Cada navegação abre ou ativa a janela dela. Conta o `key` da navegação: com
  // tudo fechado, clicar no menu na MESMA tela de antes também reabre.
  // Diretor (CCI): cada vez que o app abre, começa só com a Configuração para
  // escolher a rede — sem a Visão Geral nem as janelas da última vez.
  useEffect(() => {
    if (isMaster && !sessionStorage.getItem(INICIO_DIRETOR)) {
      sessionStorage.setItem(INICIO_DIRETOR, '1')
      useJanelas.setState({ janelas: [], ativa: null, vazio: false, fechadas: [] })
      if (!pathname.startsWith('/painel')) { navigate('/painel/selecionar-rede', { replace: true }); return }
    }
    visitar(pathname, search)
  }, [pathname, search, key, visitar, isMaster, navigate])
  // O nome que a tela mostra vira o nome da janela.
  useEffect(() => { if (titulo) renomear(chaveDe(pathname, search), titulo) }, [titulo, pathname, search, renomear])
  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(limparAviso, 5000)
    return () => window.clearTimeout(t)
  }, [aviso, limparAviso])

  const ir = (pathnameJ: string, searchJ: string) => navigate(`${pathnameJ}${searchJ}`)
  const fecharJanela = (chave: string) => {
    const proxima = fechar(chave)
    // Era a última: a área fica vazia (sem navegar).
    if (chave === ativa && proxima) ir(proxima.pathname, proxima.search)
  }

  // Setinhas só quando as janelas não cabem.
  const trilho = useRef<HTMLDivElement>(null)
  const [rolagem, setRolagem] = useState({ esq: false, dir: false })
  const medir = () => {
    const el = trilho.current
    if (!el) return
    setRolagem({ esq: el.scrollLeft > 2, dir: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 })
  }
  useLayoutEffect(() => {
    medir()
    const el = trilho.current
    if (!el) return
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [janelas.length])
  // A janela ativa sempre à vista.
  useEffect(() => {
    trilho.current?.querySelector<HTMLElement>('[data-janela-ativa]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [ativa])
  const rolar = (d: number) => trilho.current?.scrollBy({ left: d * 240, behavior: 'smooth' })

  return (
    <span className="relative flex min-w-0 flex-1 items-center">
      {rolagem.esq && (
        <button type="button" onClick={() => rolar(-1)} aria-label="Ver janelas à esquerda"
          className="mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:text-[#94a3b8] dark:hover:bg-white/[0.07] dark:hover:text-white">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div ref={trilho} onScroll={medir} role="tablist" aria-label="Janelas abertas"
        className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {janelas.map((j) => {
          const on = j.chave === ativa
          const Icone = iconeDe(j.modulo)
          return (
            <span key={j.chave} data-janela-ativa={on || undefined}
              className={cn('group relative flex shrink-0 items-center rounded-md transition-colors',
                on ? 'bg-white shadow-sm dark:bg-white/[0.07]' : 'hover:bg-gray-100 dark:hover:bg-white/[0.04]')}>
              <button type="button" role="tab" aria-selected={on}
                onClick={() => !on && ir(j.pathname, j.search)}
                onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); fecharJanela(j.chave) } }}
                className={cn('flex max-w-[200px] items-center gap-1.5 py-1 pl-2 pr-1 text-[12.5px]',
                  on ? 'font-semibold text-gray-900 dark:text-[#f1f5f9]' : 'text-gray-500 group-hover:text-gray-800 dark:text-[#94a3b8] dark:group-hover:text-[#e2e8f0]')}>
                {Icone && <Icone className={cn('h-3.5 w-3.5 shrink-0', on ? 'text-teal-600 dark:text-teal-300' : 'opacity-70')} />}
                <span className="truncate">{j.titulo}</span>
              </button>
              <button type="button" onClick={() => fecharJanela(j.chave)} aria-label={`Fechar ${j.titulo}`}
                className={cn('mr-1 flex h-4 w-4 shrink-0 items-center justify-center text-gray-400 hover:text-gray-900 dark:text-[#64748b] dark:hover:text-white',
                  !on && 'opacity-60 group-hover:opacity-100')}>
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </span>
          )
        })}
      </div>
      {rolagem.dir && (
        <button type="button" onClick={() => rolar(1)} aria-label="Ver janelas à direita"
          className="ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:text-[#94a3b8] dark:hover:bg-white/[0.07] dark:hover:text-white">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
      {/* Fechar todas: no canto direito, como o × do navegador. */}
      {janelas.length > 1 && (
        <button type="button" onClick={fecharTodas}
          className="ml-auto flex shrink-0 items-center gap-1 rounded-md py-1 pl-2 pr-1.5 text-[12px] text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-[#94a3b8] dark:hover:bg-white/[0.06] dark:hover:text-white">
          Fechar todas <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      )}
      {aviso && (
        <span role="status" className="absolute left-0 top-full z-20 mt-2 rounded-lg border border-amber-300/50 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800 shadow-md dark:border-amber-500/30 dark:bg-[#2a2210] dark:text-amber-200">
          {aviso}
        </span>
      )}
    </span>
  )
}

export default JanelasBar
