/**
 * Notas de versão — a fonte ÚNICA do "o que há de novo".
 *
 * Aparecem (1) na tela de atualização, enquanto a versão nova é instalada,
 * (2) no aviso "Visor360 atualizado" depois do reinício e (3) em Configurações
 * › Sobre › Novidades. O build também publica este arquivo como
 * `/release-notes.json` (ver vite.config.ts): é por ele que o app ANTIGO, na
 * hora de atualizar, lê as novidades da versão NOVA — o bundle velho não as
 * conhece.
 *
 * Regras: linguagem de dono de posto (o que muda pra ele, não o commit);
 * versão mais nova primeiro; cada release = uma entrada com a versão do
 * package.json. Este arquivo é importado pelo vite.config.ts, então fica SEM
 * imports (ícones são chaves, resolvidas em components/feedback/Novidades.tsx).
 */
export type NovidadeIcone = 'apps' | 'demo' | 'ia' | 'mobile' | 'atualizacao' | 'ajuste' | 'seguranca' | 'relatorio'

export interface Novidade {
  icone: NovidadeIcone
  titulo: string
  descricao: string
}

export interface ReleaseNote {
  /** Igual ao `version` do package.json daquele deploy. */
  versao: string
  /** yyyy-MM-dd */
  data: string
  /** Uma frase que resume a versão. */
  resumo: string
  itens: Novidade[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    versao: '1.2.7',
    data: '2026-10-20',
    resumo: 'Antes e depois da CCI pela data real da consultoria, fornecedores do pedido de compra direto do cadastro do ERP e o menu Compras firme ao trocar de rede.',
    itens: [
      {
        icone: 'relatorio',
        titulo: 'Antes e depois da CCI pela data real da consultoria',
        descricao: 'O Diagnóstico agora usa a data em que a consultoria da CCI começou em cada posto como marco do Antes e depois. Na rede, vale a do posto mais antigo, com aviso quando os postos começaram em datas diferentes. Enquanto não houver um mês fechado com a CCI, o Diagnóstico diz isso em vez de comparar meses de antes da consultoria.',
      },
      {
        icone: 'ajuste',
        titulo: 'Fornecedores do pedido de compra',
        descricao: 'No novo pedido de compra, a lista de fornecedores vem do cadastro de fornecedores do ERP. Sem digitar, mostra quem emitiu nota de compra no último ano, primeiro quem vendeu para o posto, pela nota mais recente e com a data da última nota. Digitando, acha qualquer fornecedor cadastrado pelo nome, razão social, código ou CNPJ, e a lista avisa isso.',
      },
      {
        icone: 'ajuste',
        titulo: 'Correções',
        descricao: 'O menu Compras não some mais ao trocar de rede (só voltava recarregando a página). A atualização do Visor não repete mais a lista de novidades quando a versão é a mesma.',
      },
      {
        icone: 'ajuste',
        titulo: 'Admin: serviços da CCI',
        descricao: 'Na grade de serviços da CCI, ligar um serviço pede a data em que ele começou, e a data de um serviço já ligado se corrige clicando nela, num posto ou em todos de uma vez. Posto que ainda não está no cadastro comercial ganha os botões Copiar CNPJ e Cadastrar no Prospecção, que abre o cadastro pelo CNPJ já preenchido, inclusive para posto de outro estado.',
      },
    ],
  },
  {
    versao: '1.2.6',
    data: '2026-10-19',
    resumo: 'Diagnóstico com a cara da CCI e as recomendações de serviço, Estoques e Operação mais simples, pedido de compra direto do estoque e dos tanques, e a aba Aferições.',
    itens: [
      {
        icone: 'ajuste',
        titulo: 'Correções antes da versão',
        descricao: 'As permissões de Gestão de tarefas e de Liberação de compras marcadas em Usuários voltaram a valer para quem não é administrador (uma coluna faltando no banco derrubava as duas). E em Qualidade de Dados, a lista de preços suspeitos voltou a mostrar o cliente quando há muitos casos: a busca agora vai em lotes.',
      },
      {
        icone: 'ajuste',
        titulo: 'Ao Vivo: previsão também nos dias que já fecharam',
        descricao: 'Na semana do Ao Vivo, cada dia encerrado agora mostra a previsão que a tela dava naquele dia (feita só com os dias anteriores, sem olhar o resultado) e quanto ele fechou acima ou abaixo: fechou R$ 35.413 acima (113%), faltaram R$ 22.396 (92%). Assim dá para ver quanto o dia fechou e quanto poderia ter fechado.',
      },
      {
        icone: 'relatorio',
        titulo: 'Diagnóstico com a cara da CCI',
        descricao: 'O Diagnóstico do posto ganhou o visual da apresentação da CCI: capa verde-petróleo com o veredito em manchete e os quatro números que contam a história (lucro bruto, litros, lucro por litro e loja no lucro), e seções numeradas com o título já dizendo a conclusão. A nota de saúde virou um anel com os pilares em cards; o que vai bem e o que preocupa vêm em itens numerados; por onde começar virou uma sequência de passos com o ganho de cada um; e Onde a consultoria entra mostra quanto está em jogo por mês. Os números continuam saindo da apuração, com as mesmas regras, e ficam na última seção. Antes do próximo passo, uma seção nova mostra o que a consultoria da CCI avalia além do que o Visor360 lê: administradoras de cartão, plano de contas, contas bancárias, treinamento da pista e conciliação de caixas e cartões. A manchete agora fala da janela certa (Os últimos 12 meses foram bons, O ano está indo bem até aqui) em vez de "Foi um ano bom", pede para conferir a base quando o lucro ou o volume mudam mais de 50%, e posto sem loja aparece como Sem loja, não como 0%. No diagnóstico da rede, cada ponto de Onde a consultoria entra mostra em quais postos ele aparece, com o valor por mês de cada um, ou avisa quando é só efeito da soma da rede. E uma seção nova, O que a CCI recomenda, sugere até três serviços da CCI (BPO Financeiro, FleetPass, Relatórios Inteligentes e Consultoria) só quando um número do diagnóstico justifica, sempre com o porquê, e o botão Quero saber mais abre o WhatsApp comercial da CCI já com o nome do serviço. O diagnóstico também já sabe quais serviços da CCI cada posto contratou (vem do cadastro comercial da CCI, uma vez por dia): eles aparecem na capa, e um serviço já contratado em todos os postos sai das recomendações. Em Admin › Redes, cada rede mostra os serviços CCI contratados e o botão Serviços abre a grade por posto: ligar ou encerrar um serviço ali grava direto no cadastro comercial da CCI.',
      },
      {
        icone: 'ajuste',
        titulo: 'Sai o botão Potencial desta tela',
        descricao: 'O botão Potencial desta tela saiu do topo de todas as telas. A explicação de cada tela agora vem na dica com o personagem, que aparece ao abrir os detalhes e pode ser chamada de novo pelo botão Dica.',
      },
      {
        icone: 'relatorio',
        titulo: 'Pedido de combustível direto dos tanques',
        descricao: 'No detalhe dos tanques de um posto, o Pedido sugerido agora parte da última compra de cada combustível, o tamanho de carga que o posto costuma pedir, e nunca passa do que cabe no tanque. Em cada linha dá para trocar a base com um clique: última compra, o que cabe ou até o fim do mês. Ao lado aparece quantos dias o estoque dura com o pedido, em âmbar ou vermelho quando é pouco. Quando o que falta no mês não cabe de uma vez, o sistema avisa que vai precisar de outra entrega. Em redes com o módulo Compras, o botão Criar pedido de compra abre o pedido já preenchido, na categoria Combustível, com o preço da última compra e a distribuidora sugerida. E quando um modal abre por cima de outro, só a dica do de cima aparece: nada de dois balões ao mesmo tempo.',
      },
      {
        icone: 'relatorio',
        titulo: 'Operação ganhou a aba Aferições',
        descricao: 'Os testes de bomba do período numa aba própria. Cada linha é uma rodada: as aferições de um dia num posto, com produtos, bicos, litros e quem aferiu. Clique para abrir a rodada separada por combustível, com hora, bico e litros. O card Bicos aferidos mostra quantos dos bicos cadastrados foram testados e abre a lista bico a bico com a data do último teste; os que ficaram sem aferição aparecem primeiro. Volume fora do padrão do balde aparece em âmbar. Também corrigimos as aferições que não apareciam desde o fim de julho: elas estavam gravadas sem a data fiscal. O resumo de aferições saiu da Visão Geral.',
      },
      {
        icone: 'ajuste',
        titulo: 'Da lista de contas direto para Contas a receber ou a pagar, já filtrado',
        descricao: 'Nas listas que abrem ao clicar nas contas (Vencidas, Hoje, Próximos 7 dias, uma categoria ou o Saldo da janela), o link agora diz Abrir em Contas a receber ou Abrir em Contas a pagar e leva para a aba com o mesmo recorte: faixa de vencimento, categoria e o que foi buscado. A aba já abre no detalhamento, com uma faixa mostrando o filtro e o botão Ver tudo. Também alinhamos Cartões e Apps: a Central passou a separar pelo tipo cadastrado da administradora, igual à aba Receber, e os dois números agora batem. Em Contas a receber e a pagar, o Ver detalhe agora abre um modal: saldo em destaque, vencimento com quantos dias faltam ou passaram, posto, documento e plano de contas, a barra do que já foi pago quando houve baixa parcial e, nas faturas, as notas que a compõem.',
      },
      {
        icone: 'ajuste',
        titulo: 'Financeiro sem a aba Cartões',
        descricao: 'A aba Cartões saiu do Financeiro: a conciliação com o adquirente dependia de um repasse (EDI) que quase nunca chega pela integração e mostrava a tela zerada, o que confundia mais do que ajudava. Os cartões a receber continuam no Financeiro, nas contas a receber e na aba Receber.',
      },
      {
        icone: 'relatorio',
        titulo: 'Central: cards de setor com projeção',
        descricao: 'Os cards Combustível, Automotivos, Conveniência e Global ganharam a projeção dentro deles: barra de ritmo (quanto do mês já entrou), "Fecha em R$ X" comparado ao mês inteiro do ano ou mês anterior, o que falta e o ritmo por dia. O painel da direita virou "Ritmo do mês": dias fechados e restantes, fecha em, comparações, confiança e método. Mês fechado mostra "Fechou em", sem projeção fingida. O mesmo bloco entrou nas abas Combustível (litros e lucro), Automotivo e Conveniência (faturamento e lucro), e o card de projeção de cada aba virou o Ritmo do mês.',
      },
      {
        icone: 'relatorio',
        titulo: 'Ao Vivo: janela da semana',
        descricao: 'O Ao Vivo virou uma semana em colunas, de segunda a domingo: cada dia tem seu total no topo e os cards dos postos embaixo. Dias que passaram ficam em cinza, apagados; hoje segue verde, rodando e atualizando sozinho; os próximos dias ficam vazios.',
      },
      {
        icone: 'relatorio',
        titulo: 'Financeiro: calendário de vencimentos',
        descricao: 'Nas abas Pagar e Receber, um calendário do mês acima da tabela: total do dia, quantos títulos, os dois maiores nomes, cor por situação (vencido, até 7 dias, a vencer), subtotal por semana, dia mais pesado em destaque e a opção de levar sábado e domingo para o próximo dia útil. Clique no dia abre a lista. A tabela abre recolhida, com "Ver detalhamento"; ao abrir a tabela, o calendário recolhe (como os gráficos da Central) e volta com "Recolher".',
      },
      {
        icone: 'relatorio',
        titulo: 'Central: contas a pagar e a receber',
        descricao: 'Três cards novos na Visão Geral, abaixo dos tanques: Saldo da janela (a receber menos a pagar por horizonte: vencido, hoje, 7 e 30 dias), Contas a pagar e Contas a receber, cada um com as faixas Vencidas, Hoje, Próximos 7 e 8 a 30 dias, quantidade de documentos e a quebra por categoria (cartões, apps, notas, faturas; boleto, tributo, PIX...). Mesma base da aba Financeiro, com "Ver todas". Os mesmos três cards são agora a Visão Geral do Financeiro: os cards de posição por instrumento, as roscas e o "Tempo de atraso" saíram; a posição líquida total virou a coluna "Tudo em aberto" do Saldo da janela e o aviso dos cartões foi para o rodapé de Contas a receber. Vencido a receber aparece em laranja (é cobrar), vencido a pagar em vermelho (é risco).',
      },
      {
        icone: 'ajuste',
        titulo: 'Do estoque ao pedido de compra, com o fornecedor certo',
        descricao: 'No Novo pedido de compra, cada sugestão mostra de quem o produto foi comprado por último, quando e por quanto, tirado das notas de entrada do ERP dos últimos 12 meses (primeiro as do próprio posto, senão as da rede). Ao adicionar o primeiro item, esse fornecedor já fica escolhido, e o custo vem do preço pago na última compra. Se entrarem itens comprados por último de outros fornecedores, o sistema separa sozinho: um pedido para cada fornecedor. Ao escolher ou trocar o fornecedor, as sugestões mostram só os produtos comprados por último dele. Nota lançada em outra unidade (caixa contra unidade) não vira custo, só é avisada. No Estoques, na aba Comprar, dá para marcar os produtos e clicar em Criar pedido de compra: o pedido abre já preenchido com o posto, as quantidades sugeridas e o fornecedor. Produto que já está num pedido aberto aparece com o número do pedido. A tela do pedido também foi reorganizada em duas colunas: à esquerda você escolhe os produtos (busca, sugestões e filtros numa lista só), à direita o pedido fica sempre à vista, já separado por fornecedor, com observações, total e os botões de salvar e enviar. Cancelar ou excluir um pedido ou uma transferência, e despachar uma transferência, agora pede confirmação dentro da própria tela, com campo para o motivo, no lugar da janelinha do navegador. Também corrigimos a aba Comprar, que mostrava os cards zerados por alguns segundos enquanto carregava.',
      },
      {
        icone: 'ajuste',
        titulo: 'Estoques mais simples: Visão Geral, Produtos e Comprar',
        descricao: 'O módulo Estoques foi de 5 para 3 abas. Produtos junta Estoque geral, Giro e Média de venda numa lista só, com estoque e venda lado a lado (saldo, mínimo, valor, vendido, média por dia, giro e última venda), busca por nome, Ref. ou código de barras e filtro por situação. Clique num produto para ver o detalhe: preço do cadastro, margem, quantos dias dura e as vendas mês a mês. Comprar é a antiga Necessidade, com colunas enxutas e os mesmos nomes em todo lugar: Saldo negativo (provável erro de lançamento), Urgente (zerado com venda ou dura menos da metade da meta), Cobertura curta (dura menos que a meta), OK e Sem movimento. A Visão Geral virou o painel do posto, por setor (Automotivos e Conveniência): valor do inventário, valor em risco (parado há mais de 90 dias + excesso acima do dobro da meta, sem contar o mesmo produto duas vezes), cobertura média só de quem vende, ruptura e crítico com a venda perdida estimada por dia, valorização a custo médio, custo atual e preço de venda, Curva ABC, Giro × Margem e o imobilizado por grupo. Cada bloco abre a aba Produtos já filtrada, e a aba Produtos ganhou o filtro de setor e as situações Ruptura, Excesso e Parados. A tabela de todos os postos saiu. O posto agora é escolhido só no seletor do cabeçalho, como no Caixas e Turnos. Também corrigimos a lista que aparecia pela metade, com as vendas zeradas, enquanto ainda carregava. Links antigos para as abas removidas continuam funcionando.',
      },
      {
        icone: 'ajuste',
        titulo: 'Dicas com o técnico nos detalhes',
        descricao: 'Os detalhes que abrem por cima da tela (tanques do posto, resumo do posto, contas, dias de venda, aferições, manutenção das bombas, tarefas, rotinas, pedidos de compra e outros) ganharam um técnico com um caderno ao lado, explicando em poucas palavras o que aquele detalhe mostra e o que dá para fazer nele. Entendi fecha só desta vez; Não mostrar mais esconde de vez; o botão Dica, ao lado do X, traz a explicação de volta quando quiser.',
      },
      {
        icone: 'ajuste',
        titulo: 'Registro de manutenção das bombas',
        descricao: 'Cada bomba ganhou o botão Manutenções: registre a manutenção feita (data e hora, responsável e observação) e veja o histórico, com quem lançou cada registro. A partir da manutenção o desgaste recomeça do zero e passa a contar só os litros vendidos depois dela, sem depender do período do filtro. A tabela mostra a última manutenção de cada bomba. Pode lançar manutenção com data passada, nunca no futuro; só o master corrige um registro. A configuração de intervalo, aviso e responsável de cada posto, em Parâmetros, agora fica salva no sistema e vale igual para todos (antes ficava só no navegador de quem configurou).',
      },
      {
        icone: 'ajuste',
        titulo: 'Operação mais simples',
        descricao: 'O módulo Operação foi enxugado para não repetir informação. Visão Geral: só o quadro de tanques de cada posto (as aferições ganharam aba própria). Litros e faturamento ficam na Central. A aba Reabastecimento saiu: o pedido sugerido de cada posto (por combustível: quanto tem, quando seca e quanto pedir) agora fica no topo do detalhe dos tanques, que abre ao clicar no posto no quadro de Tanques. Quando só um dos tanques de um combustível zerou, a tela diz 1 tanque vazio, e não que o combustível acabou. O aviso de medição antiga aparece uma vez no topo do detalhe. Manutenção: sem a fila de postos para escolher; as bombas de todos os postos do filtro aparecem em grupos por posto, cada um com a bomba mais desgastada no cabeçalho e uma linha por bomba (status, desgaste, litros e a próxima manutenção em dias). Clique na linha para ver os combustíveis e os demais números. Com mais de 5 postos, os grupos abrem sob demanda. No topo da Manutenção há filtros que valem para todos os postos: por status (Verificar agora, Manutenção próxima, Regular, Sem movimento), só as bombas sem manutenção registrada e busca pelo nome da bomba. Saíram os cards de contagem repetidos, a faixa azul de escolha de posto e, no modal de aferições, a tabela de tanques que não era sobre aferição.',
      },
      {
        icone: 'ajuste',
        titulo: 'Central: tanques respeitam o filtro de posto',
        descricao: 'Com um posto escolhido no filtro, o quadro de Tanques da Visão Geral da Central continuava mostrando todos os postos da rede. Agora mostra só os postos filtrados, assim como o resto da tela. Vale também para o PDF de Compartilhar e para a Central no celular. Na Operação, a aba Reabastecimento passou a usar os mesmos cards de tanque do quadro da Central: ícone do tanque com o nível, atual, capacidade e quanto cabe, consumo por dia, quantos dias dura, a última compra e quanto comprar até o fim do mês. A aba Reabastecimento abre com o Pedido sugerido: para cada combustível, somando os tanques, quanto tem, quanto consome por dia, em que dia o primeiro tanque seca e quanto pedir até o fim do mês. Embaixo, os tanques aparecem agrupados por combustível. Quando a última medição do LMC é antiga (mais de 3 dias), a tela avisa que os litros são estimados e pede para conferir a régua antes de fechar o pedido; o mesmo aviso aparece nos cards de tanque da Central. A aba Bombas passou a se chamar Manutenção. O status das bombas passou a respeitar o Avisar ao atingir (%) configurado em Parâmetros: antes ele avisava sempre a partir de 70%, mesmo com outro valor configurado. O botão Ir para configuração das bombas agora leva direto à seção certa de Parâmetros, e os campos de lá ganharam o "?" de ajuda. A explicação Como funciona da Manutenção continua aberta depois de recarregar a página, se você a deixou aberta. Na Operação e em Estoques, o seletor de posto do topo ficou igual ao da Central, com Rede, Todos os postos e Selecione o posto. Antes ele pedia um posto só, enquanto a Visão Geral mostrava a rede toda. As abas de detalhe continuam com a escolha do posto dentro da própria aba. Na Visão Geral da Operação, a tabela Resumo por posto deu lugar ao quadro de Tanques de combustível da Central, com o nível de cada tanque por posto. Clicar num posto abre o detalhe ao vivo e o botão Abrir Reabastecimento deste posto leva direto a ele.',
      },
      {
        icone: 'ajuste',
        titulo: 'Concorrência por vizinho, posto a posto',
        descricao: 'Cada posto tem a sua lista de vizinhos, e cada vizinho é um posto, com nome e preço. Saiu a coluna Nº postos: todos os vizinhos pesam igual na média. Preço visto há mais de 7 dias fica com a borda vermelha e fora da média até ser atualizado. No Radar, ao analisar um posto, aparece cada vizinho daquele posto com o preço, a data em que foi visto e a diferença para o seu preço, além da média dos atualizados. Com um vizinho só, a tela avisa que a comparação é baseada em 1 concorrente. Também corrigimos um erro: ao trocar de posto, a tabela da concorrência podia mostrar por um instante os vizinhos do posto anterior. O botão Usar preços de concorrência deixou de valer para a rede inteira: agora o dono liga ou desliga posto a posto, na aba Concorrência ou na análise do posto no Radar, e a escolha fica salva no sistema (todos da rede veem igual, com quem mudou e quando). O Radar mostra quantos postos usam os próprios vizinhos. O gráfico de histórico de 30 dias saiu da aba Concorrência, que ficou só com a tabela. O seu preço agora é o mesmo número em todas as telas do Comercial: o preço de bomba de hoje (o de tabela), que é o que se compara com o preço visto no vizinho. Antes, a Concorrência e a lista do Radar usavam a média vendida no período e a análise do posto usava o preço de bomba, e os valores não batiam. A margem continua sendo a realizada no período. Na Central e na análise do posto, as colunas que eram médias do período passaram a dizer isso: Preço venda virou Preço médio, Preço custo virou Custo médio e Ticket por litro virou Preço médio/L. O "?" de cada uma explica que é a média vendida no período, e não o preço de bomba de hoje.',
      },
      {
        icone: 'ajuste',
        titulo: 'Ao Vivo: melhor e pior dia da semana e previsão de hoje',
        descricao: 'Na faixa da semana do Ao Vivo, o dia que mais vendeu ganha um troféu (Melhor) e o que menos vendeu ganha uma seta para baixo (Pior). A comparação usa só os dias já encerrados: hoje ainda está em andamento e não entra, para não aparecer sempre como o pior. O dia de hoje ganhou uma Previsão, calculada com a mesma projeção da Central: o ritmo de vendas do mês ajustado pelo quanto aquele dia da semana costuma vender nos últimos 6 meses. Uma barra mostra quanto do previsto já entrou. É uma estimativa: feriado e promoção mudam o dia.',
      },
      {
        icone: 'ajuste',
        titulo: 'Tarefas: lista, Kanban e Agenda no padrão visual',
        descricao: 'A lista de tarefas ganhou a coluna Status na frente, posto com o setor embaixo, vencimento com data e hora e o prazo em palavras, e um rodapé com a contagem. O Kanban passou a ter cinco colunas (A fazer, Em andamento, Atrasada, Concluída e Cancelada) com cartões que mostram posto, responsável, prazo e etapas. A Agenda virou um calendário no mesmo modelo do Financeiro: cada dia é um cartão com a quantidade de tarefas, as primeiras listadas com a cor do status, barra de peso do dia, selo do dia mais pesado e o resumo da semana na lateral. Os modais do módulo seguem o fundo padrão do sistema.',
      },
      {
        icone: 'ajuste',
        titulo: 'Menu e painel reorganizados',
        descricao: 'No menu lateral, Rede e Pessoas foram para o grupo Sistema, no fim da lista, junto com Selecionar rede. No painel de gestão, as onze telas viraram seis grupos: Selecionar rede, Cadastros (Usuários e Frentistas), Redes (Gerenciar, Apuração e Assistente IA), Comercial (Leads, Assinatura e Contrato WebPosto), Controle de acesso e Parâmetros (a antiga tela Configurações, renomeada), com sub-abas dentro de cada grupo. Todas as telas do painel ganharam o mesmo visual das demais telas do sistema. A tela Pessoas (só leitura) foi removida: a equipe é consultada e mantida em Configuração › Cadastros. A tela Rede agora avisa que o cadastro dos postos é automático e vem do WebPosto.',
      },
      {
        icone: 'ajuste',
        titulo: 'Comercial: uma régua de preço só',
        descricao: 'As abas Oportunidades e Radar de Preços davam leituras diferentes para o mesmo posto, uma pelo lucro por litro contra a média da rede e outra pela margem em % contra faixas. Agora é uma régua só, no Radar de Preços: para cada posto e combustível, o piso (custo), a referência (praça do posto quando cadastrada e ligada; senão a média da rede) e o preço atual, tudo em R$/L, e um veredito único com o número: Subir R$ X/L (e quanto vale no período), Segurar, Pode ceder até R$ X/L, ou Confirmar o custo quando o custo é velho ou sem data. Cada linha abre a conta por trás e o botão Analisar continua levando ao posto. A oportunidade da loja segue no fim da lista. A aba Oportunidades saiu; links antigos caem no Radar. Ao clicar em Analisar, o posto repete o mesmo veredito da lista e o simulador deixou de ser só de corte: tem Subir e Reduzir, já abre com o valor da régua aplicado (ex.: +R$ 0,04/L) e mostra quanto o volume pode cair antes de a alta deixar de compensar. Quando a régua diz Segurar, o simulador abre em zero e qualquer ajuste que a contrarie vem com aviso. Na Margem por posto, clicar num combustível abre o Radar já naquele posto e combustível. Ao abrir um posto na Margem por posto, cada combustível agora mostra os mesmos números e cores do Radar (margem em %, vermelho abaixo de 5% e âmbar abaixo de 9%, mais o R$/L) e é comparado com a média da rede no mesmo combustível, e não mais com a média de todos misturados, que fazia o diesel parecer sempre ruim.',
      },
      {
        icone: 'apps',
        titulo: 'Compras: pedidos de compra com liberação',
        descricao: 'Módulo novo no grupo Gestão, ligado por rede em Admin › Redes. Quem pede monta o pedido por posto e setor a partir das sugestões de reposição (estoque, mínimo e venda dos últimos 30 dias, cada uma com o porquê da quantidade) ou do catálogo, com aviso quando o produto já está em outro pedido aberto. Quem libera (marcado em Admin › Usuários) aprova inteiro, parcial item a item ou recusa com motivo. Cada pedido tem histórico, texto pronto para mandar ao fornecedor por WhatsApp e PDF. Tetos mensais por posto e setor avisam quando um pedido passa do combinado. Quando a nota do fornecedor aparece no ERP depois da liberação, o pedido mostra o aviso sozinho. E a aba Transferências: um posto manda para o outro, com a sugestão cruzando o que falta no destino com o que sobra na origem (sem deixar a origem descoberta), o despacho pela origem, a conferência item a item pelo destino e o histórico. Nada é enviado ao ERP: nota e movimentação de estoque entram pelo fluxo normal.',
      },
      {
        icone: 'seguranca',
        titulo: 'Cupons montados: lista por frentista e um relatório por cupom',
        descricao: 'Em Qualidade de Dados, os cupons com vários abastecimentos agora aparecem agrupados por frentista (quem mais aparece vem primeiro, com total de cupons, risco alto e dinheiro), em linhas enxutas: risco, cupom, quando, itens por combustível, intervalo, total, dinheiro e os quatro sinais. Ao abrir um cupom, o detalhe virou um relatório: o que aconteceu numa frase, os quatro sinais com o dado de cada um (vários abastecimentos, combustíveis diferentes, horários espalhados, pagamento misto), a linha do tempo dos abastecimentos com o intervalo entre eles, o fechamento do cupom (abastecido, rastreável, dinheiro) e o que fazer, com o código para buscar no Quality. A regra ficou mais justa: dinheiro abaixo de R$ 5 ou de 2% do cupom é troco e não conta como pagamento misto, e intervalo acima de 1 hora passou a contar como sinal.',
      },
      {
        icone: 'relatorio',
        titulo: 'Diagnóstico da rede inteira, diagnóstico de um mês, a nota de saúde e o antes e depois da CCI',
        descricao: 'A janela "Antes e depois da CCI" compara os meses desde que a CCI entrou com os mesmos meses imediatamente anteriores, com a data de início informada em Admin › Redes (sem ela, usa a data de cadastro da rede e diz isso). No topo do Diagnóstico entrou a Saúde do posto (ou da rede): uma nota de 0 a 100 tirada dos cinco pilares com pesos fixos, a régua com as faixas (Crítico até 49, Em atenção de 50 a 74, Saudável de 75 a 100), o que está pesando e o que ficou fora por falta de dado. O Diagnóstico ganhou "Toda a rede" no seletor de posto: o mesmo texto, agora falando da rede, mais a seção "Posto a posto" com quem puxou o lucro para cima e para baixo, o melhor e o pior lucro por litro (e quanto vale o pior chegar à média da rede), onde a loja pesa e onde não aparece, com a tabela por posto. E a janela "Mês": um mês fechado contra o mesmo mês do ano anterior, com uma segunda leitura contra o mês anterior. Na Central, "Diagnóstico anual" abre a rede quando não há um posto só no filtro.',
      },
      {
        icone: 'relatorio',
        titulo: 'Evolução da rede por dia, por mês e por ano',
        descricao: 'O gráfico "Evolução da rede" da Central ganhou a troca Dia / Mês / Ano. Dia continua mostrando o período do filtro; Mês mostra os últimos 12 meses e Ano os últimos 5 anos, direto da apuração, respeitando o filtro de posto. Mês ou ano em andamento, e mês com dias sem apuração, aparecem em barra clara com a nota no detalhe, para barra baixa não ser lida como queda de venda.',
      },
      {
        icone: 'relatorio',
        titulo: 'Diagnóstico do posto: um ano contra o anterior, contado em palavras',
        descricao: 'Botão "Diagnóstico anual" na Central (abre em tela cheia, sem menu) e item em Inteligência. O diagnóstico é um texto corrido, como um consultor falando, com os números em destaque: cinco pilares (venda e margem, loja, equipe da pista, equipe da loja, financeiro), o que está indo bem, o que preocupa, equipe (frentistas e vendedores: produtividade, concentração, rotatividade), financeiro (vencido a receber e a pagar, dias de faturamento na rua), por onde começar, o que ainda não dá para afirmar e o próximo passo com a CCI. Os números detalhados ficam em "Ver os números". Explica a apuração logo na entrada, com atalho para apurar os meses que faltam, e aceita período personalizado (mês inicial e final, e com o que comparar). Compara os últimos 12 meses com os 12 anteriores, ou o ano até o mês passado com o mesmo trecho do ano anterior: litros, faturamento, lucro, margem, lucro por litro, loja e ticket; mês a mês com gráfico; combustível por produto (preço médio, custo médio, margem por litro); loja e automotivos com maiores lucros, produtos que sumiram e novos. E a lista "Onde a consultoria entra": achados com o impacto em R$/mês e o que fazer. Só venda apurada; meses sem dado são declarados, com atalho para apurar. Compartilha em PDF.',
      },
      {
        icone: 'relatorio',
        titulo: 'Compartilhar PDF na Central e nas Contas',
        descricao: 'Botão "Compartilhar" na Visão Geral da Central (setores, ranking por posto, tanques e contas num PDF) e no card Saldo da janela, tanto na Central quanto na Visão Geral do Financeiro (saldo por horizonte, faixas e categorias de pagar e receber). Prévia na tela, WhatsApp no celular ou download. Só números da tela, sem IA.',
      },
      {
        icone: 'relatorio',
        titulo: 'Tarefas: resumo do dia para o grupo',
        descricao: 'No Painel de tarefas, um briefing pronto: como foi ontem (quantas no prazo), o que vence hoje por posto e por pessoa, e as atrasadas com há quantos dias. Sai como texto pro WhatsApp, cópia ou PDF, com um clique. O envio automático todo dia entra quando houver um provedor de WhatsApp ou e-mail contratado.',
      },
      {
        icone: 'relatorio',
        titulo: 'Celular: Central com detalhe e Ao Vivo em semana',
        descricao: 'Na Central do celular, tocar num setor abre o setor posto a posto, tocar num posto abre o resumo dele, e entraram as seções Tanques (toque no posto para ver ao vivo) e Contas (toque na faixa ou categoria para ver os títulos). No Ao Vivo, a semana virou uma fita de dias para rolar com o dedo, com o dia escolhido embaixo; hoje continua verde e rodando.',
      },
      {
        icone: 'relatorio',
        titulo: 'Central: clique e veja o detalhe sem trocar de tela',
        descricao: 'Na Visão Geral da Central, o que importa abre num modal em cima da tela. Tanques: clique no posto ou num tanque e veja ao vivo o físico estimado, consumo por dia, quantos dias dura, a última compra e quanto comprar até o fim do mês. Contas a pagar e a receber: clique numa faixa (Vencidas, Hoje, 7 dias, 8 a 30) ou numa categoria (Boleto, Cartões...) e veja os títulos, por nome ou um a um, com busca. Saldo da janela: clique num horizonte e veja o que entra e o que sai por categoria. Cards de setor, participação e margem: abrem o setor posto a posto. Ranking: clique no posto e veja o resumo dele por setor e os produtos que mais dão lucro.',
      },
      {
        icone: 'relatorio',
        titulo: 'Central: tanques de combustível da rede',
        descricao: 'Card novo na Visão Geral da Central, abaixo dos gráficos: todos os postos com um ícone por tanque (nível e produto), alertas de crítico e baixo, volume atual, capacidade, quanto cabe e a barra de nível do posto. Pior posto primeiro, busca por posto e total em tanque da rede.',
      },
      {
        icone: 'relatorio',
        titulo: 'Projeção por combustível, categoria e grupo',
        descricao: 'Nova aba no Detalhamento de Combustível, Automotivo e Conveniência: realizado e projeção de fechamento do mês item a item (litros ou unidades, lucro bruto, faturamento, margem e L.B.), com o que falta vender, o ritmo por dia restante, a fatia de cada um no lucro projetado e quanto do mês já entrou. Mesma projeção sazonal dos cards: os totais batem. Na aba Realizado dia a dia das três telas, o gráfico fica e a tabela abre recolhida, com o botão "Ver detalhamento".',
      },
      {
        icone: 'relatorio',
        titulo: 'Contrato WebPosto: modelo de indicação (base líquida de impostos)',
        descricao: 'A tela passou a calcular a parceria por percentual: postos indicados × preço do Visor (R$ 389,90) × % de repasse, com imposto do Simples sobre o bruto e o que fica com a CCI. Origem por rede (indicado × próprio), "Fechar mês" como base da nota de comissão e histórico dos últimos meses.',
      },
    ],
  },
  {
    versao: '1.2.5',
    data: '2026-10-15',
    resumo: 'Diretores ganham a conta do contrato com o WebPosto: clientes, chaves, postos e repasse do mês.',
    itens: [
      {
        icone: 'relatorio',
        titulo: 'Contrato WebPosto no Painel',
        descricao: 'Tela só para diretores com redes ativas, chaves, postos contados ao vivo na API e o repasse líquido e faturado do mês, com os parâmetros do contrato editáveis.',
      },
      {
        icone: 'ajuste',
        titulo: 'Módulo Tarefas (em teste)',
        descricao: 'Painel, Tarefas e Rotinas num módulo só: rotinas geram tarefas por posto todos os dias, com checklist, responsável, setor, foto ou documento, Kanban e Agenda. A CCI liga por rede enquanto testa.',
      },
      {
        icone: 'ajuste',
        titulo: 'Tarefas: menos cliques no dia a dia',
        descricao: 'Bolinha no menu com o que está atrasado ou vence hoje; atrasadas sempre no topo; o filtro de posto da barra vale na lista; quem executa abre direto nas suas pendentes; ao fechar o checklist o botão Concluir se destaca; observação opcional ao concluir ou cancelar; os cortes do painel abrem a lista já filtrada.',
      },
      {
        icone: 'ajuste',
        titulo: 'Tarefas: detalhes do dia a dia',
        descricao: '"Você" no lugar do seu nome; prazo em linguagem de gente ("hoje às 18:00", "atrasada há 2 dias"); a bolinha do menu conta só as suas, se você não é gestor; a linha inteira abre a tarefa; "Desfazer" logo após concluir; cancelar pede confirmação; atalhos Hoje, Amanhã e Segunda ao criar; a tela lembra visão, período e filtros; foto aparece em miniatura; rotina sem responsável mostra "não gera tarefas"; checklist por etapas com botão; "?" de ajuda nos cards, colunas e campos do módulo; aba Canceladas e botão Excluir (só gestor e diretor, com confirmação; leva histórico e anexos junto); lixeira nas rotinas para excluir de vez (com confirmação; as tarefas já geradas ficam no histórico).',
      },
      {
        icone: 'ajuste',
        titulo: 'Tarefas: agenda em calendário',
        descricao: 'A Agenda virou um calendário do mês (segunda a domingo) com as tarefas de cada dia, o que as rotinas ainda vão gerar nos dias futuros e a semana ao clicar num dia. O item Tarefas passou a ser o primeiro do grupo Gestão no menu. Na lista, tarefa com checklist pendente mostra "Abrir checklist" em vez de Concluir, para ninguém fechar sem fazer; sem checklist, Concluir é direto.',
      },
      {
        icone: 'ajuste',
        titulo: 'Tarefas: editar, adiar e ver o histórico',
        descricao: 'Gestor edita a tarefa depois de criada; responsável adia com motivo; o detalhe mostra quem fez o quê e quando. Marcar a primeira etapa já põe a tarefa em andamento. No celular a lista virou cards e os botões dos modais ficam sempre visíveis. Rotinas ganharam Duplicar e a prévia da próxima geração; setores podem ser renomeados.',
      },
      {
        icone: 'relatorio',
        titulo: 'Contrato WebPosto: fechar o mês',
        descricao: 'Botão que guarda a foto do mês (redes, postos e valores) para conferir o repasse quando ele chegar, com histórico dos últimos meses.',
      },
    ],
  },
  {
    versao: '1.2.4',
    data: '2026-10-06',
    resumo: 'O Gestão360 entrou na suíte: abra a rotina do escritório pelo launcher.',
    itens: [
      {
        icone: 'apps',
        titulo: 'Gestão360 no launcher',
        descricao: 'Conferência de caixa, conciliação bancária, contas a pagar e fiscal num app próprio da CCI. Toque na grade de apps para abrir.',
      },
      {
        icone: 'ajuste',
        titulo: 'Launcher sem o "instalar" teimoso',
        descricao: 'O link "instalar" embaixo dos outros apps aparecia mesmo com o app já instalado. Saiu. Cada app se instala a partir dele mesmo.',
      },
    ],
  },
  {
    versao: '1.2.3',
    data: '2026-10-02',
    resumo: 'A tela de atualização agora espera você: leia as novidades e toque em OK para reiniciar.',
    itens: [
      {
        icone: 'atualizacao',
        titulo: 'Atualização no seu tempo',
        descricao: 'Depois de instalar, o app mostra "Pronto para reiniciar" e só reinicia quando você tocar em OK. Nada de tela sumindo no meio da leitura.',
      },
      {
        icone: 'ajuste',
        titulo: 'Evolução da rede mais clara',
        descricao: 'Na Visão Geral, o lucro bruto virou uma linha com eixo próprio, os fins de semana ganharam faixa clara e a margem do dia aparece ao passar o mouse.',
      },
    ],
  },
  {
    versao: '1.2.2',
    data: '2026-10-02',
    resumo: 'A Visão Geral da Central ganhou dois modos: executivo, com gráficos, e análise detalhada, com as tabelas.',
    itens: [
      {
        icone: 'relatorio',
        titulo: 'Visão Geral em dois modos',
        descricao:
          'Ao abrir a Central você vê os indicadores e seis gráficos da rede: evolução diária, participação por setor, ranking de postos, variação do período e margem por setor. Clique em "Ver detalhamento" para recolher os gráficos e abrir as tabelas por posto com toda a largura.',
      },
      {
        icone: 'ajuste',
        titulo: 'Link direto para a análise',
        descricao: 'O modo detalhado fica na URL: ao atualizar a página ou compartilhar o link, ele abre já nas tabelas.',
      },
    ],
  },
  {
    versao: '1.2.1',
    data: '2026-09-28',
    resumo: 'Marque linhas nas tabelas com um clique e abra a aba Combustível da Central bem mais rápido.',
    itens: [
      {
        icone: 'ajuste',
        titulo: 'Marca-texto nas tabelas',
        descricao:
          'Clique numa linha de qualquer tabela para destacá-la em amarelo e acompanhar um posto ou produto na tela. Clique de novo para tirar; Esc limpa tudo. Linhas que abrem detalhes continuam abrindo.',
      },
      {
        icone: 'atualizacao',
        titulo: 'Central da Rede · Combustível mais rápida',
        descricao: 'A aba passou a ler só os dados de combustível, em vez de toda a rede. Os números são os mesmos, só chegam antes.',
      },
    ],
  },
  {
    versao: '1.2.0',
    data: '2026-09-28',
    resumo: 'Os apps da CCI num só lugar, Modo Demonstração e análises prontas no Cadu iA.',
    itens: [
      {
        icone: 'apps',
        titulo: 'Apps da CCI num só botão',
        descricao:
          'O botão de grade no topo abre o Visor360, o Prospecção360 e os portais da CCI. Cada app pode ser instalado no aparelho a partir dali.',
      },
      {
        icone: 'demo',
        titulo: 'Modo Demonstração',
        descricao:
          'Apresente o sistema sem expor o nome da sua rede nem dos postos. Liga e desliga no topo, só para quem tem permissão.',
      },
      {
        icone: 'ia',
        titulo: 'Análises prontas no Cadu iA',
        descricao:
          'Onze perguntas prontas em Inteligência, agrupadas por combustível, financeiro, vendas e estoque. Um clique e a resposta vem.',
      },
      {
        icone: 'mobile',
        titulo: 'Combustível no celular mais fácil de ler',
        descricao: 'O detalhamento por produto virou blocos empilhados, sem tabela apertada na tela pequena.',
      },
      {
        icone: 'atualizacao',
        titulo: 'Esta tela de atualização',
        descricao: 'A cada versão nova você vê o que mudou enquanto ela é instalada, e de novo em Configurações › Sobre.',
      },
    ],
  },
]

/** Compara versões "1.2.0" numericamente (positivo se a > b). */
export const compararVersao = (a: string, b: string): number => {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}
