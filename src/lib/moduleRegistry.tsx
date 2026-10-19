import type { LucideIcon } from 'lucide-react'
import { Brain, Building2, CreditCard, Gauge, LayoutDashboard, Radio, SearchCheck, ShieldCheck, Stethoscope, TrendingUp, Users, Wallet, Warehouse } from 'lucide-react'
import { moduleByPath } from '@/lib/appStructure'

/**
 * Identidade de cada módulo por rota (ícone + nome + subtítulo, exibidos no
 * Header). O antigo conteúdo do "Potencial desta tela" saiu (18/10/2026): a
 * explicação agora vive na dica com personagem de cada modal.
 */
export interface ModuleMeta {
  Icon: LucideIcon
  nome: string
  subtitle: string
}

export const REGISTRY: Record<string, ModuleMeta> = {
  '/cartoes': { Icon: CreditCard, nome: 'Cartões · Conciliação', subtitle: 'sistema × repasse do adquirente' },
  '/dashboard': { Icon: LayoutDashboard, nome: 'Central da Rede', subtitle: 'panorama consolidado dos postos' },
  '/diagnostico': { Icon: Stethoscope, nome: 'Diagnóstico do posto', subtitle: 'um ano contra o anterior, com os achados' },
  '/ao-vivo': { Icon: Radio, nome: 'Ao Vivo Rede', subtitle: 'turnos abertos e faturamento de hoje' },
  '/rede': { Icon: Building2, nome: 'Rede', subtitle: 'todos os postos da rede: dados, endereço e mapa' },
  '/comercial': { Icon: TrendingUp, nome: 'Comercial', subtitle: 'inteligência de preço, margem e concorrência' },
  '/operacao': { Icon: Gauge, nome: 'Operação', subtitle: 'tanques, manutenção e aferições' },
  '/financeiro': { Icon: Wallet, nome: 'Financeiro', subtitle: 'títulos a receber e a pagar' },
  '/estoques': { Icon: Warehouse, nome: 'Estoques', subtitle: 'saldo, giro e necessidade de compra' },
  '/produtividade': { Icon: Users, nome: 'Produtividade', subtitle: 'desempenho de frentistas e vendedores' },
  '/qualidade-dados': { Icon: SearchCheck, nome: 'Qualidade de Dados', subtitle: 'inconsistências e sinais de fraude' },
  '/inteligencia': { Icon: Brain, nome: 'Inteligência', subtitle: 'o analista de IA da rede' },
  '/compliance': { Icon: ShieldCheck, nome: 'Compliance ANP', subtitle: 'margem regulatória (placa − CMP)' },
}

/** Meta do módulo pela rota (pathname exato), ou null se a tela não tem chrome. */
export const moduleFor = (pathname: string): ModuleMeta | null => REGISTRY[pathname] ?? null

/** Abas do módulo (a 1ª = default, sem `?tab=`), pela estrutura oficial do app. */
export const abasFor = (pathname: string): { tab: string; label: string }[] =>
  (moduleByPath(pathname)?.tabs ?? [])
    .filter((t) => !t.defaultHidden)
    .map((t, i) => ({ tab: i === 0 ? '' : t.id, label: t.label }))
