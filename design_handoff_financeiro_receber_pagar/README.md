# Handoff: Redesign das abas "Receber" e "Pagar" (Financeiro)

> **Prompt pronto pro Claude Code (VS Code).** Cole a seção [▶ Prompt](#-prompt-para-o-claude-code) e anexe as imagens em `screenshots/`. As duas abas compartilham a **mesma estrutura** — este pacote cobre ambas.

---

## ▶ Prompt para o Claude Code

> Redesenhe as abas **"Receber"** (`src/pages/Financeiro/components/ReceivablesIntel.tsx`) e **"Pagar"** (`src/pages/Financeiro/components/PayablesIntel.tsx`) do módulo **Financeiro**, deixando-as com a **mesma estrutura visual** e seguindo os padrões do projeto (React + TS + Tailwind + shadcn + TanStack Query + Zustand, **somente GET / read-only**).
>
> Layout compartilhado (idêntico nas duas): (1) header "Inteligência de cobrança/pagamentos" + botão **Analisar** (toggle de painel de insights); (2) **4 KPI cards** — o 1º é um **hero navy** (Receber = "Carteira a receber"; Pagar = "Impacto no caixa") + 3 cards; (3) **linha de 3 gráficos**; (4) **2 cards** (ranking + heatmap/janela); (5) **tabela com abas** + **modal** ao clicar numa linha.
>
> O layout-alvo está nas imagens anexas (`receber-*`, `pagar-*`) e nos protótipos `Financeiro Receber.dc.html` / `Financeiro Pagar.dc.html`. **As imagens e o HTML são REFERÊNCIA de design** — recrie reaproveitando os componentes/cálculos que já existem (`ReceivablesIntel`/`PayablesIntel` já agregam tudo) e os modais `ClienteRiscoModal` / `FornecedorPagarModal`; não copie o HTML.
>
> **Read-only:** abas, filtros, análise e botão "cobrar" (link `wa.me`/`mailto`) são UI no cliente; tudo deriva do `useFinanceData`. Nenhum `useMutation`.

---

## Visão geral

Ambas as abas são **centros de inteligência** (cobrança / pagamentos) sobre os títulos em aberto. O redesign unifica o visual no padrão Visor360 e dá a elas a **mesma anatomia**, mudando só a semântica (receber ↔ pagar, cliente ↔ fornecedor, azul/verde ↔ vermelho).

## Sobre os arquivos deste bundle

São **referência de design feita em HTML** — protótipos do visual/comportamento, **não** código de produção. Recrie no codebase Visor360 reaproveitando os componentes e cálculos existentes.

## Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento e estados seguem `docs/DESIGN-SYSTEM.md`.

---

## Estrutura compartilhada (vale pras duas)

| Bloco | Receber | Pagar |
|---|---|---|
| **Header + Analisar** | "Inteligência de cobrança" + "Analisar carteira" | "Inteligência de pagamentos" + "Analisar contas a pagar" |
| **Painel de análise** (toggle) | insights de cobrança + recomendação | insights de pagamentos + recomendação |
| **KPI hero (navy)** | **Carteira a receber** (total + vencido/a vencer + inadimplência) | **Impacto no caixa** (saldo projetado + saldo atual/a pagar + band) |
| **KPI 2/3/4** | Em atraso · A vencer · Inadimplência (com aging mini-barra) | Em atraso · A pagar hoje · A vencer |
| **Gráfico 1** | A vencer por cliente (barras) | A vencer por fornecedor (barras) |
| **Gráfico 2** | Previsão de recebimento (30 dias, verde) | Calendário de desembolsos (30 dias, vermelho) |
| **Gráfico 3** | Faixa de atraso (stacked + legenda) | Participação no total (stacked + legenda) |
| **Card A** | Maiores devedores (ranking por vencido) | Maiores fornecedores (ranking por total) |
| **Card B** | Previsão por janela (verde) | Heatmap de vencimentos (vermelho) |
| **Tabela (abas)** | Em atraso · **Por cliente (score)** · Por vencimento | Em atraso · **Por fornecedor** · Por vencimento |
| **Modal** | `ClienteRiscoModal` (score + títulos) | `FornecedorPagarModal` (títulos) |

**Layout:** `max-width:1280px`, centralizado, `gap:16px`. KPIs `grid repeat(4,1fr)`; gráficos `repeat(3,1fr)`; cards `repeat(2,1fr)`.

Veja `screenshots/01-receber.png` / `01-pagar.png` (topo) e `02-*` (gráficos + ranking) e `03-receber.png` (tabela "Por cliente" com score + cobrar).

---

## Onde implementar (arquivos a tocar)

| Arquivo | Mudança |
|---|---|
| `src/pages/Financeiro/components/ReceivablesIntel.tsx` | Redesign no layout compartilhado. Cálculos (score, PMR, faixas, concentração, previsão) **permanecem**; só reorganiza a UI + hero navy + gráficos + ranking/janela + abas. Coluna **score** + **status** + **cobrar** na aba "Por cliente". |
| `src/pages/Financeiro/components/PayablesIntel.tsx` | Mesmo layout. Hero "Impacto no caixa". Cálculos (saldo projetado, concentração, desembolsos, heatmap, fornecedores) permanecem. |
| `ClienteRiscoModal.tsx` / `FornecedorPagarModal.tsx` | **Reaproveitados** — abrem ao clicar numa linha. |
| `useFinanceData.ts` | Sem mudança estrutural. |

> **Dados (read-only):** tudo já é derivado nos dois componentes a partir de `data` (títulos em aberto) + `pagos`/`saldoEmCaixa`. O **botão "cobrar"** (Receber) é link externo (`wa.me`/`mailto`) com nome + valor vencido — sem fetch novo. O **sparkline de inadimplência** foi **omitido** (sem série histórica); manter só a **mini-barra de aging** no KPI de inadimplência.

---

## Detalhes por bloco

### KPI hero (navy)
Card `background:linear-gradient(135deg,#1e3a5f,#27496f)`, radius 16, padding 20. Valor 28px/700; duas linhas auxiliares; rodapé com band (bolinha + texto).
- **Receber:** `R$ 240.900` · Vencido `R$ 40.700` (`#fca5a5`) / A vencer `R$ 200.200` · band âmbar "Inadimplência 16,9% · em atenção". Ícone `users`.
- **Pagar:** `+R$ 18.500` (`#fcd34d`) · Saldo atual `R$ 218.000` / A pagar `− R$ 199.500` (`#fca5a5`) · band âmbar "Caixa em atenção". Ícone `wallet`.

### KPIs 2–4
Cards brancos radius 16. Valor 22px/700. Receber: Em atraso (vermelho, borda `#fecaca`), A vencer (azul), Inadimplência (borda `#fde68a` + aging mini-barra 1–30 `#f59e0b`/31–60 `#ea580c`/60d+ `#dc2626`). Pagar: Em atraso, A pagar hoje (laranja, borda `#fed7aa`), A vencer.

### Gráficos (3)
Cards brancos radius 16, padding 18. (1) **barras horizontais** por cliente/fornecedor (`#2563eb`); (2) **mini-barras verticais** de 30 dias (verde `#16a34a` p/ receber, vermelho `#ef4444` p/ pagar) com baseline; (3) **barra empilhada + legenda** (faixa de atraso / participação) — cores navy→âmbar→laranja→vermelho (Receber) ou paleta categórica (Pagar `#1e3a5f`/`#2563eb`/`#7c3aed`/`#0891b2`/`#ea580c`/`#cbd5e1`).

### Ranking + Janela/Heatmap (2 cards)
Ranking: posição em círculo (1º destacado) + nome + sub (atraso/score ou %/vencido) + valor à direita. Janela/Heatmap: linhas Hoje/7/15/30/60 dias com barra (verde Receber / vermelho Pagar) + valor acumulado.

### Tabela com abas + modal
Header com segmented (`Em atraso · Por cliente|fornecedor · Por vencimento`, ativo navy) + contador. Linhas zebra, hover `#eff6ff`, clicáveis → modal. **Receber "Por cliente":** Cliente · Em aberto · Vencido (vermelho) · Atraso · **Score** (bolinha+nº pela faixa) · **Status** (badge) · **Ação** (botão "cobrar" verde só em vencidos, `stopPropagation`). **Pagar "Por fornecedor":** Fornecedor · Títulos · Vencido · A vencer · Total · Participação. Abas de título: documento, vencimento (vermelho se vencido), valor, atraso, status.

Modal: header (nome + badge total/score), 3 stats, lista de títulos (doc · venc · status · valor).

---

## Interações & Comportamento
- **Analisar:** toggle do painel de insights (regras sobre dados reais).
- **Abas da tabela:** estado de UI; trocam o conteúdo. Default = "Em atraso".
- **Linha → modal**; **cobrar** (Receber) não abre o modal (stopPropagation) e dispara link externo.
- **Loading/Empty:** skeletons; estados vazios preservados.

## Design Tokens (resumo)
Navy `#1e3a5f`→`#27496f` · texto `#111827`/`#6b7280`/`#9ca3af` · borda `#e5e7eb`/`#f1f3f5` · hover `#eff6ff`. Receber positivo `#16a34a`/`#047857`; Pagar negativo `#ef4444`/`#b91c1c`. Vencido `#b91c1c`/`#fee2e2`; a vencer/em dia `#15803d`/`#dcfce7`; atenção `#b45309`/`#fef3c7`; hoje/laranja `#c2410c`/`#ffedd5`. Aging `#f59e0b`/`#ea580c`/`#dc2626`. Análise índigo `#4f46e5`/`#eef2ff`. Score: ≥70 `#15803d`, 40–69 `#b45309`, <40 `#b91c1c`.
Inter; KPI hero 28px/700 · KPI 22px/700 · seção 14px/600 · tabela 13px · labels 10–11px/600 uppercase; `tabular-nums`. Card radius 16, pills 999, shadow `0 1px 2px rgba(0,0,0,.04)`, modal `0 24px 64px rgba(0,0,0,.28)`.
Ícones Lucide: `sparkles`, `users`/`truck`, `wallet`/`wallet-cards`, `calendar`, `clock`, `alert-triangle`, `percent`, `banknote`, `message-circle` (cobrar), `x`.

## Dados de exemplo (mock dos protótipos)
**Receber:** carteira `R$ 240.900` (vencido 40.700 / a vencer 200.200) · inadimplência 16,9% · em atraso 40.700 (14 cli/23 tít) · a vencer 200.200 (88) · previsão 7d 18.400 / 30d 52.600. Clientes com score: Transportes Almeida 38.400/11.600/47d/score 32 · Frota Rápida 14.200/2.900/95d/28 · Construtora Vega 22.100/5.000/22d/58 · Mercado União 12.700/3.700/12d/61 · Auto Posto Silva 18.900/6.800/8d/64 · Padaria Estrela 5.600/1.200/5d/70 · Locadora Veloz 8.300/0/82 · Restaurante Bom Sabor 9.800/0/88 · Oficina Central 4.100/0/91.
**Pagar:** saldo atual `R$ 218.000` − a pagar `R$ 199.500` = projetado `+R$ 18.500` (atenção) · em atraso 41.200 (8 tít/5 forn) · hoje 6.800 · a vencer 151.500 · 7d 33.900 / 30d 98.400. Fornecedores: Distribuidora BR 84.000 (22.000 venc) · Ipiranga 34.000 (7.500) · Bebidas Sul 22.000 (5.200) · CEMIG 14.000 · ServiTI 11.000 (3.100) · Outros 34.500.

Todos os valores são placeholder — substituir pela saída do `useFinanceData`.

## Assets
Nenhum asset proprietário. Ícones **Lucide React** e tipografia **Inter** já existem. Modais existentes reaproveitados.

## Arquivos neste bundle
- `Financeiro Receber.dc.html` · `Financeiro Pagar.dc.html` — protótipos interativos (analisar, trocar abas, clicar nas linhas).
- `screenshots/01-receber.png` / `01-pagar.png` — topo (header + Analisar + KPIs/hero).
- `screenshots/02-receber.png` / `02-pagar.png` — gráficos + ranking + janela/heatmap.
- `screenshots/03-receber.png` — tabela "Por cliente" (score + status + cobrar).
