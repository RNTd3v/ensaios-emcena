import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { AdminGuard } from '@/components/layout/AdminGuard'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'
import { Login } from '@/pages/Login'
import { Inscricao } from '@/pages/Inscricao'
import { Admin } from '@/pages/Admin'
import { AdminConfig } from '@/pages/AdminConfig'
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
          <Route index element={<Inscricao />} />
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PWAUpdatePrompt />
    </BrowserRouter>
  )
}

export default App
