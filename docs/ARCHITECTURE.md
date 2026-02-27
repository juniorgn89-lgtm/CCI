# Arquitetura

## Visão Geral

SPA (Single Page Application) React que consome uma API REST externa (Quality Automação). Não possui backend próprio. Organização feature-based — cada módulo tem sua pasta com componentes, hooks e lógica isolados.

## Estrutura de Diretórios

```
src/
├── api/
│   ├── client.ts              # Instância Axios com interceptor GET-only
│   ├── endpoints/             # Funções de consulta (uma por domínio)
│   │   ├── auth.ts            # Único arquivo que usa POST (login)
│   │   ├── vendas.ts
│   │   ├── produtos.ts
│   │   ├── combustiveis.ts
│   │   ├── estoques.ts
│   │   ├── funcionarios.ts
│   │   ├── financeiro.ts
│   │   ├── clientes.ts
│   │   ├── empresas.ts
│   │   └── relatorios.ts
│   └── types/                 # Tipos de resposta da API
│       ├── auth.ts
│       ├── venda.ts
│       ├── produto.ts
│       ├── cliente.ts
│       ├── funcionario.ts
│       ├── empresa.ts
│       ├── financeiro.ts
│       ├── estoque.ts
│       └── common.ts          # PaginatedResponse<T>, tipos compartilhados
├── components/                # Componentes reutilizáveis (design system)
│   ├── ui/                    # shadcn/ui (gerados automaticamente)
│   ├── charts/                # Wrappers de Recharts
│   ├── filters/               # Filtros globais (empresa, período)
│   ├── tables/                # DataTable, HeatmapCell
│   ├── kpi/                   # KpiCard, KpiGrid
│   └── layout/                # AppLayout, Sidebar, Header, ProtectedRoute
├── pages/                     # Módulos (feature-based)
│   ├── Login/
│   ├── Dashboard/
│   ├── Combustiveis/
│   ├── Produtos/
│   ├── Conveniencias/
│   ├── Estoques/
│   ├── Produtividade/
│   ├── Financeiro/
│   └── Relatorios/
├── store/
│   └── filters.ts             # Zustand — filtros globais
├── hooks/
│   ├── useAuth.ts
│   └── useFilters.ts
├── lib/
│   ├── formatters.ts          # formatCurrency, formatNumber, etc.
│   ├── constants.ts           # Cores, breakpoints, staleTime
│   └── utils.ts               # cn() para merge de classes Tailwind
└── routes/
    └── index.tsx              # Definição de rotas
```

## Estrutura de um Módulo (Página)

Cada módulo segue o mesmo padrão:

```
pages/NomeModulo/
├── index.tsx                  # Página principal (compõe componentes)
├── components/                # Componentes locais do módulo
│   ├── ModuleKpis.tsx
│   ├── SomeTable.tsx
│   └── SomeChart.tsx
└── hooks/
    └── useModuleData.ts       # Hook que busca e processa dados
```

## Fluxo de Dados

```
Componente → Hook do módulo → useQuery (TanStack Query) → endpoint function → client.get() → API
```

- Todo dado vem da API via `useQuery`
- Hooks do módulo leem filtros do Zustand e passam como params
- Componentes recebem dados processados dos hooks
- Nunca chamar `client.get()` diretamente em componentes

## Módulos

| Rota | Módulo | Função |
|---|---|---|
| `/login` | Login | Autenticação (rota pública) |
| `/dashboard` | Dashboard | Visão geral consolidada |
| `/combustiveis` | Combustíveis | Vendas de combustível, tanques, LMC |
| `/produtos` | Produtos | Vendas de automotivos, Pareto, Curva ABC |
| `/conveniencias` | Conveniências | Vendas de conveniência |
| `/estoques` | Estoques | Posição de estoque, movimentação |
| `/produtividade` | Produtividade | Rankings de funcionários |
| `/financeiro` | Financeiro | Receber, pagar, fluxo de caixa, DRE |
| `/relatorios` | Relatórios | Relatórios pré-configurados |