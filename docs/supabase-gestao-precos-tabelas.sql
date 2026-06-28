-- ============================================================================
-- GESTÃO DE PREÇOS — Fase 2.0: ingestão da "Tabela de Preço de Prazos" (WebPosto)
-- ============================================================================
-- A "Tabela de Preço de Prazos" (BARATAO, TABACARIA, …) NÃO existe em GET na API
-- Quality — só dá pra ter dentro do Visor por ingestão (Exportar XLSX do WebPosto
-- → Supabase). Schema fiel à tela: mestre + linhas de Preço Especial.
--
-- Uso: alimenta a aba "Tabelas cadastradas" (espelho read-only) e a ATRIBUIÇÃO
-- nomeada no Impacto no LB (abastecimento cujo preço bate uma tabela cadastrada
-- vira "sancionado · {tabela}" em vez de "ajuste de bomba").
--
-- Read = membros da rede; escrita = master (igual concorrência). Idempotente.
-- ============================================================================

-- ── Mestre (cada "Ref" da Tabela de Preço de Prazos) ──
create table if not exists public.gestao_precos_tabelas (
  id                uuid primary key default gen_random_uuid(),
  rede_id           uuid not null references public.redes(id) on delete cascade,
  ref               text not null,                 -- '00003'
  descricao         text not null,                 -- 'BARATAO'
  validade_inicial  date,
  validade_final    date,                          -- null = aberta (vigente)
  -- Dias da semana em que vale (0=domingo … 6=sábado). NULL/vazio = todos os dias.
  dias_semana       int[],
  hora_dia          boolean not null default false,
  created_by_nome   text,
  created_at        timestamptz not null default now(),
  unique (rede_id, ref)
);

-- ── Linhas (Dados de Preço Especial) ──
create table if not exists public.gestao_precos_tabela_itens (
  id                     uuid primary key default gen_random_uuid(),
  tabela_id              uuid not null references public.gestao_precos_tabelas(id) on delete cascade,
  -- Filial = posto a que a linha se aplica (empresa_codigo). NULL = todas da rede.
  filial_empresa_codigo  int,
  cliente                text,
  grupo_cliente          text,
  produto_nome           text not null,            -- 'GASOLINA COMUM.'
  -- produtoCodigo resolvido (nullable; a atribuição também casa por slug de combustível).
  produto_codigo         int,
  grupo                  text,
  subgrupo               text,
  -- 'especifico' (Valor em R$) | 'desconto' (Valor em %).
  tipo                   text not null default 'especifico'
                           check (tipo in ('especifico','desconto')),
  valor                  numeric(10,3) not null,
  created_at             timestamptz not null default now()
);

create index if not exists idx_gp_tabela_itens_tabela on public.gestao_precos_tabela_itens (tabela_id);
create index if not exists idx_gp_tabela_itens_filial on public.gestao_precos_tabela_itens (filial_empresa_codigo);

-- ── RLS ──
alter table public.gestao_precos_tabelas        enable row level security;
alter table public.gestao_precos_tabela_itens   enable row level security;

drop policy if exists "gp_tabelas read" on public.gestao_precos_tabelas;
create policy "gp_tabelas read" on public.gestao_precos_tabelas for select to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles  where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

drop policy if exists "gp_tabelas write master" on public.gestao_precos_tabelas;
create policy "gp_tabelas write master" on public.gestao_precos_tabelas for all to authenticated
using ( public.is_current_user_master() ) with check ( public.is_current_user_master() );

-- itens herdam o acesso da tabela-mãe.
drop policy if exists "gp_itens read" on public.gestao_precos_tabela_itens;
create policy "gp_itens read" on public.gestao_precos_tabela_itens for select to authenticated
using (
  exists (select 1 from public.gestao_precos_tabelas t
          where t.id = tabela_id and (
            public.is_current_user_master()
            or t.rede_id in (
              select rede_id from public.profiles  where user_id = auth.uid()
              union
              select rede_id from public.frentistas where user_id = auth.uid()
            )))
);

drop policy if exists "gp_itens write master" on public.gestao_precos_tabela_itens;
create policy "gp_itens write master" on public.gestao_precos_tabela_itens for all to authenticated
using ( public.is_current_user_master() ) with check ( public.is_current_user_master() );

-- ============================================================================
-- SEED — BARATAO (Ref 00003) do POSTO DARWIN. Preencha os 2 placeholders:
--   <REDE_ID>          = id da sua rede (uuid)
--   <EMPRESA_DARWIN>   = empresa_codigo do POSTO DARWIN (int)
-- Rode o bloco abaixo depois de criar as tabelas.
-- ============================================================================
-- with t as (
--   insert into public.gestao_precos_tabelas (rede_id, ref, descricao, validade_inicial, validade_final, dias_semana, hora_dia)
--   values ('<REDE_ID>', '00003', 'BARATAO', '2024-10-18', null, null, false)
--   on conflict (rede_id, ref) do update set descricao = excluded.descricao
--   returning id
-- )
-- insert into public.gestao_precos_tabela_itens (tabela_id, filial_empresa_codigo, produto_nome, grupo, tipo, valor)
-- select t.id, <EMPRESA_DARWIN>, p.nome, p.grupo, 'especifico', p.valor from t, (values
--   ('LUB BARDAHL MAXOIL SINTECONOMY SL 10W40 1LT', null, 40.000),
--   ('LUB BARDAHL MAX TEC PERFEORMANCE 15W 40 1LT', null, 40.000),
--   ('LUB LUBRAX TOP AUTO 10W40 LT',                null, 40.000),
--   ('LUB BARDAHL MAXTEC FUEL ECONOMY SINT.SP 5W 30 1L', null, 50.000),
--   ('FLUIDO P/ RADIADOR RADNAQ ROSA 500ML',        null, 19.900),
--   ('LUB LUBRAX TECNO 10W40 LT',                   null, 40.000),
--   ('LUB LUBRAX TOP AUTO SQ/SP 5W30 1LT',          null, 50.000),
--   ('',                                            'PS - PALHETA', 59.900),
--   ('LUB LUBRAX TECNO 15W40 SN 1LT',               null, 40.000),
--   ('FLUIDO P/ RADIADOR RADNAQ VERDE 500ML',       null, 19.900),
--   ('LUB LUBRAX TOP AUTO 15W40 LT',                null, 40.000),
--   ('GASOLINA COMUM.',                             null, 6.250),
--   ('ETANOL ADITIVADO GRID',                       null, 4.500)
-- ) as p(nome, grupo, valor);
