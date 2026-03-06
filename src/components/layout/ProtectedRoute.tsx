import { Navigate, Outlet } from 'react-router-dom'

const ProtectedRoute = () => {
  const authenticated = sessionStorage.getItem('app_authenticated') === 'true'

  if (!authenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
