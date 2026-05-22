import { Navigate } from 'react-router-dom'

/**
 * /comercial — pousa direto em /comercial/vendas (aba padrão do módulo).
 */
const ComercialLanding = () => <Navigate to="/comercial/vendas" replace />

export default ComercialLanding
