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
| Automotivos | ~+0,78% | investigando — não é cancelada nem classificação (re-apura não moveu); falta medir `totalVenda` de `cancelada="S"` no automotivos |
| Ano anterior | pendente | re-apurar 2025 p/ alinhar o histórico |
