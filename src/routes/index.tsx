import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Combustiveis from '@/pages/Combustiveis'
import Produtos from '@/pages/Produtos'
import Conveniencias from '@/pages/Conveniencias'
import Estoques from '@/pages/Estoques'
import Financeiro from '@/pages/Financeiro'
import Relatorios from '@/pages/Relatorios'
import Inteligencia from '@/pages/Inteligencia'
import Operacao from '@/pages/Operacao'

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/combustiveis" element={<Combustiveis />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/conveniencias" element={<Conveniencias />} />
          <Route path="/estoques" element={<Estoques />} />
          <Route path="/produtividade" element={<Navigate to="/operacao" replace />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/inteligencia" element={<Inteligencia />} />
          <Route path="/operacao" element={<Operacao />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default AppRoutes
