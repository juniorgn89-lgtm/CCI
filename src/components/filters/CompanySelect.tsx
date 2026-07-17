import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, ChevronDown, Network, Check } from 'lucide-react'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useFilters } from '@/hooks/useFilters'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

/** Compara duas listas de códigos sem se importar com a ordem. */
const sameCodes = (a: number[], b: number[]): boolean =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])

interface CompanySelectProps {
  /** Permite "Todos os postos" (rede consolidada). False = módulo gateado, só posto específico. */
  allowTodos?: boolean
  /** Esconde a linha interna "Todos os postos" — usado quando o pai já expõe
   *  esse atalho por fora (ex.: toggle logo abaixo da Rede no painel de contexto).
   *  Aqui o dropdown lista SÓ postos específicos; sem seleção o rótulo vira um
   *  convite ("Selecione o posto") em vez de "Todos". */
  hideTodosRow?: boolean
  /** Gatilho ocupa 100% da largura do container (ex.: coluna do painel de
   *  contexto, onde deve alinhar com a Rede e o toggle). Default = largura fixa. */
  fullWidth?: boolean
  /** Chamado quando a seleção é confirmada (Aplicar/escolha única) — o pai pode
   *  fechar o painel de contexto junto. */
  onApplied?: () => void
}

const CompanySelect = ({ allowTodos = true, hideTodosRow = false, fullWidth = false, onApplied }: CompanySelectProps = {}) => {
  const [open, setOpen] = useState(false)
  const { empresaCodigos, setEmpresas } = useFilters()
  // Módulo gateado (allowTodos=false) → seleção ÚNICA: um posto por vez, aplica na hora.
  const single = !allowTodos

  // Rascunho local: a seleção só é APLICADA (e dispara fetch) ao clicar em
  // "Aplicar". Sem isso, cada checkbox recarregava os dados na hora.
  const [draft, setDraft] = useState<number[]>(empresaCodigos)
  // Ressincroniza o rascunho com o aplicado toda vez que o menu abre (descarta
  // rascunhos não aplicados de uma abertura anterior).
  useEffect(() => {
    if (open) setDraft(empresaCodigos)
  }, [open, empresaCodigos])

  const { data: empresasData, isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })

  // Aplica a restrição do usuário (profiles.empresa_codigos). Master/sem
  // restrição vê todas; supervisor/frentista restrito vê só as permitidas.
  const empresas = useEmpresasPermitidas(empresasData?.resultados ?? [])

  // `[]` = "Todos os postos" → a rede inteira consolidada. É a mesma semântica
  // que o Dashboard/Central já usa (matchesEmpresa trata lista vazia como rede
  // toda permitida). Selecionar N postos consolida exatamente esse subconjunto.
  // O estado dos checkboxes reflete o RASCUNHO (não o aplicado).
  const allSelected = draft.length === 0

  // Liga/desliga um posto NO RASCUNHO (não aplica ainda).
  const toggle = (codigo: number) => {
    if (draft.includes(codigo)) {
      setDraft(draft.filter((c) => c !== codigo))
    } else {
      setDraft([...draft, codigo])
    }
  }

  const selectAll = () => setDraft([])

  // Aplica o rascunho → dispara o fetch uma única vez e fecha o menu.
  const dirty = !sameCodes(draft, empresaCodigos)
  const apply = () => {
    if (dirty) setEmpresas(draft)
    setOpen(false)
    onApplied?.()
  }

  // Rótulo do gatilho = seleção APLICADA (não o rascunho). 1–2 postos: nomes
  // com "·"; 3+: colapsa pra contagem.
  // Single-select: aplica na hora e fecha (um posto por vez).
  const pickSingle = (codigo: number) => {
    if (!sameCodes([codigo], empresaCodigos)) setEmpresas([codigo])
    setOpen(false)
    onApplied?.()
  }

  const getLabel = (): string => {
    if (single) {
      if (empresaCodigos.length !== 1) return 'Selecione um posto'
      return empresas.find((e) => e.codigo === empresaCodigos[0])?.fantasia ?? 'Selecione um posto'
    }
    if (empresaCodigos.length === 0) return hideTodosRow ? 'Selecione o posto' : 'Todos'
    const nomes = empresaCodigos
      .map((c) => empresas.find((e) => e.codigo === c)?.fantasia)
      .filter((n): n is string => !!n)
    if (nomes.length === 0) return hideTodosRow ? 'Selecione o posto' : 'Todos'
    return nomes.length <= 2 ? nomes.join(' · ') : `${nomes.length} postos`
  }

  const TriggerIcon = !single && !hideTodosRow && empresaCodigos.length === 0 ? Network : Building2

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 justify-between border-blue-200 bg-blue-50/50 text-[11px] font-normal hover:bg-blue-100/60 dark:border-blue-900/40 dark:bg-blue-950/30 dark:hover:bg-blue-900/30 xl:text-xs',
            fullWidth ? 'w-full' : 'w-[200px] xl:w-[240px]',
          )}
          disabled={isLoading}
        >
          <span className="flex items-center gap-1.5 truncate">
            <TriggerIcon className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
            <span className="truncate">{isLoading ? 'Carregando...' : getLabel()}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuLabel className="py-1">
          <span className="text-xs text-gray-500">Selecione o posto</span>
        </DropdownMenuLabel>
        {single && (
          <p className="px-2 pb-1.5 text-[11px] leading-snug text-gray-400">
            Este módulo funciona com <span className="font-medium text-gray-600 dark:text-gray-300">uma empresa por vez</span>.
          </p>
        )}
        <DropdownMenuSeparator />

        {single ? (
          /* Seleção ÚNICA (módulos gateados) — clique aplica na hora e fecha. */
          empresas.map((empresa) => {
            const sel = empresaCodigos.length === 1 && empresaCodigos[0] === empresa.codigo
            return (
              <DropdownMenuItem
                key={empresa.codigo}
                onSelect={() => pickSingle(empresa.codigo)}
                className={cn('gap-2 text-[13px]', sel && 'font-semibold text-[#1e3a5f] dark:text-blue-200')}
              >
                <Check className={cn('h-3.5 w-3.5 shrink-0', sel ? 'text-[#2563eb]' : 'opacity-0')} />
                {empresa.fantasia}
              </DropdownMenuItem>
            )
          })
        ) : (
          <>
            {/* Todos os postos → rede consolidada ([]). Só nos módulos que permitem
                E quando o atalho não foi movido pra fora (hideTodosRow). */}
            {allowTodos && !hideTodosRow && (
              <>
                <DropdownMenuCheckboxItem
                  checked={allSelected}
                  onCheckedChange={() => selectAll()}
                  onSelect={(e) => e.preventDefault()}
                >
                  <span className="flex items-center gap-1.5">
                    <Network className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                    <span className="font-medium">Todos os postos</span>
                    <span className="text-[10px] text-gray-400">rede consolidada</span>
                  </span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
              </>
            )}

            {empresas.map((empresa) => (
              <DropdownMenuCheckboxItem
                key={empresa.codigo}
                checked={draft.includes(empresa.codigo)}
                onCheckedChange={() => toggle(empresa.codigo)}
                onSelect={(e) => e.preventDefault()}
              >
                {empresa.fantasia}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />

            {/* Aplica a seleção de uma vez — o fetch só dispara aqui. */}
            <div className="px-2 py-1.5">
              <Button
                size="sm"
                className="h-7 w-full bg-[#1e3a5f] text-[11px] text-white hover:bg-[#1e3a5f]/90"
                onClick={apply}
                disabled={!dirty}
              >
                {dirty ? 'Aplicar' : 'Aplicado'}
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default CompanySelect
