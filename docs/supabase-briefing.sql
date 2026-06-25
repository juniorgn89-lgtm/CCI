-- ============================================================
-- Briefing Matinal — "visto hoje" por USUÁRIO em profiles
-- ============================================================
-- O modal de briefing aparece UMA vez por DIA por usuário (não por dispositivo).
-- Guardamos a data da última exibição em profiles.last_briefing_date e marcamos
-- via RPC `mark_briefing_seen` (SECURITY DEFINER) — assim o cliente NÃO precisa
-- de policy de UPDATE ampla em profiles. A função só altera a própria linha.
--
-- O modal abre quando last_briefing_date IS DISTINCT FROM current_date.
-- Rode no SQL Editor do Supabase.

alter table profiles add column if not exists last_briefing_date date;

create or replace function mark_briefing_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set last_briefing_date = current_date where user_id = auth.uid();
$$;

grant execute on function mark_briefing_seen() to authenticated;

-- Opcional: pra forçar o briefing a reaparecer hoje pra todos, rode:
--   update profiles set last_briefing_date = null;
