import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { useRedePostos } from '@/pages/Rede/hooks/useRedePostos'
import { fetchSetores, fetchUsuariosDaRede, type SetorRow, type UsuarioRede } from '@/api/supabase/gestaoTarefas'

/* Peças compartilhadas pelas telas de Gestão (Tarefas, Rotinas, Painel). */

export const containerCls =
  'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black'
export const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100 dark:placeholder-gray-500'
export const selectCls = inputCls
export const labelCls = 'mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400'
export const btnPrimary =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3.5 text-sm font-semibold text-white hover:bg-[#162d4a] disabled:opacity-60 dark:bg-[#2563eb] dark:hover:bg-[#1d4ed8]'
export const btnGhost =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-200 dark:hover:bg-gray-800'

/** Rede, usuário logado, quem pode gerir, usuários e setores da rede, postos. */
export const useGestaoBase = () => {
  const rede = useTenantStore((s) => s.rede)
  const user = useAuthStore((s) => s.user)
  const fullName = useAuthStore((s) => s.fullName)
  const isMaster = useAuthStore((s) => s.isMaster)
  const canGerirTarefas = useAuthStore((s) => s.canGerirTarefas)
  const profileLoaded = useAuthStore((s) => s.profileLoaded)
  const redeId = rede?.id

  const usuarios = useQuery({
    queryKey: ['gestao-usuarios', redeId],
    queryFn: () => fetchUsuariosDaRede(redeId!),
    enabled: !!redeId,
    staleTime: 5 * 60 * 1000,
  })
  const setores = useQuery({
    queryKey: ['gestao-setores', redeId],
    queryFn: () => fetchSetores(redeId!),
    enabled: !!redeId,
  })
  const { postos } = useRedePostos()

  const nomeUsuario = (id: string | null | undefined) =>
    id ? (usuarios.data ?? []).find((u) => u.user_id === id)?.nome ?? 'Usuário' : null
  const nomeSetor = (id: string | null | undefined) =>
    id ? (setores.data ?? []).find((s) => s.id === id)?.nome ?? 'Setor' : null
  const nomePosto = (codigo: number | null | undefined) => {
    if (codigo === null || codigo === undefined) return null
    const p = postos.find((x) => x.codigo === codigo)
    return p ? p.fantasia || p.razao || `Posto ${codigo}` : `Posto ${codigo}`
  }

  return {
    rede,
    redeId,
    userId: user?.id ?? null,
    autor: { userId: user?.id ?? '', nome: fullName || user?.email || 'Usuário' },
    // Decisão 15/10: só gestor (profiles.pode_gerir_tarefas) e diretor (master) criam.
    podeGerir: isMaster || canGerirTarefas,
    profileLoaded,
    usuarios: (usuarios.data ?? []) as UsuarioRede[],
    setores: (setores.data ?? []) as SetorRow[],
    postos,
    nomeUsuario,
    nomeSetor,
    nomePosto,
  }
}

export const fmtDataHora = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}
export const fmtData = (dia: string) => {
  const [y, m, d] = dia.split('-')
  return `${d}/${m}/${y}`
}
export const hojeLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const somaDias = (dia: string, n: number) => {
  const [y, m, d] = dia.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
