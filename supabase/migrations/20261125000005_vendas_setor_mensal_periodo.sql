-- Evolução da rede (Mês / Ano) e escopo de segmento liam a view
-- apuracao_vendas_setor_mensal filtrando por `mes` (to_char da data): o filtro
-- não usa índice, então a view varria a tabela inteira (850 mil linhas na rede
-- maior, sort em disco) e estourava o statement_timeout de 8 s do
-- authenticated — o gráfico ficava "sem meses apurados".
--
-- Esta função filtra pela DATA (usa idx_apuracao_vendas_setor_diaria:
-- rede_id, data, setor WHERE quantidade > 0) e só depois agrupa por mês.
-- security invoker: a RLS de apuracao_vendas continua valendo.

create or replace function public.apuracao_vendas_setor_mensal_periodo(
  p_rede uuid,
  p_ini date,
  p_fim date,
  p_empresas integer[] default null,
  p_setor text default null
)
returns table (
  rede_id uuid,
  empresa_codigo integer,
  mes text,
  setor text,
  quantidade numeric,
  total_venda numeric,
  total_custo numeric,
  dias bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  -- Soma por dia primeiro e só depois por mês: evita o count(distinct data)
  -- (sort em disco) — dias = nº de dias com venda no mês.
  with por_dia as (
    select v.empresa_codigo, v.data, v.setor,
           sum(v.quantidade) as quantidade,
           sum(v.total_venda) as total_venda,
           sum(v.total_custo) as total_custo
      from apuracao_vendas v
     where v.rede_id = p_rede
       and v.data >= p_ini
       and v.data <= p_fim
       and v.quantidade > 0
       and v.setor is not null
       and (p_empresas is null or v.empresa_codigo = any (p_empresas))
       and (p_setor is null or v.setor = p_setor)
     group by v.empresa_codigo, v.data, v.setor
  )
  select p_rede as rede_id,
         d.empresa_codigo,
         to_char(d.data, 'YYYY-MM') as mes,
         d.setor,
         sum(d.quantidade) as quantidade,
         sum(d.total_venda) as total_venda,
         sum(d.total_custo) as total_custo,
         count(*) as dias
    from por_dia d
   group by d.empresa_codigo, to_char(d.data, 'YYYY-MM'), d.setor
   order by 3, 2, 4
$$;

grant execute on function public.apuracao_vendas_setor_mensal_periodo(uuid, date, date, integer[], text) to authenticated;
