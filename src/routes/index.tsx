import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Conveniencias = lazy(() => import('@/pages/Conveniencias'))
const Estoques = lazy(() => import('@/pages/Estoques'))
const Financeiro = lazy(() => import('@/pages/Financeiro'))
const Inteligencia = lazy(() => import('@/pages/Inteligencia'))
const Operacao = lazy(() => import('@/pages/Operacao'))
const Mobile = lazy(() => import('@/pages/Mobile'))
const Configuracoes = lazy(() => import('@/pages/Configuracoes'))
const AdminFrentistas = lazy(() => import('@/pages/Admin/Frentistas'))
const AdminUsuarios = lazy(() => import('@/pages/Admin/Usuarios'))

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
      <Route path="/signup" element={<Signup />} />
      <Route path="/frentista/auto" element={<Suspense fallback={null}><FrentistaAutoLogin /></Suspense>} />

      {/* Gerente routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Suspense fallback={null}><Dashboard /></Suspense>} />
          <Route path="/combustiveis" element={<Navigate to="/operacao?tab=abastecimentos" replace />} />
          <Route path="/produtos" element={<Navigate to="/conveniencias" replace />} />
          <Route path="/conveniencias" element={<Suspense fallback={null}><Conveniencias /></Suspense>} />
          <Route path="/estoques" element={<Suspense fallback={null}><Estoques /></Suspense>} />
          <Route path="/produtividade" element={<Navigate to="/operacao" replace />} />
          <Route path="/financeiro" element={<Suspense fallback={null}><Financeiro /></Suspense>} />
          <Route path="/inteligencia" element={<Suspense fallback={null}><Inteligencia /></Suspense>} />
          <Route path="/operacao" element={<Suspense fallback={null}><Operacao /></Suspense>} />
          <Route path="/mobile" element={<Suspense fallback={null}><Mobile /></Suspense>} />
          <Route path="/configuracoes" element={<Suspense fallback={null}><Configuracoes /></Suspense>} />
          <Route path="/admin/frentistas" element={<Suspense fallback={null}><AdminFrentistas /></Suspense>} />
          <Route path="/admin/usuarios" element={<Suspense fallback={null}><AdminUsuarios /></Suspense>} />
        </Route>
      </Route>

      {/* Frentista routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Suspense fallback={null}><FreentistaLayout /></Suspense>}>
          <Route path="/frentista" element={<Suspense fallback={null}><MeusAbastecimentos /></Suspense>} />
          <Route path="/frentista/ranking" element={<Suspense fallback={null}><MeuRanking /></Suspense>} />
          <Route path="/frentista/conta" element={<Suspense fallback={null}><MinhaConta /></Suspense>} />
        </Route>
      </Route>

      {/* Gerente mobile routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Suspense fallback={null}><GerenteLayout /></Suspense>}>
          <Route path="/gerente" element={<Suspense fallback={null}><GerenteInicio /></Suspense>} />
          <Route path="/gerente/financeiro" element={<Suspense fallback={null}><GerenteFinanceiro /></Suspense>} />
          <Route path="/gerente/frentistas" element={<Suspense fallback={null}><GerenteFrentistas /></Suspense>} />
          <Route path="/gerente/combustiveis" element={<Suspense fallback={null}><GerenteCombustiveis /></Suspense>} />
        </Route>
      </Route>
    </Routes>
  )
}

export default AppRoutes
