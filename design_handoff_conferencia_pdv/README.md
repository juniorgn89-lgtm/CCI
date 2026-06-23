# Handoff: Redesign da aba "Conferência por PDV" (Fechamento de Caixa)

> **Prompt pronto pro Claude Code (VS Code).** Cole a seção [▶ Prompt](#-prompt-para-o-claude-code) e anexe as 5 imagens em `screenshots/`. O restante é a especificação completa.

---

## ▶ Prompt para o Claude Code

> Redesenhe a aba **"Conferência por PDV"** do módulo **Fechamento de Caixa** (rota `/caixas-turnos`, componente atual `src/pages/Operacao/components/ConferenciaPdv.tsx`), mantendo a estrutura de painéis por PDV (FORMA × Apresentado × Apurado × Diferença) e seguindo os padrões do projeto (React + TS + Tailwind + shadcn + TanStack Query + Zustand, **somente GET / read-only**).
>
> Acrescente ao que já existe: (1) **seletor de turno** (1º/2º/3º) no topo; (2) **cards de resumo (KPIs)** acima dos painéis — Apresentado, Apurado, Diferença líquida, PDVs com divergência; (3) **status por PDV** no header de cada painel (✓ Conferido / ⏱ Pendente); (4) **drill-down**: clicar numa linha divergente expande Apresentado/Apurado/Sobra-Falta; (5) **empty states** (caixa pendente, turno sem caixas, e banner "Tudo conferido"); (6) **ordenação** dos PDVs (pendentes e divergentes primeiro). O **detalhar ›** do Cartão abre o modal `CartaoDetalheModal` já existente.
>
> O layout-alvo está nas 5 imagens anexas e no protótipo `Fechamento Conferencia PDV.dc.html`. **As imagens e o HTML são REFERÊNCIA de design** — recrie no codebase reaproveitando os componentes existentes (KPI cards, `CartaoDetalheModal`, `useCartaoBreakdown`, skeletons), não copie o HTML.
>
> **Read-only:** seletor de turno, filtro de tipo, ordenação e expand são estado de UI no cliente; o status "Pendente/Conferido" reflete o estado do caixa vindo da API (caixa aberto = pendente). Nenhum `useMutation`.

---

## Visão geral

A aba **Conferência por PDV** compara, por PDV (caixa), o que o operador **apresentou** (declarou) contra o que o sistema **apurou**, por forma de pagamento — destacando sobras e faltas. O redesign mantém os painéis lado a lado e adiciona contexto e navegação que faltavam: resumo no topo, escolha de turno, status de cada caixa, e detalhamento ao clicar.

## Sobre os arquivos deste bundle

São **referência de design feita em HTML** — protótipo do visual/comportamento, **não** código de produção. Recrie no codebase Visor360 (React + TS + Tailwind + shadcn/ui) reaproveitando componentes existentes.

## Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento e estados seguem `docs/DESIGN-SYSTEM.md`.

---

## Onde implementar (arquivos a tocar)

| Arquivo | Mudança |
|---|---|
| `src/pages/Operacao/components/ConferenciaPdv.tsx` | Redesign: KPIs + seletor de turno + status por PDV + drill-down + empty states. Recebe `conferencia` (já recebe hoje via `CaixasTurnos/index.tsx`). |
| `src/pages/CaixasTurnos/index.tsx` | Passar/derivar a lista de turnos disponíveis para o seletor (a partir de `turnoRows`/`conferenciaPdv` do `useOperacaoData`). |
| `src/pages/FechamentoCaixa/components/CartaoDetalheModal.tsx` + `hooks/useCartaoBreakdown.ts` | **Reaproveitar** o modal e o hook existentes para o "detalhar ›" do Cartão (escopo por PDV). |

> **Dados (read-only):** os PDVs/turnos e a quebra apresentado×apurado×diferença por forma já vêm de `useOperacaoData` (`turnoRows`, `conferenciaPdv` via `/CAIXA_APRESENTADO`). Status = caixa fechado → **Conferido**; caixa aberto/sem apuração → **Pendente**. Seletor de turno filtra por `turnoCodigo`. A quebra de cartão por bandeira vem de `useCartaoBreakdown` (`/VENDA`), só ao abrir o modal.

---

## Telas / Views

### Aba: Conferência por PDV
- **Propósito:** financeiro/gerente confere caixa a caixa, por forma de pagamento, e localiza divergências.
- **Largura de conteúdo:** `max-width: 1280px`, centralizado (`padding: 24px`, fundo `#f9fafb`).
- **Estrutura vertical** (gap `16px`):
  1. **Barra de controles** — filtro de tipo (Todos/Pista/Conveniência) à esquerda; contador + seletor de turno à direita.
  2. **Grid de 4 KPI cards.**
  3. *(condicional)* **Banner "Tudo conferido".**
  4. **Grid de 2 colunas** com os painéis por PDV.
  5. *(condicional)* **Empty state** quando o turno/filtro não tem PDVs.

Convenção de sinal/cor (Apresentado − Apurado): **sobra = positivo = verde** (`#15803d`/`#dcfce7`); **falta = negativo = vermelho** (`#b91c1c`/`#fee2e2`); zero = `—` cinza `#9ca3af`. Linha divergente recebe leve tint de fundo (verde `#f0fdf4` / vermelho `#fef2f2`).

Veja `screenshots/01-visao-geral.png`.

---

### Componente 1 — Barra de controles

- **Esquerda:** segmented `Todos / Pista / Conveniência` (ativo `#1e3a5f`/branco; inativo transparente/`#4b5563`), container `#fff` borda `#e5e7eb` radius 12.
- **Direita:** contador (`N PDVs · Xº Turno`, 12px `#6b7280`, com ícone) + **seletor de turno** (segmented menor `1º/2º/3º Turno`, mesmo padrão).

### Componente 2 — KPI cards (4)

Card base `#fff` borda `#e5e7eb` radius 16 padding 20 shadow `0 1px 2px rgba(0,0,0,.04)`. Atualizam conforme turno+filtro (somam só os PDVs **conferidos** do escopo).

| # | Título | Valor (mock 1º turno) | Visual |
|---|---|---|---|
| 1 | **Apresentado** (`Declarado no caixa`) | `R$ 45.829` | Card **navy** gradient, ícone `credit-card`. Rodapé: `N PDVs · turno`. |
| 2 | **Apurado** (`Sistema`) | `R$ 45.409` | chip `#dbeafe`/`#2563eb`, ícone `banknote`. |
| 3 | **Diferença líquida** (`Apresentado − Apurado`) | `+R$ 419` (cor do sinal) | chip e cor pela faixa (verde/vermelho/cinza), ícone `scale`. |
| 4 | **Com divergência** (`PDVs conferidos`) | `2 / 2` | chip `#fef3c7`/`#d97706`, ícone `alert-triangle`. Sublabel: `X PDV(s) pendente(s)` quando houver, senão `exigem atenção`. |

### Componente 3 — Banner "Tudo conferido" (condicional)

Aparece quando, no escopo visível, **não há pendência nem divergência**. `background:#f0fdf4; border:1px solid #bbf7d0; radius:14`, ícone `check-circle` verde, título "Tudo conferido" + "Nenhuma divergência nos PDVs deste turno — caixas batidos."

### Componente 4 — Painel por PDV

Card flex-column, altura igualada via grid `align-items:stretch` + tabela `flex:1` + linha-filler `height:100%` (mantém os **Totais alinhados** entre painéis de tamanhos diferentes). Estrutura:
- **Header:** badge de tipo (Conveniência `#f3e8ff`/`#7c3aed`, Pista `#dbeafe`/`#1d4ed8`) + `#id · data` (11px `#9ca3af`) à esquerda; **badge de status** à direita (Conferido `#dcfce7`/`#15803d` com ✓; Pendente `#fef3c7`/`#b45309` com ⏱).
- **Faixa do operador:** avatar circular com iniciais (`#1e3a5f`/branco) + nome.
- **Tabela** (forma × apresentado × apurado × diferença): header 10px uppercase `#9ca3af`; linhas `border-top #f3f4f6`; diferença em **pill** colorida (ou `—`); linha divergente com tint de fundo.
  - **Cartão:** chip `detalhar ›` (`#eff6ff`/`#2563eb`) → abre o modal.
  - **Linha divergente não-cartão:** clicável (cursor pointer + chevron ▸/▾) → **expande** detalhe.
- **Total (tfoot):** `border-top:2px #e5e7eb; background:#fafafa`, valores 700, diferença em pill.

Veja `screenshots/02-paineis.png`.

### Componente 5 — Drill-down (linha expandida)

Ao clicar numa linha com divergência, abre uma sub-linha (`background:#fafafa`, borda-esquerda `2px #e5e7eb`) com 3 itens: **Apresentado pelo operador**, **Apurado pelo sistema**, e **Sobra/Falta de caixa** (valor assinado, em destaque na cor do sinal). Veja `screenshots/04-drilldown.png`.

### Componente 6 — Estados vazios

- **Caixa pendente** (status Pendente): no corpo do painel, estado central com ícone relógio (`#fef3c7`/`#d97706`), "Conferência pendente" + "O operador ainda não fechou este caixa…". Veja `screenshots/03-turno2-pendente.png`.
- **Turno/filtro sem PDVs:** card tracejado central com ícone, "Nenhum caixa registrado neste turno" (ou "Nenhum PDV de {tipo} neste turno") + "Selecione outro turno ou filtro acima."

### Componente 7 — Modal "Detalhe do Cartão"

Reaproveitar o `CartaoDetalheModal` existente, alimentado por `useCartaoBreakdown` com escopo do PDV clicado. Layout em `screenshots/05-modal-cartao.png`: overlay `rgba(17,24,39,.5)`, modal branco `max-width:680`, header com ícone `credit-card` + "Detalhe do Cartão" + contexto (`Tipo · #id`) + fechar (X). Tabela: Bandeira | Tipo (badge Débito `#dcfce7`/`#15803d`, Crédito `#dbeafe`/`#1d4ed8`) | Administradora | Transações | Total; rodapé "Total cartão (vendido)".

---

## Interações & Comportamento

- **Tipo (Todos/Pista/Conveniência)** e **Turno (1º/2º/3º)**: estado de UI; recalculam KPIs, painéis e empty states.
- **Ordenação dos PDVs:** pendentes primeiro, depois com divergência, depois conferidos-OK.
- **Linha divergente:** clique expande/recolhe o detalhe (estado por `pdv:forma`). Trocar de turno limpa os expandidos.
- **Cartão:** clique no `detalhar ›` abre o modal (escopo do PDV).
- **KPIs:** somam apenas PDVs **conferidos**; pendentes contam à parte (sublabel do card 4).
- **Loading/Empty:** `KpiSkeleton`/`TableSkeleton`; `SelectCompanyState` (sem empresa).

## Estado / Dados

- **UI:** `sub` (tipo), `turno`, `cartaoPanel` (PDV do modal), `expanded` (map `pdv:forma`).
- **Por PDV:** `tipo`, `id`, `data`, `operador`, `status` (conferido/pendente), `rows[{forma, apresentado, apurado}]`, totais.
- **Derivados:** diferença por linha = apresentado − apurado; totais por painel; somatórios de KPI (conferidos); contagem de divergências e pendências.
- **Origem (GET):** `useOperacaoData` (`turnoRows`, `conferenciaPdv`); `useCartaoBreakdown` (modal).

## Design Tokens (resumo)

**Cores** — Navy `#1e3a5f`→`#27496f` · Accent `#2563eb` · texto `#111827`/secundário `#6b7280`/muted `#9ca3af` · borda `#e5e7eb`/divisor `#f1f3f5`/`#f3f4f6` · fundo `#f9fafb` · hover/seleção `#eff6ff`. Sobra `#15803d`/`#dcfce7`/tint `#f0fdf4`. Falta `#b91c1c`/`#fee2e2`/tint `#fef2f2`. Status pendente `#b45309`/`#fef3c7`. Tipo Conveniência `#7c3aed`/`#f3e8ff`, Pista `#1d4ed8`/`#dbeafe`. Banner OK `#15803d`/`#f0fdf4`/`#bbf7d0`.

**Tipografia** — Inter. KPI 30px/700 · valores tabela 13px (700 nos totais) · header tabela 10px/600 uppercase · badges 11px/600. `font-variant-numeric: tabular-nums` em números.

**Forma** — card radius 16 · pills 999 · segmented 12 (botão 9) · padding card 20 · shadow `0 1px 2px rgba(0,0,0,.04)`, modal `0 24px 64px rgba(0,0,0,.28)`.

**Ícones** — Lucide: `clipboard-check` (aba), `credit-card`, `banknote`, `scale`, `alert-triangle`, `check-circle`, `clock`, `building-2`, `x`.

## Dados de exemplo (mock do protótipo · Posto Norte Sul · 21/06/2026)

**1º Turno** — Conveniência #4485485 (Mailane de Jesus Sales, Conferido): Cartão 1.782/1.782, Transf. Crédito 1.154/1.154, Dinheiro 1.121/592 (+529) · Total 4.057/3.527 (+529). · Pista #4485585 (Valdinei N. Jureswski, Conferido): Cartão 29.142/29.142, Transf. Crédito 7.163/7.163, Dinheiro 4.027/4.137 (−110), Transf. Débito 1.440/1.440 · Total 41.772/41.882 (−110).
**2º Turno** — Conveniência #4486021 (Ana Paula Souza, Conferido, sem divergência): Cartão 2.105/2.105, Transf. Crédito 980/980, Dinheiro 1.340/1.340 · Total 4.425/4.425. · Pista #4486022 (Carlos Eduardo Lima, **Pendente**).
**3º Turno** — sem caixas (empty state).
**Modal cartão (GETNET):** Conveniência 1º turno soma R$ 1.781,70; Pista 1º turno soma R$ 29.142,00 (quebra por bandeira no protótipo).

Todos os valores são placeholder — substituir pela apuração real.

## Assets

Nenhum asset proprietário. Ícones **Lucide React** e tipografia **Inter** já existem. Modal = `CartaoDetalheModal` existente.

## Arquivos neste bundle

- `Fechamento Conferencia PDV.dc.html` — protótipo interativo (troque turno/filtro, clique nas linhas e no detalhar).
- `screenshots/01-visao-geral.png` — controles + KPIs + topo dos painéis.
- `screenshots/02-paineis.png` — painéis por PDV (status, formas, diferença).
- `screenshots/03-turno2-pendente.png` — 2º turno: caixa pendente + caixa conferido sem divergência.
- `screenshots/04-drilldown.png` — linha divergente expandida.
- `screenshots/05-modal-cartao.png` — modal Detalhe do Cartão.
