import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, ArrowLeft, X, Loader2, Trash2, Search } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import {
  fetchFrentistas,
  toggleFrentistaAtivo,
  createFrentista,
  deleteFrentista,
  type FrentistaRow,
} from '@/api/supabase/frentistas'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
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
  // Aplica a restrição do user logado (supervisor restrito vê só seus postos)
  const empresas = useEmpresasPermitidas(empresasData?.resultados ?? [])

  const [showCreate, setShowCreate] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Busca por nome, código ou posto
  const frentistasFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return frentistas
    return frentistas.filter(
      (f) =>
        (f.nome || '').toLowerCase().includes(q) ||
        String(f.codigo).includes(q) ||
        (f.empresa_nome || '').toLowerCase().includes(q),
    )
  }, [frentistas, search])

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

  const handleDelete = async (row: FrentistaRow) => {
    const ok = window.confirm(
      `Excluir o frentista ${row.nome} (código ${row.codigo})?\n\nEssa ação remove o acesso permanentemente.`
    )
    if (!ok) return
    setBusyUserId(row.user_id)
    try {
      await deleteFrentista(row.user_id)
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">Frentistas</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
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
        {/* Busca — aparece com mais de 5 frentistas */}
        {frentistas.length > 5 && (
          <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome, código ou posto..."
                className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : frentistasFiltrados.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {search.trim() ? 'Nenhum frentista encontrado pra essa busca.' : 'Nenhum frentista cadastrado.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Código</th>
                <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                <th className="px-4 py-2.5 text-left font-medium">Posto</th>
                <th className="px-4 py-2.5 text-center font-medium">Status</th>
                <th className="w-16 px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {frentistasFiltrados.map((f) => {
                const busy = busyUserId === f.user_id
                return (
                  <tr key={f.user_id}>
                    <td className="px-4 py-3 tabular-nums font-medium text-gray-900 dark:text-gray-100">
                      {f.codigo}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{f.nome}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{f.empresa_nome}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleToggleAtivo(f)}
                          disabled={busy}
                          role="switch"
                          aria-checked={f.ativo}
                          aria-label={f.ativo ? 'Desativar frentista' : 'Ativar frentista'}
                          className={cn(
                            'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                            f.ativo ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700',
                            busy && 'opacity-50 cursor-wait'
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                              f.ativo ? 'translate-x-[18px]' : 'translate-x-0.5'
                            )}
                          />
                        </button>
                        <span className={cn(
                          'text-xs font-medium',
                          f.ativo ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
                        )}>
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (f.ativo ? 'Ativo' : 'Inativo')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(f)}
                        disabled={busy}
                        title="Excluir frentista"
                        aria-label={`Excluir ${f.nome}`}
                        className={cn(
                          'inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400',
                          busy && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateFrentistaModal
          empresas={empresas.map((e) => ({ codigo: e.codigo, nome: e.fantasia || e.razao }))}
          codigosJaCadastrados={frentistas.map((f) => f.codigo)}
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
  /** Códigos de funcionário já vinculados a um frentista — filtramos do dropdown
   * pra evitar cadastrar a mesma pessoa duas vezes. */
  codigosJaCadastrados: number[]
  onClose: () => void
  onCreated: () => void
}

const CreateFrentistaModal = ({ empresas, codigosJaCadastrados, onClose, onCreated }: CreateFrentistaModalProps) => {
  const [pin, setPin] = useState('')
  const [empresaCodigo, setEmpresaCodigo] = useState<string>(empresas[0]?.codigo.toString() ?? '')
  const [funcionarioCodigo, setFuncionarioCodigo] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Funcionários da empresa selecionada (da API Quality).
  // `enabled` só dispara quando há empresa selecionada.
  const { data: funcionariosData, isLoading: isLoadingFuncionarios } = useQuery({
    queryKey: ['funcionarios-empresa', empresaCodigo],
    queryFn: () => fetchFuncionarios({ empresaCodigo: Number(empresaCodigo), ativo: true, limite: 500 }),
    enabled: !!empresaCodigo,
    staleTime: 10 * 60 * 1000,
  })
  const funcionarios = (funcionariosData?.resultados ?? [])
    .filter((f) => f.ativo)
    .filter((f) => !codigosJaCadastrados.includes(f.funcionarioCodigo))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  // Reseta a seleção de funcionário ao trocar de empresa
  const handleEmpresaChange = (codigo: string) => {
    setEmpresaCodigo(codigo)
    setFuncionarioCodigo('')
  }

  const funcionarioSelecionado = funcionarios.find(
    (f) => f.funcionarioCodigo.toString() === funcionarioCodigo
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)

    const empresa = empresas.find((emp) => emp.codigo.toString() === empresaCodigo)
    if (!empresa) {
      setErr('Selecione um posto')
      return
    }
    if (!funcionarioSelecionado) {
      setErr('Selecione um funcionário')
      return
    }
    if (pin.length < 4) {
      setErr('PIN deve ter pelo menos 4 dígitos')
      return
    }

    setSubmitting(true)
    try {
      await createFrentista({
        codigo: funcionarioSelecionado.funcionarioCodigo,
        pin,
        nome: funcionarioSelecionado.nome.trim().toUpperCase(),
        empresa_codigo: empresa.codigo,
        empresa_nome: empresa.nome,
        funcionario_codigo: funcionarioSelecionado.funcionarioCodigo,
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
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Posto</span>
            <select
              value={empresaCodigo}
              onChange={(e) => handleEmpresaChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            >
              <option value="" disabled>Selecione um posto</option>
              {empresas.map((e) => (
                <option key={e.codigo} value={e.codigo}>{e.nome}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Funcionário
            </span>
            <select
              value={funcionarioCodigo}
              onChange={(e) => setFuncionarioCodigo(e.target.value)}
              disabled={!empresaCodigo || isLoadingFuncionarios}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            >
              <option value="" disabled>
                {isLoadingFuncionarios
                  ? 'Carregando funcionários…'
                  : funcionarios.length === 0
                    ? 'Nenhum funcionário disponível'
                    : 'Selecione um funcionário'}
              </option>
              {funcionarios.map((f) => (
                <option key={f.funcionarioCodigo} value={f.funcionarioCodigo}>
                  {f.funcionarioCodigo} — {f.nome}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">
              Lista de funcionários ativos do posto (vinda da Quality). Já cadastrados ficam ocultos.
            </p>
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
            <p className="mt-1 text-[11px] text-gray-400">
              O frentista pode trocar o PIN no app depois do primeiro login.
            </p>
          </label>

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
