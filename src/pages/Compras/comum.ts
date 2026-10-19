import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { useRedePostos } from '@/pages/Rede/hooks/useRedePostos'
import { useQuery } from '@tanstack/react-query'
import { fetchPodeApagarCompras, type Autor } from '@/api/supabase/compras'

export { containerCls, labelCls, btnPrimary, btnGhost, fmtDataHora, fmtData } from '@/pages/Gestao/comum'
import { inputCls as inputBase, btnGhost as ghostBase } from '@/pages/Gestao/comum'
/** Campos no modo escuro seguem a paleta azulada do app (tokens gray-*), não preto neutro. */
export const inputCls = inputBase.replace('dark:bg-[#0f0f0f]', 'dark:bg-gray-950')
export const selectCls = inputCls
export const btnGhostEscuro = ghostBase.replace('dark:bg-[#0f0f0f]', 'dark:bg-gray-900')

/** Rede, usuário, quem libera, postos e nomes — base de todas as telas de Compras. */
export const useComprasBase = () => {
  const rede = useTenantStore((s) => s.rede)
  const user = useAuthStore((s) => s.user)
  const fullName = useAuthStore((s) => s.fullName)
  const isMaster = useAuthStore((s) => s.isMaster)
  const canLiberarCompras = useAuthStore((s) => s.canLiberarCompras)
  const profileLoaded = useAuthStore((s) => s.profileLoaded)
  const { postos } = useRedePostos()
  const nomePosto = (codigo: number | null | undefined) => {
    if (codigo === null || codigo === undefined) return ''
    const p = postos.find((x) => x.codigo === codigo)
    return p ? p.fantasia || p.razao || `Posto ${codigo}` : `Posto ${codigo}`
  }
  const autor: Autor = { userId: user?.id ?? '', nome: fullName || user?.email || 'Usuário' }
  const apagar = useQuery({ queryKey: ['compras-pode-apagar', user?.id], queryFn: fetchPodeApagarCompras, enabled: !!user?.id, staleTime: 10 * 60_000 })
  return {
    rede,
    redeId: rede?.id ?? null,
    moduloLigado: !!rede?.compras_habilitado,
    userId: user?.id ?? null,
    autor,
    podeLiberar: isMaster || canLiberarCompras,
    /** Apaga pedidos/transferências em qualquer situação (limpeza de testes; flag só de quem administra). */
    podeApagar: apagar.data === true,
    isMaster,
    profileLoaded,
    postos,
    nomePosto,
  }
}

export const mesAtualYm = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
export const ymDe = (iso: string) => iso.slice(0, 7)

/** "ROBERTO DA SILVA" → "Roberto Da Silva" (nomes do ERP vêm em caixa alta). */
export const nomeProprio = (s: string) => s.trim().toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
export const fmtCnpj = (v: string | null | undefined) => {
  const d = (v ?? '').replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return v ?? ''
}
export const qtdFmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
