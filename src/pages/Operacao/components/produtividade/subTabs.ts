import { LayoutDashboard, TrendingUp, Target, Award } from 'lucide-react'

/** Sub-abas do módulo Produtividade — compartilhadas entre o parent (TopBar) e
 * o ProdutividadeTab (conteúdo). Em arquivo próprio pra não quebrar o fast
 * refresh nem forçar o bundle do ProdutividadeTab no parent. */
export type SubTab = 'visao' | 'projecoes' | 'metas' | 'destaques'

export const subTabs: { key: SubTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'visao', label: 'Visão Geral', icon: LayoutDashboard },
  { key: 'projecoes', label: 'Projeções', icon: TrendingUp },
  { key: 'metas', label: 'Metas', icon: Target },
  { key: 'destaques', label: 'Destaques', icon: Award },
]
