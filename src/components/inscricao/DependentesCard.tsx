import { useEffect, useMemo, useRef, useState } from 'react'
import { Baby, Camera, ChevronRight, Plus, UserPlus, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { getUsers } from '@/services/firebase/auth'
import { salvarDependente, subscribeToDependentes } from '@/services/firebase/dependentes'
import { AREA_ICONS } from '@/lib/areaIcons'
import { DIAS_OBRIGATORIOS, diasDisponiveis } from '@/lib/dias'
import { cn } from '@/lib/utils'
import { AREA_LABELS, DIA_SEMANA_LABELS, type AppUser, type Area, type DiaSemana, type Inscricao, type InscricaoStatus } from '@/types'

const AREAS = Object.keys(AREA_LABELS) as Area[]
const DIAS = Object.keys(DIA_SEMANA_LABELS) as DiaSemana[]
const FOTO_MAX_BYTES = 5 * 1024 * 1024

const STATUS: Record<InscricaoStatus, { label: string; variant: 'warning' | 'success' | 'destructive' }> = {
  pendente: { label: 'Pendente', variant: 'warning' },
  confirmado: { label: 'Confirmado', variant: 'success' },
  recusado: { label: 'Recusado', variant: 'destructive' },
}

/**
 * Filhos/dependentes inscritos pela pessoa (e por quem mais for responsável). Cada um vira um
 * inscrito de verdade — entra em cena, recebe personagem — mas sem login; os responsáveis cuidam
 * da inscrição e recebem as notificações dele.
 */
export function DependentesCard({ uid, responsavel }: { uid: string; responsavel: Inscricao }) {
  const [dependentes, setDependentes] = useState<Inscricao[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [editando, setEditando] = useState<Inscricao | 'novo' | null>(null)

  useEffect(() => subscribeToDependentes(uid, setDependentes), [uid])
  useEffect(() => {
    getUsers().then(l => setUsers(Object.fromEntries(l.map(u => [u.uid, u]))), () => {})
  }, [])

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-base font-semibold">
              <Baby className="h-4 w-4 text-primary" />
              Dependentes
            </p>
            <p className="text-xs text-muted-foreground">Inscreva seus filhos que também vão participar.</p>
          </div>
          <Button size="sm" className="shrink-0 gap-1" onClick={() => setEditando('novo')}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>

        {!dependentes ? (
          <Spinner size="sm" />
        ) : dependentes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum dependente inscrito.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {dependentes.map(d => {
              const outros = (d.responsaveisUids ?? []).filter(r => r !== uid)
              return (
                <button key={d.uid} type="button" onClick={() => setEditando(d)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <Avatar photoURL={d.fotoUrl} name={d.apelido || d.nomeCompleto} className="h-11 w-11 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.nomeCompleto}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.idade !== undefined ? `${d.idade} anos` : 'Idade não informada'}
                      {outros.length > 0 && ` · também com ${outros.map(o => users[o]?.displayName?.split(' ')[0] ?? '...').join(', ')}`}
                    </p>
                  </div>
                  <Badge variant={STATUS[d.status].variant} className="shrink-0 px-2 py-0.5 text-[11px]">
                    {STATUS[d.status].label}
                  </Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                </button>
              )
            })}
          </div>
        )}
      </CardContent>

      {editando && (
        <DependenteDialog
          uid={uid}
          responsavel={responsavel}
          dependente={editando === 'novo' ? undefined : editando}
          users={users}
          onClose={() => setEditando(null)}
        />
      )}
    </Card>
  )
}

interface DialogProps {
  uid: string
  responsavel: Inscricao
  dependente?: Inscricao
  users: Record<string, AppUser>
  onClose: () => void
}

function DependenteDialog({ uid, responsavel, dependente, users, onClose }: DialogProps) {
  const [nome, setNome] = useState(dependente?.nomeCompleto ?? '')
  const [apelido, setApelido] = useState(dependente?.apelido ?? '')
  const [idade, setIdade] = useState(dependente?.idade !== undefined ? String(dependente.idade) : '')
  const [areas, setAreas] = useState<Area[]>(dependente?.areas ?? ['elenco'])
  // Criança costuma ir junto com o responsável: começa com os mesmos dias dele.
  const [dias, setDias] = useState<DiaSemana[]>(dependente?.disponibilidade.dias ?? responsavel.disponibilidade.dias)
  const [observacoes, setObservacoes] = useState(dependente?.observacoes ?? '')
  const [outrosResponsaveis, setOutrosResponsaveis] = useState<string[]>(
    (dependente?.responsaveisUids ?? []).filter(r => r !== uid),
  )
  const [foto, setFoto] = useState<File | null>(null)
  const [previa, setPrevia] = useState<string | undefined>(dependente?.fotoUrl)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fotoRef = useRef<HTMLInputElement>(null)

  // Quem pode ser o outro responsável: contas de verdade (não outros dependentes), ativas.
  const candidatos = useMemo(
    () =>
      Object.values(users)
        .filter(u => u.active !== false && !u.dependente && u.uid !== uid && !outrosResponsaveis.includes(u.uid))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR')),
    [users, uid, outrosResponsaveis],
  )

  function toggle<T>(lista: T[], item: T): T[] {
    return lista.includes(item) ? lista.filter(i => i !== item) : [...lista, item]
  }

  function escolherFoto(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('A foto precisa ser uma imagem.')
    if (file.size > FOTO_MAX_BYTES) return setError('A foto precisa ter até 5MB.')
    setError('')
    setFoto(file)
    // Prévia como data: URL, não blob: — o index.html que o PWA guarda em cache pode vir com uma
    // CSP antiga, e `data:` sempre esteve liberado em img-src.
    const reader = new FileReader()
    reader.onload = () => setPrevia(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    const idadeNum = Number(idade)
    if (nome.trim().length < 2) return setError('Informe o nome completo.')
    if (!idade || !Number.isInteger(idadeNum) || idadeNum < 0 || idadeNum > 120) return setError('Informe a idade.')
    if (!areas.length) return setError('Selecione ao menos uma área.')
    if (areas.includes('elenco') && diasDisponiveis(dias).length < 3) return setError('Elenco precisa de pelo menos 3 dias de disponibilidade.')
    setSaving(true)
    setError('')
    try {
      // Quem edita continua responsável; mantém a ordem original (o primeiro é o contato principal).
      const mantidos = (dependente?.responsaveisUids ?? []).filter(r => r === uid || outrosResponsaveis.includes(r))
      const responsaveis = [...new Set([...mantidos, uid, ...outrosResponsaveis])]
      await salvarDependente(
        { nomeCompleto: nome, apelido, idade: idadeNum, areas, dias, observacoes, responsaveisUids: responsaveis },
        foto ?? undefined,
        responsavel,
        dependente,
      )
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={dependente ? 'Editar dependente' : 'Novo dependente'}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fotoRef.current?.click()}
            className="relative shrink-0 overflow-hidden rounded-full"
            aria-label="Escolher foto"
          >
            <Avatar photoURL={previa} name={nome || apelido} className="h-16 w-16 text-lg" />
            <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/45 py-0.5 text-white">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              escolherFoto(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <p className="text-xs text-muted-foreground">Toque na foto pra escolher. Ela aparece nas cenas e no elenco.</p>
        </div>

        <div>
          <Label htmlFor="dep-nome">Nome completo</Label>
          <Input id="dep-nome" value={nome} onChange={e => setNome(e.target.value)} autoFocus={!dependente} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label htmlFor="dep-apelido">Como é chamado</Label>
            <Input id="dep-apelido" value={apelido} onChange={e => setApelido(e.target.value)} placeholder="Apelido" />
          </div>
          <div>
            <Label htmlFor="dep-idade">Idade</Label>
            <Input id="dep-idade" type="number" inputMode="numeric" min={0} max={120} value={idade} onChange={e => setIdade(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Áreas</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {AREAS.map(a => {
              const Icon = AREA_ICONS[a]
              const ativo = areas.includes(a)
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAreas(prev => toggle(prev, a))}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                    ativo ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {AREA_LABELS[a]}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <Label>Disponibilidade</Label>
          <div className="mt-1.5 grid grid-cols-6 gap-1.5">
            {DIAS.map(d => {
              const obrigatorio = DIAS_OBRIGATORIOS.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  disabled={obrigatorio}
                  onClick={() => setDias(prev => toggle(prev, d))}
                  className={cn(
                    'rounded-lg border py-2 text-sm font-medium disabled:cursor-default',
                    obrigatorio || dias.includes(d) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-700',
                  )}
                >
                  {DIA_SEMANA_LABELS[d]}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Começa com os seus dias. Sábado é obrigatório pra todos.</p>
        </div>

        <div>
          <Label className="flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Outro responsável (opcional)
          </Label>
          <p className="text-xs text-muted-foreground">Ex.: o pai ou a mãe que também usa o app — ele(a) também vê e edita esta inscrição.</p>
          {outrosResponsaveis.length > 0 && (
            <div className="mb-2 mt-1.5 space-y-1">
              {outrosResponsaveis.map(r => (
                <div key={r} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-sm">
                  <Avatar photoURL={users[r]?.photoURL} name={users[r]?.displayName} className="h-7 w-7 text-[10px]" />
                  <span className="min-w-0 flex-1 truncate">{users[r]?.displayName ?? '...'}</span>
                  <button
                    type="button"
                    onClick={() => setOutrosResponsaveis(prev => prev.filter(x => x !== r))}
                    title="Remover"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Escolher já adiciona — antes dependia de um "+" ao lado, e quem só escolhia e salvava perdia a pessoa. */}
          <div className="mt-1.5">
            <Select
              value=""
              onChange={e => e.target.value && setOutrosResponsaveis(prev => [...prev, e.target.value])}
              aria-label="Adicionar responsável"
            >
              <option value="">{outrosResponsaveis.length ? 'Adicionar mais alguém...' : 'Escolher pessoa...'}</option>
              {candidatos.map(u => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="dep-obs">Observações (opcional)</Label>
          <Textarea
            id="dep-obs"
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            className="mt-1.5"
            placeholder="Ex.: alergias, horário que precisa sair"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          {dependente ? 'Salvar' : 'Inscrever dependente'}
        </Button>
        {!dependente && (
          <p className="text-center text-[11px] text-muted-foreground">
            A inscrição vai como pendente, como a sua — a coordenação confirma.
          </p>
        )}
      </div>
    </Dialog>
  )
}
