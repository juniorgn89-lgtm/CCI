-- ============================================
-- apuracao_vendas_setor_mensal — VIEW agregada (posto × mês × setor)
-- ============================================
-- Base da "Evolução da rede" por mês e por ano (Central · Visão Geral). Ler a
-- view diária por setor por 12 meses da rede inteira é ~365 × 3 × postos
-- linhas; agrupado por mês vira 12 × 3 × postos (dezenas de linhas).
--
-- `quantidade > 0` e `setor is not null`: mesmos filtros das outras views de
-- apuração — os números batem com a Visão Geral e com o Diagnóstico.
-- `dias` = dias do mês com venda apurada naquele setor (serve pra marcar mês
-- parcial sem adivinhar).
--
-- security_invoker = on → herda a RLS de `apuracao_vendas`.
-- Rode no SQL Editor do Supabase (ou `supabase db query --linked`).

create or replace view public.apuracao_vendas_setor_mensal
with (security_invoker = on) as
select
  rede_id,
  empresa_codigo,
  to_char(data, 'YYYY-MM')          as mes,
  setor,
  sum(quantidade)                   as quantidade,
  sum(total_venda)                  as total_venda,
  sum(total_custo)                  as total_custo,
  count(distinct data)              as dias
from public.apuracao_vendas
where quantidade > 0
  and setor is not null
group by rede_id, empresa_codigo, to_char(data, 'YYYY-MM'), setor;

grant select on public.apuracao_vendas_setor_mensal to anon, authenticated;
