import { LayoutDashboard, Target, ShieldCheck, Building2, type LucideIcon } from 'lucide-react'

/**
 * Registro dos apps da suíte CCI — alimenta o launcher (botão de grade no
 * Header, estilo Google). Pra adicionar um app novo, basta uma entrada aqui.
 *
 * Fase atual = SÓ launcher (sem SSO): cada app mantém o próprio login; como o
 * Supabase persiste a sessão no navegador, o usuário digita a senha uma vez por
 * app/aparelho e depois o clique já abre logado. SSO real (identidade única +
 * cookie em cci.app.br) fica pra uma fase seguinte, sem mudar este registro.
 */
export interface CciApp {
  id: string
  nome: string
  descricao: string
  url: string
  /** Ícone Lucide dentro de um quadrado com gradiente (`tile`)… */
  Icon?: LucideIcon
  /** …ou uma imagem da marca (tem prioridade sobre Icon). */
  img?: string
  /** Gradiente do tile (classes Tailwind) — usado com Icon. */
  tile?: string
  /** Rótulo opcional ("Em breve") — tile desabilitado. */
  badge?: string
  /** 'master' = só dono/diretores veem o tile (ex.: portal interno). Default: todos. */
  visivelPara?: 'master' | 'todos'
  /** É um PWA instalável → o launcher mostra "instalar" (abre o app com ?instalar=1). */
  pwa?: boolean
}

/** URL que abre o app já pedindo instalação (o app-alvo trata `?instalar=1`). */
export const installUrlDe = (app: CciApp): string =>
  `${app.url}${app.url.includes('?') ? '&' : '?'}instalar=1`

/** Id do app em que este código roda (o tile fica marcado como "você está aqui"). */
export const APP_ATUAL_ID = 'visor360'

export const CCI_APPS: CciApp[] = [
  {
    // Primeiro, como a "Conta" do Google: o site/seletor de portais da CCI.
    id: 'cci',
    nome: 'CCI',
    descricao: 'CCI Consultoria — selecione o portal',
    url: 'https://www.cci.app.br/',
    img: '/landing/SIMBOLO.png',
  },
  {
    id: 'visor360',
    nome: 'Visor360',
    descricao: 'Gestão da rede de postos',
    url: 'https://visor360.cci.app.br/',
    pwa: true,
    Icon: LayoutDashboard,
    tile: 'from-[#1e3a5f] to-[#2563eb]',
  },
  {
    id: 'prospeccao360',
    nome: 'Prospecção360',
    descricao: 'Funil e carteira de prospecção',
    url: 'https://prospeccao360.cci.app.br/login',
    pwa: true,
    Icon: Target,
    tile: 'from-[#0F766E] to-[#14b8a6]',
  },
  {
    id: 'portal-cliente',
    nome: 'Portal do Cliente',
    descricao: 'Relatórios, DRE, fluxo de caixa, serviços BPO, documentos e financeiro',
    url: 'https://www.cci.app.br/cliente/login',
    Icon: Building2,
    tile: 'from-[#f59e0b] to-[#FCB619]',
  },
  {
    id: 'portal-admin',
    nome: 'Portal Admin',
    descricao: 'Financeiro, clientes, notas fiscais, boletos e parametrizações do escritório',
    url: 'https://www.cci.app.br/admin/dashboard',
    Icon: ShieldCheck,
    tile: 'from-[#0b5c55] to-[#0F766E]',
    visivelPara: 'master',
  },
]
