import { useEffect, useState } from 'react'
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import type { InscricaoStatus } from '@/types'

/**
 * Status da inscrição de cada pessoa, direto da coleção `inscricoes` (só admin lê) — `null`
 * enquanto carrega. Quem não aparece aqui não fez inscrição. Melhor que a cópia no perfil
 * (`AppUser.inscricaoStatus`), que só é preenchida quando o admin abre o Gerenciamento.
 */
export function useInscricoesStatus(ativo = true): Record<string, InscricaoStatus> | null {
  const [porUid, setPorUid] = useState<Record<string, InscricaoStatus> | null>(null)
  useEffect(() => {
    if (!ativo) return
    return subscribeToAllInscricoes(lista => setPorUid(Object.fromEntries(lista.map(i => [i.uid, i.status]))))
  }, [ativo])
  return porUid
}

/** Fez inscrição e ela não foi recusada (pendente ou confirmada). */
export function inscricaoValida(status: InscricaoStatus | undefined): boolean {
  return !!status && status !== 'recusado'
}
