import type { RoteiroTipo } from '@/types'

/** Os PDFs do roteiro, na ordem em que aparecem (Home e Configurações). */
export const ROTEIRO_TIPOS: { tipo: RoteiroTipo; label: string }[] = [
  { tipo: 'normal', label: 'Roteiro' },
  { tipo: 'grande', label: 'Roteiro (letra grande)' },
  { tipo: 'contexto', label: 'Contexto' },
]
