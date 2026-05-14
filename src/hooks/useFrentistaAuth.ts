import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFreentistaStore } from '@/store/frentista'
import { useFilterStore } from '@/store/filters'

/**
 * Auth do frentista via Supabase. Como frentistas usam código + PIN (não email),
 * fazemos um mapeamento interno:
 *  - email do Supabase: `<codigo>@frentistas.cci.app.br`
 *  - password do Supabase: `frentista-<pin>` (prefixo evita o mínimo de 6 chars)
 *
 * O usuário no Supabase precisa ter `user_metadata` com:
 *   { codigo, nome, empresa_codigo, empresa_nome, role: 'frentista', ativo: true }
 *
 * Criado manualmente no Supabase Studio (Authentication → Add user com Auto Confirm,
 * depois editando user_metadata). Em fase futura, /admin no app automatiza isso.
 */

const FRENTISTA_EMAIL_DOMAIN = 'frentistas.cci.app.br'
const codigoToEmail = (codigo: string) => `${codigo}@${FRENTISTA_EMAIL_DOMAIN}`
const pinToPassword = (pin: string) => `frentista-${pin}`

interface FrentistaMetadata {
  codigo?: string
  nome?: string
  empresa_codigo?: number
  empresa_nome?: string
  role?: string
  ativo?: boolean
  funcionario_codigo?: number
}

export const useFrentistaAuth = () => {
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setSession = useFreentistaStore((s) => s.setSession)
  const clearSession = useFreentistaStore((s) => s.clearSession)
  const setEmpresas = useFilterStore((s) => s.setEmpresas)

  const login = async (codigo: string, pin: string): Promise<boolean> => {
    setError(null)
    if (!supabase) {
      setError('Supabase não configurado.')
      return false
    }

    const email = codigoToEmail(codigo.trim())
    const password = pinToPassword(pin.trim())

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError || !data.user) {
      setError('Código ou PIN inválido')
      return false
    }

    const metadata = (data.user.user_metadata ?? {}) as FrentistaMetadata
    if (metadata.role !== 'frentista') {
      await supabase.auth.signOut()
      setError('Esta conta não é de frentista. Acesse pela aba "Gerente".')
      return false
    }

    // Tabela `frentistas` é source-of-truth pro flag `ativo` (admin pode togglar
    // sem precisar de service_role pra atualizar user_metadata). user_metadata
    // só serve pra dados imutáveis (codigo, nome, empresa).
    const { data: frentista, error: frentistaErr } = await supabase
      .from('frentistas')
      .select('codigo, nome, empresa_codigo, empresa_nome, funcionario_codigo, ativo')
      .eq('user_id', data.user.id)
      .maybeSingle()
    if (frentistaErr || !frentista) {
      // Fallback pra metadata se a tabela não tem o registro (compat com
      // contas criadas manualmente antes do setup completo)
      if (metadata.ativo === false) {
        await supabase.auth.signOut()
        setError('Frentista inativo. Procure o supervisor.')
        return false
      }
      const empresaCodigo = metadata.empresa_codigo ?? 0
      setEmpresas([empresaCodigo])
      setSession({
        funcionarioCodigo: metadata.funcionario_codigo ?? 0,
        nome: metadata.nome ?? '',
        empresaCodigo,
        empresaNome: metadata.empresa_nome ?? '',
      })
      return true
    }

    if (!frentista.ativo) {
      await supabase.auth.signOut()
      setError('Frentista inativo. Procure o supervisor.')
      return false
    }

    setEmpresas([frentista.empresa_codigo])
    setSession({
      funcionarioCodigo: frentista.funcionario_codigo ?? 0,
      nome: frentista.nome,
      empresaCodigo: frentista.empresa_codigo,
      empresaNome: frentista.empresa_nome,
    })

    return true
  }

  const logout = async () => {
    if (supabase) await supabase.auth.signOut()
    // Cleanup defensivo da flag legacy — não tem efeito quando já está limpo
    sessionStorage.removeItem('app_authenticated')
    sessionStorage.removeItem('app_mode')
    clearSession()
    queryClient.clear()
    navigate('/login')
  }

  return { error, login, logout }
}
