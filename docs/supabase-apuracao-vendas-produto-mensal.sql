-- ============================================
-- apuracao_vendas_produto_mensal — VIEW agregada (posto × mês × produto)
-- ============================================
-- Base do Diagnóstico do posto (ano contra ano por produto/grupo). Ler
-- `apuracao_vendas` cru por 24 meses de um posto com loja é ~100 mil linhas;
-- agrupado por mês vira produtos × 24 (poucos milhares).
--
-- `quantidade > 0`: mesmo filtro da view diária por setor — os números batem.
-- `cupons_produto` é desnormalizado por (empresa, dia, produto); somar por mês
-- dá os cupons do produto no mês (um valor por dia, um por produto → soma vale).
--
-- security_invoker = on → herda a RLS de `apuracao_vendas`.
-- Rode no SQL Editor do Supabase (ou `supabase db query --linked -f`).

create or replace view public.apuracao_vendas_produto_mensal
with (security_invoker = on) as
select
  rede_id,
  empresa_codigo,
  to_char(data, 'YYYY-MM')                           as mes,
  setor,
  produto_codigo,
  max(produto_nome)                                  as produto_nome,
  sum(quantidade)                                    as quantidade,
  sum(total_venda)                                   as total_venda,
  sum(total_custo)                                   as total_custo,
  sum(coalesce(cupons_produto, 0))                   as cupons_produto,
  count(*)                                           as dias
from public.apuracao_vendas
where quantidade > 0
  and setor is not null
group by rede_id, empresa_codigo, to_char(data, 'YYYY-MM'), setor, produto_codigo;

grant select on public.apuracao_vendas_produto_mensal to anon, authenticated;
