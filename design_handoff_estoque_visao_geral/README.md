# Handoff: Redesign da aba "Visão Geral" (Estoques)

> **Prompt pronto pro Claude Code (VS Code).** Cole a seção [▶ Prompt](#-prompt-para-o-claude-code) e anexe as 4 imagens em `screenshots/`. O restante é a especificação completa.

---

## ▶ Prompt para o Claude Code

> Redesenhe a aba **"Visão Geral"** do módulo **Estoques** (`src/pages/Estoques/components/abas/EstoqueVisaoGeral.tsx`), mantendo todo o conteúdo atual e seguindo os padrões do projeto (React + TS + Tailwind + shadcn + TanStack Query + Zustand, **somente GET / read-only**).
>
> Mudanças: (1) **visual mais limpo** — trocar os cards com gradiente por cards sólidos no padrão do design system, com um **hero navy** para o valor em estoque (capital parado); (2) **sparkline + variação %** no hero (tendência do valor em estoque nos últimos 6 meses); (3) **Curva ABC** (concentração de valor por classe A/B/C); (4) **Capital girando vs. parado** (quanto do valor tem giro saudável / lento / sem movimento); (5) **Valor por categoria** (maiores categorias por capital); (6) **alarmes e barras clicáveis** que navegam pras abas filtradas via o `onNavigateTab` já existente.
>
> O layout-alvo está nas 4 imagens anexas e no protótipo `Estoque Visao Geral.dc.html`. **As imagens e o HTML são REFERÊNCIA de design** — recrie no codebase reaproveitando o hook `useEstoqueAnalytics` (que já entrega tudo) e os componentes existentes; não copie o HTML.
>
> **Read-only:** filtro de saldo, janela (30/60/90) e navegação são estado de UI / props; todos os números derivam do `useEstoqueAnalytics`. Nenhum `useMutation`.

---

## Visão geral

A Visão Geral é o painel de entrada do módulo Estoques: resume saldo, capital parado, alarmes (negativo/ruptura/necessidade) e o que vai zerar. O redesign mantém tudo isso, moderniza o visual e acrescenta três leituras analíticas que faltavam ao gestor: **tendência do capital**, **Curva ABC** e **capital girando vs. parado**, além de **valor por categoria**.

## Sobre os arquivos deste bundle

São **referência de design feita em HTML** — protótipo do visual/comportamento, **não** código de produção. Recrie no codebase Visor360 (React + TS + Tailwind + shadcn/ui) reaproveitando `useEstoqueAnalytics` e os componentes existentes.

## Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento e estados seguem `docs/DESIGN-SYSTEM.md`.

---

## Onde implementar (arquivos a tocar)

| Arquivo | Mudança |
|---|---|
| `src/pages/Estoques/components/abas/EstoqueVisaoGeral.tsx` | Redesign completo (cards sólidos + hero navy + sparkline + Curva ABC + Capital girando/parado + Valor por categoria + alarmes clicáveis). Continua recebendo `data`, `categorias`, `janelaDias`, `onNavigateTab`. |
| `src/pages/Estoques/hooks/useEstoqueAnalytics.ts` | *(se necessário)* expor derivados agregados que o componente vai consumir — ver "Estado / Dados". A maioria já existe por produto; o componente agrega. |

> **Dados (read-only):** tudo vem de `useEstoqueAnalytics(coberturaDias, janelaDias)` — por produto já há `saldoAtual`, `valorEstoque`, `categoria`, `giroJanela`, `mediaDiariaVendas`, `diasCobertura`, `necessidadeStatus`, `estoqueMedioJanela`, etc. O componente deriva: totais, ABC (ordena por `valorEstoque` e acumula até 80%/95%), capital girando/lento/parado (por `giroJanela`/`necessidadeStatus`), valor por categoria (agrupa por `categoria`), e a tendência (a partir do histórico mensal de estoque já buscado).

---

## Telas / Views

### Aba: Visão Geral (Estoques)
- **Propósito:** leitura rápida da saúde do estoque — capital, alarmes, concentração de valor e o que precisa de ação.
- **Largura de conteúdo:** `max-width: 1280px`, centralizado (`padding: 24px`, fundo `#f9fafb`).
- **Estrutura vertical** (gap `16px`):
  1. **Controles:** filtro de Saldo (esquerda) + Janela 30/60/90 + período (direita).
  2. **4 KPI cards:** Valor em estoque (hero navy + sparkline), Produtos, Unidades, Giro médio.
  3. **3 alarmes** clicáveis: Saldo negativo, Ruptura, Necessidade crítica.
  4. **(condicional) Curva ABC + Capital em estoque** (2 colunas).
  5. **(condicional) Vão zerar em breve + Valor por categoria** (2 colunas).

As seções 4 e 5 só aparecem com saldo positivo no escopo (filtros "Todo saldo"/"Com saldo"); em "Zerados"/"Negativos" elas somem (não fazem sentido).

Veja `screenshots/01-visao-geral.png`.

---

### Componente 1 — Controles

- **Saldo** (esquerda): label + segmented `Todo saldo / Com saldo / Zerados / Negativos` (ativo `#1e3a5f`/branco). Filtra todos os números da tela.
- **Janela** (direita): label com ícone + segmented `30/60/90 dias` + período (`DD/MM/AAAA a DD/MM/AAAA`, 11px `#9ca3af`). Afeta as métricas de volume (giro, média, cobertura).

### Componente 2 — KPI cards (4)

Card base `#fff` borda `#e5e7eb` radius 16 padding 20 shadow `0 1px 2px rgba(0,0,0,.04)`.

| # | Título | Valor (mock) | Visual |
|---|---|---|---|
| 1 | **Valor em estoque** (`Capital parado`) | `R$ 184.230` | Card **navy** gradient; ícone `dollar-sign`; **sparkline** (6 meses) `#93c5fd` + pill de variação `+2,2%` (`#6ee7b7`); rodapé "a custo médio · 6 meses · vs mês anterior". |
| 2 | **Produtos** | `342` | chip `#dbeafe`/`#2563eb`, ícone `package`. |
| 3 | **Unidades** (`Saldo somado`) | `18.470` | chip `#e0e7ff`/`#4f46e5`, ícone `boxes`. |
| 4 | **Giro médio** (`Janela Nd`) | `1,84` (30d) → escala com a janela | chip `#dcfce7`/`#16a34a`, ícone `refresh-cw`; sublabel "N sem movimento". |

Sparkline: `<svg viewBox="0 0 120 32"><polyline>` com pontos normalizados dos últimos 6 valores; só aparece com saldo positivo.

### Componente 3 — Alarmes (3, clicáveis)

Card horizontal: chip de ícone 44px + label uppercase + número grande (cor do tom) + sub + **chevron-right** à direita. `cursor:pointer` + hover (borda `#cbd5e1`, sombra mais forte). **Clique navega** (`onNavigateTab`): Saldo negativo → `geral`; Ruptura → `necessidade`; Necessidade crítica → `necessidade`.
- Saldo negativo: tom **danger** (`#fee2e2`/`#dc2626`, valor `#b91c1c`, borda `#fecaca`).
- Ruptura: tom **warning** (`#fef3c7`/`#d97706`, valor `#b45309`, borda `#fde68a`).
- Necessidade crítica: tom **danger**.

### Componente 4 — Curva ABC + Capital em estoque (2 colunas, condicional)

**Curva ABC** (esq.): título + barra empilhada (segmentos por **valor**: A `#1e3a5f` 79%, B `#3b82f6` 16%, C `#93c5fd` 5%) + 3 linhas: bolinha + `Classe X` + `N produtos · P%` + `R$ valor` + `valor%`. Story: ~18% dos produtos (A) = ~79% do valor.

**Capital em estoque** (dir.): título "Quanto do valor está girando vs. parado" + barra empilhada (Girando `#16a34a` 70%, Lento `#f59e0b` 18%, Parado `#ef4444` 12%) + 3 linhas: bolinha + label + sub (`giro saudável`/`giro baixo`/`sem movimento`) + `R$ valor` + `%`.

Veja `screenshots/02-abc-capital.png`. Derivar: ordenar produtos por `valorEstoque` desc para ABC; classificar por `giroJanela`/`necessidadeStatus` para girando/lento/parado.

### Componente 5 — Vão zerar + Valor por categoria (2 colunas, condicional)

**Vão zerar em breve** (esq.): top 3 por menor `diasCobertura` (com `saldo>0` e `mediaDiariaVendas>0`). Cada item: nº de dias grande (cor por urgência: <7 vermelho, <15 âmbar, senão neutro) + nome + barra (`dias/30`) + `saldo un. · venda/dia`.

**Valor por categoria** (dir.): top categorias por `valorEstoque` (barra relativa ao máximo + `R$ valor · %`). Paleta navy→azul.

Veja `screenshots/03-zerar-categoria.png`.

---

## Interações & Comportamento

- **Saldo / Janela:** estado de UI; recalculam KPIs, alarmes, ABC, capital, categorias, giro. Veja a janela 90d em `screenshots/04-janela-90d.png` (giro acumula).
- **Alarmes / (idealmente) barras de categoria:** clicáveis → `onNavigateTab(tab)`.
- **Condicionais:** ABC, Capital, Vão zerar e Categoria só com saldo positivo (Todo saldo / Com saldo).
- **Loading/Empty:** `TableSkeleton`/`KpiSkeleton`; `SelectCompanyState` (sem empresa).

## Estado / Dados

- **UI:** `saldoFiltro` (todos/comSaldo/zerado/negativo), `janelaDias` (30/60/90).
- **Derivados (de `useEstoqueAnalytics`):**
  - KPIs: `data.length`, Σ`saldoAtual`, Σ`valorEstoque`, média de `giroJanela`, nº `sem_movimento`.
  - Alarmes: nº `saldoAtual<0`; nº `saldoAtual===0 && vendasUltimos6m>0`; nº `necessidadeStatus∈{critico,negativo}`.
  - ABC: produtos ordenados por `valorEstoque` desc → acumular % até 80% (A) / 95% (B) / resto (C).
  - Capital girando/lento/parado: somar `valorEstoque` por faixa de `giroJanela` (saudável / baixo / `sem_movimento`).
  - Categoria: agrupar `valorEstoque` por `categoria`, top N + "Outros".
  - Tendência: série do valor de estoque por mês (do histórico já buscado) → sparkline + variação vs mês anterior.

## Design Tokens (resumo)

**Cores** — Navy `#1e3a5f`→`#27496f` · Accent `#2563eb` · texto `#111827`/secundário `#6b7280`/muted `#9ca3af` · borda `#e5e7eb`/divisor `#f3f4f6` · fundo `#f9fafb` · sidebar ativo `#e0f2fe`/`#0c4a6e`/barra `#0ea5e9`. Alarme danger `#dc2626`/`#fee2e2`/`#fecaca`; warning `#d97706`/`#fef3c7`/`#fde68a`. ABC `#1e3a5f`/`#3b82f6`/`#93c5fd`. Capital `#16a34a`/`#f59e0b`/`#ef4444`. Categorias `#1e3a5f`,`#2563eb`,`#3b82f6`,`#60a5fa`,`#93c5fd`,`#cbd5e1`. Sparkline `#93c5fd`, trend `#6ee7b7`.

**Tipografia** — Inter. KPI 30px/700 · alarme 26px/700 · seção 15px/600 · labels 11px/600 uppercase. `font-variant-numeric: tabular-nums` em números.

**Forma** — card radius 16 · pills/barras 999 (ABC/Capital stacked radius 6) · segmented 11 (botão 8) · padding card 20 · shadow `0 1px 2px rgba(0,0,0,.04)`.

**Ícones** — Lucide: `warehouse` (aba/header), `dollar-sign`, `package`/`boxes`, `refresh-cw`, `alert-circle`, `alert-triangle`, `shopping-cart`, `hourglass`, `bar-chart-3`, `chevron-right`.

## Dados de exemplo (mock do protótipo)

KPIs (Todo saldo, 30d): Valor `R$ 184.230` (+2,2%), Produtos `342`, Unidades `18.470`, Giro `1,84` (41 sem movimento). Alarmes: negativo `7`, ruptura `12`, crítica `23`.
ABC: A 62 prod (18%) = R$ 145.500 (79%) · B 106 (31%) = R$ 29.500 (16%) · C 174 (51%) = R$ 9.230 (5%).
Capital: Girando R$ 128.900 (70%) · Lento R$ 33.100 (18%) · Parado R$ 22.230 (12%).
Vão zerar: Coca-Cola Lata 350ml 3d (48 un · 16,0/dia) · Heineken Long Neck 330ml 5d · Água Mineral 500ml 11d.
Categorias: Bebidas R$ 62.400 (34%) · Tabacaria R$ 38.900 · Mercearia R$ 29.700 · Limpeza R$ 18.200 · Higiene R$ 12.800 · Outros R$ 22.230.
Filtros: "Negativos" → Valor `−R$ 1.180`, 7 produtos, −42 un, e oculta ABC/Capital/Vão zerar/Categoria. Janela 90d → giro `5,00`.

Todos os valores são placeholder — substituir pela saída do `useEstoqueAnalytics`.

## Assets

Nenhum asset proprietário. Ícones **Lucide React** e tipografia **Inter** já existem no projeto.

## Arquivos neste bundle

- `Estoque Visao Geral.dc.html` — protótipo interativo (filtro de saldo + janela).
- `screenshots/01-visao-geral.png` — controles + KPIs (hero com sparkline) + alarmes.
- `screenshots/02-abc-capital.png` — Curva ABC + Capital girando/parado.
- `screenshots/03-zerar-categoria.png` — Vão zerar + Valor por categoria.
- `screenshots/04-janela-90d.png` — janela de 90 dias (giro recalcula).
