# Handoff: Briefing Modal — "Bom dia" (resumo diário na entrada)

> **Melhoria visual** do modal de briefing que aparece no primeiro login do dia. Já existe no código (`feat(briefing): daily morning briefing modal`). Este pacote redesenha o visual no padrão Visor360 e ajusta os KPIs.
>
> **Prompt pronto pro Claude Code** em [▶ Prompt](#-prompt-para-o-claude-code). Anexe a imagem de `screenshots/`.

---

## ▶ Prompt para o Claude Code

> Redesenhe o **briefing modal** ("Bom dia") que aparece no primeiro login do dia — só **visual + KPIs**, mantendo a lógica de exibição (1×/dia, `last_briefing_date` + RPC) e os filtros que ele já dispara. Read-only. Siga os padrões do projeto (React + TS + Tailwind + design system Visor360).
>
> Mudanças (layout-alvo na imagem anexa e no protótipo `Briefing Modal.dc.html`):
> 1. **Header navy de marca**: faixa `linear-gradient(135deg,#1e3a5f,#27496f)` com saudação "Bom dia, {nome}" em branco + data + ícone sol (halo dourado discreto). Substitui o ícone laranja solto sobre branco.
> 2. **KPI herói**: **Lucro Bruto** como número dominante (≈30px, navy, card com leve gradiente azul) + 2 KPIs secundários ao lado, num bloco único radius 16.
> 3. **Trocar os KPIs**: de `Lucro Bruto · Margem(%) · Litros` para **`Lucro Bruto · Lucro/litro (R$/L) · vs meta do dia (%)`**. ⚠️ A "margem 88,5%" do modal atual parece **irreal pra combustível** (margem de posto é ~10-12%) — confirme o que esse campo mede; o setor lê **lucro por litro**, não margem%.
> 4. **Frase de leitura** (faixa azul `#f0f6ff`/`#dbeafe`, ícone sparkles): uma linha interpretando o dia — ex. "Lucro subiu puxado por margem (+R$ 0,03/L), não por volume — os litros caíram 1,7%." Determinística (regra sobre os números), não LLM.
> 5. **Filtros sempre visíveis** (Período · Escopo · Módulo · Posto), cada um numa linha leve sob o label "Ajustar análise" — mantém os controles atuais, só reorganiza.
> 6. **Footer**: checkbox "Não mostrar de novo hoje" + Fechar (ghost) + **Analisar** (azul `#2563eb`, com seta).
>
> **As imagens/HTML são REFERÊNCIA de design** — recrie reaproveitando o componente de modal e os dados que o briefing já busca; não copie o HTML.

---

## Visão geral
O briefing é o "bom dia, aqui está o que importa" na entrada: resumo de ontem (comparado ao **mesmo dia da semana anterior** — quarta vs quarta, pra neutralizar sazonalidade) + atalho pra começar a análise com os filtros pré-selecionados. O redesign deixa o **resultado** (Lucro Bruto) dominante e os controles secundários, terminando o fluxo no botão Analisar.

## Sobre os arquivos deste bundle
Referência de design em HTML — **não** é código de produção. O `Briefing Modal.dc.html` é um protótipo do visual/comportamento (clicar nos toggles, fechar).

## Fidelidade
**Alta fidelidade visual.** Cores/tipografia/espaçamento seguem `docs/DESIGN-SYSTEM.md`.

---

## Onde implementar
| Arquivo | Mudança |
|---|---|
| Componente do briefing modal (criado no commit `feat(briefing)`) | Redesign visual: header navy, KPI herói, troca dos KPIs, frase de leitura, filtros em linha, footer. |
| Hook/seletor que alimenta o briefing | Adicionar **Lucro/litro** (LB ÷ litros) e **vs meta do dia** (LB ÷ meta). Remover/realocar a margem% se não for fato. |
| `docs/supabase-briefing.sql` (pendente) | Já previsto: `last_briefing_date` + RPC — sem ele o modal não aparece. Não bloqueia o redesign visual. |

> **Contrato de dados (importante):**
> - **Fato:** Lucro Bruto, Litros, Lucro/litro (= LB÷litros) — do cache de apuração (mesmo dado da Central/Comercial), comparado ao mesmo dia da semana anterior.
> - **⚠️ Confirmar:** a **margem 88,5%** atual — se for margem de combustível, está irreal; provavelmente é outra base (conveniência? % de algo). Por isso troquei por **Lucro/litro**, que é fato derivável e a métrica que o dono de posto acompanha.
> - **Depende de config:** **vs meta do dia** exige a **meta cadastrada** (módulo Metas). Sem meta preenchida, ocultar esse KPI ou mostrar "meta não definida" — não inventar denominador.
> - **Leitura:** a frase é **determinística** (regra: compara Δ margem/L vs Δ volume e classifica "puxado por margem/volume; saudável/atenção"). Não é texto de LLM.

---

## Anatomia (spec visual)
1. **Backdrop**: navy escuro `linear-gradient(135deg,#0f2238,#1e3a5f,#27496f)` + leve blur, com glows radiais (azul/verde) sutis.
2. **Modal** `560px`, radius 22, sombra `0 32px 80px -12px rgba(5,14,28,.55)`, entrada com fade-up.
3. **Header navy**: data (uppercase, 11px, branco 55%) · "Bom dia, {nome}" (21px/700 branco) · ícone sol gradiente âmbar com halo dourado · botão X (branco translúcido). Subtítulo branco 72%.
4. **Label de contexto**: "Combustível · ontem (quarta) vs quarta passada" (10.5px/700 uppercase, `#94a3b8`, ícone de gráfico).
5. **Bloco de KPIs** (grid `1.5fr 1fr 1fr`, hairline `#eef1f5`): herói Lucro Bruto (30px/800 navy, card `linear-gradient(160deg,#f0f6ff,#fff)`, pill verde +7,4%) · Lucro/litro (21px/700, R$ 0,41/L, +9,3%) · vs meta (21px/700, 92%, mini-barra verde 92%).
6. **Frase de leitura**: faixa `#f0f6ff` borda `#dbeafe`, ícone sparkles `#2563eb`, texto navy com trecho em negrito.
7. **"Ajustar análise"**: label uppercase + 4 linhas (Período/Escopo segmentados navy; Módulo/Posto dropdowns) numa moldura `#f1f3f5`.
8. **Range**: "Vai analisar 01/06/2026 – 24/06/2026" (11.5px `#94a3b8`, ícone calendário).
9. **Footer**: checkbox "Não mostrar de novo hoje" · Fechar (ghost) · Analisar (gradiente azul `#2563eb→#1d4ed8`, sombra, seta).

## Interações & Comportamento
- **1×/dia**: aparece no 1º login se `last_briefing_date` ≠ hoje. "Não mostrar de novo hoje" marca a data.
- **Filtros**: pré-selecionados com o default mais útil (Mês atual · Fechado até ontem · Central da Rede · Todos); editáveis.
- **Analisar**: fecha o modal e leva à análise com os filtros aplicados. **Fechar / X**: dispensa.
- **Sem meta cadastrada** → KPI "vs meta" oculto ou rotulado, não quebra.

## Design Tokens
Navy `#1e3a5f→#27496f` · backdrop `#0f2238` · azul ação `#2563eb→#1d4ed8` · sol `#fbbf24→#f59e0b` (halo `rgba(245,197,24,.16)`). Texto `#111827`/`#64748b`/`#94a3b8`; sobre navy branco 100/72/55%. Positivo `#15803d`/`#dcfce7`; negativo `#dc2626`. Leitura `#f0f6ff`/`#dbeafe`. Hairline `#eef1f5`/`#f1f3f5`.
Inter; herói 30px/800 · KPI sec 21px/700 · saudação 21px/700 · leitura 12.5px · labels 10.5px/700 uppercase; `tabular-nums`. Modal radius 22, cards 16, pills 999.
Ícones Lucide: `sun`, `bar-chart-3`, `sparkles`, `sliders-horizontal`, `calendar`, `chevron-down`, `arrow-right`, `x`.

## Dados de exemplo (mock do protótipo)
Lucro Bruto R$ 222K (+7,4% vs quarta passada) · Lucro/litro R$ 0,41/L (+9,3%) · vs meta do dia 92% · litros 41K (−1,7%, citado na leitura). Range 01–24/06/2026.
Valores são placeholder — substituir pela saída do cache de apuração + meta.

## Assets
Sem assets proprietários. Lucide + Inter já no projeto. Reaproveita o componente de modal existente.

## Arquivos neste bundle
- `Briefing Modal.dc.html` — protótipo interativo.
- `screenshots/briefing.png` — o modal redesenhado (header navy, KPI herói, leitura, filtros).
