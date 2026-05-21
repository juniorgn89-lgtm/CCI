# QA Tester Memory — Visor360

## Key Findings

### Estoques Blank Screen — Root Cause (RESOLVED in HEAD e8eacd2)
Two bugs caused the blank/black screen on /estoques on initial load:

1. **NULL CRASH** in old `useStockData.ts`: `pe.saldoEstoque.length` threw when API returned
   `saldoEstoque: null`. Fixed in HEAD with `if (pe.saldoEstoque && pe.saldoEstoque.length > 0)`.

2. **ANIMATION BUG** in old `tailwind.config.ts`: `animate-fade-in` without `forwards`
   fill-mode. Fixed in HEAD by adding `forwards` to the animation value.

### Estoques Black Screen — SPA NAVIGATION (NEW BUG, 2026-03-10, still present in HEAD)
Steps: login → select company → navigate to another module → click Estoques in sidebar → black screen.
Full reload does NOT reproduce. See `estoques-spa-blackscreen.md` for full analysis.

**Root cause A — CRÍTICO (UX)**: `animate-fade-in` starts at `opacity: 0`. On SPA navigation,
`ErrorBoundary key={pathname}` remounts the Estoques component from scratch on every visit.
With `keepPreviousData`, `isLoading = false` immediately (placeholder data from prior query),
so full content renders at `opacity: 0` and fades in over 200ms. No skeleton buffer. The 200ms
of invisible content reads as "black screen" to users, especially on slower machines.

**Root cause B — ALTO (UX)**: `<main onClick={() => { if (!collapsed) setCollapsed(true) }}>` in
AppLayout.tsx line 79 collapses the sidebar on ANY click inside the content area, including tab
buttons, sort headers, and pagination. This is the wrong event target for auto-collapse behavior.

**Why full reload works**: On reload, `empresaCodigo = null` initially, so `SelectCompanyState`
shows (no `animate-fade-in` content), user selects company, then data loads with a visible skeleton.
No instant `opacity: 0` content flash occurs.

### empresaCodigo Initial State (CURRENT BEHAVIOR in HEAD)
- `src/store/filters.ts` initializes `empresaCodigo: null` — no auto-select on app load.
- CompanySelect no longer has "Todas as empresas" option (removed in HEAD). Value is `''` when null.
- PRODUTO_ESTOQUE and ESTOQUE_PERIODO queries both have `enabled: !!empresaCodigo` guard in HEAD.
- When no empresa selected: `hasEmpresa=false`, Estoques shows `<SelectCompanyState />` empty state.
- Same pattern in Produtividade module (uses `useProductivityData`).

### CompanySelect Behavior (CURRENT in HEAD)
- Default value shown to user: empty/unselected state (empresaCodigo = null, value = '')
- No "Todas as empresas" option exists anymore.
- User MUST select an empresa for any data to load in Estoques, Produtividade.
- `handleChange` calls `setEmpresa(Number(value))` — if value is '' this sets 0 (falsy, treated as null).

### Prefetch Pattern
- `usePrefetch` in AppLayout fires on mount: produtos, grupos, empresas, funcionarios, bombas, bicos.
- `useModulePrefetch` fires when empresaCodigo/dates change: prefetches all module data.
- useStockData reads produtos/grupos from cache via useQuery (shared query keys) — not directly from cache.

### Module File Locations
- Estoques page: `src/pages/Estoques/index.tsx`
- Estoques hook: `src/pages/Estoques/hooks/useStockData.ts`
- Estoques API: `src/api/endpoints/estoques.ts`
- Estoques types: `src/api/types/estoque.ts`
- Filter store: `src/store/filters.ts`
- Filter hook: `src/hooks/useFilters.ts`
- CompanySelect: `src/components/filters/CompanySelect.tsx`
- AppLayout: `src/components/layout/AppLayout.tsx`

### App Startup
- Credentials: `VITE_APP_USER=admin`, `VITE_APP_PASSWORD=admin123`
- Dev server: `http://localhost:5173`
- Auth: `sessionStorage.getItem('app_authenticated') === 'true'`
- Auth uses local credentials from env, not API auth endpoint.
- ErrorBoundary IS present in AppLayout.tsx with `key={pathname}`. Renders ErrorState (white bg).
  If ErrorBoundary catches a crash, user sees a white card with error message, not a black screen.
  True black screen = animate-fade-in opacity:0 issue, not a JS crash.

### READ-ONLY Compliance
- `src/api/client.ts` has interceptor that blocks all non-GET requests at the axios level.
- No `useMutation` used anywhere. Only `useQuery` and `queryClient.prefetchQuery`.

## Patterns to Watch
- `ErrorBoundary key={pathname}` causes full unmount/remount of entire page subtree on every SPA nav.
  This means all component state is reset and `animate-fade-in` replays on every navigation.
- `keepPreviousData` in useStockData skips the loading skeleton when stale data exists. Combined
  with `animate-fade-in`, full content renders at opacity:0 — appears as black/blank flash.
- `main onClick` in AppLayout collapses sidebar on ANY content click. Bug affects all modules.
- CompanySelect value='' with no matching SelectItem may cause Radix Select quirks (not a crash).
- `animate-fade-in` requires `forwards` fill-mode to stay visible — fixed in tailwind.config.ts.
- Modules requiring empresa selection to show data: Estoques, Produtividade.
- Modules that work without empresa: Dashboard, Combustiveis, Conveniencias, Financeiro, Produtos.
