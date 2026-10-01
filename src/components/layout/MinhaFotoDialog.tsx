import { useRef, useState } from 'react'
import { Camera, ChevronRight, RotateCcw, ShieldCheck, User } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { auth } from '@/services/firebase/config'
import { salvarFotoPerfil, usarFotoDaConta } from '@/services/firebase/auth'
import { atualizarFotoLocal, useAuthStore } from '@/stores/authStore'
import { reduzirFotoQuadrada } from '@/lib/imagem'

const FOTO_MAX_BYTES = 20 * 1024 * 1024

/**
 * Menu → foto: a pessoa troca a própria foto por uma do aparelho (ou volta pra da conta Google).
 * Admin também chega por aqui na troca de visão (admin ↔ participante).
 */
export function MinhaFotoDialog({ onClose, onTrocarVisao }: { onClose: () => void; onTrocarVisao?: () => void }) {
  const perfil = useAuthStore(s => s.perfilReal)
  const visaoParticipante = useAuthStore(s => s.visaoParticipante)
  const inputRef = useRef<HTMLInputElement>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  if (!perfil) return null
  const uid = perfil.uid
  const fotoDaConta = auth.currentUser?.photoURL ?? null

  async function escolher(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setErro('Escolha uma imagem.')
    if (file.size > FOTO_MAX_BYTES) return setErro('A imagem precisa ter até 20MB.')
    setSalvando(true)
    setErro('')
    try {
      const reduzida = await reduzirFotoQuadrada(file)
      const { url, path } = await salvarFotoPerfil(uid, reduzida, perfil?.fotoPath)
      atualizarFotoLocal(url, path)
    } catch (err) {
      console.error('[foto] Falha ao salvar a foto de perfil:', err)
      setErro('Não foi possível salvar a foto. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  async function voltarParaDaConta() {
    setSalvando(true)
    setErro('')
    try {
      await usarFotoDaConta(uid, fotoDaConta, perfil?.fotoPath)
      atualizarFotoLocal(fotoDaConta, undefined)
    } catch (err) {
      console.error('[foto] Falha ao voltar pra foto da conta:', err)
      setErro('Não foi possível trocar a foto. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title="Minha foto">
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={salvando}
            className="relative overflow-hidden rounded-full"
            aria-label="Escolher outra foto"
          >
            <Avatar photoURL={perfil.photoURL} name={perfil.displayName} className="h-28 w-28 text-3xl" />
            <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/45 py-1 text-white">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <p className="text-center text-xs text-muted-foreground">Ela aparece nas cenas, nas equipes e nas listas de pessoas.</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            escolher(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        <div className="space-y-2">
          <Button className="w-full gap-1.5" disabled={salvando} onClick={() => inputRef.current?.click()}>
            <Camera className="h-4 w-4" />
            {salvando ? 'Salvando...' : 'Escolher outra foto'}
          </Button>
          {perfil.fotoPath && (
            <Button variant="outline" className="w-full gap-1.5" disabled={salvando} onClick={voltarParaDaConta}>
              <RotateCcw className="h-4 w-4" />
              {fotoDaConta ? 'Voltar pra foto do Google' : 'Remover foto'}
            </Button>
          )}
          {erro && <p className="text-center text-sm text-destructive">{erro}</p>}
        </div>

        {onTrocarVisao && (
          <button
            type="button"
            onClick={onTrocarVisao}
            className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left hover:bg-gray-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
              {visaoParticipante ? <User className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-900">Visão do app</span>
              <span className="block text-xs text-muted-foreground">{visaoParticipante ? 'Vendo como participante' : 'Admin'} · trocar</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        )}
      </div>
    </Dialog>
  )
}
