-- ============================================
-- redes.cliente_desde — desde quando a rede é cliente da CCI
-- ============================================
-- Marco do "antes e depois da CCI" no Diagnóstico: A = meses a partir deste
-- mês; B = os mesmos N meses imediatamente anteriores. Quando vazio, o app usa
-- o mês do cadastro da rede no Visor (created_at) e diz isso na tela.
-- Editado em Admin › Redes.

alter table public.redes add column if not exists cliente_desde date;
comment on column public.redes.cliente_desde is 'Início do atendimento da CCI à rede (marco do antes e depois no Diagnóstico). Vazio = usa created_at.';
