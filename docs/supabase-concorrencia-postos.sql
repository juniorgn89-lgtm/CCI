-- ============================================================================
-- Concorrência por posto: liga/desliga o uso dos VIZINHOS como referência.
--
-- Antes era um flag global no localStorage (cada navegador via uma coisa).
-- Agora a decisão é do dono, POR POSTO, e fica salva pra rede toda ver igual.
-- Sem linha = desligado (o Radar usa a média da própria rede).
-- ============================================================================

create table if not exists public.concorrencia_posto_config (
  rede_id uuid not null references public.redes(id) on delete cascade,
  empresa_codigo integer not null,
  usar boolean not null default false,
  updated_by uuid default auth.uid(),
  updated_by_nome text,
  updated_at timestamptz not null default now(),
  primary key (rede_id, empresa_codigo)
);

alter table public.concorrencia_posto_config enable row level security;

-- READ: qualquer membro da rede (mesma regra de concorrencia_precos).
drop policy if exists "concorrencia posto read" on public.concorrencia_posto_config;
create policy "concorrencia posto read"
on public.concorrencia_posto_config for select to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

-- Escrita: master, ou quem pode cadastrar concorrência na própria rede e
-- dentro do escopo de postos (profiles.empresa_codigos).
drop policy if exists "concorrencia posto insert" on public.concorrencia_posto_config;
create policy "concorrencia posto insert"
on public.concorrencia_posto_config for insert to authenticated
with check (
  public.is_current_user_master()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.rede_id = concorrencia_posto_config.rede_id
      and (p.is_master or p.pode_cadastrar_concorrencia)
      and (
        p.empresa_codigos is null
        or array_length(p.empresa_codigos, 1) is null
        or concorrencia_posto_config.empresa_codigo = any (p.empresa_codigos)
      )
  )
);

drop policy if exists "concorrencia posto update" on public.concorrencia_posto_config;
create policy "concorrencia posto update"
on public.concorrencia_posto_config for update to authenticated
using (
  public.is_current_user_master()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.rede_id = concorrencia_posto_config.rede_id
      and (p.is_master or p.pode_cadastrar_concorrencia)
      and (
        p.empresa_codigos is null
        or array_length(p.empresa_codigos, 1) is null
        or concorrencia_posto_config.empresa_codigo = any (p.empresa_codigos)
      )
  )
);

-- Quem mudou e quando: sempre carimbado no servidor.
create or replace function public.concorrencia_posto_config_stamp()
returns trigger language plpgsql as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_concorrencia_posto_config_stamp on public.concorrencia_posto_config;
create trigger trg_concorrencia_posto_config_stamp
  before insert or update on public.concorrencia_posto_config
  for each row execute function public.concorrencia_posto_config_stamp();
