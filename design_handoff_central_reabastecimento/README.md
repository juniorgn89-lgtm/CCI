# Handoff: Aba "Reabastecimento" (Central da Rede) — 3 sub-abas: Combustível · Automotivo · Conveniência

> **Prompt pronto pro Claude Code (VS Code).** Cole a seção [▶ Prompt](#-prompt-para-o-claude-code) e anexe as 3 imagens em `screenshots/`. O restante é a especificação completa.

---

## ▶ Prompt para o Claude Code

> Expanda a aba **"Reabastecimento"** da **Central da Rede** (`src/pages/Dashboard/`) para cobrir **3 sub-abas**: **Combustível** (atual, redesenhado), **Automotivo** e **Conveniência** — todas com a **mesma anatomia**. Siga os padrões do projeto (React + TS + Tailwind + shadcn + TanStack Query + Zustand, **somente GET / read-only**).
>
> Cada sub-aba tem: (1) **sub-tab switcher** centralizado (Combustível · Automotivo · Conveniência); (2) **4 KPIs** — hero navy (total/compra sugerida) + 3 cards de status; (3) **cards de item** que precisam de atenção (barra de nível/estoque, badge, última compra, sugestão de compra, e — na Conveniência — alerta de validade); (4) **tabela de reposição por posto** (consolidado por produto, com barras). Os **títulos das seções têm um "?" (InfoHint)** explicando o **critério de seleção** dos itens e a **fórmula da sugestão**.
>
> O layout-alvo está nas 3 imagens anexas e no protótipo `Central da Rede - Reabastecimento.dc.html`. **As imagens e o HTML são REFERÊNCIA de design** — recrie reaproveitando o que já existe pra Combustível (`ReabastecimentoCard`, `useReabastecimento`, `TanqueCard`, `ReposicaoTabela`, `reposicao.ts`) e o componente `InfoHint`; não copie o HTML.
>
> **⚠ Dados:** Combustível já vem do `useReabastecimento` (tanques). **Automotivo e Conveniência dependem do estoque de produtos com ponto de pedido / mínimo + giro + (validade)** — provavelmente do módulo **Estoques**, NÃO do hook de tanques. Antes de implementar os dois novos, confirme com o backend se a API expõe esses campos por produto. Se não expuser, deixe as sub-abas atrás de feature-flag e me avise — não invente dado. Tudo **read-only**, sem `useMutation`.

---

## Visão geral

A aba Reabastecimento hoje só trata **combustível** (tanques com nível baixo + relatório de reposição). Esta entrega generaliza o conceito de "o que comprar" para os **três mundos de estoque do posto**, com a mesma anatomia visual e a lógica de reposição adequada a cada um:

| | **Combustível** (atual) | **Automotivo** (lubrificantes, filtros, aditivos) | **Conveniência** (bebidas, snacks, tabacaria) |
|---|---|---|---|
| Unidade | litros / % do tanque | unidades | unidades |
| Gatilho de compra | nível < 30% (crítico < 20%) | estoque < **ponto de pedido** | estoque < **mínimo** |
| Priorização | menor nível primeiro | **curva ABC** (A primeiro) | giro + **validade** |
| Sinais extras | estoque negativo | ruptura (zerado) | ruptura + **vencendo (15d)** |
| Fórmula da sugestão | consumo/dia × dias restantes − estoque | (giro × lead time + segurança) − estoque | giro × cobertura − estoque |

## Sobre os arquivos deste bundle

São **referência de design feita em HTML** — protótipo do visual/comportamento, **não** código de produção. Recrie no codebase Visor360 reaproveitando os componentes de reabastecimento existentes + `InfoHint`.

## Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento e estados seguem `docs/DESIGN-SYSTEM.md`.

---

## Onde implementar (arquivos a tocar)

| Arquivo | Mudança |
|---|---|
| `src/pages/Dashboard/components/ReabastecimentoCard.tsx` | Redesign + **sub-tab switcher** (Combustível/Automotivo/Conveniência). Estado de UI `sub`. Combustível reaproveita a lógica atual (`useReabastecimento`). |
| `src/pages/Dashboard/components/AutomotivoReposicao.tsx` (novo) | Sub-aba Automotivo: KPIs (abaixo do ponto / ruptura / curva A em risco), cards de item (estoque vs ponto de pedido, curva ABC), tabela (Estoque · Ponto pedido · Giro/sem · Sugestão un). |
| `src/pages/Dashboard/components/ConvenienciaReposicao.tsx` (novo) | Sub-aba Conveniência: KPIs (abaixo do mínimo / ruptura / vencendo), cards (estoque vs mínimo + alerta de validade), tabela (Estoque · Mínimo · Giro/sem · Sugestão un). |
| `src/pages/Dashboard/hooks/useReposicaoProdutos.ts` (novo) | Hook read-only que busca estoque de produtos não-combustível (estoque atual, ponto de pedido/mínimo, giro, validade) — provavelmente do módulo **Estoques**. **Confirmar disponibilidade na API.** |
| Componentes compartilhados (`KpiHero`, card de item, tabela de reposição) | Extrair os blocos comuns pra os três reaproveitarem (cor/rótulo por prop). |
| `InfoHint` (existente) | Reaproveitado nos "?" dos títulos. |

> **Read-only:** sub-tabs, filtros de status e tooltips são UI no cliente. Combustível usa `useReabastecimento`; Automotivo/Conveniência usam o novo hook de produtos (GET). Nenhum `useMutation`.

---

## Estrutura compartilhada (vale pras 3 sub-abas)

1. **Sub-tab switcher** centralizado — segmented control com ícone + label (Combustível: bomba · Automotivo: carro · Conveniência: sacola). Ativo navy `#1e3a5f`.
2. **KPIs (4):** `KpiHero` navy + 3 `KpiCard` de status (variam por sub-aba — ver tabela abaixo).
3. **Itens que precisam de atenção** — título + **"?" (InfoHint)** explicando o critério de seleção + filtro de status (segmented). Grid de **cards** (3 col).
4. **Reposição por posto** — título + **"?"** explicando a fórmula da sugestão + total. Por posto: cabeçalho + tabela consolidada por produto com barras.

### KPIs por sub-aba
| Sub-aba | Hero (navy) | Card 2 | Card 3 | Card 4 |
|---|---|---|---|---|
| **Combustível** | Total a comprar `84.500 L` | Críticos `5` (<20%) | Em alerta `9` (20–30%) | Estoque negativo `1` |
| **Automotivo** | Compra sugerida `R$ 38.400` | Abaixo do ponto `12` | Em ruptura `3` | Curva A em risco `5` |
| **Conveniência** | Compra sugerida `R$ 22.700` | Abaixo do mínimo `18` | Em ruptura `4` | **Vencendo `6`** (próx. 15d) |

### Card de item (genérico)
Nome + subtítulo (categoria · posto) + badge de status (Crítico/Alerta/Negativo/Ruptura/Vencendo). Barra de nível + valor grande (% pra combustível; "N un" pra produtos). Linha de referência ("1.260 L de 15.000 L" / "9 un · ponto de pedido 50" / "24 un · mínimo 100"). Rodapé: **última compra** (vol + data + R$) e **sugestão de compra** (vol + cobertura). Na **Conveniência**, itens perecíveis ganham uma **3ª linha de validade** ("Vence em 9 dias · revisar"/"promover") e sugestão **0 un** (não repor).

### Tabela de reposição (genérica)
Por posto: Produto (+ nº itens) · **Estoque atual** (barra colorida pela criticidade) · **Ref** (Capacidade / Ponto pedido / Mínimo — texto) · **Ritmo** (Ritmo/dia ou Giro/sem — barra verde) · **Sugestão** (barra azul). Cabeçalhos mudam o rótulo por sub-aba.

### "?" InfoHint — textos por sub-aba
**Critério de seleção (título "Itens que precisam de atenção"):**
- **Combustível:** "Tanques com nível abaixo de 30%: crítico (<20%, risco de ruptura), alerta (20–30%) e estoque negativo (escritural < 0 — nota de entrada não lançada). Ordenados do menor nível ao maior."
- **Automotivo:** "Produtos com estoque abaixo do ponto de pedido (nível que aciona recompra). Priorizados pela curva ABC: itens A (alto giro) primeiro — ruptura neles é venda perdida. Ruptura = estoque zerado."
- **Conveniência:** "Produtos abaixo do mínimo, em ruptura, ou perto de vencer (15 dias). Itens vencendo recebem sugestão 0 — escoar/promover o atual. Ordenados por giro."

**Fórmula da sugestão (título "Reposição … por posto"):**
- **Combustível:** "Sugestão = consumo médio diário × dias restantes do mês − estoque atual."
- **Automotivo:** "Sugestão (un) = (giro semanal × lead time + estoque de segurança) − estoque atual."
- **Conveniência:** "Sugestão (un) = giro semanal × cobertura desejada − estoque atual. Itens com validade próxima são excluídos da compra."

---

## Interações & Comportamento
- **Sub-tabs:** trocam todo o conteúdo (KPIs, cards, tabela, textos do "?"). Default = Combustível. O contador no rótulo da aba reflete o nº de alertas da sub-aba ativa.
- **Filtro de status:** segmented (varia por sub-aba: Todos/Críticos/Alerta/Negativo ou Todos/Ruptura/Críticos/Alerta) filtra os cards.
- **"?" (InfoHint):** hover mostra o critério/fórmula.
- **Loading/Empty:** skeletons; "sem itens em atenção".

## Design Tokens (resumo)
Navy `#1e3a5f`→`#27496f` · texto `#111827`/`#6b7280`/`#9ca3af` · borda `#e5e7eb`/`#f1f3f5`. Status: crítico/ruptura `#b91c1c`/`#fee2e2`/barra `#ef4444`; alerta `#b45309`/`#fef3c7`/`#f59e0b`; vencendo `#c2410c`/`#ffedd5`/`#fb923c`; negativo `#7e22ce`/`#f3e8ff`/`#a855f7`. Barras tabela: estoque (criticidade), ritmo/giro verde `#10b981`, sugestão azul `#2563eb`. Sub-tab/filtro ativo navy. Tooltip `#1f2937` texto `#f9fafb`.
Inter; KPI hero 30px/700 · KPI 24px/700 · card item nome 15px/700, valor 20px/700 · seção 15px/600 · tabela 13px · labels 10px/600 uppercase; `tabular-nums`. Card radius 16, pills 999, shadow `0 1px 2px rgba(0,0,0,.04)`.
Ícones Lucide: `fuel` (combustível), `car`/`truck` (automotivo), `shopping-bag` (conveniência), `shopping-cart` (hero), `alert-triangle`, `clock`, `package`/`box`, `star` (curva A), `calendar-clock` (validade), `help-circle` ("?"), `building-2` (posto), `trending-down` (sugestão).

## Dados de exemplo (mock do protótipo)
**Combustível:** total 84.500 L (~R$ 487 mil); 5 críticos / 9 alerta / 1 negativo. Cards: Tanque 03 Gasolina Comum 8,4% (1.260/15.000 L), … Tanque 07 negativo (−340 L). Reposição: Rodovia (Diesel S10 3.360→26.200; Gasolina 3.390→8.200), etc.
**Automotivo:** compra R$ 38.400; 12 abaixo do ponto / 3 ruptura / 5 curva A. Itens: Óleo 15W40 (0 un, ponto 48, curva A → 96 un), Filtro FO-23 (0/30→60), Aditivo Radiador (9/50→60), Óleo 5W30 (11/50→72), Fluido DOT4 (14/50→48), Palheta 20" (18/60→42).
**Conveniência:** compra R$ 22.700; 18 abaixo do mínimo / 4 ruptura / 6 vencendo. Itens: Cerveja Lata (0/120→360), Energético (0/60→120), Água 500ml (19/120→216), Salgadinho (28/60, vence 9d → 0), Cigarro (24/100→180), Chocolate (34/60, vence 12d → 0).

Todos os valores são placeholder — substituir pela saída de `useReabastecimento` (combustível) e do novo hook de produtos (automotivo/conveniência).

## Assets
Nenhum asset proprietário. Ícones **Lucide React** e tipografia **Inter** já existem. "?" = componente `InfoHint` existente. Combustível reaproveita `TanqueCard`/`ReposicaoTabela`.

## Arquivos neste bundle
- `Central da Rede - Reabastecimento.dc.html` — protótipo interativo (trocar sub-abas, filtros, hover no "?").
- `screenshots/01-combustivel.png` — sub-aba Combustível (tanques).
- `screenshots/02-automotivo.png` — sub-aba Automotivo (ponto de pedido + curva ABC).
- `screenshots/03-conveniencia.png` — sub-aba Conveniência (mínimo + ruptura + vencendo).
