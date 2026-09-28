import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './stores/themeStore'
import App from './App.tsx'

// Cache de avatares de uma versão anterior do service worker guardou fotos quebradas — apaga.
if ('caches' in window) caches.delete('avatares').catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
