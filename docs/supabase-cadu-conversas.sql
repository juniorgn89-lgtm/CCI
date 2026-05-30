-- ════════════════════════════════════════════════════════════════════════
-- Cadu (Assistente IA) — persistência de conversas
-- ════════════════════════════════════════════════════════════════════════
-- Guarda cada conversa do Cadu (1 linha por conversa) pra que o usuário possa
-- reabrir e continuar de onde parou. As mensagens ficam num blob jsonb
-- (UiChatMessage[]) — conversas são pequenas, não compensa normalizar.
--
-- Escopo: cada usuário só enxerga/edita as PRÓPRIAS conversas (RLS por
-- auth.uid()). rede_id é guardado pra filtrar por rede no histórico.
--
-- Aplicar no SQL editor do Supabase do projeto.

create table if not exists public.cadu_conversas (
  id          uuid primary key default gen_random_uuid(),
  rede_id     text not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  titulo      text not null default 'Conversa',
  mensagens   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Lista do histórico: por rede + usuário, mais recentes primeiro.
create index if not exists cadu_conversas_rede_user_idx
  on public.cadu_conversas (rede_id, user_id, updated_at desc);

alter table public.cadu_conversas enable row level security;

-- Cada usuário só acessa as próprias conversas.
drop policy if exists "cadu_conversas_select_own" on public.cadu_conversas;
create policy "cadu_conversas_select_own" on public.cadu_conversas
  for select using (auth.uid() = user_id);

drop policy if exists "cadu_conversas_insert_own" on public.cadu_conversas;
create policy "cadu_conversas_insert_own" on public.cadu_conversas
  for insert with check (auth.uid() = user_id);

drop policy if exists "cadu_conversas_update_own" on public.cadu_conversas;
create policy "cadu_conversas_update_own" on public.cadu_conversas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cadu_conversas_delete_own" on public.cadu_conversas;
create policy "cadu_conversas_delete_own" on public.cadu_conversas
  for delete using (auth.uid() = user_id);
