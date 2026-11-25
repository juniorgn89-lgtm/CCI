-- ============================================================================
-- Compras · embalagem do item do pedido (caixa, fardo, pacote…).
--
-- O ERP não diz quantas unidades vêm na caixa: quem monta o pedido informa.
-- A quantidade do item continua em UNIDADES (qtd_solicitada / qtd_liberada),
-- que é o que bate com a nota e com o estoque; estes campos só dizem como o
-- pedido vai para o fornecedor (ex.: 12 caixas de 12 = 144 un).
--
--   embalagem          'CX' | 'FD' | 'PCT' | 'DP' (null = unidade solta; 'KG'/'L' = peso/volume)
--   qtd_por_embalagem  unidades dentro de uma embalagem (null quando não se aplica)
--
-- O último valor usado por produto vira a sugestão do próximo pedido (lido no app).
-- Rodar no SQL Editor do Visor. Pode rodar de novo.
-- ============================================================================

alter table public.compras_itens add column if not exists embalagem text;
alter table public.compras_itens add column if not exists qtd_por_embalagem numeric;

do $$ begin
  alter table public.compras_itens add constraint compras_itens_qtd_por_embalagem_pos check (qtd_por_embalagem is null or qtd_por_embalagem > 0);
exception when duplicate_object then null; end $$;

create index if not exists compras_itens_embalagem_produto on public.compras_itens (rede_id, produto_codigo) where embalagem is not null;
