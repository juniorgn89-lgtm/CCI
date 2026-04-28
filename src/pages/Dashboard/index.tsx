import { LayoutDashboard } from 'lucide-react'
import TurnosAoVivo from '@/pages/Dashboard/components/TurnosAoVivo'

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <LayoutDashboard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Central da Rede</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Acompanhamento dos postos em tempo real
          </p>
        </div>
      </div>
      <TurnosAoVivo />
    </div>
  )
}

export default Dashboard
