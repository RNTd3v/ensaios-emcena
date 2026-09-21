import { Link } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmConstrucao() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/admin">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-white">Em construção</h1>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-white">
        <Construction className="h-10 w-10 text-white/70" />
        <p className="text-sm text-white/70 max-w-xs">Essa funcionalidade ainda está sendo desenvolvida.</p>
        <Link to="/admin">
          <Button variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>
    </div>
  )
}
