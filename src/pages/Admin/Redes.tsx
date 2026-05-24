import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Network, Plus, ArrowLeft, X, Loader2, Edit2, Eye, EyeOff, Trash2, AlertTriangle, Search } from 'lucide-react'
import {
  fetchRedes,
  createRede,
  updateRede,
  toggleRedeAtivo,
  deleteRede,
  type RedeRow,
} from '@/api/supabase/redes'
import { useTenantStore } from '@/store/tenant'
import { cn } from '@/lib/utils'

const DEFAULT_API_BASE = 'https://web.qualityautomacao.com.br/INTEGRACAO'

const Redes = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Gate: só master entra. Filtra por user_id (master vê todos os profiles
  // via RLS, então .single() sem filtro daria erro de múltiplas rows).
  const [isMaster, setIsMaster] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const { supabase } = await import('@/lib/supabase')
      const { useAuthStore } = await import('@/store/auth')
      const me = useAuthStore.getState().user
      if (!supabase || !me) {
        setIsMaster(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('is_master')
        .eq('user_id', me.id)
        .maybeSingle()
      if (!cancelled) setIsMaster(!!data?.is_master)
    }
    check()
    return () => { cancelled = true }
  }, [])

  const { data: redes = [], isLoading, error } = useQuery({
    queryKey: ['redes'],
    queryFn: fetchRedes,
    enabled: isMaster === true,
  })

  const [showCreate, setShowCreate] = useState(false)
  const [editingRede, setEditingRede] = useState<RedeRow | null>(null)
  const [deletingRede, setDeletingRede] = useState<RedeRow | null>(null)
  const [search, setSearch] = useState('')

  // Busca por nome da rede
  const redesFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return redes
    return redes.filter((r) => r.nome.toLowerCase().includes(q))
  }, [redes, search])
  const [busyId, setBusyId] = useState<string | null>(null)

  const handleToggleAtivo = async (rede: RedeRow) => {
    setBusyId(rede.id)
    try {
      await toggleRedeAtivo(rede.id, !rede.ativo)
      queryClient.invalidateQueries({ queryKey: ['redes'] })
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`)
    } finally {
      setBusyId(null)
    }
  }

  if (isMaster === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!isMaster) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Acesso restrito ao Gerente Geral.
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
            <Network className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">Redes</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Redes de postos cadastradas no sistema
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d4a]"
        >
          <Plus className="h-4 w-4" />
          Nova rede
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {/* Busca por rede — aparece com mais de 5 redes */}
        {redes.length > 5 && (
          <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar rede..."
                className="h-8 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : redesFiltradas.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {search.trim() ? 'Nenhuma rede encontrada pra essa busca.' : 'Nenhuma rede cadastrada.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                <th className="px-4 py-2.5 text-left font-medium">CHAVE</th>
                <th className="px-4 py-2.5 text-center font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {redesFiltradas.map((r) => (
                <RedeRowComp
                  key={r.id}
                  rede={r}
                  busy={busyId === r.id}
                  onToggle={() => handleToggleAtivo(r)}
                  onEdit={() => setEditingRede(r)}
                  onDelete={() => setDeletingRede(r)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        A CHAVE da rede é o token da API Quality. Cada rede tem sua chave própria.
        Os usuários (gerentes e frentistas) ficam vinculados a uma rede via `rede_id`.
      </p>

      {showCreate && (
        <RedeFormModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            queryClient.invalidateQueries({ queryKey: ['redes'] })
          }}
        />
      )}

      {editingRede && (
        <RedeFormModal
          mode="edit"
          rede={editingRede}
          onClose={() => setEditingRede(null)}
          onSaved={() => {
            setEditingRede(null)
            queryClient.invalidateQueries({ queryKey: ['redes'] })
          }}
        />
      )}

      {deletingRede && (
        <DeleteRedeModal
          rede={deletingRede}
          onClose={() => setDeletingRede(null)}
          onDeleted={() => {
            setDeletingRede(null)
            queryClient.invalidateQueries({ queryKey: ['redes'] })
          }}
        />
      )}
    </div>
  )
}

/* ─── Row ─── */

const RedeRowComp = ({
  rede,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  rede: RedeRow
  busy: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) => {
  const [revealed, setRevealed] = useState(false)
  const chave = revealed ? rede.chave : `${rede.chave.slice(0, 8)}…`

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{rede.nome}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <code className="font-mono text-xs text-gray-700 dark:text-gray-300">{chave}</code>
          <button
            onClick={() => setRevealed((v) => !v)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={revealed ? 'Ocultar' : 'Revelar'}
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onToggle}
            disabled={busy}
            role="switch"
            aria-checked={rede.ativo}
            aria-label={rede.ativo ? 'Desativar rede' : 'Ativar rede'}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
              rede.ativo ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700',
              busy && 'opacity-50 cursor-wait'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                rede.ativo ? 'translate-x-[18px]' : 'translate-x-0.5'
              )}
            />
          </button>
          <span className={cn(
            'text-xs font-medium tabular-nums',
            rede.ativo ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
          )}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (rede.ativo ? 'Ativa' : 'Inativa')}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1.5">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Edit2 className="h-3 w-3" />
            Editar
          </button>
          <button
            onClick={onDelete}
            title="Excluir rede"
            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-3 w-3" />
            Excluir
          </button>
        </div>
      </td>
    </tr>
  )
}

/* ─── Modal de criação / edição ─── */

interface RedeFormModalProps {
  mode: 'create' | 'edit'
  rede?: RedeRow
  onClose: () => void
  onSaved: () => void
}

const RedeFormModal = ({ mode, rede, onClose, onSaved }: RedeFormModalProps) => {
  const [nome, setNome] = useState(rede?.nome ?? '')
  const [chave, setChave] = useState(rede?.chave ?? '')
  const [apiBaseUrl, setApiBaseUrl] = useState(rede?.api_base_url ?? DEFAULT_API_BASE)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const tenantRede = useTenantStore((s) => s.rede)
  const setTenantRede = useTenantStore((s) => s.setRede)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)

    if (!nome.trim() || !chave.trim()) {
      setErr('Nome e CHAVE são obrigatórios')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'create') {
        await createRede({ nome: nome.trim(), chave: chave.trim(), api_base_url: apiBaseUrl.trim() })
      } else if (rede) {
        const novosCampos = {
          nome: nome.trim(),
          chave: chave.trim(),
          api_base_url: apiBaseUrl.trim(),
        }
        await updateRede(rede.id, novosCampos)
        // Se a rede editada é a tenant ativa, atualiza a store em memória
        // pra refletir nome/chave/url novos imediatamente — sem isso, o
        // RedeSwitcher e tudo que usa tenant.nome continuam com o valor
        // antigo até o próximo login.
        if (tenantRede?.id === rede.id) {
          setTenantRede({ id: rede.id, ...novosCampos })
        }
      }
      onSaved()
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
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'create' ? 'Nova rede' : 'Editar rede'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Nome da rede</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Rede Itapoa"
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">CHAVE da Quality</span>
            <input
              type="text"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder="Ex: 94536401-d73e-4fe0-a82f-f076ef94dadf"
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            />
            <p className="mt-1 text-[11px] text-gray-400">Token de integração com a API Quality Automação</p>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Base URL</span>
            <input
              type="url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            />
            <p className="mt-1 text-[11px] text-gray-400">Raramente muda — use o padrão se não tiver certeza</p>
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
                  Salvando...
                </>
              ) : mode === 'create' ? 'Criar rede' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Modal de exclusão ─── */

interface DeleteRedeModalProps {
  rede: RedeRow
  onClose: () => void
  onDeleted: () => void
}

const DeleteRedeModal = ({ rede, onClose, onDeleted }: DeleteRedeModalProps) => {
  // Requer digitar o nome exato pra liberar o botão — protege contra
  // exclusão acidental, já que é operação irreversível.
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const canDelete = confirmText.trim() === rede.nome

  const handleDelete = async () => {
    if (!canDelete) return
    setSubmitting(true)
    setErr(null)
    try {
      await deleteRede(rede.id)
      onDeleted()
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
          <h2 className="flex items-center gap-2 text-base font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Excluir rede
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Aviso destacado */}
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Esta ação é irreversível.
            </p>
            <p className="mt-1.5 text-xs text-red-600/90 dark:text-red-400/80">
              A rede <span className="font-semibold">{rede.nome}</span> será
              excluída permanentemente. Após confirmar:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-600/90 dark:text-red-400/80">
              <li>Gerentes e frentistas vinculados a esta rede perderão acesso</li>
              <li>O histórico de apuração permanecerá no banco mas órfão</li>
              <li>A CHAVE da Quality usada pela rede não será mais válida no sistema</li>
              <li>Não há como desfazer — só recriando manualmente</li>
            </ul>
          </div>

          {/* Confirmação por digitação */}
          <label className="block">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Pra confirmar, digite <span className="font-mono font-semibold text-red-600 dark:text-red-400">{rede.nome}</span> abaixo:
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={rede.nome}
              autoFocus
              className="mt-1.5 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/30">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{err}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || submitting}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors',
                canDelete && !submitting
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-red-300 cursor-not-allowed dark:bg-red-900/50',
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir rede
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Redes
