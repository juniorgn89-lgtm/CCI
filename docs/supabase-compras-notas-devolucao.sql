-- Compras × NotaOK: motivo da devolução da nota (escritório → recebimento).
-- Rodar no SQL Editor do Visor DEPOIS de docs/supabase-compras-notas.sql. Pode rodar de novo.
--
-- O NotaOK já avisava "nota devolvida"; agora manda também o porquê
-- (observação geral, NF, boletos e itens apontados) e quem devolveu.

alter table public.compras_pedido_notas add column if not exists devolucao          jsonb;
alter table public.compras_pedido_notas add column if not exists devolvida_em       timestamptz;
alter table public.compras_pedido_notas add column if not exists devolvida_por_nome text;

-- Histórico do pedido ganha "devolveu a nota para correção".
alter table public.compras_eventos drop constraint if exists compras_eventos_tipo_check;
alter table public.compras_eventos add constraint compras_eventos_tipo_check
  check (tipo in ('criado', 'editado', 'enviado', 'liberado', 'liberado_parcial', 'recusado', 'recebido', 'cancelado', 'reaberto', 'comentario',
                  'nota_vinculada', 'nota_desvinculada', 'recebimento_encerrado', 'nota_devolvida'));
