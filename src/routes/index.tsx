import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import RouteFallback from '@/components/feedback/RouteFallback'
import { importDashboard } from '@/routes/prefetch'
import Login from '@/pages/Login'

const RedefinirSenha = lazy(() => import('@/pages/RedefinirSenha'))

const Dashboard = lazy(importDashboard)
const Conveniencias = lazy(() => import('@/pages/Conveniencias'))
const Estoques = lazy(() => import('@/pages/Estoques'))
const Financeiro = lazy(() => import('@/pages/Financeiro'))
const FechamentoCaixa = lazy(() => import('@/pages/FechamentoCaixa'))
const Inteligencia = lazy(() => import('@/pages/Inteligencia'))
const Operacao = lazy(() => import('@/pages/Operacao'))
const OperacaoCombustivel = lazy(() => import('@/pages/Operacao/Combustivel'))
const OperacaoPista = lazy(() => import('@/pages/Operacao/Pista'))
const OperacaoMix = lazy(() => import('@/pages/Operacao/Mix'))
const Mobile = lazy(() => import('@/pages/Mobile'))
const Configuracoes = lazy(() => import('@/pages/Configuracoes'))
const AdminFrentistas = lazy(() => import('@/pages/Admin/Frentistas'))
const AdminUsuarios = lazy(() => import('@/pages/Admin/Usuarios'))
const AdminRedes = lazy(() => import('@/pages/Admin/Redes'))
const AdminApuracao = lazy(() => import('@/pages/Admin/Apuracao'))
const SelecionarRede = lazy(() => import('@/pages/SelecionarRede'))

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
          <Route path="/combustiveis" element={<Navigate to="/operacao?tab=abastecimentos" replace />} />
          <Route path="/produtos" element={<Navigate to="/conveniencias" replace />} />
          <Route path="/conveniencias" element={<Suspense fallback={<RouteFallback />}><Conveniencias /></Suspense>} />
          <Route path="/estoques" element={<Suspense fallback={<RouteFallback />}><Estoques /></Suspense>} />
          <Route path="/produtividade" element={<Navigate to="/operacao" replace />} />
          <Route path="/reabastecimento" element={<Navigate to="/dashboard" replace />} />
          <Route path="/financeiro" element={<Suspense fallback={<RouteFallback />}><Financeiro /></Suspense>} />
          <Route path="/fechamento-caixa" element={<Suspense fallback={<RouteFallback />}><FechamentoCaixa /></Suspense>} />
          <Route path="/inteligencia" element={<Suspense fallback={<RouteFallback />}><Inteligencia /></Suspense>} />
          <Route path="/operacao" element={<Suspense fallback={<RouteFallback />}><Operacao /></Suspense>} />
          <Route path="/operacao/combustivel" element={<Suspense fallback={<RouteFallback />}><OperacaoCombustivel /></Suspense>} />
          <Route path="/operacao/pista" element={<Suspense fallback={<RouteFallback />}><OperacaoPista /></Suspense>} />
          <Route path="/operacao/mix" element={<Suspense fallback={<RouteFallback />}><OperacaoMix /></Suspense>} />
          <Route path="/mobile" element={<Suspense fallback={<RouteFallback />}><Mobile /></Suspense>} />
          <Route path="/configuracoes" element={<Suspense fallback={<RouteFallback />}><Configuracoes /></Suspense>} />
          <Route path="/admin/frentistas" element={<Suspense fallback={<RouteFallback />}><AdminFrentistas /></Suspense>} />
          <Route path="/admin/usuarios" element={<Suspense fallback={<RouteFallback />}><AdminUsuarios /></Suspense>} />
          <Route path="/admin/redes" element={<Suspense fallback={<RouteFallback />}><AdminRedes /></Suspense>} />
          <Route path="/admin/apuracao" element={<Suspense fallback={<RouteFallback />}><AdminApuracao /></Suspense>} />
          <Route path="/selecionar-rede" element={<Suspense fallback={<RouteFallback />}><SelecionarRede /></Suspense>} />
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
