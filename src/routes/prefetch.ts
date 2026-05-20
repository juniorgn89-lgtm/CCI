/**
 * Prefetch de rotas. Mora num módulo separado pra evitar import circular
 * (routes/index importa Login, e Login precisa do prefetch).
 *
 * `importDashboard` é a MESMA função usada no `lazy()` da rota, então o
 * prefetch e a navegação compartilham o mesmo chunk (sem download dobrado).
 */
export const importDashboard = () => import('@/pages/Dashboard')

/**
 * Baixa as rotas mais prováveis logo após o login. Chamado em idle pela tela
 * de Login enquanto o usuário digita — o /dashboard já fica em cache quando o
 * redirect acontece. Dashboard cascateia o chunk de charts.
 */
export const prefetchPrincipais = () => {
  importDashboard()
}
