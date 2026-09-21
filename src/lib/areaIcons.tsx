import { Drama, Lightbulb, Shirt, Users } from 'lucide-react'
import type { Area } from '@/types'

export const AREA_ICONS: Record<Area, React.ComponentType<{ className?: string }>> = {
  elenco: Drama,
  staff: Users,
  figurino: Shirt,
  tecnica: Lightbulb,
}
