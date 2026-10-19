-- ============================================================================
-- Preço de BOMBA atual por posto × produto (o de tabela que está valendo).
--
-- O Comercial comparava o "meu preço" de jeitos diferentes: a análise do posto
-- usava o preço de tabela de hoje e a régua/Concorrência a MÉDIA vendida no
-- período (que mistura descontos e mudanças do mês). Vizinho é preço de bomba
-- observado, então a comparação tem de ser bomba × bomba. Esta view dá o último
-- preco_cadastro carimbado no cache de abastecimentos (últimos 10 dias).
-- security_invoker: respeita a RLS de apuracao_abastecimentos.
-- ============================================================================
create or replace view public.preco_bomba_atual
with (security_invoker = true) as
select distinct on (rede_id, empresa_codigo, codigo_produto)
  rede_id,
  empresa_codigo,
  codigo_produto,
  preco_cadastro as preco,
  data_fiscal,
  data_hora_abastecimento
from public.apuracao_abastecimentos
where data_fiscal >= current_date - 10
  and preco_cadastro is not null
  and preco_cadastro > 0
  and codigo_produto is not null
order by rede_id, empresa_codigo, codigo_produto, data_hora_abastecimento desc nulls last;

grant select on public.preco_bomba_atual to authenticated;
