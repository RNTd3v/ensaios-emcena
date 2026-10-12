import { collection, deleteField, doc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
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
 * Tudo numa transação — ou sai de tudo, ou de nada —, relendo cenas, equipes e oração na hora de
 * gravar (as listas são regravadas inteiras; com a leitura velha, desfaria o que outra pessoa salvou
 * nesse meio-tempo). Só admin (regras). Reativar não desfaz.
 */
export async function desvincularPessoa(uid: string, byUid: string): Promise<ResumoDesvinculo> {
  const [cenasSnap, catalogoSnap, equipesSnap] = await Promise.all([
    getDocs(collection(db, 'cenas')),
    getDocs(query(collection(db, 'personagens'), where('participanteUid', '==', uid))),
    getDocs(collection(db, 'equipes')),
  ])
  // Tarefas em aberto dela voltam pra "sem responsável"; as concluídas/canceladas ficam como histórico.
  const tarefasSnaps = await Promise.all(
    equipesSnap.docs.map(e => getDocs(query(collection(db, 'equipes', e.id, 'tarefas'), where('responsavelUid', '==', uid)))),
  )
  const oracaoRef = doc(db, 'oracao', 'config')

  return runTransaction(db, async tx => {
    const [cenas, equipes, oracaoSnap] = await Promise.all([
      Promise.all(cenasSnap.docs.map(d => tx.get(d.ref))),
      Promise.all(equipesSnap.docs.map(d => tx.get(d.ref))),
      tx.get(oracaoRef),
    ])
    const resumo: ResumoDesvinculo = { cenas: 0, personagens: 0, equipes: 0, tarefas: 0, oracao: false }

    for (const snap of cenas) {
      const data = snap.data()
      if (!data) continue
      const participantes = (data.participantes as string[] | undefined) ?? []
      const assistentes = (data.assistentes as string[] | undefined) ?? []
      const personagens = (data.personagens as Personagem[] | undefined) ?? []
      const personagensDela = personagens.filter(p => p.participanteUid === uid).length
      if (!participantes.includes(uid) && !assistentes.includes(uid) && data.liderUid !== uid && !personagensDela) continue

      tx.update(snap.ref, {
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
        tx.update(snap.ref, { participanteUid: null })
      } else {
        tx.set(doc(db, 'personagens', novoId), { nome, participanteUid: null }, { merge: true })
        tx.delete(snap.ref)
      }
    }

    for (const snap of equipes) {
      const data = snap.data()
      if (!data) continue
      const membros = (data.membros as string[] | undefined) ?? []
      const assistentes = (data.assistentes as string[] | undefined) ?? []
      if (data.liderUid !== uid && !membros.includes(uid) && !assistentes.includes(uid)) continue
      tx.update(snap.ref, {
        membros: membros.filter(m => m !== uid),
        assistentes: assistentes.filter(a => a !== uid),
        ...(data.liderUid === uid && { liderUid: deleteField() }),
      })
      resumo.equipes++
    }

    for (const snap of tarefasSnaps.flatMap(s => s.docs)) {
      const status = snap.data().status as string
      if (status === 'feito' || status === 'cancelado') continue
      tx.update(snap.ref, { responsavelUid: deleteField() })
      resumo.tarefas++
    }

    const oracao = oracaoSnap.data()
    const assistentesOracao = (oracao?.assistentes as string[] | undefined) ?? []
    if (oracao && (oracao.liderUid === uid || assistentesOracao.includes(uid))) {
      tx.update(oracaoRef, {
        assistentes: assistentesOracao.filter(a => a !== uid),
        ...(oracao.liderUid === uid && { liderUid: null }),
        updatedAt: serverTimestamp(),
      })
      resumo.oracao = true
    }

    return resumo
  })
}
