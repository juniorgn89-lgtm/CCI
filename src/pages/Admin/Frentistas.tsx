import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, ArrowLeft, X, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import {
  fetchFrentistas,
  toggleFrentistaAtivo,
  createFrentista,
  type FrentistaRow,
} from '@/api/supabase/frentistas'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { cn } from '@/lib/utils'

const Frentistas = () => {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  // Gate: só supervisor entra aqui
  const role = (user?.user_metadata as Record<string, unknown> | undefined)?.role as string | undefined
  const [profileRole, setProfileRole] = useState<string | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    // O role real está em profiles, não em user_metadata. Busca uma vez.
    let cancelled = false
    const checkRole = async () => {
      const { supabase } = await import('@/lib/supabase')
      if (!supabase) {
        setProfileLoaded(true)
        return
      }
      const { data } = await supabase.from('profiles').select('role').single()
      if (!cancelled) {
        setProfileRole(data?.role ?? null)
        setProfileLoaded(true)
      }
    }
    checkRole()
    return () => { cancelled = true }
  }, [])

  const isSupervisor = profileRole === 'supervisor' || role === 'supervisor'

  const { data: frentistas = [], isLoading, error } = useQuery({
    queryKey: ['frentistas'],
    queryFn: fetchFrentistas,
    enabled: isSupervisor,
  })

  // Empresas pra dropdown do form de criação
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
    enabled: isSupervisor,
  })
  const empresas = empresasData?.resultados ?? []

  const [showCreate, setShowCreate] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const handleToggleAtivo = async (row: FrentistaRow) => {
    setBusyUserId(row.user_id)
    try {
      await toggleFrentistaAtivo(row.user_id, !row.ativo)
      queryClient.invalidateQueries({ queryKey: ['frentistas'] })
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`)
    } finally {
      setBusyUserId(null)
    }
  }

  if (!profileLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!isSupervisor) {
    return (
      <div className="mx-auto max-w-md text-center py-16">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Acesso restrito a supervisores.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Frentistas</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestão de acessos do app dos frentistas
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d4a]"
        >
          <Plus className="h-4 w-4" />
          Novo frentista
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : frentistas.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum frentista cadastrado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Código</th>
                <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                <th className="px-4 py-2.5 text-left font-medium">Posto</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {frentistas.map((f) => (
                <tr key={f.user_id}>
                  <td className="px-4 py-3 tabular-nums font-medium text-gray-900 dark:text-gray-100">
                    {f.codigo}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{f.nome}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{f.empresa_nome}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleAtivo(f)}
                      disabled={busyUserId === f.user_id}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                        f.ativo
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-400'
                      )}
                    >
                      {busyUserId === f.user_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <span className={cn('h-2 w-2 rounded-full', f.ativo ? 'bg-emerald-500' : 'bg-gray-400')} />
                      )}
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateFrentistaModal
          empresas={empresas.map((e) => ({ codigo: e.codigo, nome: e.fantasia || e.razao }))}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            queryClient.invalidateQueries({ queryKey: ['frentistas'] })
          }}
        />
      )}
    </div>
  )
}

interface CreateFrentistaModalProps {
  empresas: { codigo: number; nome: string }[]
  onClose: () => void
  onCreated: () => void
}

const CreateFrentistaModal = ({ empresas, onClose, onCreated }: CreateFrentistaModalProps) => {
  const [codigo, setCodigo] = useState('')
  const [pin, setPin] = useState('')
  const [nome, setNome] = useState('')
  const [empresaCodigo, setEmpresaCodigo] = useState<string>(empresas[0]?.codigo.toString() ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)

    const empresa = empresas.find((emp) => emp.codigo.toString() === empresaCodigo)
    if (!empresa) {
      setErr('Selecione um posto')
      return
    }
    if (!/^\d+$/.test(codigo)) {
      setErr('Código deve ser numérico')
      return
    }
    if (pin.length < 4) {
      setErr('PIN deve ter pelo menos 4 dígitos')
      return
    }

    setSubmitting(true)
    try {
      await createFrentista({
        codigo: Number(codigo),
        pin,
        nome: nome.trim().toUpperCase(),
        empresa_codigo: empresa.codigo,
        empresa_nome: empresa.nome,
      })
      onCreated()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Novo frentista</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Código</span>
              <input
                type="text"
                inputMode="numeric"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 1001"
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">PIN inicial</span>
              <input
                type="text"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 1234"
                maxLength={8}
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Nome completo</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: DERMEVAL SANTANA"
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Posto</span>
            <select
              value={empresaCodigo}
              onChange={(e) => setEmpresaCodigo(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            >
              <option value="" disabled>Selecione um posto</option>
              {empresas.map((e) => (
                <option key={e.codigo} value={e.codigo}>{e.nome}</option>
              ))}
            </select>
          </label>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            O frentista poderá trocar o PIN no app depois do primeiro login.
          </p>

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/30">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{err}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1e3a5f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#162d4a] disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar frentista'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Frentistas
