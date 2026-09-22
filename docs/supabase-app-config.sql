-- ============================================================================
-- app_config — configuração GLOBAL do app (singleton, 1 linha id='global').
--
-- Guarda a config da tela pública de ASSINATURA: links de pagamento do Stripe,
-- contatos do WebPosto, modo manutenção e a chave PUBLICÁVEL do Stripe (pk_).
--
-- Leitura: PÚBLICA (a landing/checkout roda deslogada e precisa ler).
-- Escrita: SOMENTE master (contato@cci.app.br e diretores com is_master).
--
-- ⚠️ NUNCA guarde a chave SECRETA do Stripe (sk_...) aqui: esta tabela é lida
--    publicamente (anon) e a secret vazaria. Só a publicável (pk_) é segura.
-- ============================================================================

create table if not exists public.app_config (
  id text primary key default 'global',
  stripe_link_base text not null default '',
  stripe_link_ia text not null default '',
  stripe_pk text not null default '',            -- chave PUBLICÁVEL (pk_...) — nunca a secreta
  webposto_telefone text not null default '',
  webposto_whatsapp text not null default '',    -- só dígitos com DDI, ex.: 5527999999999
  webposto_mensagem text not null default 'Olá! Sou cliente Visor360 e preciso da minha chave de integração (API) do WebPosto.',
  assinatura_manutencao boolean not null default false,
  assinatura_manutencao_msg text not null default 'Nossas assinaturas estão passando por uma atualização rápida. Volte em instantes ou fale com a CCI.',
  updated_at timestamptz not null default now(),
  constraint app_config_singleton check (id = 'global')
);

-- Linha única (idempotente).
insert into public.app_config (id) values ('global')
on conflict (id) do nothing;

alter table public.app_config enable row level security;

-- Leitura pública (visitante da landing).
drop policy if exists app_config_select_public on public.app_config;
create policy app_config_select_public
  on public.app_config for select
  using (true);

-- Escrita só master.
drop policy if exists app_config_write_master on public.app_config;
create policy app_config_write_master
  on public.app_config for all
  using (exists (
    select 1 from public.profiles pr
    where pr.user_id = auth.uid() and pr.is_master
  ))
  with check (exists (
    select 1 from public.profiles pr
    where pr.user_id = auth.uid() and pr.is_master
  ));
