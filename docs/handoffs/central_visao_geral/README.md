# Handoff — Central da Rede · aba "Visão Geral" (com régua de projeção)

Redesign da aba **Visão Geral** do módulo **Central da Rede**, acrescentando uma **régua de projeção de lucro bruto** (realizado vs. projeção até o fim do mês) com tooltip dia-a-dia.

> **Cole o prompt abaixo no Claude Code** (projeto Visor360 aberto + as imagens de `screenshots/` anexadas). A spec completa segue logo depois.

---

## PROMPT (colar no Claude Code)

> Quero redesenhar a aba **"Visão Geral"** do módulo **Central da Rede** (`src/pages/CentralRede/…`) conforme `design_handoff_central_visao_geral/README.md` e as imagens em `screenshots/`. Tudo **read-only**, sem fetch novo — derive de `useCentralRede()` / dos dados consolidados que a aba já carrega.
>
> **Layout:** 4 cards de setor (Combustível, Automotivos, Conveniência, Global) em grid à esquerda + **painel "Projeção" navy** ocupando a 5ª coluna à direita.
>
> **Novidade — régua de projeção:** o painel Projeção tem 2 estados, alternados por um botão ("Visualizar projeção do período" ↔ "Voltar aos indicadores"). No estado **expandido**, os 4 cards de setor recolhem (largura→0) e o painel ocupa a linha inteira, mostrando um **gráfico de evolução do lucro bruto no mês**: linha+área azul = realizado (dia 1→hoje), linha tracejada verde = projeção (hoje→dia 30), com tooltip de **hover dia-a-dia** mostrando Realizado e Projeção daquele dia.
>
> **Antes de implementar:** sonde os dados ao vivo (consolidado por setor + série diária de LB) e me diga, campo a campo, o que existe e o que precisa ser derivado/degradado. Não invente série diária — se só houver acumulado, gere a trajetória esperada por interpolação e **rotule como projeção/estimativa**. Sem `tsc --noEmit` na raiz: use `tsc -b` (project references). Me traga o **plano antes de codar**.

---

## Estrutura da tela

```
┌─────────────────────────────────────────────────────────────┐
│ Header: "Central da Rede" · Lucro bruto consolidado por setor │
│         [1–23 jun 2026]  [6 unidades]                          │
│ Tabs: ▸Visão Geral   Produtividade   Reabastecimento          │
├─────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  ┌────────────┐ │
│  │Combust.│ │Automot.│ │Conven. │ │Global  │  │ PROJEÇÃO   │ │
│  │778.050 │ │59.876  │ │212.085 │ │1.050.0 │  │ (navy)     │ │
│  └────────┘ └────────┘ └────────┘ └────────┘  │ tabela 4ln │ │
│   ← recolhem no estado expandido →            │ + botão    │ │
│                                                └────────────┘ │
└─────────────────────────────────────────────────────────────┘

Estado expandido (botão clicado):
┌─────────────────────────────────────────────────────────────┐
│  PROJEÇÃO — Evolução do lucro bruto · junho     [full width] │
│  Realizado·até 23/jun R$1.050.010 │ Projeção·fim do mês       │
│  R$1.260.012 │ A realizar R$210.002    ── Realizado ┄┄ Projeção│
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1,40mi┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │   │
│  │ 1,05mi          ╱──────●(hoje)┄┄┄┄┄●(proj dia 30)  │   │
│  │ 0,70mi      ╱▟▟▟▟▟  ← área azul (realizado)         │   │
│  │ 0,35mi  ╱▟▟▟                                        │   │
│  │   0  1  5  10  15  20 hoje      30                  │   │
│  └──────────────────────────────────────────────────────┘   │
│  [↩ Voltar aos indicadores]                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Cards de setor (4)

| Setor | Valor (LB) | Métrica 1 | Métrica 2 | Ícone |
|---|---|---|---|---|
| **Combustível** | R$ 778.050 | Margem 12,55% | L. bruto/litro R$ 0,75 | bomba · azul `#2563eb` / bg `#dbeafe` |
| **Automotivos** | R$ 59.876 | Faturamento R$ 107.089 | Margem 55,91% | chave · âmbar `#d97706` / bg `#fef3c7` |
| **Conveniência** | R$ 212.085 | Faturamento R$ 421.324 | Margem 50,34% | loja · verde `#16a34a` / bg `#dcfce7` |
| **Global** | R$ 1.050.010 | Faturamento R$ 6.728.092 | Margem 15,61% | globo · roxo `#7c3aed` / bg `#ede9fe` |

Card: `background:#fff; border:1px solid #eef0f3; border-radius:16px; padding:20px`. Nome (15px/700) + "Lucro bruto" (12px cinza) + ícone-pill 36×36 no topo direito. Valor em 30px/800 `#111827`. Rodapé com 2 métricas (valor 700 + label uppercase 11px `#9ca3af`), separadas por borda superior `#f1f3f5`.

## 2. Painel Projeção (navy) — estado tabela

- Container: `background:#1e3a5f; border-radius:16px; color:#fff`. Cabeçalho "Projeção" (15px/700) + ícone `(i)` + subtítulo **"Fim do mês"** + botão-ícone 36×36 (`rgba(255,255,255,.1)`).
- **Tabela** (4 colunas: SETOR · LITROS/QTDE · FATURAMENTO · LUCRO BRUTO · MARGEM):

| Setor | Litros/Qtde | Faturamento | Lucro bruto | Margem |
|---|---|---|---|---|
| Combustível | 1.247.402 | R$ 7.439.614 | R$ 933.660 | 12,55% |
| Automotivos | 2.408 | R$ 128.507 | R$ 71.851 | 55,91% |
| Conveniência | 138.155 | R$ 505.589 | R$ 254.502 | 50,34% |
| **Total** | — | **R$ 8.073.710** | **R$ 1.260.012** | **15,61%** |

Linha Total em 700/`#fff`; demais em 500/`rgba(255,255,255,.92)`, borda inferior `rgba(255,255,255,.1)`.
- Botão de rodapé full-width: **"Visualizar projeção do período"** (borda `rgba(255,255,255,.22)`, bg `rgba(255,255,255,.08)`, hover `.2`).

## 3. Régua de projeção (estado expandido) ⭐ novidade

Ao clicar no botão, `expanded=true`: os 4 cards de setor recolhem (`flex 4→0`, `maxW→0px`, `opacity→0`) e o painel Projeção ocupa a linha inteira (`flex 1.45→100`). Subtítulo vira **"Evolução do lucro bruto · junho"**.

**Cabeçalho de números** (3 blocos):
- **Realizado · até 23/jun** → R$ 1.050.010 (branco)
- **Projeção · fim do mês** → R$ 1.260.012 (verde `#6ee7b7`)
- **A realizar** → R$ 210.002 (`rgba(255,255,255,.85)`)
- Legenda: ── Realizado (azul `#60a5fa`) · ┄┄ Projeção (verde `#6ee7b7`)

**Gráfico SVG** (`viewBox 0 0 1000 330`, altura 300px, `preserveAspectRatio:none`):
- Eixo Y: 0 / 350k / 700k / 1,05mi / 1,40mi (maxY = 1.400.000). Grid `rgba(255,255,255,.1)`.
- Eixo X: dias 1, 5, 10, 15, 20, **hoje** (=23, verde 700), 30.
- **Realizado** (dia 1→23): `linePath` azul `#60a5fa` 2,5px + `areaPath` gradiente azul (drawLine 1s). Ponto cheio em "hoje".
- **Projeção** (trajetória mês inteiro 1→30, alvo R$ 1.260.012): `projFullPath` tracejado verde `#6ee7b7` (`stroke-dasharray:6 6`). Ponto cheio no dia 30.

**Tooltip de hover (dia-a-dia)** — sobre `onMouseMove`/`onMouseLeave` do container:
- Converte clientX→dia (1–30, arredondado). Mostra linha-guia vertical tracejada + ponto branco no valor.
- Card branco com data ("D jun" / "23 jun · hoje") e:
  - **Realizado** (azul) — só nos dias ≤ 23.
  - **Projeção** (verde) — todos os dias.
- Ex. dia 15: Realizado ≈ R$ 693.627 · Projeção ≈ R$ 643.244. Tooltip vira de lado nos extremos (dias ≤3 ou ≥25) pra não cortar.

### Curvas (derivação, read-only)
```
maxY=1_400_000; X(d)=60+((d-1)/29)*920; Y(v)=280-(v/maxY)*250
realizado(d≤23) = 1_050_010 * (d/23)^0.97
projeção(d)     = 1_260_012 * (d/30)^0.97   // trajetória esperada
aRealizar       = projEnd − realizadoEnd = 210.002
```
> **Honestidade:** se o backend não tiver série **diária** de LB, a linha "realizado" é interpolação do acumulado — rotule como estimativa. O tooltip de projeção é determinístico (trajetória), não previsão estatística.

---

## Tokens

- Navy painel/marca: `#1e3a5f` · azul realizado `#60a5fa` / `#2563eb` · verde projeção `#6ee7b7` / `#059669`
- Texto: `#111827` (forte) · `#6b7280` / `#9ca3af` (label) · sobre navy `#fff` + `rgba(255,255,255,.55/.75/.92)`
- Cards: `#fff` · borda `#eef0f3` · raio 16px · KPIs raio 11–16px
- Fonte: Inter. Tabular-nums em todos os números. Ícone-pills 36×36.

## Comportamento
- `expanded: boolean` (default false) — alterna tabela ↔ gráfico, com transição de largura nos cards de setor (maxW/opacity/flex).
- `hoverDay: number|null` — dia sob o cursor; dirige linha-guia, ponto e tooltip.
- Sem escrita, sem fetch: tudo derivado do consolidado por setor + série diária (ou interpolação).

## Arquivos
- `Central da Rede - Visao Geral.dc.html` — referência visual fiel (abre no browser).
- `screenshots/01-visao-geral.png` — tela completa (4 cards + painel Projeção em tabela).
