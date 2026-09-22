-- ============================================================================
-- landing_leads — leads captados pelo chat da landing (público).
--
-- Insert: PÚBLICO (visitante deslogado envia o lead).
-- Leitura/gestão: SOMENTE master (Painel → Leads).
--
-- Também adiciona `comercial_whatsapp` em app_config (usado pelo botão "Falar no
-- WhatsApp" no fim do chat). Rode docs/supabase-app-config.sql antes deste.
-- ============================================================================

create table if not exists public.landing_leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  rede text not null default '',
  cidade text not null default '',
  sistema text not null default '',        -- WebPosto / AutoSystem / Outro / Não sei
  whatsapp text not null default '',
  email text not null default '',
  origem text not null default 'landing-chat',
  atendido boolean not null default false, -- o comercial já falou com o lead?
  created_at timestamptz not null default now()
);

create index if not exists landing_leads_created_at_idx on public.landing_leads (created_at desc);

alter table public.landing_leads enable row level security;

-- Insert público (o chat roda deslogado). `nome` não pode ser vazio.
drop policy if exists landing_leads_insert_public on public.landing_leads;
create policy landing_leads_insert_public
  on public.landing_leads for insert
  with check (char_length(trim(nome)) > 0);

-- Leitura/edição só master (Painel → Leads).
drop policy if exists landing_leads_read_master on public.landing_leads;
create policy landing_leads_read_master
  on public.landing_leads for select
  using (exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_master));

drop policy if exists landing_leads_update_master on public.landing_leads;
create policy landing_leads_update_master
  on public.landing_leads for update
  using (exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_master))
  with check (exists (select 1 from public.profiles pr where pr.user_id = auth.uid() and pr.is_master));

-- WhatsApp do comercial (aviso/contato do lead) — vive no app_config global.
alter table public.app_config add column if not exists comercial_whatsapp text not null default '';
