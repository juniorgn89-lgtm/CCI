---
name: produtividade-module
description: Data sources, files, and conventions for the Produtividade module (frentistas + vendedores)
metadata:
  type: project
---

# Produtividade module

Orchestrated by `src/pages/Produtividade/index.tsx` (NOT `Operacao/index.tsx` — that file does not exist). It renders `<ProdutividadeTab>` (frentistas mode) or `<VendedoresConveniencia>` (vendedores mode), with sub-tabs Visão Geral / Projeções / Metas / Destaques living in `Operacao/components/produtividade/`.

**Why:** Edited 2026-06-17 per a multi-item correction request.

**How to apply:**
- Fuel rows: `useOperacaoData` (abastecimentoRows, frentistaRows/Prev). Per-row financials (custo/lucro/margem/`vendaItemCodigo`) come from `useAbastecimentosAnalytics` rows (`abastComCusto`), passed through ProdutividadeTab.
- Loja/conveniência vendedor productivity: `useVendedoresConveniencia` → cache `apuracao_vendas_funcionario` (loja sectors only, NOT combustível).
- `Funcionario` type HAS `dataAdmissao` (yyyy-MM-dd, may be ''). Hook `useFuncionariosAdmissao` reuses queryKey `['funcionarios', empresaCodigo]` (React Query dedupes) — base of "novato" detection (90-day window). When all admissions are empty, omit the novato table and show a limitation note.
- Manual metas persist via `useMetasStore` (zustand persist → localStorage `visor360-metas`, flat `Record<funcionarioCodigo, litrosMeta>`). READ-ONLY rule allows localStorage. `ProdutividadeMobile` still uses store `manualMode`/`setManualMode`.
- `abastDateMode` (Abast/Fiscal/Movimento) is in the filters store; Produtividade now forces `'ABAST'` on mount (frentista base) — the toggle UI was removed.
- Pró-rata projection = realizado / diasDecorridosNoMes × diasNoMes (mês fechado → factor 1).
