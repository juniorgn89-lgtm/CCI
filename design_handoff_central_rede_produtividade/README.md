# Handoff: Aba "Produtividade" na Central da Rede

> **Prompt pronto pro Claude Code (VS Code).** Cole a seção [▶ Prompt](#-prompt-para-o-claude-code) e anexe as 3 imagens em `screenshots/`. O restante do documento é a especificação completa que o Claude deve seguir.

---

## ▶ Prompt para o Claude Code

> Implemente uma nova aba **"Produtividade"** no módulo **Central da Rede** (`src/pages/Dashboard/`), deep-linkável via `?tab=produtividade`, seguindo os padrões existentes do projeto (React + TS + Tailwind + shadcn + TanStack Query + Zustand, **somente GET / read-only**).
>
> A aba é um **comparativo de produtividade entre as unidades (postos) da rede**, para o gestor/dono da rede. A métrica-estrela é **faturamento por colaborador** (`faturamento / colaboradores`), que normaliza o desempenho pelo tamanho da equipe.
>
> O layout-alvo está nas 3 imagens anexas (`screenshots/01-tela-completa.png`, `02-ranking.png`, `03-grafico-insights.png`) e no protótipo HTML `Central da Rede - Produtividade.dc.html` deste bundle. **As imagens e o HTML são REFERÊNCIA de design** — recrie a UI no codebase usando os componentes/padrões que já existem (`KpiCard`, `DataTable`/`HeatmapCell`, `HorizontalBarChart`, `InsightBanner`, etc.), não copie o HTML.
>
> Conteúdo da aba (de cima pra baixo): (1) 4 KPI cards, (2) tabela de ranking de unidades com heatmap na coluna R$/colaborador, (3) gráfico de barras horizontais + card de insights. Detalhes exatos de cor, tipografia, espaçamento e cópia estão no README. Siga a regra READ-ONLY: nenhum `useMutation`, só `useQuery` via hook do módulo.

---

## Visão geral

A Central da Rede (`/dashboard`) hoje tem as abas **Visão Geral**, **Ao Vivo Rede** e **Reabastecimento**. Esta entrega adiciona uma 4ª aba, **Produtividade**, que responde à pergunta que nenhuma tela atual responde bem para um dono de rede: **qual posto rende mais?**

O insight central que a tela revela: a unidade com maior faturamento **não** é necessariamente a mais produtiva — uma equipe maior dilui o resultado por pessoa. Por isso a métrica de ordenação padrão é **R$ por colaborador**, não faturamento bruto.

## Sobre os arquivos deste bundle

Os arquivos aqui são **referência de design feita em HTML** — um protótipo do visual e comportamento pretendidos, **não** código de produção para copiar. A tarefa é **recriar este design no ambiente do codebase Visor360** (React + TypeScript + Tailwind + shadcn/ui), reutilizando os componentes e padrões já estabelecidos.

## Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento e estados são finais e seguem o design system do Visor360 (`docs/DESIGN-SYSTEM.md`). Recrie a UI fielmente usando os componentes existentes do codebase.

---

## Onde implementar (arquivos a tocar)

| Arquivo | Mudança |
|---|---|
| `src/pages/Dashboard/index.tsx` | Adicionar `'produtividade'` ao tipo `TabId`, a `TAB_ICONS` (ícone `BarChart3`) e ao render: `{activeTab === 'produtividade' && <ProdutividadeRede />}`. Ajustar o type-guard do `useTabParam`. |
| `src/store/moduleLayout.ts` (`useDashboardLayout`) | Incluir a aba `{ id: 'produtividade', label: 'Produtividade', visible: true }` na lista default. |
| `src/components/layout/Sidebar.tsx` | Em `MODULE_SUBOPTIONS['/dashboard']`, adicionar `{ label: 'Produtividade', to: '/dashboard?tab=produtividade', Icon: BarChart3 }`. |
| `src/pages/Dashboard/components/ProdutividadeRede.tsx` | **Novo.** Componente da aba (KPIs + tabela + gráfico + insights). |
| `src/pages/Dashboard/hooks/useProdutividadeRede.ts` | **Novo.** Hook que agrega métricas **por unidade (empresa)** e deriva ranking, produtividade média, campeã/atenção e insights. |

> **Observação importante sobre dados:** os hooks atuais (`useOperacaoData`, `useDashboardData`) agregam as empresas selecionadas como **um bloco único**. Esta tela precisa do recorte **por empresa** (uma linha por posto). Resolva consultando os endpoints por `empresaCodigo` (um `useQuery` por unidade, com `queryKey` incluindo o código) ou usando um endpoint de apuração que já retorne por empresa. **Continua read-only (GET).** Use o `CompanySelect`/filtro global existente para definir quais unidades entram no comparativo.

---

## Telas / Views

### Aba: Produtividade (Central da Rede)
- **Propósito:** gestor da rede compara a produtividade entre postos e identifica destaques e gargalos.
- **Largura de conteúdo:** `max-width: 1280px`, centralizado, dentro da área de conteúdo padrão (`padding: 24px`, fundo `#f9fafb`).
- **Estrutura vertical** (gap `16px` entre blocos):
  1. **Grid de 4 KPI cards** — `grid-template-columns: repeat(4, 1fr)`, gap `16px`.
  2. **Card "Ranking de unidades"** — largura total, tabela com heatmap.
  3. **Linha final** — `grid-template-columns: 1.4fr 1fr`, gap `16px`: gráfico de barras (esq.) + insights (dir.).

Veja `screenshots/01-tela-completa.png`.

---

### Componente 1 — KPI cards (4)

Card base: `background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:20px; box-shadow:0 1px 2px rgba(0,0,0,.04)`. Layout interno: linha topo (label + chip de ícone 40×40, radius 12px), valor grande, rodapé com `border-top:1px solid #f3f4f6; padding-top:12px`.

| # | Título | Valor (mock) | Rodapé | Destaque visual |
|---|---|---|---|---|
| 1 | **Faturamento da rede** | `R$ 9,66 mi` (30px/700, branco) | `6 unidades · 67 colaboradores` + pill `+4,8%` | Card **navy**: `background:linear-gradient(135deg,#1e3a5f,#27496f)`. Ícone `network`. Trend verde `#6ee7b7`. |
| 2 | **Mais produtiva** | `Posto Avenida` (20px/700) | `por colaborador` + `R$ 160.000` | Chip ícone `trophy`, bg `#dbeafe`, stroke `#2563eb`. |
| 3 | **Produtividade média** | `R$ 144.179` (30px/700) | `média da rede no período` | Chip ícone `gauge`, bg `#ede9fe`, stroke `#7c3aed`. |
| 4 | **Abaixo da média** | `Posto Serra` (20px/700) | `R$ 108.571 / colab` + `−25%` (texto `#b45309`) | Borda `#fde68a`. Chip ícone `trending-down`, bg `#fef3c7`, stroke `#d97706`. |

Labels: 13px/600 `#111827`. Sub-label: 11px, uppercase, `letter-spacing:.04em`, `#9ca3af`. (No card navy os textos são brancos / `rgba(255,255,255,.6)`.)

---

### Componente 2 — Tabela "Ranking de unidades"

Card: mesmo base, `overflow:hidden`. Header do card: título 15px/600 + subtítulo `Ordenado por produtividade · período atual` (12px `#6b7280`) + legenda do heatmap à direita (3 quadradinhos 10px: verde/amarelo/vermelho = alta/média/baixa).

Tabela (`font-size:13px`, `border-collapse:collapse`):
- **Cabeçalho:** `background:#f3f4f6`, células 11px/600 uppercase `letter-spacing:.03em` `#6b7280`. Colunas: `#` | `Unidade` | `Faturamento` | `Litros` | `Colab.` | `R$ / colaborador` | `Ticket médio` | `vs. Maio`. Numéricas alinhadas à direita.
- **Linhas:** `border-top:1px solid #f3f4f6`; zebra: ímpares `#f9fafb`, pares `#fff`; hover `#eff6ff`. Padding célula `11px 16px`. Números com `font-variant-numeric: tabular-nums`.
- **Coluna `#` (rank):** círculo 24px. Rank 1 → bg `#1e3a5f`, 2 → `#2563eb`, 3 → `#60a5fa` (texto branco); 4–6 → bg `#f3f4f6`, texto `#6b7280`. Peso 700.
- **Coluna `R$ / colaborador` (estrela):** valor dentro de uma pill (`display:inline-block; min-width:96px; padding:4px 10px; border-radius:6px; font-weight:700`). **Heatmap por rank de produtividade** (independente da ordenação): top 1–2 → bg `#dcfce7` / texto `#15803d`; 3–4 → bg `#fef9c3` / `#a16207`; 5–6 → bg `#fee2e2` / `#b91c1c`.
- **Coluna `vs. Maio`:** pill arredondada (`border-radius:999px; padding:3px 8px; font-size:12px/600`) com seta. Positivo → bg `#d1fae5` / `#047857`, seta ▲. Negativo → bg `#fee2e2` / `#b91c1c`, seta ▼.

Veja `screenshots/02-ranking.png`. No codebase, prefira reaproveitar `DataTable` + `HeatmapCell` + `DeltaBadge`.

---

### Componente 3 — Gráfico de barras + Insights

**Gráfico "Produtividade por unidade"** (esq.): título 15px/600 + subtítulo. Cada linha: label da unidade (120px, 12px/500 `#374151`) + trilho (`flex:1; height:22px; background:#f3f4f6; border-radius:6px`) com barra preenchida (`width` proporcional ao valor, `min-width:8px`) + valor à direita (88px, 12px/600). **Cores das barras por rank:** `['#1e3a5f','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe']`. No codebase, usar `HorizontalBarChart` (Recharts).

**Card "Insights"** (dir.): chip ícone `lightbulb` (bg `#fef3c7`, stroke `#d97706`) + título `INSIGHTS`. Grupos com bolinha colorida + label uppercase:
- **Positivos** (`#10b981` / texto `#059669`): "Posto Avenida é a unidade mais produtiva: R$ 160.000 por colaborador, **11% acima** da média da rede."
- **Atenção** (`#f59e0b` / `#d97706`): "Posto Serra está 25% abaixo da produtividade média — avaliar dimensionamento da equipe."
- **Informações** (`#3b82f6` / `#2563eb`): "Rodovia BR-101 lidera em faturamento, mas fica em 2º em produtividade — equipe maior dilui o resultado por pessoa." · "Diferença de 47% em produtividade entre a 1ª e a última unidade."

Itens da lista: 13px, `line-height:1.45`, `#374151`; números/nomes em `<strong>` `#111827`. Veja `screenshots/03-grafico-insights.png`. No codebase, considerar `InsightBanner`.

---

## Interações & Comportamento

- **Abas:** controladas pela URL via `useTabParam` (`?tab=produtividade`). Deep-link a partir do flyout da sidebar.
- **Filtro de período / comparativo:** usa o `DateRangeToolbar` global já existente; os comparativos (`vs. Maio`, etc.) seguem o período comparativo selecionado.
- **Ordenação (opcional, recomendado):** permitir ordenar o ranking por **Produtividade / Faturamento / Litros**. O heatmap da coluna R$/colaborador permanece sempre baseado no rank de produtividade, independente da ordenação. O gráfico de barras acompanha a métrica de ordenação (título e valores mudam).
- **Hover de linha:** `background:#eff6ff`.
- **Loading:** usar `KpiSkeleton` / `TableSkeleton` existentes enquanto as queries por unidade carregam.
- **Empty:** sem empresa selecionada → `SelectCompanyState`. Sem dados no período → `EmptyState`.

## Estado / Dados

- **Filtros globais (Zustand `useFilterStore`):** `empresaCodigos` (multi), `dataInicial`, `dataFinal`, período comparativo. A tela depende de **2+ unidades selecionadas** para fazer sentido como comparativo.
- **Por unidade, derivar:** `faturamento`, `litros`, `colaboradores` (frentistas + vendedores ativos no período), `ticketMedio`, e `prod = faturamento / colaboradores`.
- **Agregados da rede:** faturamento total, total de colaboradores, **produtividade média = faturamentoTotal / colaboradoresTotal**, unidade mais produtiva, unidade abaixo da média, variação vs. período comparativo.
- **Insights** derivados em código (sem números inventados): % da campeã acima da média, % da pior abaixo da média, diferença entre 1ª e última, e a observação faturamento-líder ≠ produtividade-líder quando aplicável.

> Defina com o time o que conta como "colaborador" (sugestão: frentistas + vendedores com atividade no período). Esse denominador determina a métrica-estrela.

## Design Tokens (resumo)

**Cores**
- Navy `#1e3a5f` · navy gradient → `#27496f` · Accent `#2563eb`
- Texto `#111827` · secundário `#6b7280` · muted `#9ca3af`
- Borda `#e5e7eb` · divisor `#f3f4f6` · fundo `#f9fafb` · header de tabela `#f3f4f6` · zebra `#f9fafb` · hover linha `#eff6ff`
- Sidebar ativo: bg `#e0f2fe`, texto `#0c4a6e`, barra esquerda `#0ea5e9`, ícone `#0284c7`
- Heatmap: alta `#dcfce7`/`#15803d` · média `#fef9c3`/`#a16207` · baixa `#fee2e2`/`#b91c1c`
- Delta: positivo `#d1fae5`/`#047857` · negativo `#fee2e2`/`#b91c1c`
- Paleta de barras: `#1e3a5f`, `#2563eb`, `#3b82f6`, `#60a5fa`, `#93c5fd`, `#bfdbfe`

**Tipografia** — Inter. KPI principal 30px/700 · KPI texto 20px/700 · título de seção 15px/600 · tabela 13px/400–600 · labels 11px/600 uppercase. Números: `font-variant-numeric: tabular-nums`.

**Forma** — card radius `16px` · pill heatmap `6px` · pill delta `999px` · padding card `20px` · shadow `0 1px 2px rgba(0,0,0,.04)`.

**Ícones** — Lucide: `bar-chart-3` (aba), `network`, `trophy`, `gauge`, `trending-down`, `lightbulb`.

## Dados de exemplo (mock do protótipo)

```
Unidade               Faturamento  Litros    Colab.  R$/colab   Ticket   vs.
Posto Rodovia BR-101  2.840.000    540.000   18      157.778    64,50    +8,2%
Posto Avenida         1.920.000    312.000   12      160.000    58,30    +12,4%
Posto Centro          1.640.000    268.000   11      149.091    52,10    −3,1%
Posto Industrial      1.380.000    295.000   9       153.333    71,20    +5,6%
Posto Litoral         1.120.000    178.000   10      112.000    47,80    +1,2%
Posto Serra             760.000    142.000   7       108.571    44,90    −6,8%
Rede (total)          9.660.000  1.735.000   67      144.179 (média)
```
Ordenação padrão: por **R$/colaborador** desc. (Avenida 1º, Serra 6º.) Todos os valores são **placeholder** — substituir pelos dados reais da API.

## Assets

Nenhuma imagem/ícone proprietário. Ícones via **Lucide React** (já no projeto). Tipografia **Inter** (já no projeto). Use o sistema de design e os componentes existentes do Visor360.

## Arquivos neste bundle

- `Central da Rede - Produtividade.dc.html` — protótipo de referência (abrir no navegador).
- `screenshots/01-tela-completa.png` — visão geral (KPIs + topo do ranking).
- `screenshots/02-ranking.png` — tabela de ranking com heatmap.
- `screenshots/03-grafico-insights.png` — gráfico de barras + insights.
