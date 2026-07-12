import {
  BarChart3, Warehouse, DollarSign, Brain, Gauge,
  Network, ShieldAlert, UsersRound, TrendingUp, CreditCard,
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
      { label: 'Central da Rede', path: '/dashboard', icon: BarChart3 },
    ],
  },
  {
    title: 'Análise',
    items: [
      { label: 'Comercial', path: '/comercial', icon: TrendingUp },
      { label: 'Inteligência', path: '/inteligencia', icon: Brain },
    ],
  },
  {
    title: 'Posto',
    items: [
      { label: 'Operação', path: '/operacao', icon: Gauge },
      { label: 'Produtividade', path: '/produtividade', icon: BarChart3 },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { label: 'Estoques', path: '/estoques', icon: Warehouse },
      { label: 'Financeiro', path: '/financeiro', icon: DollarSign },
      { label: 'Cartões', path: '/cartoes', icon: CreditCard },
      { label: 'Qualidade de Dados', path: '/qualidade-dados', icon: ShieldAlert },
      { label: 'Pessoas', path: '/pessoas', icon: UsersRound },
    ],
  },
]

export const navItems = navGroups.flatMap((g) => g.items)
