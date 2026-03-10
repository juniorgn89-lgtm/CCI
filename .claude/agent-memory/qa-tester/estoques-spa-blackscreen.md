# Estoques Black Screen — SPA Navigation Analysis
Date: 2026-03-10
Commit: HEAD (e8eacd2)

## Reproduction Steps
1. Login with admin/admin123
2. Select any empresa from the company filter
3. Navigate to Dashboard or Produtos and wait for data
4. Click "Estoques" in the sidebar
5. Observe: black/blank screen for ~200ms or longer on slow machines

## Why Full Reload Does NOT Reproduce
On full reload, `empresaCodigo = null` (Zustand store is in-memory, not persisted).
Estoques renders `<SelectCompanyState />` (no animate-fade-in content).
User selects company. `useStockData` fires queries with `isLoading = true`.
Skeleton renders (visible). Data loads. Skeleton replaced with content. No black flash.

## Root Cause A — CRITICAL: animate-fade-in + keepPreviousData interaction

### File: src/pages/Estoques/index.tsx, line 55
```tsx
<div className="animate-fade-in space-y-6">
```

### File: src/pages/Estoques/hooks/useStockData.ts, lines 108-128
```ts
placeholderData: keepPreviousData,  // applied to both queries
```

### File: src/components/layout/AppLayout.tsx, line 81
```tsx
<ErrorBoundary key={pathname}>
  <Outlet />
</ErrorBoundary>
```

### Mechanism:
1. User navigates away from Estoques after data loaded successfully.
2. TanStack Query cache has data for `['produtoEstoque', empresaCodigo]` and
   `['estoquePeriodo', empresaCodigo, dataFinal]`.
3. User clicks "Estoques" in sidebar.
4. `key={pathname}` changes → React destroys old `<Estoques />` and mounts a new one.
5. `useStockData` mounts. Both queries have cached/placeholder data → `isLoading = false`.
6. `computed` useMemo runs immediately. `hasEmpresa = true`.
7. Estoques returns JSX with `hasEmpresa=true` → renders the full content block.
8. React renders the full content inside `<div className="animate-fade-in space-y-6">`.
9. CSS: `animation: fade-in 0.2s ease-out forwards` starts → `opacity: 0` → `opacity: 1`.
10. During those 200ms, the ENTIRE content area (KPIs, tabs, table) is invisible.
11. On a fast browser: barely noticeable. On slow paint: looks like a "black screen" for 0.5–1s.

### Contrast with fresh load (no cached data):
- `isLoading = true` → skeleton renders at full opacity (no animate-fade-in on skeletons).
- Users see the skeleton, then content fades in — smooth UX.

### Why this is worse on SPA navigation vs. initial mount:
- Initial mount (after login): no cached Estoques data. `isLoading = true`. Skeleton visible.
- SPA nav with cached data: `isLoading = false`. `keepPreviousData` returns stale data.
  Full content renders at opacity:0. 200ms of invisible content.

## Root Cause B — ALTO: AppLayout main onClick incorrectly collapses sidebar

### File: src/components/layout/AppLayout.tsx, line 79
```tsx
<main
  role="main"
  className="flex-1 overflow-y-auto p-4 md:p-6"
  onClick={() => { if (!collapsed) setCollapsed(true) }}
>
```

Every click anywhere inside the main content area collapses the sidebar when it's expanded.
This means:
- Clicking any Estoques tab (Posição, Movimentação, Alertas, Histórico) collapses the sidebar.
- Clicking table sort headers collapses the sidebar.
- Clicking pagination buttons collapses the sidebar.
- Clicking search inputs collapses the sidebar.
This is clearly unintended. The auto-collapse should only trigger on navigation, not content interaction.

## Proposed Fixes (for the responsible development agent)

### Fix A — Remove animate-fade-in from Estoques page content root
OR skip the fade animation when `isLoading = false` (data from cache):

```tsx
// Option 1: remove animation entirely from Estoques
<div className="space-y-6">

// Option 2: conditional — only animate on fresh load, not cached data
<div className={cn('space-y-6', !hasStaleData && 'animate-fade-in')}>

// Option 3: apply animate-fade-in only to skeleton, not to data content
// This gives the perception of smooth loading without the invisible content flash
```

### Fix B — Remove main onClick or restrict it to outside-clicks only
The auto-collapse feature should be removed from the `<main>` element entirely.
If the intent is "click outside sidebar to close it on mobile", use a proper overlay:

```tsx
// Remove this:
onClick={() => { if (!collapsed) setCollapsed(true) }}

// Mobile close is handled by the Sheet (mobile sidebar) which has its own overlay.
// Desktop sidebar collapse belongs only in the toggle button in <Sidebar />.
```

## Additional Notes
- The `animate-fade-in` issue affects ALL modules, not just Estoques, since all pages
  using the same pattern will show the same 200ms invisible flash on SPA navigation.
- Estoques is specifically mentioned because it's the most visible: it has the most
  content to render (KPIs + tabs + table) so the blank duration is perceptible.
- The main onClick issue affects ALL modules equally.
- ErrorBoundary is NOT the cause — it renders `<ErrorState>` with white background.
  A true crash would show a white error card, not a black screen.
