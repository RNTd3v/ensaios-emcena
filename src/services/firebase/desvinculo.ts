import { collection, deleteField, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { db } from './config'
import { personagemKey } from '@/lib/personagens'
import type { Personagem } from '@/types'

/** O que foi desfeito — pra mostrar pra quem revogou/recusou. */
export interface ResumoDesvinculo {
  cenas: number
  personagens: number
  equipes: number
  tarefas: number
  oracao: boolean
}

/**
 * Tira a pessoa de tudo quando a inscrição é recusada ou o acesso revogado: cenas (participante,
 * líder, assistente), personagens (ficam sem ninguém até alguém vincular outra pessoa), equipes
 * (membro, líder, assistente), tarefas em aberto atribuídas a ela e a equipe do relógio de oração.
 * Tudo num único batch — ou sai de tudo, ou de nada. Só admin (regras). Reativar não desfaz.
 */
export async function desvincularPessoa(uid: string, byUid: string): Promise<ResumoDesvinculo> {
  const [cenasSnap, catalogoSnap, equipesSnap, oracaoSnap] = await Promise.all([
    getDocs(collection(db, 'cenas')),
    getDocs(query(collection(db, 'personagens'), where('participanteUid', '==', uid))),
    getDocs(collection(db, 'equipes')),
    getDoc(doc(db, 'oracao', 'config')),
  ])
  const batch = writeBatch(db)
  const resumo: ResumoDesvinculo = { cenas: 0, personagens: 0, equipes: 0, tarefas: 0, oracao: false }

  for (const snap of cenasSnap.docs) {
    const data = snap.data()
    const participantes = (data.participantes as string[] | undefined) ?? []
    const assistentes = (data.assistentes as string[] | undefined) ?? []
    const personagens = (data.personagens as Personagem[] | undefined) ?? []
    const personagensDela = personagens.filter(p => p.participanteUid === uid).length
    if (!participantes.includes(uid) && !assistentes.includes(uid) && data.liderUid !== uid && !personagensDela) continue

    batch.update(snap.ref, {
      participantes: participantes.filter(p => p !== uid),
      assistentes: assistentes.filter(a => a !== uid),
      ...(data.liderUid === uid && { liderUid: deleteField() }),
      personagens: personagens.map(p => (p.participanteUid === uid ? { ...p, participanteUid: undefined } : p)),
      updatedByUid: byUid,
      updatedAt: serverTimestamp(),
    })
    resumo.cenas++
    resumo.personagens += personagensDela
  }

  // No catálogo, o id do coro inclui a pessoa (ver `personagemKey`): sem ela, o doc muda de id.
  for (const snap of catalogoSnap.docs) {
    const nome = snap.data().nome as string
    const novoId = encodeURIComponent(personagemKey(nome, undefined))
    if (novoId === snap.id) {
      batch.update(snap.ref, { participanteUid: null })
    } else {
      batch.set(doc(db, 'personagens', novoId), { nome, participanteUid: null }, { merge: true })
      batch.delete(snap.ref)
    }
  }

  const equipesDela = equipesSnap.docs.filter(snap => {
    const data = snap.data()
    return data.liderUid === uid || ((data.membros as string[] | undefined) ?? []).includes(uid) || ((data.assistentes as string[] | undefined) ?? []).includes(uid)
  })
  for (const snap of equipesDela) {
    const data = snap.data()
    batch.update(snap.ref, {
      membros: ((data.membros as string[] | undefined) ?? []).filter(m => m !== uid),
      assistentes: ((data.assistentes as string[] | undefined) ?? []).filter(a => a !== uid),
      ...(data.liderUid === uid && { liderUid: deleteField() }),
    })
    resumo.equipes++
  }

  // Tarefas em aberto dela voltam pra "sem responsável"; as concluídas/canceladas ficam como histórico.
  const tarefasSnaps = await Promise.all(
    equipesSnap.docs.map(e => getDocs(query(collection(db, 'equipes', e.id, 'tarefas'), where('responsavelUid', '==', uid)))),
  )
  for (const snap of tarefasSnaps.flatMap(s => s.docs)) {
    const status = snap.data().status as string
    if (status === 'feito' || status === 'cancelado') continue
    batch.update(snap.ref, { responsavelUid: deleteField() })
    resumo.tarefas++
  }

  const oracao = oracaoSnap.data()
  const assistentesOracao = (oracao?.assistentes as string[] | undefined) ?? []
  if (oracao && (oracao.liderUid === uid || assistentesOracao.includes(uid))) {
    batch.update(oracaoSnap.ref, {
      assistentes: assistentesOracao.filter(a => a !== uid),
      ...(oracao.liderUid === uid && { liderUid: null }),
      updatedAt: serverTimestamp(),
    })
    resumo.oracao = true
  }

  await batch.commit()
  return resumo
}
