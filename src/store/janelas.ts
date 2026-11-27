import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { moduloDaRota } from '@/store/moduloAbas'
import { moduleByPath } from '@/lib/appStructure'
import { REGISTRY } from '@/lib/moduleRegistry'

/**
 * Janelas do computador (estilo abas do Windows/navegador): cada tela aberta
 * vira uma janela na barra do topo. Clicar no menu abre a tela numa janela nova
 * (ou volta para a que já estava aberta); o × fecha. Limite de MAX_JANELAS: a
 * usada há mais tempo sai para dar lugar à nova.
 *
 * Identidade da janela = rota + aba (`?tab=`). Os outros parâmetros da URL
 * (filtros da própria tela) ficam guardados na janela e voltam com ela.
 */
export const MAX_JANELAS = 8

export interface Janela {
  /** Rota + aba (identidade). */
  chave: string
  pathname: string
  search: string
  titulo: string
  /** Rota do módulo (ícone). */
  modulo: string | null
  /** Último uso (para escolher quem sai quando passa do limite). */
  usadaEm: number
}

const TITULOS_AVULSOS: Record<string, string> = {
  '/configuracoes': 'Configurações',
  '/meus-chamados': 'Meus chamados',
  '/diagnostico': 'Diagnóstico do posto',
  '/compliance': 'Compliance ANP',
  '/cartoes': 'Cartões',
  '/gestao': 'Tarefas',
}

/** Aba da URL. As telas tiram a aba padrão da URL, então "sem ?tab=" = a primeira. */
const abaDe = (search: string): string => new URLSearchParams(search).get('tab') ?? ''

/**
 * Áreas que são UMA janela só, por mais que a navegação de dentro troque de
 * endereço (ex.: Configuração: /painel/redes, /painel/config, /painel/chamados…).
 * A janela guarda a última parte visitada e volta nela.
 */
const AREAS_UMA_JANELA: { prefixo: string; titulo: string; /** Endereços antigos que só redirecionam para a área. */ apelidos?: string[] }[] = [
  { prefixo: '/painel', titulo: 'Configuração', apelidos: ['/configuracoes', '/admin', '/selecionar-rede'] },
]
const dentro = (pathname: string, prefixo: string) => pathname === prefixo || pathname.startsWith(`${prefixo}/`)
const areaDe = (pathname: string) => AREAS_UMA_JANELA.find((a) => dentro(pathname, a.prefixo) || (a.apelidos ?? []).some((p) => dentro(pathname, p)))

export const chaveDe = (pathname: string, search: string) => {
  const area = areaDe(pathname)
  return area ? `${area.prefixo}::` : `${pathname}::${abaDe(search)}`
}

/** Título de partida (a tela aberta corrige com o nome exato que ela mostra). */
export const tituloDe = (pathname: string, search: string): string => {
  const area = areaDe(pathname)
  if (area) return area.titulo
  const mod = moduleByPath(pathname)
  const aba = abaDe(search)
  // Módulo de tela única (ex.: Estoques) leva o nome do módulo.
  const daEstrutura = mod && mod.tabs.length > 1 ? (aba ? mod.tabs.find((t) => t.id === aba)?.label : mod.tabs[0]?.label) : undefined
  if (daEstrutura) return daEstrutura
  if (TITULOS_AVULSOS[pathname]) return TITULOS_AVULSOS[pathname]
  const modulo = moduloDaRota(pathname)
  if (modulo) return modulo.label
  if (REGISTRY[pathname]) return REGISTRY[pathname].nome
  if (pathname.startsWith('/admin') || pathname.startsWith('/painel')) return 'Painel'
  const ultimo = pathname.split('/').filter(Boolean).pop() ?? 'Tela'
  return ultimo.charAt(0).toUpperCase() + ultimo.slice(1).replace(/-/g, ' ')
}

interface JanelasState {
  janelas: Janela[]
  ativa: string | null
  /** Aviso curto quando uma janela é fechada pelo limite. */
  aviso: string | null
  /** Todas as janelas foram fechadas: a área de conteúdo fica vazia (atalhos no meio). */
  vazio: boolean
  /** As que estavam abertas antes de fechar tudo (para "Reabrir"). */
  fechadas: Janela[]
  /** A rota mudou: ativa a janela dela ou abre uma nova. */
  visitar: (pathname: string, search: string) => void
  renomear: (chave: string, titulo: string) => void
  fechar: (chave: string) => Janela | null
  limparAviso: () => void
  fecharTodas: () => void
  /** Devolve as janelas fechadas e a que deve ficar à vista. */
  reabrir: () => Janela | null
}

export const useJanelas = create<JanelasState>()(
  persist(
    (set, get) => ({
      janelas: [],
      ativa: null,
      aviso: null,
      vazio: false,
      fechadas: [],
      visitar: (pathname, search) => {
        const chave = chaveDe(pathname, search)
        const agora = Date.now()
        const { janelas } = get()
        if (janelas.some((j) => j.chave === chave)) {
          set({ ativa: chave, vazio: false, janelas: janelas.map((j) => (j.chave === chave ? { ...j, pathname, search, usadaEm: agora } : j)) })
          return
        }
        const nova: Janela = { chave, pathname, search, titulo: tituloDe(pathname, search), modulo: moduloDaRota(pathname)?.path ?? null, usadaEm: agora }
        let lista = [...janelas, nova]
        let aviso: string | null = null
        if (lista.length > MAX_JANELAS) {
          const sai = lista.filter((j) => j.chave !== chave).sort((a, b) => a.usadaEm - b.usadaEm)[0]
          lista = lista.filter((j) => j.chave !== sai.chave)
          aviso = `"${sai.titulo}" foi fechada para abrir esta (limite de ${MAX_JANELAS} janelas).`
        }
        set({ janelas: lista, ativa: chave, aviso, vazio: false })
      },
      // Janela de área (Configuração) mantém o nome da área, qualquer que seja a parte aberta.
      renomear: (chave, titulo) => set((s) => (!AREAS_UMA_JANELA.some((a) => chave === `${a.prefixo}::`) && s.janelas.some((j) => j.chave === chave && j.titulo !== titulo)
        ? { janelas: s.janelas.map((j) => (j.chave === chave ? { ...j, titulo } : j)) }
        : s)),
      // Fecha e devolve a janela que deve ficar à vista (vizinha), se a fechada era a ativa.
      fechar: (chave) => {
        const { janelas, ativa } = get()
        const i = janelas.findIndex((j) => j.chave === chave)
        if (i < 0) return null
        const lista = janelas.filter((j) => j.chave !== chave)
        const proxima = ativa === chave ? (lista[i] ?? lista[i - 1] ?? null) : null
        // Fechou a última: área vazia (dá para reabrir).
        if (lista.length === 0) { set({ janelas: [], ativa: null, vazio: true, fechadas: janelas }); return null }
        set({ janelas: lista, ativa: ativa === chave ? proxima?.chave ?? null : ativa })
        return proxima
      },
      limparAviso: () => set({ aviso: null }),
      fecharTodas: () => set((st) => ({ janelas: [], ativa: null, vazio: true, fechadas: st.janelas.length ? st.janelas : st.fechadas })),
      reabrir: () => {
        const { fechadas } = get()
        if (fechadas.length === 0) return null
        set({ janelas: fechadas, fechadas: [] })
        return [...fechadas].sort((a, b) => b.usadaEm - a.usadaEm)[0]
      },
    }),
    {
      name: 'visor360.janelas',
      partialize: (s) => ({ janelas: s.janelas }),
      // Ao abrir o app, refaz a identidade das janelas salvas com a regra de hoje
      // e junta as repetidas (fica a usada por último) — ex.: as várias
      // "Configuração" de antes de a área virar uma janela só.
      merge: (salvo, atual) => {
        const lista = ((salvo as { janelas?: Janela[] } | undefined)?.janelas ?? [])
          .map((j) => {
            const chave = chaveDe(j.pathname, j.search)
            return areaDe(j.pathname) ? { ...j, chave, titulo: tituloDe(j.pathname, j.search) } : { ...j, chave }
          })
        const porChave = new Map<string, Janela>()
        for (const j of lista) {
          const ja = porChave.get(j.chave)
          if (!ja || j.usadaEm > ja.usadaEm) porChave.set(j.chave, j)
        }
        const janelas = lista.filter((j) => porChave.get(j.chave) === j)
        return { ...atual, janelas }
      },
    },
  ),
)
