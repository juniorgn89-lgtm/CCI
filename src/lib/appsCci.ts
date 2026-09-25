import { LayoutDashboard, Target, type LucideIcon } from 'lucide-react'

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
  Icon: LucideIcon
  /** Gradiente do tile (classes Tailwind). */
  tile: string
  /** Rótulo opcional ("Em breve") — tile desabilitado. */
  badge?: string
}

/** Id do app em que este código roda (o tile fica marcado como "você está aqui"). */
export const APP_ATUAL_ID = 'visor360'

export const CCI_APPS: CciApp[] = [
  {
    id: 'visor360',
    nome: 'Visor360',
    descricao: 'Gestão da rede de postos',
    url: 'https://visor360.cci.app.br/',
    Icon: LayoutDashboard,
    tile: 'from-[#1e3a5f] to-[#2563eb]',
  },
  {
    id: 'prospeccao360',
    nome: 'Prospecção360',
    descricao: 'Funil e carteira de prospecção',
    url: 'https://prospeccao360.cci.app.br/',
    Icon: Target,
    tile: 'from-[#0F766E] to-[#14b8a6]',
  },
]
