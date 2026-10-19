import {
  BarChart3, Warehouse, DollarSign, Brain, Fuel,
  ShieldAlert, TrendingUp, Radio, Building2, ClipboardList, ShoppingCart, Settings } from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: typeof BarChart3
  /** Quando true, item só aparece pro gerente (is_master). */
  masterOnly?: boolean
  /** Módulo Gestão (tarefas): só aparece quando a rede tem `gestao_habilitado`. */
  requerGestao?: boolean
  /** Módulo Compras: só aparece quando a rede tem `compras_habilitado`. */
  requerCompras?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    title: 'Geral',
    items: [
      { label: 'Central da Rede', path: '/dashboard', icon: BarChart3 },
      { label: 'Ao Vivo', path: '/ao-vivo', icon: Radio },
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
      { label: 'Operação', path: '/operacao', icon: Fuel },
      { label: 'Produtividade', path: '/produtividade', icon: BarChart3 },
    ],
  },
  {
    title: 'Gestão',
    items: [
      // Gestão de tarefas (Painel / Tarefas / Rotinas como abas) — só em redes com o módulo ligado; primeiro do grupo.
      { label: 'Tarefas', path: '/gestao', icon: ClipboardList, requerGestao: true },
      // Compras (pedidos com liberação) — só em redes com o módulo ligado.
      { label: 'Compras', path: '/compras', icon: ShoppingCart, requerCompras: true },
      { label: 'Estoques', path: '/estoques', icon: Warehouse },
      { label: 'Financeiro', path: '/financeiro', icon: DollarSign },
      { label: 'Qualidade de Dados', path: '/qualidade-dados', icon: ShieldAlert },
    ],
  },
  {
    // Sistema fecha o menu: os cadastros (postos e pessoas), que são consulta,
    // e "Configuração" = o painel do sistema (/painel: selecionar rede,
    // cadastros, redes, comercial, acesso, parâmetros).
    title: 'Sistema',
    items: [
      { label: 'Rede', path: '/rede', icon: Building2 },
      { label: 'Configuração', path: '/painel', icon: Settings, masterOnly: true },
    ],
  },
]

export const navItems = navGroups.flatMap((g) => g.items)
