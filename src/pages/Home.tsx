import { useEffect, useState } from 'react'
import { Camera, ChevronRight, ExternalLink, ScrollText } from 'lucide-react'
import { urlDoArquivo } from '@/services/firebase/storage'
import { ROTEIRO_TIPOS } from '@/lib/roteiro'
import { Avatar } from '@/components/ui/Avatar'
import { MinhaFotoDialog } from '@/components/layout/MinhaFotoDialog'
import { Card, CardContent } from '@/components/ui/card'
import { ProximoEnsaioCard } from '@/components/home/ProximoEnsaioCard'
import { ProximoTreinamentoCard } from '@/components/home/ProximoTreinamentoCard'
import { ApresentacoesCard } from '@/components/home/ApresentacoesCard'
import { FinanceiroCards } from '@/components/home/FinanceiroCards'
import { OrandoAgoraCard } from '@/components/oracao/OrandoAgora'
import { AtalhosMidia } from '@/components/home/AtalhosMidia'
import { useOracaoVisivel } from '@/hooks/useOracaoVisivel'
import { subscribeToDependentes } from '@/services/firebase/dependentes'
import type { AppSettings, Inscricao, RoteiroTipo } from '@/types'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { getVersiculos, type VersiculoInput } from '@/services/firebase/versiculos'
import { VERSICULOS_SUGERIDOS } from '@/lib/versiculosSugeridos'
import { InstalarAppCard } from '@/components/home/InstalarAppCard'
import { InteresseEquipesCard } from '@/components/inscricao/InteresseEquipes'
import { TarefasEmAndamentoCard } from '@/components/home/TarefasEmAndamentoCard'
import { OuvirRoteiro } from '@/components/home/OuvirRoteiro'

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
  const roteiros = useSettingsStore(s => s.settings.roteiros)
  const oracaoVisivel = useOracaoVisivel()
  // Filhos inscritos pela pessoa: um card de próximo ensaio pra cada, com a resposta por ele.
  const [dependentes, setDependentes] = useState<Inscricao[]>([])
  const [fotoOpen, setFotoOpen] = useState(false)
  useEffect(() => {
    if (!user) return
    return subscribeToDependentes(user.uid, setDependentes)
  }, [user])

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3">
          {/* Tocar na foto troca a foto (o mesmo "Minha foto" do menu). */}
          <button type="button" onClick={() => setFotoOpen(true)} className="relative shrink-0" title="Trocar minha foto">
            <Avatar photoURL={user?.photoURL} name={user?.displayName} className="h-12 w-12 text-base border-2 border-white/30" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary ring-2 ring-black/30">
              <Camera className="h-3 w-3 text-white" />
            </span>
          </button>
          <h1 className="text-2xl font-semibold text-white">Olá{firstName ? `, ${firstName}` : ''}!</h1>
        </div>
        {versiculo && (
          <p className="text-xs text-white/60 italic mt-3 leading-relaxed">
            "{versiculo.texto}" — {versiculo.referencia}
          </p>
        )}
      </div>

      {fotoOpen && <MinhaFotoDialog onClose={() => setFotoOpen(false)} />}

      <InstalarAppCard />

      {user && <InteresseEquipesCard uid={user.uid} />}

      {user && <ProximoTreinamentoCard uid={user.uid} />}
      {user &&
        dependentes.map(d => (
          <ProximoTreinamentoCard key={d.uid} uid={d.uid} dependenteDe={user.uid} nome={d.apelido || d.nomeCompleto} />
        ))}

      {user && <ProximoEnsaioCard uid={user.uid} />}
      {user &&
        dependentes.map(d => <ProximoEnsaioCard key={d.uid} uid={d.uid} dependenteDe={user.uid} nome={d.apelido || d.nomeCompleto} />)}

      {user && <TarefasEmAndamentoCard uid={user.uid} />}

      {oracaoVisivel && <OrandoAgoraCard linkParaPagina />}

      <ApresentacoesCard />

      <AtalhosMidia />

      <FinanceiroCards />

      <RoteiroCard roteiros={roteiros} />
    </div>
  )
}

/**
 * Roteiro: os PDFs de Configurações. As URLs são pedidas ao montar (já logado) e não no clique —
 * abrir aba depois de um `await` é bloqueado no iOS. Nenhum PDF = "Em breve".
 */
function RoteiroCard({ roteiros }: { roteiros?: AppSettings['roteiros'] }) {
  const [urls, setUrls] = useState<Partial<Record<RoteiroTipo, string>>>({})
  const disponiveis = ROTEIRO_TIPOS.filter(t => roteiros?.[t.tipo])
  // Áudio: sempre do roteiro de letra grande; sem ele, não aparece.
  const paraOuvir = roteiros?.grande

  useEffect(() => {
    let ativo = true
    Promise.all(
      ROTEIRO_TIPOS.map(async ({ tipo }) => {
        const arquivo = roteiros?.[tipo]
        if (!arquivo) return [tipo, undefined] as const
        return [tipo, await urlDoArquivo(arquivo.path).catch(() => undefined)] as const
      }),
    ).then(pares => {
      if (ativo) setUrls(Object.fromEntries(pares.filter(([, url]) => url)))
    })
    return () => {
      ativo = false
    }
  }, [roteiros])

  if (!disponiveis.length) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ScrollText className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Roteiro</p>
            <p className="text-xs text-muted-foreground">Em breve</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-200" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-1">
        {disponiveis.map(({ tipo, label }) => {
          const url = urls[tipo]
          const linha = (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ScrollText className="h-4 w-4" />
              </span>
              <p className="min-w-0 flex-1 text-sm font-semibold text-gray-900">{label}</p>
              <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
            </>
          )
          if (!url) {
            return (
              <div key={tipo} className="flex items-center gap-3 py-1 opacity-50">
                {linha}
              </div>
            )
          }
          return (
            <a key={tipo} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-1">
              {linha}
            </a>
          )
        })}
        {paraOuvir && <OuvirRoteiro arquivo={paraOuvir} />}
      </CardContent>
    </Card>
  )
}
