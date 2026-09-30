import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, FileText, Loader2, Paperclip } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { removerRoteiro, saveSettings, uploadRoteiro } from '@/services/firebase/settings'
import { urlDoArquivo } from '@/services/firebase/storage'
import { ROTEIRO_TIPOS } from '@/lib/roteiro'
import { useSettingsStore } from '@/stores/settingsStore'
import type { AppSettings, RoteiroArquivo, RoteiroTipo } from '@/types'
import { PessoaSelect, pessoaOpcao } from '@/components/ui/PessoaSelect'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useUsersMap } from '@/components/oracao/OrandoAgora'

export function AdminConfig() {
  const { settings, loaded, refresh } = useSettingsStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  const { register, handleSubmit, reset, watch, setValue } = useForm<Omit<AppSettings, 'updatedAt'>>({ values: settings })
  const users = useUsersMap()
  const admins = Object.values(users)
    .filter(u => u.role === 'admin' && u.active !== false)
    .map(u => pessoaOpcao(u.uid, u))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  useEffect(() => {
    reset(settings)
  }, [settings, reset])

  async function onSubmit(data: Omit<AppSettings, 'updatedAt'>) {
    setSaving(true)
    try {
      // Os PDFs do roteiro são gravados na hora, pelo próprio card — não reescreve com o valor do form.
      const { roteiros: _roteiros, ...resto } = data
      await saveSettings(resto)
      await refresh()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <Link to="/admin">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-white">Configurações</h1>
      </div>

      <RoteirosCard roteiros={settings.roteiros} onChange={refresh} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Espetáculo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="eventName">Nome do espetáculo</Label>
              <Input id="eventName" {...register('eventName')} />
            </div>
            <div>
              <Label htmlFor="eventDate">Data das apresentações</Label>
              <Input id="eventDate" type="date" {...register('eventDate')} />
              <p className="text-xs text-muted-foreground mt-1">Aparece na Home com contagem regressiva.</p>
            </div>
            <div>
              <Label htmlFor="apresentacaoHorarios">Horários das apresentações</Label>
              <Input id="apresentacaoHorarios" placeholder="10:00, 19:00" {...register('apresentacaoHorarios')} />
              <p className="text-xs text-muted-foreground mt-1">Separados por vírgula, no formato HH:MM.</p>
            </div>
            <div>
              <Label htmlFor="callToActionText">Texto do botão de inscrição</Label>
              <Input id="callToActionText" placeholder="Quero participar" {...register('callToActionText')} />
            </div>
            <div>
              <Label htmlFor="welcomeMessage">Mensagem de boas-vindas (Home)</Label>
              <Textarea
                id="welcomeMessage"
                placeholder="Obrigado por participar desse musical!"
                {...register('welcomeMessage')}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tela de login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="loginDestaqueTitulo">"Vem aí" — título</Label>
              <Input id="loginDestaqueTitulo" placeholder="Reunião Geral" {...register('loginDestaqueTitulo')} />
              <p className="text-xs text-muted-foreground mt-1">Sem título, o bloco não aparece. Some sozinho no dia seguinte à data.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="loginDestaqueData">Data</Label>
                <Input id="loginDestaqueData" type="date" {...register('loginDestaqueData')} />
              </div>
              <div>
                <Label htmlFor="loginDestaqueHora">Horário</Label>
                <Input id="loginDestaqueHora" type="time" {...register('loginDestaqueHora')} />
              </div>
            </div>
            <div>
              <Label htmlFor="loginDestaqueLocal">Local</Label>
              <Input id="loginDestaqueLocal" placeholder="IBP" {...register('loginDestaqueLocal')} />
            </div>
            <div>
              <Label htmlFor="loginLancamentoData">Data do lançamento</Label>
              <Input id="loginLancamentoData" type="date" {...register('loginLancamentoData')} />
              <p className="text-xs text-muted-foreground mt-1">
                Até esse dia, o login convida pra inscrição. Depois, fala dos ensaios, cenas e avisos.
              </p>
            </div>
            <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
              <span className="text-sm text-gray-700">Contagem regressiva das apresentações</span>
              <input
                type="checkbox"
                {...register('loginContagemApresentacao')}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Arte / pôster</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="posterImageUrl">Link da arte (celular)</Label>
              <Input id="posterImageUrl" placeholder="https://... ou /poster.png" {...register('posterImageUrl')} />
              <p className="text-xs text-muted-foreground mt-1">Sem imagem, usamos uma tela decorativa no lugar.</p>
            </div>
            <div>
              <Label htmlFor="posterImageDesktopUrl">Link da arte (desktop, opcional)</Label>
              <Input
                id="posterImageDesktopUrl"
                placeholder="https://... ou /poster-desk.png"
                {...register('posterImageDesktopUrl')}
              />
              <p className="text-xs text-muted-foreground mt-1">Versão mais larga, usada em telas grandes. Sem essa, usa a de celular.</p>
            </div>
            <div>
              <Label htmlFor="internalBgUrl">Fundo das telas internas (logado)</Label>
              <Input id="internalBgUrl" placeholder="https://... ou /bg-interno.jpg" {...register('internalBgUrl')} />
              <p className="text-xs text-muted-foreground mt-1">Cobre a tela toda nas telas logadas (diferente da arte de login).</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ensaios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="checkinLimiteHoras">Limite de horas pro check-in de presença</Label>
              <Input
                id="checkinLimiteHoras"
                type="number"
                min={0}
                step={0.5}
                {...register('checkinLimiteHoras', { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                O elenco só pode confirmar presença no dia do ensaio, até esse tanto de horas antes do horário.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suporte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="suporteUid">Quem recebe os problemas reportados</Label>
              <PessoaSelect
                id="suporteUid"
                value={watch('suporteUid') ?? ''}
                onChange={v => setValue('suporteUid', v, { shouldDirty: true })}
                pessoas={admins}
                extras={[{ value: '', label: 'Ninguém (só aparece na lista)' }]}
                titulo="Quem recebe"
              />
              <p className="text-xs text-muted-foreground mt-1">Recebe notificação e push a cada relato. Só admins (são eles que veem a lista).</p>
            </div>
            <div>
              <Label htmlFor="suporteWhatsapp">WhatsApp do suporte</Label>
              <PhoneInput
                id="suporteWhatsapp"
                placeholder="(00) 00000-0000"
                value={watch('suporteWhatsapp') ?? ''}
                onChange={v => setValue('suporteWhatsapp', v, { shouldDirty: true })}
              />
              <p className="text-xs text-muted-foreground mt-1">Aparece como "Falar no WhatsApp" depois que a pessoa envia um problema. Vazio = não aparece.</p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saved && <Check className="h-4 w-4" />}
          Salvar
        </Button>
      </form>
    </div>
  )
}


/** Os 3 PDFs do roteiro: cada troca/remoção já grava (fora do "Salvar" do form). */
function RoteirosCard({ roteiros, onChange }: { roteiros?: AppSettings['roteiros']; onChange: () => Promise<void> }) {
  const [ocupado, setOcupado] = useState<RoteiroTipo>()
  const [erro, setErro] = useState('')

  async function run(tipo: RoteiroTipo, fn: () => Promise<void>) {
    setOcupado(tipo)
    setErro('')
    try {
      await fn()
      await onChange()
    } catch (err) {
      console.error('[roteiro]', err)
      setErro('Não deu pra salvar o PDF. Tente de novo.')
    } finally {
      setOcupado(undefined)
    }
  }

  function escolher(tipo: RoteiroTipo, file: File | undefined) {
    if (!file) return
    if (file.type !== 'application/pdf') return setErro('O roteiro precisa ser um PDF.')
    if (file.size >= 15 * 1024 * 1024) return setErro('O PDF precisa ter menos de 15 MB.')
    run(tipo, () => uploadRoteiro(tipo, file, roteiros?.[tipo]))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roteiro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ROTEIRO_TIPOS.map(({ tipo, label }) => (
          <RoteiroLinha
            key={tipo}
            label={label}
            arquivo={roteiros?.[tipo]}
            ocupado={ocupado === tipo}
            bloqueado={!!ocupado}
            onEscolher={file => escolher(tipo, file)}
            onRemover={arquivo => run(tipo, () => removerRoteiro(tipo, arquivo))}
          />
        ))}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <p className="text-xs text-muted-foreground">PDF, até 15 MB. Todo mundo logado vê na Home; sem nenhum, aparece "Em breve".</p>
      </CardContent>
    </Card>
  )
}

function RoteiroLinha({
  label,
  arquivo,
  ocupado,
  bloqueado,
  onEscolher,
  onRemover,
}: {
  label: string
  arquivo?: RoteiroArquivo
  ocupado: boolean
  bloqueado: boolean
  onEscolher: (file: File | undefined) => void
  onRemover: (arquivo: RoteiroArquivo) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    setUrl(undefined)
    if (!arquivo) return
    let ativo = true
    urlDoArquivo(arquivo.path).then(u => ativo && setUrl(u), () => {})
    return () => {
      ativo = false
    }
  }, [arquivo])

  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2.5">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={e => {
          onEscolher(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {arquivo ? (
        <p className="truncate text-xs text-muted-foreground">
          {arquivo.nome} · {new Date(arquivo.atualizadoEm).toLocaleDateString('pt-BR')}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum PDF</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {arquivo && url && (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            <FileText className="h-4 w-4" />
            Ver
          </a>
        )}
        <Button variant="outline" size="sm" className="gap-1" onClick={() => fileRef.current?.click()} disabled={bloqueado}>
          {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
          {arquivo ? 'Trocar' : 'Enviar PDF'}
        </Button>
        {arquivo && (
          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onRemover(arquivo)} disabled={bloqueado}>
            Remover
          </Button>
        )}
      </div>
    </div>
  )
}
