import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import TopBarTabs, { type TopBarTab } from '@/components/layout/TopBarTabs'
import { useModuloAbas, moduloDaRota } from '@/store/moduloAbas'
import useIsMobile from '@/hooks/useIsMobile'

interface Props {
  tabs: TopBarTab[]
  active: string
  onChange: (id: string) => void
  className?: string
}

/**
 * Telas do módulo (padrão Atlas One): no computador, com o menu lateral
 * expandido, elas aparecem DENTRO do menu, debaixo do módulo, e a trilha
 * "Módulo › Tela" vai para o topo — aqui não desenha nada. No celular, ou com o
 * menu lateral recolhido, continuam como abas no topo da página.
 */
const ModuloAbas = ({ tabs, active, onChange, className }: Props) => {
  const { pathname } = useLocation()
  const isMobile = useIsMobile()
  const publicar = useModuloAbas((s) => s.publicar)
  const limpar = useModuloAbas((s) => s.limpar)
  const path = moduloDaRota(pathname)?.path ?? pathname

  // onChange estável para o menu (a página recria a função a cada render).
  const onChangeRef = useRef(onChange)
  const chave = tabs.map((t) => `${t.id}:${t.label}${t.disabled ? '!' : ''}`).join('|')
  const tabsRef = useRef(tabs)
  // Atualiza antes do efeito que publica (layout effects rodam primeiro).
  useLayoutEffect(() => { onChangeRef.current = onChange; tabsRef.current = tabs })

  useEffect(() => {
    publicar({ path, tabs: tabsRef.current, active, onChange: (id) => onChangeRef.current(id) })
  }, [path, chave, active, publicar])
  useEffect(() => () => limpar(path), [path, limpar])

  // Computador: menu aberto = telas na lateral; recolhido = telas na trilha do cabeçalho (CabecalhoPagina).
  if (!isMobile) return null
  return <TopBarTabs tabs={tabs} active={active} onChange={onChange} className={className} />
}

export default ModuloAbas
