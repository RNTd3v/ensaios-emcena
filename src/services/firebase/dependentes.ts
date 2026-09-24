import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { db } from './config'
import { deleteCenaFile, uploadArquivo } from './storage'
import type { Area, DiaSemana, Inscricao } from '@/types'

/**
 * Dependentes: crianças inscritas por um responsável, sem login próprio. Cada uma vira um
 * "usuário" (`users/dep_…`) + inscrição (`inscricoes/dep_…`) — assim aparece em tudo como qualquer
 * participante (cenas, personagens, Gerenciamento). Os responsáveis (`responsaveisUids`) cuidam da
 * inscrição; as notificações dela vão pra eles (functions/src/index.ts).
 */

function toIso(value: unknown): string {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString() ?? new Date().toISOString()
}

/** Dependentes de que `uid` é responsável. */
export function subscribeToDependentes(uid: string, callback: (lista: Inscricao[]) => void) {
  const q = query(collection(db, 'inscricoes'), where('responsaveisUids', 'array-contains', uid))
  return onSnapshot(
    q,
    snap =>
      callback(
        snap.docs
          .map(d => ({ ...d.data(), uid: d.id, createdAt: toIso(d.data().createdAt) }) as Inscricao)
          .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR')),
      ),
    () => callback([]),
  )
}

export interface DependenteInput {
  nomeCompleto: string
  apelido?: string
  idade: number
  areas: Area[]
  dias: DiaSemana[]
  observacoes?: string
  /** Responsáveis (quem está cadastrando primeiro). */
  responsaveisUids: string[]
}

/**
 * Cria ou atualiza o dependente. Telefone, e-mail e "responsável" da inscrição vêm de quem está
 * cadastrando (`responsavel`), pra quem gerencia ter com quem falar.
 */
export async function salvarDependente(
  input: DependenteInput,
  foto: File | undefined,
  responsavel: Pick<Inscricao, 'nomeCompleto' | 'telefone' | 'email'>,
  existente?: Inscricao,
): Promise<string> {
  const id = existente?.uid ?? `dep_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  const nome = input.nomeCompleto.trim()
  const apelido = input.apelido?.trim() || nome.split(' ')[0]

  let fotoUrl = existente?.fotoUrl
  let fotoPath = existente?.fotoPath
  if (foto) {
    const up = await uploadArquivo(`dependentes/${id}`, foto)
    if (fotoPath) await deleteCenaFile(fotoPath)
    fotoUrl = up.url
    fotoPath = up.path
  }

  const batch = writeBatch(db)
  const userRef = doc(db, 'users', id)
  if (existente) {
    batch.update(userRef, { displayName: apelido, photoURL: fotoUrl ?? null, responsaveisUids: input.responsaveisUids })
  } else {
    batch.set(userRef, {
      uid: id,
      email: '',
      displayName: apelido,
      photoURL: fotoUrl ?? null,
      role: 'participante',
      active: true,
      dependente: true,
      responsaveisUids: input.responsaveisUids,
      createdAt: serverTimestamp(),
    })
  }

  const dados = {
    uid: id,
    nomeCompleto: nome,
    apelido,
    telefone: responsavel.telefone,
    email: responsavel.email,
    menorDeIdade: true,
    responsavel: { nome: responsavel.nomeCompleto, telefone: responsavel.telefone },
    areas: input.areas,
    disponibilidade: { dias: input.dias },
    ...(input.observacoes?.trim() ? { observacoes: input.observacoes.trim() } : {}),
    idade: input.idade,
    ...(fotoUrl ? { fotoUrl, fotoPath } : {}),
    dependente: true,
    responsaveisUids: input.responsaveisUids,
    updatedAt: serverTimestamp(),
  }
  const inscricaoRef = doc(db, 'inscricoes', id)
  if (existente) batch.update(inscricaoRef, dados)
  else batch.set(inscricaoRef, { ...dados, status: 'pendente', createdAt: serverTimestamp() })

  await batch.commit()
  return id
}
