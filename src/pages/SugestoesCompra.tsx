import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LinksCompraCard } from '@/components/equipe/LinksCompraCard'

/**
 * Sugestões de compra de todas as equipes: as gerais ("para todos") e as de cena e de personagem.
 * Só leitura — cada equipe cadastra os links na página dela; os "só da equipe" ficam de fora.
 */
export function SugestoesCompra() {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/'))}
          title="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold text-white">Sugestões de compra</h1>
      </div>
      <LinksCompraCard />
    </div>
  )
}
