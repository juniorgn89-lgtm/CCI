# Handoff: Visor360 — Versão Mobile

## Overview
Visor360 é um **dashboard analítico somente-leitura (READ-ONLY)** para redes de postos de combustível. Esta entrega é a **versão mobile (320–430px)** das telas principais: vendas, margens, caixa, estoque, financeiro, produtividade de frentistas e inteligência de preços.

**Não há CRUD.** Nenhuma criação/edição/exclusão — só consulta, filtros, navegação e (conceitualmente) exportação. Não implementar botões de adicionar, formulários de cadastro, FAB, swipe-to-delete, etc.

- **Idioma da interface:** Português (pt-BR). **Código:** inglês.
- **Plataforma alvo:** React SPA (web) — o app real usa **TailwindCSS + shadcn/ui + ícones Lucide + gráficos Recharts**.
- **Usuários:** dono/gestor de rede (visão consolidada) e gerente de posto (1 posto em tempo real). Sessões curtas, uso em pé no posto, frequentemente com 1 mão. Prioridade: **densidade de informação + leitura rápida**, sem rolagem excessiva.

## About the Design Files
Os arquivos deste pacote são **referências de design feitas em HTML/JS (React via Babel inline)** — protótipos que mostram aparência e comportamento pretendidos, **não código de produção para copiar diretamente**.

A tarefa é **recriar estas telas no codebase existente do Visor360** (React + Tailwind + shadcn/ui + Lucide + Recharts), usando os componentes e padrões já estabelecidos do projeto. Em particular:
- Os **KPI cards, seções, badges, deltas** devem virar componentes shadcn/ui equivalentes.
- Os **gráficos** (desenhados aqui à mão em SVG por questão de portabilidade) devem ser implementados com **Recharts** (AreaChart, BarChart, ranking via BarChart layout="vertical", PieChart/donut).
- Os **ícones** (path data Lucide embutido) devem usar **lucide-react** diretamente.

## Fidelity
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento, estados e interações são finais e devem ser reproduzidos fielmente, adaptando-se aos componentes do codebase. Os valores exatos estão na seção **Design Tokens**.

---

## Design System (obrigatório)

### Cores (light)
| Token | Hex | Uso |
|---|---|---|
| Primary (navy) | `#1e3a5f` | Header, valores de destaque, barras |
| Accent (blue) | `#2563eb` | Item ativo, links, foco, indicador de nav |
| Positive | `#22c55e` (texto usado `#059669`) | Variação positiva |
| Negative | `#ef4444` (texto usado `#dc2626`) | Variação negativa |
| Warning | `#f59e0b` (texto usado `#d97706`) | Alertas, dados faltantes, **projeções** |
| Bg | `#ffffff` / secundário `#f9fafb` | Fundos |
| Surface | `#ffffff` | Cards |
| Border | `#e5e7eb` / soft `#eef0f3` | Bordas |
| Texto | `#111827` / secundário `#6b7280` / terciário `#9ca3af` | — |

**Sequência de cores de gráfico (light):** `#1e3a5f, #2563eb, #3b82f6, #60a5fa, #93c5fd`

### Cores (dark — VSCode "Dark Modern", como no app real)
| Token | Hex |
|---|---|
| Bg | `#1c1c1c` · Surface `#242424` · Header `#131316` |
| Border | `#3a3a3a` / soft `#303030` |
| Texto | `#e0e0e0` / sec `#9e9e9e` / ter `#767676` |
| Accent | `#60a5fa` · Positive `#34d399` · Negative `#f87171` · Warning `#fbbf24` |
| Bar | `#3b82f6` |

**Sequência de gráfico (dark):** `#60a5fa, #3b82f6, #2563eb, #93c5fd, #1e3a5f`

> No protótipo o tema é controlado por CSS custom properties (`--navy`, `--accent`, `--c1..--c5`, `--pos`, `--neg`, `--warn`, `--text`, `--surface`, etc.) trocadas pela classe `.v360-dark`. No codebase, usar o sistema de dark mode já existente (Tailwind `dark:` + tokens shadcn).

### Tipografia
- **Família:** Inter (400/500/600/700/800).
- **KPI principal:** ~24–30px / 700 (cards "big" 26px; cards normais 18–19px).
- **Títulos de seção:** 13.5–16px / 600–700.
- **Corpo:** 12.5–14px. **Labels:** 9.5–12px.
- Números sempre com `font-variant-numeric: tabular-nums` e `letter-spacing: -0.01em` nos valores grandes.

### Formato de dados (pt-BR)
- Moeda: `Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})` → `R$ 1.234.567,00`. Versão curta: `R$ 4,2M` / `R$ 499K`.
- Litros: `136.999 L`; curto `1,8M L` / `612K L`.
- Percentual com vírgula: `11,8%` (1 casa) ou `11,80%` (2 casas).
- Variação: seta ▲/▼ + `+4,7% vs mês ant.` (cor positiva/negativa).

### Espaçamento, raio, sombra
- Padding de conteúdo: **14px** (12px no modo compacto). Gap entre blocos: **12px**. Gap em grids de KPI: **8px**.
- Raio: cards **12px**, mini-cards/inputs **9–11px**, pílulas **999px**.
- Sombra de card: `0 1px 2px rgba(16,24,40,0.05)` (light) / `0 1px 2px rgba(0,0,0,0.4)` (dark).
- **Touch targets ≥ 44px.**

---

## Shell (estrutura global)

### 1. Header navy (fixo, ≤ 56px de conteúdo + safe-area)
- Fundo `--header` (navy `#1e3a5f` light / `#131316` dark).
- Esquerda: ícone do app em chip translúcido (rgba(255,255,255,0.12), 34×34, raio 10) + título **"Visor360"** (15px/700, branco) + subtítulo (nome do posto, ou **"Rede · 5 postos"** na Central).
- Direita: pill **"Tempo real"** (fundo branco 10%, dot verde `#4ade80` que pulsa — `@keyframes` 1.8s) + sino com badge de notificação (dot warning) + botão de tema (sol/lua).
- Ícones do header sempre brancos (inclusive sob a status bar do iOS).

### 2. Barra de resumo de filtro (sticky, logo abaixo do header)
- **Não aparece na tela "Central da Rede"** (visão consolidada de todos os postos — filtro de posto não se aplica).
- Botão full-width: chip com ícone `sliders-horizontal` + label "FILTROS" (9.5px/600 uppercase) + **resumo do filtro ativo** (12.5px/600), ex.: `POSTO DARWIN · Mai/26 · Completo` + chevron-down à direita.
- Toca → abre o **painel de Filtros** (ver Interações).

### 3. Conteúdo (scroll)
- `<main>` rolável, padding 14px (12px compacto), padding-bottom extra para não cobrir pela nav.
- Topo: `<h1>` com o nome do módulo (19px/700). (O botão "Exportar" foi removido a pedido — não incluir.)

### 4. Bottom navigation (fixo)
- 4 destinos **personalizáveis pelo usuário** + botão **"Mais"**.
- **Padrão da barra:** Central · Vendas · Caixas · Inteligência.
- Item ativo: cor accent + **indicador deslizante** (barra 20×3px no topo do botão, accent, anima opacity+scaleX) + ícone com leve "pop" (scale 1.06, translateY -1px).
- **Personalização:** no drawer "Mais", botão "Editar barra" → cada módulo ganha um pin (✓); usuário fixa **até 4**; persistir em `localStorage` (chave `visor360.bar`). Botão "Padrão" restaura. **Atalho:** toque-longo (~450ms) no botão "Mais" abre o drawer já em modo edição.

---

## Screens / Views

> Todos os módulos abaixo estão implementados no protótipo. Estrutura recorrente: **grid de KPIs → seção "Projeção do mês" → gráficos → tabelas**. KPIs empilham em 1 coluna a 320px e usam 2 colunas a partir de ~400px (cards podem ter `span 2`).

### Geral
- **Central da Rede** (`central`) — dashboard consolidado da rede. KPIs (Faturamento big, Litros, Margem, Lucro Bruto, Ticket Médio, Abastecimentos) · **Projeção do mês** (6 métricas) · **Evolução mensal** (área faturamento + linha tracejada de margem, com toggle Faturam./Margem) · **Ranking de postos** (lista com barra de share, pílula de margem heatmap, faturamento + projeção + delta) · **Formas de pagamento** (donut). Sem barra de filtro.
- **Fechamentos** (`fechamentos`) — acompanhamento de apuração. Card de status do mês · KPIs (Dias apurados X/31, Dias pendentes, Valor conferido, Diferença acum.) · **Calendário de apuração** (grade 7 colunas, dias coloridos por status: apurado=verde, hoje=azul, pendente=âmbar, futuro=cinza, com legenda) · **Pendências** (dias sem custo) · **Últimos fechamentos** (tabela status/valor/dif) · **Apuração por posto** (barras de progresso).

### Posto
- **Vendas** (`vendas`) — **abas roláveis no topo (ordem: Visão Geral · Combustível · Pista · Conveniência)**, corpo com fade ao trocar de aba:
  - *Visão Geral:* Faturamento total (big) + Litros/Margem/Ticket · Projeção (Faturamento, Litros + Margem, Ticket) · Composição (donut Combustível/Conveniência/Serviços) · Evolução mensal (área).
  - *Combustível:* KPIs 2×2 (Litros, Lucro Bruto, Margem, L.B./litro) · nota **"sem custo apurado"** · Projeção (Litros, Faturamento, Lucro Bruto + Margem, L.B./litro) · Volume mensal (barras, último destacado) · Margem mensal (área) · **Tabela "Por combustível"** com colunas priorizadas (nome+litros, L. Bruto, Margem heatmap) — cada linha mostra **projeção inline âmbar** (proj litros, proj L. Bruto, proj margem) e **expande** ao tocar (Faturamento, Custo LMC, L.B./litro, Participação, Proj. litros, Proj. L. Bruto).
  - *Pista:* KPIs (Abastecimentos, Litros/abast., Ticket, Tempo médio) · Litros por produto (ranking de barras horizontais) · Projeção (Abastecimentos + Litros/abast., Ticket) · Formas de pagamento (donut).
  - *Conveniência:* KPIs (Faturamento, Margem, Ticket, Itens) · Projeção (Faturamento, Itens + Margem, Ticket) · Top produtos (ranking HBar) · Por categoria (donut).
- **Bombas** (`bombas`) — KPIs (Bicos ativos X/14, Volume do dia, Aferições OK, Divergências) · **Tabela de bicos** (Bico+produto, encerrante, volume/dia, status badge OK/Aferir/Divergência).
- **Caixas & Turnos** (`caixas`) — KPIs (Total em caixa big, **Projeção do dia**, Diferença, Turnos abertos) · **Turnos de hoje** (tabela: operador/período, valor, diferença; turno **aberto** mostra "proj fim R$…"; expande para Informado/Sistema/Diferença) · Conferência de caixa (barras +/−).
- **Produtividade** (`produtividade`) — KPIs (Litros/frentista, Atendimentos, Receita média, Tempo médio) · **Ranking de frentistas** (avatar com iniciais, pódio #1–#3 coloridos, litros à direita; expande para Receita/Atendim./Ticket).

### Gestão
- **Estoques** (`estoques`) — KPIs (Volume em tanque, Cobertura média, Tanques em alerta, Valor em estoque) · banner de alerta de cobertura crítica · **Níveis de tanque** (barra de preenchimento por tanque, cor por cobertura: <1,5d vermelho, <3d âmbar, ok navy; litros atual/capacidade; badge de dias) · **Reposição sugerida** (informativa, sem CRUD; badge de prazo).
- **Financeiro** (`financeiro`) — KPIs (Saldo em caixa big, A receber, A pagar, Resultado do mês) · Projeção (Receita, Despesa, Resultado + Margem líquida) · **Fluxo de caixa** (área entradas + linha tracejada saídas) · **DRE simplificada** (tabela Receita bruta → Resultado líquido; negativos com −; linha de resultado destacada em accent) · Contas a pagar (tabela).
- **Qualidade de Dados** (`qualidade`) — KPIs (Cobertura geral big, Fontes OK X/6, Lacunas) · **Cobertura por fonte** (barra por fonte, cor por status: crítico vermelho, atenção âmbar, ok navy; badge %) · **Lacunas** (lista com tag).
- **Pessoas** (`pessoas`) — KPIs (Colaboradores big, Frentistas, Gerentes) · **Equipe por posto** (lista com contagem) · **Por função** (ranking HBar).

### Análise
- **Inteligência** (`inteligencia`) — abas roláveis (Análise & Comparação · Radar de Preços · Cadu IA):
  - *Análise & Comparação:* KPIs (Rede atual vs Período anterior) · **Projeção da rede** (Faturamento, Litros + Margem, Ticket) · **Comparar postos** (ranking HBar com segmented Faturam./Litros/Margem que re-ordena) · Atual vs período anterior (área + linha tracejada) · **Variação por posto** (tabela com faturamento + projeção + delta).
  - *Radar de Preços:* KPIs (Posição média, Atualizado) · mapa (placeholder) · **Meus preços vs mercado** (por produto: preço, posição badge, barra de range min/max com marcadores meu/mercado) · **Concorrentes próximos** (tabela gas/etanol/diesel).
  - *Cadu IA:* cabeçalho do assistente + sugestões de perguntas + campo "Pergunte ao Cadu…" (somente visual no protótipo).

---

## Componentes-chave (mapear para shadcn/ui)

- **KpiCard** — chip de ícone colorido (canto sup. direito) + label + valor grande + **DeltaBadge** (▲/▼ + `+X,X% vs <ref>`). Suporta `span 2` e variante `big`. Fundo com leve gradiente tonal.
- **Section** (Card) — header com chip de ícone + título + slot à direita (badge/segmented/legenda); corpo com padding (ou `flush` para listas/tabelas coladas nas bordas).
- **DeltaBadge** — seta + percentual com 1 casa (vírgula) + label "vs mês ant./ano ant."; verde/vermelho; `invert` para métricas onde queda é boa (ex.: tempo médio).
- **MarginPill / Badge** — pílula colorida; margem em heatmap (≥ limiar verde, ≥70% âmbar, abaixo vermelho).
- **Segmented** — control segmentado (chips); rola horizontalmente se necessário; item ativo em navy.
- **ScrollTabs** — abas roláveis com sublinhado accent (nível de tela).
- **ProgressBar** — trilho + preenchimento; usado em share, cobertura, projeção, conferência.
- **ProjecaoSection** — bloco "Projeção do mês" reutilizável. Header com badge "Dia 30/31" + barra "Período decorrido 97%". Dois tipos de card:
  - **Total** (linear): valor projetado + "proj." + "realizado X · Y%" + barra cumulativa âmbar. `proj = realizado / fração_do_período`.
  - **Razão/tendência** (margem, ticket, L.B./litro, litros/abast.): valor projetado + "proj." + "realizado X · ▲/▼ Z% tendência", **sem barra** (razão não escala com o tempo; usar projeção por tendência informada nos dados).
- **Charts (Recharts no codebase):** AreaChart (combo área + linha secundária tracejada), BarChart (vertical, último destacado), HBar (ranking — BarChart `layout="vertical"`), Donut (PieChart com innerRadius + total no centro + legenda lateral).
- **Estados:** `LoadingScreen` (skeleton com etapas de carregamento + barra de progresso), `EmptyCard` (card âmbar "sem dados"), `NoCostNote` (nota âmbar "sem custo apurado"), `Skel` (shimmer).

---

## Interactions & Behavior

- **Painel de Filtros:** abre **descendo do topo** (sheet ancorado ao topo, cantos arredondados embaixo, puxador na base) ao tocar a barra de resumo. Campos: **Posto** (select; inclui "Toda a Rede"), **Período** (select de mês que preenche datas + dois date inputs `di`/`df`), **Escopo** (segmented Completo / Em andamento / Apurado), **Comparativo** (segmented vs mês ant. / vs ano ant.), botão **"Visualizar"** (navy) que aplica.
  - Selecionar um mês preenche `di`=1º dia e `df`=último dia; editar as datas manualmente marca o período como "Personalizado".
  - O **resumo na barra reflete o período real**: mês inteiro → `Mai/26`; intervalo custom → `05/05 – 18/05`. (O "vs mês ant." **não** fica na barra — só o Comparativo dentro do painel.)
- **Drawer "Mais":** sobe de baixo; lista módulos agrupados (Geral/Posto/Gestão/Análise). Modo "Editar barra" para fixar até 4 (ver Shell §4). Toque-longo no botão "Mais" abre já em edição.
- **Tabelas expansíveis:** "Por combustível", "Turnos", "Ranking de frentistas" expandem a linha ao tocar (chevron gira 90°), revelando grid de detalhes.
- **Microinterações:** conteúdo de tela e de aba entra com **fade-up .3s** (key por view/tab). Botões com leve "press" (scale .972) ao tocar. Bottom-nav com indicador deslizante + pop do ícone ativo. Dot "Tempo real" pulsa.
- **Tema:** botão sol/lua no header alterna light/dark (no protótipo via Tweaks/estado; no codebase usar o dark mode existente).

## State Management
- `view` — módulo atual (id do menu). Roteamento real: usar React Router como o app já faz.
- `bar` — array de até 4 ids fixados na bottom-nav (persistido em `localStorage: visor360.bar`).
- `drawer` / `drawerEdit` — abertura e modo de edição do "Mais".
- `sheet` — abertura do painel de Filtros.
- `filters` — `{ posto, mes, di, df, escopo, comparativo }` (global; no app real é um filter store, ex.: Zustand `useFilterStore`).
- Estado local por tela: aba ativa (`tab`), linhas expandidas, métrica do comparativo, toggle de série.
- **Dados:** no protótipo são mocks estáticos (ver `app/data.jsx`). No codebase, buscar via os endpoints reais (React Query), respeitando filtros globais. Estados loading/empty já previstos.

## Design Tokens
Ver tabelas em **Design System** acima. Resumo dos nomes usados no protótipo (CSS custom properties): `--bg --surface --border --border-soft --track --text --text-2 --text-3 --navy --bar --header --accent --accent-soft --pos --neg --warn --amber-soft --amber-border --zebra --shadow-sm --c1..--c5 --safe-top --safe-bot`. Mapear para os tokens shadcn/Tailwind do projeto.

## Assets
- **Ícones:** Lucide (no protótipo o path data está embutido em `app/icons.jsx`; no codebase usar `lucide-react`). Ícones usados: layout-dashboard, file-text, fuel, gauge, wallet, users, package, dollar-sign, database, sparkles, radio, bell, sun, moon, droplet, percent, receipt, trending-up/down, building-2, trophy, sliders-horizontal, calendar, clock, map-pin, alert-triangle, check, x, chevron-left/right/down, arrow-up-right/down-left, arrow-right, flame, layers, store, send, search, refresh-cw, menu, inbox.
- **Gráficos:** desenhados em SVG no protótipo → reimplementar com **Recharts**.
- **Imagens reais:** nenhuma (o mapa do Radar é placeholder). Sem logos de terceiros.
- **Fonte:** Inter (Google Fonts).

## Files
Arquivos de design neste pacote (referência):
- `Visor360 Mobile.html` — host: tokens de tema (light/dark), fontes, animações, ordem dos scripts.
- `app/data.jsx` — todos os dados mock + formatadores pt-BR + helper de projeção (`projetar`, `PERIODO`) + mapa de menu/abas.
- `app/icons.jsx` — componente `Icon` + path data Lucide.
- `app/ui.jsx` — primitivos (KpiCard, Section, DeltaBadge, Badge, MarginPill, Segmented, ScrollTabs, ProgressBar, ProjecaoSection) + charts SVG (AreaChart, BarChart, Donut, HBar) + estados (LoadingScreen, EmptyCard, NoCostNote, Skel).
- `app/shell.jsx` — Header, FilterBar, BottomNav, Sheet (top/bottom), MaisDrawer, FilterSheet.
- `app/screen-central.jsx`, `app/screen-fechamentos.jsx`, `app/screen-vendas.jsx`, `app/screen-misc.jsx` (Caixas, Inteligência, Radar, Cadu IA), `app/screen-modulos.jsx` (Financeiro, Estoques), `app/screen-modulos2.jsx` (Bombas, Produtividade, Qualidade, Pessoas).
- `app/app.jsx` — composição: estado, tema, roteamento de telas, Tweaks (Tema/Densidade/Estado dos dados).
- `frames/ios-frame.jsx`, `tweaks-panel.jsx` — apenas andaime de apresentação (moldura de iPhone + painel de Tweaks); **não** fazem parte do produto.

### Como abrir a referência
Abrir `Visor360 Mobile.html` em um navegador. Os arquivos `app/*.jsx` são transpilados via Babel no navegador (apenas para a referência rodar standalone — não refletem a arquitetura de build do produto).

> **Visuais:** este pacote não inclui screenshots estáticos — abra o `Visor360 Mobile.html` para ver as telas ao vivo (com light/dark, navegação, filtros e estados de loading/vazio via o painel de Tweaks). É a forma mais fiel de inspecionar cores, espaçamento e interações reais.
