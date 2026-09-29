import { useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ehIPhone, instalarApp, useInstalacaoStore } from '@/lib/instalacao'

const DISPENSADO_KEY = 'instalarApp.dispensadoEm'
const DISPENSAR_POR_DIAS = 14

function dispensadoRecentemente(): boolean {
  try {
    const em = Number(localStorage.getItem(DISPENSADO_KEY))
    return !!em && Date.now() - em < DISPENSAR_POR_DIAS * 86400000
  } catch {
    return false
  }
}

/**
 * Convite pra instalar o app na tela de início. Android/desktop: botão que abre o "Instalar" do
 * navegador. iPhone: o passo a passo (lá não existe botão) — e é só instalado que o iPhone recebe
 * notificações. Some com o app instalado; "Agora não" esconde por 14 dias.
 */
export function InstalarAppCard() {
  const { convite, instalado } = useInstalacaoStore()
  const [dispensado, setDispensado] = useState(dispensadoRecentemente)
  const iphone = ehIPhone()

  if (instalado || dispensado || (!convite && !iphone)) return null

  function dispensar() {
    try {
      localStorage.setItem(DISPENSADO_KEY, String(Date.now()))
    } catch {
      // storage indisponível — esconde só nesta visita
    }
    setDispensado(true)
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <img src="/apple-touch-icon.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Instale o app no celular</p>
            <p className="text-xs text-muted-foreground">
              Abre direto da tela de início, em tela cheia{iphone ? ', e é o único jeito de receber notificações no iPhone' : ' e recebe as notificações'}.
            </p>
          </div>
          <button type="button" onClick={dispensar} className="-mr-1 -mt-1 rounded-full p-1 text-gray-400 hover:bg-gray-100" aria-label="Agora não">
            <X className="h-4 w-4" />
          </button>
        </div>

        {convite ? (
          <Button className="w-full gap-1.5" onClick={() => instalarApp()}>
            <Download className="h-4 w-4" />
            Instalar app
          </Button>
        ) : (
          <ol className="space-y-1.5 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-700">
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">1</span>
              Toque em <Share className="h-3.5 w-3.5 shrink-0 text-primary" /> <strong>Compartilhar</strong> (no Safari)
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">2</span>
              Escolha <SquarePlus className="h-3.5 w-3.5 shrink-0 text-primary" /> <strong>Adicionar à Tela de Início</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">3</span>
              Abra pelo ícone <strong>Vila Esperança</strong> e entre de novo
            </li>
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
