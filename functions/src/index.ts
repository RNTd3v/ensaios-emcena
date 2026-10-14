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
import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'

initializeApp()
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 5 })

const db = getFirestore()
const APP_URL = 'https://ensaios-emcena.web.app'
const FUSO = 'America/Sao_Paulo'

type Tipo = 'ensaio' | 'treinamento' | 'figurino' | 'tarefa' | 'aviso' | 'reporte' | 'oracao' | 'diario'

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

/**
 * Grava a notificação pra cada destinatário e manda o push pros aparelhos deles. Cada doc guarda
 * o resultado do push (`push`): quantos aparelhos a pessoa tinha, em quantos o FCM aceitou, os
 * erros — e o aparelho confirma depois que recebeu (`push.recebidoEm`, via `pushRecebido`). É o
 * que a tela "Entrega de notificações" do admin mostra.
 */
async function gravarEEnviar(destinatarios: string[], n: Notificacao): Promise<void> {
  // Tokens dos aparelhos (consulta `in` aceita até 30 valores por vez).
  const tokens: { token: string; uid: string; ref: FirebaseFirestore.DocumentReference }[] = []
  for (const grupo of chunks(destinatarios, 30)) {
    const snap = await db.collection('fcmTokens').where('uid', 'in', grupo).get()
    snap.forEach(d => tokens.push({ token: d.id, uid: d.data().uid, ref: d.ref }))
  }
  const aparelhosPorUid = new Map<string, number>()
  for (const t of tokens) aparelhosPorUid.set(t.uid, (aparelhosPorUid.get(t.uid) ?? 0) + 1)

  const notifPorUid = new Map<string, FirebaseFirestore.DocumentReference>()
  for (const grupo of chunks(destinatarios, 400)) {
    const batch = db.batch()
    for (const uid of grupo) {
      const ref = db.collection('notificacoes').doc()
      notifPorUid.set(uid, ref)
      batch.set(ref, {
        uid,
        titulo: n.titulo,
        corpo: n.corpo,
        link: n.link ?? null,
        tipo: n.tipo,
        lida: false,
        createdAt: FieldValue.serverTimestamp(),
        push: { aparelhos: aparelhosPorUid.get(uid) ?? 0 },
      })
    }
    await batch.commit()
  }
  if (!tokens.length) return

  // Uma mensagem por aparelho (não multicast): cada uma leva o id da notificação da pessoa, que o
  // service worker devolve ao receber.
  const link = `${APP_URL}${n.link ?? '/notificacoes'}`
  const resultado = new Map<string, { enviados: number; falhas: string[] }>()
  let ok = 0
  let falhas = 0
  const invalidos: FirebaseFirestore.DocumentReference[] = []
  for (const grupo of chunks(tokens, 500)) {
    const res = await getMessaging().sendEach(
      grupo.map(t => ({
        token: t.token,
        // Só `data`: o service worker do app (public/firebase-messaging-sw.js) monta a notificação.
        data: { titulo: n.titulo, corpo: n.corpo, link, tipo: n.tipo, nid: notifPorUid.get(t.uid)!.id },
        webpush: { headers: { Urgency: 'high', TTL: String(60 * 60 * 24) } },
      })),
    )
    res.responses.forEach((r, i) => {
      const t = grupo[i]
      const atual = resultado.get(t.uid) ?? { enviados: 0, falhas: [] }
      if (r.success) {
        atual.enviados++
        ok++
      } else {
        const codigo = r.error?.code ?? 'desconhecido'
        atual.falhas.push(codigo)
        falhas++
        // Tokens que não valem mais (app desinstalado, permissão revogada): remove.
        if (/registration-token-not-registered|invalid-argument|invalid-registration-token/.test(codigo)) invalidos.push(t.ref)
      }
      resultado.set(t.uid, atual)
    })
  }
  await Promise.all(invalidos.map(r => r.delete()))

  const pares = [...resultado.entries()]
  for (const grupo of chunks(pares, 400)) {
    const batch = db.batch()
    for (const [uid, r] of grupo) {
      batch.update(notifPorUid.get(uid)!, { 'push.enviados': r.enviados, 'push.falhas': r.falhas, 'push.enviadoEm': FieldValue.serverTimestamp() })
    }
    await batch.commit()
  }
  logger.info(`push "${n.titulo}": ${destinatarios.length} pessoas, ${aparelhosPorUid.size} com aparelho; ${ok} ok, ${falhas} falharam (${invalidos.length} tokens removidos)`)
}

/**
 * Confirmação de entrega: o service worker chama (POST, corpo = id da notificação) quando o push
 * chega no aparelho. Fica atrás do Hosting em /api/push-recebido (firebase.json), mesma origem do
 * app. Sem login — o id é aleatório e só marca a data de recebimento.
 */
export const pushRecebido = onRequest({ maxInstances: 5 }, async (req, res) => {
  // Corpo: "<id> <origem>" — origem = "chegada" (push chegou) ou "clique" (tocou na notificação).
  const [nid, origem = 'chegada'] = (typeof req.body === 'string' ? req.body : String(req.rawBody ?? '')).trim().split(/\s+/)
  if (req.method !== 'POST' || !/^[A-Za-z0-9]{20}$/.test(nid ?? '')) {
    logger.warn(`pushRecebido: pedido inválido (${req.method}, ${req.get('content-type') ?? 'sem content-type'})`)
    res.status(400).end()
    return
  }
  const ref = db.collection('notificacoes').doc(nid)
  try {
    // A primeira confirmação vale: o clique só grava se a chegada não tiver sido registrada.
    const atual = (await ref.get()).data()
    if (!atual) {
      logger.warn(`pushRecebido: notificação ${nid} não existe (${origem})`)
    } else if (!atual.push?.recebidoEm) {
      await ref.update({ 'push.recebidoEm': FieldValue.serverTimestamp(), 'push.confirmadoPor': origem })
      logger.info(`pushRecebido: ${nid} confirmada (${origem})`)
    }
  } catch (e) {
    logger.error(`pushRecebido: falha ao gravar ${nid}`, e)
  }
  res.status(204).end()
})

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

/**
 * Quem recebe os avisos do ensaio: com personagens obrigatórios marcados, só quem faz esses
 * personagens; sem nenhum marcado, a cena toda.
 */
function publicoDoEnsaio(cena: DocumentData, e: DocumentData): string[] {
  const obrigatorios: string[] = e.obrigatorios ?? []
  if (!obrigatorios.length) return cena.participantes ?? []
  const uids = new Set<string>()
  for (const p of (cena.personagens as { id: string; participanteUid?: string }[] | undefined) ?? []) {
    if (p.participanteUid && obrigatorios.includes(p.id)) uids.add(p.participanteUid)
  }
  return [...uids]
}

export const ensaioCriado = onDocumentCreated('ensaios/{id}', async event => {
  const e = event.data?.data()
  if (!e || e.canceledByUid) return
  const cena = await getCena(e.cenaId)
  if (!cena || cena.ativo === false) return
  await notificar(
    publicoDoEnsaio(cena, e),
    { titulo: 'Ensaio confirmado', corpo: descricaoEnsaio(cena.nome, e), link: `/cenas/${e.cenaId}/ensaios/${event.params.id}`, tipo: 'ensaio' },
    e.confirmedByUid,
  )
})

/** Mesmos obrigatórios (sem ligar pra ordem)? */
function mesmosObrigatorios(a: DocumentData, b: DocumentData): boolean {
  const x = [...((a.obrigatorios as string[] | undefined) ?? [])].sort()
  const y = [...((b.obrigatorios as string[] | undefined) ?? [])].sort()
  return x.length === y.length && x.every((v, i) => v === y[i])
}

/**
 * Quem deixou de ser chamado pro ensaio (mudaram os obrigatórios) perde a resposta que tinha dado:
 * sai de `presencas`/`ausentes` e o motivo/ressalva privados são apagados — senão apareceria em
 * "Também presentes". Só pra ensaio ainda por acontecer (não mexe no registro de um que já foi).
 */
async function limparRespostasDeQuemSaiu(ensaioId: string, sairam: string[], depois: DocumentData): Promise<void> {
  if (!sairam.length || depois.finalizadoAt || depois.data < agoraEmSaoPaulo().hoje) return
  const respondeu = new Set<string>([...(depois.presencas ?? []), ...(depois.ausentes ?? [])])
  const alvo = sairam.filter(u => respondeu.has(u))
  if (!alvo.length) return
  const ref = db.collection('ensaios').doc(ensaioId)
  const batch = db.batch()
  batch.update(ref, { presencas: FieldValue.arrayRemove(...alvo), ausentes: FieldValue.arrayRemove(...alvo) })
  for (const uid of alvo) {
    batch.delete(ref.collection('ausencias').doc(uid))
    batch.delete(ref.collection('ressalvas').doc(uid))
  }
  await batch.commit()
}

export const ensaioAlterado = onDocumentUpdated('ensaios/{id}', async event => {
  const antes = event.data?.before.data()
  const depois = event.data?.after.data()
  if (!antes || !depois) return
  const cena = await getCena(depois.cenaId)
  // Mudaram os obrigatórios: quem entrou passa a ser chamado, quem saiu deixa de ser.
  const publicoAntes = cena ? new Set(publicoDoEnsaio(cena, antes)) : new Set<string>()
  const publicoDepois = cena ? new Set(publicoDoEnsaio(cena, depois)) : new Set<string>()
  const obrigatoriosMudaram = !mesmosObrigatorios(antes, depois)
  const entraram = obrigatoriosMudaram ? [...publicoDepois].filter(u => !publicoAntes.has(u)) : []
  const sairam = obrigatoriosMudaram ? [...publicoAntes].filter(u => !publicoDepois.has(u)) : []
  if (!depois.canceledByUid) await limparRespostasDeQuemSaiu(event.params.id, sairam, depois)

  // Quem alterou/cancelou escolheu não notificar (`notificar: false` no mesmo update): o elenco vê
  // só pelo app. Apaga o campo pra próxima mudança voltar ao padrão (esse update não gera aviso).
  if (depois.notificar === false) {
    await event.data!.after.ref.update({ notificar: FieldValue.delete() })
    return
  }
  if (!cena || cena.ativo === false) return
  const link = `/cenas/${depois.cenaId}/ensaios/${event.params.id}`
  const participantes = publicoDoEnsaio(cena, depois)

  if (!antes.canceledByUid && depois.canceledByUid) {
    await notificar(participantes, { titulo: 'Ensaio cancelado', corpo: descricaoEnsaio(cena.nome, depois), link, tipo: 'ensaio' }, depois.canceledByUid)
    return
  }
  if (antes.canceledByUid && !depois.canceledByUid) {
    await notificar(participantes, { titulo: 'Ensaio reconfirmado', corpo: descricaoEnsaio(cena.nome, depois), link, tipo: 'ensaio' }, depois.confirmedByUid)
    return
  }
  if (depois.canceledByUid) return
  await avisarDesistencias(event.params.id, cena, antes, depois, link)
  await avisarAnotacoesDoEnsaio(cena, antes, depois, link)
  // Ensaio que já foi (ou foi finalizado): mexer nos obrigatórios é só acerto do registro, sem aviso.
  const aindaVai = !depois.finalizadoAt && depois.data >= agoraEmSaoPaulo().hoje
  const corpo = descricaoEnsaio(cena.nome, depois)
  if (aindaVai && entraram.length) {
    await notificar(entraram, { titulo: 'Você foi chamado para o ensaio', corpo, link, tipo: 'ensaio' }, depois.atualizadoPorUid)
  }
  if (aindaVai && sairam.length) {
    await notificar(sairam, { titulo: 'Você não precisa ir ao ensaio', corpo, link, tipo: 'ensaio' }, depois.atualizadoPorUid)
  }
  const mudou = antes.data !== depois.data || antes.horario !== depois.horario || (antes.local ?? '') !== (depois.local ?? '')
  if (mudou) {
    // Quem acabou de entrar já recebeu o "chamado" com os dados novos.
    const ficaram = participantes.filter(u => !entraram.includes(u))
    await notificar(ficaram, { titulo: 'Ensaio alterado', corpo, link, tipo: 'ensaio' }, depois.atualizadoPorUid)
  }
})

/**
 * Quem tinha confirmado presença e, no dia do ensaio (inclusive durante), avisou que não vai: o
 * líder e os assistentes da cena recebem um aviso com o motivo (que fica na subcoleção privada
 * `ausencias`, gravada no mesmo batch).
 */
async function avisarDesistencias(ensaioId: string, cena: DocumentData, antes: DocumentData, depois: DocumentData, link: string) {
  if (depois.finalizadoAt || depois.data !== agoraEmSaoPaulo().hoje) return
  const confirmadosAntes = new Set<string>(antes.presencas ?? [])
  const ausentesAntes = new Set<string>(antes.ausentes ?? [])
  const desistiram = ((depois.ausentes as string[] | undefined) ?? []).filter(u => !ausentesAntes.has(u) && confirmadosAntes.has(u))
  const lideranca = [cena.liderUid, ...((cena.assistentes as string[] | undefined) ?? [])]
  for (const uid of desistiram) {
    const [pessoa, ausencia] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('ensaios').doc(ensaioId).collection('ausencias').doc(uid).get(),
    ])
    const dados = pessoa.data()
    const nome = dados?.apelido || dados?.nomeCompleto || dados?.displayName || 'Alguém'
    const motivo = (ausencia.data()?.motivo as string | undefined)?.trim()
    await notificar(
      lideranca,
      { titulo: `${nome} não vai conseguir ir ao ensaio`, corpo: `${cena.nome}${motivo ? ` — ${motivo}` : ''}`, link, tipo: 'ensaio' },
      uid,
    )
  }
}

/**
 * Ensaio finalizado com anotações (ou anotações do registro editadas depois): o elenco chamado e a
 * liderança da cena recebem o texto — menos quem salvou o registro.
 */
async function avisarAnotacoesDoEnsaio(cena: DocumentData, antes: DocumentData, depois: DocumentData, link: string) {
  const anotacoes = ((depois.anotacoes as string | undefined) ?? '').trim()
  if (!depois.finalizadoAt || !anotacoes) return
  const finalizouAgora = !antes.finalizadoAt
  if (!finalizouAgora && anotacoes === ((antes.anotacoes as string | undefined) ?? '').trim()) return
  await notificar(
    [...publicoDoEnsaio(cena, depois), cena.liderUid, ...((cena.assistentes as string[] | undefined) ?? [])],
    {
      titulo: finalizouAgora ? `Anotações do ensaio · ${cena.nome}` : `Anotações do ensaio atualizadas · ${cena.nome}`,
      corpo: resumoTexto(anotacoes),
      link,
      tipo: 'diario',
    },
    depois.finalizadoByUid,
  )
}

/** Primeiros ~140 caracteres, numa linha só (corpo do push). */
function resumoTexto(t: string): string {
  const linha = t.replace(/\s+/g, ' ').trim()
  return linha.length > 140 ? `${linha.slice(0, 139)}…` : linha
}

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
      publicoDoEnsaio(cena, e).filter(u => !ausentes.has(u)),
      { titulo: 'Ensaio daqui a pouco', corpo: descricaoEnsaio(cena.nome, e), link: `/cenas/${e.cenaId}/ensaios/${doc.id}`, tipo: 'ensaio' },
    )
  }
})

/** Data (YYYY-MM-DD) e minutos desde a meia-noite, agora, no fuso de São Paulo. */
function agoraEmSaoPaulo(): { hoje: string; minutos: number } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map(p => [p.type, p.value]),
  )
  return { hoje: `${partes.year}-${partes.month}-${partes.day}`, minutos: Number(partes.hour) * 60 + Number(partes.minute) }
}

/** `data` (YYYY-MM-DD) mais `dias` dias. */
function diasDepois(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

/** 1020 -> "17h", 1050 -> "17h30". */
function horaDeMinutos(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

const AVISO_DO_DIA_MIN = 8 * 60
/**
 * Dias antes em que sai, às 8h, um lembrete de confirmação pra quem ainda não respondeu. Acompanha
 * a janela do check-in no app (`CHECKIN_ABRE_DIAS_ANTES` em src/lib/agenda.ts): abre 2 dias antes.
 */
const AVISOS_ANTECIPADOS_DIAS = [2, 1]
function tituloAntecipado(diasAntes: number, oQue: 'ensaio' | 'treinamento'): string {
  if (diasAntes === 1) return `${oQue === 'ensaio' ? 'Ensaio' : 'Treinamento'} amanhã — confirme sua presença`
  return `Já dá pra confirmar presença no ${oQue}`
}
/** Antes disso não sai lembrete de confirmação (ensaio cedo fecha a confirmação de madrugada). */
const SILENCIO_ATE_MIN = 7 * 60
/** Minutos antes de a confirmação fechar em que quem não respondeu é lembrado. */
const MARCOS_CONFIRMACAO = [120, 60, 30, 10]
function tituloMarco(marco: number, oQue: 'ensaio' | 'treinamento'): string {
  if (marco === 120) return `Confirme sua presença no ${oQue} de hoje`
  if (marco === 60) return 'Falta 1h pra fechar a confirmação'
  if (marco === 30) return 'Faltam 30 min pra confirmar'
  return 'Últimos minutos pra confirmar'
}

interface Ocorrencia {
  /** Ensaio ou sessão de treinamento de hoje (mesmos campos de data/horário/respostas/marcas). */
  e: DocumentData
  oQue: 'ensaio' | 'treinamento'
  participantes: string[]
  /** Nome da cena ou título do treinamento. */
  nome: string
  descricao: string
  link: string
}

/**
 * O que sai agora pra uma ocorrência de hoje ou dos próximos dias (ver `lembretesDoDia`): o que
 * marcar no doc e as notificações a enviar. `diasAntes` = quantos dias faltam (0 = hoje).
 */
function lembretesDaOcorrencia(
  { e, oQue, participantes, nome, descricao, link }: Ocorrencia,
  diasAntes: number,
  inicio: number,
  minutos: number,
  limiteHoras: number,
): { atualizacao: Record<string, unknown>; envios: [string[], Notificacao][] } {
  const tipo: Tipo = oQue
  const ausentes = new Set<string>([...(e.ausentes ?? []), ...Object.keys(e.ausencias ?? {})])
  const presentes = new Set<string>(e.presencas ?? [])
  const chave = `${e.data} ${e.horario}`
  const atualizacao: Record<string, unknown> = {}
  const envios: [string[], Notificacao][] = []

  // Dias antes: um lembrete de confirmação às 8h, só pra quem ainda não respondeu.
  if (diasAntes > 0) {
    const anteriores = e.avisosAntecipados?.chave === chave ? ((e.avisosAntecipados.dias as number[]) ?? []) : []
    if (
      AVISOS_ANTECIPADOS_DIAS.includes(diasAntes) &&
      !anteriores.includes(diasAntes) &&
      minutos >= AVISO_DO_DIA_MIN &&
      minutos < AVISO_DO_DIA_MIN + 60
    ) {
      atualizacao.avisosAntecipados = { chave, dias: [...anteriores, diasAntes] }
      const pendentes = participantes.filter(u => !presentes.has(u) && !ausentes.has(u))
      if (pendentes.length) envios.push([pendentes, { titulo: tituloAntecipado(diasAntes, oQue), corpo: descricao, link, tipo }])
    }
    return { atualizacao, envios }
  }

  // Aviso do dia: só na janela das 8h (se for criado depois, o aviso de criação já avisa).
  if (e.avisoDoDiaEnviado !== chave && minutos >= AVISO_DO_DIA_MIN && minutos < AVISO_DO_DIA_MIN + 60) {
    atualizacao.avisoDoDiaEnviado = chave
    envios.push([
      participantes.filter(u => !ausentes.has(u)),
      { titulo: `Hoje tem ${oQue}! Se programe`, corpo: descricao, link, tipo },
    ])
  }

  // Lembretes de confirmação.
  const fecha = inicio - limiteHoras * 60
  const faltam = fecha - minutos
  if (faltam > 0) {
    const anteriores = e.lembretesConfirmacao?.chave === chave ? ((e.lembretesConfirmacao.enviados as number[]) ?? []) : []
    const devidos = MARCOS_CONFIRMACAO.filter(mc => faltam <= mc && !anteriores.includes(mc))
    if (devidos.length) {
      atualizacao.lembretesConfirmacao = { chave, enviados: [...anteriores, ...devidos] }
      const pendentes = participantes.filter(u => !presentes.has(u) && !ausentes.has(u))
      if (minutos >= SILENCIO_ATE_MIN && pendentes.length) {
        envios.push([
          pendentes,
          {
            titulo: tituloMarco(Math.min(...devidos), oQue),
            corpo: `${nome} hoje às ${horaDeMinutos(inicio)} — confirme até ${horaDeMinutos(fecha)}.`,
            link,
            tipo,
          },
        ])
      }
    }
  }
  return { atualizacao, envios }
}

/**
 * Roda a cada 5 min (fuso de São Paulo), pros ensaios e sessões de treinamento de hoje e dos
 * próximos 2 dias:
 * - 2 dias antes e na véspera, às 8h, um lembrete de confirmação só pra quem ainda não respondeu
 *   (a confirmação abre 2 dias antes);
 * - às 8h do dia, "Hoje tem ensaio/treinamento" pro público (menos quem já avisou que não vai);
 * - 2h, 1h, 30 e 10 min antes de a confirmação fechar (`checkinLimiteHoras` antes do início), um
 *   lembrete só pra quem ainda não respondeu (nem "vou" nem "não vou").
 * O que já saiu fica marcado no doc (`avisosAntecipados`, `avisoDoDiaEnviado`, `lembretesConfirmacao`) — atrelado a
 * data+horário, então se mudar de horário os lembretes recomeçam. Se a função atrasar ou o
 * ensaio for criado em cima da hora, manda só o lembrete mais próximo, sem rajada.
 */
export const lembretesDoDia = onSchedule({ schedule: 'every 5 minutes', timeZone: FUSO }, async () => {
  const { hoje, minutos } = agoraEmSaoPaulo()
  // Na mesma tarefa agendada (e não numa nova) pra não sair da cota gratuita do Cloud Scheduler.
  await lembretesOracao(hoje, minutos)
  const offsets = [0, ...AVISOS_ANTECIPADOS_DIAS]
  const datas = offsets.map(n => diasDepois(hoje, n))
  const [ensaios, sessoes] = await Promise.all([
    db.collection('ensaios').where('data', 'in', datas).get(),
    db.collection('treinamentoSessoes').where('data', 'in', datas).get(),
  ])
  if (ensaios.empty && sessoes.empty) return
  const config = (await db.collection('settings').doc('config').get()).data()
  const limiteHoras = Number(config?.checkinLimiteHoras ?? 2)

  const ocorrencias: { ref: FirebaseFirestore.DocumentReference; e: DocumentData; carregar: () => Promise<Ocorrencia | null> }[] = []
  for (const doc of ensaios.docs) {
    const e = doc.data()
    if (e.canceledByUid || e.finalizadoAt) continue
    ocorrencias.push({
      ref: doc.ref,
      e,
      carregar: async () => {
        const cena = await getCena(e.cenaId)
        if (!cena || cena.ativo === false) return null
        const link = `/cenas/${e.cenaId}/ensaios/${doc.id}`
        return { e, oQue: 'ensaio', participantes: publicoDoEnsaio(cena, e), nome: cena.nome, descricao: descricaoEnsaio(cena.nome, e), link }
      },
    })
  }
  for (const doc of sessoes.docs) {
    const e = doc.data()
    ocorrencias.push({
      ref: doc.ref,
      e,
      carregar: async () => {
        const t = (await db.collection('treinamentos').doc(e.treinamentoId).get()).data()
        if (!t) return null
        return {
          e,
          oQue: 'treinamento',
          participantes: await publicoDoTreinamento(t),
          nome: t.titulo,
          descricao: descricaoTreinamento(t, e),
          link: `/treinamentos/${e.treinamentoId}`,
        }
      },
    })
  }

  for (const { ref, e, carregar } of ocorrencias) {
    const [h, m] = String(e.horario ?? '').split(':').map(Number)
    if (Number.isNaN(h)) continue
    const inicio = h * 60 + (m || 0)
    const diasAntes = offsets[datas.indexOf(e.data)]
    if (diasAntes === 0 && minutos >= inicio) continue
    // O que marcar não depende do público: sem nada devido agora, nem carrega a cena/treinamento
    // (o público de um treinamento "todos" são todos os usuários — leitura cara a cada 5 min).
    const vazio: Ocorrencia = { e, oQue: 'ensaio', participantes: [], nome: '', descricao: '', link: '' }
    if (!Object.keys(lembretesDaOcorrencia(vazio, diasAntes, inicio, minutos, limiteHoras).atualizacao).length) continue
    const ocorrencia = await carregar()
    if (!ocorrencia) continue
    const { atualizacao, envios } = lembretesDaOcorrencia(ocorrencia, diasAntes, inicio, minutos, limiteHoras)
    if (!Object.keys(atualizacao).length) continue
    // Marca antes de enviar (como o lembreteEnsaio): se o envio falhar no meio, não repete.
    await ref.update(atualizacao)
    for (const [uids, n] of envios) await notificar(uids, n)
  }
})

// ---------- Relógio de oração ----------

/** Minutos antes do horário de oração em que a pessoa é lembrada. */
const LEMBRETE_ORACAO_MIN = 10

/** 390 -> "06:30" (como o `inicio` gravado em `horariosOracao`). */
function hhmm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Lembrete pessoal ~10 min antes do horário de oração, nos dias da semana que a pessoa marcou —
 * só com o relógio liberado (`oracaoLiberada`). Busca só os horários que começam na janela (consulta
 * por faixa de `inicio`, não a coleção toda) e marca `lembreteEnviado` ("data inicio") pra não repetir.
 * Perto da meia-noite a janela continua no dia seguinte.
 */
async function lembretesOracao(hoje: string, minutos: number): Promise<void> {
  const fim = minutos + LEMBRETE_ORACAO_MIN
  const faixas = [{ data: hoje, de: hhmm(minutos), ate: hhmm(Math.min(fim, 1439)) }]
  if (fim > 1439) faixas.push({ data: diasDepois(hoje, 1), de: '', ate: hhmm(fim - 1440) })

  const candidatos: { ref: FirebaseFirestore.DocumentReference; h: DocumentData; chave: string }[] = []
  for (const { data, de, ate } of faixas) {
    const [a, m, d] = data.split('-').map(Number)
    const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay()
    const snap = await db.collection('horariosOracao').where('inicio', '>', de).where('inicio', '<=', ate).get()
    for (const doc of snap.docs) {
      const h = doc.data()
      const chave = `${data} ${h.inicio}`
      if (!(h.dias as number[] | undefined)?.includes(diaSemana) || h.lembreteEnviado === chave) continue
      candidatos.push({ ref: doc.ref, h, chave })
    }
  }
  if (!candidatos.length) return
  const config = (await db.collection('settings').doc('config').get()).data()
  if (!config?.oracaoLiberada) return

  for (const { ref, h, chave } of candidatos) {
    await ref.update({ lembreteEnviado: chave })
    const [hh, mm] = String(h.inicio).split(':').map(Number)
    await notificar([h.uid ?? ref.id], {
      titulo: `Seu horário de oração começa às ${horaDeMinutos(hh * 60 + mm)}`,
      corpo: `Daqui a pouco, por ${h.duracaoMin} min. Toque pra ver os pedidos de oração.`,
      link: '/oracao',
      tipo: 'oracao',
    })
  }
}

// ---------- Treinamentos ----------

/**
 * Quem um treinamento alcança: "elenco" = quem tem personagem em alguma cena ativa; "pessoas" = só
 * as escolhidas; "todos" = todo mundo com acesso ativo e inscrição feita e não recusada (dependentes viram
 * os responsáveis no `notificar`).
 */
async function publicoDoTreinamento(t: DocumentData): Promise<string[]> {
  if (t.publico === 'pessoas') return (t.pessoas as string[] | undefined) ?? []
  if (t.publico === 'elenco') {
    const cenas = await db.collection('cenas').get()
    const uids = new Set<string>()
    for (const c of cenas.docs) {
      const cena = c.data()
      if (cena.ativo === false) continue
      for (const p of (cena.personagens as { participanteUid?: string }[] | undefined) ?? []) if (p.participanteUid) uids.add(p.participanteUid)
    }
    return [...uids]
  }
  // Só quem fez inscrição e não foi recusada (direto de `inscricoes` — a cópia do status no perfil
  // só é preenchida quando o admin abre o Gerenciamento).
  const [users, inscricoes] = await Promise.all([db.collection('users').where('active', '==', true).get(), db.collection('inscricoes').get()])
  const validas = new Set(inscricoes.docs.filter(d => d.data().status !== 'recusado').map(d => d.id))
  return users.docs.map(d => d.id).filter(uid => validas.has(uid))
}

function descricaoTreinamento(t: DocumentData, s: DocumentData): string {
  return `${t.titulo} · ${quando(s.data, s.horario)}${t.local ? ` · ${t.local}` : ''}`
}

/** "Novo treinamento: …" pra `uids` — com os dias tirados das sessões dele. */
async function avisarTreinamento(id: string, t: DocumentData, uids: string[]): Promise<void> {
  const sessoes = (await db.collection('treinamentoSessoes').where('treinamentoId', '==', id).get()).docs
    .map(d => d.data())
    .sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`))
  if (!sessoes.length || !uids.length) return
  const dias = sessoes.length === 1 ? quando(sessoes[0].data, sessoes[0].horario) : `${sessoes.length} dias, a partir de ${quando(sessoes[0].data, sessoes[0].horario)}`
  await notificar(
    uids,
    {
      titulo: `Novo treinamento: ${t.titulo}`,
      corpo: `${dias}${t.local ? ` · ${t.local}` : ''}. Confirme sua presença no dia.`,
      link: `/treinamentos/${id}`,
      tipo: 'treinamento',
    },
    t.createdByUid,
  )
}

/** Treinamento cadastrado: avisa o público pra confirmar presença (as sessões vêm no mesmo batch). */
export const treinamentoCriado = onDocumentCreated('treinamentos/{id}', async event => {
  const t = event.data?.data()
  if (!t) return
  await avisarTreinamento(event.params.id, t, await publicoDoTreinamento(t))
})

/**
 * Treinamento editado: quem passou a fazer parte do público (pessoa incluída na lista, ou troca de
 * "pessoas" pra elenco/todos) recebe o mesmo aviso de novo treinamento. Quem já estava não recebe nada.
 */
export const treinamentoAlterado = onDocumentUpdated('treinamentos/{id}', async event => {
  const antes = event.data?.before.data()
  const depois = event.data?.after.data()
  if (!antes || !depois) return
  if (antes.publico === depois.publico && antes.publico !== 'pessoas') return
  const [eram, sao] = await Promise.all([publicoDoTreinamento(antes), publicoDoTreinamento(depois)])
  const jaAvisados = new Set(eram)
  await avisarTreinamento(event.params.id, depois, sao.filter(u => !jaAvisados.has(u)))
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

/**
 * Aviso pra pessoas escolhidas: admin avisa qualquer um; os demais, só quem está nas cenas ou
 * equipes que lideram (as regras deixam qualquer um criar — o filtro de verdade é aqui).
 */
async function quemPodeAvisar(remetenteUid: string | undefined, escolhidos: string[]): Promise<string[]> {
  if (!remetenteUid) return []
  const remetente = (await db.collection('users').doc(remetenteUid).get()).data()
  if (remetente?.role === 'admin') return escolhidos
  const permitidos = new Set<string>()
  const cenas = await db.collection('cenas').where('liderUid', '==', remetenteUid).get()
  for (const c of cenas.docs) for (const u of (c.data().participantes as string[] | undefined) ?? []) permitidos.add(u)
  const equipes = await db.collection('equipes').where('liderUid', '==', remetenteUid).get()
  for (const e of equipes.docs) for (const u of (e.data().membros as string[] | undefined) ?? []) permitidos.add(u)
  return escolhidos.filter(u => permitidos.has(u))
}

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
  } else if (a.escopo === 'pessoas' && Array.isArray(a.destinatarios)) {
    destinatarios = await quemPodeAvisar(a.enviadoPorUid, a.destinatarios as string[])
  }
  await notificar(
    destinatarios,
    { titulo: a.titulo, corpo: a.corpo, link: a.link ?? '/notificacoes', tipo: 'aviso' },
    a.enviadoPorUid,
  )
  await event.data?.ref.update({ enviadoPara: destinatarios.length, enviadoEm: FieldValue.serverTimestamp() })
})

// ---------- Diário da cena ----------

/**
 * Anotação avulsa no diário da cena (criada ou editada): vai pra quem pode ler — só a liderança
 * (líder e assistentes) ou, marcada `elenco`, também o elenco da cena (crianças viram os
 * responsáveis). Quem escreveu/editou não recebe. Edição só avisa se mudou título, texto ou quem vê.
 */
export const anotacaoCenaEscrita = onDocumentWritten('cenas/{cenaId}/anotacoes/{id}', async event => {
  const antes = event.data?.before.data()
  const depois = event.data?.after.data()
  if (!depois) return
  if (antes && antes.titulo === depois.titulo && antes.texto === depois.texto && antes.visibilidade === depois.visibilidade) return
  const cena = await getCena(event.params.cenaId)
  if (!cena || cena.ativo === false) return
  const lideranca = [cena.liderUid, ...((cena.assistentes as string[] | undefined) ?? [])]
  const destinatarios = depois.visibilidade === 'elenco' ? [...lideranca, ...((cena.participantes as string[] | undefined) ?? [])] : lideranca
  const titulo = (depois.titulo as string | undefined)?.trim()
  const texto = resumoTexto((depois.texto as string | undefined) ?? '')
  await notificar(
    destinatarios,
    {
      titulo: `${antes ? 'Diário atualizado' : 'Novo no diário'} · ${cena.nome}`,
      corpo: titulo ? `${titulo} — ${texto}` : texto,
      link: `/cenas/${event.params.cenaId}`,
      tipo: 'diario',
    },
    antes ? (depois.atualizadoPorUid ?? depois.autorUid) : depois.autorUid,
  )
})

// ---------- Dependentes nas cenas ----------

/**
 * Mantém `cena.responsaveisDependentes`: os responsáveis das crianças (dependentes, id `dep_…`)
 * que participam da cena. É o que deixa os pais verem a cena/ensaios e responder a presença pelos
 * filhos (firestore.rules) sem estarem na cena.
 */
async function sincronizarResponsaveisDaCena(ref: FirebaseFirestore.DocumentReference, dados: DocumentData): Promise<void> {
  const deps = ((dados.participantes as string[] | undefined) ?? []).filter(u => u.startsWith('dep_'))
  const responsaveis = new Set<string>()
  for (const grupo of chunks(deps, 30)) {
    const snaps = await db.getAll(...grupo.map(u => db.collection('users').doc(u)))
    for (const s of snaps) for (const r of ((s.data()?.responsaveisUids as string[] | undefined) ?? [])) responsaveis.add(r)
  }
  const novo = [...responsaveis].sort()
  const atual = [...((dados.responsaveisDependentes as string[] | undefined) ?? [])].sort()
  if (JSON.stringify(novo) === JSON.stringify(atual)) return // já está certo — evita laço de escrita
  await ref.update({ responsaveisDependentes: novo })
}

export const cenaResponsaveisDependentes = onDocumentWritten('cenas/{id}', async event => {
  const depois = event.data?.after
  if (!depois?.exists) return
  await sincronizarResponsaveisDaCena(depois.ref, depois.data() ?? {})
})

/** Mudou quem é responsável por uma criança: atualiza as cenas em que ela está. */
export const dependenteResponsaveis = onDocumentUpdated('users/{uid}', async event => {
  const antes = event.data?.before.data()
  const depois = event.data?.after.data()
  if (!depois?.dependente) return
  if (JSON.stringify(antes?.responsaveisUids ?? []) === JSON.stringify(depois.responsaveisUids ?? [])) return
  const cenas = await db.collection('cenas').where('participantes', 'array-contains', event.params.uid).get()
  for (const c of cenas.docs) await sincronizarResponsaveisDaCena(c.ref, c.data())
})

// ---------- Histórico de personagens ----------

interface PersonagemDoc {
  id: string
  nome: string
  participanteUid?: string
}

/**
 * Cada mudança nos personagens de uma cena (entrou/saiu da cena, pessoa vinculada/desvinculada/
 * trocada) vira um registro em `cenas/{id}/historicoPersonagens`, com quem gravou (`updatedByUid`
 * do próprio update) e o vínculo de antes — pra saber o que aconteceu e poder restaurar. Só admin lê.
 */
export const cenaHistoricoPersonagens = onDocumentUpdated('cenas/{id}', async event => {
  const antes = event.data?.before.data()
  const depois = event.data?.after.data()
  if (!antes || !depois) return
  const lista = (d: DocumentData) => new Map(((d.personagens as PersonagemDoc[] | undefined) ?? []).map(p => [p.id, p]))
  const [mapaAntes, mapaDepois] = [lista(antes), lista(depois)]
  const mudancas: Record<string, unknown>[] = []
  for (const id of new Set([...mapaAntes.keys(), ...mapaDepois.keys()])) {
    const a = mapaAntes.get(id)
    const d = mapaDepois.get(id)
    const tipo = !a ? 'adicionado' : !d ? 'removido' : (a.participanteUid ?? null) !== (d.participanteUid ?? null) ? 'vinculo' : null
    if (!tipo) continue
    mudancas.push({
      tipo,
      personagemId: id,
      nome: (d ?? a)!.nome,
      participanteAntes: a?.participanteUid ?? null,
      participanteDepois: d?.participanteUid ?? null,
    })
  }
  if (!mudancas.length) return
  await event.data!.after.ref.collection('historicoPersonagens').add({
    mudancas,
    porUid: depois.updatedByUid ?? null,
    em: FieldValue.serverTimestamp(),
  })
})

// ---------- Problemas reportados ----------

/** Relato novo (menu → Reportar problema): avisa só quem está em Configurações → Suporte. */
export const reporteCriado = onDocumentCreated('reportes/{id}', async event => {
  const r = event.data?.data()
  if (!r) return
  const suporteUid = (await db.collection('settings').doc('config').get()).data()?.suporteUid as string | undefined
  if (!suporteUid) return
  const texto = String(r.texto ?? '')
  await notificar(
    [suporteUid],
    {
      titulo: `Problema reportado por ${r.nome ?? 'alguém'}`,
      corpo: texto.length > 140 ? `${texto.slice(0, 137)}...` : texto,
      link: `/admin/reportes?id=${event.params.id}`,
      tipo: 'reporte',
    },
    // Quem é o suporte e reporta (testando) também recebe — não passa excetoUid.
  )
})
