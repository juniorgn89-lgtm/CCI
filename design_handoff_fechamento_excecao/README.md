# Handoff: "Fechamento por exceção" — copiloto de fechamento de caixa (IA, Nível 1)

> **Protótipo conceitual + análise PM/Arquitetura.** Este NÃO é só uma tela: é a proposta de um recurso novo de IA para o módulo **Fechamento de Caixa**. Leia a seção [Conceito & faseamento](#conceito--faseamento) antes da spec visual — o escopo importa tanto quanto o layout.
>
> **Prompt pronto pro Claude Code** em [▶ Prompt](#-prompt-para-o-claude-code). Anexe as 2 imagens de `screenshots/`.

---

## ▶ Prompt para o Claude Code

> Implemente a **Fase 1** do recurso **"Fechamento por exceção"** — uma nova aba (read-only) no módulo **Fechamento de Caixa** (`src/pages/CaixasTurnos/`), deep-linkável via `?tab=excecao`. É um **copiloto que classifica, explica e prioriza** as diferenças de caixa do dia — **NUNCA recalcula valores** (o motor determinístico do Visor360 já calcula apurado/diferença; a IA só interpreta).
>
> A Fase 1 é **100% determinística e read-only** (regras, sem LLM, sem escrita): (1) classifica cada caixa fechado em **OK / Revisar / Investigar**; (2) **fila de exceção** ordenada por severidade (só os caixas que precisam de atenção); (3) **painel copiloto** por caixa: apresentado/apurado/diferença (do sistema), **causa provável** + **confiança**, **evidências** marcadas como *dado atual* vs *requer histórico*, **recorrência** do operador, ações sugeridas e **feedback 👍/👎**.
>
> Layout-alvo nas 2 imagens anexas e no protótipo `Fechamento por Excecao.dc.html`. **Imagens/HTML são REFERÊNCIA de design** — recrie no codebase reaproveitando `useOperacaoData` (turnoRows + conferenciaPdv), o helper `difCaixa` e os componentes do módulo; não copie o HTML.
>
> **Regras inegociáveis:** nenhum valor financeiro vem da IA — só do motor determinístico. Nenhuma aprovação automática (Fase 1 não grava nada; sem `useMutation`). As evidências de causa devem usar **apenas dados que a API expõe** (cruzamento de formas, taxa de cartão, magnitude/concentração) — **não** inventar sinais (ex.: câmera/CFTV não existe). Onde a evidência depende de base histórica que ainda não temos, marque como tal.

---

## Conceito & faseamento

**O problema:** hoje o gestor concilia caixa por caixa. O trabalho caro é **explicar a diferença** e **decidir o que fazer**. O "valor esperado" já é calculável de forma determinística (o sistema apura) — então a IA não precisa adivinhar número nenhum; só **explicar o gap e priorizar o risco**. É um caso em que IA acerta bem.

**Princípio de arquitetura (inegociável):** o **LLM/IA lê resultado, não produz número.** Todo valor financeiro vem do motor determinístico. Isso elimina a classe inteira de erro "a IA somou errado". Na Fase 1 nem há LLM — a classificação é por **regras**.

**Faseamento (cada fase tem ROI sozinha):**
| Fase | Entrega | Tecnologia | Escrita? |
|---|---|---|---|
| **0/1 — Fila de exceção** (este handoff) | Classifica OK/Revisar/Investigar + causa provável + recorrência, read-only | **Regras determinísticas** (sem IA generativa) | ❌ |
| **2 — Camada de recorrência** | Features por operador/PDV/turno no tempo; tolerância adaptativa; base rotulada | Estatística/ML | ❌ |
| **3 — Copiloto LLM + Q&A** | Narrativa em linguagem natural; "mostra os outros casos do João" | LLM **sobre dados já calculados** | ❌ |
| **4 — Fechamento real** | Auto-aprova caixas limpos + lança ajuste | + endpoints de escrita | ✅ + auditoria |

> **A Fase 1 não precisa de IA generativa pra ter ROI.** O ganho ("olhe 6, não 47") vem do *fechamento por exceção* + regras. O 👍/👎 desta fase é o que **coleta o rótulo** que habilita as fases 2–3.

**Riscos que o design já endereça (mantê-los):**
- **Falso "tudo OK"** — os caixas OK **não são definitivos**: entram em **amostragem de auditoria** aleatória (está na nota de rodapé). Diferença distribuída sob a tolerância pode esconder fraude.
- **Viés contra operador** — "recorrência → investigar" precisa **normalizar por exposição** (volume/ticket/turno), senão penaliza quem trabalha em PDV movimentado.
- **Confiança calibrada** — o % de confiança precisa significar algo medido, não peso inventado.
- **Honestidade de dado** — só usar evidências deriváveis hoje (ver §"Dados").

## Sobre os arquivos deste bundle
São **referência de design feita em HTML** — protótipo do conceito, **não** código de produção. Recrie no codebase Visor360.

## Fidelidade
**Alta fidelidade visual; conceito em validação.** O visual segue `docs/DESIGN-SYSTEM.md`. O escopo de dados está validado contra o que a API expõe (ver §Dados) — respeite os bloqueios.

---

## Onde implementar (arquivos a tocar)

| Arquivo | Mudança |
|---|---|
| `src/pages/CaixasTurnos/index.tsx` | Adicionar `'excecao'` ao `CaixaTab`/`isCaixaTab`; `TAB_META` ícone `Sparkles` + badge "IA"; render lazy `<FechamentoExcecao/>`. |
| `src/store/moduleLayout.ts` (`useCaixasLayout`) | Incluir `{ id:'excecao', label:'Fechamento por exceção', visible:true }` (migrate adiciona pros usuários existentes). |
| `src/components/layout/Sidebar.tsx` | Suboption em `/caixas` → `?tab=excecao`, ícone `Sparkles`. |
| `src/pages/CaixasTurnos/components/FechamentoExcecao.tsx` | **Novo.** A aba: banner + 4 KPIs + fila de exceção + painel copiloto. |
| `src/pages/CaixasTurnos/hooks/useFechamentoExcecao.ts` | **Novo.** Classifica cada caixa fechado e deriva causa/confiança/evidências/recorrência. Read-only, sobre `useOperacaoData`. |
| `src/lib/difCaixa.ts` | Reaproveitar o helper já extraído (apresentado − apurado conferido). |

> **Read-only:** `useOperacaoData` (turnoRows + conferenciaPdv) já respeita empresa+período do filtro global. Considerar só **caixas fechados/conferidos**. Nenhum `useMutation`; o 👍/👎 e "marcar p/ investigar" da Fase 1 podem só registrar localmente (ou um POST de telemetria de feedback, se houver) — **não** alteram o caixa.

---

## Lógica de classificação (Fase 1 — determinística)

Para cada caixa fechado, `dif = difCaixa(c)` (apresentado − apurado conferido). A partir das **formas** (`conferenciaPdv[caixa].formas`: diferença por forma) e da magnitude:

- **OK** — `|dif|` dentro da tolerância do PDV → não entra na fila.
- **Revisar** — diferença explicável e de menor severidade (causa identificável por cruzamento de formas/taxa; valor moderado).
- **Investigar** — severidade alta: valor relevante **ou** recorrência do operador **ou** sobra/falta sem contrapartida.

**Causa provável (por regras sobre formas):**
| Causa | Como detectar (dado atual) |
|---|---|
| PIX recebido não baixado | falta em dinheiro ≈ sobra em PIX no mesmo caixa |
| Taxa de cartão divergente | sobra/falta isolada em Crédito/Débito; taxa efetiva ≠ contratada |
| Sangria não lançada | falta 100% em dinheiro, sem cupom de sangria no turno |
| Venda não registrada | sobra "redonda" só em dinheiro, sem estorno |
| Arredondamento/moedas | diferença pequena, diluída, dentro do desvio do PDV |

**Confiança** = força do casamento das regras (quantos sinais batem). Exibir como %, **calibrado** — não inventar.

**Recorrência** = nº de caixas do mesmo operador com diferença no período (derivável do histórico). Normalizar por exposição.

---

## Anatomia da tela (spec visual)

**1. Banner (índigo):** "Você só precisa olhar **6 de 47 caixas**…" + reforço "a IA não recalcula / nada é automático" + selo **Análise read-only** (bolinha verde pulsando). Mantém o contrato de confiança visível.

**2. KPIs (4):** Caixas do dia (`47`, neutro) · Conferidos OK (`41`, verde, "87% · sem ação") · Revisar (`4`, âmbar) · Investigar (`2`, vermelho). Cards radius 16, chip de ícone 34px.

**3. Fila de exceção (col. esquerda, ~1.15fr):** header + segmented (Todos/Investigar/Revisar). Linhas-botão clicáveis: barra-accent à esquerda pela severidade (vermelho/âmbar), avatar com iniciais, operador + badge de classe, "local · causa", diferença (vermelho falta / verde sobra) e **confiança %**. Linha selecionada `#eff6ff`. Ordenada por severidade.

**4. Painel copiloto (col. direita, ~1fr, sticky):** header navy ("Copiloto de fechamento" + operador/local + badge de classe). Corpo:
- **3 números** (Apresentado · Apurado · Diferença) com nota cadeado "Valores apurados pelo sistema · a IA não recalcula".
- **Causa provável** com **badge de tier** (Verificável agora / Requer histórico / Verificável + histórico), ícone, texto + **barra de confiança**.
- **Como a IA chegou aqui** — lista de evidências, cada uma com check + **marcador "dado atual" (verde) / "histórico" (índigo)** + legenda.
- **Recorrência** (faixa cinza, ícone de ciclo).
- **Ações sugeridas:** primária (Marcar p/ investigar — vermelho / Aceitar explicação — navy) + secundária (Abrir caixa / Rever taxa). Nota "a decisão e o registro são do gestor — nada é gravado".
- **Feedback 👍/👎** ("Esta explicação ajudou?") — estado confirmado muda cor + mensagem. **É o coletor de rótulo.**

**5. Nota conceitual (rodapé, tracejado):** reafirma Nível 1 read-only + amostragem de auditoria nos OK + que auto-aprovação/ajuste são fase futura (escrita + auditoria).

Veja `screenshots/01-fila-revisar.png` (caso *Revisar*, causa "Verificável agora") e `02-investigar.png` (caso *Investigar*, tier "Verificável + histórico", recorrência alta).

---

## Dados — o que é derivável HOJE (honestidade)
| Evidência | Derivável agora? | Fonte |
|---|---|---|
| Diferença concentrada por forma (dinheiro/PIX/cartão) | ✅ | `conferenciaPdv.formas` |
| Falta em dinheiro ≈ sobra em PIX | ✅ | cruzamento de formas |
| Taxa efetiva × contratada (cartão) | ✅ | breakdown de cartão |
| Sem cupom de sangria no turno | ✅ | movimentos do turno |
| Abaixo do desvio-padrão histórico do PDV | 🟡 requer base histórica | série de diferenças por PDV |
| Recorrência do operador no mês | 🟡 requer histórico (sem rótulo de causa ainda) | histórico por operador |
| Volume de bomba × vendas registradas | 🟡 talvez | encerrante × PDV |
| ~~Sangria vista na câmera~~ | 🔴 **não temos** | CFTV fora do sistema — **não usar** |

> Na UI, marque cada evidência como **dado atual** (✅) ou **histórico** (🟡). Comece só com o tier "dado atual"; as de histórico entram na Fase 2.

## Métricas de sucesso
- **% de caixas em auto-OK** (trabalho que some) e **precisão do OK** (quantos OK viraram problema — protege a credibilidade).
- **Acerto da causa provável** (👍/👎 do gestor) — vira dado de treino da Fase 2.
- **Tempo médio de fechamento** antes/depois.
- **Diferença líquida recuperada** atribuível à fila.

## Design Tokens (resumo)
Navy `#1e3a5f`→`#27496f` · índigo IA `#4f46e5`/`#eef2ff`/`#c7d2fe` · texto `#111827`/`#6b7280`/`#9ca3af` · borda `#e5e7eb`/`#f1f3f5` · seleção `#eff6ff`. Classes: OK verde `#15803d`/`#dcfce7`/`#bbf7d0`; Revisar âmbar `#b45309`/`#fef3c7`/`#fde68a`; Investigar vermelho `#b91c1c`/`#fee2e2`/`#fecaca`. Tier evidência: dado atual `#16a34a`/`#f0fdf4`; histórico `#4338ca`/`#eef2ff`. Falta `#b91c1c` / sobra `#15803d`.
Inter; KPI 24px/700 · número do caixa 16px/700 · seção 14px/600 · corpo 12.5–13px · labels 10–11px/600 uppercase; `tabular-nums`. Card radius 16, pills 999, shadow `0 1px 2px rgba(0,0,0,.04)`. Ícone aba `Sparkles` + badge "IA".
Ícones Lucide: `sparkles`, `credit-card`, `check`, `info`, `alert-triangle`, `lock`, `rotate-ccw` (recorrência), `thumbs-up`/`thumbs-down`, `arrow-up-right`.

## Dados de exemplo (mock do protótipo)
47 caixas · 41 OK · 4 Revisar · 2 Investigar. Fila: Diego Almeida (Investigar, −R$ 250, venda não registrada, conf 86) · Marcos Vinícius (Investigar, +R$ 192,40, sangria não lançada, conf 91, **recorrência 3×/mês**) · Bruno Carvalho (Revisar, −R$ 60, taxa de cartão, conf 84) · Patrícia Lemos (Revisar, +R$ 43,70, PIX não baixado, conf 88) · Sandra Rocha (Revisar, +R$ 14,50, arredondamento, conf 79) · Camila Souza (Revisar, −R$ 10,80, moedas, conf 81).
Todos os valores são placeholder — substituir pela saída de `useOperacaoData` + `difCaixa`.

## Assets
Nenhum asset proprietário. Ícones **Lucide React** e tipografia **Inter** já existem. Reaproveita `useOperacaoData`, `difCaixa` e componentes do módulo CaixasTurnos.

## Arquivos neste bundle
- `Fechamento por Excecao.dc.html` — protótipo interativo (clicar na fila, filtros, feedback 👍/👎).
- `screenshots/01-fila-revisar.png` — visão geral, caso *Revisar* (causa "Verificável agora").
- `screenshots/02-investigar.png` — caso *Investigar* (tier "Verificável + histórico", recorrência alta).
