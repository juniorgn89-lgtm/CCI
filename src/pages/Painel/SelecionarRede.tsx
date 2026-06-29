import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Network, Loader2, CheckCircle2, Power, ArrowRight } from 'lucide-react'
import { fetchRedes, type RedeRow } from '@/api/supabase/redes'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'
import { useFilterStore } from '@/store/filters'
import { cn } from '@/lib/utils'

/**
 * Módulo "Selecionar rede" do painel. Lista as redes do backend (sem inventar);
 * uma conectada por vez. Conectar seta o tenant + limpa caches/filtro — o
 * carregamento Quality acontece quando o master abre um módulo de dados.
 */
const SelecionarRede = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const tenantRede = useTenantStore((s) => s.rede)
  const setRede = useTenantStore((s) => s.setRede)
  const setEmpresas = useFilterStore((s) => s.setEmpresas)

  const isMaster = useAuthStore((s) => s.isMaster)
  const acessoTodas = useAuthStore((s) => s.acessoTodasRedes)
  const redesPermitidas = useAuthStore((s) => s.redesPermitidas)

  const { data: redesAll = [], isLoading, error } = useQuery({
    queryKey: ['redes'],
    queryFn: fetchRedes,
    staleTime: 5 * 60 * 1000,
  })

  // Master/"todas" → todas; senão só as permitidas (+ a rede atual/home).
  const redes = useMemo(() => {
    if (isMaster || acessoTodas) return redesAll
    const allow = new Set(redesPermitidas)
    if (tenantRede?.id) allow.add(tenantRede.id)
    return redesAll.filter((r) => allow.has(r.id))
  }, [redesAll, isMaster, acessoTodas, redesPermitidas, tenantRede])

  const handleConectar = (rede: RedeRow) => {
    queryClient.clear()
    setEmpresas([])
    setRede({ id: rede.id, nome: rede.nome, chave: rede.chave, api_base_url: rede.api_base_url })
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1e3a5f]">
          <Network className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Selecionar rede</h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400">
            Escolha qual rede deseja acessar — ou use a navegação acima pra ir direto a <strong>Usuários</strong> e <strong>Configurações</strong> sem conectar.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : redes.length === 0 ? (
        <div className="rounded-[15px] border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <Network className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">Nenhuma rede cadastrada</p>
          <button
            onClick={() => navigate('/painel/redes')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#27496f]"
          >
            Gerenciar redes <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {redes.map((rede) => {
            const conectada = tenantRede?.id === rede.id
            return (
              <div
                key={rede.id}
                className={cn(
                  'group flex items-center gap-3 rounded-[15px] border px-5 py-[18px] transition-all hover:-translate-y-px hover:border-[#c3d0e0] hover:shadow-[0_8px_22px_rgba(15,23,42,0.09)]',
                  conectada
                    ? 'border-[#bfdbfe] bg-[#f4f8ff] dark:border-blue-800 dark:bg-blue-950/30'
                    : 'border-[#e7ecf3] bg-white dark:border-gray-700 dark:bg-gray-900',
                  !rede.ativo && 'opacity-75',
                )}
              >
                {/* Ícone de status com dot */}
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl',
                      conectada ? 'bg-[#dbeafe] dark:bg-blue-900/40' : 'bg-[#ecfdf5] dark:bg-emerald-900/30',
                    )}
                  >
                    <Power className={cn('h-5 w-5', conectada ? 'text-[#1d4ed8] dark:text-blue-300' : 'text-[#0f766e] dark:text-emerald-300')} />
                  </div>
                  <span
                    className={cn(
                      'absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-900',
                      conectada ? 'bg-[#22c55e]' : 'bg-[#cbd5e1]',
                    )}
                  />
                </div>

                {/* Nome + URL */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15.5px] font-bold text-gray-900 dark:text-gray-100">{rede.nome}</p>
                    {conectada && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#dbeafe] px-2 py-0.5 text-[10px] font-semibold text-[#1d4ed8] dark:bg-blue-900/40 dark:text-blue-300">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Conectada
                      </span>
                    )}
                    {!rede.ativo && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">Inativa</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[#94a3b8]">{rede.api_base_url}</p>
                </div>

                {/* Ação */}
                {conectada ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#dcfce7] px-4 py-2 text-sm font-semibold text-[#15803d] dark:bg-emerald-900/30 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> Conectada
                  </span>
                ) : (
                  <button
                    onClick={() => handleConectar(rede)}
                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-[#1e3a5f] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#27496f]"
                  >
                    Conectar <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default SelecionarRede
