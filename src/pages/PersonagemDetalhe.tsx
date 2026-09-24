import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Camera, Check, Clock, IdCard, ImagePlus, MessageCircle, Shirt, Trash2, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import { getUsers } from '@/services/firebase/auth'
import { subscribeToCena, updateCenaPersonagens } from '@/services/firebase/cenas'
import { subscribeToEnsaiosDaCena } from '@/services/firebase/ensaios'
import { useAuthStore } from '@/stores/authStore'
import { subscribeToEquipes } from '@/services/firebase/equipes'
import { avaliarFigurino, deleteFigurino, figurinoVisivel, juntarComLegado, subscribeToFigurinos, uploadFigurino } from '@/services/firebase/midias'
import type { AppUser, Cena, Ensaio, Equipe, FigurinoImagem, Inscricao, PersonagemFicha } from '@/types'
import { toDateKey, formatRelativeDia } from '@/lib/agenda'
import { formatHoraCompacta } from '@/lib/cenaHorario'
import { whatsappLink } from '@/lib/formatters'
import { FIGURINO_MAX_BYTES } from '@/lib/uploads'
import { cn } from '@/lib/utils'

const FICHA_VAZIA: PersonagemFicha = {}

/** Tela de detalhe do personagem: quem interpreta, ficha do personagem, ficha técnica (figurino) e presença nos ensaios. */
export function PersonagemDetalhe() {
  const { cenaId, personagemId } = useParams<{ cenaId: string; personagemId: string }>()
  const currentUser = useAuthStore(s => s.user)
  const [cena, setCena] = useState<Cena | null | undefined>(undefined)
  const [ensaios, setEnsaios] = useState<Ensaio[] | null>(null)
  const [inscricoes, setInscricoes] = useState<Inscricao[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})

  useEffect(() => {
    if (!cenaId) return
    return subscribeToCena(cenaId, setCena)
  }, [cenaId])

  useEffect(() => {
    if (!cenaId) return
    return subscribeToEnsaiosDaCena(cenaId, setEnsaios)
  }, [cenaId])

  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])

  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  const inscricoesByUid = Object.fromEntries((inscricoes ?? []).map(i => [i.uid, i]))

  function nameFor(uid: string) {
    return inscricoesByUid[uid]?.apelido || inscricoesByUid[uid]?.nomeCompleto || users[uid]?.displayName || 'Sem nome'
  }

  const personagem = cena?.personagens.find(p => p.id === personagemId)
  const atorInscricao = personagem?.participanteUid ? inscricoesByUid[personagem.participanteUid] : undefined

  /** Quem manda a foto do figurino é o próprio ator/atriz — entra pendente e o líder da cena aprova. */
  const podeEnviarFigurino = !!currentUser && !!personagem?.participanteUid && personagem.participanteUid === currentUser.uid
  /** Aprovar/reprovar foto de figurino: líder da cena (ou admin). */
  const podeAvaliarFigurino = !!cena && !!currentUser && (currentUser.role === 'admin' || cena.liderUid === currentUser.uid)

  // Prazo de envio: definido pela equipe de figurino (vale pra todo mundo). O prazo antigo, por
  // personagem, só aparece se a equipe ainda não definiu o dela.
  const [equipes, setEquipes] = useState<Equipe[]>([])
  useEffect(() => subscribeToEquipes(setEquipes), [])
  const prazoFigurino =
    equipes.find(e => e.gerencia?.includes('figurinos') && e.prazoFigurino)?.prazoFigurino ?? personagem?.prazoFigurino

  /** Só quem interpreta o personagem edita a própria ficha — nem admin, nem líder. */
  const isAtor = !!currentUser && !!personagem?.participanteUid && personagem.participanteUid === currentUser.uid


  const [figurinosDaCena, setFigurinosDaCena] = useState<FigurinoImagem[]>([])
  useEffect(() => {
    if (!cena?.id) return
    return subscribeToFigurinos(cena.id, setFigurinosDaCena)
  }, [cena?.id])
  // Coleção nova + o que ainda estiver no formato antigo (array na cena), sem duplicar. Todo mundo
  // vê o que já vale (da equipe ou aprovado); quem mandou vê as suas em qualquer status; o líder vê
  // as pendentes/reprovadas pra avaliar.
  const fotos = useMemo(
    () =>
      (cena ? juntarComLegado(figurinosDaCena, cena.figurinos, { cenaId: cena.id, cenaNome: cena.nome }) : []).filter(
        f =>
          f.personagemId === personagemId &&
          (figurinoVisivel(f) || f.uploadedByUid === currentUser?.uid || podeAvaliarFigurino),
      ),
    [figurinosDaCena, cena, personagemId, currentUser?.uid, podeAvaliarFigurino],
  )
  /** Excluir (igual às firestore.rules): admin, ou quem mandou enquanto não foi aprovada. */
  function podeExcluirFoto(f: FigurinoImagem & { legado?: boolean }) {
    if (f.legado || !currentUser) return false
    return currentUser.role === 'admin' || (f.uploadedByUid === currentUser.uid && f.aprovacao !== 'aprovado')
  }

  const [motivoReprovacao, setMotivoReprovacao] = useState('')
  const [reprovando, setReprovando] = useState(false)
  async function handleAvaliar(f: FigurinoImagem, aprovado: boolean) {
    if (!currentUser) return
    setUploading(true)
    try {
      await avaliarFigurino(f.id, aprovado, motivoReprovacao, currentUser.uid)
      setReprovando(false)
      setMotivoReprovacao('')
    } finally {
      setUploading(false)
    }
  }

  const galeriaInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FigurinoImagem | null>(null)

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || !cena || !currentUser || !personagemId) return
    setUploadError('')
    setUploading(true)
    try {
      for (const file of Array.from(fileList)) {
        if (!file.type.startsWith('image/')) {
          setUploadError('Só imagens são aceitas.')
          continue
        }
        if (file.size > FIGURINO_MAX_BYTES) {
          setUploadError('Cada foto precisa ter até 5MB.')
          continue
        }
        await uploadFigurino(
          file,
          { cenaId: cena.id, cenaNome: cena.nome, personagemId, personagemNome: personagem?.nome, aprovacao: 'pendente' },
          currentUser.uid,
        )
      }
    } catch {
      setUploadError('Não foi possível enviar. Tente de novo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(item: FigurinoImagem) {
    setUploading(true)
    try {
      await deleteFigurino(item)
      setDeleteTarget(null)
      setViewerIndex(null)
    } finally {
      setUploading(false)
    }
  }

  // ---------- Ficha do personagem ----------
  const [fichaDraft, setFichaDraft] = useState<PersonagemFicha>(FICHA_VAZIA)
  const [fichaCarregada, setFichaCarregada] = useState(false)
  const [savingFicha, setSavingFicha] = useState(false)

  useEffect(() => {
    if (!personagem || fichaCarregada) return
    setFichaDraft(personagem.ficha ?? FICHA_VAZIA)
    setFichaCarregada(true)
  }, [personagem, fichaCarregada])

  const fichaAlterada = JSON.stringify(fichaDraft) !== JSON.stringify(personagem?.ficha ?? FICHA_VAZIA)

  function updateFichaCampo(campo: keyof PersonagemFicha, valor: string) {
    setFichaDraft(prev => ({ ...prev, [campo]: valor }))
  }

  async function handleSaveFicha() {
    if (!cena || !currentUser || !personagem) return
    setSavingFicha(true)
    try {
      const novaLista = cena.personagens.map(p => (p.id === personagem.id ? { ...p, ficha: fichaDraft } : p))
      await updateCenaPersonagens(cena.id, novaLista, currentUser.uid)
    } finally {
      setSavingFicha(false)
    }
  }

  // ---------- Presença nos ensaios ----------
  const todayKey = toDateKey(new Date())
  const ensaiosPassados = useMemo(() => {
    if (!ensaios) return []
    return ensaios
      .filter(e => !e.canceledByUid && e.data <= todayKey)
      .sort((a, b) => b.data.localeCompare(a.data) || b.horario.localeCompare(a.horario))
  }, [ensaios, todayKey])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to={cenaId ? `/cenas/${cenaId}` : '/cenas'}>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-white flex-1 truncate">{personagem?.nome ?? 'Personagem'}</h1>
      </div>

      {cena === undefined && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {(cena === null || (cena && !personagem)) && (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground py-6">Esse personagem não existe (ou foi removido).</CardContent>
        </Card>
      )}

      {personagem && (
        <>
          <Card>
            <CardContent className="flex items-center gap-3 py-3">
              <Avatar
                photoURL={personagem.participanteUid ? users[personagem.participanteUid]?.photoURL : undefined}
                name={personagem.nome}
                className="h-11 w-11 shrink-0 text-sm"
              />
              <p className="min-w-0 flex-1 truncate text-base font-semibold">{personagem.nome}</p>
              {personagem.participanteUid && (
                <div className="flex shrink-0 items-center gap-2">
                  <div className="max-w-[130px] text-right">
                    <p className="truncate text-xs font-medium">{atorInscricao?.apelido || nameFor(personagem.participanteUid)}</p>
                    {atorInscricao?.apelido && atorInscricao?.nomeCompleto && (
                      <p className="truncate text-[11px] text-muted-foreground">({atorInscricao.nomeCompleto})</p>
                    )}
                  </div>
                  {atorInscricao?.telefone && (
                    <a
                      href={whatsappLink(atorInscricao.telefone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir WhatsApp"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {personagem.participanteUid && (
            <Card>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-base font-semibold">
                    <IdCard className="h-4 w-4 text-primary" />
                    Ficha do personagem
                  </p>
                  {!isAtor && <span className="text-[11px] text-muted-foreground">Só {nameFor(personagem.participanteUid)} edita</span>}
                </div>

                {isAtor ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <Label htmlFor="ficha-idade">Idade</Label>
                        <Input id="ficha-idade" value={fichaDraft.idade ?? ''} onChange={e => updateFichaCampo('idade', e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="ficha-sexo">Sexo</Label>
                        <Input id="ficha-sexo" value={fichaDraft.sexo ?? ''} onChange={e => updateFichaCampo('sexo', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <Label htmlFor="ficha-profissao">Profissão</Label>
                        <Input
                          id="ficha-profissao"
                          value={fichaDraft.profissao ?? ''}
                          onChange={e => updateFichaCampo('profissao', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="ficha-estilo">Estilo musical</Label>
                        <Input
                          id="ficha-estilo"
                          value={fichaDraft.estiloMusical ?? ''}
                          onChange={e => updateFichaCampo('estiloMusical', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="ficha-personalidade">Personalidade</Label>
                      <Input
                        id="ficha-personalidade"
                        value={fichaDraft.personalidade ?? ''}
                        onChange={e => updateFichaCampo('personalidade', e.target.value)}
                        placeholder="Ex.: extrovertido, ansioso, brincalhão..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="ficha-descricao">Breve descrição</Label>
                      <Textarea
                        id="ficha-descricao"
                        value={fichaDraft.descricao ?? ''}
                        onChange={e => updateFichaCampo('descricao', e.target.value)}
                        placeholder="Quem é esse personagem, sua história, seu jeito..."
                      />
                    </div>
                    {fichaAlterada && (
                      <Button className="w-full" onClick={handleSaveFicha} disabled={savingFicha}>
                        {savingFicha && <Spinner size="sm" className="border-white/40 border-t-white" />}
                        Salvar ficha
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {(
                      [
                        ['idade', 'Idade'],
                        ['sexo', 'Sexo'],
                        ['profissao', 'Profissão'],
                        ['estiloMusical', 'Estilo musical'],
                        ['personalidade', 'Personalidade'],
                        ['descricao', 'Breve descrição'],
                      ] as [keyof PersonagemFicha, string][]
                    ).map(([campo, label]) => (
                      <div key={campo} className="py-2">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm">{personagem.ficha?.[campo] || '—'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-base font-semibold">
                  <Shirt className="h-4 w-4 text-primary" />
                  Ficha técnica — figurino
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {podeEnviarFigurino
                  ? 'Mande fotos do seu figurino. Elas passam pela aprovação do líder da cena.'
                  : 'Fotos do figurino desse personagem.'}
              </p>

              {prazoFigurino && (
                <div
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
                    todayKey > prazoFigurino ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700',
                  )}
                >
                  {todayKey > prazoFigurino ? (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>
                    Prazo pra enviar o figurino: {new Date(`${prazoFigurino}T00:00:00`).toLocaleDateString('pt-BR')}
                    {todayKey > prazoFigurino && ' (vencido)'}
                  </span>
                </div>
              )}

              {podeEnviarFigurino && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-1.5" onClick={() => cameraInputRef.current?.click()} disabled={uploading}>
                    <Camera className="h-4 w-4" />
                    Tirar foto
                  </Button>
                  <Button variant="outline" className="flex-1 gap-1.5" onClick={() => galeriaInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Spinner size="sm" /> : <ImagePlus className="h-4 w-4" />}
                    Da galeria
                  </Button>
                </div>
              )}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => {
                  handleUpload(e.target.files)
                  e.target.value = ''
                }}
              />
              <input
                ref={galeriaInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => {
                  handleUpload(e.target.files)
                  e.target.value = ''
                }}
              />
              {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

              {fotos.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">Nenhuma foto ainda.</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {fotos.map((f, index) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setViewerIndex(index)}
                      className="relative aspect-square overflow-hidden rounded-lg bg-gray-100"
                    >
                      <img src={f.url} alt="" className="h-full w-full object-cover" />
                      {f.aprovacao && f.aprovacao !== 'aprovado' && (
                        <span
                          className={cn(
                            'absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white',
                            f.aprovacao === 'pendente' ? 'bg-amber-500' : 'bg-red-500',
                          )}
                        >
                          {f.aprovacao === 'pendente' ? 'Aguardando' : 'Reprovada'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {personagem.participanteUid && (
            <Card>
              <CardContent className="space-y-2">
                <p className="text-base font-semibold">Presença nos ensaios</p>
                {ensaiosPassados.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">Nenhum ensaio realizado ainda.</p>
                ) : (
                  <div className="space-y-1">
                    {ensaiosPassados.map(e => {
                      const presente = !!e.presencas?.includes(personagem.participanteUid as string)
                      return (
                        <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-sm">
                          <span className="truncate">
                            {formatRelativeDia(e.data, todayKey)} · {formatHoraCompacta(e.horario)}
                          </span>
                          {presente ? (
                            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600">
                              <Check className="h-3.5 w-3.5" />
                              Presente
                            </span>
                          ) : (
                            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-red-500">
                              <X className="h-3.5 w-3.5" />
                              Ausente
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={viewerIndex !== null} onClose={() => setViewerIndex(null)} title="Figurino">
        {viewerIndex !== null && fotos[viewerIndex] && (
          <div className="space-y-3">
            <div className="relative">
              <img src={fotos[viewerIndex].url} alt="" className="w-full rounded-lg" />
              {viewerIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setViewerIndex(i => (i ?? 0) - 1)}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                  title="Anterior"
                >
                  ‹
                </button>
              )}
              {viewerIndex < fotos.length - 1 && (
                <button
                  type="button"
                  onClick={() => setViewerIndex(i => (i ?? 0) + 1)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                  title="Próxima"
                >
                  ›
                </button>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {viewerIndex + 1}/{fotos.length}
            </p>
            {fotos[viewerIndex].aprovacao === 'pendente' && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Aguardando aprovação do líder da cena.</p>
            )}
            {fotos[viewerIndex].aprovacao === 'reprovado' && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                Reprovada{fotos[viewerIndex].motivoReprovacao ? `: ${fotos[viewerIndex].motivoReprovacao}` : '.'}
              </p>
            )}
            {fotos[viewerIndex].aprovacao === 'aprovado' && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Aprovada.</p>
            )}
            {podeAvaliarFigurino && fotos[viewerIndex].aprovacao && fotos[viewerIndex].aprovacao !== 'aprovado' &&
              (reprovando ? (
                <div className="space-y-2">
                  <Textarea
                    value={motivoReprovacao}
                    onChange={e => setMotivoReprovacao(e.target.value)}
                    placeholder="O que precisa mudar? (opcional)"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setReprovando(false)} disabled={uploading}>
                      Voltar
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => handleAvaliar(fotos[viewerIndex], false)} disabled={uploading}>
                      Reprovar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {fotos[viewerIndex].aprovacao === 'pendente' && (
                    <Button variant="outline" className="flex-1 gap-1.5 text-red-600" onClick={() => setReprovando(true)} disabled={uploading}>
                      <X className="h-4 w-4" />
                      Reprovar
                    </Button>
                  )}
                  <Button className="flex-1 gap-1.5" onClick={() => handleAvaliar(fotos[viewerIndex], true)} disabled={uploading}>
                    <Check className="h-4 w-4" />
                    Aprovar
                  </Button>
                </div>
              ))}
            {podeExcluirFoto(fotos[viewerIndex]) && (
              <Button variant="destructive" className="w-full gap-1.5" onClick={() => setDeleteTarget(fotos[viewerIndex])}>
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir foto">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">Excluir essa foto de figurino? Essa ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deleteTarget)} disabled={uploading}>
                {uploading && <Spinner size="sm" className="border-white/40 border-t-white" />}
                Excluir
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
