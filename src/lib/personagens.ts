import type { Cena, DiaSemana, Personagem, PersonagemCatalogo } from '@/types'

/** Palavras ou expressões (inteiras) que marcam um papel coletivo. */
const PAPEIS_COLETIVOS = [
  'coro',
  'ensemble',
  'soldado',
  'soldados',
  'familiar',
  'familiares',
  'passageiro',
  'passageiros',
  'casal dançando',
  'casais dançando',
]

/** Papel coletivo (ex.: "Coro - moradora", "Ensemble", "Casal dançando"): o mesmo nome é interpretado por várias pessoas. */
export function isCoro(nome: string): boolean {
  const palavras = ` ${nome.toLowerCase().split(/[^a-zà-ÿ]+/).filter(Boolean).join(' ')} `
  return PAPEIS_COLETIVOS.some(termo => palavras.includes(` ${termo} `))
}

/**
 * Chave que identifica "o mesmo personagem" entre cenas diferentes: o nome normalizado. Em papéis
 * coletivos (ver `PAPEIS_COLETIVOS`) o nome sozinho não identifica ninguém, então a pessoa entra na chave — cada integrante
 * do grupo vira um personagem próprio na lista.
 */
export function personagemKey(nome: string, participanteUid?: string): string {
  const base = nome.trim().toLowerCase()
  return isCoro(base) ? `${base}::${participanteUid ?? ''}` : base
}

export interface PersonagemOcorrencia {
  cena: Cena
  personagem: Personagem
}

/** Um personagem deduplicado por nome (ou nome + pessoa, no coro), juntando todas as cenas onde ele aparece + o catálogo. */
export interface PersonagemAgregado {
  key: string
  nome: string
  participanteUid?: string
  ocorrencias: PersonagemOcorrencia[]
  noCatalogo: boolean
}

/**
 * Junta os personagens das cenas (ativas e inativas) com o catálogo, sem duplicar (ver `personagemKey`). Os
 * dados das cenas prevalecem sobre o catálogo; entre cenas, vale o primeiro vínculo com pessoa.
 */
export function agregarPersonagens(cenas: Cena[], catalogo: PersonagemCatalogo[]): PersonagemAgregado[] {
  const porKey = new Map<string, PersonagemAgregado>()

  for (const cena of cenas) {
    for (const p of cena.personagens) {
      if (!p.nome.trim()) continue
      const key = personagemKey(p.nome, p.participanteUid)
      const atual = porKey.get(key)
      if (!atual) {
        porKey.set(key, { key, nome: p.nome.trim(), participanteUid: p.participanteUid, ocorrencias: [{ cena, personagem: p }], noCatalogo: false })
      } else {
        atual.ocorrencias.push({ cena, personagem: p })
        if (!atual.participanteUid && p.participanteUid) atual.participanteUid = p.participanteUid
      }
    }
  }

  for (const c of catalogo) {
    const key = personagemKey(c.nome, c.participanteUid)
    const atual = porKey.get(key)
    if (atual) atual.noCatalogo = true
    else porKey.set(key, { key, nome: c.nome, participanteUid: c.participanteUid, ocorrencias: [], noCatalogo: true })
  }

  return [...porKey.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
}

/** A pessoa consegue ensaiar essa cena se estiver disponível em todos os dias de ensaio dela. */
export function cenaCabeNaDisponibilidade(cena: Cena, dias: DiaSemana[]): boolean {
  return cena.dias.every(d => dias.includes(d))
}
