# BI-REFERENCE — Fonte da verdade (WebPosto / CCI)

O BI externo (Power BI "WebPosto / CCI Consultoria") é a **referência oficial** de todos
os números do Visor360. Quando uma tela diverge, **o BI está certo** e a gente alinha.
Este doc guarda as medidas DAX exatas e o esquema das tabelas-fonte, pra cada tela nova
já começar sabendo a fórmula. Mantenha atualizado conforme novas medidas chegarem.

> Modelo de dados do BI: `fVendas` (fato de itens de venda) × `dProduto` (catálogo) ×
> `dCalendario` (datas). O `cancelada` vive no nível de venda mas chega em `fVendas`
> por item (no nosso lado vem do endpoint `/VENDA_ITEM`).

---

## 1. Classificação de setor (a régua mestra)

A classificação do BV **não** é pelo nome do grupo — é pelos campos `tipoProduto` e
`dGrupo.tipoGrupo`:

| Setor | Regra | Custo | Observação |
|---|---|---|---|
| **Combustível** | `dProduto[tipoProduto] = "C"` | `Σ precoCusto × quantidade` | sem filtro de grupo |
| **Automotivos** | `dGrupo[tipoGrupo] = "Pista"` **e** `tipoProduto <> "C"` | `Σ totalCusto` | inclui "USO E CONSUMO" (tipoGrupo Pista, tipoProduto "U") |
| **Conveniência** | `dGrupo[tipoGrupo] = "Conveniência"` | `Σ totalCusto` | valor EXATO (com acento), não "tudo que não é Pista" |
| **(outros)** | resto | — | **excluído** de todos os setores e do Global |

**Todas** as medidas filtram `fVendas[cancelada] = "N"` (descarta canceladas).
**Faturamento = `Σ totalVenda`** (bruto, sem desconto).

Implementado no Visor360 em [apuracao.ts](../src/api/supabase/apuracao.ts) (`aggregateVendaItensToCache`,
carimbo de setor) e [useRedeSetores.ts](../src/pages/Dashboard/hooks/useRedeSetores.ts).
Ver memória `project_apuracao_vendas_setor_congelado`.

---

## 2. Medidas DAX (verbatim do BI)

### Combustível
```dax
Faturamento Combustiveis =
CALCULATE(SUM(fVendas[totalVenda]), dProduto[tipoProduto] = "C", fVendas[cancelada] = "N")

Custo Combustiveis =
CALCULATE(SUMX(fVendas, fVendas[precoCusto] * fVendas[quantidade]),
          dProduto[tipoProduto] = "C", fVendas[cancelada] = "N")

Lucro Bruto Combustiveis = [Faturamento Combustiveis] - [Custo Combustiveis]

Acrescimos Combustiveis =
CALCULATE(SUM(fVendas[totalAcrescimo]),
          NOT ISBLANK(fVendas[bicoCodigo]), dProduto[tipoProduto] = "C", fVendas[cancelada] = "N")

Descontos Combustiveis =
CALCULATE(SUM(fVendas[totalDesconto]),
          NOT ISBLANK(fVendas[bicoCodigo]), dProduto[tipoProduto] = "C", fVendas[cancelada] = "N")

Litros Vendidos =
CALCULATE(SUM(fVendas[quantidade]), dProduto[tipoProduto] = "C", fVendas[cancelada] = "N")
```
> ⚠️ **Custo de combustível usa `precoCusto × quantidade`**, NÃO `Σ totalCusto`.
> ⚠️ Acréscimos/Descontos de combustível filtram `NOT ISBLANK(bicoCodigo)` (só venda por
> bomba). Pra nós é redundante: `tipoProduto="C"` sempre sai por bico.

### Automotivos
```dax
Faturamento Automotivos =
CALCULATE(SUM(fVendas[totalVenda]),
          AND(dProduto[dGrupo.tipoGrupo] = "Pista", dProduto[tipoProduto] <> "C"),
          fVendas[cancelada] = "N")
```

### Conveniência
```dax
Faturamento Conveniencia =
CALCULATE(SUM(fVendas[totalVenda]), dProduto[dGrupo.tipoGrupo] = "Conveniência", fVendas[cancelada] = "N")

Custo Conveniencia =
CALCULATE(SUM(fVendas[totalCusto]), dProduto[dGrupo.tipoGrupo] = "Conveniência", fVendas[cancelada] = "N")

Lucro Bruto Conveniencia = [Faturamento Conveniencia] - [Custo Conveniencia]
```

### Ano Anterior (AA) — "mesmos dias decorridos"
```dax
Litros Vendidos AA =
VAR LastSale = CALCULATE(LASTDATE(fVendas[dataMovimento]), ALL(fVendas))
VAR LimitDate = EDATE(LastSale, -12)
RETURN CALCULATE([Litros Vendidos],
                 SAMEPERIODLASTYEAR(dCalendario[Data]),
                 FILTER(ALL(dCalendario), dCalendario[Data] <= LimitDate))

Lucro Bruto AA Combustiveis =
VAR LastSale = CALCULATE(LASTDATE(fVendas[dataMovimento]), ALL(fVendas))
VAR LimitDate = EDATE(LastSale, -12)
RETURN CALCULATE([Lucro Bruto Combustiveis],
                 SAMEPERIODLASTYEAR(dCalendario[Data]),
                 FILTER(ALL(dCalendario), dCalendario[Data] <= LimitDate))
```
> **Lógica do AA:** `LastSale` = última data de venda em todo o dataset; `LimitDate` =
> LastSale − 12 meses. O ano anterior é o MESMO período do ano passado, **cortado em
> `Data ≤ LimitDate`**. Ou seja: mês corrente parcial compara só os dias já decorridos
> contra os mesmos dias do ano passado. Implementado no Visor360 cortando o fim do AA em
> `hoje` ([useRedeSetores.ts](../src/pages/Dashboard/hooks/useRedeSetores.ts), `todayLocal`).
> Em período fechado coincide com `offsetPeriod(±12)`.

---

## 3. Esquema das tabelas-fonte (Quality API)

- **`/VENDA_ITEM`** (fato de vendas, base de tudo): `empresaCodigo`, `vendaCodigo` (= cupom),
  `dataMovimento`, `produtoCodigo`, `quantidade`, `precoCusto`, `totalCusto`, `precoVenda`,
  `totalVenda`, `totalDesconto`, `totalAcrescimo`, `bicoCodigo`, `funcionarioCodigo`,
  `cancelada` ("N"/"S"). Ticket médio conveniência = `totalVenda ÷ nº de vendaCodigo distintos`.
- **`dProduto`**: `produtoCodigo`, `nome`, `tipoProduto` ("C"=combustível, "U"=uso/consumo, …),
  `combustivel` (flag), `grupoCodigo`.
- **`dGrupo`**: `grupoCodigo`, `nome` (ex.: "PS - LUBRIFICANTES", "USO E CONSUMO"),
  `tipoGrupo` ("Pista", "Conveniência", …).
- **Frentistas**: `nome`, `codigo`, `cargo` ("FRENTISTA") — alimenta a aba Sherlock/fraude.
- **Estoque**: `empresaCodigo`, `produtoCodigo`, `estoqueQtde`.

### Empresas (código → nome)
`7411` ITAPOA · `7421` DIVINO · `7423` TREVISO · `9865` DARWIN · `31108` COMPLEXO COSTA AZUL.

---

## 4. Status de paridade (maio/2026, Central da Rede)

| Setor | Δ vs BI | Nota |
|---|--:|---|
| Combustível | ~+0,06% | bate |
| Conveniência | ~+0,01% | bate |
| Automotivos | ~+0,78% | resíduo = timing do snapshot; canceladas no automotivos = R$ 0 (verificado), classificação/fórmula idênticas |
| Ano anterior | pendente | re-apurar 2025 p/ alinhar o histórico |

---

## 5. Inventário de medidas do BI (extraído do `.pbix`, fev/2026)

**120 medidas** usadas no relatório `Comercial`. Tabelas do modelo: `dProduto`,
`dEmpresa`, `dFuncionario`, `dCalendario`, `fEstoque`, `Medidas`, `AuxParetoAut`,
`AuxParetoConv`, `Update` (+ `fVendas` como fato). ✅ = DAX já confirmado (seção 2);
o resto só temos o NOME — exportar o DAX via DAX Studio (`EVALUATE INFO.MEASURES()`)
ou Tabular Editor pra completar.

**Combustível:** ✅Faturamento Combustiveis · ✅Custo Combustiveis · ✅Lucro Bruto Combustiveis · ✅Lucro Bruto AA Combustiveis · ✅Litros Vendidos · ✅Litros Vendidos AA · ✅Acrescimos Combustiveis · ✅Descontos Combustiveis · Margem Combustiveis · Margem Combustiveis Ano Anterior · Lucro Bruto Litro · Lucro Bruto Litro Ano Anterior · Preco Custo Combustiveis · Preco Venda Combustiveis · AcrescimoCombustivel · Variacao L. Bruto Combustiveis · Previsao Lucro Bruto Combustiveis · CartaoVariacaoFaturamentoAA Combustivel · Cartao Variacao Litros AA · CartaoVariacaoLitrosAA · Variation Liters Fuel Last Year · Weekly Variation · Variacao Semanal · Variacao Litros

**Abastecimento (operacional):** Abastecimentos · Abastecimentos Mês Anterior · Litros Abastecidos · Litros Abastecidos Mês Anterior · Litros Media · Média Litros por Abastecimento · Previsao Litros · Tendência Litros · Tendência Abastecimentos

**Automotivos:** ✅Faturamento Automotivos · ✅Custo Automotivos · ✅Quantidade Automotivos · ✅Ticket Medio Automotivos · Ticket Medio Automotivos AA · Lucro Bruto Automotivos · Lucro Bruto Automotivos AA · Lucro Bruto Medio Automotivos · Custo Medio Automotivos · Margem Automotivos · Margem Automotivos AA · Preco medio Automotivos · Variacao Faturamento Automotivos · Variacao L. Bruto Automotivos · Previsao Faturamento Automotivos · Previsao FAturamento Automotivos MA · Variacao Previsao Faturamento Automotivos · Cartão Variacao Previsao Automotivos

**Conveniência:** ✅Faturamento Conveniencia · ✅Custo Conveniencia · ✅Lucro Bruto Conveniencia · Faturamento Conveniencia AA · Lucro Bruto Conveniencia AA · Lucro Bruto Medio Conveniencia · Custo Medio Conveniencia · Margem Conveniencia · Margem Conveniencia AA · Quantidade Conveniencia · Preco Medio Conveniencia · Ticket Medio Conveniencia · Ticket Medio Conveniencia AA · Variacao Faturamento Conveniencia · Variacao Lucro Bruto Conveniencia · Previsao Faturamento Conveniencia · Previsao Faturamento Conveniencia MA · Variacao Previsao Faturamento Conveniencia · Cartão Variacao Previsao Conveniencia · Cartão Variacao Faturamento Conveniencia · Cartão Variacao Lucro Bruto Conveniencia · Participacao Faturamento Conveniencia

**Produtos / Geral / Global:** Faturamento Geral · Lucro Bruto Geral · Margem Geral · Ticket Médio Geral · Faturamento Produtos AA · Cartão Variacao Faturamento Produtos · Cartão Variacao Lucro Bruto Produtos · Participacao Faturamento Produtos · Participacao % · Qtd Produtos Vendidos · Vendas de Produtos · Vendas de Produtos Mês Anterior · Atendimentos com Produto · Mix · Projecao Geral · Projecao Lucro Bruto Geral · Previsao de Vendas · Previsao de Vendas Mês Anterior · Tendência Vendas · Narrativa Vendas

**Pareto / Classe ABC:** % Pareto Automotivos · % Pareto Conveniencia · % Automotivos Seleção Pareto · % Conveniencia Seleção Pareto · % Diferença Automotivos Pareto · % Diferença Conveniencia Pareto · Classe ABC · Classe ABC Conveniencia · Dif Selecao Pareto Automotivos · Dif Selecao Pareto Conveniencia · Qtde Produtos Selecao Pareto Automotivos · Qtde Produtos Selecao Pareto Conveniencia · Selecao % Faturamento Automotivos · Selecao % Faturamento Conveniencia · Selecao Pareto Automotivos · Selecao Pareto Conveniencia · Selecao Produtos Pareto · Total Prod Vendidos Automotivos Pareto · Total Prod Vendidos Conveniencia Pareto

**Frentista / Conversão / Medalhas:** Conversão % · Conversão de Produtos % (Safe) · Frentista Campeão · Frentista Campeão Conversão · Medalha Conversão % · Medalha Vendas

**UI / Outros:** Dia da semana · UltimaAtualizacao · Titulo Tabela Previsao
