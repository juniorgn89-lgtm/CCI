-- ============================================================================
-- Gestão · Tarefas, Rotinas e Setores (módulo "Gestão" do Visor360)
--
-- Dados PRÓPRIOS do Visor, por rede (tenant). Nada aqui toca o ERP: o Visor
-- continua só leitura sobre o WebPosto. Idempotente; rode no SQL Editor ou
-- via `supabase db query --linked -f`.
--
-- Papéis (decisão de 15/10/2026):
--   - Cria/edita rotinas, setores e tarefas: master (diretor) ou usuário com
--     `profiles.pode_gerir_tarefas = true` (gestor).
--   - Executa (inicia, marca checklist, conclui): o responsável, quem criou,
--     um gestor ou o master.
--   - Responsável = usuário com login e acesso à rede (supervisor etc.).
-- ============================================================================

-- ─── Permissão de gestor de tarefas ─────────────────────────────────────────
alter table public.profiles
  add column if not exists pode_gerir_tarefas boolean not null default false;

create or replace function public.pode_gerir_tarefas()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_master or p.pode_gerir_tarefas from public.profiles p where p.user_id = auth.uid()),
    false
  )
$$;
revoke execute on function public.pode_gerir_tarefas() from public, anon;
grant execute on function public.pode_gerir_tarefas() to authenticated;

-- ─── Usuários que enxergam uma rede (para o seletor de responsável) ─────────
-- Mesma regra das policies de leitura por rede. SECURITY DEFINER porque a RLS
-- de profiles não deixa um gestor listar colegas.
create or replace function public.usuarios_da_rede(p_rede uuid)
returns table (user_id uuid, nome text, email text, role text, is_master boolean)
language sql stable security definer set search_path = public as $$
  select p.user_id,
         coalesce(nullif(p.full_name, ''), p.email) as nome,
         p.email,
         coalesce(p.role, 'user') as role,
         coalesce(p.is_master, false) as is_master
  from public.profiles p
  where p_rede in (select public.redes_legiveis())
    and coalesce(p.ativo, true)
    and coalesce(p.approved, true)
    and (
      coalesce(p.is_master, false)
      or coalesce(p.acesso_todas_redes, false)
      or p.rede_id = p_rede
      or p_rede = any(coalesce(p.redes_permitidas, '{}'::uuid[]))
    )
  order by 2
$$;
revoke execute on function public.usuarios_da_rede(uuid) from public, anon;
grant execute on function public.usuarios_da_rede(uuid) to authenticated;

-- ─── Setores ────────────────────────────────────────────────────────────────
create table if not exists public.gestao_setores (
  id         uuid primary key default gen_random_uuid(),
  rede_id    uuid not null references public.redes(id) on delete cascade,
  nome       text not null,
  ativo      boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em  timestamptz not null default now()
);
create unique index if not exists gestao_setores_nome_key on public.gestao_setores (rede_id, lower(nome));
alter table public.gestao_setores enable row level security;
drop policy if exists gestao_setores_select on public.gestao_setores;
create policy gestao_setores_select on public.gestao_setores for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists gestao_setores_write on public.gestao_setores;
create policy gestao_setores_write on public.gestao_setores for all to authenticated
  using (rede_id in (select public.redes_legiveis()) and public.pode_gerir_tarefas())
  with check (rede_id in (select public.redes_legiveis()) and public.pode_gerir_tarefas());

-- ─── Rotinas (modelos recorrentes) ──────────────────────────────────────────
create table if not exists public.gestao_rotinas (
  id               uuid primary key default gen_random_uuid(),
  rede_id          uuid not null references public.redes(id) on delete cascade,
  nome             text not null,
  descricao        text,
  -- Postos (código da empresa no WebPosto). Vazio = uma tarefa só, sem posto.
  empresa_codigos  int[] not null default '{}',
  -- Sem responsável = NÃO gera tarefa (como no original).
  responsavel_id   uuid references auth.users(id) on delete set null,
  setor_id         uuid references public.gestao_setores(id) on delete set null,
  recorrencia      text not null default 'diaria' check (recorrencia in ('diaria', 'dias_uteis', 'personalizada')),
  -- Dias da semana da recorrência personalizada: 0 = domingo … 6 = sábado.
  dias_semana      int[] not null default '{}',
  hora_vencimento  time not null default '18:00',
  inicio_em        date not null default current_date,
  -- A que dia a tarefa se refere (ex.: conferência do dia anterior).
  referente_a      text not null default 'proprio_dia' check (referente_a in ('proprio_dia', 'dia_anterior', 'dia_util_anterior', 'mes_anterior')),
  checklist        text[] not null default '{}',
  ativa            boolean not null default true,
  criado_por       uuid references auth.users(id) on delete set null default auth.uid(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index if not exists gestao_rotinas_rede_idx on public.gestao_rotinas (rede_id);
alter table public.gestao_rotinas enable row level security;
drop policy if exists gestao_rotinas_select on public.gestao_rotinas;
create policy gestao_rotinas_select on public.gestao_rotinas for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists gestao_rotinas_write on public.gestao_rotinas;
create policy gestao_rotinas_write on public.gestao_rotinas for all to authenticated
  using (rede_id in (select public.redes_legiveis()) and public.pode_gerir_tarefas())
  with check (rede_id in (select public.redes_legiveis()) and public.pode_gerir_tarefas());

-- ─── Tarefas ────────────────────────────────────────────────────────────────
create table if not exists public.gestao_tarefas (
  id               uuid primary key default gen_random_uuid(),
  rede_id          uuid not null references public.redes(id) on delete cascade,
  rotina_id        uuid references public.gestao_rotinas(id) on delete set null,
  titulo           text not null,
  descricao        text,
  empresa_codigo   int,
  responsavel_id   uuid references auth.users(id) on delete set null,
  setor_id         uuid references public.gestao_setores(id) on delete set null,
  status           text not null default 'a_fazer' check (status in ('a_fazer', 'em_andamento', 'concluida', 'cancelada')),
  vence_em         timestamptz not null,
  -- Dia do vencimento em Brasília (preenchido pelo app/geração; base do índice único e dos filtros).
  vence_dia        date not null,
  -- Dia a que a tarefa se refere (vem da rotina: dia anterior, mês anterior…).
  data_ref         date,
  -- [{ "texto": "...", "feito": false }, ...]
  checklist        jsonb not null default '[]'::jsonb,
  concluida_em     timestamptz,
  concluida_por    uuid references auth.users(id) on delete set null,
  criado_por       uuid references auth.users(id) on delete set null default auth.uid(),
  criado_por_nome  text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index if not exists gestao_tarefas_rede_vence_idx on public.gestao_tarefas (rede_id, vence_em desc);
create index if not exists gestao_tarefas_resp_idx on public.gestao_tarefas (responsavel_id);
-- Uma tarefa por rotina × posto × dia de vencimento: a geração é idempotente.
create unique index if not exists gestao_tarefas_rotina_dia_key
  on public.gestao_tarefas (rotina_id, coalesce(empresa_codigo, 0), vence_dia)
  where rotina_id is not null;

alter table public.gestao_tarefas enable row level security;
drop policy if exists gestao_tarefas_select on public.gestao_tarefas;
create policy gestao_tarefas_select on public.gestao_tarefas for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
-- Criar tarefa avulsa: gestor ou master.
drop policy if exists gestao_tarefas_insert on public.gestao_tarefas;
create policy gestao_tarefas_insert on public.gestao_tarefas for insert to authenticated
  with check (rede_id in (select public.redes_legiveis()) and public.pode_gerir_tarefas());
-- Executar: responsável, quem criou, gestor ou master.
drop policy if exists gestao_tarefas_update on public.gestao_tarefas;
create policy gestao_tarefas_update on public.gestao_tarefas for update to authenticated
  using (
    rede_id in (select public.redes_legiveis())
    and (responsavel_id = auth.uid() or criado_por = auth.uid() or public.pode_gerir_tarefas())
  )
  with check (rede_id in (select public.redes_legiveis()));
drop policy if exists gestao_tarefas_delete on public.gestao_tarefas;
create policy gestao_tarefas_delete on public.gestao_tarefas for delete to authenticated
  using (rede_id in (select public.redes_legiveis()) and public.pode_gerir_tarefas());

-- ─── Atividade (histórico, append-only) ─────────────────────────────────────
create table if not exists public.gestao_atividades (
  id         uuid primary key default gen_random_uuid(),
  rede_id    uuid not null references public.redes(id) on delete cascade,
  tarefa_id  uuid not null references public.gestao_tarefas(id) on delete cascade,
  tipo       text not null check (tipo in ('criada', 'iniciada', 'concluida', 'reaberta', 'cancelada', 'checklist', 'gerada')),
  autor_id   uuid references auth.users(id) on delete set null default auth.uid(),
  autor_nome text,
  detalhe    text,
  criado_em  timestamptz not null default now()
);
create index if not exists gestao_atividades_rede_idx on public.gestao_atividades (rede_id, criado_em desc);
create index if not exists gestao_atividades_tarefa_idx on public.gestao_atividades (tarefa_id);
alter table public.gestao_atividades enable row level security;
drop policy if exists gestao_atividades_select on public.gestao_atividades;
create policy gestao_atividades_select on public.gestao_atividades for select to authenticated
  using (rede_id in (select public.redes_legiveis()));
drop policy if exists gestao_atividades_insert on public.gestao_atividades;
create policy gestao_atividades_insert on public.gestao_atividades for insert to authenticated
  with check (rede_id in (select public.redes_legiveis()) and autor_id = auth.uid());

-- ─── touch atualizado_em ────────────────────────────────────────────────────
create or replace function public.gestao_touch()
returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists gestao_rotinas_touch on public.gestao_rotinas;
create trigger gestao_rotinas_touch before update on public.gestao_rotinas for each row execute function public.gestao_touch();
drop trigger if exists gestao_tarefas_touch on public.gestao_tarefas;
create trigger gestao_tarefas_touch before update on public.gestao_tarefas for each row execute function public.gestao_touch();

-- ─── Dia útil anterior (sáb/dom pulam pra sexta) ────────────────────────────
create or replace function public.gestao_dia_util_anterior(p_data date)
returns date language sql immutable as $$
  select case extract(isodow from p_data)
    when 1 then p_data - 3   -- segunda → sexta
    when 7 then p_data - 2   -- domingo → sexta
    else p_data - 1
  end
$$;

-- ─── Geração das tarefas do dia a partir das rotinas ────────────────────────
-- Idempotente (índice único rotina × posto × dia). Roda pelo cron à meia-noite
-- (horário de Brasília) e também quando uma rotina é criada, pra aparecer hoje.
create or replace function public.gerar_tarefas_de_rotinas(p_data date default (now() at time zone 'America/Sao_Paulo')::date)
returns int language plpgsql security definer set search_path = public as $$
declare
  r        record;
  v_dow    int := extract(dow from p_data);  -- 0 = domingo
  v_ref    date;
  v_vence  timestamptz;
  v_emp    int;
  v_n      int := 0;
  v_ins    int;
  v_chk    jsonb;
begin
  for r in
    select * from public.gestao_rotinas
    where ativa and responsavel_id is not null and inicio_em <= p_data
  loop
    if r.recorrencia = 'dias_uteis' and v_dow in (0, 6) then continue; end if;
    if r.recorrencia = 'personalizada' and not (v_dow = any(r.dias_semana)) then continue; end if;

    v_ref := case r.referente_a
      when 'dia_anterior'      then p_data - 1
      when 'dia_util_anterior' then public.gestao_dia_util_anterior(p_data)
      when 'mes_anterior'      then (date_trunc('month', p_data) - interval '1 month')::date
      else p_data
    end;
    v_vence := (p_data::text || ' ' || r.hora_vencimento::text)::timestamp at time zone 'America/Sao_Paulo';
    v_chk := coalesce((select jsonb_agg(jsonb_build_object('texto', t, 'feito', false)) from unnest(r.checklist) t), '[]'::jsonb);

    if coalesce(array_length(r.empresa_codigos, 1), 0) = 0 then
      insert into public.gestao_tarefas (rede_id, rotina_id, titulo, descricao, empresa_codigo, responsavel_id, setor_id, vence_em, vence_dia, data_ref, checklist, criado_por, criado_por_nome)
      values (r.rede_id, r.id, r.nome, r.descricao, null, r.responsavel_id, r.setor_id, v_vence, p_data, v_ref, v_chk, r.criado_por, 'Rotina')
      on conflict do nothing;
      get diagnostics v_ins = row_count; v_n := v_n + v_ins;
    else
      foreach v_emp in array r.empresa_codigos loop
        insert into public.gestao_tarefas (rede_id, rotina_id, titulo, descricao, empresa_codigo, responsavel_id, setor_id, vence_em, vence_dia, data_ref, checklist, criado_por, criado_por_nome)
        values (r.rede_id, r.id, r.nome, r.descricao, v_emp, r.responsavel_id, r.setor_id, v_vence, p_data, v_ref, v_chk, r.criado_por, 'Rotina')
        on conflict do nothing;
        get diagnostics v_ins = row_count; v_n := v_n + v_ins;
      end loop;
    end if;
  end loop;
  return v_n;
end $$;
revoke execute on function public.gerar_tarefas_de_rotinas(date) from public, anon;
grant execute on function public.gerar_tarefas_de_rotinas(date) to authenticated;

-- Cron: 00:05 de Brasília (03:05 UTC), todo dia.
create extension if not exists pg_cron;
select cron.unschedule('gestao-gerar-tarefas') where exists (select 1 from cron.job where jobname = 'gestao-gerar-tarefas');
select cron.schedule('gestao-gerar-tarefas', '5 3 * * *', $$ select public.gerar_tarefas_de_rotinas() $$);

notify pgrst, 'reload schema';
