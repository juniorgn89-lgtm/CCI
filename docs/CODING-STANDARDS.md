# Padrões de Código

## Idiomas

- **Código** (variáveis, funções, componentes, arquivos): Inglês
- **Interface do usuário** (labels, mensagens, textos): Português Brasileiro

## TypeScript

- Strict mode habilitado (`strict: true` no tsconfig)
- Imports com path alias: `@/` aponta para `src/`
- Aspas simples
- Componentes funcionais com arrow functions

## Naming

| Elemento | Convenção | Exemplo |
|---|---|---|
| Componentes | PascalCase | `KpiCard`, `DailyTable` |
| Hooks | camelCase com prefixo `use` | `useFuelData`, `useAuth` |
| Funções e variáveis | camelCase | `fetchVendas`, `isLoading` |
| Tipos e interfaces | PascalCase | `Venda`, `PaginatedResponse` |
| Arquivos de componente | PascalCase.tsx | `KpiCard.tsx`, `Sidebar.tsx` |
| Arquivos de hook | camelCase.ts | `useFuelData.ts` |
| Arquivos de endpoint | camelCase.ts | `vendas.ts`, `combustiveis.ts` |
| Arquivos de tipo | camelCase.ts | `venda.ts`, `empresa.ts` |
| Constantes | UPPER_SNAKE_CASE | `STALE_TIME_DEFAULT` |

## Estrutura de Componentes

```tsx
// Imports
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatters'

// Types (se locais ao componente)
interface KpiCardProps {
  label: string
  value: number
  variation?: number
}

// Component
const KpiCard = ({ label, value, variation }: KpiCardProps) => {
  return (
    <Card>
      {/* ... */}
    </Card>
  )
}

export default KpiCard
```

## Estrutura de Hooks de Dados

```tsx
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaResumo } from '@/api/endpoints/vendas'

const useDashboardData = () => {
  const { empresaCodigo, dataInicial, dataFinal } = useFilterStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['vendaResumo', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchVendaResumo({ empresaCodigo, dataInicial, dataFinal }),
  })

  // processar dados...

  return { kpis, tableData, isLoading, error }
}

export default useDashboardData
```

## O que evitar

- `useMutation` — o sistema é READ-ONLY
- `client.post()`, `.put()`, `.delete()`, `.patch()` — exceto `auth.ts`
- Fetch/axios direto em componentes — sempre usar hooks + `useQuery`
- `localStorage` para tokens — usar memória ou httpOnly cookie
- Abstrações prematuras — manter simples e direto
- Arquivos de tipo para request bodies de escrita — não existem neste projeto
- Botões de criar, editar, salvar ou excluir na interface