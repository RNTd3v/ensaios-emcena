import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { avaliarFigurino, subscribeToFigurinos } from '@/services/firebase/midias'
import { useAuthStore } from '@/stores/authStore'
import type { AppUser, Cena, FigurinoImagem } from '@/types'

/**
 * Fotos de figurino que o elenco mandou e ainda esperam a aprovação do líder da cena. Só aparece
 * (e só tem algo) pra quem avalia: líder da cena ou admin. Some quando não há pendências.
 */
export function AprovacoesFigurinoCard({ cena, users }: { cena: Cena; users: Record<string, AppUser> }) {
  const currentUser = useAuthStore(s => s.user)
  const podeAvaliar = !!currentUser && (currentUser.role === 'admin' || cena.liderUid === currentUser.uid)
  const [pendentes, setPendentes] = useState<FigurinoImagem[]>([])
  const [reprovandoId, setReprovandoId] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [salvandoId, setSalvandoId] = useState<string | null>(null)

  useEffect(() => {
    if (!podeAvaliar) return
    return subscribeToFigurinos(cena.id, lista => setPendentes(lista.filter(f => f.aprovacao === 'pendente')))
  }, [cena.id, podeAvaliar])

  if (!podeAvaliar || !pendentes.length) return null

  async function avaliar(f: FigurinoImagem, aprovado: boolean) {
    if (!currentUser) return
    setSalvandoId(f.id)
    try {
      await avaliarFigurino(f.id, aprovado, motivo, currentUser.uid)
      setReprovandoId(null)
      setMotivo('')
    } finally {
      setSalvandoId(null)
    }
  }

  return (
    <Card className="border-2 border-amber-300">
      <CardContent className="space-y-3">
        <p className="flex items-center gap-1.5 text-base font-semibold">
          <ShieldCheck className="h-4 w-4 text-amber-600" />
          Fotos de figurino pra aprovar ({pendentes.length})
        </p>
        {pendentes.map(f => {
          const personagemNome = cena.personagens.find(p => p.id === f.personagemId)?.nome ?? f.personagemNome ?? 'Personagem'
          const salvando = salvandoId === f.id
          return (
            <div key={f.id} className="flex gap-3 rounded-xl bg-gray-50 p-2">
              <a href={f.url} target="_blank" rel="noreferrer" className="shrink-0">
                <img src={f.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
              </a>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div>
                  {f.personagemId ? (
                    <Link to={`/cenas/${cena.id}/personagens/${f.personagemId}`} className="block truncate text-sm font-medium hover:underline">
                      {personagemNome}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{personagemNome}</p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">por {users[f.uploadedByUid]?.displayName ?? '...'}</p>
                </div>
                {reprovandoId === f.id ? (
                  <div className="space-y-1.5">
                    <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="O que precisa mudar? (opcional)" />
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setReprovandoId(null)} disabled={salvando}>
                        Voltar
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => avaliar(f, false)} disabled={salvando}>
                        Reprovar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1 text-red-600"
                      onClick={() => {
                        setMotivo('')
                        setReprovandoId(f.id)
                      }}
                      disabled={salvando}
                    >
                      <X className="h-3.5 w-3.5" />
                      Reprovar
                    </Button>
                    <Button size="sm" className="flex-1 gap-1" onClick={() => avaliar(f, true)} disabled={salvando}>
                      {salvando ? <Spinner size="sm" className="border-white/40 border-t-white" /> : <Check className="h-3.5 w-3.5" />}
                      Aprovar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
