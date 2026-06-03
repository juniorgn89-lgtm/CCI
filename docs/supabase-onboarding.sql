-- ============================================================
-- Onboarding (tour de boas-vindas) — flag por USUÁRIO em profiles
-- ============================================================
-- O modal de boas-vindas deve aparecer UMA vez por usuário criado (não por
-- dispositivo/navegador). Guardamos isso em profiles.onboarding_seen e marcamos
-- via RPC `mark_onboarding_seen` (SECURITY DEFINER) — assim o cliente NÃO
-- precisa de policy de UPDATE ampla em profiles (que permitiria mexer em
-- is_master/rede_id etc.). A função só altera a própria linha.
--
-- Rode no SQL Editor do Supabase.

alter table profiles add column if not exists onboarding_seen boolean not null default false;

create or replace function mark_onboarding_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set onboarding_seen = true where user_id = auth.uid();
$$;

grant execute on function mark_onboarding_seen() to authenticated;

-- Opcional: pra REEXIBIR o tour pra todos (ex.: anunciar novidades), rode:
--   update profiles set onboarding_seen = false;
