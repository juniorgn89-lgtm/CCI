# BI — medidas DAX (export verbatim do .pbix, fev/2026)

Fonte da verdade dos cálculos. Exportado via DAX query view (`INFO.MEASURES()`).
Resumo das regras em [BI-REFERENCE.md](BI-REFERENCE.md). Ponto-chave do modelo:
**o BI calcula TUDO a partir de `fVendas` (venda fiscal)** — não usa tabela de
abastecimento/bomba. "Litros Abastecidos"/"Abastecimentos" são derivados de
`fVendas` filtrando `tipoProduto="C"`.

## Valor por setor (núcleo)
```dax
Faturamento Combustiveis = CALCULATE(SUM(fVendas[totalVenda]), dProduto[tipoProduto]="C", fVendas[cancelada]="N")
Custo Combustiveis       = CALCULATE(SUMX(fVendas, fVendas[precoCusto]*fVendas[quantidade]), dProduto[tipoProduto]="C", fVendas[cancelada]="N")
Lucro Bruto Combustiveis = [Faturamento Combustiveis] - [Custo Combustiveis]
Margem Combustiveis      = DIVIDE([Lucro Bruto Combustiveis], [Faturamento Combustiveis])
Litros Vendidos          = CALCULATE(SUM(fVendas[quantidade]), dProduto[tipoProduto]="C", fVendas[cancelada]="N")
Preco Venda Combustiveis = DIVIDE([Faturamento Combustiveis], [Litros Vendidos])
Preco Custo Combustiveis = DIVIDE([Custo Combustiveis], [Litros Vendidos])
Lucro Bruto Litro        = DIVIDE([Lucro Bruto Combustiveis], [Litros Vendidos])
Acrescimos Combustiveis  = CALCULATE(SUM(fVendas[totalAcrescimo]), NOT ISBLANK(fVendas[bicoCodigo]), dProduto[tipoProduto]="C", fVendas[cancelada]="N")
Descontos Combustiveis   = CALCULATE(SUM(fVendas[totalDesconto]),  NOT ISBLANK(fVendas[bicoCodigo]), dProduto[tipoProduto]="C", fVendas[cancelada]="N")

Faturamento Automotivos  = CALCULATE(SUM(fVendas[totalVenda]),  dProduto[dGrupo.tipoGrupo]="Pista" && dProduto[tipoProduto]<>"C", fVendas[cancelada]="N")
Custo Automotivos        = CALCULATE(SUM(fVendas[totalCusto]),  dProduto[dGrupo.tipoGrupo]="Pista" && dProduto[tipoProduto]<>"C", fVendas[cancelada]="N")
Quantidade Automotivos   = CALCULATE(SUM(fVendas[quantidade]),  dProduto[dGrupo.tipoGrupo]="Pista" && dProduto[tipoProduto]<>"C", fVendas[cancelada]="N")
Lucro Bruto Automotivos  = [Faturamento Automotivos] - [Custo Automotivos]
Margem Automotivos       = DIVIDE([Lucro Bruto Automotivos], [Faturamento Automotivos])
Preco medio Automotivos  = DIVIDE([Faturamento Automotivos], [Quantidade Automotivos])
Custo Medio Automotivos  = DIVIDE([Custo Automotivos], [Quantidade Automotivos])
Ticket Medio Automotivos = DIVIDE([Faturamento Automotivos], CALCULATE(DISTINCTCOUNT(fVendas[vendaCodigo]), Pista && <>"C", cancelada="N"))
Descontos Automotivos    = CALCULATE(SUM(fVendas[totalDesconto]), NOT ISBLANK(fVendas[bicoCodigo]), dProduto[tipoProduto]="P" && dProduto[dGrupo.tipoGrupo]="Pista", fVendas[cancelada]="N")

Faturamento Conveniencia = CALCULATE(SUM(fVendas[totalVenda]),  dProduto[dGrupo.tipoGrupo]="Conveniência", fVendas[cancelada]="N")
Custo Conveniencia       = CALCULATE(SUM(fVendas[totalCusto]),  dProduto[dGrupo.tipoGrupo]="Conveniência", fVendas[cancelada]="N")
Quantidade Conveniencia  = CALCULATE(SUM(fVendas[quantidade]),  dProduto[dGrupo.tipoGrupo]="Conveniência", fVendas[cancelada]="N")
Lucro Bruto Conveniencia = [Faturamento Conveniencia] - [Custo Conveniencia]
Margem Conveniencia      = DIVIDE([Lucro Bruto Conveniencia], [Faturamento Conveniencia])
Preco Medio Conveniencia = DIVIDE([Faturamento Conveniencia], [Quantidade Conveniencia])
Custo Medio Conveniencia = DIVIDE([Custo Conveniencia], [Quantidade Conveniencia])
Ticket Medio Conveniencia= DIVIDE([Faturamento Conveniencia], CALCULATE(DISTINCTCOUNT(fVendas[vendaCodigo]), Conveniência, cancelada="N"))

Faturamento Geral  = [Faturamento Automotivos] + [Faturamento Combustiveis] + [Faturamento Conveniencia]
Lucro Bruto Geral  = [Lucro Bruto Combustiveis] + [Lucro Bruto Automotivos] + [Lucro Bruto Conveniencia]
Margem Geral       = DIVIDE([Lucro Bruto Geral], [Faturamento Geral])
Ticket Médio Geral = [Ticket Medio Automotivos] + [Ticket Medio Conveniencia]
```

## Ano anterior (AA) — âncora = ÚLTIMA VENDA do dataset (não "hoje")
```dax
-- padrão repetido em todas as *_AA:
VAR LastSale = CALCULATE(LASTDATE(fVendas[dataMovimento]), ALL(fVendas))
VAR LimitDate = EDATE(LastSale, -12)
RETURN CALCULATE([<medida>], SAMEPERIODLASTYEAR(dCalendario[Data]), FILTER(ALL(dCalendario), dCalendario[Data] <= LimitDate))
-- usado em: Litros Vendidos AA, Lucro Bruto AA Combustiveis, Faturamento Produtos AA,
--           Lucro Bruto Automotivos AA, Faturamento/Lucro Bruto Conveniencia AA,
--           Margem Combustiveis Ano Anterior, Lucro Bruto Litro Ano Anterior, Ticket *_AA
-- Variação geral: DIVIDE([atual]-[AA], [AA], BLANK())  (Variacao Litros e L.Bruto Comb. tratam AA<=1 → 100%)
```

## PROJEÇÃO / PREVISÃO — linear por dias decorridos COM venda
```dax
Dias Corridos = IF(COUNT(fVendas[totalVenda])>0, DISTINCTCOUNT(dCalendario[Data]))   -- dias com venda
nDias         = SELECTEDVALUE(dCalendario[ultimoDia])                                -- dias do mês
Previsao Litros                  = DIVIDE([Litros Vendidos], [Dias Corridos], 0) * [nDias]
Previsao Lucro Bruto Combustiveis= DIVIDE([Lucro Bruto Combustiveis], [Dias Corridos], 0) * [nDias]
Previsao Faturamento Automotivos = DIVIDE([Faturamento Automotivos], [Dias Corridos], 0) * [nDias]
Previsao Faturamento Conveniencia= DIVIDE([Faturamento Conveniencia], [Dias Corridos], 0) * [nDias]
Projecao Geral             = DIVIDE([Faturamento Geral], [Dias Corridos]) * [nDias]
Projecao Lucro Bruto Geral = DIVIDE([Lucro Bruto Geral], [Dias Corridos]) * [nDias]
```

## Operacional (FISCAL — tudo de fVendas, NÃO da bomba)
```dax
Abastecimentos        = CALCULATE(COUNTROWS(fVendas), dProduto[tipoProduto]="C", fVendas[cancelada]="N")     -- nº de LINHAS de venda de combustível
Litros Abastecidos    = CALCULATE(SUM(fVendas[quantidade]), dProduto[tipoProduto]="C", fVendas[cancelada]="N") -- = Litros Vendidos
Vendas de Produtos    = CALCULATE(SUM(fVendas[totalVenda]), dProduto[tipoProduto]<>"C", fVendas[cancelada]="N")
Qtd Produtos Vendidos = CALCULATE(SUM(fVendas[quantidade]), dProduto[tipoProduto]<>"C", fVendas[cancelada]="N")
Media Litros/Abast    = DIVIDE([Litros Abastecidos], [Abastecimentos])
Atendimentos Combustível = CALCULATE(DISTINCTCOUNT(fVendas[vendaCodigo]), tipoProduto="C", cancelada="N")
Atendimentos com Produto = CALCULATE(DISTINCTCOUNT(fVendas[vendaCodigo]), tipoProduto<>"C", cancelada="N")
Conversão de Produtos %  = DIVIDE([Atendimentos com Produto], [Atendimentos Combustível])   -- % de cupons de combustível que levaram produto
Conversão %              = DIVIDE([Vendas de Produtos], [Abastecimentos])                   -- R$ de produto por abastecimento
```

## Frentista / Pareto / Classe ABC (apresentação/ranking)
```dax
Total Vendas Frentista = CALCULATE(SUM(fVendas[totalVenda]), fVendas[cancelada]="N")
Frentista Campeão = nome do TOPN(1) por [Vendas de Produtos]   -- ranking por dFuncionario
Medalha Vendas / Medalha Conversão % = RANKX(ALL(dFuncionario), …) → 🥇🥈🥉👤
% Pareto Automotivos/Conveniencia = % acumulado do faturamento por produto (ALLSELECTED)
Classe ABC = SWITCH(% Pareto >=0.9 "C", >=0.7 "B", "A")
Selecao Pareto / Qtde Produtos Selecao / etc. = lógica do slider de Pareto (AuxParetoAut/Conv)
Mix = DIVIDE(qtd produto 1483885, qtd 1483885 + 1483873)   -- aditivado vs comum (códigos hardcoded)
```

> Cartões (`Cartão Variacao …`), `Tendência …`, `Narrativa Vendas`, `UltimaAtualizacao`,
> `Dia da semana`, `Titulo Tabela Previsao` = formatação/ícones/texto, sem impacto de valor.
