import type { Ensaio, Personagem } from '@/types'

/**
 * Personagens (com pessoa vinculada) chamados pro ensaio: com obrigatórios marcados, só eles; sem
 * nenhum, a cena toda. Quem não é chamado nem vê o ensaio na Home, nem confirma presença — se
 * aparecer mesmo assim, a liderança marca em "Também presentes". Espelha `publicoDoEnsaio` nas
 * functions (quem recebe os avisos).
 */
export function elencoDoEnsaio(personagens: Personagem[], obrigatorios: string[] | undefined): Personagem[] {
  const comPessoa = personagens.filter(p => p.participanteUid)
  return obrigatorios?.length ? comPessoa.filter(p => obrigatorios.includes(p.id)) : comPessoa
}

/** Uids chamados pro ensaio (ver `elencoDoEnsaio`). */
export function uidsDoEnsaio(personagens: Personagem[], ensaio: Pick<Ensaio, 'obrigatorios'> | undefined): Set<string> {
  return new Set(elencoDoEnsaio(personagens, ensaio?.obrigatorios).map(p => p.participanteUid as string))
}
