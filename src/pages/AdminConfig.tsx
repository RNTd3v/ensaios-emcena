import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { saveSettings } from '@/services/firebase/settings'
import { useSettingsStore } from '@/stores/settingsStore'
import type { AppSettings } from '@/types'

export function AdminConfig() {
  const { settings, loaded, refresh } = useSettingsStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  const { register, handleSubmit, reset } = useForm<Omit<AppSettings, 'updatedAt'>>({ values: settings })

  useEffect(() => {
    reset(settings)
  }, [settings, reset])

  async function onSubmit(data: Omit<AppSettings, 'updatedAt'>) {
    setSaving(true)
    try {
      await saveSettings(data)
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
              <Label htmlFor="roteiroUrl">Link do roteiro</Label>
              <Input id="roteiroUrl" placeholder="https://docs.google.com/..." {...register('roteiroUrl')} />
              <p className="text-xs text-muted-foreground mt-1">Sem link, a Home mostra o roteiro como "Em breve".</p>
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

        <Button type="submit" className="w-full" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saved && <Check className="h-4 w-4" />}
          Salvar
        </Button>
      </form>
    </div>
  )
}

