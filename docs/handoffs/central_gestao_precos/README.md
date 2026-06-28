# Handoff — Central da Rede · Gestão de Preços

Tela nova do módulo **Central da Rede**. Cruza as **tabelas de preço do WebPosto** (tabela geral + tabela por cliente) com o **preço efetivamente batido na bomba** (cupom fiscal) para tornar visível o **desvio de preço** — o desconto (ou acréscimo) que o operador concede no movimento e que não fica registrado como desconto no cupom.

O componente é **read-only / diagnóstico** (analista IA): lê, cruza e prioriza. Nunca altera preço de bomba nem grava na tabela.

---

## Prompt para o Claude Code

> Quero criar a tela **"Gestão de Preços"** no módulo **Central da Rede** do Visor360. Ela cruza as tabelas de preço do WebPosto (tabela de preço geral + tabela de preço por cliente / preço especial) com o preço médio praticado na bomba (do cupom fiscal) e expõe, por **produto**, por **cliente** e por **empresa/posto**, onde a rede está cedendo margem por ajuste de bomba abaixo da tabela. Inclui ainda uma aba **"Impacto no LB"** (quanto cada posto cedeu de lucro bruto, cruzado com a tabela cadastrada que originou o desconto) e uma aba **"Tabelas cadastradas"** (espelho da tela "Tabela de Preço de Prazos" do WebPosto: lista mestre + detalhe das linhas de Preço Especial). As 5 sub-abas, os KPIs, a tabela e a "Leitura do especialista" estão no protótipo HTML em anexo e nos screenshots. Mantenha 100% read-only: nenhuma escrita na API; a IA só diagnostica. Siga o design system do projeto (navy #1e3a5f, azul #2563eb, Inter, cards radius 14, KPIs com tabular-nums). O contrato de dados (o que é fato, estimativa e manual) está descrito abaixo — respeite os rótulos de honestidade.

Anexar: `Central da Rede - Gestao de Precos.dc.html` + os 5 screenshots de `screenshots/`.

---

## Estrutura (5 sub-abas)

Barra de sub-abas (segmented, navy quando ativa). O realce da aba ativa é renderizado via `sc-if` (ativo/inativo) — **não** por style hole no topo do template, porque holes de estilo fora de `sc-for`/`sc-if` não re-renderizam no clique (bug observado e corrigido).

1. **Por produto** (default) — preço praticado × tabela por combustível.
2. **Por cliente** — frota / preço especial; inclui busca por cliente.
3. **Por empresa** — consolidado por posto/unidade.
4. **Impacto no LB** — quanto de lucro bruto cada posto cedeu, com a origem cruzada (tabela cadastrada).
5. **Tabelas cadastradas** — espelho da "Tabela de Preço de Prazos" do WebPosto (mestre-detalhe).

Acima das abas, uma **faixa-flag** fixa explica o que a tela cruza ("A IA cruza a tabela de preço e a tabela por cliente do WebPosto com o preço batido na bomba… o desvio fica visível como margem cedida ou ganha") + selo "Analista IA".

---

## Abas analíticas (Por produto / Por cliente / Por empresa)

Mesma anatomia, dados trocam por aba:

- **4 KPIs**: Desconto concedido (R$, vermelho) · Preço praticado médio (vs tabela, %) · Margem líquida (após desconto, com LB) · Concentração do vazamento (qual produto puxa, % e R$).
- **Tabela "Preço praticado × tabela"**: colunas variam por aba (produto/cliente/posto + preço tabela, praticado, desvio R$/L, volume, LB cedido…). Linhas com desvio recebem tint e pill. A aba **Por cliente** mostra um campo de busca.
- **Leitura do especialista**: faixa navy com 3 colunas (o que acontece / contraponto / origem) + bloco azul de **Recomendação** + botão "Criar tarefa" (placeholder de ação; não executa).

---

## Aba "Impacto no LB" (o cruzamento LB × tabelas)

O pedido central: **por posto, quanto de lucro bruto foi cedido pelos descontos de bomba**, e **de qual tabela** veio.

- **4 KPIs da rede**: LB realizado (R$ 139.083) · Impacto dos descontos / cedido (−R$ 11.710) · LB potencial (R$ 150.793 = realizado + cedido) · % do LB cedido (7,8%).
- **Card por posto** (5 postos): valor cedido (R$ + % do potencial), **barra realizado (navy) × cedido (vermelho) = potencial**, legenda com os 3 números, e chips de **Origem** ligando cada parcela do desconto à tabela cadastrada que o gerou (ex.: Trivillin −R$ 4.490 = `00002` Frota Diesel R$ 2.822 + `00001` Padrão R$ 1.668).
  - Cor do valor por severidade: ≥12% vermelho · ≥6% âmbar · <6% verde. Selos "maior impacto" (Serra) / "mais disciplinado" (Centro).
- **Leitura do especialista**: Serra concentra (19% do próprio LB potencial); Centro é o contraponto (1,1%, melhor margem 12,90%); a maior fatia é Diesel (ajuste de bomba abaixo da `00001` + over-desconto além do convênio `00002`). Recomendação: padronizar teto de desconto pela referência do Centro; recuperação estimada ~R$ 7.500/mês.

### Como derivar (contrato de dados)

| Campo | Natureza | Fonte |
|---|---|---|
| LB realizado por posto/produto | ✅ Fato | apuração (cache) / useRedeSetores |
| Preço praticado médio na bomba | ✅ Fato | faturamento ÷ litros do cupom |
| Preço de tabela / preço especial | ✅ Fato (manual no WebPosto) | tabela de preço + tabela por cliente |
| **LB cedido** = (tabela − praticado) × volume | 🟡 Derivado | acima; é o desvio × volume |
| LB potencial = realizado + cedido | 🟡 Derivado | soma |
| Atribuição por tabela (chips "Origem") | 🟡 Estimativa | match do produto/cliente/posto com a tabela vigente que cobre aquela venda |
| Recuperação estimada (~R$/mês) | 🟡 Estimativa (teto) | fechar o gap até a referência do melhor posto — rotular "estimativa" |

> ⚠️ A atribuição "qual tabela originou o desconto" é o ponto que exige regra explícita no backend: para cada venda, achar a tabela vigente (por validade + dia da semana + filial + cliente/grupo) e comparar o praticado com o valor dessa tabela. Onde não houver tabela especial aplicável, cai na tabela geral (`00001`). Não inventar atribuição — quando ambíguo, marcar como "Tabela Padrão · ajuste bomba".

---

## Aba "Tabelas cadastradas" (espelho do WebPosto)

Mestre-detalhe, fiel à tela "Tabela de Preço de Prazos":

- **Lista mestre** (esquerda, 332px): Ref (`00001`…`00005`), descrição, selo **Vigente/Expirada**, contagem de itens e início. Item ativo com borda-esquerda azul.
- **Detalhe** (direita): cabeçalho (Ref + selo + nome + botão "Exportar XLSX" placeholder), faixa com **Validade inicial / final / Dias da semana / Filial**, e a tabela **Dados de Preço Especial** com as colunas do WebPosto: **Filial · Cliente · Grupo de Cliente · Produto · Tipo · Valor**.
- "Tipo" suporta Preço Específico (valor em R$) e Desconto % (mostra o texto do desconto). É a fonte que as outras abas cruzam (ex.: `00002` Frota Diesel — Convênio alimenta os preços de contrato da aba Por cliente).

---

## Design tokens

- Navy `#1e3a5f` (marca, aba ativa, headers de leitura) · azul `#2563eb` (acento, recomendação).
- Severidade: verde `#16a34a` / âmbar `#d97706` / vermelho `#dc2626`; tints `#f0fdf4` / `#fffbeb` / `#fef2f2`; bordas `#fecaca` (alerta).
- Cinzas: texto `#111827` / `#374151` / `#6b7280` / `#9ca3af`; bordas `#e5e7eb` / `#f1f3f5`; fundo `#f9fafb`.
- Inter 400–800. Números com `font-variant-numeric: tabular-nums`. Cards `border-radius:14px`, KPI value 26px/800.
- Moeda: R$ sem centavos nos agregados (LB, cedido) e com centavos no preço/litro (R$ 6,64).

---

## Princípios (cumpridos)

- **Read-only**: zero escrita; "Criar tarefa" e "Exportar XLSX" são placeholders de ação (não executam no protótipo).
- **Honestidade de dado**: fato vs derivado vs estimativa rotulados; atribuição de tabela exige regra de vigência no backend (descrita acima), nunca um número inventado.
- **Um componente, 5 abas**: troca de aba só re-renderiza o corpo; segmented via `sc-if` para o realce reagir ao clique.

## Arquivo
- `Central da Rede - Gestao de Precos.dc.html` — protótipo completo (template + lógica).
- `screenshots/01..05` — Por produto · Por cliente · Por empresa · Impacto no LB · Tabelas cadastradas.
