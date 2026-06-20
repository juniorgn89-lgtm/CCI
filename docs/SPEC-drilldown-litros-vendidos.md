# Spec — Drill-down "Litros Vendidos" (Vendas → Combustível)

**Status:** conceito validado com dados reais (piloto) · **Sem código de tela ainda.**
**Cartão:** Litros Vendidos · **Módulo:** Vendas → Combustível
**Data da validação:** 2026-06-21 (dados ITAPOA / empresa 7411, maio/2026)

---

## 1. Objetivo (job-to-be-done)
Quando o dono/gerente olha "Litros Vendidos" e pensa *"esse volume bate com o que entrou e saiu do tanque? teve perda?"*, ele clica no cartão e vê, por produto, a **perda/sobra de combustível** (físico medido vs. teórico) — além de **entender como o número é calculado**.

## 2. Interação
- **Clique no cartão → abre UM modal** centralizado. **Sem menu intermediário** ("O que deseja ver?" foi descartado: 2 ações não justificam menu).
- Modal com duas partes:
  - **(1) Reconciliação por produto** (principal) — a "ponte" do LMC.
  - **(2) "Como é calculado?"** (seção/aba secundária, recolhível).
- **100% read-only** (modal + leitura). Nenhuma gravação.

## 3. Fonte de dados — `/LMC` (Livro de Movimentação de Combustíveis)
Decisão validada: a reconciliação **NÃO** é "bomba vs venda" (ver §6) — é o **LMC**, que já traz tudo pronto, por produto/dia:

| Campo LMC | Significado |
|---|---|
| `abertura` | estoque inicial do dia |
| `entrada` | compras (entradas de combustível) |
| `saida` | vendas — **= "Litros Vendidos" do cartão** (bate exato) |
| `escritural` | estoque teórico = `abertura + entrada − saida` |
| `fechamento` | estoque medido (régua/automação) |
| `perdaSobra` | **`fechamento − escritural`** = perda (−) / sobra (+) |

**Ponte exibida no modal (agregada no período, por produto):**
> Abertura + Entrada − Saída = **Teórico (escritural)**
> vs **Medido (fechamento)**
> = **Perda/Sobra** (litros e %, com status)

Agregação no período: `abertura` = do 1º dia; `fechamento` = do último dia; `entrada`/`saida`/`perdaSobra` = somados. Mesmo `empresaCodigo` e período do filtro global da tela.

## 4. Faixas de status (calibradas no dado real)
Valores observados em maio/2026 ficaram entre **−0,54% e +0,44%** por produto. Proposta (configurável):
- 🟢 |%| ≤ **0,5%** (normal: evaporação/temperatura/calibração)
- 🟡 0,5–1,0% (atenção)
- 🔴 > 1,0% (alerta)

## 5. Seção "Como é calculado?"
- **Litros Vendidos (cartão)** = `saida` do LMC = itens de venda **autorizados** (situação A), combustível, no período.
- **Perda/Sobra** = estoque medido (fechamento) − estoque teórico (abertura + compras − vendas).
- **Por que existe perda/sobra:** evaporação, temperatura, tolerância de calibração (~0,5% INMETRO), aferição, desvio.
- Nota: *"a medição de tanque aparece só aqui, como conferência; as telas de operação seguem na base fiscal."*

## 6. Decisões e descobertas da validação (importante manter)
- **`/ABASTECIMENTO` ignora `empresaCodigo`** e devolve a **rede inteira** — precisa filtrar `empresaCodigo` no cliente (ITAPOA era 15.166 de 75.031 registros). Mesmo vício do `/PRODUTO_ESTOQUE`.
- **Bomba vs Venda dá ~0%**: cada abastecimento tem `vendaItemCodigo` — a "bicada" da bomba **é** a venda (mesmo dado em duas tabelas). Por isso a reconciliação bomba-vs-venda foi **descartada** (sempre ~0). Provavelmente foi isso que motivou as Bombas a irem pro fiscal (o físico só "parecia" diferente pelo bug do empresaCodigo).
- **`/LMC` filtra `empresaCodigo` corretamente** (155 registros, todos 7411).
- `perdaSobra` já vem calculado pelo sistema — não recalcular físico-vs-fiscal manualmente.

## 7. Dados reais de referência (maio/2026, ITAPOA)
| Produto | Entrada | Saída | Perda/Sobra | % |
|---|---|---|---|---|
| Gasolina comum | 158.000 | 164.390,5 | −611,5 | −0,372% |
| Etanol comum | 58.000 | 61.470,3 | −219,7 | −0,357% |
| Diesel S-10 | 24.000 | 25.502,6 | +3,6 | +0,014% |
| Diesel S-10 aditivado | 16.000 | 16.817,4 | −34,6 | −0,206% |
| Gasolina aditivada | 11.000 | 11.904,5 | −64,5 | −0,542% |
| Diesel B S10 aditivado | 8.000 | 8.685,3 | +38,3 | +0,440% |

## 8. Critério de sucesso do piloto
A reconciliação mostra perda/sobra **plausível e acionável** por produto (faixa ~±0,5%). Número absurdo = tratamento de dado errado, **não** ideia ruim.

## 9. Fora de escopo (piloto)
- Drill-down por bomba/bico (v2 — "onde está a perda").
- Aplicar o padrão em outros cartões (Lucro Bruto, Faturamento…) — depende do piloto validar.
- Ação "Focar/Destacar" (o outro pedido original) — separado, depende de diferenciar do Modo Foco atual.
- Exportar.

## 10. Em aberto
1. Faixas 0,5 / 1,0% — confirmar com referência do usuário.
2. Agrupamento por produto (ok) — bomba fica pra v2.
3. Endpoint `/LMC` já existe no código (`fetchLmc`, `src/api/endpoints/combustiveis.ts`) e tem cache na apuração — avaliar live vs cache no desenho.
