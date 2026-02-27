# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CCISGA is a **READ-ONLY** analytics dashboard for gas station networks. It's a React SPA that consumes the Quality Automação REST API (`https://web.qualityautomacao.com.br/INTEGRACAO/`) using **only GET requests**. There is no backend — frontend-only.

## Critical Rule: READ-ONLY

**The system must only use HTTP GET.** Never add `useMutation`, `client.post()`, `.put()`, `.delete()`, `.patch()`, or any UI that creates/edits/deletes data. The sole exception is `POST` for login in `src/api/endpoints/auth.ts`. The HTTP client in `src/api/client.ts` has an interceptor that blocks non-GET methods by design.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite)
npm run build        # Production build
npm run preview      # Preview production build
npx tsc --noEmit     # Type check (strict mode)
```

## Architecture

Feature-based SPA. Each page module has its own `components/` and `hooks/` folder.

**Data flow:** `Component → Module Hook → useQuery → endpoint function → client.get() → API`

- `src/api/client.ts` — Axios instance with GET-only interceptor
- `src/api/endpoints/` — One file per domain, exports functions calling `client.get()`
- `src/api/types/` — Response types only (no request bodies for write operations)
- `src/store/filters.ts` — Zustand store for global filters (empresa, período)
- `src/pages/{Module}/hooks/` — Module-specific hooks using `useQuery` + Zustand filters
- `src/components/` — Shared design system (KPI cards, tables, charts, filters, layout)

Full architecture details: `docs/ARCHITECTURE.md`

## Code Conventions

- **Code language:** English. **UI language:** Portuguese (pt-BR)
- TypeScript strict mode, single quotes, path alias `@/` → `src/`
- Arrow functions for components, PascalCase files for components, camelCase for hooks/endpoints/types
- Only `useQuery` from TanStack Query — never `useMutation`
- Never call `client.get()` directly in components — always through hooks
- Zustand only for global filters — not for server state
- Query keys must include filter values (`empresaCodigo`, `dataInicial`, `dataFinal`)

Full standards: `docs/CODING-STANDARDS.md`

## Design System

- Primary: `#1e3a5f` (navy), Accent: `#2563eb`, Positive: green-500, Negative: red-500
- Font: Inter (400/500/600/700), shadcn/ui components, Lucide icons
- Tables use heatmap cells (green gradient for positive, red for negative margins)
- Sidebar: `bg-[#1e3a5f]`, collapsible (`w-64` → `w-16`)
- No CRUD buttons anywhere — only filters, tabs, navigation, export

Full design tokens: `docs/DESIGN-SYSTEM.md`

## API Integration

- Base URL configured via `VITE_API_BASE_URL` in `.env`
- Auth: `CHAVE` query parameter on all requests (integration key per business unit)
- Pagination: cursor-based with `ultimoCodigo` + `limite` params
- Common params: `empresaCodigo`, `dataInicial` (yyyy-MM-dd), `dataFinal` (yyyy-MM-dd)

Full API details and endpoint mapping: `docs/API-GUIDELINES.md`

## Documentation

All project docs live in `docs/` — see `docs/README.md` for the full index. Key files: `docs/PRD.md` (product requirements), `docs/TASKS.md` (sprint tasks).