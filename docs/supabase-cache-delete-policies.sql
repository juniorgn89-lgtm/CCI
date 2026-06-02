-- ============================================
-- Policies de DELETE nas tabelas de cache de apuração
-- ============================================
-- As tabelas de cache tinham só SELECT/INSERT/UPDATE — sem DELETE. Com RLS
-- habilitado e sem policy de DELETE, o Postgres NEGA todo delete (apaga 0 linhas
-- e NÃO retorna erro). Resultado: ao re-apurar, vendas que sumiram (ex.: venda
-- cancelada depois) viravam ÓRFÃS no cache — o upsert nunca as removia e a
-- Central continuava somando (bug: "re-apurei e o valor não muda").
--
-- Estas policies liberam o DELETE pra própria rede (e master), igual ao padrão
-- das outras operações. Com elas, `deleteVendasCachePeriodo` (apaga o período
-- antes de regravar) funciona de verdade e o cache não acumula linhas-zero.
--
-- Rode no SQL Editor do Supabase. Idempotente (drop if exists + create).

-- ── apuracao_vendas (estilo profiles + is_master) ──
drop policy if exists "vendas_delete_own_rede" on apuracao_vendas;
create policy "vendas_delete_own_rede" on apuracao_vendas
  for delete using (
    rede_id in (select rede_id from profiles where user_id = auth.uid())
    or (select is_master from profiles where user_id = auth.uid())
  );

-- ── apuracao_diaria (estilo is_current_user_master + union frentistas) ──
drop policy if exists "apuracao_diaria delete" on public.apuracao_diaria;
create policy "apuracao_diaria delete"
on public.apuracao_diaria for delete
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

-- ── apuracao_abastecimentos ──
drop policy if exists "apuracao_abast delete" on public.apuracao_abastecimentos;
create policy "apuracao_abast delete"
on public.apuracao_abastecimentos for delete
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

-- ── apuracao_caixas ──
drop policy if exists "apuracao_caixas delete" on public.apuracao_caixas;
create policy "apuracao_caixas delete"
on public.apuracao_caixas for delete
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

-- ── apuracao_formas_pagamento ──
drop policy if exists "apuracao_formas delete" on public.apuracao_formas_pagamento;
create policy "apuracao_formas delete"
on public.apuracao_formas_pagamento for delete
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);

-- ── apuracao_fuel_diaria ──
drop policy if exists "apuracao_fuel_diaria delete" on public.apuracao_fuel_diaria;
create policy "apuracao_fuel_diaria delete"
on public.apuracao_fuel_diaria for delete
to authenticated
using (
  public.is_current_user_master()
  or rede_id in (
    select rede_id from public.profiles where user_id = auth.uid()
    union
    select rede_id from public.frentistas where user_id = auth.uid()
  )
);
