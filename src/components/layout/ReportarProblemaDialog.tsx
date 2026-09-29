import { useRef, useState } from 'react'
import { CheckCircle2, ImagePlus, MessageCircle, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { enviarReporte } from '@/services/firebase/reportes'
import { infoDoAparelho, registrosRecentes } from '@/lib/diagnostico'
import { whatsappLink } from '@/lib/formatters'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'

const PRINT_MAX_BYTES = 5 * 1024 * 1024

/**
 * "Reportar problema" (menu): a pessoa descreve e, se quiser, anexa um print; junto vai o
 * diagnóstico do aparelho (tela atual, versão, se está instalado, últimas mensagens do app).
 * Depois do envio, oferece falar direto com o suporte pelo WhatsApp (Configurações → Suporte).
 */
export function ReportarProblemaDialog({ onClose }: { onClose: () => void }) {
  const user = useAuthStore(s => s.user)
  const whatsapp = useSettingsStore(s => s.settings.suporteWhatsapp)
  const [texto, setTexto] = useState('')
  const [print, setPrint] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [protocolo, setProtocolo] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [verDetalhes, setVerDetalhes] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // A tela em que a pessoa estava quando abriu o relato (o menu fica por cima dela).
  const [tela] = useState(() => window.location.pathname + window.location.search)

  async function enviar() {
    if (!user) return
    if (!texto.trim()) return setErro('Conte o que aconteceu.')
    setEnviando(true)
    setErro('')
    try {
      const id = await enviarReporte(
        {
          uid: user.uid,
          nome: user.apelido || user.displayName || 'Sem nome',
          texto,
          tela,
          aparelho: infoDoAparelho(),
          registros: registrosRecentes(),
        },
        print ?? undefined,
      )
      setProtocolo(id.slice(0, 6).toUpperCase())
    } catch {
      setErro('Não foi possível enviar. Verifique a internet e tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  function escolherPrint(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setErro('O print precisa ser uma imagem.')
    if (file.size > PRINT_MAX_BYTES) return setErro('O print precisa ter até 5MB.')
    setErro('')
    setPrint(file)
  }

  if (protocolo) {
    const mensagem = `Olá! Reportei um problema no app Vila Esperança (protocolo ${protocolo}): ${texto.trim().slice(0, 300)}`
    return (
      <Dialog open onClose={onClose} title="Problema enviado">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-900">Recebido, obrigado!</p>
              <p>
                Protocolo <span className="font-mono font-semibold">{protocolo}</span>. Os detalhes técnicos do seu aparelho foram
                junto, pra facilitar achar o problema.
              </p>
            </div>
          </div>
          {whatsapp && (
            <a
              href={`${whatsappLink(whatsapp)}?text=${encodeURIComponent(mensagem)}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-emerald-600 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              <MessageCircle className="h-4 w-4" />
              Falar com o desenvolvedor no WhatsApp
            </a>
          )}
          <Button className="w-full" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog open onClose={onClose} title="Reportar problema">
      <div className="space-y-4">
        <div>
          <Label htmlFor="reporte-texto">O que aconteceu?</Label>
          <Textarea
            id="reporte-texto"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Ex.: toquei em confirmar presença e ficou carregando, não confirmou."
            maxLength={2000}
            className="mt-1.5"
            autoFocus
          />
        </div>

        <div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => escolherPrint(e.target.files?.[0])} />
          {print ? (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <ImagePlus className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{print.name}</span>
              <button type="button" onClick={() => setPrint(null)} className="rounded-full p-1 text-gray-400 hover:bg-gray-200" aria-label="Tirar print">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-1.5" onClick={() => inputRef.current?.click()}>
              <ImagePlus className="h-4 w-4" />
              Anexar um print (opcional)
            </Button>
          )}
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-muted-foreground">
          Vai junto: a tela em que você estava, o modelo do aparelho, a versão do app e as últimas mensagens técnicas dele.{' '}
          <button type="button" onClick={() => setVerDetalhes(v => !v)} className="font-medium text-primary hover:underline">
            {verDetalhes ? 'Esconder' : 'Ver o que vai'}
          </button>
          {verDetalhes && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-white p-2 font-mono text-[10px] text-gray-700">
              {[`Tela: ${tela}`, ...Object.entries(infoDoAparelho()).map(([k, v]) => `${k}: ${v}`), '', ...registrosRecentes().slice(-15)].join('\n')}
            </pre>
          )}
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Button className="w-full gap-1.5" onClick={enviar} disabled={enviando || !texto.trim()}>
          {enviando ? <Spinner size="sm" className="border-white/40 border-t-white" /> : <Send className="h-4 w-4" />}
          Enviar
        </Button>
      </div>
    </Dialog>
  )
}
