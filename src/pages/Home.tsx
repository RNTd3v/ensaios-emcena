import { useEffect } from 'react'
import { CalendarDays, Construction, Scroll, Shirt, Wallet } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardContent } from '@/components/ui/card'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'

const SECTIONS = [
  { icon: CalendarDays, title: 'Apresentações' },
  { icon: Wallet, title: 'Meta e gastos' },
  { icon: Scroll, title: 'Roteiro' },
  { icon: Shirt, title: 'Figurinos' },
]

export function Home() {
  const user = useAuthStore(s => s.user)
  const { settings, loaded, refresh } = useSettingsStore()

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  const firstName = user?.displayName?.trim().split(' ')[0]

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3">
          <Avatar photoURL={user?.photoURL} name={user?.displayName} className="h-12 w-12 text-base border-2 border-white/30" />
          <h1 className="text-2xl font-semibold text-white">Olá{firstName ? `, ${firstName}` : ''}!</h1>
        </div>
        <p className="text-sm text-white/85 mt-3 leading-relaxed">{settings.welcomeMessage}</p>
        <p className="text-xs text-white/60 italic mt-3 leading-relaxed">
          "Tudo o que fizerem, façam de coração, como para o Senhor, e não para os homens." — Colossenses 3:23
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SECTIONS.map(({ icon: Icon, title }) => (
          <Card key={title}>
            <CardContent className="flex flex-col items-center text-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{title}</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <Construction className="h-3 w-3 shrink-0" />
                  Em construção
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-white/60">Estamos preparando tudo com muito carinho.</p>
    </div>
  )
}
