# Gerenciamento de Estado

## Visão Geral

| Ferramenta | Responsabilidade |
|---|---|
| **Zustand** | Estado global dos filtros (empresa, período) |
| **TanStack Query** | Cache, fetching e sincronização de dados da API |

Zustand cuida apenas dos filtros compartilhados entre módulos. TanStack Query cuida de toda comunicação com a API.

## Zustand — Filtros Globais

Store em `src/store/filters.ts`. Contém os filtros que persistem entre navegações:

```ts
interface FilterState {
  empresaCodigo: number | null
  dataInicial: string  // yyyy-MM-dd
  dataFinal: string    // yyyy-MM-dd
  setEmpresa: (codigo: number | null) => void
  setPeriodo: (dataInicial: string, dataFinal: string) => void
}
```

Os filtros ficam na barra de filtros do Header e são lidos por todos os hooks de dados dos módulos.

## TanStack Query — Data Fetching

Configuração do `QueryClient`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutos
      retry: 2,
    },
  },
})
```

### Regras

- Usar **somente `useQuery`** — nunca `useMutation`
- Query keys devem incluir os filtros globais para invalidação correta
- Nunca chamar `client.get()` direto em componentes — sempre via hooks

### Padrão de Hook

```ts
const useModuleData = () => {
  const { empresaCodigo, dataInicial, dataFinal } = useFilterStore()

  const query = useQuery({
    queryKey: ['moduleName', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchModuleData({ empresaCodigo, dataInicial, dataFinal }),
  })

  // processar dados...

  return { processedData, isLoading: query.isLoading, error: query.error }
}
```

### Invalidação ao Mudar Filtro

Quando o usuário altera empresa ou período, as queries ativas são invalidadas automaticamente porque os filtros fazem parte da query key. O TanStack Query refaz o fetch com os novos parâmetros.

### Cache por Tipo de Dado

Dados que mudam pouco (empresas, produtos, grupos) podem ter `staleTime` maior. Dados que mudam frequentemente (vendas, caixa) usam o default.