# Brief de Design Mobile — Visor360

> Contexto para gerar o visual mobile do sistema. Reflete os módulos, tokens e o
> padrão de TopBar/filtros reais. Ver também: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)
> e [TOPBAR.md](TOPBAR.md).

## 1. Produto
**Visor360** é um dashboard analítico **somente leitura** (READ-ONLY) para **redes
de postos de combustível**. Mostra vendas, margens, caixa, estoque, financeiro,
produtividade de frentistas e inteligência de preços. Não há criação/edição/
exclusão de dados — só consulta, filtros, navegação e exportação. **Não desenhar
nenhum botão de CRUD, formulário de cadastro, FAB de "adicionar", swipe-to-delete.**

- **Idioma da interface:** Português (pt-BR). Código em inglês.
- **Plataforma atual:** React SPA (web), TailwindCSS, shadcn/ui, ícones Lucide, gráficos Recharts.
- **Alvo deste brief:** versão **mobile** (320–430px de largura) das telas principais.

## 2. Usuários & contexto de uso
- **Gestor/dono de rede** — visão consolidada de vários postos; KPIs e comparativos rápidos.
- **Gerente de posto** — acompanha 1 posto em tempo real (vendas do dia, caixa, frentistas). Uso **majoritariamente no celular, em pé, no posto**.
- Sessões curtas, "dar uma olhada rápida", muitas vezes com 1 mão. Prioridade: **densidade de informação + leitura rápida**, sem rolagem excessiva.

## 3. Sistema de design (obrigatório seguir)
**Cores**
| Token | Hex | Uso |
|---|---|---|
| Primary (navy) | `#1e3a5f` | Header, botões primários, valores de destaque |
| Accent (blue) | `#2563eb` | Item ativo, links, focus |
| Positive | `#22c55e` | Variação positiva |
| Negative | `#ef4444` | Variação negativa |
| Warning | `#f59e0b` | Alertas / dados faltantes |
| Bg | `#ffffff` / secundário `#f9fafb` | Fundos |
| Border | `#e5e7eb` | Bordas |
| Texto | `#111827` / secundário `#6b7280` | — |

Sequência de cores de gráfico: `#1e3a5f, #2563eb, #3b82f6, #60a5fa, #93c5fd`. **Dark mode existe** (desenhar as duas variantes).

**Tipografia:** Inter (400/500/600/700). KPI principal ~24–30px/700; títulos de seção 16–18px/600; corpo 14px; labels 12px.

**Formato de dados:** moeda BRL (`R$ 1.234.567`), litros (`136.999 L`), percentual com vírgula (`11,80%`), variação com seta + pp/%.

## 4. Mapa de telas (módulos do menu)
- **Geral:** Central da Rede (dashboard consolidado), Fechamentos
- **Posto:** Vendas (abas: Visão Geral, Combustível, Conveniência, Pista), Bombas, Caixas & Turnos, Produtividade
- **Gestão:** Estoques, Financeiro, Qualidade de Dados, Pessoas
- **Análise:** Inteligência (abas: Análise & Comparação, Radar de Preços, Cadu IA — assistente de IA)

## 5. Padrão de cabeçalho desktop (adaptar pro mobile)
No desktop:
1. **Header de chrome** (48px): seletor de rede + refresh + sino de notificações.
2. **TopBar consolidada** (≤70px, fixa): **título da tela** + **filtros globais numa linha** → **Posto** · **Período** (mês + data inicial/final + Visualizar) · **Escopo** (segmented: Completo / Em andamento / Apurado) · **Comparativo** (segmented: vs mês ant. / vs ano ant.).
3. Conteúdo rola abaixo; a TopBar fica fixa.

**No mobile esses 4 filtros não cabem numa linha** — precisa de um padrão mobile (ver §8).

## 6. Componentes-chave a desenhar (mobile)
- **KPI Card:** ícone + label + valor grande + comparativo (▲/▼ + %). Hoje 4–5 lado a lado; no mobile, empilhar (1 coluna) ou carrossel.
- **Tabelas com heatmap:** células com gradiente verde (positivo) / vermelho (negativo) para margens. Versão mobile legível (scroll horizontal? cards? colunas priorizadas?).
- **Gráficos Recharts:** linha/área (evolução mensal), barras (comparativo por período/mês), barras horizontais (rankings), donut (formas de pagamento).
- **Estados:** loading (skeleton), vazio (card âmbar "sem dados"), nota de "sem custo apurado".

## 7. O que JÁ existe de mobile (base)
Há um **Painel Gerente** mobile (`/gerente`):
- **Header fixo navy** (`#1e3a5f`): ícone + "Painel Gerente / Visão mobile" + pill "Tempo real" (verde, pulsa ao carregar) + botão sair.
- **Bottom navigation fixa** (Início, Financeiro, Frentistas, Combustíveis).
- Conteúdo `padding 16px`, `padding-bottom 80px`.

Esse padrão (header navy + bottom-tab) pode ser a **base** do mobile do sistema todo, mas precisa escalar pra ~12 módulos (bottom-tab comporta 4–5).

## 8. Requisitos específicos do mobile
1. **Navegação:** bottom-tab para 4–5 destinos principais + "Mais"/menu (drawer) pro restante.
2. **Filtros globais:** condensar Posto/Período/Escopo/Comparativo num **botão "Filtros"** que abre **bottom-sheet**, com resumo do filtro ativo na barra (ex.: "POSTO DARWIN · Mai/2026 · Completo").
3. **Densidade:** cabeçalho mobile ≤ ~56px; evitar espaços verticais grandes.
4. **Touch:** alvos ≥ 44px; segmented controls viram chips/toggles roláveis se preciso.
5. **Responsivo:** 1 coluna a 320px; 2 colunas a partir de ~400px quando fizer sentido.
6. **Dark mode** nas duas versões.
7. **Abas de tela** viram tabs roláveis horizontais no topo do conteúdo.

## 9. Referências visuais
Power BI Mobile, TradingView, Datadog, Grafana, HubSpot — **moderno, compacto, corporativo, alta densidade de dados**.

## 10. Entregáveis esperados (priorizados)
1. **Shell mobile** (header + bottom-nav + menu "Mais" + bottom-sheet de filtros).
2. **Central da Rede** (KPIs consolidados + gráfico + ranking de postos).
3. **Vendas › Combustível**.
4. **Fechamentos** e **Caixas & Turnos**.
5. **Inteligência › Radar de Preços**.
Para cada: light + dark, estados loading/vazio.

## 11. Perguntas pro design decidir
- Quais 4–5 módulos vão na bottom-tab?
- Tabela heatmap no mobile: scroll horizontal, cards empilhados ou colunas priorizadas?
- KPIs: empilhados (1 col) ou carrossel horizontal "swipeable"?
- O resumo do filtro ativo fica fixo no topo do conteúdo ou dentro do botão "Filtros"?

---

## Apêndice A — KPIs e colunas por tela (dos componentes reais)

> Strings em pt-BR exatas, extraídas do código. O design não deve inventar métricas.

### A.1 — Central da Rede (Dashboard)

**KPIs (1 posto selecionado):**
- **Faturamento Combustível** (R$ · subtítulo com litros totais e R$/L)
- **Total Apurado** (R$)
- **Contas a Receber** (R$ · nº de títulos · "vencidos" em destaque se houver)
- **Contas a Pagar** (R$ · nº de contas · vencidos em destaque)

**Bloco Projeção:** "Projeção fim do período" (valor projetado + barra de progresso dias decorridos/total) · "Projetado pela 1ª semana" (só períodos fechados).

**Visão Rede (consolidado) — cards por setor:** **Combustível** (Lucro bruto · Margem · L. bruto/litro) · **Automotivos** · **Conveniência** · **Global** (todos: Lucro bruto · Faturamento · Margem).
**Tabela Projeção:** `Setor | Faturamento | Lucro bruto | Margem`.
**Abas:** "Visão geral do setor" · "Ao Vivo Rede" · "Reabastecimento".

### A.2 — Vendas › Combustível

**KPIs (topo):**
- **Litros Vendidos** (L · comparativo ano/mês ant. · projeção · subtítulo "Mix por tipo de combustível")
- **Lucro bruto** (R$ · comparativo)
- **Margem** (% · "Ano anterior"/"Mês anterior" + "Variação" em pp)
- **L.B./Litro** (R$ + % · subtítulo "Lucro bruto por litro e % de margem" · ranking Maior/Menor por combustível)
- **Projeção** ("até o fechamento do mês")

**Seção "Detalhamento de informações"** — abas:
1. **Realizado dia a dia** — tabela: `Data | Dia da semana | Litros | Var. semanal | Faturamento | Lucro bruto | Descontos | Margem | Preço venda | Preço custo | L.B. litro` (+ linha Total)
2. **Realizado - por combustível** — tabela: `Combustível | Litros | Preço méd. | Custo méd. | L.B./Litro | Faturamento | Projeção | Lucro bruto | Margem % | % vol` (+ Total)
3. **Últimos 12 meses** — gráficos: "Litros vendidos e L.B./Litro por mês" · "Lucro bruto e Margem por mês"
4. **Análise semanal** — filtro de combustível · gráfico "Litros vendidos por dia" · heatmap "Média de venda por dia da semana × combustível"

### A.3 — Fechamentos

**Abas:** Visão Geral · Caixa Geral · Sangria · Sobras e Faltas · Diferença Encerrantes.

**Visão Geral — KPIs:** **Apurado Total** (R$ · "{n} caixa(s) selecionado(s)") · **Combustível** (R$ · "% do apurado") · **Conveniência** (R$ · "Apurado − Combustível") · **Diferença** (R$, colorida · "Caixas fechados · {n}/{total}").
- Seções: "Formas de Pagamento" · "Frentistas" (abast. · L · %) · tabela "Sobras e Faltas por Caixa": `Data | Turno | Caixa | Responsável | Apurado | Diferença`.

**Caixa Geral:** "Vendas por Grupos" → `Grupo | Quantidade | Total (R$) | Margem Bruta (R$)`. "Movimentação Financeira dos Caixas" → Entradas (Combustível, Produto, Vale, Suprimento, Recebimento… + Total) e Saídas (Cartão, Dinheiro, Transferência… + Total).

**Diferença Encerrantes:** "Conferência de Encerrantes" → `Ref. | Produto | Encerrante (Lt) | Venda (Lt) | Diferença (Lt)`.

### A.4 — Caixas & Turnos

Subtítulo: "Apuração, fechamentos, pagamentos e turnos". **Abas:** Visão Geral · Turnos de Caixa.
- Pills de filtro: "Todos / Abertos / Fechados / Com diferença / Sem diferença".
- KPIs por turno: apurado, diferença (sobras/faltas/saldo).
- Gráficos: "Evolução Diária do Apurado" (barras + linha de projeção) · "Formas de Pagamento" (donut, clicável). Tabela de turnos expansível por dia.

### A.5 — Inteligência › Radar de Preços (Guerra de Preço)

**Controles:** dropdown de combustível (ordenado por volume) · slider "Redução" (R$/L) · toggle "Mostrar tabela".
**KPIs:** **Preço Venda Médio** (R$/L) · **Preço Custo Médio** (R$/L) · **L.B./Litro** (R$/L) · **Margem** (%) · **Litros/Dia** · **Litros Totais** · **Dias**.
**Projeção:** "até o fechamento do mês" (fat/litros/lucro projetados · dias fechados/restantes).
**Comparativo semanal (WoW):** deltas % de preço, custo, L.B. e volume.
**Tabela "Cortes de Preço":** `Data | Queda (R$) | Novo Preço | Var Litros (%) | Var L.B. (%)`.
**Elasticidade Observada** (% de crescimento de volume por R$1 de redução) + **Cenário Projetado** (inputs: redução R$/L e fator de crescimento %; outputs: fat/litros/lucro/margem do mês fechado).
