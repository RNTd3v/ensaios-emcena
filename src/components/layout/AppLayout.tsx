import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CalendarClock, CalendarDays, Candy, Clapperboard, ExternalLink, Ticket, ClipboardList, Drama, HandHeart, Home, Music, Shirt, Target, UsersRound, LogOut, Menu, Monitor, Moon, ShieldCheck, Sun, X } from 'lucide-react'
import { logout } from '@/services/firebase/auth'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { useInscricaoStore } from '@/stores/inscricaoStore'
import { useThemeStore, type Tema } from '@/stores/themeStore'
import { useOracaoVisivel } from '@/hooks/useOracaoVisivel'
import { useEquipesVisivel } from '@/hooks/useEquipesVisivel'
import { APP_DOCES_URL, APP_RIFAS_URL } from '@/services/externo/vendas'
import { PhoneMockup } from '@/components/layout/PhoneMockup'
import { SinoNotificacoes } from '@/components/layout/SinoNotificacoes'
import { ativarPush } from '@/services/firebase/notificacoes'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const isAdminOrLider = user?.role === 'admin' || user?.role === 'lider'
  const { settings, loaded, refresh } = useSettingsStore()
  const hasSelection = useSelectionStore(s => s.hasSelection)
  /** Sem inscrição (e não admin): o menu só mostra "Minha inscrição" — o resto fica bloqueado. */
  const semInscricao = useInscricaoStore(s => s.existe === false) && !isAdmin
  const oracaoVisivel = useOracaoVisivel()
  const equipesVisivel = useEquipesVisivel()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  // Aparelho que já liberou notificações: renova o token do push ao abrir o app (ele pode mudar
  // com o tempo) — sem pedir nada, já que a permissão foi dada.
  const uid = user?.uid
  useEffect(() => {
    if (!uid || !('Notification' in window) || Notification.permission !== 'granted') return
    ativarPush(uid).catch(() => {})
  }, [uid])

  return (
    <PhoneMockup>
      <div className="absolute inset-0">
        {settings.internalBgUrl ? (
          <img src={settings.internalBgUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full hero-card-green" style={{ borderRadius: 0 }} />
        )}
      </div>

      <header className="header-page relative z-20 shrink-0 px-4 pb-2">
        <button
          onClick={() => setMenuOpen(true)}
          className="absolute left-4 top-[calc(0.5rem+env(safe-area-inset-top,0px))] text-white p-2 rounded-full bg-white/15 backdrop-blur-md border border-white/25"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Sem inscrição ainda: nada além do formulário (o sino levaria pra fora dele). */}
        {!semInscricao && <SinoNotificacoes />}
        <div className="flex justify-center">
          <img src="/logo-musical.png" alt={settings.eventName} className="w-full max-w-[80vw] h-auto mt-8" />
        </div>
      </header>

      <main className="flex-1 relative z-10 px-4 pb-4 overflow-y-auto">
        <Outlet />
      </main>

      <footer className={cn('relative z-10 flex shrink-0 items-center justify-center py-4', hasSelection && 'hidden')}>
        <img src="/logo-emcena.png" alt="EmCena 575" className="w-full max-w-[120px] h-auto opacity-90" />
      </footer>

      {menuOpen && (
        <div className="absolute inset-0 z-40 bg-black/50" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-full bg-black/70 backdrop-blur-xl shadow-2xl p-5 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex flex-col text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between mb-8">
              <div className="flex items-center gap-3 min-w-0">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-full border border-white/30 shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center text-base font-semibold shrink-0">
                    {user?.displayName?.[0]?.toUpperCase()}
                  </div>
                )}
                <p className="text-base font-medium truncate">{user?.displayName}</p>
              </div>
              <button onClick={() => setMenuOpen(false)} className="shrink-0 p-2">
                <X className="h-6 w-6 text-white/70" />
              </button>
            </div>
            {/* Lista rola sozinha quando não cabe; o "Sair" fica fixo embaixo. */}
            <div className="-mx-1 min-h-0 flex-1 space-y-2 overflow-y-auto px-1 pb-2">
              {!semInscricao && (
                <>
                  <MenuItem to="/" label="Início" icon={Home} end onClick={() => setMenuOpen(false)} />
                  <MenuItem to="/cenas" label={isAdmin ? 'Cenas' : 'Minhas Cenas'} icon={Clapperboard} onClick={() => setMenuOpen(false)} />
                  {equipesVisivel && (
                    <MenuItem to="/equipes" label="Equipes" icon={UsersRound} onClick={() => setMenuOpen(false)} />
                  )}
                  {oracaoVisivel && (
                    <MenuItem to="/oracao" label="Relógio de oração" icon={HandHeart} onClick={() => setMenuOpen(false)} />
                  )}
                  <MenuItem to="/metas-gastos" label="Metas e gastos" icon={Target} onClick={() => setMenuOpen(false)} />

                  <MenuDivider />
                  <MenuItem to="/musicas" label="Músicas" icon={Music} onClick={() => setMenuOpen(false)} />
                  <MenuItem to="/figurinos" label="Figurinos" icon={Shirt} onClick={() => setMenuOpen(false)} />

                  <MenuDivider label="Vendas" />
                  <MenuLinkExterno href={APP_RIFAS_URL} label="Rifas" icon={Ticket} />
                  <MenuLinkExterno href={APP_DOCES_URL} label="Doces" icon={Candy} />

                  {isAdminOrLider && (
                    <>
                      <MenuDivider label="Admin" />
                      <MenuItem to="/disponibilidade" label="Disponibilidade" icon={CalendarDays} onClick={() => setMenuOpen(false)} />
                      {isAdmin && (
                        <>
                          <MenuItem to="/personagens" label="Personagens" icon={Drama} onClick={() => setMenuOpen(false)} />
                          <MenuItem to="/calendario" label="Calendário geral de ensaios" icon={CalendarClock} onClick={() => setMenuOpen(false)} />
                          <MenuItem to="/admin" label="Gerenciamento" icon={ShieldCheck} onClick={() => setMenuOpen(false)} />
                        </>
                      )}
                    </>
                  )}
                </>
              )}

              {!semInscricao && <MenuDivider />}
              <MenuItem to="/inscricao" label="Minha inscrição" icon={ClipboardList} end onClick={() => setMenuOpen(false)} />
            </div>
            <SeletorTema />
            <button
              onClick={() => logout()}
              className="mt-2 flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] text-base text-white/80 hover:bg-white/10"
            >
              <LogOut className="h-5 w-5" /> Sair
            </button>
          </div>
        </div>
      )}
    </PhoneMockup>
  )
}

const OPCOES_TEMA: { value: Tema; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'claro', label: 'Claro', icon: Sun },
  { value: 'escuro', label: 'Escuro', icon: Moon },
  { value: 'sistema', label: 'Sistema', icon: Monitor },
]

/** Alterna entre tema claro, escuro ou o do aparelho. */
function SeletorTema() {
  const { tema, setTema } = useThemeStore()
  return (
    <div className="mt-2 flex shrink-0 gap-1 rounded-xl bg-white/10 p-1" role="radiogroup" aria-label="Tema">
      {OPCOES_TEMA.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={tema === value}
          onClick={() => setTema(value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium',
            tema === value ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10',
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  )
}

/** Item do menu que abre outro app (rifas, doces) numa aba nova. */
function MenuLinkExterno({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-white/80 hover:bg-white/10"
    >
      <Icon className="h-5 w-5" />
      <span className="flex-1">{label}</span>
      <ExternalLink className="h-4 w-4 text-white/50" />
    </a>
  )
}

/** Separador entre grupos do menu, com rótulo opcional (ex.: "Admin"). */
function MenuDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-3 pb-1" role="separator">
      {label && <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</span>}
      <span className="h-px flex-1 bg-white/15" />
    </div>
  )
}

interface MenuItemProps {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
  onClick: () => void
}

function MenuItem({ to, label, icon: Icon, end, onClick }: MenuItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium',
          isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10',
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  )
}
