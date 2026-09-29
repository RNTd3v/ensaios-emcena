import { rodandoInstalado } from '@/lib/instalacao'

/**
 * Diagnóstico pro "Reportar problema": guarda as últimas mensagens do console (log/warn/error),
 * erros não tratados e promessas rejeitadas — é o que faltou pra entender o login travado no
 * iPhone. Fica também no localStorage, pra sobreviver a fechar/reabrir o app entre o problema e o
 * relato. Só vai pro servidor quando a pessoa envia um relato.
 */

const MAX_REGISTROS = 80
const STORAGE_KEY = 'diagnostico.registros'

let registros: string[] = (() => {
  try {
    const salvo = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(salvo) ? salvo.slice(-MAX_REGISTROS) : []
  } catch {
    return []
  }
})()

let salvarAgendado = false
function salvar() {
  if (salvarAgendado) return
  salvarAgendado = true
  setTimeout(() => {
    salvarAgendado = false
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(registros))
    } catch {
      // storage cheio/indisponível — fica só em memória
    }
  }, 1000)
}

function texto(valor: unknown): string {
  if (valor instanceof Error) return `${valor.name}: ${valor.message}${(valor as { code?: string }).code ? ` [${(valor as { code?: string }).code}]` : ''}`
  if (typeof valor === 'string') return valor
  try {
    return JSON.stringify(valor)
  } catch {
    return String(valor)
  }
}

function guardar(nivel: string, args: unknown[]) {
  const hora = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  registros.push(`${hora} ${nivel} ${args.map(texto).join(' ')}`.slice(0, 600))
  if (registros.length > MAX_REGISTROS) registros = registros.slice(-MAX_REGISTROS)
  salvar()
}

/** Chamado no main.tsx, antes do React. */
export function capturarDiagnostico() {
  for (const nivel of ['log', 'warn', 'error'] as const) {
    const original = console[nivel].bind(console)
    console[nivel] = (...args: unknown[]) => {
      guardar(nivel.toUpperCase(), args)
      original(...args)
    }
  }
  window.addEventListener('error', e => guardar('ERRO', [e.message, e.filename ? `${e.filename}:${e.lineno}` : '']))
  window.addEventListener('unhandledrejection', e => guardar('ERRO', ['promise rejeitada:', e.reason]))
}

export function registrosRecentes(): string[] {
  return [...registros]
}

export interface InfoAparelho {
  userAgent: string
  instalado: boolean
  online: boolean
  tela: string
  idioma: string
  versao: string
}

export function infoDoAparelho(): InfoAparelho {
  return {
    userAgent: navigator.userAgent,
    instalado: rodandoInstalado(),
    online: navigator.onLine,
    tela: `${window.screen.width}x${window.screen.height} (janela ${window.innerWidth}x${window.innerHeight})`,
    idioma: navigator.language,
    versao: __APP_BUILD__,
  }
}
