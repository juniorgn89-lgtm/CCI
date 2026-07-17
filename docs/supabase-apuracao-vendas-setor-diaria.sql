-- ============================================
-- apuracao_vendas_setor_diaria — VIEW agregada (posto × dia × setor)
-- ============================================
-- Corta o read pesado da Central. A projeção sazonal precisa só da série
-- DIÁRIA POR SETOR (faturamento/qtd/lucro) de 6 meses — não do detalhe por
-- produto. Ler `apuracao_vendas` cru (1 linha por produto/dia) forçava ~675k
-- linhas → centenas de páginas de 1000 → 15s de "Atualizando".
--
-- Esta view agrupa no SERVIDOR por (rede, empresa, dia, setor): ~1 linha por
-- posto/dia/setor (≈ 2.700 p/ 6 meses de 5 postos) → 1–3 requisições.
--
-- `quantidade > 0`: espelha o filtro que o front já aplica (descarta ajustes/
-- estornos de qtd zero/negativa) ANTES de somar — mantém o número idêntico.
--
-- security_invoker = on → a view herda a RLS de `apuracao_vendas` (cada rede vê
-- só o que já podia ver; sem brechas de tenant). Requer Postgres 15+ (Supabase).
--
-- Rode no SQL Editor do Supabase.

create or replace view public.apuracao_vendas_setor_diaria
with (security_invoker = on) as
select
  rede_id,
  empresa_codigo,
  data,
  setor,
  sum(quantidade)  as quantidade,
  sum(total_venda) as total_venda,
  sum(total_custo) as total_custo
from public.apuracao_vendas
where quantidade > 0
  and setor is not null
group by rede_id, empresa_codigo, data, setor;

grant select on public.apuracao_vendas_setor_diaria to anon, authenticated;

-- Índice de apoio ao GROUP BY por faixa de data (se ainda não existir do
-- schema base de apuracao_vendas). idx_apuracao_vendas_rede_data já cobre
-- (rede_id, data, empresa_codigo); este acrescenta o setor pra um scan mais
-- justo. Opcional — a view funciona sem ele.
create index if not exists idx_apuracao_vendas_setor_diaria
  on public.apuracao_vendas (rede_id, data, setor)
  where quantidade > 0;
