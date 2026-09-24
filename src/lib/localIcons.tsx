import {
  Building2,
  Church,
  Crown,
  DoorOpen,
  Drama,
  Guitar,
  House,
  Landmark,
  MapPin,
  Mic,
  Music,
  Piano,
  School,
  Signpost,
  Theater,
  ToyBrick,
  Trees,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'

/**
 * Ícones que o admin pode escolher pra um local de ensaio. A chave é o que fica salvo em
 * `LocalEnsaio.icone` — não renomear chaves existentes, senão locais já salvos voltam pro padrão.
 */
export const LOCAL_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  mapPin: { icon: MapPin, label: 'Local' },
  church: { icon: Church, label: 'Templo' },
  signpost: { icon: Signpost, label: 'Atrás / ao lado' },
  warehouse: { icon: Warehouse, label: 'Galpão' },
  theater: { icon: Theater, label: 'Teatro' },
  drama: { icon: Drama, label: 'Palco' },
  toyBrick: { icon: ToyBrick, label: 'Infantil' },
  crown: { icon: Crown, label: 'Gold' },
  doorOpen: { icon: DoorOpen, label: 'Corredor' },
  landmark: { icon: Landmark, label: 'Salão' },
  building: { icon: Building2, label: 'Prédio' },
  house: { icon: House, label: 'Casa' },
  school: { icon: School, label: 'Escola' },
  music: { icon: Music, label: 'Música' },
  mic: { icon: Mic, label: 'Estúdio' },
  guitar: { icon: Guitar, label: 'Violão' },
  piano: { icon: Piano, label: 'Piano' },
  trees: { icon: Trees, label: 'Ao ar livre' },
}

export const DEFAULT_LOCAL_ICON = 'mapPin'

export function localIcon(key: string | undefined): LucideIcon {
  return LOCAL_ICONS[key ?? '']?.icon ?? MapPin
}
