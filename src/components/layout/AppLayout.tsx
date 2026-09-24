import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CalendarClock, CalendarDays, Clapperboard, ClipboardList, Drama, HandHeart, Home, UsersRound, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { logout } from '@/services/firebase/auth'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { PhoneMockup } from '@/components/layout/PhoneMockup'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const isAdminOrLider = user?.role === 'admin' || user?.role === 'lider'
  const { settings, loaded, refresh } = useSettingsStore()
  const hasSelection = useSelectionStore(s => s.hasSelection)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

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
            <div className="flex items-center justify-between mb-8">
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
            <div className="space-y-2">
              <MenuItem to="/" label="Início" icon={Home} end onClick={() => setMenuOpen(false)} />
              <MenuItem to="/cenas" label={isAdmin ? 'Cenas' : 'Minhas Cenas'} icon={Clapperboard} onClick={() => setMenuOpen(false)} />
              <MenuItem to="/equipes" label="Equipes" icon={UsersRound} onClick={() => setMenuOpen(false)} />
              {isAdmin && (
                <MenuItem to="/personagens" label="Personagens" icon={Drama} onClick={() => setMenuOpen(false)} />
              )}
              {isAdminOrLider && (
                <MenuItem to="/disponibilidade" label="Disponibilidade" icon={CalendarDays} onClick={() => setMenuOpen(false)} />
              )}
              <MenuItem to="/oracao" label="Relógio de oração" icon={HandHeart} onClick={() => setMenuOpen(false)} />
              <MenuItem to="/inscricao" label="Minha inscrição" icon={ClipboardList} end onClick={() => setMenuOpen(false)} />
              {isAdmin && (
                <MenuItem to="/calendario" label="Calendário geral de ensaios" icon={CalendarClock} onClick={() => setMenuOpen(false)} />
              )}
              {isAdmin && <MenuItem to="/admin" label="Admin" icon={ShieldCheck} onClick={() => setMenuOpen(false)} />}
            </div>
            <button
              onClick={() => logout()}
              className="mt-auto flex items-center gap-3 rounded-xl px-4 py-3 text-base text-white/80 hover:bg-white/10"
            >
              <LogOut className="h-5 w-5" /> Sair
            </button>
          </div>
        </div>
      )}
    </PhoneMockup>
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
