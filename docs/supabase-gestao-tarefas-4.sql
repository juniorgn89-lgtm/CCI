-- ============================================================================
-- Gestão · Tarefas — rodada 4 (13/11/2026):
--   1. Recorrências novas na personalizada: dias do mês, datas no ano, escala.
--   2. Prioridade (baixa, média, alta, urgente) na rotina e na tarefa.
--   3. Exigir foto ou documento para concluir, com documentos nomeados.
-- Aditivo e idempotente; as rotinas que já existem continuam iguais
-- (personalizada antiga = "dias da semana"). Rode com
-- `supabase db query --linked -f docs/supabase-gestao-tarefas-4.sql`.
-- ============================================================================

-- ─── Rotinas ────────────────────────────────────────────────────────────────
alter table public.gestao_rotinas
  add column if not exists modo_personalizado text not null default 'semana',
  -- Dias do mês (1–31); 0 = último dia do mês. Mês sem o dia (ex.: 31 em abril) é pulado.
  add column if not exists dias_mes int[] not null default '{}',
  -- Datas no ano, 'MM-DD' (ex.: '12-31').
  add column if not exists datas_ano text[] not null default '{}',
  -- Escala: trabalha N dias, folga M, contando a partir de inicio_em (dia 1 = trabalho).
  add column if not exists escala_trabalha int,
  add column if not exists escala_folga int,
  add column if not exists prioridade text not null default 'media',
  add column if not exists exige_anexo boolean not null default false,
  -- Nome de cada anexo obrigatório; vazio + exige_anexo = basta uma foto ou documento.
  add column if not exists documentos_exigidos text[] not null default '{}';

alter table public.gestao_rotinas drop constraint if exists gestao_rotinas_modo_personalizado_check;
alter table public.gestao_rotinas add constraint gestao_rotinas_modo_personalizado_check
  check (modo_personalizado in ('semana', 'mes', 'ano', 'escala'));
alter table public.gestao_rotinas drop constraint if exists gestao_rotinas_prioridade_check;
alter table public.gestao_rotinas add constraint gestao_rotinas_prioridade_check
  check (prioridade in ('baixa', 'media', 'alta', 'urgente'));
alter table public.gestao_rotinas drop constraint if exists gestao_rotinas_escala_check;
alter table public.gestao_rotinas add constraint gestao_rotinas_escala_check
  check (modo_personalizado <> 'escala' or (coalesce(escala_trabalha, 0) > 0 and coalesce(escala_folga, -1) >= 0));

-- ─── Tarefas ────────────────────────────────────────────────────────────────
alter table public.gestao_tarefas
  add column if not exists prioridade text not null default 'media',
  add column if not exists exige_anexo boolean not null default false,
  add column if not exists documentos_exigidos text[] not null default '{}';
alter table public.gestao_tarefas drop constraint if exists gestao_tarefas_prioridade_check;
alter table public.gestao_tarefas add constraint gestao_tarefas_prioridade_check
  check (prioridade in ('baixa', 'media', 'alta', 'urgente'));

-- Que documento exigido o arquivo cumpre (null = anexo livre).
alter table public.gestao_anexos add column if not exists documento text;

-- ─── Trava: concluir sem o anexo exigido não passa (nem pela API) ──────────
create or replace function public.gestao_tarefa_confere_anexos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_faltam text[];
begin
  if new.status <> 'concluida' or old.status = 'concluida' then return new; end if;
  if coalesce(array_length(new.documentos_exigidos, 1), 0) > 0 then
    select array_agg(d) into v_faltam
    from unnest(new.documentos_exigidos) d
    where not exists (select 1 from public.gestao_anexos a where a.tarefa_id = new.id and a.documento = d);
    if coalesce(array_length(v_faltam, 1), 0) > 0 then
      raise exception 'Para concluir, anexe: %', array_to_string(v_faltam, ', ') using errcode = 'P0001';
    end if;
  elsif new.exige_anexo and not exists (select 1 from public.gestao_anexos a where a.tarefa_id = new.id) then
    raise exception 'Para concluir, anexe uma foto ou documento.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists gestao_tarefas_confere_anexos on public.gestao_tarefas;
create trigger gestao_tarefas_confere_anexos
  before update of status on public.gestao_tarefas
  for each row execute function public.gestao_tarefa_confere_anexos();

-- ─── Geração: modos novos + prioridade e anexos copiados para a tarefa ─────
create or replace function public.gerar_tarefas_de_rotinas(p_data date default (now() at time zone 'America/Sao_Paulo')::date)
returns int language plpgsql security definer set search_path = public as $$
declare
  r        record;
  v_dow    int := extract(dow from p_data);  -- 0 = domingo
  v_dia    int := extract(day from p_data);
  v_ultimo int := extract(day from (date_trunc('month', p_data) + interval '1 month - 1 day'));
  v_mmdd   text := to_char(p_data, 'MM-DD');
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
    if r.recorrencia = 'personalizada' then
      if r.modo_personalizado = 'semana' and not (v_dow = any(r.dias_semana)) then continue; end if;
      if r.modo_personalizado = 'mes' and not (v_dia = any(r.dias_mes) or (0 = any(r.dias_mes) and v_dia = v_ultimo)) then continue; end if;
      if r.modo_personalizado = 'ano' and not (v_mmdd = any(r.datas_ano)) then continue; end if;
      if r.modo_personalizado = 'escala' and (
        coalesce(r.escala_trabalha, 0) <= 0
        or ((p_data - r.inicio_em) % (r.escala_trabalha + coalesce(r.escala_folga, 0))) >= r.escala_trabalha
      ) then continue; end if;
    end if;

    v_ref := case r.referente_a
      when 'dia_anterior'      then p_data - 1
      when 'dia_util_anterior' then public.gestao_dia_util_anterior(p_data)
      when 'mes_anterior'      then (date_trunc('month', p_data) - interval '1 month')::date
      else p_data
    end;
    v_vence := (p_data::text || ' ' || r.hora_vencimento::text)::timestamp at time zone 'America/Sao_Paulo';
    v_chk := coalesce((select jsonb_agg(jsonb_build_object('texto', t, 'feito', false)) from unnest(r.checklist) t), '[]'::jsonb);

    if coalesce(array_length(r.empresa_codigos, 1), 0) = 0 then
      insert into public.gestao_tarefas (rede_id, rotina_id, titulo, descricao, empresa_codigo, responsavel_id, setor_id, vence_em, vence_dia, data_ref, checklist, criado_por, criado_por_nome, prioridade, exige_anexo, documentos_exigidos)
      values (r.rede_id, r.id, r.nome, r.descricao, null, r.responsavel_id, r.setor_id, v_vence, p_data, v_ref, v_chk, r.criado_por, 'Rotina', r.prioridade, r.exige_anexo, r.documentos_exigidos)
      on conflict do nothing;
      get diagnostics v_ins = row_count; v_n := v_n + v_ins;
    else
      foreach v_emp in array r.empresa_codigos loop
        insert into public.gestao_tarefas (rede_id, rotina_id, titulo, descricao, empresa_codigo, responsavel_id, setor_id, vence_em, vence_dia, data_ref, checklist, criado_por, criado_por_nome, prioridade, exige_anexo, documentos_exigidos)
        values (r.rede_id, r.id, r.nome, r.descricao, v_emp, r.responsavel_id, r.setor_id, v_vence, p_data, v_ref, v_chk, r.criado_por, 'Rotina', r.prioridade, r.exige_anexo, r.documentos_exigidos)
        on conflict do nothing;
        get diagnostics v_ins = row_count; v_n := v_n + v_ins;
      end loop;
    end if;
  end loop;
  return v_n;
end $$;
revoke execute on function public.gerar_tarefas_de_rotinas(date) from public, anon;
grant execute on function public.gerar_tarefas_de_rotinas(date) to authenticated;

notify pgrst, 'reload schema';
