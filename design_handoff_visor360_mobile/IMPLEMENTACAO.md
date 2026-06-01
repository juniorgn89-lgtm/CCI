# Roteiro de Implementação — Visor360 Mobile

Guia faseado para implementar o design no codebase real (`CCI` — React + TailwindCSS + shadcn/ui + lucide-react + Recharts). Use junto com o `README.md` (especificação detalhada de cada tela).

> **Premissa:** produto **read-only**. Nenhuma rota de escrita, formulário de cadastro ou ação de CRUD. Toda a complexidade é de leitura, filtro, navegação e visualização.

> **Estimativas** em "pontos" relativos (1 ponto ≈ meio dia de 1 dev familiarizado com o codebase). Ajuste à realidade do time. Total ≈ **58–72 pts**.

---

## Fase 0 — Fundação (bloqueia tudo) · ~8–10 pts
Antes de qualquer tela. Entrega a base reutilizável.

| Item | Descrição | Pts |
|---|---|---|
| Tokens & tema | Mapear cores/tipografia/espaçamento do design para os tokens do projeto; garantir dark mode (VSCode Dark Modern). | 2 |
| Shell mobile | Header navy (≤56px, pill "Tempo real", sino, tema) + `<main>` rolável + safe areas. | 2 |
| Bottom-nav + "Mais" | Barra de 4 + drawer de módulos agrupados; personalização (fixar até 4, `localStorage: visor360.bar`, toque-longo p/ editar). | 2 |
| Painel de Filtros | Bottom-sheet **descendo do topo**: Posto/Período(mês+datas)/Escopo/Comparativo + "Visualizar"; resumo na barra refletindo período real; conectar ao filter store. | 2 |
| Roteamento | Encaixar os ~12 módulos no React Router; transição de tela (fade-up). | 1 |

**Saída da fase:** navegar entre telas vazias com header, filtros e nav funcionando.

---

## Fase 1 — Biblioteca de componentes · ~10–12 pts
Os blocos que se repetem em todas as telas. Construir uma vez, usar em todas.

| Componente | Notas | Pts |
|---|---|---|
| `KpiCard` + `DeltaBadge` | Chip de ícone, valor grande, delta ▲/▼ com `vs <ref>`; variantes `big`/`span`. | 1.5 |
| `Section` (Card) | Header com chip + título + slot direito; modo `flush` p/ listas/tabelas. | 1 |
| `Badge` / `MarginPill` | Pílulas; heatmap de margem (verde/âmbar/vermelho por limiar). | 1 |
| `Segmented` / `ScrollTabs` | Segmented roláveis + abas de tela com sublinhado. | 1.5 |
| `ProjecaoSection` | Bloco de projeção: cards **total** (barra cumulativa) e **razão/tendência** (sem barra). Header "Dia 30/31" + barra de período. | 2 |
| Gráficos (Recharts) | AreaChart (área+linha tracejada), BarChart (último destacado), ranking horizontal, Donut (total no centro + legenda). Wrapper com a sequência de cores e tema. | 3 |
| Estados | `LoadingScreen` (skeleton), `EmptyCard` (âmbar), `NoCostNote`, `Skel`. | 1.5 |

**Saída da fase:** Storybook/catálogo dos componentes com light/dark.

---

## Fase 2 — Telas prioritárias (entregáveis do brief) · ~16–20 pts
Ordem recomendada (valor + dependências). Cada tela: ligar dados reais (React Query), respeitar filtros, cobrir loading/vazio.

1. **Central da Rede** (~4) — KPIs consolidados, evolução mensal, ranking de postos (heatmap + projeção inline), donut de pagamentos, projeção. *Sem barra de filtro.*
2. **Vendas › Combustível** (~4) — KPIs 2×2, nota "sem custo apurado", projeção, volume/margem mensais, **tabela por combustível** (colunas priorizadas + projeção inline + expandir).
3. **Caixas & Turnos** (~3) — KPIs (+ projeção do dia), turnos (turno aberto com projeção de fechamento), conferência.
4. **Fechamentos** (~3) — status do mês, **calendário de apuração**, pendências, últimos fechamentos, por posto.
5. **Inteligência › Radar de Preços** (~3) — meus preços vs mercado (range), concorrentes, mapa (placeholder → integrar depois).

**Saída da fase:** os 5 entregáveis prioritários no ar, com dados reais.

---

## Fase 3 — Demais abas e módulos · ~16–22 pts
Completar a paridade com o desktop.

| Tela | Pts |
|---|---|
| Vendas › Visão Geral (composição + evolução + projeção) | 2.5 |
| Vendas › Pista (litros por produto, pagamentos, projeção) | 2 |
| Vendas › Conveniência (top produtos, categorias, projeção) | 2 |
| Inteligência › Análise & Comparação (comparar postos, atual vs anterior, projeção da rede) | 3 |
| Inteligência › Cadu IA (assistente — integrar com o serviço de IA real) | 3 |
| Financeiro (fluxo, DRE simplificada, contas a pagar, projeção) | 3 |
| Estoques (níveis de tanque heatmap, cobertura, reposição sugerida) | 2.5 |
| Bombas (bicos, encerrantes, status de aferição) | 1.5 |
| Produtividade (ranking de frentistas + expandir) | 1.5 |
| Qualidade de Dados (cobertura por fonte, lacunas) | 1.5 |
| Pessoas (equipe por posto, por função) | 1 |

---

## Fase 4 — Polimento e produção · ~8–10 pts
| Item | Pts |
|---|---|
| Microinterações (transições, press, indicador de nav, pop do ícone) | 1.5 |
| Acessibilidade (alvos ≥44px, contraste, foco, leitor de tela) | 2 |
| Responsividade 320→430px (1 col → 2 col) e testes em aparelhos reais | 2 |
| Desempenho (memo de gráficos, listas, lazy de módulos) | 1.5 |
| QA com gerente de posto + revisão de números/labels com o negócio | 1.5 |
| Deploy no pipeline existente do `CCI` | 1 |

---

## Checklist por tela (aplicar a cada uma)
- [ ] Layout fiel ao design (grid, espaçamento, tipografia, raio, sombra)
- [ ] Light **e** dark
- [ ] Dados reais via React Query, respeitando o filtro global
- [ ] Estado de **loading** (skeleton) e **vazio** (card âmbar)
- [ ] Nota "sem custo apurado" onde aplicável
- [ ] Projeção: totais por ritmo, razões por tendência (regra de negócio definida)
- [ ] Números em pt-BR (BRL, litros, % com vírgula, variação com seta)
- [ ] Touch targets ≥44px; tabelas expansíveis funcionando
- [ ] Sem nenhuma ação de CRUD
- [ ] Revisado em aparelho real (≤430px)

---

## Riscos & decisões a confirmar
- **Projeções:** definir a fórmula oficial (linear por ritmo vs. tendência) com o time de dados — hoje os valores são ilustrativos.
- **Radar de Preços:** origem dos preços de concorrentes e do **mapa** (provedor) precisa ser definida.
- **Cadu IA:** integração com o serviço de IA real (prompts, contexto do período filtrado, custo).
- **Personalização da barra:** confirmar se a preferência é por dispositivo (`localStorage`) ou por usuário (perfil no backend).
- **"Em tempo real":** definir a estratégia de atualização (polling/websocket) por trás do pill do header.

---

## Caminho mais rápido
Entregar este pacote (handoff + esta especificação) ao **Claude Code** apontando para o repo `CCI`: ele consegue implementar tela a tela seguindo o README e este roteiro, reaproveitando os componentes shadcn/ui e os gráficos Recharts já existentes.
