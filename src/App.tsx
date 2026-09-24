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
import { Cenas } from '@/pages/Cenas'
import { CenaDetalhe } from '@/pages/CenaDetalhe'
import { EnsaioAoVivo } from '@/pages/EnsaioAoVivo'
import { PersonagemDetalhe } from '@/pages/PersonagemDetalhe'
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
          <Route path="cenas" element={<Cenas />} />
          <Route path="cenas/:id" element={<CenaDetalhe />} />
          <Route path="cenas/:id/iniciar-ensaio" element={<EnsaioAoVivo />} />
          <Route path="cenas/:cenaId/personagens/:personagemId" element={<PersonagemDetalhe />} />
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
