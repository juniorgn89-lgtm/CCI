import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { HelpCircle, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/**
 * Botão "Como funciona?" + modal explicativo por tela E POR ABA. A ideia é
 * apresentar a tela usando DADOS INVENTADOS (exemplos fictícios), pra servir de
 * print/guia sem expor números reais do cliente.
 *
 * O conteúdo é indexado por rota + aba ativa (lida do `?tab=`). Trocou de aba →
 * o "Como funciona?" troca junto. Rotas/abas sem conteúdo cadastrado não
 * mostram o botão.
 *
 * Teste inicial: só a Central da Rede (/dashboard) e suas 3 abas. Depois as demais.
 */

interface HelpSection {
  /** Número da etapa (badge). */
  n: number
  title: string
  /** Linha de exemplo com dados FICTÍCIOS (não usar números reais). */
  exemplo: string
  /** Frase curta de "como ler" esse bloco. */
  comoLer: string
}

interface HelpContent {
  tela: string
  intro: string
  sections: HelpSection[]
}

interface RouteHelp {
  /** Aba assumida quando não há `?tab=` na URL. */
  defaultTab: string
  /** Conteúdo por aba (chave = valor do `?tab=`). */
  tabs: Record<string, HelpContent>
}

// Registry por rota → aba. Acrescentar uma entrada habilita o botão naquela
// rota/aba. As chaves de aba batem com os valores de `?tab=` da tela.
const HELP_CONTENT: Record<string, RouteHelp> = {
  '/dashboard': {
    defaultTab: 'setor',
    tabs: {
      // Aba "Visão Geral" (?tab ausente → 'setor')
      setor: {
        tela: 'Central da Rede · Visão Geral',
        intro: 'Visão consolidada de TODOS os postos no período filtrado. Os números abaixo são exemplos fictícios, só pra ilustrar como ler cada bloco.',
        sections: [
          {
            n: 1,
            title: 'Filtros do topo',
            exemplo: 'Junho · 01/06 a 23/06 (apurado) · vs mês ant.',
            comoLer: 'Período e comparativo (vs mês ou ano anterior). Ao abrir, o sistema já vem no apurado (1º → ontem, dados fechados). Pra incluir o dia de hoje ao vivo, basta estender a data final até hoje. Tudo na tela reage a esses filtros.',
          },
          {
            n: 2,
            title: 'Cards por setor',
            exemplo: 'Combustível R$ 180.000 · margem 12% · Conveniência R$ 64.000 · margem 49%',
            comoLer: 'Lucro bruto, faturamento e margem de cada setor (Combustível, Automotivos, Conveniência) e o Global da rede.',
          },
          {
            n: 3,
            title: 'Projeção — fim do mês',
            exemplo: 'Faturamento projetado R$ 4.500.000 · lucro R$ 720.000',
            comoLer: 'Estima o fechamento do mês pelo ritmo dos dias já apurados (linear por dias decorridos).',
          },
          {
            n: 4,
            title: 'Detalhamento por setor',
            exemplo: 'Posto Exemplo · 60.000 L · margem 12% · −5% vs período ant.',
            comoLer: 'Cada posto em 4 grupos — Operação, Financeiro, Comparativo (vs período anterior) e Eficiência. Clique no posto pra abrir grupos e produtos.',
          },
        ],
      },
      // Aba "Ao Vivo Rede"
      aovivo: {
        tela: 'Central da Rede · Ao Vivo Rede',
        intro: 'Acompanhamento dos caixas ABERTOS agora, posto a posto, em tempo real. Os números abaixo são fictícios.',
        sections: [
          {
            n: 1,
            title: 'Resumo "Ao vivo na rede"',
            exemplo: '9 caixas abertos em 5 postos',
            comoLer: 'Quantos caixas estão abertos neste momento e em quantos postos. Atualiza sozinho conforme os turnos abrem/fecham.',
          },
          {
            n: 2,
            title: 'Card de posto ao vivo',
            exemplo: 'Posto Exemplo · 2 caixas abertos · R$ 18.000 PARCIAL',
            comoLer: 'Faturamento PARCIAL do dia em curso, com os turnos abertos e o frentista de cada um. Clique pra ver o detalhe do turno.',
          },
        ],
      },
      // Aba "Combustível" (detalhe por posto)
      combustivel: {
        tela: 'Central da Rede · Combustível',
        intro: 'Litros, faturamento, margem e mix por tipo de combustível de UM posto (escolha o posto no filtro), da venda fiscal. Os números abaixo são fictícios.',
        sections: [
          { n: 1, title: 'KPIs do topo', exemplo: 'Litros 120.000 L · Lucro bruto R$ 40.000 · Margem 9% · L.B./Litro R$ 0,33', comoLer: 'Volume e rentabilidade do combustível no período, comparados ao período anterior. "Proj. fim do mês" estima o fechamento.' },
          { n: 2, title: 'Projeção (Ver detalhes)', exemplo: 'Faturamento projetado R$ 430.000 → expande por combustível', comoLer: 'Projeta faturamento e lucro até o fim do mês; "Ver detalhes" quebra a projeção por tipo de combustível.' },
          { n: 3, title: 'Mix por tipo', exemplo: 'Gasolina 48% · Etanol 22% · Diesel S-10 20% · Aditivada 10%', comoLer: 'Composição dos litros vendidos por combustível. Cada cor é um tipo.' },
          { n: 4, title: 'Detalhamento (sub-abas)', exemplo: '01/06 · 4.200 L · R$ 30.000 · margem 9% · var. semanal +5%', comoLer: 'Tabela com Realizado dia a dia, por combustível, Últimos 12 meses e Análise semanal. Clique numa data pra ver o detalhe do dia.' },
        ],
      },
      // Aba "Pista" (detalhe por posto)
      pista: {
        tela: 'Central da Rede · Automotivo',
        intro: 'Produtos automotivos da pista de UM posto (escolha o posto no filtro) — filtros, óleos, aditivos, baterias e acessórios. Os números abaixo são fictícios.',
        sections: [
          { n: 1, title: 'KPIs do topo', exemplo: 'Faturamento R$ 38.000 · Lucro bruto R$ 12.000 · Margem 32% · Ticket médio R$ 45', comoLer: 'Totais dos automotivos no período vs o anterior. Ticket médio = faturamento ÷ nº de vendas.' },
          { n: 2, title: 'Mix por categoria', exemplo: 'Lubrificantes 45% · Filtros 20% · Aditivos 15% · Acessórios 12% · Baterias 8%', comoLer: 'Quanto cada família de produto pesa no faturamento da pista.' },
          { n: 3, title: 'Detalhamento (sub-abas)', exemplo: '03/06 · 18 itens · R$ 1.400 · margem 33% · L.B. médio R$ 26', comoLer: 'Realizado dia a dia, por grupo, Pareto, Curva ABC e Catálogo. Clique numa data pra abrir grupo e produto.' },
          { n: 4, title: 'Catálogo — busca e filtros', exemplo: 'Buscar "óleo" · Lubrificantes · estoque crítico', comoLer: 'Na sub-aba Catálogo dá pra filtrar por nome, categoria e situação de estoque. Sem filtro mostra o Top 20.' },
        ],
      },
      // Aba "Conveniência" (detalhe por posto)
      conveniencia: {
        tela: 'Central da Rede · Conveniência',
        intro: 'Loja de conveniência de UM posto (escolha o posto no filtro) — faturamento, margem, Pareto, Curva ABC e catálogo. Os números abaixo são fictícios.',
        sections: [
          { n: 1, title: 'KPIs do topo', exemplo: 'Faturamento R$ 72.000 · Lucro bruto R$ 35.000 · Margem 49% · Ticket médio R$ 24', comoLer: 'Totais da loja com variação vs o período anterior. Ticket médio = faturamento ÷ nº de atendimentos (cupons).' },
          { n: 2, title: 'Contexto nos cards', exemplo: 'Itens 3.100 · Atendimentos 2.950 · Mês anterior R$ 68.000', comoLer: 'Cada card traz o valor do período anterior, a diferença, itens vendidos e nº de atendimentos.' },
          { n: 3, title: 'Detalhamento (sub-abas)', exemplo: '05/06 · 210 itens · R$ 2.400 · margem 50%', comoLer: 'Realizado dia a dia, por Grupo, Pareto, Curva ABC e Catálogo. Clique numa data pra abrir o detalhe.' },
          { n: 4, title: 'Pareto e Curva ABC', exemplo: '20% dos produtos = 80% do faturamento · Classe A: 35 itens', comoLer: 'Pareto mostra quais produtos concentram o faturamento; a Curva ABC classifica em A/B/C. Use pra priorizar o mix.' },
        ],
      },
    },
  },

  '/caixas-turnos': {
    defaultTab: 'visao',
    tabs: {
      visao: {
        tela: 'Caixas & Turnos · Visão Geral',
        intro: 'Resumo dos caixas no período: quanto entrou, diferenças e formas de pagamento. Os números abaixo são fictícios.',
        sections: [
          { n: 1, title: 'KPIs do período', exemplo: 'Total Apurado R$ 142.000 · Diferença −R$ 380 · 3 abertos · 18 fechados', comoLer: 'Total apurado, soma das diferenças (vermelho = falta, âmbar = sobra) e quantos caixas estão abertos vs fechados.' },
          { n: 2, title: 'Formas de pagamento', exemplo: 'Dinheiro 38% · Cartão 44% · Pix 18% · Total R$ 142.000', comoLer: 'Como o apurado se reparte. Clique numa fatia pra filtrar a aba Turnos por aquela forma.' },
          { n: 3, title: 'Evolução diária do apurado', exemplo: 'Apurado até hoje R$ 98.000 · Projeção R$ 142.000', comoLer: 'Apurado dia a dia + projeção até o fim do mês pela média dos últimos 7 dias. Clique num dia pra filtrar os turnos.' },
        ],
      },
      turnos: {
        tela: 'Caixas & Turnos · Turnos de Caixa',
        intro: 'Turnos agrupados por dia, com responsável, apurado e diferença. Os valores abaixo são fictícios.',
        sections: [
          { n: 1, title: 'Filtros', exemplo: 'Buscar "Maria" · Turno Tarde · Abertos / Fechados / Com diferença', comoLer: 'Filtre por responsável, turno e situação. "Abertos" tem ponto verde ao vivo; "diferença" só vale pra fechados.' },
          { n: 2, title: 'Resumo de diferenças', exemplo: 'Sobras +R$ 210 (2) · Faltas −R$ 590 (3) · Saldo −R$ 380', comoLer: 'Com os fechados visíveis: soma de sobras e faltas (entre parênteses, quantos caixas) e o saldo líquido.' },
          { n: 3, title: 'Dia agrupado', exemplo: '10/06 Terça · 3 turnos · Apurado R$ 8.400 · −R$ 120', comoLer: 'Cada banner é um dia (clique pra abrir/fechar). Dias com caixa ao vivo abrem sozinhos com selo verde.' },
          { n: 4, title: 'Linha do turno', exemplo: 'Tarde · Maria S. · 14:00–22:00 · R$ 2.800 parcial · Ao vivo', comoLer: 'Turno, responsável, horário, apurado (tag "parcial" se aberto) e diferença. Clique pra abrir o detalhe.' },
        ],
      },
    },
  },

  '/fechamento-caixa': {
    defaultTab: '',
    tabs: {
      '': {
        tela: 'Fechamentos',
        intro: 'Selecione caixas e veja o relatório agregado: apurado, pagamentos, frentistas e diferenças. Números fictícios abaixo.',
        sections: [
          { n: 1, title: 'Seletor de caixas', exemplo: '5 de 22 caixas · incluir abertos: não', comoLer: 'Marque dias inteiros ou caixas individuais. Por padrão só os fechados; ligue "incluir abertos" pra somar os em andamento.' },
          { n: 2, title: 'KPIs do agregado', exemplo: 'Apurado R$ 34.000 · Combustível R$ 27.000 (79%) · Conveniência R$ 7.000 · Diferença −R$ 150', comoLer: 'Soma dos caixas selecionados: apurado total, combustível vs conveniência e a diferença dos fechados.' },
          { n: 3, title: 'Pagamentos e Frentistas', exemplo: 'Pix R$ 12.000 · Cartão R$ 15.000 | Maria S. R$ 9.800 · 120 abast.', comoLer: 'Esquerda: formas de pagamento com % e nº de transações. Direita: frentistas por faturamento, litros e atendimentos.' },
          { n: 4, title: 'Sobras e Faltas por caixa', exemplo: '08/06 · Tarde · Caixa #3 · João P. · −R$ 80', comoLer: 'Só os fechados com diferença, do maior desvio pro menor. Verde = sobra, vermelho = falta.' },
        ],
      },
    },
  },

  '/financeiro': {
    defaultTab: 'visao',
    tabs: {
      visao: {
        tela: 'Financeiro · Visão Geral',
        intro: 'Panorama de contas a receber, a pagar e fluxo de caixa do período. Os números abaixo são fictícios.',
        sections: [
          { n: 1, title: 'KPIs principais', exemplo: 'A Receber R$ 180.000 · A Pagar R$ 120.000 · Saldo Líquido R$ 60.000 · Inadimplência 8%', comoLer: 'Totais do período. Saldo Líquido = a receber − a pagar. Clique num card pra ir à aba correspondente.' },
          { n: 2, title: 'Cards de fluxo', exemplo: 'Entradas R$ 210.000 · Saídas R$ 165.000 · Saldo +R$ 45.000', comoLer: 'Movimentação realizada no período. Saldo positivo (verde) = entradas cobriram as saídas.' },
          { n: 3, title: 'Aging de inadimplência', exemplo: '< 30 dias R$ 4.000 · 30–60 R$ 6.000 · > 90 R$ 4.000', comoLer: 'Títulos vencidos por faixa de atraso, a receber e a pagar lado a lado. Quanto mais antigo, mais difícil recuperar.' },
          { n: 4, title: 'Vencimentos + Fluxo', exemplo: 'Cliente X R$ 3.200 em 3d · gráfico com saldo acumulado', comoLer: 'Top 5 a vencer de cada lado (âmbar quando ≤7 dias) e o gráfico de fluxo com a linha de saldo acumulado.' },
        ],
      },
      receber: {
        tela: 'Financeiro · A Receber',
        intro: 'Títulos a receber dos clientes, com situação e atraso. Os valores abaixo são fictícios.',
        sections: [
          { n: 1, title: 'Filtros', exemplo: 'Todos / A Vencer / Vencidos / Pagos · faixa de atraso · buscar cliente', comoLer: 'Filtre por situação, faixa de aging (só pendentes) ou busque por cliente/documento.' },
          { n: 2, title: 'Linha do título', exemplo: 'Cliente Exemplo · venc. 12/06 · R$ 3.500 · BOLETO · A Vencer', comoLer: 'Cliente, vencimento, valor, tipo e situação. Vencidos aparecem em vermelho com os dias de atraso.' },
          { n: 3, title: 'Totais da tabela', exemplo: '42 títulos · R$ 180.000', comoLer: 'A faixa de totais soma o que está filtrado — muda conforme você troca os filtros.' },
        ],
      },
      pagar: {
        tela: 'Financeiro · A Pagar',
        intro: 'Contas a pagar a fornecedores, com saldo restante e parcelas. Os valores abaixo são fictícios.',
        sections: [
          { n: 1, title: 'Filtros', exemplo: 'Todos / A Vencer / Vencidos / Pagos · faixa de atraso · buscar fornecedor', comoLer: 'Filtre por situação, faixa de aging ou busque pelo nome do fornecedor.' },
          { n: 2, title: 'Linha da conta', exemplo: 'Fornecedor Exemplo · venc. 15/06 · R$ 8.000 · saldo R$ 8.000 · parcela 2/4', comoLer: 'Fornecedor, vencimento, valor e saldo restante (vermelho se ainda há saldo). Parcela mostra a posição quando parcelado.' },
          { n: 3, title: 'Situações', exemplo: 'A Vencer · Vencido (12d) · Pago · Cancelado', comoLer: 'A etiqueta indica o estado; "Vencido" traz os dias em atraso.' },
        ],
      },
      fluxo: {
        tela: 'Financeiro · Fluxo de Caixa',
        intro: 'Entradas, saídas e saldo do período, com comparativo vs mês anterior. Os valores abaixo são fictícios.',
        sections: [
          { n: 1, title: 'KPIs com variação', exemplo: 'Entradas R$ 210.000 (+8%) · Saídas R$ 165.000 (−4%) · Saldo +R$ 45.000', comoLer: 'Totais do período e variação vs mês anterior. Em Saídas, queda é boa (verde).' },
          { n: 2, title: 'Modos de visão', exemplo: 'Diário · Acumulado', comoLer: '"Diário" mostra entradas/saídas dia a dia; "Acumulado" mostra a curva do saldo somando o período.' },
          { n: 3, title: 'Gráfico de fluxo', exemplo: 'Barras verdes (entradas) e vermelhas (saídas) + linha de saldo', comoLer: 'Barras pra cima = entradas, pra baixo = saídas; a linha azul acompanha o saldo acumulado.' },
          { n: 4, title: 'Exportar', exemplo: 'Exportar CSV · Exportar PDF', comoLer: 'Baixe o detalhe diário em CSV ou gere um PDF pra arquivar/enviar.' },
        ],
      },
    },
  },

  '/estoques': {
    defaultTab: 'visao',
    tabs: {
      visao: {
        tela: 'Estoques · Visão Geral',
        intro: 'Panorama do estoque de não-combustíveis (loja) no posto filtrado. Os números abaixo são fictícios.',
        sections: [
          { n: 1, title: 'Total de produtos e valor', exemplo: '742 produtos · R$ 138.000 em estoque', comoLer: 'Quantos SKUs têm saldo/movimentação e quanto vale o estoque a custo médio dos últimos 6 meses.' },
          { n: 2, title: 'Mini-alarmes', exemplo: 'Saldo negativo 3 · Ruptura 8 · Necessidade crítica 21 · Giro 2,4', comoLer: 'Saúde do estoque. Clique num card pra ir à aba que detalha aquele problema.' },
          { n: 3, title: 'Vão zerar em breve', exemplo: 'Cerveja Lata · zera em 5d · 90 un · 18/dia', comoLer: 'Top 3 prestes a acabar pela média diária. Vermelho < 7 dias, âmbar < 15 dias.' },
          { n: 4, title: 'Top valor e categorias', exemplo: 'Bebidas R$ 42.000 (30%) · 120 SKU', comoLer: 'Onde está o dinheiro parado, o que comprar com urgência e a distribuição do valor por categoria.' },
        ],
      },
      geral: {
        tela: 'Estoques · Estoque geral',
        intro: 'Saldo atual de todos os produtos, ordenável e filtrável. Os valores abaixo são fictícios.',
        sections: [
          { n: 1, title: 'Busca e categoria', exemplo: 'Buscar "coca" · Categoria Bebidas', comoLer: 'Filtre por nome/SKU ou categoria pra reduzir a lista.' },
          { n: 2, title: 'Linha do produto', exemplo: 'Coca-Cola Lata · saldo 180 · custo R$ 2,90 · R$ 522 em estoque', comoLer: 'Saldo, custo médio e valor por produto. Saldo zero/negativo em vermelho.' },
          { n: 3, title: 'Rodapé de totais', exemplo: '742 produtos · 18.400 un · R$ 138.000', comoLer: 'Soma do que está filtrado — recalcula conforme você filtra.' },
        ],
      },
      giro: {
        tela: 'Estoques · Giro',
        intro: 'Quantas vezes o estoque girou em 6 meses (vendas ÷ estoque médio). Os valores abaixo são fictícios.',
        sections: [
          { n: 1, title: 'Giro (6m)', exemplo: 'Coca-Cola 6,0x · Amaciante 0,5x', comoLer: 'Giro alto = produto rodando; baixo = capital parado. A célula é colorida (verde alto, vermelho baixo).' },
          { n: 2, title: 'Faixas de leitura', exemplo: '> 4x ótimo · 2–4x saudável · 0,5–2x empacando · < 0,5x parado', comoLer: 'Use o "?" do título pra ver fórmula e ação sugerida por faixa.' },
          { n: 3, title: 'Rodapé de totais', exemplo: 'Com giro 510 · sem movimento 232 · giro médio 2,4x', comoLer: 'Quantos giraram, quantos ficaram parados e o giro médio do filtrado.' },
        ],
      },
      estoqueMedio: {
        tela: 'Estoques · Estoque médio',
        intro: 'Média do saldo de 6 meses vs o saldo atual de cada produto. Os valores abaixo são fictícios.',
        sections: [
          { n: 1, title: 'Médio vs atual', exemplo: 'Coca-Cola · médio 200 · atual 180', comoLer: 'A média histórica indica se o saldo de hoje está acima ou abaixo do normal.' },
          { n: 2, title: 'Variação vs média', exemplo: '−10% abaixo · +25% acima', comoLer: 'Verde = acima da média; vermelho = abaixo (risco de ruptura se for demais).' },
          { n: 3, title: 'Rodapé de totais', exemplo: '742 produtos · médio 19.000 · atual 18.400', comoLer: 'Soma do estoque médio e do saldo atual do filtrado.' },
        ],
      },
      mediaVendas: {
        tela: 'Estoques · Média de venda (6m)',
        intro: 'Volume vendido por produto em 6 meses, com média mensal e mês de pico. Os valores abaixo são fictícios.',
        sections: [
          { n: 1, title: 'Vendas e média mensal', exemplo: 'Coca-Cola · 1.200 em 6m · 200/mês', comoLer: 'Quanto saiu no semestre e a média mensal — base pra dimensionar compra e estoque.' },
          { n: 2, title: 'Mês de pico', exemplo: 'Pico 320 · Dez/25', comoLer: 'O mês de maior venda — útil pra antecipar sazonalidade.' },
          { n: 3, title: 'Receita 6m e totais', exemplo: 'Receita R$ 8.400 · total 92.000 un · R$ 540.000', comoLer: 'Receita por produto e os totais do filtrado no rodapé.' },
        ],
      },
      necessidade: {
        tela: 'Estoques · Necessidade',
        intro: 'Compara o saldo atual com a média de venda (6m) pra sugerir o que comprar. Os valores abaixo são fictícios.',
        sections: [
          { n: 1, title: 'Cards de status', exemplo: 'Negativos 3 · Críticos 21 · Baixos 44 · OK 610', comoLer: 'Clique num card pra filtrar por status. Negativo = saldo abaixo de zero, investigar.' },
          { n: 2, title: 'Cobertura e dias', exemplo: 'Saldo 90 · 200/mês · cobre 13 dias', comoLer: 'Por quantos dias o saldo cobre a venda. Vermelho perto de zerar, âmbar abaixo da meta.' },
          { n: 3, title: 'Quanto comprar', exemplo: 'Comprar 350 un · custo estimado R$ 24.000', comoLer: 'Sugestão de compra pra cobrir os dias do campo "Cobertura" (padrão 30) e o custo estimado.' },
        ],
      },
    },
  },

  '/reabastecimento': {
    defaultTab: '',
    tabs: {
      '': {
        tela: 'Reabastecimento',
        intro: 'Nível dos tanques, última compra e quanto comprar até o fim do mês. Os valores abaixo são fictícios.',
        sections: [
          { n: 1, title: 'Cards de status dos tanques', exemplo: 'Total 8 · Críticos 2 · Alerta 1 · OK 5', comoLer: 'Quantos tanques em cada faixa de nível. Use os botões pra filtrar por status.' },
          { n: 2, title: 'Necessidade total', exemplo: 'Necessidade total 9.800 L', comoLer: 'Soma do que falta comprar em todos os tanques, projetada pelo consumo médio diário.' },
          { n: 3, title: 'Card do tanque', exemplo: 'Tanque 1 · Gasolina · 13% · 1.900 L de 15.000 L', comoLer: 'Nível em % e litros. Cor da barra: vermelho crítico, âmbar alerta, verde ok.' },
          { n: 4, title: 'Última compra e quanto comprar', exemplo: 'Última: 2.000 L em 08/06 · Comprar 3.300 L (cobre ~6 dias)', comoLer: 'Última entrada de NF do produto e a sugestão de compra até o fim do mês. A visão "Resumo" agrupa por combustível.' },
        ],
      },
    },
  },

  '/bombas': {
    defaultTab: '',
    tabs: {
      '': {
        tela: 'Bombas',
        intro: 'Volume bombeado por bomba, ranking e controle de manutenção. Os valores abaixo são fictícios.',
        sections: [
          { n: 1, title: 'KPIs do topo', exemplo: 'Ativas 6 · 142.000 L · 8.400 abastecimentos · + usada: Bomba 3', comoLer: 'Indicadores das bombas no período, com variação vs anterior e a que mais bombeou.' },
          { n: 2, title: 'Card da bomba', exemplo: 'Bomba 3 · 1º · Gasolina 28.500 L · 42 L/abast.', comoLer: 'Litros/mês, abastecimentos e média por abastecimento. Seta vermelha quando a média caiu > 15%.' },
          { n: 3, title: 'Desgaste e manutenção', exemplo: 'Desgaste 82% · manutenção próxima · +9.000 L estimados', comoLer: 'Litros desde a última manutenção ÷ intervalo. Verde regular, âmbar 70–90%, vermelho > 90%. Clique na chave pro histórico.' },
          { n: 4, title: 'Comparativo de eficiência', exemplo: 'Bomba 3 · 28.500 L/mês · −18% vs mês ant.', comoLer: 'Tabela ranqueando por volume, com variação e barra de desgaste. Clique numa linha pra destacar.' },
        ],
      },
    },
  },

  '/produtividade': {
    defaultTab: 'visao',
    tabs: {
      visao: {
        tela: 'Produtividade · Visão Geral',
        intro: 'Ranking de frentistas com Score 0–100 e progresso de meta. O alternador Frentistas/Vendedores troca pra produtividade da loja. Números fictícios.',
        sections: [
          { n: 1, title: 'KPIs do topo', exemplo: 'Meta 540.000 de 600.000 L (90%) · Destaque: Frentista Exemplo · Atenção: −18%', comoLer: 'Progresso da meta da equipe, o frentista de maior volume (Destaque) e o de maior queda (Atenção).' },
          { n: 2, title: 'Score 0–100', exemplo: 'Frentista Exemplo · Score 82', comoLer: 'Nota que combina litros, mix de aditivada, ticket e cobertura de custo. Verde ≥75, azul ≥50, âmbar ≥25.' },
          { n: 3, title: 'Colunas por grupo', exemplo: 'Litros 48.000 · Automotivo 12.000 · Faturamento R$ 312.000 · Ticket R$ 180', comoLer: 'Colunas em 4 grupos — Operação, Financeiro, Eficiência e Comparativo. Clique no cabeçalho pra ordenar.' },
          { n: 4, title: 'Novo frentista', exemplo: '"Novo frentista" no lugar do % vs anterior', comoLer: 'Sem histórico confiável no mês anterior, a coluna marca "Novo frentista" em vez de um % enganoso.' },
        ],
      },
      projecoes: {
        tela: 'Produtividade · Projeções',
        intro: 'Estima onde cada frentista fecha o mês pelo ritmo dos últimos 7 dias. Valores fictícios.',
        sections: [
          { n: 1, title: 'Como é calculada', exemplo: 'Média 7 dias 1.800 L/dia × 8 dias restantes', comoLer: 'A linha tracejada projeta pela média dos últimos 7 dias. Não considera sazonalidade nem feriados.' },
          { n: 2, title: 'Evolução acumulada', exemplo: '5 frentistas · linha cheia = realizado, tracejada = projeção', comoLer: 'Cada frentista é uma linha; a marca "Hoje" separa realizado de projeção. Selecione até 6 nas pílulas.' },
          { n: 3, title: 'Projeção por frentista', exemplo: 'Realizado 48.000 · +14.400 · total 62.400 · vs Meta +4%', comoLer: 'Realizado, o que deve somar e o total estimado. "vs Meta" compara com a meta (verde bate, vermelho fica abaixo).' },
        ],
      },
      metas: {
        tela: 'Produtividade · Metas',
        intro: 'Define a meta de litros por frentista — pelo mês anterior ou manual. Valores fictícios.',
        sections: [
          { n: 1, title: 'Origem das metas', exemplo: 'Usar mês anterior · ou · meta manual', comoLer: 'No automático a meta é superar o mês anterior. No manual você digita a meta de cada um e salva.' },
          { n: 2, title: 'Filtro por status', exemplo: 'Atingida · Parcial · Abaixo · Novo', comoLer: 'Atingida ≥100%, Parcial ≥70%, Abaixo <70%, Novo = sem meta/base.' },
          { n: 3, title: 'Meta vs realizado', exemplo: 'Frentista Exemplo · Meta 50.000 · Realizado 46.000 · 92%', comoLer: 'Compara meta e bombeado. % verde ≥100%, âmbar ≥70%, vermelho abaixo.' },
        ],
      },
      destaques: {
        tela: 'Produtividade · Destaques',
        intro: 'Reconhece quem ficou acima da meta semana a semana no mês. Valores fictícios.',
        sections: [
          { n: 1, title: 'Destaque do mês', exemplo: 'Frentista Exemplo · 1º · acima da meta em 4 semanas · +12%', comoLer: 'O 1º entre os elegíveis pelo nº de semanas acima da meta; empate desfeito por litros.' },
          { n: 2, title: 'Excepcional', exemplo: '2 frentistas excepcionais', comoLer: 'Selo verde pra quem ficou acima da meta em 3 ou 4 das 4 semanas.' },
          { n: 3, title: 'Top 5 e consistência', exemplo: 'Sem 1 12.000 · Sem 2 11.500 · 4 bolinhas verdes', comoLer: 'Volume por semana e a consistência (verde = acima da meta na semana, vermelha = abaixo).' },
          { n: 4, title: 'Novatos no período', exemplo: 'Frentista Exemplo · "Primeiro mês" · pico Sem 3', comoLer: 'Lista de quem não tem base no mês anterior — fora do ranking, mostra o pico semanal e a tendência.' },
        ],
      },
    },
  },

  '/qualidade-dados': {
    defaultTab: '',
    tabs: {
      '': {
        tela: 'Qualidade de Dados',
        intro: 'Auditoria automática que varre os dados e sinaliza erros, inconsistências e cupons suspeitos. Números fictícios.',
        sections: [
          { n: 1, title: 'KPIs por severidade', exemplo: 'Total 124 · Críticos 9 · Atenção 31 · Info 84', comoLer: 'Críticos quebram cálculos (corrigir já), Atenção são suspeitos, Info é heads-up. Exclui o que já foi arquivado.' },
          { n: 2, title: 'Sherlock Holmes (anti-fraude)', exemplo: 'Cupom #50231 · 6 abastecimentos · gasolina + diesel · 2h10 ⚠', comoLer: 'Detecta cupons "montados" (vários abastecimentos num lançamento, mix de combustível/pagamento). Score Alto/Médio/Baixo.' },
          { n: 3, title: 'Categorias de checagem', exemplo: 'Abastecimentos · Caixa · Estoque · Financeiro', comoLer: 'Cada bloco agrupa detectores (preço fora da média, caixa aberto há dias, estoque negativo…) com o contador de itens.' },
          { n: 4, title: 'Arquivar', exemplo: '3 lançamentos selecionados · Arquivar', comoLer: 'Clique numa linha pra ver o código no Quality. Marque e arquive o que já tratou; a aba Arquivados permite reabrir.' },
        ],
      },
    },
  },

  '/pessoas': {
    defaultTab: '',
    tabs: {
      '': {
        tela: 'Pessoas',
        intro: 'Diretório (somente leitura) da equipe da rede — gerentes, supervisores e frentistas. Números fictícios.',
        sections: [
          { n: 1, title: 'Resumo por cargo', exemplo: 'Gerente Geral 1 · Supervisor 3 · Gerente 8 · Frentista 42', comoLer: 'Cards contam só os ativos. Clique num card pra filtrar a lista por aquele cargo.' },
          { n: 2, title: 'Busca e status', exemplo: 'Buscar "silva" · Ativos / Inativos / Todos · 12 pessoas', comoLer: 'A busca cobre nome, email e posto; o seletor filtra ativos/inativos; o contador mostra quantas batem.' },
          { n: 3, title: 'Lista de pessoas', exemplo: 'João Exemplo · Frentista · Posto Exemplo · Ativo', comoLer: 'Nome, cargo (selo colorido), posto/rede e status. Ordenada por cargo e nome.' },
          { n: 4, title: 'Somente visualização', exemplo: 'Gerenciamento em /admin', comoLer: 'Esta tela não cria nem edita — criar, editar ou inativar é nas telas de Admin.' },
        ],
      },
    },
  },

  '/inteligencia': {
    defaultTab: 'analise',
    tabs: {
      analise: {
        tela: 'Inteligência · Análise & Comparação',
        intro: 'Escolha postos e período; a tela compara o desempenho entre eles (ou a evolução de um no tempo). Números fictícios.',
        sections: [
          { n: 1, title: 'Seleção de postos + período', exemplo: 'Posto Centro + Sul + Marginal · Junho', comoLer: '1 posto = comparativo temporal; 2+ = comparação entre postos. Sem posto, a tela fica vazia.' },
          { n: 2, title: 'Centro de Controle', exemplo: 'Litros 1,2M · Faturamento R$ 6,4M · Conversão 38%', comoLer: 'KPIs somados dos postos escolhidos + alertas. Mostra quantos estão acima/abaixo da média e o score médio.' },
          { n: 3, title: 'Comparação, Mapa e Análise', exemplo: 'Centro 92 pts · Sul 78 pts · 2 destaques, 1 atenção', comoLer: 'Ranking por litros/receita, mapa (verde acima, vermelho abaixo) e insights comparando os postos.' },
          { n: 4, title: 'Metas e Previsão', exemplo: 'Meta R$ 2,1M · atingido 96% · previsão R$ 6,8M (+5%)', comoLer: 'Metas a 110% da média da rede e previsão de fechamento pela tendência (precisa de ≥2 dias).' },
        ],
      },
      radar: {
        tela: 'Inteligência · Radar de Preços',
        intro: 'Inteligência de precificação por combustível: preço, custo, margem, elasticidade e risco de baixar o preço. Números fictícios.',
        sections: [
          { n: 1, title: 'Veredito de viabilidade', exemplo: 'Gasolina · Estratégia viável · score 72/100', comoLer: 'O score combina saúde da margem, elasticidade, momentum e resposta a cortes — diz se dá pra competir no preço.' },
          { n: 2, title: 'Cards executivos (por litro)', exemplo: 'Preço R$ 5,89/L · L.B./L R$ 0,52 (9%) · Custo R$ 5,37/L · 8.200 L/dia', comoLer: 'Preço, lucro/litro, custo e volume médios, com variação vs a semana anterior. Cor pela saúde da margem.' },
          { n: 3, title: 'Simulador de corte + cenários', exemplo: 'Corte −R$ 0,10/L · volume p/ empatar +24% · lucro R$ 198K vs R$ 215K', comoLer: 'Arraste o slider pra projetar o fechamento com o corte. Compara sem alteração × com corte × com elasticidade.' },
          { n: 4, title: 'Elasticidade e alertas', exemplo: '−R$ 0,10 ≈ +6% volume · alerta: custo +3% em 7 dias', comoLer: 'A curva mostra o volume que cada corte exige pra empatar; os alertas avisam sobre margem no piso e custo subindo.' },
        ],
      },
      assistente: {
        tela: 'Inteligência · Cadu IA',
        intro: 'Cadu é o copiloto de IA: pergunte em português e ele responde com os dados dos postos que você pode ver. Exemplos fictícios.',
        sections: [
          { n: 1, title: 'Status e escopo', exemplo: 'Cadu · Beta · Ativo · rede Exemplo', comoLer: 'O selo mostra se está habilitado. Ele só acessa os postos liberados pro seu usuário; config é do administrador.' },
          { n: 2, title: 'Chat', exemplo: '"Qual posto teve a maior margem?" → "Posto Centro, 11%."', comoLer: 'Pergunte em linguagem natural sobre faturamento, margem, volume e comparativos — sem montar filtro.' },
          { n: 3, title: 'Histórico e Dashboard IA', exemplo: '12 perguntas · gráfico "Faturamento por posto - 7 dias"', comoLer: 'O Histórico guarda as perguntas (clique pra reabrir); o Dashboard IA monta gráficos sob demanda.' },
          { n: 4, title: 'Monitor', exemplo: '3 consultas executadas · resposta 2,4 s', comoLer: 'Auditoria das ações do Cadu — quais consultas ele rodou pra montar a resposta. Útil pra conferir a origem.' },
        ],
      },
    },
  },
}

const ComoFuncionaButton = () => {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const routeHelp = HELP_CONTENT[pathname]
  const tabKey = searchParams.get('tab') ?? routeHelp?.defaultTab ?? ''
  const content = routeHelp?.tabs[tabKey]
  if (!content) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Como funciona esta tela"
        title="Como funciona esta tela"
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:border-blue-300 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Como funciona?</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          {/* Cabeçalho */}
          <div className="flex items-start gap-3 border-b border-gray-100 px-6 pb-4 pt-6 dark:border-gray-800">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-sm">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-gray-900 dark:text-gray-100">
                Como funciona: {content.tela}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {content.intro}
              </DialogDescription>
            </div>
          </div>

          {/* Seções */}
          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
            {content.sections.map((s) => (
              <div key={s.n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-[11px] font-bold text-white">
                  {s.n}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.title}</p>
                  <p className="mt-1 rounded-md bg-gray-50 px-2.5 py-1.5 font-mono text-[11px] tabular-nums text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                    {s.exemplo}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{s.comoLer}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">Valores ilustrativos — não refletem dados reais.</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:bg-[#1e3a5f]/90 active:scale-95"
            >
              Entendi
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ComoFuncionaButton
