import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Combustiveis = lazy(() => import('@/pages/Combustiveis'))
const Produtos = lazy(() => import('@/pages/Produtos'))
const Conveniencias = lazy(() => import('@/pages/Conveniencias'))
const Estoques = lazy(() => import('@/pages/Estoques'))
const Financeiro = lazy(() => import('@/pages/Financeiro'))
const Inteligencia = lazy(() => import('@/pages/Inteligencia'))
const Operacao = lazy(() => import('@/pages/Operacao'))

// Frentista pages
const FreentistaLayout = lazy(() => import('@/pages/Frentista/layout/FreentistaLayout'))
const MeusAbastecimentos = lazy(() => import('@/pages/Frentista/MeusAbastecimentos'))
const MeuRanking = lazy(() => import('@/pages/Frentista/MeuRanking'))
const MeuCaixa = lazy(() => import('@/pages/Frentista/MeuCaixa'))
const MinhaSangria = lazy(() => import('@/pages/Frentista/MinhaSangria'))

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Gerente routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Suspense fallback={null}><Dashboard /></Suspense>} />
          <Route path="/combustiveis" element={<Suspense fallback={null}><Combustiveis /></Suspense>} />
          <Route path="/produtos" element={<Suspense fallback={null}><Produtos /></Suspense>} />
          <Route path="/conveniencias" element={<Suspense fallback={null}><Conveniencias /></Suspense>} />
          <Route path="/estoques" element={<Suspense fallback={null}><Estoques /></Suspense>} />
          <Route path="/produtividade" element={<Navigate to="/operacao" replace />} />
          <Route path="/financeiro" element={<Suspense fallback={null}><Financeiro /></Suspense>} />
          <Route path="/inteligencia" element={<Suspense fallback={null}><Inteligencia /></Suspense>} />
          <Route path="/operacao" element={<Suspense fallback={null}><Operacao /></Suspense>} />
        </Route>
      </Route>

      {/* Frentista routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Suspense fallback={null}><FreentistaLayout /></Suspense>}>
          <Route path="/frentista" element={<Suspense fallback={null}><MeusAbastecimentos /></Suspense>} />
          <Route path="/frentista/ranking" element={<Suspense fallback={null}><MeuRanking /></Suspense>} />
          <Route path="/frentista/caixa" element={<Suspense fallback={null}><MeuCaixa /></Suspense>} />
          <Route path="/frentista/sangria" element={<Suspense fallback={null}><MinhaSangria /></Suspense>} />
        </Route>
      </Route>
    </Routes>
  )
}

export default AppRoutes
