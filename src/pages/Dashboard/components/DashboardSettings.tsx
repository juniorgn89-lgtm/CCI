import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Settings, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'
import { useDashboardLayoutStore } from '@/store/dashboardLayout'

const DashboardSettings = () => {
  const { sections, toggleVisibility, moveUp, moveDown, reset } = useDashboardLayoutStore()

  return (
    <Sheet>
      <SheetTrigger
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        aria-label="Personalizar dashboard"
      >
        <Settings className="h-4 w-4" />
      </SheetTrigger>

      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Personalizar Dashboard</SheetTitle>
          <SheetDescription>
            Reorganize e oculte seções do dashboard
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-1 flex-col gap-2">
          {sections.map((section, index) => (
            <div
              key={section.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900"
            >
              <span
                className={`text-sm font-medium ${
                  section.visible
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {section.label}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleVisibility(section.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  aria-label={section.visible ? 'Ocultar seção' : 'Mostrar seção'}
                >
                  {section.visible ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>

                <button
                  onClick={() => moveUp(section.id)}
                  disabled={index === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  aria-label="Mover para cima"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>

                <button
                  onClick={() => moveDown(section.id)}
                  disabled={index === sections.length - 1}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  aria-label="Mover para baixo"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-4">
          <Separator className="mb-4" />
          <button
            onClick={reset}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default DashboardSettings
