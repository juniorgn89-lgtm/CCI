import type { GuiaModal } from '@/components/guia/tipos'

/**
 * Textos do guia (personagem + balão) de cada modal. Um lugar só para revisar
 * a linguagem: curto, de dono de posto, dizendo o que o modal mostra e o que dá
 * para fazer nele. O `id` guarda no navegador o "não mostrar mais" — não mude o
 * id de um guia que já existe, senão ele volta a aparecer para todo mundo.
 */
const g = (id: string, titulo: string, texto: string[]): GuiaModal => ({ id, titulo, texto })

export const GUIAS = {
  // ── Central ──────────────────────────────────────────────────────────────
  tanquesPosto: g('tanques-posto', 'Os tanques do posto', [
    'Aqui você vê cada tanque do posto: quanto tem agora, quanto cabe, quanto consome por dia e quantos dias dura.',
    'No topo, o pedido sugerido soma os tanques de cada combustível e diz quanto pedir até o fim do mês.',
    'Os litros partem da última medição do LMC. Se ela for antiga, a tela avisa: confira a régua antes de pedir.',
  ]),
  postoResumo: g('posto-resumo', 'O resumo do posto', [
    'É o posto aberto por setor: combustível, pista e conveniência, com faturamento, lucro bruto e margem.',
    'Embaixo, os produtos que mais deram lucro no período.',
    'Os números são do mesmo período do filtro do topo.',
  ]),
  setorPostos: g('setor-postos', 'O setor posto a posto', [
    'Aqui o setor que você clicou aparece aberto por posto, do que mais deu lucro para o que menos deu.',
    'Compare a margem e a fatia de cada posto para ver quem puxa o resultado e quem fica para trás.',
  ]),
  contasLista: g('contas-lista', 'Os títulos desta faixa', [
    'Estes são os títulos da faixa que você clicou (vencidos, hoje, próximos dias).',
    'Em "Por nome" você vê quem concentra o valor; em "Título a título", cada um, com busca.',
    'Clique num nome para filtrar só os títulos dele.',
  ]),
  tituloDetalhe: g('titulo-detalhe', 'Um título em detalhe', [
    'Aqui está tudo de uma conta: quanto falta, quando vence e de onde veio (posto, documento, plano de contas).',
    'Se já houve pagamento parcial ou desconto, a barra mostra quanto já foi e quanto falta.',
    'É só leitura: a baixa é feita no ERP.',
  ]),
  saldoJanela: g('saldo-janela', 'O que entra e o que sai', [
    'Para o prazo que você escolheu, veja quanto deve entrar e quanto deve sair, separado por categoria.',
    'O saldo é a diferença entre os dois. Use para planejar o caixa dos próximos dias.',
  ]),

  // ── Comercial / vendas ───────────────────────────────────────────────────
  fuelDetalhe: g('fuel-detalhe', 'O combustível em detalhe', [
    'Aqui está um combustível aberto: litros, faturamento, lucro bruto, margem, preço médio e custo médio no período.',
    'Preço médio é a média do que foi vendido, e não o preço de bomba de hoje.',
  ]),
  categoriaDetalhe: g('categoria-detalhe', 'A categoria em detalhe', [
    'É a categoria aberta, com faturamento, lucro, margem, preço médio e custo médio por unidade.',
    'Embaixo, os produtos dela: veja quem vende mais e quem dá mais margem.',
  ]),
  detalheDia: g('detalhe-dia', 'O dia em detalhe', [
    'Aqui está um dia de venda de combustível: litros, faturamento, lucro, preço e custo médio, acréscimos e descontos.',
    'Use as setas para passar para o dia anterior ou o seguinte sem fechar.',
  ]),
  pistaDia: g('pista-dia', 'O dia em detalhe', [
    'É um dia de venda aberto: quantidade, faturamento, custo, lucro e os valores médios por unidade.',
    'Use as setas para andar entre os dias sem fechar.',
  ]),
  litrosVendidos: g('litros-vendidos', 'Os litros conferidos', [
    'Aqui os litros vendidos são conferidos com o LMC: o que foi medido no tanque contra o que deveria ter.',
    'A diferença é perda ou sobra. Diferença grande pede conferência de medição, nota ou bomba.',
  ]),
  gestaoPrecosCedeu: g('gestao-precos-cedeu', 'De onde veio o desconto', [
    'Mostra de onde veio a diferença entre o preço de tabela e o que foi cobrado de fato.',
    'É o quanto isso mexeu no lucro bruto do período.',
  ]),

  // ── Compliance ───────────────────────────────────────────────────────────
  complianceJustificar: g('compliance-justificar', 'Justificar o reajuste', [
    'Registre aqui o motivo deste reajuste de preço, por exemplo aumento de custo da distribuidora.',
    'A justificativa fica guardada com quem lançou e não se apaga. Serve de defesa numa fiscalização.',
  ]),

  // ── Fechamento de caixa ─────────────────────────────────────────────────
  cartaoDetalhe: g('cartao-detalhe', 'O cartão em detalhe', [
    'Aqui o valor de cartão do caixa aparece aberto por bandeira, débito ou crédito, e administradora.',
    'Quando há mais de um PDV, cada um ganha sua coluna (pista e conveniência).',
  ]),
  grupoProdutos: g('grupo-produtos', 'Os produtos do grupo', [
    'São os produtos vendidos deste grupo no caixa, com quantidade, valor e margem.',
    'Use para ver o que puxou o valor do grupo no turno.',
  ]),

  // ── Financeiro ───────────────────────────────────────────────────────────
  pagarDia: g('pagar-dia', 'O que vence neste dia', [
    'Estas são as contas a pagar deste dia, com fornecedor, valor e situação.',
    'Vermelho é o que já venceu e ainda não foi pago.',
  ]),
  receberDia: g('receber-dia', 'O que entra neste dia', [
    'Estes são os valores a receber deste dia, com cliente, valor e situação.',
    'Vermelho é o que já venceu e ainda não foi recebido.',
  ]),

  // ── Cartões ──────────────────────────────────────────────────────────────
  aReceberRepasses: g('cartoes-repasses-dia', 'Os repasses do dia', [
    'São as transações de cartão que a administradora deve repassar neste dia, uma a uma.',
    'Confira se o valor que caiu na conta bate com o total da lista.',
  ]),

  // ── Operação ─────────────────────────────────────────────────────────────
  manutencaoBomba: g('manutencao-bomba', 'Como registrar', [
    'Aqui você lança a manutenção que foi feita nesta bomba: dia e hora, quem fez e, se quiser, o que foi feito.',
    'Daí pra frente o desgaste recomeça do zero e conta só os litros vendidos depois dela.',
    'Esqueceu de lançar na hora? Pode colocar uma data passada.',
    'Tudo fica no histórico, com quem registrou.',
  ]),
  afericoesRodada: g('afericoes-rodada', 'Uma rodada de aferição', [
    'Aqui estão as aferições de um dia num posto, separadas por combustível: hora, bico, litros e quem aferiu.',
    'Aferição é o teste da bomba: o combustível sai, é medido no balde e volta para o tanque. Não é venda.',
    'Em âmbar, volume fora do padrão do balde (não fecha em múltiplo de 10 litros): vale conferir.',
  ]),
  afericoesBicos: g('afericoes-bicos', 'Os bicos e o último teste', [
    'Cada bico cadastrado, com quantas aferições teve e a data da última, no período escolhido no topo.',
    'Os bicos sem aferição aparecem primeiro, em vermelho.',
    'Para olhar mais para trás, aumente o período no topo da tela.',
  ]),
  turnoDetalhe: g('turno-detalhe', 'O turno em detalhe', [
    'Aqui está o turno aberto: os abastecimentos, quanto apurou e a diferença do caixa.',
    'As formas de pagamento mostram como o dinheiro entrou.',
  ]),

  // ── Qualidade de dados ───────────────────────────────────────────────────
  lancamentoQualidade: g('lancamento-qualidade', 'O lançamento com problema', [
    'Este é o lançamento que a Qualidade de Dados marcou, com o motivo do alerta.',
    'Copie o código e procure no WebPosto para corrigir lá. Depois de corrigido, o alerta deixa de aparecer quando os dados forem atualizados.',
  ]),

  // ── Admin ────────────────────────────────────────────────────────────────
  assistenteConfig: g('assistente-config', 'Configurar o assistente', [
    'Aqui você ajusta o assistente de IA desta rede, como o perfil de uso e o limite de gasto.',
    'As mudanças valem para todos os usuários da rede.',
  ]),

  // ── Estoques ──────────────────────────────────────────────────────────────
  produtoEstoque: g('produto-estoque', 'O produto em detalhe', [
    'Aqui está tudo de um produto: o estoque (saldo, mínimo, valor e quantos dias dura), a venda no período e o preço do cadastro, com a margem.',
    'O gráfico mostra as vendas mês a mês dos últimos 6 meses, com o mês de pico em destaque.',
    'Comprar é a sugestão para cobrir a meta de dias no ritmo de venda atual.',
  ]),

  // ── Tarefas ──────────────────────────────────────────────────────────────
  tarefaDetalhe: g('tarefa-detalhe', 'A tarefa', [
    'Aqui está a tarefa: o que fazer, prazo, responsável e as etapas do checklist.',
    'Marque as etapas conforme for fazendo. Quando terminar, conclua. Se não der, adie ou cancele.',
  ]),
  tarefaForm: g('tarefa-form', 'Criar ou editar tarefa', [
    'Dê um título claro, escolha o posto, o responsável e o prazo.',
    'Se tiver etapas, monte o checklist: a tarefa só é concluída com as etapas marcadas.',
  ]),
  rotinaForm: g('rotina-form', 'Criar ou editar rotina', [
    'Rotina é a tarefa que se repete: todo dia, toda semana ou todo mês.',
    'Escolha a frequência, o horário e o responsável. O sistema cria as tarefas sozinho na data certa.',
  ]),
  setores: g('setores', 'Os setores', [
    'Setores agrupam rotinas e tarefas, por exemplo pista, loja e administrativo.',
    'Use para filtrar e ver o andamento de cada área.',
  ]),

  // ── Compras ──────────────────────────────────────────────────────────────
  novoPedido: g('compras-novo-pedido', 'Montar o pedido', [
    'Escolha o posto e o fornecedor e adicione os produtos com quantidade e preço.',
    'As sugestões vêm do estoque: o que está abaixo do mínimo ou acabando.',
    'Depois de salvo, o pedido segue para liberação.',
  ]),
  pedido: g('compras-pedido', 'O pedido', [
    'Aqui está o pedido com seus itens, valores e a situação: rascunho, aguardando, liberado, liberado em parte ou recusado.',
    'Quem tem permissão libera (tudo ou parte) ou recusa. Fica registrado quem fez.',
  ]),
  novaTransferencia: g('compras-nova-transferencia', 'Transferir entre postos', [
    'Escolha o posto que envia, o que recebe e os produtos com quantidade.',
    'Use para cobrir falta de um posto com a sobra de outro, sem comprar de novo.',
  ]),
  transferencia: g('compras-transferencia', 'A transferência', [
    'Aqui está a transferência com os itens e a situação.',
    'Quando os produtos chegarem no posto de destino, confira as quantidades e registre o recebimento.',
  ]),
  tetos: g('compras-tetos', 'Tetos de compra', [
    'Defina o valor máximo que pode ser liberado por posto e setor em cada mês. Zero quer dizer sem teto.',
    'O pedido que passar do teto não é bloqueado: ele avisa quem libera.',
  ]),
} satisfies Record<string, GuiaModal>
