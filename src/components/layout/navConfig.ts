import {
  BarChart3, Warehouse, DollarSign, Brain, Gauge, Wallet, Receipt,
  Network, LineChart, ShieldAlert, UsersRound,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: typeof BarChart3
  /** Quando true, item só aparece pro gerente (is_master). */
  masterOnly?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: 'Sistema',
    items: [
      { label: 'Selecionar Rede', path: '/selecionar-rede', icon: Network, masterOnly: true },
    ],
  },
  {
    title: 'Geral',
    items: [
      { label: 'Fechamentos', path: '/fechamento-caixa', icon: Receipt },
      { label: 'Central da Rede', path: '/dashboard', icon: BarChart3 },
    ],
  },
  {
    title: 'Posto',
    items: [
      { label: 'Vendas', path: '/comercial/vendas', icon: LineChart },
      { label: 'Bombas', path: '/bombas', icon: Gauge },
      { label: 'Caixas & Turnos', path: '/caixas-turnos', icon: Wallet },
      { label: 'Produtividade', path: '/produtividade', icon: BarChart3 },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { label: 'Estoques', path: '/estoques', icon: Warehouse },
      { label: 'Financeiro', path: '/financeiro', icon: DollarSign },
      { label: 'Qualidade de Dados', path: '/qualidade-dados', icon: ShieldAlert },
      { label: 'Pessoas', path: '/pessoas', icon: UsersRound },
    ],
  },
  {
    title: 'Análise',
    items: [
      { label: 'Inteligência', path: '/inteligencia', icon: Brain },
    ],
  },
]

export const navItems = navGroups.flatMap((g) => g.items)
