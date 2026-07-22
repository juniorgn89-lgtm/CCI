import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import RouteFallback from '@/components/feedback/RouteFallback'
import { importDashboard } from '@/routes/prefetch'
import Login from '@/pages/Login'

const RedefinirSenha = lazy(() => import('@/pages/RedefinirSenha'))

const Dashboard = lazy(importDashboard)
const AoVivo = lazy(() => import('@/pages/AoVivo'))
const Estoques = lazy(() => import('@/pages/Estoques'))
const Financeiro = lazy(() => import('@/pages/Financeiro'))
const QualidadeDados = lazy(() => import('@/pages/QualidadeDados'))
const Inteligencia = lazy(() => import('@/pages/Inteligencia'))
const Operacao = lazy(() => import('@/pages/Operacao'))
const Produtividade = lazy(() => import('@/pages/Produtividade'))
const Comercial = lazy(() => import('@/pages/Comercial'))
const Compliance = lazy(() => import('@/pages/Compliance'))
const Mobile = lazy(() => import('@/pages/Mobile'))
const Configuracoes = lazy(() => import('@/pages/Configuracoes'))
const Pessoas = lazy(() => import('@/pages/Pessoas'))
const AdminFrentistas = lazy(() => import('@/pages/Admin/Frentistas'))
const AdminUsuarios = lazy(() => import('@/pages/Admin/Usuarios'))
const AdminRedes = lazy(() => import('@/pages/Admin/Redes'))
const AdminApuracao = lazy(() => import('@/pages/Admin/Apuracao'))
const AdminAssistente = lazy(() => import('@/pages/Admin/AssistenteConfig'))
// Painel de gestão (master) — shell standalone com navegação entre módulos.
const PainelLayout = lazy(() => import('@/pages/Painel/PainelLayout'))
const PainelSelecionarRede = lazy(() => import('@/pages/Painel/SelecionarRede'))

// Frentista pages
const FreentistaLayout = lazy(() => import('@/pages/Frentista/layout/FreentistaLayout'))
const MeusAbastecimentos = lazy(() => import('@/pages/Frentista/MeusAbastecimentos'))
const MeuRanking = lazy(() => import('@/pages/Frentista/MeuRanking'))
const MinhaConta = lazy(() => import('@/pages/Frentista/MinhaConta'))
const FrentistaAutoLogin = lazy(() => import('@/pages/Frentista/AutoLogin'))

// Gerente mobile pages
const GerenteLayout = lazy(() => import('@/pages/Gerente/layout/GerenteLayout'))
const GerenteInicio = lazy(() => import('@/pages/Gerente/Inicio'))
const GerenteFinanceiro = lazy(() => import('@/pages/Gerente/Financeiro'))
const GerenteFrentistas = lazy(() => import('@/pages/Gerente/Frentistas'))
const GerenteCombustiveis = lazy(() => import('@/pages/Gerente/CombustiveisGerente'))

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<Suspense fallback={<RouteFallback />}><RedefinirSenha /></Suspense>} />
      <Route path="/frentista/auto" element={<Suspense fallback={<RouteFallback />}><FrentistaAutoLogin /></Suspense>} />

      {/* Gerente routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Suspense fallback={<RouteFallback />}><Dashboard /></Suspense>} />
          <Route path="/ao-vivo" element={<Suspense fallback={<RouteFallback />}><AoVivo /></Suspense>} />
          <Route path="/estoques" element={<Suspense fallback={<RouteFallback />}><Estoques /></Suspense>} />
          <Route path="/reabastecimento" element={<Navigate to="/operacao?tab=reabastecimento" replace />} />
          <Route path="/financeiro" element={<Suspense fallback={<RouteFallback />}><Financeiro /></Suspense>} />
          {/* Cartões foi movido pra dentro do Financeiro (aba Cartões). */}
          <Route path="/cartoes" element={<Navigate to="/financeiro?tab=cartoes" replace />} />
          {/* Fechamento de Caixa aposentado do menu — rotas antigas caem no dashboard. */}
          <Route path="/fechamento-caixa" element={<Navigate to="/dashboard" replace />} />
          <Route path="/qualidade-dados" element={<Suspense fallback={<RouteFallback />}><QualidadeDados /></Suspense>} />
          <Route path="/compliance" element={<Suspense fallback={<RouteFallback />}><Compliance /></Suspense>} />
          <Route path="/pessoas" element={<Suspense fallback={<RouteFallback />}><Pessoas /></Suspense>} />
          <Route path="/inteligencia" element={<Suspense fallback={<RouteFallback />}><Inteligencia /></Suspense>} />
          <Route path="/comercial" element={<Suspense fallback={<RouteFallback />}><Comercial /></Suspense>} />
          {/* Operação = Bombas + Reabastecimento em abas. As rotas antigas redirecionam. */}
          <Route path="/operacao" element={<Suspense fallback={<RouteFallback />}><Operacao /></Suspense>} />
          <Route path="/bombas" element={<Navigate to="/operacao" replace />} />
          <Route path="/caixas-turnos" element={<Navigate to="/dashboard" replace />} />
          <Route path="/produtividade" element={<Suspense fallback={<RouteFallback />}><Produtividade /></Suspense>} />
          <Route path="/mobile" element={<Suspense fallback={<RouteFallback />}><Mobile /></Suspense>} />
          {/* Módulos de gestão moram no Painel (com a nav de pills). As rotas
              antigas redirecionam pra não ter dois lugares pra mesma coisa. */}
          <Route path="/configuracoes" element={<Navigate to="/painel/config" replace />} />
          <Route path="/admin/frentistas" element={<Navigate to="/painel/frentistas" replace />} />
          <Route path="/admin/usuarios" element={<Navigate to="/painel/usuarios" replace />} />
          <Route path="/admin/redes" element={<Navigate to="/painel/redes" replace />} />
          <Route path="/admin/apuracao" element={<Navigate to="/painel/apuracao" replace />} />
          <Route path="/admin/assistente" element={<Navigate to="/painel/ia" replace />} />
          <Route path="/selecionar-rede" element={<Navigate to="/painel/selecionar-rede" replace />} />
          <Route path="/painel" element={<Suspense fallback={<RouteFallback />}><PainelLayout /></Suspense>}>
            <Route index element={<Navigate to="/painel/selecionar-rede" replace />} />
            <Route path="selecionar-rede" element={<Suspense fallback={<RouteFallback />}><PainelSelecionarRede /></Suspense>} />
            <Route path="usuarios" element={<Suspense fallback={<RouteFallback />}><AdminUsuarios /></Suspense>} />
            <Route path="frentistas" element={<Suspense fallback={<RouteFallback />}><AdminFrentistas /></Suspense>} />
            <Route path="redes" element={<Suspense fallback={<RouteFallback />}><AdminRedes /></Suspense>} />
            <Route path="config" element={<Suspense fallback={<RouteFallback />}><Configuracoes /></Suspense>} />
            <Route path="apuracao" element={<Suspense fallback={<RouteFallback />}><AdminApuracao /></Suspense>} />
            <Route path="ia" element={<Suspense fallback={<RouteFallback />}><AdminAssistente /></Suspense>} />
          </Route>
          {/* Rota órfã (ex.: /comercial/vendas removido) pousa no hub. */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      {/* Frentista routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Suspense fallback={<RouteFallback />}><FreentistaLayout /></Suspense>}>
          <Route path="/frentista" element={<Suspense fallback={<RouteFallback />}><MeusAbastecimentos /></Suspense>} />
          <Route path="/frentista/ranking" element={<Suspense fallback={<RouteFallback />}><MeuRanking /></Suspense>} />
          <Route path="/frentista/conta" element={<Suspense fallback={<RouteFallback />}><MinhaConta /></Suspense>} />
        </Route>
      </Route>

      {/* Gerente mobile routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Suspense fallback={<RouteFallback />}><GerenteLayout /></Suspense>}>
          <Route path="/gerente" element={<Suspense fallback={<RouteFallback />}><GerenteInicio /></Suspense>} />
          <Route path="/gerente/financeiro" element={<Suspense fallback={<RouteFallback />}><GerenteFinanceiro /></Suspense>} />
          <Route path="/gerente/frentistas" element={<Suspense fallback={<RouteFallback />}><GerenteFrentistas /></Suspense>} />
          <Route path="/gerente/combustiveis" element={<Suspense fallback={<RouteFallback />}><GerenteCombustiveis /></Suspense>} />
        </Route>
      </Route>
    </Routes>
  )
}

export default AppRoutes
