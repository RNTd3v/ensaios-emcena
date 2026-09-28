import { useRef } from 'react'
import { Input } from '@/components/ui/input'
import { digitosTelefone, formatPhone } from '@/lib/formatters'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string | undefined
  onChange: (formatado: string) => void
}

const soDigitos = (s: string) => s.replace(/\D/g, '')

/** Posição no texto formatado logo depois do n-ésimo dígito. */
function posicaoAposDigitos(formatado: string, n: number): number {
  if (n <= 0) return formatado.startsWith('(') ? 1 : 0
  let vistos = 0
  for (let i = 0; i < formatado.length; i++) {
    if (/\d/.test(formatado[i]) && ++vistos === n) return i + 1
  }
  return formatado.length
}

/**
 * Telefone com máscara "(00) 00000-0000" que deixa corrigir no meio: o cursor fica onde a pessoa
 * está digitando, apagar sobre "-", ")" ou espaço apaga o dígito anterior, número completo não
 * "empurra" o último dígito pra fora, e número colado com +55 é aceito.
 */
export function PhoneInput({ value, onChange, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const atual = value ?? ''

  function posicionarCursor(pos: number) {
    requestAnimationFrame(() => {
      const el = ref.current
      if (el && document.activeElement === el) el.setSelectionRange(pos, pos)
    })
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let bruto = e.target.value
    let cursor = e.target.selectionStart ?? bruto.length

    // Apagou só um caractere da máscara: apaga o dígito que vem antes dele.
    if (bruto.length < atual.length && soDigitos(bruto) === soDigitos(atual)) {
      let i = cursor - 1
      while (i >= 0 && !/\d/.test(bruto[i])) i--
      if (i >= 0) {
        bruto = bruto.slice(0, i) + bruto.slice(i + 1)
        cursor = i
      }
    }

    const digitos = digitosTelefone(bruto)
    const colado = digitos.length !== soDigitos(bruto).length // veio com +55/0 na frente
    // Número já completo e digitou mais um no meio: ignora a tecla (em vez de perder o último).
    if (digitos.length > 11 && !colado && soDigitos(atual).length === 11) {
      onChange(atual)
      posicionarCursor(Math.max(0, cursor - 1))
      return
    }

    const formatado = formatPhone(digitos)
    onChange(formatado)
    posicionarCursor(colado ? formatado.length : posicaoAposDigitos(formatado, soDigitos(bruto.slice(0, cursor)).length))
  }

  return <Input {...props} ref={ref} type="tel" inputMode="tel" autoComplete="tel" value={atual} onChange={handleChange} />
}
