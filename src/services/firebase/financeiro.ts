import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './config'
import { deleteCenaFile, uploadArquivo } from './storage'
import type { Entrada, Financeiro, FinanceiroConfig, Gasto } from '@/types'

/**
 * Metas e gastos: `financeiro/config` (líder, assistentes, meta), coleções `entradas` (lançamentos
 * manuais) e `gastos`. Rifas não passam por aqui — vêm do app de rifas (services/externo/vendas).
 * `financeiro/resumo` é o formato antigo (números digitados em Configurações), só lido pra importar.
 */

function toIso(value: unknown): string | undefined {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString()
}

// ---------- Config ----------

const CONFIG_REF = doc(db, 'financeiro', 'config')

export function subscribeToFinanceiroConfig(callback: (config: FinanceiroConfig) => void) {
  return onSnapshot(
    CONFIG_REF,
    snap => callback((snap.exists() ? snap.data() : {}) as FinanceiroConfig),
    () => callback({}),
  )
}

/** Só admin define quem cuida (firestore.rules). */
export async function saveFinanceiroEquipe(liderUid: string | undefined, assistentes: string[]): Promise<void> {
  await setDoc(CONFIG_REF, { liderUid: liderUid ?? null, assistentes, updatedAt: serverTimestamp() }, { merge: true })
}

/** Admin, líder ou assistente. */
export async function saveMetaTotal(metaTotal: number | undefined): Promise<void> {
  await setDoc(CONFIG_REF, { metaTotal: metaTotal ?? deleteField(), updatedAt: serverTimestamp() }, { merge: true })
}

/** Qual meta do app de doces conta pro musical (admin, líder ou assistente). `undefined` = desliga. */
export async function saveDocesMeta(meta: { id: string; titulo: string } | undefined): Promise<void> {
  await setDoc(
    CONFIG_REF,
    { docesMetaId: meta?.id ?? deleteField(), docesMetaTitulo: meta?.titulo ?? deleteField(), updatedAt: serverTimestamp() },
    { merge: true },
  )
}

// ---------- Entradas (lançamentos manuais) ----------

export function subscribeToEntradas(callback: (entradas: Entrada[]) => void) {
  return onSnapshot(
    collection(db, 'entradas'),
    snap =>
      callback(
        snap.docs
          .map(d => ({ ...d.data(), id: d.id, createdAt: toIso(d.data().createdAt) ?? new Date().toISOString() }) as Entrada)
          .sort((a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt)),
      ),
    () => callback([]),
  )
}

export type EntradaInput = Pick<Entrada, 'frente' | 'valor' | 'data' | 'descricao'>

export async function createEntrada(input: EntradaInput, byUid: string): Promise<void> {
  await addDoc(collection(db, 'entradas'), {
    frente: input.frente,
    valor: input.valor,
    data: input.data,
    ...(input.descricao?.trim() ? { descricao: input.descricao.trim() } : {}),
    createdByUid: byUid,
    createdAt: serverTimestamp(),
  })
}

export async function updateEntrada(id: string, input: EntradaInput): Promise<void> {
  await updateDoc(doc(db, 'entradas', id), {
    frente: input.frente,
    valor: input.valor,
    data: input.data,
    descricao: input.descricao?.trim() || deleteField(),
  })
}

export async function deleteEntrada(id: string): Promise<void> {
  await deleteDoc(doc(db, 'entradas', id))
}

// ---------- Gastos ----------

export function subscribeToGastos(callback: (gastos: Gasto[]) => void) {
  return onSnapshot(
    collection(db, 'gastos'),
    snap =>
      callback(
        snap.docs
          .map(d => ({ ...d.data(), id: d.id, createdAt: toIso(d.data().createdAt) ?? new Date().toISOString() }) as Gasto)
          .sort((a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt)),
      ),
    () => callback([]),
  )
}

export type GastoInput = Omit<Gasto, 'id' | 'createdByUid' | 'createdAt' | 'comprovanteUrl' | 'comprovantePath'>

function limparGasto(input: GastoInput, paraUpdate: boolean) {
  const vazio = paraUpdate ? deleteField() : undefined
  const data: Record<string, unknown> = {
    descricao: input.descricao.trim(),
    valor: input.valor,
    data: input.data,
    categoria: input.categoria,
    status: input.status,
    reembolso: input.reembolso,
    cenaId: input.cenaId || vazio,
    cenaNome: input.cenaId ? input.cenaNome : vazio,
    pagoPor: input.pagoPor?.trim() || vazio,
  }
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
}

/** Cria o gasto e, se veio arquivo, sobe o comprovante. Retorna o id. */
export async function createGasto(input: GastoInput, comprovante: File | undefined, byUid: string): Promise<string> {
  const ref = await addDoc(collection(db, 'gastos'), { ...limparGasto(input, false), createdByUid: byUid, createdAt: serverTimestamp() })
  if (comprovante) await trocarComprovante(ref.id, undefined, comprovante)
  return ref.id
}

export async function updateGasto(id: string, input: GastoInput): Promise<void> {
  await updateDoc(doc(db, 'gastos', id), limparGasto(input, true))
}

/** Sobe um comprovante novo (imagem ou PDF) e apaga o antigo, se tinha. */
export async function trocarComprovante(id: string, pathAntigo: string | undefined, file: File): Promise<void> {
  const up = await uploadArquivo(`financeiro/comprovantes/${id}`, file)
  await updateDoc(doc(db, 'gastos', id), { comprovanteUrl: up.url, comprovantePath: up.path })
  if (pathAntigo) await deleteCenaFile(pathAntigo)
}

export async function removerComprovante(gasto: Gasto): Promise<void> {
  await updateDoc(doc(db, 'gastos', gasto.id), { comprovanteUrl: deleteField(), comprovantePath: deleteField() })
  if (gasto.comprovantePath) await deleteCenaFile(gasto.comprovantePath)
}

export async function deleteGasto(gasto: Gasto): Promise<void> {
  await deleteDoc(doc(db, 'gastos', gasto.id))
  if (gasto.comprovantePath) await deleteCenaFile(gasto.comprovantePath)
}

// ---------- Legado: números digitados em Configurações ----------

/** `null` = não existe. Só pra oferecer a importação na tela nova. */
export function subscribeToFinanceiroLegado(callback: (financeiro: Financeiro | null) => void) {
  return onSnapshot(
    doc(db, 'financeiro', 'resumo'),
    snap => callback(snap.exists() ? (snap.data() as Financeiro) : null),
    () => callback(null),
  )
}

/**
 * Traz os valores antigos pro formato novo: meta, doces/ofertas como entradas e o total gasto como
 * um gasto pago "Gastos anteriores". Rifas não entram (vêm do app de rifas). Apaga o doc antigo.
 */
export async function importarFinanceiroLegado(legado: Financeiro, byUid: string, hoje: string): Promise<void> {
  const batch = writeBatch(db)
  if (legado.metaTotal) batch.set(CONFIG_REF, { metaTotal: legado.metaTotal }, { merge: true })
  const entrada = (frente: Entrada['frente'], valor: number | undefined, descricao: string) => {
    if (!valor) return
    batch.set(doc(collection(db, 'entradas')), { frente, valor, data: hoje, descricao, createdByUid: byUid, createdAt: serverTimestamp() })
  }
  entrada('doces', legado.docesValor, 'Total anterior (importado)')
  entrada('ofertas', legado.ofertasValor, 'Total anterior (importado)')
  if (legado.gastosTotal) {
    batch.set(doc(collection(db, 'gastos')), {
      descricao: 'Gastos anteriores (importado)',
      valor: legado.gastosTotal,
      data: hoje,
      categoria: 'outros',
      status: 'pago',
      reembolso: 'nao_precisa',
      createdByUid: byUid,
      createdAt: serverTimestamp(),
    })
  }
  batch.delete(doc(db, 'financeiro', 'resumo'))
  await batch.commit()
}
