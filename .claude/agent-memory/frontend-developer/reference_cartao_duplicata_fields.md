---
name: cartao-duplicata-fields
description: Campos disponíveis em /CARTAO (taxa) e /DUPLICATA na API Quality — o que dá e não dá derivar com segurança no Financeiro
metadata:
  type: reference
---

# /CARTAO (type `Cartao`, src/api/types/financeiro.ts)

- `taxaPercentual: number` — taxa % por transação EXISTE. Logo **Taxa R$ = valor × taxaPercentual / 100** é derivável com segurança.
- **NÃO existe** campo de valor líquido em /CARTAO. `valorLiquido` só existe em `Duplicata`, não em `Cartao`. Não exibir "valor líquido" de cartão sem confirmar com o cliente (bloqueado).
- Administradora vem com typo: `adiministradoraDescricao` (3 i's).
- Outros úteis: `clienteRazao`, `codigoBandeira`, `pendente`, `vencimento`, `dataMovimento`, `dataPagamento`, `autorizacao`, `nsu`, `vendaCodigo`.
- `fetchCartao` aceita `apenasPendente`, `dataFiltro` (MOVIMENTO/VENCIMENTO/PAGAMENTO) e paginação.

# /DUPLICATA (type `Duplicata`, `fetchDuplicatas`)

- "Em aberto / não baixada" = `pendente === true` (mesma semântica de TituloReceber).
- Saldo em aberto = `valorDuplicata − valorPago` (clampar em 0). Tem também `valorLiquido`, `situacao`, `vencimento`, `clienteCodigo`, `nomeCliente`.
- `fetchDuplicatas` aceita `apenasPendente` + janela ampla (snapshot 2015→hoje como os outros pendentes).

# Notas a prazo NÃO faturadas

- = TituloReceber EM ABERTO (`pendente===true`) com `convertido===false`.
- BUG histórico que fazia o total divergir do webPosto: filtrar só por `convertido===false` sem exigir `pendente` somava títulos já baixados/faturados. Sempre exigir `pendente===true`.
