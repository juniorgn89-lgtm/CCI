-- ============================================================================
-- Contrato WebPosto · fechamentos mensais (foto do repasse de cada mês)
-- Painel → Contrato WebPosto → "Fechar mês". Só master. Idempotente.
-- ============================================================================
create table if not exists public.contrato_webposto_fechamentos (
  id           uuid primary key default gen_random_uuid(),
  competencia  date not null unique,              -- primeiro dia do mês
  redes        int not null,
  postos       int not null,
  valor_posto  numeric(12,2) not null,
  aliquota_pct numeric(6,3) not null default 0,
  liquido      numeric(14,2) not null,
  faturado     numeric(14,2) not null,
  detalhes     jsonb not null default '[]'::jsonb, -- [{rede, postos, liquido}]
  observacao   text,
  criado_por   uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em    timestamptz not null default now()
);
alter table public.contrato_webposto_fechamentos enable row level security;
drop policy if exists contrato_fech_master on public.contrato_webposto_fechamentos;
create policy contrato_fech_master on public.contrato_webposto_fechamentos for all to authenticated
  using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_master))
  with check (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_master));
notify pgrst, 'reload schema';
