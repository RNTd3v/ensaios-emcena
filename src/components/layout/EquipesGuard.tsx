import { Navigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useEquipesVisivel } from '@/hooks/useEquipesVisivel'

/** Só admin ou membro de alguma equipe entra em /equipes (quem não é volta pro início). */
export function EquipesGuard({ children }: { children: React.ReactNode }) {
  const visivel = useEquipesVisivel()
  if (visivel === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }
  if (!visivel) return <Navigate to="/" replace />
  return <>{children}</>
}
