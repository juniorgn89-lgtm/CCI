import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Network, Loader2, CheckCircle2, ArrowRight, Power, Settings, UserCog } from 'lucide-react'
import { fetchRedes, type RedeRow } from '@/api/supabase/redes'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'
import { useFilterStore } from '@/store/filters'
import { cn } from '@/lib/utils'

/**
 * Landing do gerente (master). Lista todas as redes disponíveis (ativas e
 * inativas) com botão "Conectar". Conectar atualiza o tenant + persiste no
 * localStorage e leva o usuário ao Dashboard daquela rede.
 *
 * Master pode navegar pra /admin/* e /configuracoes sem conectar (são rotas
 * que não dependem da CHAVE Quality).
 */
const SelecionarRede = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const tenantRede = useTenantStore((s) => s.rede)
  const setRede = useTenantStore((s) => s.setRede)
  const setEmpresas = useFilterStore((s) => s.setEmpresas)
  const isMaster = useAuthStore((s) => s.isMaster)

  const [connecting, setConnecting] = useState<string | null>(null)

  const { data: redes = [], isLoading, error } = useQuery({
    queryKey: ['redes'],
    queryFn: fetchRedes,
    staleTime: 5 * 60 * 1000,
  })

  const handleConectar = (rede: RedeRow) => {
    setConnecting(rede.id)
    // Limpa cache de queries Quality da rede anterior pra evitar mistura de dados.
    queryClient.clear()
    setEmpresas([])
    setRede({
      id: rede.id,
      nome: rede.nome,
      chave: rede.chave,
      api_base_url: rede.api_base_url,
    })
    // Pequeno delay pra feedback visual antes de navegar
    setTimeout(() => navigate('/dashboard'), 150)
  }

  // Se não é master, não tem o que escolher aqui — sua rede é fixa pelo profile.
  // Manda direto pro dashboard.
  if (!isMaster) {
    navigate('/dashboard', { replace: true })
    return null
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <Network className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Selecionar rede</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Escolha qual rede deseja acessar — ou siga direto pra <strong>Usuários</strong> e <strong>Configurações</strong> sem conectar.
          </p>
        </div>
      </div>

      {/* Atalhos admin */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigate('/admin/usuarios')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <UserCog className="h-3.5 w-3.5" />
          Usuários
        </button>
        <button
          onClick={() => navigate('/admin/redes')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Network className="h-3.5 w-3.5" />
          Gerenciar redes
        </button>
        <button
          onClick={() => navigate('/configuracoes')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Settings className="h-3.5 w-3.5" />
          Configurações
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
        </div>
      )}

      {/* Lista de redes */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : redes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <Network className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            Nenhuma rede cadastrada
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Vá em <strong>Gerenciar redes</strong> pra cadastrar a primeira.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {redes.map((rede) => {
            const isCurrent = tenantRede?.id === rede.id
            const isBusy = connecting === rede.id
            return (
              <div
                key={rede.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-white p-4 transition-colors dark:bg-gray-900',
                  isCurrent
                    ? 'border-blue-300 bg-blue-50/40 dark:border-blue-700 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700',
                  !rede.ativo && 'opacity-75'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    rede.ativo
                      ? 'bg-emerald-50 dark:bg-emerald-900/30'
                      : 'bg-gray-100 dark:bg-gray-800'
                  )}
                >
                  <Power
                    className={cn(
                      'h-4 w-4',
                      rede.ativo
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-400'
                    )}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {rede.nome}
                    </p>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Conectada
                      </span>
                    )}
                    {!rede.ativo && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        Inativa
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                    {rede.api_base_url}
                  </p>
                </div>

                <button
                  onClick={() => handleConectar(rede)}
                  disabled={isBusy || isCurrent}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                    isCurrent
                      ? 'cursor-default bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                      : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a] disabled:opacity-60'
                  )}
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    'Conectada'
                  ) : (
                    <>
                      Conectar
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default SelecionarRede
