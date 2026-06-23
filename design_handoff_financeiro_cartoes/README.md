# Handoff: Redesign da aba "Cartões" (Financeiro · Recebíveis de cartão)

> **Prompt pronto pro Claude Code (VS Code).** Cole a seção [▶ Prompt](#-prompt-para-o-claude-code) e anexe as 3 imagens em `screenshots/`. O restante é a especificação completa.

---

## ▶ Prompt para o Claude Code

> Redesenhe a aba **"Cartões"** do módulo **Financeiro** (`src/pages/Financeiro/components/CartoesIntel.tsx`), mantendo o conteúdo atual e seguindo os padrões do projeto (React + TS + Tailwind + shadcn + TanStack Query + Zustand, **somente GET / read-only**). Deixe-a na **mesma anatomia** das abas Receber/Pagar já redesenhadas.
>
> Mudanças: (1) **visual limpo** no padrão do design system; (2) **hero navy** "A receber em cartão" (pendente + em atraso/a vencer + taxa média/custo); (3) **KPIs** Em atraso · Recebíveis hoje · Taxa média (com **delta de tendência** vs início do período); (4) **card de Antecipação de recebíveis** (antecipável + custo + simular); (5) **card de Conciliação** (recebíveis liquidados com valor divergente do previsto); (6) **curva de taxa média por modalidade** (linha 6m) + **comparativo por modalidade**; (7) **custo de taxa por bandeira** (full-width, com selo 🔴 RENEGOCIAR nas piores) — substitui os antigos dois cards "custo" + "onde negociar"; (8) **painel com abas** (Em atraso · A vencer · Liquidados) com **árvore Modalidade→Administradora** + **modal** (reaproveitar `CartaoDetalheModal`).
>
> O layout-alvo está nas 3 imagens anexas e no protótipo `Financeiro Cartoes.dc.html`. **As imagens e o HTML são REFERÊNCIA de design** — recrie reaproveitando o componente atual e seus cálculos (já existem: KPIs, taxaSerie, modalResumo, custoPorAdmin, árvore) e o `CartaoDetalheModal`; não copie o HTML.
>
> **Read-only:** período, abas e o botão "Simular antecipação" são UI no cliente; tudo deriva do `useQuery(fetchCartao)`. Nenhum `useMutation`.

---

## Visão geral

A aba Cartões analisa os **recebíveis de cartão** (`/CARTAO`): o que há a receber, o que está em atraso, a taxa média paga às administradoras e onde renegociar. O redesign moderniza o visual no padrão Visor360 (igual a Receber/Pagar) e adiciona três blocos de alto valor pra gestão de caixa de posto: **antecipação**, **conciliação** e **delta de tendência da taxa**.

## Sobre os arquivos deste bundle

São **referência de design feita em HTML** — protótipo do visual/comportamento, **não** código de produção. Recrie no codebase Visor360 reaproveitando `CartoesIntel.tsx` (que já calcula tudo) e o `CartaoDetalheModal`.

## Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento e estados seguem `docs/DESIGN-SYSTEM.md` e espelham as abas Receber/Pagar.

---

## Onde implementar (arquivos a tocar)

| Arquivo | Mudança |
|---|---|
| `src/pages/Financeiro/components/CartoesIntel.tsx` | Redesign visual na anatomia compartilhada: hero navy, KPIs (taxa com delta), antecipação, conciliação, curva de taxa, comparativo por modalidade, custo por bandeira (com selo), painel com abas + árvore. Cálculos (`m.*`: taxaMedia, taxaSerie, modalResumo, custoPorAdmin, árvore) **permanecem**. |
| `CartaoDetalheModal` (no mesmo arquivo) | **Reaproveitado** — abre ao clicar numa administradora. |
| `shared/financeIntel.tsx` (se já criado p/ Receber/Pagar) | Reusar `KpiHero`, `ChartCard`, `IntelTabs`, `AnalisePanel` aqui também. |

> **Dados (read-only):** já vem tudo do `useQuery(['cartaoAnalytics', …], fetchCartao)` com janela de N meses. Derivações novas a partir do MESMO dado: **delta da taxa** (taxaSerie[último] − taxaSerie[primeiro]); **antecipação** (Σ valor dos pendentes a vencer; custo = aplicar taxa de antecipação contratada — se não houver no payload, deixar a % como constante configurável/placeholder e marcar no código); **conciliação** (liquidados onde `valor pago` ≠ `valor previsto` — só se o payload de `/CARTAO` expõe os dois; senão, manter o card atrás de feature-flag e documentar). **"Simular antecipação"** é UI/modal local — sem mutation.

---

## Telas / Views

### Aba: Cartões (Financeiro)
- **Propósito:** gerir recebíveis de cartão — quanto entra, custo de taxa, onde renegociar, e antecipação.
- **Largura:** `max-width:1280px`, centralizado, `gap:16px`.
- **Estrutura vertical:**
  1. **Header** "Recebíveis de cartão" + botão **Analisar recebíveis** (toggle do painel de insights).
  2. **(toggle) Painel de análise** (índigo) — insights de taxa/custo/atraso + recomendação.
  3. **KPIs (4):** hero navy + Em atraso + Recebíveis hoje + Taxa média (com delta).
  4. **Antecipação (1.6fr) + Conciliação (1fr).**
  5. **Curva de taxa média (1.5fr) + Por modalidade (1fr).**
  6. **Custo de taxa por bandeira** (full-width, com selo RENEGOCIAR).
  7. **Painel com abas** (Em atraso · A vencer · Liquidados) — árvore Modalidade→Administradora.
  8. **Modal** da administradora (ao clicar numa linha-filha).

Veja `screenshots/01-topo-kpis.png`, `02-antecipacao-graficos.png`, `03-custo-bandeira-arvore.png`.

---

### Componentes

**KPI hero (navy)** — `linear-gradient(135deg,#1e3a5f,#27496f)`, radius 16. "A receber em cartão" `R$ 187.400`; linhas Em atraso `R$ 12.300` (`#fca5a5`) / A vencer `R$ 168.300`; rodapé band azul "Taxa média 2,18% · custo R$ 4.086". Ícone `credit-card`.

**KPIs 2–4** — brancos radius 16, valor 22px/700. Em atraso (vermelho, borda `#fecaca`) · Recebíveis hoje (laranja, borda `#fed7aa`) · **Taxa média** (violeta, borda `#e9d5ff`) com **delta** `↘ 0,23pp` verde (`#15803d`) + "caindo desde jan".

**Antecipação** — card verde (`linear-gradient(135deg,#ecfdf5,#fff)`, borda `#a7f3d0`): ícone `chevrons-right`, "ANTECIPAÇÃO DISPONÍVEL", valor `R$ 168.300` (líquido ~`R$ 162.900`), "236 recebíveis a vencer · custo 3,2% a.m. · prazo médio 21 dias" + botão verde **Simular antecipação**.

**Conciliação** — card âmbar (borda `#fde68a`): ícone `shield-check`, "7 recebíveis divergentes", "Diferença acumulada −R$ 312", "Taxa cobrada acima da contratada em 5 recebíveis VISA".

**Curva de taxa média** — card branco; gráfico de **linhas** (SVG/Recharts) por modalidade ao longo de 6 meses; legenda. Cores por modalidade: Crédito `#2563eb`, Débito `#60a5fa`, PIX `#ea580c`, Carteira Digital `#1e3a5f`.

**Por modalidade** — barras horizontais por modalidade: volume + taxa + custo (vermelho).

**Custo de taxa por bandeira** (full-width) — linha por bandeira: nome + bolinha de modalidade + **selo 🔴 RENEGOCIAR** (top 2 por custo) + barra + volume + taxa + custo (vermelho). Substitui os antigos "Custo por bandeira" + "Onde negociar" (fundidos).

**Painel com abas + árvore** — segmented `Em atraso · A vencer · Liquidados` (ativo navy) + contador. Tabela em **árvore**: linha de grupo (Modalidade, chevron expand/collapse, bruto em negrito) → linhas-filhas (Administradora, qtd, bruto/taxa/líquido/taxa efetiva), clicáveis → modal. Colunas: Modalidade/administradora · Bruto · Taxa (vermelho) · Líquido · Taxa efetiva.

**Modal administradora** (`CartaoDetalheModal`) — header (nome + "N cartões · taxa X%") + total; tabela de cartões individuais (cliente · venda · bom para · taxa · valor); em "Liquidados" inclui coluna Pagamento.

---

## Interações & Comportamento
- **Período:** seletor 3/6/12/24 meses (recarrega a query; `queryKey` inclui a janela).
- **Analisar recebíveis:** toggle do painel de insights.
- **Abas:** Em atraso · A vencer · Liquidados (estado de UI) trocam a árvore.
- **Árvore:** clicar no grupo expande/colapsa a modalidade; clicar na administradora abre o modal.
- **Simular antecipação:** abre modal/simulação local (read-only) — **não** dispara mutation.
- **Loading/Empty:** skeletons; "Sem registros".

## Estado / Dados
- **UI:** `analise`, `mesesJanela`, `aba` (atraso/vencer/liquidados), `expand` (Set de modalidades), `modal` (administradora).
- **Derivados (já no componente):** totais por status, taxa média ponderada por valor, taxaSerie por modalidade, modalResumo (volume/taxa/custo), custoPorAdmin, árvore Modalidade→Administradora. **Novos (mesmo dado):** delta da taxa, antecipável (Σ a vencer), conciliação (divergências — se o payload permitir).

## Design Tokens (resumo)
Navy `#1e3a5f`→`#27496f` · texto `#111827`/`#6b7280`/`#9ca3af` · borda `#e5e7eb`/`#f1f3f5` · hover `#eff6ff`. Modalidades: Crédito `#2563eb`, Débito `#60a5fa`, PIX `#ea580c`, Carteira Digital `#1e3a5f`. Custo/atraso vermelho `#b91c1c`/`#fee2e2`; taxa violeta `#6d28d9`/`#ede9fe`; antecipação verde `#059669`/`#ecfdf5`/`#a7f3d0`; conciliação âmbar `#d97706`/`#fde68a`; delta positivo (queda de custo = bom) verde `#15803d`. Análise índigo `#4f46e5`/`#eef2ff`.
Inter; KPI hero 28px/700 · KPI 22px/700 · seção 14px/600 · tabela 13px · labels 10–11px/600 uppercase; `tabular-nums`. Card radius 16, pills 999, selo 999, shadow `0 1px 2px rgba(0,0,0,.04)`, modal `0 24px 64px rgba(0,0,0,.28)`.
Ícones Lucide: `credit-card`, `sparkles`, `alert-triangle`, `clock`, `percent`, `chevrons-right` (antecipação), `shield-check` (conciliação), `chevron-right` (árvore), `trending-down` (delta).

## Dados de exemplo (mock do protótipo)
A receber `R$ 187.400` (atraso 12.300 / a vencer 168.300) · taxa média 2,18% (↘0,23pp) · custo R$ 4.086 · recebíveis hoje 6.900 (11). Antecipação: 168.300 → líquido 162.900, custo 3,2% a.m., 21 dias. Conciliação: 7 divergentes, −R$ 312.
Modalidades (volume/taxa): Crédito 124.000/2,42% · Débito 58.000/1,29% · Carteira Digital 32.000/1,70% · PIX 14.000/0,78%.
Bandeiras (volume/taxa/custo): VISA Crédito 68.000/2,48%/1.686 🔴 · Mastercard Crédito 42.000/2,38%/1.000 🔴 · VISA Débito 34.000/1,32%/449 · Elo Crédito 14.000/2,55%/357 · PicPay 18.000/1,80%/324 · Mastercard Débito 24.000/1,25%/300.
Curva taxa (6m, Crédito): 2,45→2,38→2,42→2,31→2,28→2,22.

Todos os valores são placeholder — substituir pela saída do `useQuery(fetchCartao)`.

## Assets
Nenhum asset proprietário. Ícones **Lucide React** e tipografia **Inter** já existem. Modal = `CartaoDetalheModal` existente.

## Arquivos neste bundle
- `Financeiro Cartoes.dc.html` — protótipo interativo (analisar, trocar abas, expandir árvore, clicar nas administradoras).
- `screenshots/01-topo-kpis.png` — header + KPIs (hero + taxa com delta).
- `screenshots/02-antecipacao-graficos.png` — antecipação + conciliação + curva de taxa + por modalidade.
- `screenshots/03-custo-bandeira-arvore.png` — custo por bandeira (selo RENEGOCIAR) + painel com abas/árvore.
