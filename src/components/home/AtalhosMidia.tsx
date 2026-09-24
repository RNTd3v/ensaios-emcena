import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Image as ImageIcon, Music, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { subscribeToFigurinos, subscribeToMusicas } from '@/services/firebase/midias'

function Atalho({ to, icon: Icon, titulo, total }: { to: string; icon: LucideIcon; titulo: string; total: number | null }) {
  return (
    <Link to={to} className="block">
      <Card className="h-full">
        <CardContent className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{titulo}</p>
            <p className="text-xs text-muted-foreground">
              {total === null ? '...' : total === 0 ? 'Nenhum ainda' : `${total} ${total === 1 ? 'item' : 'itens'}`}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/** Atalhos da Home pras páginas com todas as músicas e todos os figurinos da peça. */
export function AtalhosMidia() {
  const [musicas, setMusicas] = useState<number | null>(null)
  const [figurinos, setFigurinos] = useState<number | null>(null)

  useEffect(() => subscribeToMusicas(undefined, l => setMusicas(l.length)), [])
  useEffect(() => subscribeToFigurinos(undefined, l => setFigurinos(l.length)), [])

  return (
    <div className="grid grid-cols-2 gap-3">
      <Atalho to="/musicas" icon={Music} titulo="Músicas" total={musicas} />
      <Atalho to="/figurinos" icon={ImageIcon} titulo="Figurinos" total={figurinos} />
    </div>
  )
}
