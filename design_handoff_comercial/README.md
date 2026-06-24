# Handoff: Módulo **Comercial** — Inteligência de Lucro (IA, read-only)

> Novo módulo do Visor360: um **analista de IA** que lê o banco (vendas, volume, margem, custo) + dados manuais (concorrência) e devolve **leitura precisa + recomendação priorizada** de onde ganhar lucro. **Não automatiza preço** — diagnostica, quantifica e prioriza; a decisão é do gestor.
>
> **Prompt pronto pro Claude Code** em [▶ Prompt](#-prompt-para-o-claude-code). Anexe as 4 imagens de `screenshots/`.

---

## ▶ Prompt para o Claude Code

> Implemente o módulo **Comercial** (`src/pages/Comercial/`) no Visor360 — um copiloto de **inteligência de lucro**, **read-only**, seguindo os padrões do projeto (React + TS + Tailwind + TanStack Query + Zustand, **somente GET**).
>
> São **4 abas**: **(1) Oportunidades** (fila priorizada de ganhos em R$/mês) · **(2) Projeção de LB** (projeção de lucro bruto do mês + evolução por dia-da-semana) · **(3) Margem por posto** (ranking de margem/litro + leitura do especialista) · **(4) Concorrência** (preço de praça por posto, com histórico de 30 dias).
>
> Um **flag global "Usar preços de concorrência nas análises da rede"** aparece no topo de **todas as abas** e troca a referência das análises de "média interna da rede" para "preço de praça". É **um único estado** (store Zustand `useComercialFlags`), não 4 toggles independentes — ligou numa, ligado em todas.
>
> Layout-alvo nas 4 imagens anexas e nos protótipos `Comercial *.dc.html`. **Imagens/HTML são REFERÊNCIA de design** — recrie reaproveitando os dados que já existem (vendas, volume, margem, custo de reposição) e o design system. **Nenhum `useMutation`; a IA não altera preço nem recalcula o que o sistema já apura — ela lê, cruza e prioriza.**
>
> **Antes de codar**, leia a seção "Contrato de dados" abaixo e me diga, por insight, o que vem do banco (fato) e o que é manual/requer histórico — no mesmo padrão honesto do módulo Fechamento por exceção.

---

## Posicionamento (o que este módulo É e NÃO é)

- **É:** camada de **diagnóstico e priorização** de lucro — "onde estou perdendo margem, onde tenho teto vs praça, quanto vale agir, como minha projeção evolui". Decisão de apoio.
- **NÃO é:** otimizador automático de preço. Não recomenda o preço "ótimo" exato (isso exigiria elasticidade medida) nem altera bomba. A UI rotula estimativa como estimativa e mantém "decisão é do gestor".
- **Princípio (inegociável):** a IA é **precisa onde o dado é fato** (margem, volume, gap vs preço informado) e **honesta onde projeta** (ganho potencial = teto, rotulado). Confiança visível por insight.

## Sobre os arquivos deste bundle
Referência de design em HTML — **não** é código de produção. Recrie no codebase.

## Fidelidade
**Alta fidelidade visual.** Tokens em `docs/DESIGN-SYSTEM.md`. Respeite o contrato de dados (fato × estimativa × manual).

---

## As 4 abas

### 1. Oportunidades (`screenshots/01-oportunidades.png`)
A IA varre a rede e devolve uma **fila priorizada por R$/mês** em 3 alavancas com dado real:
- **Margem de bomba** — postos com margem/litro abaixo da rede (ou da praça, se o flag estiver ligado).
- **Clientes de frota** — desconto espremido (acima da política) ou volume caindo (risco de perder o cliente).
- **Conveniência** — mix de alta margem abaixo do potencial, ruptura em item-chave.

Banner IA soma o potencial total (+R$ 45 mil/mês). Cada item abre painel: **lucro estimado/mês**, **de → para** (margem atual → alvo conservador), **"como a IA estimou"** (volume × gap), **risco** e ações (Criar plano / Simular). Filtros por alavanca. Hero navy: potencial total + KPIs (margem média, maior alavanca, ação rápida de maior R$/esforço).

### 2. Projeção de LB (`screenshots/02-projecao-lb.png`)
Responde "**quanto vou lucrar este mês?**":
- **Hero:** projeção de LB do mês (R$ 1,28 mi, acum. até ontem — não inclui o dia em curso) + realizado vs projeção (76%).
- **KPIs:** Var. semanal (mesmo dia: terça 23/06 vs terça 16/06), **L.B./litro**, vs mês passado (terças de junho vs maio).
- **Evolução por dia-da-semana:** as 4 terças do mês (02→09→16→23/06) com Δ% — o **seletor Seg…Sáb** troca a série. Compara **mesmo dia da semana** pra neutralizar sazonalidade (a regra está na nota de rodapé).
- Barras diárias do mês (terças destacadas) + "de onde vem o ganho" (volume × margem/litro) + "quem puxou" (contribuição por posto vs semana anterior).

### 3. Margem por posto (`screenshots/03-margem-posto.png`)
**Ranking de lucratividade por unidade:**
- KPIs: margem média da rede, maior margem (melhor posto), menor margem (requer atenção), ganho potencial se os 3 piores subirem à média.
- **Leitura do especialista:** "o que está acontecendo" (margem dispersa, Posto Serra sangra no Diesel, Rodovia vende volume com preço baixo) + "o que fazer" (atacar o custo, reajuste escalonado, premium na aditivada, régua de preço por praça).
- Ranking ordenável (margem/L · lucro bruto · volume), cada posto expande em **drill por combustível**.

### 4. Concorrência (`screenshots/04-concorrencia.png`)
**Pricing por localidade** (cada posto tem sua praça):
- **Seletor "Meu posto"** — troca toda a análise pra praça daquele posto.
- KPIs: índice de preço (meu vs praça, 100 = média), onde posso subir (abaixo da praça), onde estou caro (risco de volume), ganho de pricing (teto ao alinhar à praça).
- Tabela de concorrentes próximos (nome, **nº de postos**, preço por combustível — editáveis), com a linha **★ Meu posto** + média **ponderada por nº de postos**.
- **Histórico de 30 dias por combustível** (sua linha cheia + pontos esparsos dos concorrentes) + selo **"alterado há X dias · DD/MM"** com a confiança da IA caindo conforme o dado envelhece.

---

## O flag global "Usar preços de concorrência"
- Aparece no **topo de todas as 4 abas** (faixa azul com toggle).
- **Ligado:** as análises da rede (Oportunidades, Margem, Projeção) usam o **preço de praça** como referência em vez da média interna. **Desligado:** usam a média interna da rede.
- **Implementação:** estado único em `useComercialFlags` (Zustand). No protótipo, cada aba tem seu toggle por serem arquivos separados — **no código é um só** (ligou numa, reflete em todas).

---

## Onde implementar

| Arquivo | Conteúdo |
|---|---|
| `src/pages/Comercial/index.tsx` | Shell + 4 abas + flag global no topo (acima do conteúdo de cada aba). |
| `components/Oportunidades.tsx` | Fila priorizada + painel de detalhe (de→para, como estimou, risco, ações). |
| `components/ProjecaoLB.tsx` | Hero + KPIs + evolução por dia-da-semana + barras diárias. |
| `components/MargemPosto.tsx` | Ranking + leitura do especialista + drill por combustível. |
| `components/Concorrencia.tsx` | Seletor de posto + tabela editável + histórico 30d + frescor. |
| `hooks/useComercialData.ts` | Deriva margem/volume/LB/custo por posto e combustível (GET). |
| `hooks/useConcorrencia.ts` | Lê preços de praça manuais + histórico 30d (cadastro/coleta). |
| `store/comercialFlags.ts` | Flag global "usar preço de praça" (Zustand). |

---

## Contrato de dados (fato × estimativa × manual) — LER ANTES DE CODAR

| Insight | Natureza | Origem / requisito |
|---|---|---|
| Margem/litro, LB, volume, ranking, evolução das terças | ✅ **Fato** | banco (vendas + **custo de reposição**). Precisão depende do custo estar atualizado (última carga), senão erra nos dias de virada de preço. |
| Gap vs concorrente, índice de preço, "onde subir/caro" | ✅ **Fato** (sobre dado manual) | preço de praça **informado**. Preciso = só enquanto o dado é fresco → mostrar data/origem; confiança cai com a idade. |
| Ganho potencial (R$/mês de cada oportunidade) | 🟡 **Estimativa (teto)** | gap × volume **assumindo volume constante**. É o teto, não o esperado — **rotular como estimativa**. O resultado real depende da reação de mercado (elasticidade). |
| Projeção de LB do dia em curso | 🟡 **Estimativa** | ritmo até agora + padrão do dia-da-semana. Alinhar a regra com o time (% do dia decorrido / média das últimas N terças). |
| Preço de concorrência | 🟠 **Manual** | cadastro/coleta (foto, app, ANP). Sem isso, o flag "usar praça" não tem base. Frescor é o que sustenta "preciso". |
| Histórico de preço 30d | ✅ **Fato (seu)** / 🟠 **manual (concorrente)** | seu = registro exato de cada alteração; concorrente = esparso conforme coleta. Mostrar com fidelidade visual diferente. **É a base pra elasticidade futura** — começar a gravar já. |
| Elasticidade (quanto subir exatamente) | 🔴 **Não temos** | exige regressão volume × preço histórica — **roadmap**, não lançamento. Não prometer. |

> **Compliance (CADE):** a tela usa **preço público observado** (bomba/placa), nunca preço combinado entre concorrentes. Deixar isso explícito é bloqueante pro jurídico de redes maiores.

## Roadmap (pós-MVP, em ordem de prioridade)
1. **Custo de reposição atualizado** (sem isso a margem é fictícia nos dias críticos).
2. **Processo de coleta diária de concorrência** + timestamp (já modelado no histórico 30d).
3. **Elasticidade histórica** (regressão volume×preço) — transforma "teto" em "esperado". O histórico de 30d é a fundação.
4. **Disclaimer/compliance CADE** visível.
5. **Fluxo de execução** (recomendação → tarefa de troca de preço na pista).

## Design Tokens (resumo)
Navy `#1e3a5f`→`#27496f` (hero) · índigo IA `#4f46e5`/`#eef2ff` · flag azul `#2563eb`/`#eff6ff`/`#bfdbfe` · verde lucro `#16a34a`/`#15803d` · vermelho atenção `#b91c1c`/`#fee2e2` · âmbar `#b45309`/`#fef3c7`. Texto `#111827`/`#6b7280`/`#9ca3af`; borda `#e5e7eb`/`#f1f3f5`. Inter; hero 30px/800 · KPI 22–24px/700 · seção 14px/600 · tabela 13px; `tabular-nums`. Card radius 16, pills 999, shadow `0 1px 2px rgba(0,0,0,.04)`.
Ícones Lucide: `trending-up` (módulo/sparkles IA), `flag` (o flag), `percent`/`fuel`/`truck`/`shopping-bag` (alavancas), `bar-chart-3`, `trophy`, `building-2`, `calendar`.

## Dados de exemplo (mock dos protótipos)
Oportunidades: +R$ 45 mil/mês total; margem média R$ 0,38/L; Posto Serra Diesel S10 R$ 0,21→0,33/L = +R$ 14,2 mil/mês (88% conf). Projeção: R$ 1,28 mi/mês (76% realizado); terças 02/06 R$ 42,1k → 23/06 R$ 48,2k (+14,5% no mês); L.B. R$ 0,405/L. Margem: maior Posto Avenida R$ 0,47/L, menor Serra R$ 0,21/L (−45% vs rede); ganho R$ 28 mil/mês alinhando os 3 piores. Concorrência Itapoá: índice 99; concorrentes Posto Ipê (2), Rede Brilho (3), Auto Posto Lima (1); meu Gasolina R$ 6,16 vs praça R$ 6,20.
Valores são placeholder — substituir pela saída dos hooks.

## Arquivos neste bundle
- `Comercial Lucro.dc.html` · `Comercial Projecao LB.dc.html` · `Comercial Margem Posto.dc.html` · `Comercial Concorrencia.dc.html` — protótipos interativos (flag, filtros, seletores, drill, histórico).
- `screenshots/01-oportunidades.png` · `02-projecao-lb.png` · `03-margem-posto.png` · `04-concorrencia.png`.
