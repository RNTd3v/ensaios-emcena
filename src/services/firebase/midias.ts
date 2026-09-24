import { collection, deleteDoc, deleteField, doc, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './config'
import { deleteCenaFile, uploadCenaFile } from './storage'
import type { Cena, FigurinoImagem, Musica } from '@/types'

/**
 * Músicas e figurinos (fase 4): coleções próprias (`musicas`, `figurinos`), com a cena opcional —
 * antes viviam em arrays dentro de cada cena (`cena.musicas`/`cena.figurinos`), agora legado
 * migrado por `migrarMidiasDaCena`. Os arquivos continuam no Storage em `cenas/{cenaId|geral}/...`.
 */

const PASTA_SEM_CENA = 'geral'

function semUndefined<T extends object>(obj: T) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

// ---------- Leitura ----------

export function subscribeToMusicas(cenaId: string | undefined, callback: (musicas: Musica[]) => void) {
  const col = collection(db, 'musicas')
  return onSnapshot(
    cenaId ? query(col, where('cenaId', '==', cenaId)) : col,
    snap => callback(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Musica).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))),
    () => callback([]),
  )
}

export function subscribeToFigurinos(cenaId: string | undefined, callback: (figurinos: FigurinoImagem[]) => void) {
  const col = collection(db, 'figurinos')
  return onSnapshot(
    cenaId ? query(col, where('cenaId', '==', cenaId)) : col,
    snap => callback(snap.docs.map(d => ({ ...d.data(), id: d.id }) as FigurinoImagem).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))),
    () => callback([]),
  )
}

/**
 * `comoEquipeId`: a equipe (que gerencia esse tipo) em nome de quem a pessoa está editando. As
 * regras conferem a permissão pelo `equipeId` do doc, então ele é regravado com a equipe de quem
 * edita — assim um membro consegue mexer num item migrado ou cadastrado por outra equipe/pessoa.
 */
function comEquipe(data: Record<string, unknown>, comoEquipeId?: string) {
  return comoEquipeId ? { ...data, equipeId: comoEquipeId } : data
}

/** Antes de excluir: grava o `equipeId` de quem exclui (a regra de delete olha o doc atual). */
async function assumirEquipe(colecao: 'musicas' | 'figurinos', item: { id: string; equipeId?: string }, comoEquipeId?: string) {
  if (comoEquipeId && item.equipeId !== comoEquipeId) {
    await updateDoc(doc(db, colecao, item.id), { equipeId: comoEquipeId })
  }
}

// ---------- Músicas ----------

export interface MidiaVinculo {
  cenaId?: string
  cenaNome?: string
  equipeId?: string
}

export async function uploadMusica(file: File, vinculo: MidiaVinculo, byUid: string): Promise<void> {
  const up = await uploadCenaFile(vinculo.cenaId ?? PASTA_SEM_CENA, 'musicas', file)
  await setDoc(
    doc(db, 'musicas', up.id),
    semUndefined({
      nome: file.name.replace(/\.[^.]+$/, ''),
      url: up.url,
      path: up.path,
      cenaId: vinculo.cenaId,
      cenaNome: vinculo.cenaId ? vinculo.cenaNome : undefined,
      equipeId: vinculo.equipeId,
      uploadedByUid: byUid,
      uploadedAt: new Date().toISOString(),
    }),
  )
}

export async function updateMusica(
  id: string,
  input: { nome: string; cenaId?: string; cenaNome?: string },
  comoEquipeId?: string,
): Promise<void> {
  await updateDoc(
    doc(db, 'musicas', id),
    comEquipe(
      {
        nome: input.nome.trim(),
        cenaId: input.cenaId || deleteField(),
        cenaNome: input.cenaId ? input.cenaNome ?? deleteField() : deleteField(),
      },
      comoEquipeId,
    ),
  )
}

/** Troca o arquivo de áudio mantendo nome e vínculos; apaga o arquivo antigo depois. */
export async function trocarArquivoMusica(musica: Musica, file: File, byUid: string, comoEquipeId?: string): Promise<void> {
  const up = await uploadCenaFile(musica.cenaId ?? PASTA_SEM_CENA, 'musicas', file)
  await updateDoc(
    doc(db, 'musicas', musica.id),
    comEquipe({ url: up.url, path: up.path, uploadedByUid: byUid, uploadedAt: new Date().toISOString() }, comoEquipeId),
  )
  await deleteCenaFile(musica.path)
}

export async function deleteMusica(musica: Musica, comoEquipeId?: string): Promise<void> {
  await assumirEquipe('musicas', musica, comoEquipeId)
  await deleteDoc(doc(db, 'musicas', musica.id))
  await deleteCenaFile(musica.path)
}

// ---------- Figurinos ----------

export async function uploadFigurino(
  file: File,
  vinculo: MidiaVinculo & { personagemId?: string; personagemNome?: string; legenda?: string; aprovacao?: 'pendente' },
  byUid: string,
): Promise<void> {
  const up = await uploadCenaFile(vinculo.cenaId ?? PASTA_SEM_CENA, 'figurino', file)
  await setDoc(
    doc(db, 'figurinos', up.id),
    semUndefined({
      url: up.url,
      path: up.path,
      cenaId: vinculo.cenaId,
      cenaNome: vinculo.cenaId ? vinculo.cenaNome : undefined,
      personagemId: vinculo.cenaId ? vinculo.personagemId : undefined,
      personagemNome: vinculo.cenaId && vinculo.personagemId ? vinculo.personagemNome : undefined,
      legenda: vinculo.legenda?.trim() || undefined,
      equipeId: vinculo.equipeId,
      aprovacao: vinculo.aprovacao,
      uploadedByUid: byUid,
      uploadedAt: new Date().toISOString(),
    }),
  )
}

export async function updateFigurino(
  id: string,
  input: { cenaId?: string; cenaNome?: string; personagemId?: string; personagemNome?: string; legenda?: string },
  comoEquipeId?: string,
): Promise<void> {
  await updateDoc(
    doc(db, 'figurinos', id),
    comEquipe(
      {
        cenaId: input.cenaId || deleteField(),
        cenaNome: input.cenaId ? input.cenaNome ?? deleteField() : deleteField(),
        personagemId: input.cenaId && input.personagemId ? input.personagemId : deleteField(),
        personagemNome: input.cenaId && input.personagemId ? input.personagemNome ?? deleteField() : deleteField(),
        legenda: input.legenda?.trim() || deleteField(),
      },
      comoEquipeId,
    ),
  )
}

/** Líder da cena (ou admin) aprova/reprova a foto de figurino enviada pelo elenco. */
export async function avaliarFigurino(id: string, aprovado: boolean, motivo: string | undefined, byUid: string): Promise<void> {
  await updateDoc(doc(db, 'figurinos', id), {
    aprovacao: aprovado ? 'aprovado' : 'reprovado',
    motivoReprovacao: aprovado ? deleteField() : (motivo ?? '').trim() || deleteField(),
    avaliadoPorUid: byUid,
    avaliadoEm: new Date().toISOString(),
  })
}

/** Foto que já vale pra galeria: cadastrada pela equipe (sem aprovação) ou aprovada pelo líder. */
export function figurinoVisivel(f: Pick<FigurinoImagem, 'aprovacao'>): boolean {
  return !f.aprovacao || f.aprovacao === 'aprovado'
}

export async function deleteFigurino(figurino: FigurinoImagem, comoEquipeId?: string): Promise<void> {
  await assumirEquipe('figurinos', figurino, comoEquipeId)
  await deleteDoc(doc(db, 'figurinos', figurino.id))
  await deleteCenaFile(figurino.path)
}

// ---------- Migração do legado ----------

/** Se a cena ainda tem músicas/figurinos no formato antigo (arrays dentro do doc da cena). */
export function temMidiasLegadas(cena: Pick<Cena, 'musicas' | 'figurinos'>): boolean {
  return !!cena.musicas?.length || !!cena.figurinos?.length
}

/**
 * Copia as músicas/figurinos do array da cena pra coleções próprias (mesmo id e mesmo arquivo no
 * Storage — nada é reenviado) e esvazia os arrays. Idempotente. Só admin roda (a regra de cena só
 * deixa admin mexer em `musicas`).
 */
export async function migrarMidiasDaCena(cena: Cena): Promise<void> {
  if (!temMidiasLegadas(cena)) return
  const batch = writeBatch(db)
  for (const m of cena.musicas ?? []) {
    batch.set(doc(db, 'musicas', m.id), semUndefined({ ...m, id: undefined, cenaId: cena.id, cenaNome: cena.nome }))
  }
  for (const f of cena.figurinos ?? []) {
    const personagemNome = f.personagemId ? cena.personagens.find(p => p.id === f.personagemId)?.nome : undefined
    batch.set(doc(db, 'figurinos', f.id), semUndefined({ ...f, id: undefined, cenaId: cena.id, cenaNome: cena.nome, personagemNome }))
  }
  batch.update(doc(db, 'cenas', cena.id), { musicas: [], figurinos: [] })
  await batch.commit()
}

/**
 * Legado + coleção nova, sem duplicar (a migração usa o mesmo id) — pra ninguém deixar de ver nada
 * enquanto a migração ainda não rodou. Itens só-legado vêm marcados com `legado`.
 */
export function juntarComLegado<T extends { id: string }>(novos: T[], legado: T[] | undefined, extra: Partial<T>): (T & { legado?: boolean })[] {
  const ids = new Set(novos.map(n => n.id))
  return [...novos, ...(legado ?? []).filter(l => !ids.has(l.id)).map(l => ({ ...l, ...extra, legado: true }))]
}
