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

export interface PessoaDaCasaNome {
  uid: string
  nome: string
}

/**
 * Aviso pra quem tem personagem na cena mas não foi chamado pro ensaio (ele tem obrigatórios e o
 * personagem da pessoa não está entre eles). Se algum dependente da pessoa foi chamado, o aviso diz
 * quem precisa ir — a pessoa leva a criança. `null` = sem aviso.
 */
export function avisoNaoChamado(
  personagens: Personagem[],
  ensaio: Pick<Ensaio, 'obrigatorios'> | undefined,
  uid: string | undefined,
  dependentes: PessoaDaCasaNome[] = [],
): { soPrecisam: string[] } | null {
  if (!uid || !ensaio?.obrigatorios?.length) return null
  if (!personagens.some(p => p.participanteUid === uid)) return null
  const chamados = uidsDoEnsaio(personagens, ensaio)
  if (chamados.has(uid)) return null
  return { soPrecisam: dependentes.filter(d => chamados.has(d.uid)).map(d => d.nome) }
}
