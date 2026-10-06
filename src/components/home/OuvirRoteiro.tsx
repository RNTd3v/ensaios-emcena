import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Headphones } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { LeitorRoteiro } from '@/components/cena/RoteiroCenaCard'
import { lerRoteiro, type BlocoRoteiro } from '@/lib/roteiroCena'
import { subscribeToCenasDoParticipante } from '@/services/firebase/cenas'
import { urlDoArquivo } from '@/services/firebase/storage'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { RoteiroArquivo } from '@/types'

/** Texto já lido, por arquivo: voltar pra Home não baixa e lê o PDF de novo. */
const cache = new Map<string, Promise<BlocoRoteiro[]>>()

function blocosDoArquivo(arquivo: RoteiroArquivo): Promise<BlocoRoteiro[]> {
  let p = cache.get(arquivo.path)
  if (!p) {
    p = (async () => {
      const resp = await fetch(await urlDoArquivo(arquivo.path))
      if (!resp.ok) throw new Error('Não foi possível baixar o roteiro.')
      const { textoDoPdf } = await import('@/lib/roteiroPdf')
      return lerRoteiro(await textoDoPdf(await resp.arrayBuffer()))
    })()
    p.catch(() => cache.delete(arquivo.path))
    cache.set(arquivo.path, p)
  }
  return p
}

/**
 * O roteiro inteiro em voz alta, com o mesmo leitor da tela da cena (vozes, ensaiar minhas falas).
 * O PDF só é baixado e lido quando a pessoa abre. "Minhas falas" = os personagens dela em todas as cenas.
 */
export function OuvirRoteiro({ arquivo }: { arquivo: RoteiroArquivo }) {
  const user = useAuthStore(s => s.user)
  const [aberto, setAberto] = useState(false)
  const [blocos, setBlocos] = useState<BlocoRoteiro[]>()
  const [erro, setErro] = useState('')
  const [personagensDasCenas, setPersonagensDasCenas] = useState<string[]>([])

  useEffect(() => {
    if (!user) return
    return subscribeToCenasDoParticipante(user.uid, cenas =>
      setPersonagensDasCenas(cenas.flatMap(c => c.personagens.filter(p => p.participanteUid === user.uid).map(p => p.nome))),
    )
  }, [user])
  // Mesmo conteúdo = mesma referência: o leitor não volta pro começo a cada snapshot das cenas.
  const chave = [...new Set(personagensDasCenas)].sort().join('\n')
  const meusPersonagens = useMemo(() => (chave ? chave.split('\n') : []), [chave])

  useEffect(() => {
    if (!aberto) return
    let ativo = true
    setErro('')
    blocosDoArquivo(arquivo).then(
      b => ativo && setBlocos(b),
      e => {
        console.error('Roteiro: falha ao ler o PDF pro áudio', e)
        if (ativo) setErro('Não foi possível carregar o áudio do roteiro. Tente de novo.')
      },
    )
    return () => {
      ativo = false
    }
  }, [aberto, arquivo])

  return (
    <div>
      <button type="button" onClick={() => setAberto(v => !v)} className="flex w-full items-center gap-3 py-1 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Headphones className="h-4 w-4" />
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-gray-900">Ouvir o roteiro</p>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', !aberto && '-rotate-90')} />
      </button>

      {aberto && (
        <div className="pt-2">
          {erro ? (
            <p className="text-sm text-red-600">{erro}</p>
          ) : !blocos ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Spinner size="sm" />
              Lendo o roteiro…
            </div>
          ) : blocos.some(b => b.tipo === 'fala') ? (
            <LeitorRoteiro blocos={blocos} meusPersonagens={meusPersonagens} />
          ) : (
            <p className="text-xs text-muted-foreground">Não deu pra ler o texto desse PDF (talvez seja escaneado).</p>
          )}
        </div>
      )}
    </div>
  )
}
