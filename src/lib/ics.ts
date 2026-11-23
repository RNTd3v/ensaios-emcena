/**
 * Gera eventos iCalendar (.ics) — o formato que o Calendário da Apple, o Google Agenda e o Outlook
 * entendem. Os horários do app são sempre de São Paulo (sem horário de verão desde 2019).
 * A Cloud Function `calendarioIcs` (functions/src/ics.ts) tem uma cópia deste gerador.
 */

export interface EventoIcs {
  /** Estável: o mesmo id no arquivo avulso e na assinatura faz o calendário tratar como um evento só. */
  uid: string
  titulo: string
  /** YYYY-MM-DD */
  data: string
  /** HH:mm */
  horario: string
  duracaoMin?: number
  local?: string
  descricao?: string
  url?: string
  cancelado?: boolean
  /** Lembretes, em minutos antes do início. Sem o campo, vale `ALARMES_PADRAO_MIN`; `[]` = sem lembrete. */
  alarmesMin?: number[]
}

export const DURACAO_PADRAO_MIN = 120

/** Lembretes padrão: na véspera (24h antes) e 1h antes. O Calendário da Apple respeita; o Google Agenda usa os lembretes dele. */
export const ALARMES_PADRAO_MIN = [1440, 60]

const FUSO = 'America/Sao_Paulo'

function escapar(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Linhas do iCalendar têm no máximo 75 octetos; o resto continua na linha seguinte, com um espaço. */
function dobrar(linha: string): string {
  const enc = new TextEncoder()
  if (enc.encode(linha).length <= 75) return linha
  const partes: string[] = []
  let atual = ''
  for (const ch of linha) {
    const limite = partes.length === 0 ? 75 : 74
    if (enc.encode(atual + ch).length > limite) {
      partes.push(atual)
      atual = ch
    } else {
      atual += ch
    }
  }
  partes.push(atual)
  return partes.join('\r\n ')
}

/** "2026-09-25" + "19:30" -> "20260925T193000". */
function dataHora(data: string, horario: string, somarMin = 0): string {
  const [a, m, d] = data.split('-').map(Number)
  const [h, min] = horario.split(':').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d, h, min + somarMin))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}T${p(t.getUTCHours())}${p(t.getUTCMinutes())}00`
}

function agoraUtc(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function vevent(e: EventoIcs): string[] {
  const dur = e.duracaoMin ?? DURACAO_PADRAO_MIN
  const linhas = [
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${agoraUtc()}`,
    `DTSTART;TZID=${FUSO}:${dataHora(e.data, e.horario)}`,
    `DTEND;TZID=${FUSO}:${dataHora(e.data, e.horario, dur)}`,
    `SUMMARY:${escapar(e.titulo)}`,
  ]
  if (e.local) linhas.push(`LOCATION:${escapar(e.local)}`)
  if (e.descricao) linhas.push(`DESCRIPTION:${escapar(e.descricao)}`)
  if (e.url) linhas.push(`URL:${e.url}`)
  linhas.push(`STATUS:${e.cancelado ? 'CANCELLED' : 'CONFIRMED'}`)
  if (!e.cancelado) {
    for (const min of e.alarmesMin ?? ALARMES_PADRAO_MIN) {
      linhas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(e.titulo)}`, `TRIGGER:-PT${min}M`, 'END:VALARM')
    }
  }
  linhas.push('END:VEVENT')
  return linhas
}

export function montarIcs(eventos: EventoIcs[], nomeCalendario = 'Ensaios — Vila Esperança'): string {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ensaios EMCENA//PT-BR',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapar(nomeCalendario)}`,
    `X-WR-TIMEZONE:${FUSO}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    'BEGIN:VTIMEZONE',
    `TZID:${FUSO}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0300',
    'TZNAME:-03',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...eventos.flatMap(vevent),
    'END:VCALENDAR',
  ]
  return linhas.map(dobrar).join('\r\n') + '\r\n'
}

/** Link que abre o Google Agenda já com o evento preenchido (só falta salvar). */
export function linkGoogleAgenda(e: EventoIcs): string {
  const dur = e.duracaoMin ?? DURACAO_PADRAO_MIN
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    dates: `${dataHora(e.data, e.horario)}/${dataHora(e.data, e.horario, dur)}`,
    ctz: FUSO,
  })
  if (e.local) params.set('location', e.local)
  const detalhes = [e.descricao, e.url].filter(Boolean).join('\n\n')
  if (detalhes) params.set('details', detalhes)
  return `https://calendar.google.com/calendar/render?${params}`
}

/** Baixa/abre o .ics — no iPhone e no Mac abre direto o "Adicionar ao Calendário". */
export function baixarIcs(e: EventoIcs, nomeArquivo = 'ensaio'): void {
  const blob = new Blob([montarIcs([e])], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nomeArquivo.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'ensaio'}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
