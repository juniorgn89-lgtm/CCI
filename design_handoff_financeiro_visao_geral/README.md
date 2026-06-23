# Handoff: Redesign da aba "Visão Geral" (Financeiro)

> **Prompt pronto pro Claude Code (VS Code).** Cole a seção [▶ Prompt](#-prompt-para-o-claude-code) e anexe as 4 imagens em `screenshots/`. O restante é a especificação completa.

---

## ▶ Prompt para o Claude Code

> Redesenhe a aba **"Visão Geral"** do módulo **Financeiro** (renderizada no `src/pages/Financeiro/index.tsx`, com os componentes `SaldoAbertoCards`, `TitulosEmAtraso`, `CartoesEModo`), mantendo o conteúdo atual e seguindo os padrões do projeto (React + TS + Tailwind + shadcn + TanStack Query + Zustand, **somente GET / read-only**).
>
> Mudanças: (1) **visual mais limpo** (cards sólidos no padrão do design system); (2) **hero navy "Posição líquida"** (a receber − a pagar) com variação vs mês anterior; (3) **Aging de vencidos** (1–30 / 31–60 / 60d+ para receber e pagar); (4) **Próximos vencimentos** (7/15/30 dias, a receber × a pagar) com alerta de caixa; (5) **Ciclo financeiro** (PMR × PMP) **no lugar do card "Cheques devolvidos"**, que deve ser **REMOVIDO** (vive sempre em "—", indisponível na integração).
>
> O layout-alvo está nas 4 imagens anexas e no protótipo `Financeiro Visao Geral.dc.html`. **As imagens e o HTML são REFERÊNCIA de design** — recrie no codebase reaproveitando o hook `useFinanceData` e os componentes existentes; não copie o HTML.
>
> **Read-only:** filtro de período é estado/props; todos os números derivam do `useFinanceData`. Nenhum `useMutation`.

---

## Visão geral

A Visão Geral do Financeiro resume o que está em aberto (receber/pagar), quem está em atraso e os recebíveis de cartão. O redesign moderniza o visual, adiciona um **hero de posição líquida**, e três leituras que faltavam: **aging** (idade do vencido), **próximos vencimentos** (risco de caixa) e **ciclo financeiro** (PMR×PMP). Remove o card morto de "Cheques devolvidos".

## Sobre os arquivos deste bundle

São **referência de design feita em HTML** — protótipo do visual/comportamento, **não** código de produção. Recrie no codebase Visor360 (React + TS + Tailwind + shadcn/ui) reaproveitando `useFinanceData` e os componentes existentes.

## Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento e estados seguem `docs/DESIGN-SYSTEM.md`.

---

## Onde implementar (arquivos a tocar)

| Arquivo | Mudança |
|---|---|
| `src/pages/Financeiro/index.tsx` | Bloco `activeTab === 'visao'`: nova composição (hero + 3 cards saldo, aging+próximos, títulos em atraso, cartões+ciclo). |
| `src/pages/Financeiro/components/SaldoAbertoCards.tsx` | Redesign visual + adicionar o **hero "Posição líquida"** (1º card navy) com variação. |
| `src/pages/Financeiro/components/CartoesEModo.tsx` | **Remover** o KPI "Cheques devolvidos"; no lugar, **Ciclo financeiro (PMR×PMP)**. |
| `src/pages/Financeiro/components/TitulosEmAtraso.tsx` | Reestilizar (cards mais limpos); lógica de ranking permanece. |
| **Novo** `AgingVencidos.tsx` + `ProximosVencimentos.tsx` | Aging buckets e próximos vencimentos (derivados do `useFinanceData`). |

> **Dados (read-only):** tudo de `useFinanceData(localPeriod)` — `kpis`, `receivablesAtraso`, `payablesAtraso`, `cardNotasNaoFaturadas`, `cardDuplicatasAberto`, `cardPagarAberto`, `pmr`, recebíveis de cartão, etc. **Aging:** agrupar vencidos por faixa de dias (`hoje − vencimento`). **Próximos vencimentos:** somar `a vencer` por janela (7/15/30d). **PMR** já existe; **PMP** deriva de forma análoga nos pagáveis.

---

## Telas / Views

### Aba: Visão Geral (Financeiro)
- **Propósito:** leitura rápida da saúde financeira — posição líquida, o que vence/venceu, quem deve, recebíveis de cartão.
- **Largura:** `max-width: 1280px`, centralizado (`padding: 24px`, fundo `#f9fafb`).
- **Estrutura vertical** (gap `16px`):
  1. **Controle:** "Saldo em aberto" (título) + filtro de período (`Todo o período ▾`).
  2. **4 KPI cards:** Posição líquida (hero navy), Notas a prazo não faturadas, Duplicatas em aberto, A pagar em aberto.
  3. **Aging de vencidos (1.5fr) + Próximos vencimentos (1fr).**
  4. **Títulos em atraso:** a receber (clientes) + a pagar (fornecedores).
  5. **Cartões e Apps a receber + Ciclo financeiro.**
  6. **Carteira de cartões/Apps a vencer + Modo de recebimento.**

Convenção de cor: vencido/falta vermelho (`#b91c1c`), a vencer/positivo verde (`#047857`), vencidas-amarelo (`#b45309`/`#f59e0b`). Veja `screenshots/01-visao-geral.png`.

---

### Componente 2 — KPI cards (4)

Card base `#fff` borda `#e5e7eb` radius 16 shadow `0 1px 2px rgba(0,0,0,.04)`.

| # | Card | Valor (mock) | Detalhe |
|---|---|---|---|
| 1 | **Posição líquida** (navy, `A receber − a pagar`) | `+R$ 42.400` (`#6ee7b7`) + pill `▲ +19%` | Linhas: A receber em aberto `R$ 240.900` / A pagar em aberto `R$ 198.500`; rodapé "R$ 81.900 vencidos no total". |
| 2 | **Notas a prazo não faturadas** | `R$ 84.200` (`#4338ca`) · 38 títulos | Split Vencidas `R$ 12.400` / A vencer `R$ 71.800`. |
| 3 | **Duplicatas em aberto** | `R$ 156.700` (`#1d4ed8`) · 64 | Split `R$ 28.300` / `R$ 128.400`. |
| 4 | **A pagar em aberto** (borda `#fecaca`) | `R$ 198.500` (`#b91c1c`) · 52 | Split `R$ 41.200` / `R$ 157.300`. |

Cada card 2–4: ponto amarelo "Vencidas" + ponto verde "A vencer" com valores.

### Componente 3 — Aging de vencidos + Próximos vencimentos

**Aging de vencidos** (esq.): legenda 1–30d `#f59e0b` / 31–60d `#ea580c` / 60d+ `#dc2626`. Duas linhas (A receber vencido `R$ 40.700`, A pagar vencido `R$ 41.200`), cada uma com **barra empilhada** (3 faixas por % do bucket) + os 3 valores embaixo. Receber: 22.000/12.300/6.400. Pagar: 18.500/14.200/8.500.

**Próximos vencimentos** (dir.): 3 linhas (7/15/30 dias) com `+R$ a receber` (verde) `/` `−R$ a pagar` (vermelho). Banner âmbar de alerta quando paga mais do que recebe na janela ("Em 7 dias, paga R$ 5.700 a mais…").

Veja `screenshots/02-aging-vencimentos.png`.

### Componente 4 — Títulos em atraso (2 cards)

Mantém o ranking atual (top N por valor), repaginado: header com ícone (clientes `users` azul / fornecedores `truck` vermelho), linhas com nome + coluna auxiliar (A faturar / Valor pago) + total + **barra** (azul receber / vermelha pagar), rodapé "Top 5 de N · Total/Saldo vencido". Veja `screenshots/03-titulos-atraso.png`.

### Componente 5 — Cartões a receber + Ciclo financeiro

**Cartões e Apps a receber:** `R$ 38.420` + líquido `R$ 36.910`, "142 recebíveis pendentes", ícone `wallet-cards` violeta.
**Ciclo financeiro** (substitui "Cheques devolvidos"): **PMR · receber** `28 dias` (verde) × **PMP · pagar** `35 dias` (âmbar), separados por divisória; nota "Recebe 7 dias antes de pagar — ciclo saudável" (verde se PMR<PMP, senão alerta). Veja `screenshots/04-cartoes-ciclo.png`.

### Componente 6 — Carteira a vencer + Modo de recebimento

Mantidos: tabela de carteira (tipo/descrição/valor + total) e barras por modalidade (Crédito `#2563eb`, Débito `#16a34a`, PIX `#0d9488`, Carteira Digital `#7c3aed`).

---

## Interações & Comportamento

- **Período:** filtro local (`Todo o período` default) reflete em todos os blocos.
- **Badges nas abas:** Receber/Pagar mostram nº de vencidos (vermelho) quando há.
- **Loading/Empty:** `TableSkeleton`; `SelectCompanyState` (sem empresa). Estados vazios "Nenhum título… 🎉" preservados.

## Estado / Dados

- **UI:** `localPeriod` (já existe no parent).
- **Derivados (de `useFinanceData`):** totais a receber/pagar em aberto e vencidos; posição líquida = receber − pagar; aging por faixa de dias de atraso; próximos vencimentos por janela; PMR/PMP; recebíveis de cartão (bruto/líquido), carteira a vencer, modo de recebimento.

## Design Tokens (resumo)

**Cores** — Navy `#1e3a5f`→`#27496f` · texto `#111827`/secundário `#6b7280`/muted `#9ca3af` · borda `#e5e7eb`/divisor `#f1f3f5`. Receber/positivo `#047857`/`#10b981`; pagar/negativo `#b91c1c`/`#ef4444`; vencidas `#b45309`/`#f59e0b`. Aging `#f59e0b`/`#ea580c`/`#dc2626`. Notas `#4338ca`/`#e0e7ff`; Duplicatas `#1d4ed8`/`#dbeafe`; cartões `#7c3aed`/`#ede9fe`. Hero positivo `#6ee7b7`.

**Tipografia** — Inter. Hero 28px/700 · KPI 22px/700 · seção 14–15px/600 · labels 10–11px/600 uppercase. `tabular-nums` em números.

**Forma** — card radius 16 · barras/pills 999 (aging stacked radius 6) · padding card 18–20 · shadow `0 1px 2px rgba(0,0,0,.04)`.

**Ícones** — Lucide: `dollar-sign`, `file-text`, `receipt-text`, `credit-card`, `users`, `truck`, `wallet-cards`, `clock` (ciclo), `triangle-alert`, `arrow-down-up`.

## Dados de exemplo (mock do protótipo)

Posição líquida `+R$ 42.400` (+19%); A receber em aberto `R$ 240.900`, A pagar `R$ 198.500`, vencido total `R$ 81.900`. Saldo: Notas `R$ 84.200` (12.400/71.800), Duplicatas `R$ 156.700` (28.300/128.400), A pagar `R$ 198.500` (41.200/157.300).
Aging receber: 22.000 / 12.300 / 6.400 (total 40.700). Aging pagar: 18.500 / 14.200 / 8.500 (total 41.200).
Próximos: 7d +18.400/−24.100 · 15d +31.200/−22.800 · 30d +52.600/−47.300.
Títulos receber (top 5 de 23): Transportes Almeida 11.600 (a faturar 8.400), Auto Posto Silva 6.800, Construtora Vega 5.000, Mercado União 3.700, Frota Rápida 2.900. Pagar (top 5 de 11): Distribuidora BR 22.000, Ipiranga Lubrificantes 7.500 (pago 2.000), Bebidas Sul 5.200, ServiTI 3.100, Limpeza Total 1.400.
Cartões a receber `R$ 38.420` (líquido 36.910, 142). Ciclo PMR 28d / PMP 35d. Carteira: Cielo 12.300, Rede 8.900, iFood 6.200, PicPay 3.100 (total 30.500). Modo: Crédito 21.400, Débito 12.800, PIX 9.600, Carteira Digital 4.200.

Todos os valores são placeholder — substituir pela saída do `useFinanceData`.

## Assets

Nenhum asset proprietário. Ícones **Lucide React** e tipografia **Inter** já existem.

## Arquivos neste bundle

- `Financeiro Visao Geral.dc.html` — protótipo de referência.
- `screenshots/01-visao-geral.png` — controle + KPIs (hero posição líquida).
- `screenshots/02-aging-vencimentos.png` — aging de vencidos + próximos vencimentos.
- `screenshots/03-titulos-atraso.png` — títulos a receber/pagar em atraso.
- `screenshots/04-cartoes-ciclo.png` — cartões a receber + ciclo financeiro (PMR/PMP).
