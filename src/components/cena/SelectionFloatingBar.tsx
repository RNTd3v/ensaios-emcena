import { useCallback, useRef, useState } from 'react'
import { Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'
import type { AppUser, Inscricao } from '@/types'

interface Props {
  selectedInscricoes: Inscricao[]
  users: Record<string, AppUser>
  onCreateCena: () => void
  onClear: () => void
}

const AVATAR_SIZE = 28
const AVATAR_STEP = 20 // 28px de avatar menos 8px de sobreposição (-space-x-2)

/**
 * Barra flutuante fixa no fundo da tela (fora do fluxo de scroll), com os avatares das pessoas
 * selecionadas se sobrepondo até o limite da largura do card — o que não cabe vira "+N".
 */
export function SelectionFloatingBar({ selectedInscricoes, users, onCreateCena, onClear }: Props) {
  const [avatarRowWidth, setAvatarRowWidth] = useState(0)
  const avatarRowObserverRef = useRef<ResizeObserver | null>(null)

  // Ref-callback (em vez de useRef + useEffect com deps []): esse <div> só existe no DOM
  // quando há seleção, então precisamos (re)conectar o observer toda vez que ele monta/desmonta.
  const avatarRowRef = useCallback((el: HTMLDivElement | null) => {
    avatarRowObserverRef.current?.disconnect()
    avatarRowObserverRef.current = null
    if (!el) return
    const observer = new ResizeObserver(entries => setAvatarRowWidth(entries[0].contentRect.width))
    observer.observe(el)
    avatarRowObserverRef.current = observer
  }, [])

  if (selectedInscricoes.length === 0) return null

  const maxVisibleAvatars =
    avatarRowWidth > 0 ? Math.max(1, Math.floor((avatarRowWidth - AVATAR_SIZE) / AVATAR_STEP) + 1) : selectedInscricoes.length
  const visibleAvatarsCount = selectedInscricoes.length <= maxVisibleAvatars ? selectedInscricoes.length : maxVisibleAvatars - 1
  const hiddenAvatarsCount = selectedInscricoes.length - visibleAvatarsCount

  return (
    <div className="fixed inset-x-0 bottom-0 left-0 z-30 px-4 pt-10 pb-4 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
      <div className="flex flex-col gap-2.5 rounded-2xl bg-white border border-gray-200 shadow-xl px-3 py-2.5">
        <div ref={avatarRowRef} className="flex -space-x-2 w-full">
          {selectedInscricoes.slice(0, visibleAvatarsCount).map(i => (
            <Avatar
              key={i.uid}
              photoURL={users[i.uid]?.photoURL}
              name={i.apelido || i.nomeCompleto}
              className="h-7 w-7 text-[10px] ring-2 ring-white shrink-0"
            />
          ))}
          {hiddenAvatarsCount > 0 && (
            <div className="h-7 w-7 rounded-full bg-gray-200 ring-2 ring-white flex items-center justify-center text-[10px] font-medium text-gray-600 shrink-0">
              +{hiddenAvatarsCount}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" className="w-full gap-1.5" onClick={onCreateCena}>
            <Users className="h-4 w-4" />
            Cadastrar Cena
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-500" onClick={onClear}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
