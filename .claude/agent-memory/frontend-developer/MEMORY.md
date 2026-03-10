# Frontend Developer Agent Memory

## Project Structure
- Filter store: `src/store/filters.ts` — exports `useFilterStore` with `empresaCodigos: number[]`, `dataInicial: string`, `dataFinal: string`
- Setters: `setEmpresas(codigos: number[])`, `setPeriodo(dataInicial, dataFinal)`
- `useFilters` hook (`src/hooks/useFilters.ts`) wraps store + queryClient.invalidateQueries; exposes `empresaCodigos`, `empresaCodigo` (derived: first or null), `setEmpresas`, `setPeriodo`
- Formatters: `src/lib/formatters.ts` — `formatCurrency`, `formatNumber`, `formatPercent`, `formatDate`, `formatLiters`, `formatCurrencyShort`, `formatLitersShort`, `formatCurrencyTooltip`
- `src/lib/utils.ts` exports `cn()` (clsx + tailwind-merge)
- Pagination helper: `src/api/helpers/fetchAllPages.ts` — `fetchAllPages<T>(fetchFn, limite, maxPages)` returns `T[]`

## Multi-Empresa Selection (implemented)
- Store holds `empresaCodigos: number[]` (empty = no selection, shows "Selecione uma empresa")
- CompanySelect uses DropdownMenu with DropdownMenuCheckboxItem for multi-select
- All hooks derive `empresaCodigo = empresaCodigos[0] ?? null` locally for single-value API calls
- `hasEmpresa = empresaCodigos.length > 0` replaces old `!!empresaCodigo` checks
- Dashboard filters client-side with `empresaCodigos.includes(item.empresaCodigo)` for multi-empresa
- API endpoints that accept arrays (vendaResumo, lmc, dre filiais, relatorios filial) get full `empresaCodigos`
- API endpoints that accept single value get `empresaCodigo` (first from array)

## Dashboard Layout Store
- `src/store/dashboardLayout.ts` — `useDashboardLayoutStore` with Zustand `persist` middleware
- Sections: `summary`, `sectorKpis`, `sectorDetails` — each has `id`, `label`, `visible`
- Actions: `toggleVisibility`, `moveUp`, `moveDown`, `reset`
- localStorage key: `ccisga-dashboard-layout`, version: 1, with migration for future sections
- Settings panel: `src/pages/Dashboard/components/DashboardSettings.tsx` (Sheet slide-out)

## Estoques Module
- Page: `src/pages/Estoques/index.tsx` — tabs: posicao, movimentacao, alertas, historico, analise
- Hooks: `useStockData.ts` (main data), `useStockAnalysis.ts` (analysis tab)

## Patterns
- `fetchAllPages` wraps paginated endpoints
- Reference data (produtos, grupos) uses `staleTime: 30 * 60 * 1000` and shared cache keys
- All empresa-dependent queries use `enabled: hasEmpresa` (where `hasEmpresa = empresaCodigos.length > 0`)
- `keepPreviousData` imported from `@tanstack/react-query` (not from options)

## CSV Export Feature
- Utility: `src/lib/exportCsv.ts` — `exportToCsv<T>(filename, data, columns)`
- Button: `src/components/tables/ExportButton.tsx`

## API Types
- `ProdutoEstoque`: has `saldoEstoque: SaldoEstoque[] | null` and fallback `saldo`
- `EstoquePeriodo`: uses `codigoProduto`, `quatidadeEstoque` (typo in API), `dataMovimento`
- `fetchVendaItens` params: `empresaCodigo, dataInicial, dataFinal, usaProdutoLmc, ultimoCodigo, limite, tipoData, vendaCodigo`

## Notification/Alert System
- Store: `src/store/notifications.ts` — `useNotificationStore` with `alerts`, `setAlerts`, `markAsRead`, `markAllAsRead`, `unreadCount`
- Generator: `src/hooks/useAlertGenerator.ts` — reads TanStack Query cache every 60s, generates alerts from estoque/financeiro/combustivel data
- UI: `src/components/layout/NotificationBell.tsx` — Bell icon with badge + DropdownMenu, placed in Header before theme toggle
- Alert types: `AppAlert` with `id`, `category`, `severity` (danger/warning/info), `title`, `description`, `timestamp`, `read`
- Alert IDs are deterministic (e.g. 'estoque-zero', 'financeiro-overdue-receber') for deduplication
- Read state preserved across regeneration cycles via `setAlerts` merging

## Available shadcn/ui Components
badge, button, card, dropdown-menu, input, select, separator, sheet, skeleton, table, tabs
- DropdownMenu includes DropdownMenuCheckboxItem (used for CompanySelect multi-select)
- No popover or checkbox component installed
