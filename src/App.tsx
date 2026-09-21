import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { AdminGuard } from '@/components/layout/AdminGuard'
import { AdminOrLiderGuard } from '@/components/layout/AdminOrLiderGuard'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'
import { Login } from '@/pages/Login'
import { Home } from '@/pages/Home'
import { Inscricao } from '@/pages/Inscricao'
import { Admin } from '@/pages/Admin'
import { AdminConfig } from '@/pages/AdminConfig'
import { EmConstrucao } from '@/pages/EmConstrucao'
import { Elencos } from '@/pages/Elencos'
import { Disponibilidade } from '@/pages/Disponibilidade'
import { initAuth } from '@/stores/authStore'

function App() {
  useEffect(() => {
    const unsub = initAuth()
    return unsub
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        >
          <Route index element={<Home />} />
          <Route path="inscricao" element={<Inscricao />} />
          <Route
            path="admin"
            element={
              <AdminGuard>
                <Admin />
              </AdminGuard>
            }
          />
          <Route
            path="admin/config"
            element={
              <AdminGuard>
                <AdminConfig />
              </AdminGuard>
            }
          />
          <Route
            path="admin/em-construcao"
            element={
              <AdminGuard>
                <EmConstrucao />
              </AdminGuard>
            }
          />
          <Route
            path="elencos"
            element={
              <AdminOrLiderGuard>
                <Elencos />
              </AdminOrLiderGuard>
            }
          />
          <Route
            path="disponibilidade"
            element={
              <AdminOrLiderGuard>
                <Disponibilidade />
              </AdminOrLiderGuard>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PWAUpdatePrompt />
    </BrowserRouter>
  )
}

export default App
