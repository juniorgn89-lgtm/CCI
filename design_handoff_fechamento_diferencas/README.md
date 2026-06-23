# Handoff: Aba "Diferenças" no módulo Fechamento de Caixa

> **Prompt pronto pro Claude Code (VS Code).** Cole a seção [▶ Prompt](#-prompt-para-o-claude-code) e anexe as 4 imagens em `screenshots/`. O restante é a especificação completa.

---

## ▶ Prompt para o Claude Code

> Implemente uma nova aba **"Diferenças"** no módulo **Fechamento de Caixa** (rota `/caixas-turnos`, `src/pages/CaixasTurnos/`), deep-linkável via `?tab=diferencas`, seguindo os padrões do projeto (React + TS + Tailwind + shadcn + TanStack Query + Zustand, **somente GET / read-only**).
>
> A aba é uma **visão consolidada de sobras e faltas (diferenças de caixa)** do período, para gestor/financeiro. Responde: quanto falta/sobra (líquido), quem é responsável, em qual forma de pagamento concentra, e quais caixas tiveram as maiores divergências.
>
> O layout-alvo está nas 4 imagens anexas e no protótipo `Fechamento Diferencas.dc.html` deste bundle. **As imagens e o HTML são REFERÊNCIA de design** — recrie a UI no codebase reaproveitando os componentes/padrões existentes (KPI cards do `FechamentoCaixa/components/VisaoGeral.tsx`, `DataTable`, `CartaoDetalheModal`, skeletons), não copie o HTML.
>
> Conteúdo (de cima pra baixo): (1) 4 KPI cards; (2) gráfico "Diferença por dia" (sobra acima / falta abaixo da linha-zero); (3) tabela "Diferença por responsável" com **barra divergente** + card "Onde está a diferença" (por forma de pagamento); (4) tabela "Caixas com maior diferença". Os itens de **cartão** (linhas Cartão Crédito/Débito e badges de forma "Cartão") abrem o **modal Detalhe do Cartão** — reaproveite o `CartaoDetalheModal` já existente no projeto.
>
> **Read-only:** os dados de diferença já são calculados hoje em `VisaoGeral.tsx` (`difCaixa`, conferência por forma via `/CAIXA_APRESENTADO`). Esta aba **agrega** esses mesmos dados no nível do período — sem `useMutation`, sem gravação.

---

## Visão geral

O módulo Fechamento de Caixa (`/caixas-turnos`) hoje tem **Visão Geral** (relatório Caixa Geral) e **Conferência por PDV**. A tela irmã `FechamentoCaixa/components/VisaoGeral.tsx` já calcula, por caixa selecionado, a **diferença** (apresentado − apurado conferido) e a quebra por forma de pagamento (sobras/faltas).

Esta entrega adiciona a aba **Diferenças**: em vez de exigir que o usuário selecione caixas um a um, ela **consolida as diferenças do período inteiro** e organiza por responsável, forma de pagamento, dia e caixa — transformando um dado disperso em um painel acionável de conferência.

## Sobre os arquivos deste bundle

São **referência de design feita em HTML** — protótipo do visual/comportamento, **não** código de produção. Recrie no codebase Visor360 (React + TS + Tailwind + shadcn/ui) reaproveitando componentes existentes.

## Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento e estados seguem `docs/DESIGN-SYSTEM.md` e o visual já usado em `VisaoGeral.tsx`.

---

## Onde implementar (arquivos a tocar)

| Arquivo | Mudança |
|---|---|
| `src/pages/CaixasTurnos/index.tsx` | Adicionar `'diferencas'` ao tipo `CaixaTab` + `isCaixaTab`; ícone em `TAB_META` (`Scale`); render `{caixaTab === 'diferencas' && <DiferencasCaixa />}`. |
| `src/store/moduleLayout.ts` (`useCaixasLayout`) | Incluir `{ id: 'diferencas', label: 'Diferenças', visible: true }` nos defaults. |
| `src/components/layout/Sidebar.tsx` | Em `MODULE_SUBOPTIONS['/caixas-turnos']`, adicionar `{ label: 'Diferenças', to: '/caixas-turnos?tab=diferencas', Icon: Scale }`. |
| `src/pages/CaixasTurnos/components/DiferencasCaixa.tsx` | **Novo.** Componente da aba. |
| `src/pages/CaixasTurnos/hooks/useDiferencasCaixa.ts` | **Novo.** Hook que agrega diferenças do período por responsável / forma / dia / caixa. |
| `src/pages/FechamentoCaixa/components/CartaoDetalheModal.tsx` | **Reaproveitar** o modal existente (já recebe `linhas`, `total`, `pdvs`, `isLoading`); alimentar com a quebra por bandeira via `useCartaoBreakdown`. |

> **Dados (read-only):** reutilize a lógica de `VisaoGeral.tsx` — `difCaixa(c)` (apresentado − apurado conferido) por caixa, e a quebra por forma via `conferenciaPdv` (`/CAIXA_APRESENTADO`). Agregue por `funcionarioNome` (responsável), por forma de pagamento, por `dataMovimento` (dia) e liste os caixas com maior `|diferença|`. A quebra de cartão por bandeira vem do `useCartaoBreakdown` (`/VENDA`), exatamente como já é feito hoje.

---

## Telas / Views

### Aba: Diferenças (Fechamento de Caixa)
- **Propósito:** gestor/financeiro enxerga o total de sobras/faltas do período e age — identifica responsável recorrente, forma de pagamento problemática e os caixas a investigar.
- **Largura de conteúdo:** `max-width: 1280px`, centralizado (`padding: 24px`, fundo `#f9fafb`).
- **Estrutura vertical** (gap `16px`):
  1. **Grid de 4 KPI cards** — `repeat(4, 1fr)`.
  2. **Card "Diferença por dia"** — gráfico de barras com linha-zero.
  3. **2 colunas** (`1.45fr 1fr`): "Diferença por responsável" (tabela) + "Onde está a diferença" (por forma).
  4. **Card "Caixas com maior diferença"** — tabela full-width.

Convenção de sinal/cor: **falta = negativo = vermelho** (`#b91c1c` texto, `#ef4444` barra); **sobra = positivo = verde** (`#047857` texto, `#22c55e` barra); zero = cinza `#6b7280`.

Veja `screenshots/01-visao-geral.png`.

---

### Componente 1 — KPI cards (4)

Card base: `background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:20px; box-shadow:0 1px 2px rgba(0,0,0,.04)`.

| # | Título | Valor (mock) | Rodapé | Visual |
|---|---|---|---|---|
| 1 | **Diferença líquida** (`Sobras − Faltas`) | `−R$ 1.053,60` (30px/700) | `Posto Norte Sul · Maio/2025` | Card **navy** gradient; valor na cor do sinal (negativo `#fca5a5` sobre navy); ícone `scale`. |
| 2 | **Faltas** (`Dinheiro a menos`) | `−R$ 1.409,50` (texto `#b91c1c`) | `em 31 caixas` | Borda `#fecaca`, chip `#fee2e2`/`#dc2626`, ícone `trending-down`. |
| 3 | **Sobras** (`Dinheiro a mais`) | `+R$ 355,90` (texto `#15803d`) | `em 18 caixas` | Borda `#bbf7d0`, chip `#dcfce7`/`#16a34a`, ícone `trending-up`. |
| 4 | **Caixas com diferença** | `38 / 117` (total em 18px `#9ca3af`) | `32% dos caixas conferidos` | chip `#fef3c7`/`#d97706`, ícone `alert-triangle`. |

---

### Componente 2 — "Diferença por dia"

Card base. Header com legenda (sobra verde / falta vermelho). Faixa de barras: container `height:96px` com `border-top`/`border-bottom` tracejados (`1px dashed #e5e7eb`) e uma **linha-zero** central (`1px #cbd5e1`). Cada dia = coluna flex dividida em duas metades: metade superior (barra verde alinhada embaixo, para sobras), metade inferior (barra vermelha alinhada em cima, para faltas). Altura da barra ∝ `|valor| / maxDia` (máx ~40px por lado). Eixo: labels `01 Mai`, `15 Mai`, `31 Mai`. `title` por barra com o valor do dia.

Veja `screenshots/01-visao-geral.png` (rodapé).

---

### Componente 3a — "Diferença por responsável" (tabela)

Card base `overflow:hidden`. Header: título + subtítulo (`Ordenado por <ordenação> · saldo de sobras e faltas`).
Tabela (`font-size:13px`): cabeçalho `#f3f4f6`, 11px/600 uppercase. Colunas: `Responsável` | `Caixas` (dir.) | `Saldo` (barra, ~180px) | `Líquido` (dir.).
- Zebra ímpar `#f9fafb`, hover `#eff6ff`, `border-top:1px solid #f3f4f6`.
- **Coluna Saldo = barra divergente:** uma linha de 18px com **zero ao centro** (`1px #cbd5e1`); metade esquerda preenche **vermelho** (faltas) crescendo para a esquerda, metade direita **verde** (sobras) para a direita. Largura de cada lado ∝ `|líquido| / maxAbsLíquido` (0–100% da metade).
- **Coluna Líquido:** valor assinado (`+`/`−`) na cor do sinal, 13px/700.

Veja `screenshots/02-responsavel-forma.png`.

### Componente 3b — "Onde está a diferença" (por forma)

Card base. Para cada forma: linha com nome + valor assinado (cor do sinal) e barra horizontal (`height:9px; border-radius:999px`) com largura ∝ `|valor| / maxForma`, cor vermelha (negativo) ou verde (positivo). **Formas de cartão** (Cartão Crédito/Débito) são **clicáveis** (cursor pointer, hover `#f9fafb`) e exibem um chip `detalhar ›` (`#eff6ff`/`#2563eb`) → abrem o **modal Detalhe do Cartão**. Nota ao final: *"Concentração em **Dinheiro** sugere falha de troco/sangria — foco da conferência."*

---

### Componente 4 — "Caixas com maior diferença" (tabela)

Card base `overflow:hidden`. Colunas: `Data` | `Turno` | `Caixa` | `Responsável` | `Forma` (badge pill) | `Apurado` (dir.) | `Diferença` (dir., assinada, cor do sinal). Ordenado por `|diferença|` desc. Badges de forma **Cartão** ficam azuis (`#eff6ff`/`#2563eb`) e **clicáveis** (abrem o modal); demais formas em cinza (`#f3f4f6`/`#4b5563`).

Veja `screenshots/03-top-caixas.png`.

---

### Componente 5 — Modal "Detalhe do Cartão"

Abre ao clicar em qualquer item de cartão. **No codebase, é o `CartaoDetalheModal` que já existe** — alimentado por `useCartaoBreakdown`.

Layout (ver `screenshots/04-modal-cartao.png`): overlay `rgba(17,24,39,.5)`, modal branco centralizado `max-width:680px; border-radius:16px; box-shadow:0 24px 64px rgba(0,0,0,.28)`. Header: chip ícone `credit-card` (`#eff6ff`/`#2563eb`) + título **Detalhe do Cartão** (18px/700) + subtítulo *"Quebra por bandeira e débito/crédito (base: vendas autorizadas do período)"* + botão fechar circular (X, `border:1px solid #e5e7eb`). Tabela: `Bandeira` (600) | `Tipo` (badge: Débito `#dcfce7`/`#15803d`, Crédito `#dbeafe`/`#1d4ed8`) | `Administradora` (cinza) | `Transações` (dir.) | `Total` (dir., 700). Rodapé `#f9fafb`: **Total cartão (vendido)** + total. Fecha no X ou clicando no backdrop.

---

## Interações & Comportamento

- **Abas:** URL via `useTabParam` (`?tab=diferencas`).
- **Filtro de período:** `DateRangeToolbar` global — define quais caixas/diferenças entram.
- **Ordenação (tweak/controle):** ranking por responsável ordenável por **Diferença líquida / Faltas / Sobras / Nº de caixas**; toggle **pior primeiro** (mais negativo no topo); toggle **ocultar quem não tem diferença**.
- **Modal de cartão:** abre ao clicar nas formas de cartão (card "Onde está a diferença") ou nos badges de forma "Cartão" (tabela de caixas). Fecha no X / backdrop.
- **Hover de linha:** `#eff6ff`. **Loading:** `KpiSkeleton`/`TableSkeleton`. **Empty:** `SelectCompanyState` (sem empresa) / estado vazio quando não há diferenças no período.

## Estado / Dados

- **Filtros globais (Zustand):** `empresaCodigos`, `dataInicial`, `dataFinal`.
- **Por caixa (já existe em VisaoGeral):** `difCaixa(c) = apresentadoTotal − apuradoConferido` (fallback `c.diferenca`); quebra por forma via `conferenciaPdv` (`/CAIXA_APRESENTADO`).
- **Agregações da aba:** por responsável (`funcionarioNome`): nº caixas, soma de sobras (dif > 0), soma de faltas (dif < 0), líquido; por forma de pagamento (líquido assinado); por dia (`dataMovimento`); top caixas por `|dif|`.
- **Cartão:** `useCartaoBreakdown(caixaCodigos, pdvByCaixa, open)` → linhas por bandeira/tipo/administradora (`/VENDA`), só busca quando o modal abre.
- **Estado de UI:** `cartaoOpen` (modal); ordenação/direção/ocultar (tweaks).

## Design Tokens (resumo)

**Cores** — Navy `#1e3a5f`→`#27496f` · Accent `#2563eb` · texto `#111827`/secundário `#6b7280`/muted `#9ca3af` · borda `#e5e7eb`/divisor `#f3f4f6` · fundo `#f9fafb` · header tabela `#f3f4f6` · zebra `#f9fafb` · hover `#eff6ff` · sidebar ativo `#e0f2fe`/`#0c4a6e`/barra `#0ea5e9`. Falta: `#ef4444` barra / `#b91c1c` texto / `#fecaca` borda / `#fee2e2` chip. Sobra: `#22c55e` / `#15803d`(ou `#047857`) / `#bbf7d0` / `#dcfce7`. Zero-line `#cbd5e1`. Badge cartão clicável `#eff6ff`/`#2563eb`. Tipo Débito `#dcfce7`/`#15803d`, Crédito `#dbeafe`/`#1d4ed8`.

**Tipografia** — Inter. KPI 30px/700 · seção 15px/600 · valores tabela 13px/700 · tabela 13px/400–600 · labels 11px/600 uppercase. `font-variant-numeric: tabular-nums` em números. Modal: título 18px/700, subtítulo 13px.

**Forma** — card radius `16px` · barras `999px` · modal `16px` · padding card `20px` · shadow card `0 1px 2px rgba(0,0,0,.04)`, modal `0 24px 64px rgba(0,0,0,.28)`.

**Ícones** — Lucide: `scale` (aba/KPI), `trending-down`, `trending-up`, `alert-triangle`, `credit-card`, `x`.

## Dados de exemplo (mock do protótipo · Posto Norte Sul · Maio/2025)

**Por responsável** (sobras / faltas / líquido):
```
Valter Francisco da Silva   16 caixas   +15,00   −512,40   −497,40
Sidney Nobre                18 caixas   +42,30   −387,60   −345,30
Juliano Pereira de Jesus    14 caixas    +5,00   −210,80   −205,80
Alessandro Odilia           15 caixas   +30,00    −95,50    −65,50
Eduardo Lannes Santucci     12 caixas   +88,90   −120,00    −31,10
Chytila da Silva Ferreira   20 caixas   +64,50    −45,20    +19,30
Isaac Santos Machado        22 caixas  +110,20    −38,00    +72,20
```
**Por forma:** Dinheiro −892,40 · PIX −128,00 · Cartão Crédito −78,30 · Cartão Débito +45,10.
**Top caixas:** 12/05 Tarde #3 Valter −287,40 (Dinheiro) · 23/05 Manhã #1 Sidney −198,60 (Dinheiro) · 07/05 Noite #2 Juliano −156,00 (PIX) · 19/05 Tarde #3 Valter −132,80 (Dinheiro) · 15/05 Manhã #1 Isaac +64,20 (Dinheiro) · 28/05 Noite #2 Alessandro −58,50 (Cartão Crédito).
**Modal cartão (GETNET):** MAESTRO/Débito 38 R$ 648,51 · MASTERCARD CREDITO/Crédito 19 R$ 493,18 · VISA DEBITO/Débito 24 R$ 422,19 · VISA CREDITO/Crédito 7 R$ 120,68 · ELO DEBITO/Débito 5 R$ 97,14 · **Total R$ 1.781,70**.

Todos os valores são placeholder — substituir pela agregação real (`difCaixa`/conferência/`useCartaoBreakdown`).

## Assets

Nenhum asset proprietário. Ícones **Lucide React** e tipografia **Inter** já existem no projeto. Modal = `CartaoDetalheModal` já existente.

## Arquivos neste bundle

- `Fechamento Diferencas.dc.html` — protótipo de referência (clique nos itens de cartão pra abrir o modal).
- `screenshots/01-visao-geral.png` — KPIs + início da tendência diária.
- `screenshots/02-responsavel-forma.png` — por responsável (barra divergente) + por forma.
- `screenshots/03-top-caixas.png` — caixas com maior diferença.
- `screenshots/04-modal-cartao.png` — modal Detalhe do Cartão aberto.
