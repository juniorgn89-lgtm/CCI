# CCISGA — Documentação

Dashboard analítico READ-ONLY para redes de postos de combustível.
Consome a API REST da Quality Automação usando **exclusivamente GET** (exceção: POST para login).

## Documentos

| Documento | Descrição |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Estrutura de diretórios e organização dos módulos |
| [CODING-STANDARDS.md](CODING-STANDARDS.md) | Convenções de código, naming e TypeScript |
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | Cores, tipografia, componentes e padrões visuais |
| [API-GUIDELINES.md](API-GUIDELINES.md) | Regra READ-ONLY, client HTTP e padrões de endpoint |
| [STATE-MANAGEMENT.md](STATE-MANAGEMENT.md) | Zustand (filtros globais) e TanStack Query (data fetching) |
| [PRD.md](PRD.md) | Product Requirement Document completo |
| [TASKS.md](TASKS.md) | Lista de tarefas por sprint |

## Stack

| Tecnologia | Uso |
|---|---|
| React 18+ | Framework UI |
| TypeScript (strict) | Linguagem |
| Vite | Bundler |
| TailwindCSS | Estilização |
| shadcn/ui | Componentes base |
| Recharts | Gráficos |
| TanStack Query | Data fetching e cache (somente `useQuery`) |
| React Router v6 | Roteamento |
| Zustand | Estado global (filtros) |
| Axios | Client HTTP (com interceptor GET-only) |

## Regra de Ouro

> O sistema usa **apenas GET**. Nenhuma requisição POST, PUT, DELETE ou PATCH deve existir no código, exceto o POST de login em `src/api/endpoints/auth.ts`.