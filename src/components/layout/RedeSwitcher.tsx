import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Network, Check, ChevronDown, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { fetchRedes, fetchEmpresasCountForRede } from '@/api/supabase/redes'
import { useFilterStore } from '@/store/filters'
import { cn } from '@/lib/utils'

/**
 * Dropdown que aparece SÓ pra usuário master (CCI Consultoria). Permite trocar
 * a rede ativa em memória — todas as queries são invalidadas pra refetch com a
 * nova CHAVE. Refresh da página volta pra rede default do profile.
 */
const RedeSwitcher = () => {
  // `isMaster` vem da auth store (carimbado no bootstrap do App) — instantâneo.
  // Antes o RedeSwitcher refazia essa checagem async no Supabase a cada montagem,
  // o que fazia o botão "pop-in" depois dos demais controles do painel.
  const isMaster = useAuthStore((s) => s.isMaster)
  const tenant = useTenantStore((s) => s.rede)
  const setRede = useTenantStore((s) => s.setRede)
  const setEmpresas = useFilterStore((s) => s.setEmpresas)
  const queryClient = useQueryClient()

  // Lista de redes (só fetcha quando confirmar que é master)
  const { data: redes = [] } = useQuery({
    queryKey: ['redes'],
    queryFn: fetchRedes,
    enabled: isMaster,
    staleTime: 5 * 60 * 1000,
  })

  // Conta postos por rede (chama Quality em paralelo pra cada uma).
  // Cache de 30min — número de postos raramente muda. Em erro, retorna null
  // pra rede problemática e a UI esconde o badge dela.
  const redeIdsForQuery = redes.map((r) => r.id).sort().join(',')
  const { data: empresasCounts } = useQuery({
    queryKey: ['redes-empresas-count', redeIdsForQuery],
    queryFn: async () => {
      const entries = await Promise.all(
        redes.map(async (r) => [r.id, await fetchEmpresasCountForRede(r)] as const),
      )
      return new Map<string, number | null>(entries)
    },
    enabled: redes.length > 0,
    staleTime: 30 * 60 * 1000,
  })

  if (!isMaster || !tenant) return null

  const redesAtivas = redes.filter((r) => r.ativo)

  const handleSelect = (redeId: string) => {
    const target = redes.find((r) => r.id === redeId)
    if (!target || target.id === tenant.id) return

    // Troca o tenant em memória
    setRede({
      id: target.id,
      nome: target.nome,
      chave: target.chave,
      api_base_url: target.api_base_url,
    })

    // Limpa filtro de empresa selecionada (códigos da Quality são diferentes por rede)
    setEmpresas([])

    // Limpa TODO o cache do React Query — os dados antigos são da rede anterior.
    // Próxima query refetch automaticamente com a nova CHAVE via interceptor.
    queryClient.clear()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors',
            'hover:bg-gray-50 hover:border-gray-300',
            'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
          )}
          aria-label="Trocar rede"
        >
          <Network className="h-3.5 w-3.5 text-blue-500" />
          <span className="hidden sm:inline">{tenant.nome}</span>
          <ChevronDown className="h-3 w-3 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-gray-400">
          Trocar rede ativa
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {redesAtivas.length === 0 ? (
          <div className="flex items-center gap-2 px-2 py-3 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Carregando...
          </div>
        ) : (
          redesAtivas.map((r) => {
            const active = r.id === tenant.id
            const count = empresasCounts?.get(r.id)
            return (
              <DropdownMenuItem
                key={r.id}
                onSelect={() => handleSelect(r.id)}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className={cn('truncate', active && 'font-semibold text-blue-600 dark:text-blue-400')}>
                    {r.nome}
                  </span>
                  {count != null && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {count} {count === 1 ? 'posto' : 'postos'}
                    </span>
                  )}
                </div>
                {active && <Check className="h-3.5 w-3.5 shrink-0 text-blue-500" />}
              </DropdownMenuItem>
            )
          })
        )}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-[10px] text-gray-400">
          A troca é só pra esta sessão. Refresh volta pra rede padrão.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default RedeSwitcher
