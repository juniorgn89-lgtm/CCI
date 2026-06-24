# Handoff: "Fechamento por exceção" — Fase 2 + consolidação do módulo

> Continuação do handoff `design_handoff_fechamento_excecao` (Fase 1). Este pacote cobre a **Fase 2** (recorrência histórica + tolerância adaptativa), a **fusão da aba Diferenças** (toggle Fila ↔ Panorama), o **modal de bandeiras** e a **reordenação/remoção de abas** do módulo.
>
> **Prompt pronto pro Claude Code** em [▶ Prompt](#-prompt-para-o-claude-code). Anexe as 3 imagens de `screenshots/`.

---

## ▶ Prompt para o Claude Code

> Evolua a aba **"Fechamento por exceção"** (`src/pages/CaixasTurnos/`) para a **Fase 2** e **consolide o módulo Fechamento de Caixa**, mantendo tudo **read-only** e os padrões do projeto (React + TS + Tailwind + TanStack Query + Zustand).
>
> **A) Fase 2 do copiloto** (sobre o que já existe da Fase 1):
> 1. **Histórico do operador (90 dias)** no painel copiloto: sparkline das últimas ~12 aberturas (sobra ▲ verde / falta ▼ vermelho / OK cinza, linha-zero, a de hoje destacada), **padrão detectado** ("falta em dinheiro recorrente"), e **3 métricas normalizadas por exposição** (caixas c/ dif · taxa vs total · média da rede). Substitui o texto de recorrência solto da Fase 1.
> 2. **Tolerância adaptativa por PDV**: a banda de "OK" passa a ser **aprendida do histórico de cada posto** (ex.: "Posto Rodovia: ±R$ 22 / 90d") em vez da constante fixa `TOLERANCIA_FECHAMENTO`. Exibir a banda + o quanto a diferença atual a excede.
>
> **B) Fusão da aba Diferenças** → um **toggle Fila ↔ Panorama** dentro do Fechamento por exceção. **Fila** = o copiloto (agir). **Panorama** = os cortes agregados da antiga aba Diferenças (explorar): **Por responsável** (barra divergente em torno do zero), **Onde está a diferença** (líquido por forma de pagamento) e **Diferença por dia** (barras divergentes, 30 dias).
>
> **C) Modal de bandeiras**: no Panorama, cada linha de "Onde está a diferença" é **clicável** → modal com o breakdown: cartão (Crédito/Débito) **por bandeira** (Visa/Mastercard/Elo/Amex…), Dinheiro/PIX **por posto**, Voucher **por emissor**. Read-only.
>
> **D) Consolidação das abas**: o módulo passa a ter **2 abas, nesta ordem**: **(1) Fechamento por exceção** [agora a primeira/landing] · **(2) Conferência PDV**. **Remover Visão Geral e Diferenças** (a Diferenças foi absorvida pelo Panorama). **⚠️ Faseado**: só remover a Diferenças depois que o Panorama cobrir 100% dos cortes dela e for validado — ver §Sequência.
>
> Layout-alvo nas 3 imagens anexas e no protótipo `Fechamento por Excecao v2.dc.html`. **Imagens/HTML são REFERÊNCIA** — recrie reaproveitando `useFechamentoExcecao` (Fase 1), `useDiferencasCaixa` (cortes do Panorama), `useOperacaoData` e `difCaixa`. **Nenhum `useMutation`; a IA não recalcula valores.**

---

## O que muda vs Fase 1

| Área | Fase 1 (já entregue) | Fase 2 / consolidação (este handoff) |
|---|---|---|
| Recorrência | texto "3º caixa do mês" (período atual) | **sparkline 90d + padrão + métricas normalizadas** |
| Tolerância | constante `max(R$5, 1%)` | **adaptativa por PDV** (aprendida de 90d) |
| Aba Diferenças | aba separada | **fundida** como toggle "Panorama" |
| Navegação de formas | — | **modal por bandeira/posto/emissor** |
| Abas do módulo | Visão Geral · Conferência · Diferenças · Exceção | **Exceção (1ª) · Conferência** |
| Rótulo de ação | "Abrir caixa" | **"Abrir detalhe do caixa"** (navegação read-only) |

## Sobre os arquivos deste bundle
Referência de design em HTML — **não** é código de produção. Recrie no codebase.

## Fidelidade
**Alta fidelidade visual.** Fase 2 e fusão são evoluções; respeite os bloqueios de dado da Fase 1 (ver handoff anterior) e a sequência de remoção de abas.

---

## Onde implementar

| Arquivo | Mudança |
|---|---|
| `CaixasTurnos/index.tsx` | **Reordenar** `CaixaTab` → `excecao` primeiro; **remover** `'visao'` e `'diferencas'` das abas (ver sequência). Default tab = `excecao`. |
| `store/moduleLayout.ts` (`useCaixasLayout`) | Lista de abas vira `[excecao, conferencia]`; migrate remove visao/diferencas. |
| `Sidebar.tsx` | Suboptions de `/caixas`: só Fechamento por exceção + Conferência PDV. |
| `components/FechamentoExcecao.tsx` | Toggle **Fila ↔ Panorama**; painel ganha **histórico 90d** + **tolerância adaptativa**; Panorama com os 3 cortes; **modal de bandeiras**. |
| `hooks/useFechamentoExcecao.ts` | Adicionar: série histórica 90d por operador, padrão, métricas normalizadas, banda adaptativa por PDV. |
| `hooks/useDiferencasCaixa.ts` | **Reaproveitar** para alimentar o Panorama (por responsável / forma / dia) + detalhe por bandeira no modal. |

> **Dados:** Fase 2 precisa de **histórico além do período atual** (90d) — é o que a Fase 1 deixou marcado como "requer histórico". Recorrência **normalizada por exposição** (taxa comDif/total, não count cru) pra não punir operador de PDV movimentado. Tolerância adaptativa = estatística da série de diferenças por PDV (ex.: percentil/desvio dos últimos 90d). O detalhe por **bandeira** no modal vem do breakdown de cartão (`/CARTAO` por bandeira) já usado na aba Cartões.

---

## Anatomia (spec visual)

### Toggle Fila ↔ Panorama
Segmented control (`Fila de exceção` · `Panorama`) no topo do conteúdo, abaixo dos KPIs. Ativo navy. Hint à direita: "O que olhar e por quê — priorizado" (Fila) / "Onde estão as diferenças — visão agregada" (Panorama).

### Fila (painel copiloto — adições da Fase 2)
- **Tolerância adaptativa** (faixa índigo, logo abaixo dos 3 números): "Tolerância adaptativa {Posto}: ±R$ X (aprendida de 90d). {nota de quanto excede}".
- **Histórico do operador** (bloco cinza, badge "FASE 2 · 90 DIAS"): sparkline 12 colunas (cima/baixo da linha-zero, cores sobra/falta/OK, hoje destacado), **padrão detectado** (faixa vermelha se alto / cinza se normal, ícone de ciclo), e **3 métricas** (caixas c/ dif · taxa vs total · média da rede). Veja `screenshots/01-fila-historico.png`.

### Panorama (cortes da antiga Diferenças)
- **Por responsável** — barra **divergente** em torno do zero central (falta ◀ vermelho / sobra ▶ verde) + líquido assinado. Ordenado por |valor|.
- **Onde está a diferença** — líquido por forma (Dinheiro/PIX/Crédito/Débito/Voucher), cada linha **clicável** (chevron) → modal.
- **Diferença por dia** — barras divergentes (30 dias, sobra ▲ verde / falta ▼ vermelho, linha-zero).
- Nota: "Panorama incorpora os cortes agregados da antiga aba Diferenças". Veja `screenshots/02-panorama.png`.

### Modal de bandeiras
Header: ícone + nome da forma + tipo do corte ("Por bandeira" / "Por posto" / "Por emissor") + total assinado. Corpo: linhas com nome + barra proporcional + líquido assinado (zero em cinza neutro, **sem sinal**). Nota cadeado "read-only". Fecha no backdrop. Veja `screenshots/03-modal-bandeiras.png`.

---

## Sequência de remoção das abas (não pular)
1. Implementar o **Panorama** cobrindo 100% dos cortes da Diferenças (por responsável, forma, dia) + o modal.
2. Rodar **Exceção (com Panorama) e Diferenças em paralelo** por um ciclo, medindo uso.
3. Quando o uso migrar, **remover a aba Diferenças**. **Visão Geral** pode sair junto se seus KPIs já estiverem cobertos pelos KPIs do topo da Exceção — senão, validar antes.
> Não aposente uma view madura/em produção antes de a substituta estar validada.

## Interações & Comportamento
- **Toggle** troca Fila ↔ Panorama (estado de UI). Default = Fila.
- **Linha de forma → modal**; fecha no backdrop. Read-only.
- Painel copiloto, filtros, feedback 👍/👎 (localStorage) — como na Fase 1.

## Design Tokens (deltas da Fase 2)
Sparkline/divergente: sobra `#86efac` (hoje `#16a34a`) · falta `#fca5a5` (hoje `#dc2626`) · OK/zero `#e5e7eb`/`#eef2f6`. Tolerância adaptativa: faixa `#eef2ff`/`#e0e7ff`, texto `#3730a3`. Badge Fase 2 `#e0e7ff`/`#4338ca`. Modal `0 24px 64px rgba(0,0,0,.28)`, barras de bandeira verde/vermelho/cinza. Demais tokens = Fase 1.
Ícones Lucide: `sparkles` (Fila), `bar-chart-3` (Panorama), `rotate-ccw` (padrão), `chevron-right` (linha→modal), `trending-up` (tolerância).

## Dados de exemplo (mock do protótipo)
Painel Marcos Vinícius: tolerância Posto Rodovia ±R$ 22; histórico 9 caixas c/ dif / taxa 36% / rede 9%; padrão "falta em dinheiro recorrente".
Panorama — Por responsável: Marcos −612, Diego +540, Bruno +220, Sandra −58, Patrícia −44, Camila −32. Por forma: Dinheiro −742, PIX +96, Crédito +280, Débito −38, Voucher +12. Modal Crédito: Visa +160, Mastercard +90, Elo +30, Amex 0.
Valores são placeholder — substituir pela saída de `useFechamentoExcecao` + `useDiferencasCaixa`.

## Assets
Sem assets proprietários. Lucide + Inter já no projeto. Reaproveita hooks da Fase 1 + `useDiferencasCaixa` + breakdown de cartão.

## Arquivos neste bundle
- `Fechamento por Excecao v2.dc.html` — protótipo interativo (toggle Fila/Panorama, clicar nos casos, modal de bandeiras, feedback).
- `screenshots/01-fila-historico.png` — Fila + histórico 90d + tolerância adaptativa (caso Investigar).
- `screenshots/02-panorama.png` — Panorama (cortes da Diferenças).
- `screenshots/03-modal-bandeiras.png` — modal de bandeiras (Crédito).
