import type { ComponentType, ReactNode } from 'react'
import {
  CreditCard, LayoutDashboard, Eye, HandCoins, Calculator, Filter, ListChecks,
  ShieldCheck, CalendarClock, AlertTriangle, Droplets, Wrench, Store, Tag, Radio, Layers,
  TrendingUp, Gauge, Sparkles, BarChart3, Trophy, Building2, Radar, Wallet, Warehouse,
  Users, SearchCheck, Target,
  type LucideIcon,
} from 'lucide-react'
import { IlRede, IlProjecao, IlConfianca, IlFiscal } from '@/components/potencial/ilustracoes'

/**
 * Registro ÚNICO por rota do "chrome" de módulo: identidade (ícone + nome +
 * subtítulo, exibidos no Header) e o conteúdo do modal "Potencial desta tela"
 * por aba (`?tab=`; '' = aba default). Cobrir uma tela = adicionar uma entrada
 * aqui — nada de editar layout página por página.
 */

/* ─── Helpers de conteúdo do modal ─── */

const Secao = ({ icon: Icon, titulo, children }: { icon: LucideIcon; titulo: string; children: ReactNode }) => (
  <div className="flex gap-3">
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[#1e3a5f] dark:bg-gray-800 dark:text-gray-300">
      <Icon className="h-4 w-4" />
    </span>
    <div>
      <p className="font-semibold text-gray-900 dark:text-gray-100">{titulo}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  </div>
)

const NotaHonesta = ({ children }: { children: ReactNode }) => (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
    <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <span>{children}</span>
    </p>
  </div>
)

/* ─── Tipos ─── */

/** Slide do carrossel de "Potencial" (quando a tela opta pelo formato paginado
 * ilustrado em vez do `body` rolável). */
export interface PotencialSlide {
  /** Ilustração flat 2-tons (SVG inline theme-aware). */
  Ilustracao: ComponentType<{ className?: string }>
  /** Etiqueta curta acima do título ("O que ela faz", "Projeção"…). */
  tag: string
  titulo: string
  texto: ReactNode
  /** 'nota' pinta o slide como aviso honesto (âmbar). */
  tom?: 'normal' | 'nota'
}

export interface PotencialConteudo {
  title: string
  description: string
  /** Conteúdo rolável clássico (fallback das telas ainda não migradas). */
  body: ReactNode
  /** Quando presente, o botão renderiza o CARROSSEL paginado em vez do `body`. */
  slides?: PotencialSlide[]
}

export interface ModuleMeta {
  Icon: LucideIcon
  nome: string
  subtitle: string
  /** Conteúdo do "Potencial" por aba (`?tab=`); '' = aba default. */
  potencial: Record<string, PotencialConteudo>
}

/* ─── Registro ─── */

export const REGISTRY: Record<string, ModuleMeta> = {
  '/cartoes': {
    Icon: CreditCard,
    nome: 'Cartões · Conciliação',
    subtitle: 'sistema × repasse do adquirente',
    potencial: {
      '': {
        title: 'Resultado — o potencial desta tela',
        description: 'Em segundos, se todo o dinheiro de cartão do período caiu — sem cruzar planilha.',
        body: (
          <>
            <Secao icon={Eye} titulo="O que ela faz">
              Cruza, por <strong>posto × bandeira × dia de liquidação</strong>, o recebível do sistema com o repasse real do adquirente (EDI). Classifica cada lote: <strong>Conciliado</strong>, <strong>A creditar</strong> (casou, crédito ainda futuro), <strong>Sem repasse</strong> (precisa lançamento) e <strong>Aguardando</strong> (EDI ainda não chegou).
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Substitui horas de conferência manual: o card mostra <strong>% conciliável</strong> e a <strong>cobertura do EDI</strong>. O que não bateu já vira lista de ação no Detalhamento.
            </Secao>
            <Secao icon={ShieldCheck} titulo="Vinculado × Conciliado">
              Espelha o WebPosto: <strong>vinculado</strong> = o repasse casou; <strong>conciliado</strong> (nosso) = casou <em>e</em> o bom-para (dia do crédito) já passou. Enquanto o crédito é futuro, fica “a creditar”.
            </Secao>
            <NotaHonesta>
              A conciliação é por <strong>valor</strong> (Σ sistema × Σ repasse por bandeira/dia). Diferença de centavos aparece como <strong>“valor divergente”</strong>; ela não inventa divergência onde o dinheiro fecha.
            </NotaHonesta>
          </>
        ),
      },
      detalhamento: {
        title: 'Detalhamento — o potencial desta tela',
        description: 'A lista acionável: o que precisa de lançamento e o que divergiu, com responsável.',
        body: (
          <>
            <Secao icon={ListChecks} titulo="O que ela faz">
              Abre o vermelho do Resultado em tarefas: cada venda <strong>sem repasse</strong> (quem, quanto, qual venda, qual vendedor) e cada <strong>divergência de lote</strong> (bandeira/dia com valor diferente).
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Transforma “faltou dinheiro” em ação concreta — dá pra lançar o recebível certo ou cobrar o adquirente com o número na mão, sem caçar em planilha.
            </Secao>
            <Secao icon={ShieldCheck} titulo="Marcar como tratado">
              Registra que você já resolveu (com quem e quando) e some das pendências — <strong>sem alterar nenhum valor</strong>. Se o repasse chegar depois, o automático prevalece e marca “repasse chegou depois”.
            </Secao>
            <NotaHonesta>
              Nada é escrito na Quality/WebPosto — o “tratado” fica só no Visor360, como controle interno da sua equipe.
            </NotaHonesta>
          </>
        ),
      },
      taxas: {
        title: 'Detector de taxa — o potencial desta tela',
        description: 'Por que esta tela existe, o que ela encontra e como transformar isso em dinheiro de volta no caixa.',
        body: (
          <>
            <Secao icon={Eye} titulo="O que ela faz">
              Compara, por bandeira, a <strong>taxa que o adquirente realmente descontou</strong> (o repasse do EDI) com a <strong>taxa do seu contrato</strong> (cadastro do posto). Onde a efetiva passa do contrato, mostra em <span className="font-semibold text-red-600 dark:text-red-400">R$</span> exatamente quanto você pagou a mais.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa (o potencial)">
              Adquirente cobra em <em>centavos por transação</em> — e centavo em cima de milhões repassados vira <strong>milhares por mês</strong>. Num único posto, num mês, este cruzamento já apontou <strong className="text-gray-900 dark:text-gray-100">~R$ 900 a mais só no crédito</strong>. Numa rede, no ano, é uma renegociação inteira embasada em número.
            </Secao>
            <Secao icon={Calculator} titulo="Como é calculado">
              <span className="block">• <strong>Efetiva</strong> = Σ despesas do repasse ÷ Σ bruto repassado (vem do EDI, é o real).</span>
              <span className="block">• <strong>Contrato</strong> = percentual de comissão do cadastro + tarifa fixa por transação.</span>
              <span className="block">• <strong>Δ</strong> = o que foi pago − o que o contrato previa. Tudo read-only.</span>
            </Secao>
            <Secao icon={Filter} titulo="Como usar">
              Filtre por <strong>Débito</strong> (onde o Δ é definitivo) ou ligue <strong>“Só acima do contrato”</strong> pra ver direto o que sangra. Ordena da maior sobrecobrança pra menor — o topo é onde está o dinheiro.
            </Secao>
            <NotaHonesta>
              No <strong>crédito</strong>, um Δ positivo pode ser antecipação/parcelamento (taxa naturalmente maior) — confirme no extrato da bandeira antes de acionar o adquirente. No <strong>débito</strong>, o Δ é praticamente à prova de dúvida.
            </NotaHonesta>
          </>
        ),
      },
      parametros: {
        title: 'Parâmetros — o potencial desta tela',
        description: 'A cobertura do EDI por posto — pra você confiar no que é pendência de verdade.',
        body: (
          <>
            <Secao icon={CalendarClock} titulo="O que ela faz">
              Mostra, por posto, até que dia o repasse do adquirente (EDI) já foi carregado. É o “relógio” da conciliação.
            </Secao>
            <Secao icon={ShieldCheck} titulo="Por que importa">
              Evita <strong>falso “sem repasse”</strong>: um dia sem EDI ainda é <em>aguardando</em>, não pendência. Aqui você enxerga qual posto está atrasado no carregamento antes de sair cobrando lançamento à toa.
            </Secao>
            <Secao icon={Filter} titulo="Como usar">
              Clique num posto pra abrir o Resultado dele já filtrado — do panorama da rede pro detalhe do posto em um clique.
            </Secao>
          </>
        ),
      },
    },
  },

  '/dashboard': {
    Icon: LayoutDashboard,
    nome: 'Central da Rede',
    subtitle: 'panorama consolidado dos postos',
    potencial: {
      '': {
        title: 'Visão Geral',
        description: 'O potencial desta tela',
        slides: [
          {
            Ilustracao: IlRede,
            tag: 'O que ela faz',
            titulo: 'O raio-x da rede num relance',
            texto: (
              <>
                Junta <strong>todos os postos</strong> por setor — Combustível, Automotivos e Conveniência — mostrando faturamento, lucro bruto e margem em um só painel.
              </>
            ),
          },
          {
            Ilustracao: IlProjecao,
            tag: 'Projeção',
            titulo: 'Onde o mês vai fechar',
            texto: (
              <>
                Projeta o <strong>fechamento do mês</strong> pela engine executiva: ritmo recente + sazonalidade de dia-da-semana + tendência. Você reage antes do fim do mês.
              </>
            ),
          },
          {
            Ilustracao: IlConfianca,
            tag: 'Como ler',
            titulo: 'O quanto confiar no número',
            texto: (
              <>
                A <strong>bolinha de confiança</strong> e o <strong>comparativo</strong> (vs mês/ano anterior) dizem o quanto crer na projeção. Cada card de setor abre o detalhe por posto.
              </>
            ),
          },
          {
            Ilustracao: IlFiscal,
            tom: 'nota',
            tag: 'De onde vêm os números',
            titulo: 'Base fiscal, projeção é estimativa',
            texto: (
              <>
                Os valores vêm do <strong>cache de apuração</strong> (base fiscal carimbada). A projeção é uma estimativa pelo ritmo — <strong>não</strong> o valor fechado do mês.
              </>
            ),
          },
        ],
        body: (
          <>
            <Secao icon={Layers} titulo="O que ela faz">
              Consolida <strong>todos os postos</strong> por setor (Combustível, Automotivos, Conveniência) — faturamento, lucro bruto e margem — e projeta o <strong>fechamento do mês</strong> com a engine executiva (média recente + sazonalidade + tendência).
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              É o painel do dono: em um relance você sabe se a rede está no ritmo da meta, qual setor puxa e qual segura, e quanto deve fechar — sem abrir posto por posto.
            </Secao>
            <Secao icon={ShieldCheck} titulo="Como ler">
              A bolinha de <strong>confiança</strong> e o <strong>comparativo</strong> (vs mês/ano anterior) dizem o quanto confiar na projeção. Cada card de setor abre o detalhe por posto.
            </Secao>
            <NotaHonesta>
              Os números vêm do cache de apuração (base fiscal carimbada). Projeção é estimativa pelo ritmo recente — não é o valor fechado.
            </NotaHonesta>
          </>
        ),
      },
      combustivel: {
        title: 'Combustível — o potencial desta tela',
        description: 'A venda de combustível da rede em base fiscal, com projeção e L.B. por litro.',
        body: (
          <>
            <Secao icon={Droplets} titulo="O que ela faz">
              Litros, faturamento, lucro bruto e <strong>L.B. por litro</strong> do combustível, em base fiscal (bate com o “litros vendidos”), com análise por dia e por combustível.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Combustível é volume alto e margem fina: enxergar o L.B./litro e a tendência semanal é onde se defende (ou se perde) o resultado do mês.
            </Secao>
            <Secao icon={Calculator} titulo="Como usar">
              Use a <strong>projeção executiva</strong> pra saber onde fecha e o <strong>ritmo necessário</strong> pra manter — e as abas de análise pra ver o padrão dia útil × fim de semana.
            </Secao>
          </>
        ),
      },
      pista: {
        title: 'Automotivos — o potencial desta tela',
        description: 'Os produtos de pista/automotivos da rede — margem melhor que a do combustível.',
        body: (
          <>
            <Secao icon={Wrench} titulo="O que ela faz">
              Venda, lucro e margem dos produtos automotivos (óleos, aditivos, filtros) por posto, com projeção de fechamento.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              É o setor de <strong>margem alta</strong>: cada real vendido aqui vale muito mais em lucro que no combustível. Ver quem vende bem revela oportunidade de treinar a pista.
            </Secao>
          </>
        ),
      },
      conveniencia: {
        title: 'Conveniência — o potencial desta tela',
        description: 'A loja de conveniência da rede: ticket, mix e margem.',
        body: (
          <>
            <Secao icon={Store} titulo="O que ela faz">
              Faturamento, margem e ticket médio da conveniência por posto, com projeção e o mix de produtos que puxam o resultado.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              A conveniência é onde o cliente do combustível vira <strong>lucro adicional</strong>. Ticket e mix mostram se a loja está aproveitando o fluxo da pista.
            </Secao>
          </>
        ),
      },
      precos: {
        title: 'Gestão de Preços — o potencial desta tela',
        description: 'Quanto de margem foi cedida na bomba e em acréscimos/descontos — o vazamento invisível.',
        body: (
          <>
            <Secao icon={Tag} titulo="O que ela faz">
              Cruza o <strong>preço de tabela</strong> com o <strong>praticado na bomba</strong> (o ajuste abaixo da tabela = margem cedida) e soma os acréscimos e descontos das vendas.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Desconto na bomba não aparece no faturamento — some da margem silenciosamente. Aqui ele fica visível em R$, por produto e por posto: é dinheiro que dá pra recuperar ajustando política de preço.
            </Secao>
            <NotaHonesta>
              A cobertura mostra quantos abastecimentos têm preço de tabela — os sem cadastro ficam de fora. O número é parcial até o cron carimbar o preço no cache.
            </NotaHonesta>
          </>
        ),
      },
    },
  },

  '/ao-vivo': {
    Icon: Radio,
    nome: 'Ao Vivo Rede',
    subtitle: 'turnos abertos e faturamento de hoje',
    potencial: {
      '': {
        title: 'Ao Vivo Rede — o potencial desta tela',
        description: 'O agora da rede: turnos abertos e faturamento de hoje, sem esperar o fechamento.',
        body: (
          <>
            <Secao icon={Radio} titulo="O que ela faz">
              Mostra a operação <strong>acontecendo agora</strong> — turnos abertos e o faturamento fiscal de hoje, posto a posto.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Pra agir no calor: identificar um turno parado, um posto fora da curva ou um pico de venda enquanto ainda dá pra reagir — não no relatório do dia seguinte.
            </Secao>
            <NotaHonesta>
              É “ao vivo”: sem filtros — a tela é sempre o agora (hoje, rede inteira) e se atualiza sozinha a cada 60s.
            </NotaHonesta>
          </>
        ),
      },
    },
  },

  '/comercial': {
    Icon: TrendingUp,
    nome: 'Comercial',
    subtitle: 'inteligência de preço, margem e concorrência',
    potencial: {
      '': {
        title: 'Oportunidades — o potencial desta tela',
        description: 'A lista curta do que fazer pra ganhar margem, priorizada por impacto.',
        body: (
          <>
            <Secao icon={Sparkles} titulo="O que ela faz">
              Varre a rede e prioriza <strong>oportunidades de lucro</strong> — produtos e postos onde ajustar preço ou mix rende mais, ordenadas pelo impacto.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Em vez de encarar mil números, você recebe <strong>o que atacar primeiro</strong> — foco no que move o resultado.
            </Secao>
            <Secao icon={Filter} titulo="Como usar">
              Comece pelo topo (maior impacto) e desça. Cada item explica o porquê e quanto vale.
            </Secao>
          </>
        ),
      },
      margem: {
        title: 'Margem por posto — o potencial desta tela',
        description: 'O ranking de lucratividade: quem puxa e quem segura a rede.',
        body: (
          <>
            <Secao icon={Trophy} titulo="O que ela faz">
              Ordena os postos por <strong>lucratividade</strong> (margem e lucro bruto) — líder e lanterna num relance.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Revela onde replicar o que dá certo e onde agir: um posto abaixo da rede é margem deixada na mesa.
            </Secao>
          </>
        ),
      },
      concorrencia: {
        title: 'Concorrência — o potencial desta tela',
        description: 'O preço da praça: onde você está caro ou barato demais.',
        body: (
          <>
            <Secao icon={Building2} titulo="O que ela faz">
              Reúne a <strong>inteligência de preço da praça</strong> — como seus preços se comparam aos concorrentes, por produto e região.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Preço fora da praça custa volume (caro demais) ou margem (barato demais). Aqui você calibra com dado, não achismo.
            </Secao>
          </>
        ),
      },
      radar: {
        title: 'Radar de Preços — o potencial desta tela',
        description: 'Guerra de preço com margem, elasticidade e simulação até o fechamento.',
        body: (
          <>
            <Secao icon={Radar} titulo="O que ela faz">
              Simula movimentos de preço e mostra o efeito em <strong>margem, volume (elasticidade) e resultado</strong> projetado até o fim do mês.
            </Secao>
            <Secao icon={Calculator} titulo="Como usar">
              Teste um corte ou aumento e veja o trade-off antes de aplicar — decide a guerra de preço com número na mão.
            </Secao>
            <NotaHonesta>
              A elasticidade é estimada pelo histórico — bússola de decisão, não garantia de volume.
            </NotaHonesta>
          </>
        ),
      },
    },
  },

  '/operacao': {
    Icon: Gauge,
    nome: 'Operação',
    subtitle: 'bombas e reabastecimento',
    potencial: {
      '': {
        title: 'Bombas — o potencial desta tela',
        description: 'O desempenho das bombas por posto — volume e a manutenção que se paga sozinha.',
        body: (
          <>
            <Secao icon={Gauge} titulo="O que ela faz">
              Acompanha o <strong>volume por bomba/bico</strong> e sinaliza <strong>manutenção</strong> automaticamente — sem depender de marcação manual.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Bomba fora de calibração é perda invisível de litro (e de margem). Ver o desempenho por bico revela o desgaste antes de virar prejuízo.
            </Secao>
          </>
        ),
      },
      reabastecimento: {
        title: 'Reabastecimento — o potencial desta tela',
        description: 'Quando e quanto repor por setor, pelo giro e pela cobertura.',
        body: (
          <>
            <Secao icon={Droplets} titulo="O que ela faz">
              Mostra <strong>giro e cobertura</strong> por setor (combustível, automotivos, conveniência) pra orientar a reposição — o que está acabando e o que está sobrando.
            </Secao>
            <Secao icon={ShieldCheck} titulo="Por que importa">
              Evita ruptura (venda perdida) e capital parado (estoque encalhado) — o equilíbrio que protege caixa e faturamento.
            </Secao>
          </>
        ),
      },
    },
  },

  '/financeiro': {
    Icon: Wallet,
    nome: 'Financeiro',
    subtitle: 'títulos a receber e a pagar',
    potencial: {
      '': {
        title: 'Visão Geral — o potencial desta tela',
        description: 'O dinheiro que já era pra ter entrado ou saído: os títulos em atraso.',
        body: (
          <>
            <Secao icon={Eye} titulo="O que ela faz">
              Reúne os <strong>títulos a receber e a pagar em atraso</strong> — o que venceu e ainda não foi liquidado, dos dois lados.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              É caixa imediato: cobrar um recebível vencido e quitar um pagável antes do juro são as ações de maior retorno no financeiro.
            </Secao>
            <NotaHonesta>
              A integração expõe títulos e movimento de conta por GET; cartão a vencer, PREMMIA e cheque não vêm pela API — por isso o foco aqui é o <strong>atraso</strong>.
            </NotaHonesta>
          </>
        ),
      },
      receber: {
        title: 'A Receber — o potencial desta tela',
        description: 'O que os clientes/adquirentes ainda devem, com o vencido em destaque.',
        body: (
          <>
            <Secao icon={ListChecks} titulo="O que ela faz">
              Lista os títulos a receber, com os <strong>vencidos</strong> destacados — quem deve, quanto e desde quando.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Prioriza a cobrança pelo mais antigo e maior — dinheiro seu que está fora do caixa é o primeiro a perseguir.
            </Secao>
          </>
        ),
      },
      pagar: {
        title: 'A Pagar — o potencial desta tela',
        description: 'Os compromissos e o que está vencido — pra não pagar juro à toa.',
        body: (
          <>
            <Secao icon={ListChecks} titulo="O que ela faz">
              Lista os títulos a pagar, com os <strong>vencidos</strong> em destaque — fornecedores, tributos e demais compromissos.
            </Secao>
            <Secao icon={ShieldCheck} titulo="Por que importa">
              Evita multa e juro por atraso e ajuda a planejar o caixa: você paga na ordem certa, não no susto.
            </Secao>
          </>
        ),
      },
      cartoes: {
        title: 'Cartões — o potencial desta tela',
        description: 'Os recebíveis de cartão pelo lado financeiro: a vencer e liquidados.',
        body: (
          <>
            <Secao icon={CreditCard} titulo="O que ela faz">
              Acompanha os <strong>recebíveis de cartão</strong> — o que está a vencer, em atraso e já liquidado pelo adquirente.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              É a previsão do que ainda vai cair de cartão. Para a conciliação transação-a-transação, use o módulo <strong>Cartões</strong>.
            </Secao>
          </>
        ),
      },
      agenda: {
        title: 'Agenda — o potencial desta tela',
        description: 'O calendário de vencimentos: o fluxo de caixa dos próximos dias num relance.',
        body: (
          <>
            <Secao icon={CalendarClock} titulo="O que ela faz">
              Distribui receber e pagar no <strong>calendário</strong>, por dia de vencimento — o mapa do que entra e sai.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Antecipa apertos de caixa: você vê o dia que aperta antes dele chegar e negocia/adianta a tempo.
            </Secao>
          </>
        ),
      },
    },
  },

  '/estoques': {
    Icon: Warehouse,
    nome: 'Estoques',
    subtitle: 'saldo, giro e necessidade de compra',
    potencial: {
      '': {
        title: 'Visão Geral — o potencial desta tela',
        description: 'O panorama do capital parado em estoque e o que está crítico.',
        body: (
          <>
            <Secao icon={Eye} titulo="O que ela faz">
              Panorama do estoque da rede — <strong>valor parado</strong>, itens críticos e cobertura, num só lugar.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Estoque é caixa parado na prateleira: ver o todo evita ao mesmo tempo a ruptura (venda perdida) e o encalhe (dinheiro preso).
            </Secao>
            <NotaHonesta>
              O saldo é sempre o ATUAL (a API não dá histórico por data). O flag “controle de estoque” ainda não vem por GET, então itens de uso e consumo podem aparecer.
            </NotaHonesta>
          </>
        ),
      },
      geral: {
        title: 'Estoque geral — o potencial desta tela',
        description: 'O saldo por produto e posto: onde está o capital parado.',
        body: (
          <>
            <Secao icon={Layers} titulo="O que ela faz">
              Detalha o <strong>saldo por produto e por posto</strong> — quantidade e valor em estoque.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Mostra exatamente onde o dinheiro está imobilizado, pra você atacar o excesso e liberar caixa.
            </Secao>
          </>
        ),
      },
      giro: {
        title: 'Giro — o potencial desta tela',
        description: 'A velocidade com que cada item vende — o pulso do estoque.',
        body: (
          <>
            <Secao icon={Calculator} titulo="O que ela faz">
              Calcula o <strong>giro</strong> por produto — quantas vezes o estoque roda no período.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Giro baixo = dinheiro encalhado (candidato a promoção/corte); giro alto = risco de ruptura (aumentar o mínimo).
            </Secao>
          </>
        ),
      },
      mediaVendas: {
        title: 'Média de venda — o potencial desta tela',
        description: 'A média histórica (6 meses) por produto — a base pra dimensionar a compra.',
        body: (
          <>
            <Secao icon={BarChart3} titulo="O que ela faz">
              Mostra a <strong>média de venda dos últimos 6 meses</strong> por produto — o consumo real, sem o ruído de um mês atípico.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              É o número que sustenta a reposição: comprar pela média certa evita faltar e evita sobrar.
            </Secao>
          </>
        ),
      },
      necessidade: {
        title: 'Necessidade — o potencial desta tela',
        description: 'A lista de compra pronta: o que repor, pelo mínimo e pela cobertura.',
        body: (
          <>
            <Secao icon={ListChecks} titulo="O que ela faz">
              Aponta o que está <strong>abaixo do mínimo/cobertura</strong> e precisa de reposição — a lista de compra já priorizada.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Transforma o estoque em ação: em vez de descobrir a falta na hora da venda, você compra na hora certa, na quantidade certa.
            </Secao>
          </>
        ),
      },
    },
  },

  '/produtividade': {
    Icon: Users,
    nome: 'Produtividade',
    subtitle: 'desempenho de frentistas e vendedores',
    potencial: {
      '': {
        title: 'Visão Geral — o potencial desta tela',
        description: 'O desempenho da equipe num painel: quem produz e quanto.',
        body: (
          <>
            <Secao icon={Users} titulo="O que ela faz">
              Consolida a produtividade da equipe — litros por frentista, vendas por vendedor — filtrável por setor (combustível, conveniência, automotivos).
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Gente é o maior custo variável: ver quem rende (e quem não) mostra onde treinar, reconhecer e dimensionar a escala.
            </Secao>
          </>
        ),
      },
      frentistas: {
        title: 'Frentistas — o potencial desta tela',
        description: 'O ranking da pista: litros e atendimentos por frentista.',
        body: (
          <>
            <Secao icon={Droplets} titulo="O que ela faz">
              Ordena os frentistas por <strong>litros vendidos e atendimentos</strong>, por posto e turno.
            </Secao>
            <Secao icon={Trophy} titulo="Por que importa">
              Revela o topo (pra replicar a técnica) e o fundo (pra treinar) — e sustenta meta e bonificação com número, não com percepção.
            </Secao>
          </>
        ),
      },
      vendedores: {
        title: 'Vendedores — o potencial desta tela',
        description: 'Quem transforma o fluxo da pista em venda de loja.',
        body: (
          <>
            <Secao icon={Store} titulo="O que ela faz">
              Ranqueia os <strong>vendedores da conveniência</strong> por faturamento e itens — quem converte o movimento em loja.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              A conveniência é margem alta: identificar o bom vendedor e a boa prática multiplica o lucro por cliente que já está no posto.
            </Secao>
          </>
        ),
      },
      metas: {
        title: 'Metas — o potencial desta tela',
        description: 'A expectativa vira número: metas por frentista e o acompanhamento.',
        body: (
          <>
            <Secao icon={Target} titulo="O que ela faz">
              Define e acompanha <strong>metas por frentista</strong> — o quanto se espera vs o realizado.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Meta clara alinha a equipe e dá base pra bonificar com justiça — todo mundo sabe o alvo e onde está em relação a ele.
            </Secao>
          </>
        ),
      },
    },
  },

  '/qualidade-dados': {
    Icon: SearchCheck,
    nome: 'Qualidade de Dados',
    subtitle: 'inconsistências e sinais de fraude',
    potencial: {
      '': {
        title: 'Qualidade de Dados — o potencial desta tela',
        description: 'O detetive da rede: acha erro de cadastro e sinal de desvio antes de virar prejuízo.',
        body: (
          <>
            <Secao icon={SearchCheck} titulo="O que ela faz">
              Varre os lançamentos atrás de <strong>inconsistências</strong> — abastecimento sem frentista, litros/valores suspeitos e <strong>cupons “montados”</strong> (vários abastecimentos num cupom).
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              Erro de cadastro contamina todo relatório; e o padrão de cupom montado é a assinatura clássica de desvio no cartão. Pegar cedo protege o número e o caixa.
            </Secao>
            <NotaHonesta>
              A tela aponta o que investigar, não acusa: cada item traz o detalhe (posto, frentista, bomba, valores) pra você confirmar antes de agir.
            </NotaHonesta>
          </>
        ),
      },
    },
  },

  '/pessoas': {
    Icon: Users,
    nome: 'Pessoas',
    subtitle: 'quadro de colaboradores da rede',
    potencial: {
      '': {
        title: 'Pessoas — o potencial desta tela',
        description: 'Quem é quem na rede, por cargo e por posto.',
        body: (
          <>
            <Secao icon={Users} titulo="O que ela faz">
              Organiza o <strong>quadro de colaboradores</strong> por cargo (frentista, gerente, supervisor) e posto, com ativos e inativos.
            </Secao>
            <Secao icon={HandCoins} titulo="Por que importa">
              É a base pra cruzar gente com resultado (Produtividade) e pra saber quem está ativo em cada unidade — sem depender de planilha paralela.
            </Secao>
          </>
        ),
      },
    },
  },
}

/* ─── Resolvers ─── */

export const moduleFor = (pathname: string): ModuleMeta | null => REGISTRY[pathname] ?? null

/** Abas (sub-tabs `?tab=`) de um módulo, derivadas das chaves de `potencial`
 * (a chave É o valor de `?tab=`; '' = aba default). Label = título do potencial
 * sem o sufixo " — o potencial desta tela". Usado no seletor de aba do briefing. */
export const abasFor = (pathname: string): { tab: string; label: string }[] => {
  const m = REGISTRY[pathname]
  if (!m) return []
  return Object.entries(m.potencial).map(([tab, c]) => ({ tab, label: c.title.split('—')[0].trim() }))
}

export const potencialFor = (pathname: string, tab: string | null): PotencialConteudo | null => {
  const m = REGISTRY[pathname]
  if (!m) return null
  return m.potencial[tab ?? ''] ?? m.potencial[''] ?? null
}
