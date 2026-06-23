# Handoff: Redesign da aba "Receber" (Financeiro · Inteligência de Cobrança)

> **Prompt pronto pro Claude Code (VS Code).** Cole a seção [▶ Prompt](#-prompt-para-o-claude-code) e anexe as 4 imagens em `screenshots/`. O restante é a especificação completa.

---

## ▶ Prompt para o Claude Code

> Redesenhe a aba **"Receber"** do módulo **Financeiro** (`src/pages/Financeiro/components/ReceivablesIntel.tsx`), mantendo o conteúdo atual e seguindo os padrões do projeto (React + TS + Tailwind + shadcn + TanStack Query + Zustand, **somente GET / read-only**).
>
> Mudanças: (1) **visual mais limpo** no padrão do design system; (2) **cards de composição** (Notas não faturadas / Duplicatas / Faturados); (3) **7 KPIs** (atraso, a vencer, PMR, **inadimplência com sparkline + aging mini-barra**, previsão, clientes em risco, recuperação); (4) **Analisar carteira** (painel de insights automáticos); (5) **tabela de score de risco por cliente** com **filtros rápidos** (Todos/Vencidos/+90d/Em dia), **faixa de concentração (Pareto)**, **botão "cobrar"** nas linhas vencidas, e **modal de detalhe do cliente** ao clicar.
>
> O layout-alvo está nas 4 imagens anexas e no protótipo `Financeiro Receber.dc.html`. **As imagens e o HTML são REFERÊNCIA de design** — recrie no codebase reaproveitando o componente atual e seus cálculos (já existem: score, PMR, faixas de atraso, concentração, ranking) e o `ClienteRiscoModal`; não copie o HTML.
>
> **Read-only:** filtros, sub-abas, análise e botão "cobrar" (link `wa.me`/`mailto`) são UI no cliente; tudo deriva do `useFinanceData` / props. Nenhum `useMutation`.

---

## Visão geral

A aba Receber é um **centro de Inteligência de Cobrança**: separa o saldo a receber por instrumento, traz KPIs executivos, gera análise automática da carteira (regras sobre dados reais) e lista os clientes com **score de risco**. O redesign moderniza o visual e adiciona foco operacional: aging na inadimplência, filtros de risco, concentração (Pareto) e ação de cobrança por linha.

## Sobre os arquivos deste bundle

São **referência de design feita em HTML** — protótipo do visual/comportamento, **não** código de produção. Recrie no codebase Visor360 reaproveitando `ReceivablesIntel.tsx` (que já calcula tudo) e o `ClienteRiscoModal`.

## Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento e estados seguem `docs/DESIGN-SYSTEM.md`.

---

## Onde implementar (arquivos a tocar)

| Arquivo | Mudança |
|---|---|
| `src/pages/Financeiro/components/ReceivablesIntel.tsx` | Redesign visual: 3 cards de composição, 7 KPIs (inadimplência ganha sparkline + aging), painel de análise, sub-abas, tabela de score com filtros/Pareto/cobrar. A lógica de cálculo (score, PMR, faixas, concentração) **permanece**. |
| `src/pages/Financeiro/components/ClienteRiscoModal.tsx` | **Reaproveitar** — abre ao clicar na linha do cliente. |
| `src/pages/Financeiro/hooks/useFinanceData.ts` | Sem mudança estrutural (já entrega `receivablesAtraso`, `duplicatas`, `pagos`, `pmr`). |

> **Dados (read-only):** o componente já agrega de `data` (títulos a receber em aberto) + `pagos` (6m) + `duplicatas`: inadimplência, faixas de atraso (1–30/31–60/60+), previsão por janela, score por cliente, concentração de risco, recuperação. O **sparkline de inadimplência** precisa de série histórica — se não houver, derive dos pagos 6m (vencido/carteira por mês) ou omita. O **botão "cobrar"** é um link externo (`wa.me`/`mailto`) montado com o contato do cliente — read-only.

---

## Telas / Views

### Aba: Receber (Financeiro)
- **Propósito:** priorizar cobrança — quem deve, há quanto tempo, qual o risco, e agir.
- **Largura:** `max-width: 1280px`, centralizado.
- **Estrutura vertical** (gap `16px`):
  1. **Composição** (3 cards): Notas a prazo não faturadas, Duplicatas em aberto, Títulos a receber faturados.
  2. **Header "Inteligência de cobrança" + botão "Analisar carteira".**
  3. **(toggle) Painel de análise** automática + recomendação.
  4. **7 KPI cards.**
  5. **Sub-abas:** Carteira por cliente · Notas a prazo não faturadas.
  6. **Tabela de score de risco** (com Pareto + filtros + cobrar) **ou** tabela de notas.
  7. **Modal** de detalhe do cliente (ao clicar numa linha).

Veja `screenshots/01-visao-geral.png`.

---

### Componente — Composição (3 cards)
Cards brancos com borda colorida: Notas não faturadas (`#4338ca`, borda `#c7d2fe`) · Duplicatas (`#1d4ed8`, borda `#bfdbfe`) · Faturados (`#047857`, borda `#a7f3d0`). Cada um: título uppercase + subtítulo + valor 21px/700 + "N títulos em aberto".

### Componente — 7 KPI cards
Grid `repeat(4,1fr)` (quebra 4+3). Cada card: título 11px + chip de ícone 26px + valor 20px/700 + sub 11px.
1. **Títulos em atraso** `R$ 40.700` · 14 clientes · 23 títulos (ícone `alert-triangle` vermelho).
2. **Títulos a vencer** `R$ 200.200` · 88 · próx. 24/06 (`calendar` azul).
3. **PMR · atraso médio** `6 dias` · ↓ 2d vs trimestre ant. (`clock` violeta).
4. **Inadimplência** `16,9%` (vermelho) com **sparkline** (`#fca5a5`, tendência) + **aging mini-barra** 1–30 `#f59e0b` / 31–60 `#ea580c` / 60d+ `#dc2626` · meta 5%. Borda `#fde68a`.
5. **Previsão de recebimento** `R$ 52.600` + Hoje/7d/15d (`banknote-arrow` verde).
6. **Clientes em risco** `14` · 3 acima de 90d · 5 recorrentes (`users` rosa).
7. **Recuperação de crédito** `R$ 38.900` + pill `▲ 12%` (`rotate` teal).

Veja `screenshots/01-visao-geral.png`.

### Componente — Painel de análise (toggle "Analisar carteira")
Card índigo (`#eef2ff`→`#fff`, borda `#c7d2fe`): título "Análise da carteira" + lista de insights (bullets) + recomendação destacada. Gerado por regras sobre dados reais (não IA externa). Veja `screenshots/02-analise-carteira.png`.

### Componente — Tabela de score de risco (centerpiece)
Card branco. Header com:
- Título + contador de clientes.
- **Faixa de concentração (Pareto):** barra fina com 52% preenchido (`#b91c1c`) + texto "Concentração: 3 clientes = 52% do vencido".
- **Filtros rápidos** (chips): `Todos / Vencidos / +90 dias / Em dia` (ativo navy preenchido). Filtram a tabela.

Tabela: Cliente · Em aberto · Vencido (vermelho) · Atraso · Últ. pgto · **Score** (número + bolinha colorida pela faixa) · **Status** (badge) · **Ação** (botão "cobrar" verde com ícone, só em linhas vencidas; `stopPropagation` pra não abrir o modal). Linha clicável (zebra, hover `#eff6ff`) → modal.
- **Score band:** ≥70 verde `#15803d`, 40–69 âmbar `#b45309`, <40 vermelho `#b91c1c`.
- **Status:** Em dia (verde), Até 30d (âmbar), 31–90d (laranja `#c2410c`), +90d (vermelho).

Veja `screenshots/03-carteira-filtros.png`.

### Componente — Modal de detalhe do cliente
Reaproveitar `ClienteRiscoModal`. Header: nome + badge `score · faixa`. 3 stats (Em aberto / Vencido / Maior atraso). Lista de títulos em aberto (doc · venc · status badge · valor). Fecha no backdrop. Veja `screenshots/04-modal-cliente.png`.

---

## Interações & Comportamento

- **Analisar carteira:** toggle do painel de insights.
- **Sub-abas:** Carteira por cliente × Notas a prazo não faturadas.
- **Filtros rápidos:** Todos/Vencidos/+90d/Em dia (estado de UI) filtram a tabela.
- **Linha → modal** de detalhe; **botão cobrar** não abre o modal (stopPropagation), dispara link externo.
- **Loading/Empty:** skeletons; estados vazios "Nenhum título… 🎉".

## Estado / Dados

- **UI:** `analise` (painel), `sub` (carteira/notas), `cliente` (modal), `filtro` (todos/vencidos/mais90/emdia).
- **Derivados (já no componente atual):** inadimplência = vencido/carteira; aging por dias; previsão por janela; score por cliente (atraso + histórico de pontualidade + recorrência); concentração (~clientes que somam 40–52% do vencido); recuperação 30d; PMR (pagos 90d vs vencimento).

## Design Tokens (resumo)

**Cores** — Navy `#1e3a5f` · texto `#111827`/secundário `#6b7280`/muted `#9ca3af` · borda `#e5e7eb`/divisor `#f1f3f5` · hover `#eff6ff`. Score/status: verde `#15803d`/`#dcfce7`, âmbar `#b45309`/`#fef3c7`, laranja `#c2410c`/`#ffedd5`, vermelho `#b91c1c`/`#fee2e2`. Aging `#f59e0b`/`#ea580c`/`#dc2626`. Composição `#4338ca`/`#1d4ed8`/`#047857`. Análise índigo `#4f46e5`/`#eef2ff`. Cobrar `#15803d`/`#f0fdf4`/`#bbf7d0`.

**Tipografia** — Inter. KPI 20px/700 · composição 21px/700 · tabela 13px · labels 10–11px/600 uppercase. `tabular-nums` em números.

**Forma** — card radius 14–16 · pills/chips 999 (filtros 8) · barras 999 (aging stacked) · shadow `0 1px 2px rgba(0,0,0,.04)`.

**Ícones** — Lucide: `dollar-sign`, `sparkles` (analisar), `alert-triangle`, `calendar`, `clock` (PMR), `percent`, `banknote`, `users`, `rotate-ccw`, `message-circle`/`phone` (cobrar), `x`.

## Dados de exemplo (mock do protótipo)

Composição: Notas `R$ 84.200`/38 · Duplicatas `R$ 156.700`/64 · Faturados `R$ 62.300`/22.
KPIs: atraso `R$ 40.700` (14 cli/23 tít) · a vencer `R$ 200.200` (88, próx 24/06) · PMR `6d` (↓2d) · inadimplência `16,9%` (aging 54/30/16%) · previsão `R$ 52.600` (hoje 4,2K/7d 18,4K/15d 31,2K) · risco `14` (3 +90d, 5 recorrentes) · recuperação `R$ 38.900` (+12%).
Concentração: 3 clientes = 52% do vencido.
Clientes (nome · aberto · vencido · atraso · últ · score): Transportes Almeida 38.400/11.600/47d/12-04/32 · Frota Rápida 14.200/2.900/95d/15-03/28 · Construtora Vega 22.100/5.000/22d/28-05/58 · Mercado União 12.700/3.700/12d/20-05/61 · Auto Posto Silva 18.900/6.800/8d/02-06/64 · Padaria Estrela 5.600/1.200/5d/05-06/70 · Locadora Veloz 8.300/0/—/08-06/82 · Restaurante Bom Sabor 9.800/0/—/10-06/88 · Oficina Central 4.100/0/—/01-06/91.

Todos os valores são placeholder — substituir pela saída do `ReceivablesIntel`/`useFinanceData`.

## Assets

Nenhum asset proprietário. Ícones **Lucide React** e tipografia **Inter** já existem. Modal = `ClienteRiscoModal` existente.

## Arquivos neste bundle

- `Financeiro Receber.dc.html` — protótipo interativo (analisar, filtrar, clicar nas linhas).
- `screenshots/01-visao-geral.png` — composição + KPIs (inadimplência com sparkline/aging).
- `screenshots/02-analise-carteira.png` — painel de análise da carteira.
- `screenshots/03-carteira-filtros.png` — tabela de score com Pareto + filtros + cobrar.
- `screenshots/04-modal-cliente.png` — modal de detalhe do cliente.
