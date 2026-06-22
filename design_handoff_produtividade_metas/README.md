# Handoff: Aba "Metas" no módulo Produtividade

> **Prompt pronto pro Claude Code (VS Code).** Cole a seção [▶ Prompt](#-prompt-para-o-claude-code) e anexe as 4 imagens em `screenshots/`. O restante é a especificação completa.

---

## ▶ Prompt para o Claude Code

> Implemente uma nova aba **"Metas"** no módulo **Produtividade** (`src/pages/Produtividade/`), deep-linkável via `?tab=metas`, seguindo os padrões do projeto (React + TS + Tailwind + shadcn + TanStack Query + Zustand, **somente GET / read-only**).
>
> A aba mostra **Meta × Realizado por frentista**, com um **seletor de métrica** (estado local) entre três frentes: **Abastecimentos** (nº), **Venda Bruta** (R$) e **Aditivada** (litros). Ao trocar a métrica, os KPIs, a tabela e os destaques recalculam. A métrica-estrela é o **% de atingimento** (`realizado / meta`).
>
> O layout-alvo está nas 4 imagens anexas e no protótipo `Produtividade Metas.dc.html` deste bundle. **As imagens e o HTML são REFERÊNCIA de design** — recrie a UI no codebase usando os componentes/padrões existentes (`KpiCard`, `DataTable`/`BarCell`, `DeltaBadge`, `InfoHint`, skeletons), não copie o HTML.
>
> Conteúdo (de cima pra baixo): (1) seletor de métrica + legenda de cores; (2) 4 KPI cards; (3) tabela de atingimento por frentista com barra de progresso colorida por faixa e linha de total; (4) card de Distribuição da equipe + card de Destaques (maior/menor atingimento). Inclua a nota informativa de que **as metas são cadastradas no sistema de origem** (o Visor360 é read-only). Detalhes exatos de cor, tipografia, espaçamento e cópia estão no README.
>
> **Importante (read-only):** não há cadastro/edição de meta nesta tela — nenhum `useMutation`, nenhum formulário de gravação. As metas vêm da apuração/origem via GET. O seletor de métrica e a ordenação são apenas estado de UI no cliente.

---

## Visão geral

O módulo Produtividade (`/produtividade`) hoje tem **Visão Geral**, **Frentistas** e **Vendedores**. Esta entrega adiciona a aba **Metas**, que acompanha o **atingimento de metas individuais dos frentistas** em três métricas, substituindo (com muito mais legibilidade) o relatório Power BI "PRODUTIVIDADE" usado hoje.

Cada frentista tem uma meta mensal por métrica; a tela mostra meta, realizado, % de atingimento (barra colorida), e consolida a equipe (total, % geral, quantos bateram a meta, distribuição por faixa, destaque e ponto de atenção).

## Sobre os arquivos deste bundle

Os arquivos aqui são **referência de design feita em HTML** — protótipo do visual/comportamento pretendidos, **não** código de produção. A tarefa é **recriar este design no codebase Visor360** (React + TS + Tailwind + shadcn/ui), reaproveitando componentes e padrões existentes.

## Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento e estados são finais e seguem `docs/DESIGN-SYSTEM.md`.

---

## Onde implementar (arquivos a tocar)

| Arquivo | Mudança |
|---|---|
| `src/pages/Operacao/components/produtividade/subTabs.ts` | Adicionar a sub-aba `{ key: 'metas', label: 'Metas', icon: Target }`. |
| `src/pages/Produtividade/index.tsx` | Incluir `'metas'` no tipo `SubTab` e no type-guard do `useTabParam`; renderizar `{prodTab === 'metas' && <MetasFrentistas />}`. |
| `src/store/moduleLayout.ts` (`useProdutividadeLayout`) | Incluir `{ id: 'metas', label: 'Metas', visible: true }` na lista default. |
| `src/components/layout/Sidebar.tsx` | O `MODULE_SUBOPTIONS['/produtividade']` **já** lista `{ label: 'Metas', to: '/produtividade?tab=metas', Icon: Target }` — confirmar que o deep-link funciona. |
| `src/pages/Produtividade/components/MetasFrentistas.tsx` | **Novo.** Componente da aba (seletor + KPIs + tabela + distribuição + destaques). |
| `src/pages/Produtividade/hooks/useMetasFrentistas.ts` | **Novo.** Hook que monta, por frentista e por métrica, `{ meta, realizado, pct }` a partir da apuração e do cadastro de metas (GET). |

> **Dados (read-only):** o **realizado** vem da apuração de abastecimentos/vendas por funcionário (mesmos endpoints já usados em `useOperacaoData` / `useAbastecimentosAnalytics`). A **meta** vem do cadastro de metas do sistema de origem (Quality Automação) — leitura via GET. Não criar gravação. O seletor de métrica e a ordenação são estado local (`useState` / props).

---

## Telas / Views

### Aba: Metas (Produtividade)
- **Propósito:** gestor acompanha o atingimento das metas individuais dos frentistas, por métrica, e identifica destaques e atrasos.
- **Largura de conteúdo:** `max-width: 1280px`, centralizado, dentro da área padrão (`padding: 24px`, fundo `#f9fafb`).
- **Estrutura vertical** (gap `16px`):
  1. **Barra de controle** — seletor de métrica (segmented) à esquerda; legenda de cores à direita.
  2. **Grid de 4 KPI cards** — `repeat(4, 1fr)`, gap `16px`.
  3. **Card "Atingimento por frentista"** — nota informativa + tabela com barras + linha de total.
  4. **Linha final** — `grid-template-columns: 1.3fr 1fr`, gap `16px`: Distribuição da equipe + Destaques.

Veja `screenshots/01-visao-geral.png`.

---

### Componente 1 — Seletor de métrica (segmented control)

Container: `display:inline-flex; padding:4px; gap:4px; background:#fff; border:1px solid #e5e7eb; border-radius:12px`. Cada botão: `height:36px; padding:0 16px; border-radius:9px; font-size:13px/600`, com ícone 15px à esquerda.
- **Ativo:** `background:#1e3a5f; color:#fff`.
- **Inativo:** `background:transparent; color:#4b5563` (hover leve `#f3f4f6`).
- Opções: **Abastecimentos** (ícone `bar-chart-3`), **Venda Bruta** (`dollar-sign`), **Aditivada** (`droplet`/`fuel`).

À direita, legenda: 3 quadradinhos 9px — verde `#22c55e` "≥ 100%", âmbar `#f59e0b` "80–99%", vermelho `#ef4444` "< 80%".

Trocar a métrica recalcula KPIs, tabela, distribuição e destaques. Veja a diferença em `screenshots/04-metrica-venda-bruta.png`.

---

### Componente 2 — KPI cards (4)

Card base: `background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:20px; box-shadow:0 1px 2px rgba(0,0,0,.04)`.

| # | Título | Valor | Rodapé / extra | Visual |
|---|---|---|---|---|
| 1 | **Meta da equipe** | total da meta (30px/700, branco) | `Posto Norte Sul · Maio/2025` | Card **navy** `linear-gradient(135deg,#1e3a5f,#27496f)`, ícone `target`. |
| 2 | **Realizado** | total realizado (30px/700) | label `vs. meta total` + pill `% atingimento` colorida | ícone `activity`, chip `#dbeafe`/`#2563eb`. |
| 3 | **Atingimento** | `% geral` (30px/700, **cor pela faixa**) | mini barra de progresso (`width = min(%,100)`) | ícone `gauge`, chip `#ede9fe`/`#7c3aed`. |
| 4 | **Bateram a meta** | `N / total` (30px/700; total em 18px `#9ca3af`) | `X abaixo de 80%` | ícone `check-circle`, chip `#dcfce7`/`#16a34a`. |

A cor da faixa (KPI 3 e a pill do KPI 2): ver tabela de faixas abaixo.

---

### Componente 3 — Tabela "Atingimento por frentista"

Card base com `overflow:hidden`. Header: título 15px/600 (`Atingimento por frentista — <métrica>`), subtítulo 12px `#6b7280` (`Meta individual vs. realizado · ordenado por <ordenação>`), seguido da **nota informativa**:

> Banner: `background:#eff6ff; border:1px solid #dbeafe; border-radius:9px; padding:10px 12px`, ícone `info` `#2563eb` 16px, texto 12px `#1e40af`: *"As metas são cadastradas no **sistema de origem** (cadastro de metas da apuração — Quality Automação). O Visor360 é somente leitura: ele apenas exibe os valores. Para definir ou alterar a meta de um frentista, ajuste no sistema de origem; a tela reflete o novo valor na próxima sincronização."*

Tabela (`font-size:13px`):
- **Cabeçalho:** `background:#f3f4f6`, 11px/600 uppercase `letter-spacing:.03em` `#6b7280`. Colunas: `Frentista` | `Meta` (dir.) | `Realizado` (dir.) | `Atingimento` (barra, ~300px) | `Mix` (dir., **só na métrica Aditivada**).
- **Linhas:** `border-top:1px solid #f3f4f6`; zebra ímpar `#f9fafb`; hover `#eff6ff`; padding `11px 16/20px`; números `tabular-nums`.
- **Coluna Frentista:** bolinha 8px colorida pela faixa + nome 13px/600.
- **Coluna Atingimento:** `flex` com barra (`flex:1; height:10px; background:#f3f4f6; border-radius:999px`) cujo preenchimento tem `width = clamp(2%, %, 100%)` e cor da faixa; à direita, o `%` (62px, 13px/700) na cor da faixa. Atingimentos > 100% mostram a barra cheia (preenchida) e o número real (ex.: 146,1%).
- **Sem meta** (meta = 0): % = `s/ meta`, cor neutra cinza (`#94a3b8`), barra vazia; sempre ordenado por último.
- **Rodapé (`tfoot`):** linha **Total da equipe** — `border-top:2px solid #e5e7eb; background:#fafafa`, valores em 700, mesma barra/`%` consolidados.

Veja `screenshots/02-tabela-atingimento.png`.

---

### Componente 4 — Distribuição + Destaques

**Distribuição da equipe** (esq.): título + barra empilhada (`height:16px; border-radius:8px`) com 3 segmentos proporcionais (verde/âmbar/vermelho). Abaixo, 3 colunas com contagem (24px/700) e label, cada uma com borda-esquerda 3px na cor da faixa: "bateram a meta", "entre 80 e 100%", "abaixo de 80%".

**Destaques** (dir.): título + subtítulo (`<métrica> · maior e menor atingimento`). Dois blocos:
- **Destaque do mês** — `background:#f0fdf4; border:1px solid #bbf7d0`, ícone `trophy` (`#16a34a`), nome 14px/700, à direita `%` (16px/700 `#15803d`) + realizado.
- **Precisa de atenção** — `background:#fef2f2; border:1px solid #fecaca`, ícone `alert-triangle` (`#dc2626`), nome + `%` (16px/700 `#b91c1c`) + realizado.

Veja `screenshots/03-distribuicao-destaques.png`.

---

## Faixas de atingimento (cores)

| Faixa | Barra/preenchimento | Texto | Bolinha | Badge bg |
|---|---|---|---|---|
| ≥ 100% | `#22c55e` | `#15803d` | `#22c55e` | `#dcfce7` |
| 80–99,99% | `#f59e0b` | `#a16207` | `#f59e0b` | `#fef9c3` |
| < 80% | `#ef4444` | `#b91c1c` | `#ef4444` | `#fee2e2` |
| sem meta | `#cbd5e1` | `#94a3b8` | `#cbd5e1` | `#f1f5f9` |

`pct = meta > 0 ? realizado / meta * 100 : null`. O **% da equipe** usa apenas quem tem meta no denominador.

## Interações & Comportamento

- **Abas do módulo:** controladas por URL via `useTabParam` (`?tab=metas`). A aba Metas fixa a base de data em abastecimento (padrão do módulo).
- **Seletor de métrica:** estado local (`useState`), default **Abastecimentos**. Recalcula KPIs/tabela/distribuição/destaques.
- **Ordenação (tweak/controle):** por **% Atingimento** (default), **Realizado** ou **Meta**; direção decrescente/crescente. Sem-meta sempre por último.
- **Filtro de período:** `DateRangeToolbar` global (o período define o realizado).
- **Hover de linha:** `#eff6ff`. **Loading:** `KpiSkeleton`/`TableSkeleton`. **Empty:** `SelectCompanyState` (sem empresa) / `EmptyState` (sem dados).
- **Nenhuma edição:** a tela não grava metas (read-only). A nota informativa comunica onde a meta é definida.

## Estado / Dados

- **Estado de UI:** `metrica` ('abastecimentos' | 'venda' | 'aditiv'); ordenação e direção.
- **Por frentista, por métrica:** `meta`, `realizado`, `pct`, e (para Aditivada) `mix %`.
- **Derivados da equipe:** total meta, total realizado, % geral, nº que bateram a meta, nº abaixo de 80%, distribuição por faixa, destaque (maior %) e atenção (menor %).
- **Origem:** realizado = apuração por funcionário (GET); meta = cadastro de metas da origem (GET). React Query com `queryKey` incluindo `empresaCodigo` + período.

## Design Tokens (resumo)

**Cores** — Navy `#1e3a5f`→`#27496f` · Accent `#2563eb` · texto `#111827`/secundário `#6b7280`/muted `#9ca3af` · borda `#e5e7eb`/divisor `#f3f4f6` · fundo `#f9fafb` · header tabela `#f3f4f6` · zebra `#f9fafb` · hover `#eff6ff` · sidebar ativo `#e0f2fe`/`#0c4a6e`/barra `#0ea5e9`. Faixas: ver tabela acima. Nota info: bg `#eff6ff`, borda `#dbeafe`, texto `#1e40af`.

**Tipografia** — Inter. KPI 30px/700 · seção 15px/600 · % na tabela 13px/700 · tabela 13px/400–600 · labels 11px/600 uppercase. `font-variant-numeric: tabular-nums` em todos os números.

**Forma** — card radius `16px` · barra de progresso `999px` · segmented `12px`/botão `9px` · padding card `20px` · shadow `0 1px 2px rgba(0,0,0,.04)`.

**Ícones** — Lucide: `target` (aba), `bar-chart-3`, `dollar-sign`, `droplet`/`fuel`, `activity`, `gauge`, `check-circle`, `trophy`, `alert-triangle`, `info`.

## Dados de exemplo (relatório real — Posto Norte Sul · Maio/2025)

Cada frentista tem meta/realizado nas 3 métricas:

```
Frentista                          ABAST (meta/real)   VENDA R$ (meta/real)      ADITIV L (meta/real, mix)
Isaac Santos Machado               1.900 / 2.776       2.700 / 2.794,66          2.400 / 1.769  (5,64%)
Sidney Nobre                       1.900 / 2.371       1.300 / 901,47            1.600 / 1.669  (7,24%)
Chytila da Silva Ferreira          1.900 / 2.226       3.000 / 3.812,97          2.400 / 2.437  (8,91%)
Valter Francisco da Silva Filho    1.900 / 2.224       2.700 / 210,50            2.800 / 792    (3,22%)
Elias Santana Gonçalves            1.900 / 2.062       2.300 / 3.016,70          2.400 / 2.067  (8,48%)
Juliano Pereira de Jesus           1.900 / 1.825       2.200 / 1.330,98          2.400 / 2.329  (10,67%)
Alessandro Odilia                  1.900 / 1.482       3.700 / 4.435,14          2.400 / 1.781  (9,87%)
Sebastião Barbosa de Souza         1.900 / 1.337       1.300 / 379,00            1.600 / 707    (5,78%)
Vitor Santos Rios                  1.900 / 1.283       1.000 / 1.089,44          1.000 / 1.768  (11,26%)
Eduardo Lannes Santucci            1.900 / 661         0 / 54,00 (s/ meta)       0 / 467 (s/ meta, 5,60%)
Genivaldo Santana dos Santos       1.900 / 633         29.500 / 33.298,87        1.400 / 472    (5,92%)
```
Ordenação default: por **% Atingimento** desc. Todos os valores são dados reais do relatório — substituir pela apuração ao integrar. (O total/% da equipe considera só quem tem meta no denominador.)

## Assets

Nenhum asset proprietário. Ícones **Lucide React** e tipografia **Inter** já existem no projeto.

## Arquivos neste bundle

- `Produtividade Metas.dc.html` — protótipo de referência (interativo: troque a métrica).
- `screenshots/01-visao-geral.png` — topo (seletor + KPIs + nota).
- `screenshots/02-tabela-atingimento.png` — tabela completa com barras.
- `screenshots/03-distribuicao-destaques.png` — distribuição + destaques.
- `screenshots/04-metrica-venda-bruta.png` — estado com a métrica "Venda Bruta" selecionada.
