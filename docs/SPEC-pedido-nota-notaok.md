# Pedido de compra × Nota fiscal (Visor360 ↔ NotaOK)

> Status: **Fase 1 construída (21/11/2026), ainda não publicada nem testada.** Piloto: **Rede Trivela** (está nos dois apps).
>
> Visor: `docs/supabase-compras-notas.sql` + Edge `notaok-pedidos` + PedidoModal (notas, Recebido parcial, Encerrar recebimento).
> NotaOK: migration `20261121000001_nota_pedidos.sql` + Edge `visor-pedidos` + `_shared/visor.ts` (fila de pendentes, também empurrada pela `notas-sincronizar`) + card `components/notas/PedidoVisor.jsx`.

## Objetivo

Ligar o **pedido de compra** (Visor › Compras) às **notas fiscais** que chegam para ele (NotaOK › Recebimento), para:

1. o pedido andar sozinho no Visor: Liberado → Nota chegou → Recebido (parcial/total) → Lançado;
2. a conferência no NotaOK saber **o que deveria ter chegado** e apontar diferenças (Fase 2);
3. o dono ver **nota sem pedido** (compra fora do processo) e o **prazo real** de cada fornecedor (Fase 3).

## Decisões já tomadas

| Tema | Decisão |
|---|---|
| Quem vincula | O **recebedor**, no NotaOK, ao conferir a nota. O sistema sugere; ele confirma. O escritório só vê o resultado. |
| Entrega em partes | **Sim.** Um pedido pode receber **várias notas**. Fica "Recebido parcial" até completar ou até alguém encerrar. |
| Nota sem pedido | **Não bloqueia.** O recebedor marca "Nota sem pedido" (motivo opcional) e o dono é avisado. |
| Rede sem os dois apps | Continua como hoje: o Visor detecta a nota pelo título a pagar no ERP e o "Marcar como recebido" segue manual. |
| ERP Quality | Nada muda: o Visor continua **só lendo** o ERP. O vínculo é gravado no banco do Visor (Supabase), não no ERP. |

## Como os dois se casam

Os dois usam o Webposto, então falam a mesma língua:

| Dado | Visor (`compras_pedidos` / `compras_itens`) | NotaOK (`notas` / `nota_itens`) |
|---|---|---|
| Posto | `empresa_codigo` | `empresas.codigo_erp` |
| Fornecedor | `fornecedor_cnpj` | `cnpj_emitente` |
| Produto | `produto_codigo` | `codigo_interno` (catálogo do ERP) |
| Quando | `liberado_em` | `data_emissao` |

**Sugestão de pedidos para uma nota** (candidatos): pedidos da rede ligada com status `liberado`, `liberado_parcial` ou `recebido_parcial`, mesmo posto, mesmo CNPJ, liberados nos últimos 90 dias. Ordem: o mais próximo da data de emissão primeiro.

- Pedido feito para fornecedor **sem CNPJ** (fornecedor novo no Visor): entra na lista como "outros pedidos abertos deste posto", abaixo dos que casam pelo CNPJ.
- Nota emitida **antes** da liberação (pedido combinado por telefone) também aparece, marcada "emitida antes da liberação".
- Se houver só 1 candidato, ele já vem pré-selecionado.

## Fluxo (Fase 1)

```
NotaOK: recebedor abre a nota
  └─ card "Pedido de compra (Visor)": "Esta nota é do pedido nº 12 (liberado 21/11, R$ 22)?"
       ├─ [Sim, é deste pedido] → pergunta "Com esta nota, o pedido…"  [chegou completo] [ainda falta chegar]
       ├─ [Escolher outro pedido] → lista de candidatos (pode marcar mais de um: nota que atende 2 pedidos)
       └─ [Nota sem pedido] → motivo opcional
NotaOK envia a conferência  → Visor: nota "conferida"
Escritório lança no ERP     → Visor: nota "lançada"
Desfazer/devolver no NotaOK → Visor acompanha (devolvida / desvinculada)
```

Status do pedido no Visor:
- 1ª nota vinculada → **Recebido parcial** (se "ainda falta chegar") ou **Recebido** (se "chegou completo");
- o pedido mostra a lista de notas (nº, valor, data, situação no NotaOK);
- "Encerrar recebimento" no Visor fecha um parcial que não vai mais completar;
- Fase 2 troca a pergunta "completo / falta" pela conta automática item a item.

## Arquitetura

Bancos separados (Visor `yzmorbfadoxowchkwspl`, NotaOK `mtkavwywcpfktrzefscz`). **Uma direção só: NotaOK → Visor.** O Visor nunca chama o NotaOK; só guarda o que recebe.

### Visor

**Edge Function `notaok-pedidos`** (`--no-verify-jwt`, assinada com HMAC no mesmo padrão da `central-cci`):
- cabeçalhos `x-cci-operacao` (uuid), `x-cci-timestamp` (±300 s), `x-cci-assinatura` = HMAC-SHA256(`NOTAOK_SEGREDO`, `ts.op.body`);
- `NOTAOK_SEGREDO` fica só nos secrets das duas Edge Functions (Visor e NotaOK);
- toda ação traz `organizacao_id` do NotaOK; o Visor só responde se existe vínculo ativo em `notaok_vinculos` → `rede_id`;
- trava de repetição: tabela de operações (o mesmo padrão de `central_operacoes`).

| Ação | Entrada | Faz |
|---|---|---|
| `candidatos` | empresa_codigo, cnpj_emitente, data_emissao | Lista pedidos candidatos com itens (código, nome, unidade, qtd liberada, custo) |
| `vincular` | nota {chave, número, série, valor, emissão, notaok_nota_id}, pedido_ids[], completa, recebedor_nome | Grava os vínculos, muda o status do pedido e escreve no histórico ("Fulano recebeu a nota 123 pelo NotaOK") |
| `desvincular` | chave, pedido_id, motivo | Desfaz (recebedor errou o pedido); volta o status anterior |
| `status_nota` | chave, status (`conferida`/`lancada`/`devolvida`), quando, por_nome | Atualiza a situação da nota nos pedidos |
| `sem_pedido` | nota {...}, motivo, recebedor_nome | Registra a nota sem pedido (aviso ao dono) |

**Tabelas novas** (SQL em `docs/supabase-compras-notas.sql`, rodado no SQL Editor):
- `notaok_vinculos` (rede_id, notaok_organizacao_id, ativo, criado_em): quem está ligado;
- `compras_pedido_notas` (pedido_id, rede_id, nota_chave, número, série, valor, data_emissão, notaok_nota_id, situação `vinculada|conferida|lancada|devolvida`, vinculado_por_nome, vinculado_em, conferida_em, lancada_em); único em (pedido_id, nota_chave);
- `compras_notas_sem_pedido` (rede_id, empresa_codigo, nota_chave, fornecedor, valor, emissão, motivo, recebedor_nome, visto_por/visto_em);
- `compras_pedidos.status` ganha `recebido_parcial`; `compras_eventos.tipo` ganha `nota_vinculada`, `nota_desvinculada`, `recebimento_encerrado`.

Leitura pelo app com o RLS de sempre (`rede_id in (select redes_legiveis())`); escrita só pela Edge Function (service role).

### NotaOK

- `organizacoes.visor_rede_ligada` (liga/desliga) + chamada à Edge do Visor; ligação feita pelo operador da plataforma;
- **Edge Function `visor-pedidos`** (com JWT do usuário): confere o papel (recebedor/admin), assina e repassa ao Visor. O navegador nunca vê o segredo;
- tabela `nota_pedidos` (nota_id, pedido_id, pedido_número, completa, enviado_ao_visor, pendente, erro): guarda o vínculo também no NotaOK e permite **reenviar** se o Visor estiver fora do ar (mesmo modelo dos chamados: "pendente" + reenviar);
- ao enviar a conferência, ao lançar, ao devolver ou desfazer: dispara `status_nota` (com a mesma fila de pendentes);
- UI: card "Pedido de compra" no topo da conferência; "Nota sem pedido" com motivo; na lista, selo "Pedido nº 12".

## Fases

| Fase | Entrega |
|---|---|
| **1. Vínculo** | Tabelas + `notaok-pedidos` no Visor; `visor-pedidos` + card de vínculo no NotaOK; pedido no Visor com notas, Recebido parcial/total, "Encerrar recebimento"; histórico. Piloto Trivela. |
| **2. Conferência contra o pedido** | O NotaOK carrega os itens do pedido como "esperado" e mostra, por item, o que faltou, o que veio a mais ou sem pedido e se o **preço passou do pedido**; diferença vira **Cobrança**; parcial/total passa a ser calculado por item (saldo = liberado − soma recebida nas notas). |
| **3. Indicadores no Visor** | Aba "Notas sem pedido"; preço pedido × nota por fornecedor; **prazo real** (liberação → emissão) por fornecedor, preenchendo o "Fornecedor entrega em" da sugestão de compra. |

## Pontos de atenção

- **Unidade/embalagem:** pedido em unidade e nota em caixa (o NotaOK já tem `produto_embalagens`). Fase 2 converte; até lá a comparação item a item não é feita.
- **Nota que atende 2 pedidos:** Fase 1 permite marcar mais de um pedido; a divisão por item fica para a Fase 2.
- **Anti-enganação:** se o Visor não respondeu, o NotaOK mostra "vínculo pendente de envio", nunca "vinculado".
- **Organização × rede:** 1 organização do NotaOK ↔ 1 rede do Visor; os postos casam pelo código do ERP (Webposto). Organização com Autosystem fica de fora.
