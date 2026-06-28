-- ============================================================================
-- GESTÃO DE PREÇOS — Por cliente (preço especial por cliente do WebPosto)
-- ============================================================================
-- Espelho da aba "Tabela de Preço" do Cadastro de Clientes (preço especial por
-- cliente × produto × prazo). NÃO existe em GET na API → ingestão (export/seed).
--
-- "Preço calculado" é a REFERÊNCIA de contrato do cliente (base ± ajuste). A
-- "regra" diz quando ela vale (sempre, ou só se o preço de bomba for maior/menor
-- que a tabela). A atribuição "Por cliente" compara o praticado por cliente com
-- esse preço calculado (o join venda→cliente vem depois, via cron).
--
-- Read = membros da rede; escrita = master. Idempotente.
-- ============================================================================

create table if not exists public.gestao_precos_cliente (
  id               uuid primary key default gen_random_uuid(),
  rede_id          uuid not null references public.redes(id) on delete cascade,
  cliente_nome     text not null,
  cliente_codigo   int,                       -- resolvido via /CLIENTE (opcional)
  filial_nome      text,                      -- NULL = todas as filiais
  produto_nome     text not null,
  produto_codigo   int,
  prazo            text,                      -- 'SEMAN'; NULL/'' = todos os prazos conveniados
  preco_base       numeric(10,3),
  preco_custo      numeric(10,3),
  -- 'especifico' (valor = preço final) | 'ajuste' (valor +/- sobre o preço base)
  tipo             text not null default 'ajuste'
                     check (tipo in ('especifico','ajuste')),
  valor            numeric(10,3) not null,    -- ex.: -0.050
  preco_calculado  numeric(10,3),             -- ex.: 6.730 (referência de contrato)
  tipo_transacao   text,                      -- 'Todos'
  -- Quando a tabela do cliente vale: sempre, ou condicional ao preço de bomba.
  regra            text not null default 'sempre'
                     check (regra in ('sempre','so_bomba_maior','so_bomba_menor')),
  created_at       timestamptz not null default now()
);

create index if not exists idx_gp_cliente_rede on public.gestao_precos_cliente (rede_id);

alter table public.gestao_precos_cliente enable row level security;

drop policy if exists "gp_cliente read" on public.gestao_precos_cliente;
create policy "gp_cliente read" on public.gestao_precos_cliente for select to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles  where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

drop policy if exists "gp_cliente write master" on public.gestao_precos_cliente;
create policy "gp_cliente write master" on public.gestao_precos_cliente for all to authenticated
using ( public.is_current_user_master() ) with check ( public.is_current_user_master() );

-- ── Seed: SOORETAMA · DIESEL S-10 (do anexo) ──
insert into public.gestao_precos_cliente
  (rede_id, cliente_nome, produto_nome, prazo, preco_base, preco_custo, tipo, valor, preco_calculado, tipo_transacao, regra)
values
  ('ecda105d-e741-41f0-9dbe-c8a9ce5f01ee', 'SOORETAMA', 'DIESEL S-10', 'SEMAN', 6.780, 6.299, 'ajuste', -0.050, 6.730, 'Todos', 'sempre');
