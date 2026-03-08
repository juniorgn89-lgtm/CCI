import { Building2 } from 'lucide-react'

const SelectCompanyState = () => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-blue-200 bg-blue-50/50 py-16 dark:border-blue-800 dark:bg-blue-950/20">
    <Building2 className="h-10 w-10 text-blue-400 dark:text-blue-500" />
    <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
      Selecione uma empresa no filtro acima
    </p>
    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
      Para visualizar os dados, selecione uma empresa.
    </p>
  </div>
)

export default SelectCompanyState
