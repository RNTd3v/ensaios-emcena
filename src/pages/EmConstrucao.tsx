import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmConstrucao() {
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold text-white">Em construção</h1>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-white">
        <Construction className="h-10 w-10 text-white/70" />
        <p className="text-sm text-white/70 max-w-xs">Essa funcionalidade ainda está sendo desenvolvida.</p>
        <Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>
    </div>
  )
}
