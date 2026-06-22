import { LayoutGrid, Fuel, ShoppingBag, Target } from 'lucide-react'

/** Sub-abas do módulo Produtividade — compartilhadas entre o parent (TopBar) e
 * o conteúdo. Cada aba é um "modo": Visão Geral (rede), Frentistas (combustível),
 * Vendedores (conveniência) e Metas (meta × realizado por frentista). Em arquivo
 * próprio pra não quebrar o fast refresh nem forçar o bundle do conteúdo no parent. */
export type SubTab = 'visao' | 'frentistas' | 'vendedores' | 'metas'

export const subTabs: { key: SubTab; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'visao', label: 'Visão Geral', icon: LayoutGrid },
  { key: 'frentistas', label: 'Frentistas', icon: Fuel },
  { key: 'vendedores', label: 'Vendedores', icon: ShoppingBag },
  { key: 'metas', label: 'Metas', icon: Target },
]
