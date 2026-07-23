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
- localStorage key: `visor360-dashboard-layout`, version: 1, with migration for future sections
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
- `/VENDA` (`Venda` type) has `clienteCodigo` + `clienteCpfCnpj` but NO client name. Nested `formaPagamento[]` (only populated when /VENDA queried BY vendaCodigo) carries `bandeira`, `gestora`, `tipoTransacao` (D/C).
- `/CARTAO` (`Cartao` type, `fetchCartao` in financeiro endpoints) is keyed by `vendaCodigo`; carries adquirente as `adiministradoraDescricao` (TYPO: 3 i's), plus `clienteRazao`, `codigoBandeira`. Best bridge for card adquirente/bandeira + client name for card sales.
- `/CLIENTE` endpoint: `src/api/endpoints/clientes.ts` (`fetchClientes`), type `src/api/types/cliente.ts` (`Cliente`: codigo, nome, cpfCnpj...). Params accept `clienteCodigo: number[]`. Created to resolve clienteCodigo→nome for non-card sales.

## Qualidade de Dados — preço anormal enrichment
- `useQualidadeDados.ts`: abast→venda bridge (vendaItemCodigo OR natural key empresa|bico|produto|qty.toFixed(3)|date) yields vendaCodigo per suspect.
- Adquirente + cliente: period `/CARTAO` query → map vendaCodigo→{adiministradoraDescricao, clienteRazao}. Non-card client names: dependent `/VENDA`-by-suspect-codes → clienteCodigo → dependent `/CLIENTE`. Outlier set is small so by-code fetch is cheap.

## Notification/Alert System
- Store: `src/store/notifications.ts` — `useNotificationStore` with `alerts`, `setAlerts`, `markAsRead`, `markAllAsRead`, `unreadCount`
- Generator: `src/hooks/useAlertGenerator.ts` — reads TanStack Query cache every 60s, generates alerts from estoque/financeiro/combustivel data
- UI: `src/components/layout/NotificationBell.tsx` — Bell icon with badge + DropdownMenu, placed in Header before theme toggle
- Alert types: `AppAlert` with `id`, `category`, `severity` (danger/warning/info), `title`, `description`, `timestamp`, `read`
- Alert IDs are deterministic (e.g. 'estoque-zero', 'financeiro-overdue-receber') for deduplication
- Read state preserved across regeneration cycles via `setAlerts` merging

## Central da Rede vs Vendas·Combustível — data sources (card/chart reconciliation)
- Central da Rede `/dashboard` LIVE surfaces ALL read from `useRedeSetores` (VENDA fiscal, ratio-of-totals): `ProjecoesPainel` (card "L. bruto / litro" = `combustivel.lucroPorUnidade`), `BenchmarkSetor` (table), `CentralMobile`. These are mutually consistent.
- `useDashboardData` is rendered ONLY by `BenchmarkPostos` (DEAD — never imported) and used by `useProjecaoMes`; on `/dashboard` index it's call-for-prefetch only. The Dashboard `*DetailModal` files (CombustivelDetailModal etc.) are MOCK-based (segmentMockHelpers) and NOT wired into live UI — dead code.
- Vendas·Combustível cards use `useFuelVendaAnalytics` (live VENDA_ITEM, period). `kpis.lbPorLitro/lucroBruto/margemPct` are ratio-of-totals over `rows`. The "Últimos 12 meses" charts use `useAbastecimentosAnalytics.lbLitroData` (Supabase apuração cache, 12-mo history) — different source AND window by design; do NOT force-merge.
- Vendas·VisaoGeral cards + margem bar chart BOTH read the same `segmentos` object — already consistent.
- RULE for per-litro / %margem: always ratio of displayed totals (Σlucro/Σlitros), never average of ratios, never a global KPI hardcoded into a filtered table total.

## Fechamento de Caixa module (data lives in useOperacaoData)
- Page `src/pages/FechamentoCaixa/`: index → VisaoGeral (desktop) or FechamentosMobile. ALL data from `useOperacaoData` (Operacao hook), not a local hook.
- "Conferência por PDV" UI = `src/pages/Operacao/components/ConferenciaPdv.tsx`; "Turnos" detail = `src/pages/Operacao/components/TurnoDetalheModal.tsx`; list = `TurnosTrabalho.tsx`. These Operacao files ARE part of the Fechamento feature.
- `useOperacaoData` returns `turnoRows` (per-caixa), `turnoGroups` (per turno+dia+pdv), `conferenciaPdv` (per-caixa apresentado×apurado×diferença por forma, from /CAIXA_APRESENTADO), `caixaResumo`, etc.
- PDV classification heuristic: caixa operator bombeou combustível no dia → 'Pista', senão 'Conveniência'. No API link abast→PDV.
- Frentistas (pista) come from abastecimentos cross-ref by frentista+time window. Vendedores de loja (conveniência) come from `apuracao_vendas_funcionario` cache (setor='conveniencia'), GRANULAR POR DIA × funcionário — NO caixa/PDV link. Attached to Conveniência PDV by DAY (same "balde do dia" limitation as formas de pagamento). Type `TurnoVendedor` on TurnoRow/TurnoGroup.
- `fetchVendasFuncionarioCache` (src/api/supabase/apuracao.ts) → `ApuracaoVendaFuncionarioRow[]` {empresa_codigo, data, funcionario_codigo, setor, faturamento, custo, quantidade, cupons}. Only closed days (Supabase cache); empty if rede não rodou apuração de vendas por funcionário.
- useCartaoBreakdown: 2-step /VENDA fetch (lista por período → detalhe por vendaCodigo p/ formaPagamento[]). DEDUP vendaCodigo in both steps to avoid double-count. Lines rounded to cents at source so footer total == visible sum (no penny drift).

## Financeiro Module
- [/CARTAO + /DUPLICATA fields](reference_cartao_duplicata_fields.md) — /CARTAO tem taxaPercentual (Taxa R$ = valor×taxa%/100, derivável) mas SEM valor líquido; /DUPLICATA pendente=em aberto; notas não faturadas = pendente+convertido=false.
- Filtro de período LOCAL: `PeriodFilterLocal.tsx` (toggle "Todo o período" + datas) + `useFinanceData(localPeriod)` recorta snapshot client-side por dataMovimento. Passar primitivos (lpAll/lpInicio/lpFim) nas deps do useMemo, não o objeto.
- Visão Geral: 3 cards de ênfase por saldo em aberto = `SaldoAbertoCards.tsx` (notas não faturadas / duplicatas em aberto / a pagar em aberto). Hook expõe `cardNotasNaoFaturadas`, `cardDuplicatasAberto`, `cardPagarAberto`, `duplicatasAberto`.
- CartoesIntel tem seletor de período (3/6/12/24 meses, state local `mesesJanela`); modal de detalhe mostra Taxa % e Taxa R$ separadas + tfoot com total/efetiva.

## Compliance ANP Module (margem regulatória, read-only spike)
- Page `src/pages/Compliance/index.tsx` + hook `hooks/useComplianceMargens.ts`. Reconstrói margem regulatória = placa (novoPrecoA de /TROCA_PRECO realizada) − CMP (Σqtd×precoCusto/Σqtd de /COMPRA_ITEM). Rede-wide cache, subset por scopedCodes.
- Placa/margem só fazem sentido com UM posto (`umPosto = scopedCount === 1`); com vários mostra só CMP consolidado.
- Seção "Indicadores históricos (365d)": série DIÁRIA margem(dia)=placa(dia)−cmpDiario(dia), janela FIXA [dataFinal−364..dataFinal] (independe do período do filtro). Queries hist gated `enabled: dataFinal && scopedCodes.length===1`, janelas troca −455d / compra −394d (buffers p/ forward-fill placa 90d + CMP trailing 30d).
- CMP diário = média ponderada das compras trailing-30d (sliding two-pointer; zera sumQty/sumCost quando janela vazia p/ evitar drift float); forward-fill; null antes da 1ª compra. Modelo v1 (custo por estoque = Fase 2).
- Indicadores: MM30/90/180/365 (trailingMean), mediana/P25/P75/min/max/stdPop (helpers puros no hook), alerta histórico = desvioVsMM90 c/ faixas fixas 20/40/70. Todos rotulados como v1, "não é veredito ANP".

## Available shadcn/ui Components
badge, button, card, dropdown-menu, input, select, separator, sheet, skeleton, table, tabs
- DropdownMenu includes DropdownMenuCheckboxItem (used for CompanySelect multi-select)
- No popover or checkbox component installed
