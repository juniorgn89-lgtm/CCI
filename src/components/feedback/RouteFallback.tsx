/**
 * Fallback discreto pro Suspense de troca de rota. Como os chunks de rota
 * agora são pequenos (code-splitting + vendors separados), na maioria das
 * vezes mal aparece — mas evita a tela em branco em conexões lentas.
 */
const RouteFallback = () => (
  <div className="flex h-[60vh] w-full items-center justify-center">
    <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-[#1e3a5f] dark:border-gray-700 dark:border-t-blue-400" />
  </div>
)

export default RouteFallback
