import { useEffect, useState } from 'react'
import { CalendarPlus, Check, Copy, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/Spinner'
import { gerarCalendarioToken, getCalendarioToken, revogarCalendarioToken } from '@/services/firebase/calendarioToken'

interface Props {
  uid: string
  onClose: () => void
}

/**
 * Assinatura do calendário pessoal: gera um link secreto (`/api/calendario/<token>.ics`) que o
 * Google Agenda ou o Calendário da Apple assinam — os ensaios aparecem lá e acompanham mudanças e
 * cancelamentos sozinhos. Quem tem o link vê os ensaios, então dá pra trocar (invalida o antigo) ou apagar.
 */
export function AssinarCalendarioDialog({ uid, onClose }: Props) {
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    getCalendarioToken(uid)
      .then(setToken)
      .catch(() => {
        setErro('Não foi possível carregar o link.')
        setToken(null)
      })
  }, [uid])

  async function executar(acao: () => Promise<string | null>) {
    setOcupado(true)
    setErro('')
    try {
      setToken(await acao())
    } catch {
      setErro('Não foi possível concluir. Tente de novo.')
    } finally {
      setOcupado(false)
    }
  }

  const https = token ? `${window.location.origin}/api/calendario/${token}.ics` : ''
  const webcal = https.replace(/^https?:/, 'webcal:')
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`

  async function copiar() {
    try {
      await navigator.clipboard.writeText(https)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setErro('Não foi possível copiar — selecione o link e copie manualmente.')
    }
  }

  return (
    <Dialog open onClose={onClose} title="Ensaios no seu calendário">
      <div className="space-y-4 text-sm">
        {token === undefined ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : !token ? (
          <>
            <p className="text-gray-600">
              Receba os seus ensaios (e os dos seus filhos e do cônjuge vinculado) direto no Google Agenda ou no Calendário da Apple. Horários,
              locais e cancelamentos se atualizam sozinhos.
            </p>
            <Button className="w-full gap-1.5" disabled={ocupado} onClick={() => executar(() => gerarCalendarioToken(uid))}>
              <CalendarPlus className="h-4 w-4" />
              {ocupado ? 'Criando…' : 'Criar meu link de calendário'}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <a href={google} target="_blank" rel="noreferrer" className="block">
                <Button className="w-full gap-1.5" type="button">
                  <CalendarPlus className="h-4 w-4" />
                  Adicionar ao Google Agenda
                </Button>
              </a>
              <a href={webcal} className="block">
                <Button variant="outline" className="w-full gap-1.5" type="button">
                  <CalendarPlus className="h-4 w-4" />
                  Adicionar ao Calendário da Apple (iPhone/Mac)
                </Button>
              </a>
              <Button variant="outline" className="w-full gap-1.5" type="button" onClick={copiar}>
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiado ? 'Link copiado' : 'Copiar link (Outlook, outros)'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O Calendário da Apple atualiza sozinho (de hora em hora, ou como você configurar). O Google Agenda costuma demorar de 8 a 24 horas
              pra refletir mudanças — é um limite do Google.
            </p>
            <div className="space-y-1 border-t pt-3">
              <p className="text-xs text-muted-foreground">
                Este link é só seu: quem o tiver vê os seus ensaios. Se vazar, troque ou apague.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="gap-1.5" disabled={ocupado} onClick={() => executar(() => gerarCalendarioToken(uid))}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Trocar link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-red-600"
                  disabled={ocupado}
                  onClick={() => executar(async () => (await revogarCalendarioToken(uid), null))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Apagar link
                </Button>
              </div>
            </div>
          </>
        )}
        {erro && <p className="text-xs text-red-600">{erro}</p>}
      </div>
    </Dialog>
  )
}
