/**
 * Notificações do app de ensaios: cada acontecimento vira um doc em `notificacoes` (um por
 * destinatário — é o que a tela e o sino do app leem) e um push (FCM) pros aparelhos da pessoa
 * (`fcmTokens`). Tudo nasce aqui no servidor: o app só lê e marca como lida, então ninguém consegue
 * forjar notificação pelo cliente.
 *
 * Região = a do Firestore (southamerica-east1).
 */
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, type DocumentData } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions'

initializeApp()
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 5 })

const db = getFirestore()
const APP_URL = 'https://ensaios-emcena.web.app'
const FUSO = 'America/Sao_Paulo'

type Tipo = 'ensaio' | 'figurino' | 'tarefa' | 'aviso'

interface Notificacao {
  titulo: string
  corpo: string
  /** Rota dentro do app (ex.: /cenas/abc/ensaios/xyz). */
  link?: string
  tipo: Tipo
}

// ---------- Envio ----------

function chunks<T>(lista: T[], tamanho: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho))
  return out
}

/**
 * Dependentes (crianças sem login, id `dep_…`) não recebem nada direto: cada um é trocado pelos
 * responsáveis, com o nome da criança no título. Retorna [uid, notificação] já resolvidos.
 */
async function resolverDependentes(uids: string[], n: Notificacao): Promise<[string, Notificacao][]> {
  const deps = uids.filter(u => u.startsWith('dep_'))
  const saida: [string, Notificacao][] = uids.filter(u => !u.startsWith('dep_')).map(u => [u, n])
  for (const grupo of chunks(deps, 30)) {
    const snap = await db.getAll(...grupo.map(u => db.collection('users').doc(u)))
    for (const d of snap) {
      const dados = d.data()
      if (!dados) continue
      const paraCrianca = { ...n, titulo: `${n.titulo} · ${dados.displayName ?? 'dependente'}` }
      for (const resp of (dados.responsaveisUids as string[] | undefined) ?? []) saida.push([resp, paraCrianca])
    }
  }
  return saida
}

/** Grava a notificação pra cada destinatário (menos `excetoUid`, quem causou) e manda o push. */
async function notificar(uids: (string | undefined | null)[], base: Notificacao, excetoUid?: string | null): Promise<void> {
  const unicos = [...new Set(uids.filter((u): u is string => !!u && u !== excetoUid))]
  const resolvidos = (await resolverDependentes(unicos, base)).filter(([u]) => u !== excetoUid)
  // Uma pessoa pode aparecer mais de uma vez (ela mesma + como responsável de um filho): cada
  // notificação distinta vale — mas o mesmo par (pessoa, título) só uma vez.
  const vistos = new Set<string>()
  const itens = resolvidos.filter(([u, n]) => {
    const chave = `${u}|${n.titulo}`
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
  if (!itens.length) return
  // Agrupa por conteúdo (a versão "· nome da criança" é outra notificação) e envia em lote.
  const porTitulo = new Map<string, { n: Notificacao; uids: string[] }>()
  for (const [uid, n] of itens) {
    const grupo = porTitulo.get(n.titulo) ?? { n, uids: [] }
    grupo.uids.push(uid)
    porTitulo.set(n.titulo, grupo)
  }
  for (const { n, uids: destinos } of porTitulo.values()) await gravarEEnviar(destinos, n)
}

/** Grava a notificação pra cada destinatário e manda o push pros aparelhos deles. */
async function gravarEEnviar(destinatarios: string[], n: Notificacao): Promise<void> {

  for (const grupo of chunks(destinatarios, 400)) {
    const batch = db.batch()
    for (const uid of grupo) {
      batch.set(db.collection('notificacoes').doc(), {
        uid,
        titulo: n.titulo,
        corpo: n.corpo,
        link: n.link ?? null,
        tipo: n.tipo,
        lida: false,
        createdAt: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()
  }

  // Tokens dos aparelhos (consulta `in` aceita até 30 valores por vez).
  const tokens: { token: string; ref: FirebaseFirestore.DocumentReference }[] = []
  for (const grupo of chunks(destinatarios, 30)) {
    const snap = await db.collection('fcmTokens').where('uid', 'in', grupo).get()
    snap.forEach(d => tokens.push({ token: d.id, ref: d.ref }))
  }
  if (!tokens.length) return

  const link = `${APP_URL}${n.link ?? '/notificacoes'}`
  for (const grupo of chunks(tokens, 500)) {
    const res = await getMessaging().sendEachForMulticast({
      tokens: grupo.map(t => t.token),
      // Só `data`: o service worker do app (public/firebase-messaging-sw.js) monta a notificação.
      data: { titulo: n.titulo, corpo: n.corpo, link, tipo: n.tipo },
      webpush: { headers: { Urgency: 'high', TTL: String(60 * 60 * 24) } },
    })
    // Tokens que não valem mais (app desinstalado, permissão revogada): remove.
    const invalidos = res.responses
      .map((r, i) => (!r.success && r.error && /registration-token-not-registered|invalid-argument|invalid-registration-token/.test(r.error.code) ? grupo[i].ref : null))
      .filter((r): r is FirebaseFirestore.DocumentReference => !!r)
    await Promise.all(invalidos.map(r => r.delete()))
    if (res.failureCount) logger.info(`push: ${res.successCount} ok, ${res.failureCount} falharam (${invalidos.length} tokens removidos)`)
  }
}

// ---------- Helpers de dados ----------

async function getCena(cenaId: string | undefined): Promise<DocumentData | null> {
  if (!cenaId) return null
  const snap = await db.collection('cenas').doc(cenaId).get()
  return snap.exists ? (snap.data() ?? null) : null
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "qua, 25/09 às 19h30" a partir de YYYY-MM-DD + HH:mm. */
function quando(data: string, horario: string): string {
  const [a, m, d] = data.split('-').map(Number)
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
  const [h, min] = horario.split(':')
  const hora = min === '00' ? `${Number(h)}h` : `${Number(h)}h${min}`
  return `${dia}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} às ${hora}`
}

function descricaoEnsaio(cenaNome: string, e: DocumentData): string {
  return `${cenaNome} · ${quando(e.data, e.horario)}${e.local ? ` · ${e.local}` : ''}`
}

// ---------- Ensaios ----------

export const ensaioCriado = onDocumentCreated('ensaios/{id}', async event => {
  const e = event.data?.data()
  if (!e || e.canceledByUid) return
  const cena = await getCena(e.cenaId)
  if (!cena || cena.ativo === false) return
  await notificar(
    cena.participantes ?? [],
    { titulo: 'Ensaio confirmado', corpo: descricaoEnsaio(cena.nome, e), link: `/cenas/${e.cenaId}/ensaios/${event.params.id}`, tipo: 'ensaio' },
    e.confirmedByUid,
  )
})

export const ensaioAlterado = onDocumentUpdated('ensaios/{id}', async event => {
  const antes = event.data?.before.data()
  const depois = event.data?.after.data()
  if (!antes || !depois) return
  const cena = await getCena(depois.cenaId)
  if (!cena || cena.ativo === false) return
  const link = `/cenas/${depois.cenaId}/ensaios/${event.params.id}`
  const participantes: string[] = cena.participantes ?? []

  if (!antes.canceledByUid && depois.canceledByUid) {
    await notificar(participantes, { titulo: 'Ensaio cancelado', corpo: descricaoEnsaio(cena.nome, depois), link, tipo: 'ensaio' }, depois.canceledByUid)
    return
  }
  if (antes.canceledByUid && !depois.canceledByUid) {
    await notificar(participantes, { titulo: 'Ensaio reconfirmado', corpo: descricaoEnsaio(cena.nome, depois), link, tipo: 'ensaio' }, depois.confirmedByUid)
    return
  }
  if (depois.canceledByUid) return
  const mudou = antes.data !== depois.data || antes.horario !== depois.horario || (antes.local ?? '') !== (depois.local ?? '')
  if (mudou) {
    await notificar(participantes, { titulo: 'Ensaio alterado', corpo: descricaoEnsaio(cena.nome, depois), link, tipo: 'ensaio' }, depois.atualizadoPorUid)
  }
})

/**
 * Lembrete ~2h antes de cada ensaio confirmado de hoje (roda a cada 15 min, no fuso de São Paulo).
 * Marca `lembreteEnviado` pra não repetir. Quem avisou que não vai não recebe.
 */
export const lembreteEnsaio = onSchedule({ schedule: 'every 15 minutes', timeZone: FUSO }, async () => {
  const agora = new Date()
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(agora)
      .map(p => [p.type, p.value]),
  )
  const hoje = `${partes.year}-${partes.month}-${partes.day}`
  const minutosAgora = Number(partes.hour) * 60 + Number(partes.minute)

  const snap = await db.collection('ensaios').where('data', '==', hoje).get()
  for (const doc of snap.docs) {
    const e = doc.data()
    if (e.canceledByUid || e.lembreteEnviado || e.finalizadoAt) continue
    const [h, m] = String(e.horario ?? '').split(':').map(Number)
    if (Number.isNaN(h)) continue
    const faltam = h * 60 + (m || 0) - minutosAgora
    if (faltam <= 0 || faltam > 120) continue
    const cena = await getCena(e.cenaId)
    if (!cena || cena.ativo === false) continue
    const ausentes = new Set<string>([...(e.ausentes ?? []), ...Object.keys(e.ausencias ?? {})])
    await doc.ref.update({ lembreteEnviado: true })
    await notificar(
      (cena.participantes ?? []).filter((u: string) => !ausentes.has(u)),
      { titulo: 'Ensaio daqui a pouco', corpo: descricaoEnsaio(cena.nome, e), link: `/cenas/${e.cenaId}/ensaios/${doc.id}`, tipo: 'ensaio' },
    )
  }
})

// ---------- Figurino ----------

export const figurinoEnviado = onDocumentCreated('figurinos/{id}', async event => {
  const f = event.data?.data()
  if (!f || f.aprovacao !== 'pendente' || !f.cenaId) return
  const cena = await getCena(f.cenaId)
  if (!cena) return
  let avaliadores: string[] = cena.liderUid ? [cena.liderUid] : []
  if (!avaliadores.length) {
    const admins = await db.collection('users').where('role', '==', 'admin').get()
    avaliadores = admins.docs.map(d => d.id)
  }
  await notificar(
    avaliadores,
    {
      titulo: 'Foto de figurino pra aprovar',
      corpo: `${f.personagemNome ?? 'Personagem'} · ${cena.nome}`,
      link: `/cenas/${f.cenaId}`,
      tipo: 'figurino',
    },
    f.uploadedByUid,
  )
})

export const figurinoAvaliado = onDocumentUpdated('figurinos/{id}', async event => {
  const antes = event.data?.before.data()
  const depois = event.data?.after.data()
  if (!antes || !depois || antes.aprovacao === depois.aprovacao) return
  if (depois.aprovacao !== 'aprovado' && depois.aprovacao !== 'reprovado') return
  const aprovado = depois.aprovacao === 'aprovado'
  await notificar(
    [depois.uploadedByUid],
    {
      titulo: aprovado ? 'Figurino aprovado' : 'Figurino reprovado',
      corpo: aprovado
        ? `Sua foto de ${depois.personagemNome ?? 'figurino'} foi aprovada.`
        : `${depois.personagemNome ?? 'Figurino'}${depois.motivoReprovacao ? `: ${depois.motivoReprovacao}` : ' — veja o que mudar.'}`,
      link: depois.personagemId ? `/cenas/${depois.cenaId}/personagens/${depois.personagemId}` : `/cenas/${depois.cenaId}`,
      tipo: 'figurino',
    },
    depois.avaliadoPorUid,
  )
})

// ---------- Tarefas das equipes ----------

export const tarefaAlterada = onDocumentWritten('equipes/{equipeId}/tarefas/{tarefaId}', async event => {
  const antes = event.data?.before.exists ? event.data.before.data() : undefined
  const depois = event.data?.after.exists ? event.data.after.data() : undefined
  if (!depois) return
  const link = `/equipes/${event.params.equipeId}`
  const autor = antes ? (depois.atualizadoPorUid ?? depois.statusAtualizadoPorUid) : depois.createdByUid

  if (depois.responsavelUid && depois.responsavelUid !== antes?.responsavelUid) {
    await notificar(
      [depois.responsavelUid],
      { titulo: 'Tarefa pra você', corpo: depois.titulo, link, tipo: 'tarefa' },
      autor,
    )
  }

  const travou = (depois.status === 'bloqueado' || depois.status === 'cancelado') && depois.status !== antes?.status
  if (travou) {
    const equipeSnap = await db.collection('equipes').doc(event.params.equipeId).get()
    const equipe = equipeSnap.data()
    if (!equipe) return
    await notificar(
      [equipe.liderUid, ...(equipe.assistentes ?? [])],
      {
        titulo: depois.status === 'bloqueado' ? `Tarefa bloqueada · ${equipe.nome}` : `Tarefa cancelada · ${equipe.nome}`,
        corpo: `${depois.titulo}${depois.justificativa ? ` — ${depois.justificativa}` : ''}`,
        link,
        tipo: 'tarefa',
      },
      depois.statusAtualizadoPorUid ?? autor,
    )
  }
})

// ---------- Avisos manuais ----------

export const avisoCriado = onDocumentCreated('avisos/{id}', async event => {
  const a = event.data?.data()
  if (!a) return
  let destinatarios: string[] = []
  if (a.escopo === 'todos') {
    const users = await db.collection('users').where('active', '==', true).get()
    destinatarios = users.docs.map(d => d.id)
  } else if (a.escopo === 'cena' && a.escopoId) {
    destinatarios = (await getCena(a.escopoId))?.participantes ?? []
  } else if (a.escopo === 'equipe' && a.escopoId) {
    destinatarios = (await db.collection('equipes').doc(a.escopoId).get()).data()?.membros ?? []
  }
  await notificar(
    destinatarios,
    { titulo: a.titulo, corpo: a.corpo, link: a.link ?? '/notificacoes', tipo: 'aviso' },
    a.enviadoPorUid,
  )
  await event.data?.ref.update({ enviadoPara: destinatarios.length, enviadoEm: FieldValue.serverTimestamp() })
})
