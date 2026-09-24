export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Link pra abrir uma conversa no WhatsApp com o número (assume Brasil, DDD + número). */
export function whatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountryCode = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${withCountryCode}`
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Formata um valor em reais: 1234.5 -> "R$ 1.234,50". */
export function formatBRL(valor: number): string {
  return BRL.format(valor)
}
