import { useEffect, useState } from 'react'
import { ChevronRight, ExternalLink, ScrollText } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardContent } from '@/components/ui/card'
import { ProximoEnsaioCard } from '@/components/home/ProximoEnsaioCard'
import { ApresentacoesCard } from '@/components/home/ApresentacoesCard'
import { FinanceiroCards } from '@/components/home/FinanceiroCards'
import { OrandoAgoraCard } from '@/components/oracao/OrandoAgora'
import { AtalhosMidia } from '@/components/home/AtalhosMidia'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { getVersiculos, type VersiculoInput } from '@/services/firebase/versiculos'
import { VERSICULOS_SUGERIDOS } from '@/lib/versiculosSugeridos'

function sortear<T>(lista: T[]): T | undefined {
  return lista[Math.floor(Math.random() * lista.length)]
}

/**
 * Um versículo sorteado a cada vez que a Home monta. Enquanto carrega não mostra nada (pra não
 * trocar na frente da pessoa); se não houver nenhum cadastrado (ou der erro), sorteia dos sugeridos.
 */
function useVersiculoSorteado(): VersiculoInput | undefined {
  const [versiculo, setVersiculo] = useState<VersiculoInput>()
  useEffect(() => {
    let ativo = true
    getVersiculos()
      .then(lista => lista, () => [])
      .then(lista => {
        if (ativo) setVersiculo(sortear(lista.length ? lista : VERSICULOS_SUGERIDOS))
      })
    return () => {
      ativo = false
    }
  }, [])
  return versiculo
}


export function Home() {
  const user = useAuthStore(s => s.user)
  const firstName = user?.displayName?.trim().split(' ')[0]
  const versiculo = useVersiculoSorteado()
  const roteiroUrl = useSettingsStore(s => s.settings.roteiroUrl)

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3">
          <Avatar photoURL={user?.photoURL} name={user?.displayName} className="h-12 w-12 text-base border-2 border-white/30" />
          <h1 className="text-2xl font-semibold text-white">Olá{firstName ? `, ${firstName}` : ''}!</h1>
        </div>
        {versiculo && (
          <p className="text-xs text-white/60 italic mt-3 leading-relaxed">
            "{versiculo.texto}" — {versiculo.referencia}
          </p>
        )}
      </div>

      {user && <ProximoEnsaioCard uid={user.uid} />}

      <OrandoAgoraCard linkParaPagina />

      <ApresentacoesCard />

      <AtalhosMidia />

      <FinanceiroCards />

      <RoteiroCard url={roteiroUrl} />
    </div>
  )
}

/** Roteiro: um link externo (Configurações → Link do roteiro). Sem link, "Em breve". */
function RoteiroCard({ url }: { url?: string }) {
  const conteudo = (
    <CardContent className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ScrollText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">Roteiro</p>
        <p className="text-xs text-muted-foreground">{url ? 'Abrir o roteiro' : 'Em breve'}</p>
      </div>
      {url && <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />}
      {!url && <ChevronRight className="h-4 w-4 shrink-0 text-gray-200" />}
    </CardContent>
  )
  if (!url) return <Card>{conteudo}</Card>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <Card>{conteudo}</Card>
    </a>
  )
}
