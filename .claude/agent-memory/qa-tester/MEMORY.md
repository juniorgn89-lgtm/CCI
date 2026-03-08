# QA Tester Memory — CCISGA

## Key Findings

### empresaCodigo Initial State (CONFIRMED ROOT CAUSE PATTERN)
- `src/store/filters.ts` initializes `empresaCodigo: null` — no auto-select on app load.
- `useStockData` (Estoques) has `enabled: !!empresaCodigo` on the PRODUTO_ESTOQUE query.
- `fetchEstoquePeriodo` has NO `enabled` guard — fires even with no empresa selected.
- Result: on fresh load with "Todas as empresas" selected, PRODUTO_ESTOQUE query is BLOCKED, ESTOQUE_PERIODO fires without `empresaCodigo`, data is empty, KPIs/table show zeros/empty.
- Same pattern in `useProductivityData` (Produtividade module).
- Fix needed: either auto-select first empresa on load, or show a "selecione uma empresa" empty state instead of silently showing nothing.

### CompanySelect Behavior
- Default value shown to user: "Todas as empresas" (empresaCodigo = null)
- No auto-selection logic exists anywhere in the codebase.
- User must manually pick an empresa for Estoques and Produtividade to load data.

### ESTOQUE_PERIODO: No empresa guard
- `fetchEstoquePeriodo` in useStockData has no `enabled` guard — fires unconditionally.
- Query includes `empresaCodigo: empresaCodigo ?? undefined`, so when null it sends no empresaCodigo param.
- API may return data for all empresas or empty, depending on backend behavior.

### Prefetch Pattern
- `usePrefetch` in AppLayout fires on mount: produtos, grupos, empresas, funcionarios, bombas, bicos.
- These populate queryClient cache under flat keys like `['produtos']`, `['grupos']`.
- useStockData reads produtos/grupos from cache via `queryClient.getQueryData` — if prefetch hasn't resolved yet, these are empty arrays and category names fall back to 'Outros'.

### Module File Locations
- Estoques page: `src/pages/Estoques/index.tsx`
- Estoques hook: `src/pages/Estoques/hooks/useStockData.ts`
- Estoques API: `src/api/endpoints/estoques.ts`
- Estoques types: `src/api/types/estoque.ts`
- Filter store: `src/store/filters.ts`
- Filter hook: `src/hooks/useFilters.ts`
- CompanySelect: `src/components/filters/CompanySelect.tsx`

### App Startup
- Credentials: `VITE_APP_USER=admin`, `VITE_APP_PASSWORD=admin123`
- Dev server: `http://localhost:5173`
- Auth uses local credentials from env, not API auth endpoint for browser-level login.

### READ-ONLY Compliance
- `src/api/client.ts` has interceptor that blocks all non-GET requests at the axios level.
- Login uses a separate auth flow (check `src/pages/Login/` and `src/api/endpoints/auth.ts`).

## Patterns to Watch
- Modules that guard on `!!empresaCodigo`: Estoques, Produtividade — will show empty silently if no empresa selected.
- Modules that do NOT guard: likely Dashboard, Combustiveis, Conveniencias, Financeiro — may handle "all empresas" scenario.
- Empty state messaging: StockTable shows "Nenhum produto encontrado" when data.length=0 — no distinction between "no empresa selected" vs "no data".
