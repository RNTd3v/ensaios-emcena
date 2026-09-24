import {
  Camera,
  Film,
  Hammer,
  Lightbulb,
  Megaphone,
  Mic,
  MonitorPlay,
  Music,
  Package,
  Paintbrush,
  Palette,
  Scissors,
  Shirt,
  Sparkles,
  Speaker,
  Theater,
  UsersRound,
  Utensils,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { MidiaTipo } from '@/types'

/**
 * Ícones que o admin pode escolher pra uma equipe. A chave é o que fica salvo em `Equipe.icone`
 * — não renomear chaves existentes, senão equipes já salvas voltam pro padrão.
 */
export const EQUIPE_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  equipe: { icon: UsersRound, label: 'Equipe' },
  cenario: { icon: Paintbrush, label: 'Cenário' },
  iluminacao: { icon: Lightbulb, label: 'Iluminação' },
  musica: { icon: Music, label: 'Música' },
  video: { icon: MonitorPlay, label: 'Vídeo' },
  som: { icon: Speaker, label: 'Som' },
  microfone: { icon: Mic, label: 'Microfone' },
  figurino: { icon: Shirt, label: 'Figurino' },
  costura: { icon: Scissors, label: 'Costura' },
  palco: { icon: Theater, label: 'Palco' },
  objetos: { icon: Package, label: 'Objetos de cena' },
  maquiagem: { icon: Palette, label: 'Maquiagem' },
  efeitos: { icon: Sparkles, label: 'Efeitos' },
  montagem: { icon: Hammer, label: 'Montagem' },
  tecnica: { icon: Wrench, label: 'Técnica' },
  foto: { icon: Camera, label: 'Foto' },
  filmagem: { icon: Film, label: 'Filmagem' },
  divulgacao: { icon: Megaphone, label: 'Divulgação' },
  cozinha: { icon: Utensils, label: 'Cozinha' },
}

export const DEFAULT_EQUIPE_ICON = 'equipe'

export function equipeIcon(key: string | undefined): LucideIcon {
  return EQUIPE_ICONS[key ?? '']?.icon ?? UsersRound
}

/** Equipes criadas pelo botão "Criar equipes padrão" (as já existentes com o mesmo nome são puladas). */
export const EQUIPES_PADRAO: { nome: string; icone: string; gerencia?: MidiaTipo[] }[] = [
  { nome: 'Cenário', icone: 'cenario' },
  { nome: 'Iluminação', icone: 'iluminacao' },
  { nome: 'Sonoplastia', icone: 'som', gerencia: ['musicas'] },
  { nome: 'Figurino', icone: 'figurino', gerencia: ['figurinos'] },
  { nome: 'Palco', icone: 'palco' },
  { nome: 'Objetos de cena', icone: 'objetos' },
]
