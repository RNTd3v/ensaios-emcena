import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Loader2, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { DateMultiSelect } from '@/components/ui/DateMultiSelect'
import { formatPhone } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { getInscricao, saveInscricao } from '@/services/firebase/inscricoes'
import { useAuthStore } from '@/stores/authStore'
import { AREA_LABELS, DIA_SEMANA_LABELS, type Area, type DiaSemana, type Inscricao, type InscricaoStatus } from '@/types'
import { AREA_ICONS } from '@/lib/areaIcons'
import { DIAS_OBRIGATORIOS, diasDisponiveis } from '@/lib/dias'

const AREAS = Object.keys(AREA_LABELS) as Area[]
const DIAS = Object.keys(DIA_SEMANA_LABELS) as DiaSemana[]

const schema = z
  .object({
    nomeCompleto: z.string().min(2, 'Informe seu nome completo'),
    apelido: z.string().min(1, 'Informe como quer ser chamado'),
    telefone: z.string().min(14, 'Telefone incompleto'),
    menorDeIdade: z.boolean(),
    responsavelNome: z.string().optional(),
    responsavelTelefone: z.string().optional(),
    areas: z.array(z.enum(['elenco', 'staff', 'figurino', 'tecnica'])).min(1, 'Selecione ao menos uma área'),
    dias: z.array(z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab'])),
    disponibilidadeObs: z.string().optional(),
    indisponibilidade: z.array(z.string()).optional(),
    observacoes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.menorDeIdade) {
      if (!data.responsavelNome || data.responsavelNome.trim().length < 2) {
        ctx.addIssue({ code: 'custom', path: ['responsavelNome'], message: 'Informe o nome do responsável' })
      }
      if (!data.responsavelTelefone || data.responsavelTelefone.length < 14) {
        ctx.addIssue({ code: 'custom', path: ['responsavelTelefone'], message: 'Telefone do responsável incompleto' })
      }
    }
    // Disponibilidade mínima de 3 dias só é exigida de quem se candidata ao elenco — o sábado
    // (obrigatório pra todos) conta como um deles.
    if (data.areas.includes('elenco') && diasDisponiveis(data.dias).length < 3) {
      ctx.addIssue({ code: 'custom', path: ['dias'], message: 'Elenco precisa de pelo menos 3 dias de disponibilidade' })
    }
  })

type FormData = z.infer<typeof schema>

const STATUS_LABEL: Record<InscricaoStatus, string> = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  recusado: 'Recusado',
}

const STATUS_VARIANT: Record<InscricaoStatus, 'warning' | 'success' | 'destructive'> = {
  pendente: 'warning',
  confirmado: 'success',
  recusado: 'destructive',
}

export function Inscricao() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [inscricao, setInscricao] = useState<Inscricao | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    getInscricao(user.uid).then(setInscricao)
  }, [user])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nomeCompleto: user?.displayName ?? '',
      apelido: '',
      telefone: '',
      menorDeIdade: false,
      responsavelNome: '',
      responsavelTelefone: '',
      areas: [],
      dias: [],
      disponibilidadeObs: '',
      indisponibilidade: [],
      observacoes: '',
    },
  })

  useEffect(() => {
    if (inscricao) {
      reset({
        nomeCompleto: inscricao.nomeCompleto,
        apelido: inscricao.apelido,
        telefone: inscricao.telefone,
        menorDeIdade: inscricao.menorDeIdade,
        responsavelNome: inscricao.responsavel?.nome ?? '',
        responsavelTelefone: inscricao.responsavel?.telefone ?? '',
        areas: inscricao.areas,
        dias: inscricao.disponibilidade.dias,
        disponibilidadeObs: inscricao.disponibilidade.observacao ?? '',
        indisponibilidade: inscricao.indisponibilidade ?? [],
        observacoes: inscricao.observacoes ?? '',
      })
    }
  }, [inscricao, reset])

  const areas = watch('areas')
  const dias = watch('dias')
  const requiresMinDias = areas.includes('elenco')
  // Depois de confirmada, só dá pra atualizar dados pessoais — área/disponibilidade ficam travadas.
  const isConfirmed = inscricao?.status === 'confirmado'
  const indisponibilidade = watch('indisponibilidade') ?? []
  const menorDeIdade = watch('menorDeIdade')

  function toggleArea(area: Area) {
    setValue('areas', areas.includes(area) ? areas.filter(a => a !== area) : [...areas, area], { shouldValidate: true })
    trigger('dias')
  }

  function toggleDia(dia: DiaSemana) {
    setValue('dias', dias.includes(dia) ? dias.filter(d => d !== dia) : [...dias, dia], { shouldValidate: true })
  }

  async function onSubmit(data: FormData) {
    if (!user) return
    setSubmitting(true)
    try {
      await saveInscricao(
        {
          uid: user.uid,
          nomeCompleto: data.nomeCompleto.trim(),
          apelido: data.apelido.trim(),
          telefone: data.telefone,
          email: user.email,
          menorDeIdade: data.menorDeIdade,
          responsavel: data.menorDeIdade
            ? { nome: (data.responsavelNome ?? '').trim(), telefone: data.responsavelTelefone ?? '' }
            : undefined,
          areas: data.areas,
          disponibilidade: { dias: data.dias, observacao: data.disponibilidadeObs || undefined },
          indisponibilidade: data.indisponibilidade,
          observacoes: data.observacoes || undefined,
        },
        !inscricao,
      )
      const eraNova = !inscricao
      const updated = await getInscricao(user.uid)
      setInscricao(updated)
      setEditing(false)
      // Primeira inscrição: o app acabou de ser liberado — leva pro início.
      if (eraNova) {
        navigate('/', { replace: true })
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSubmitting(false)
    }
  }

  if (inscricao === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (inscricao && !editing) {
    return (
      <div className="space-y-4">
        {saved && (
          <div className="flex items-center gap-2 rounded-xl bg-success/10 text-success px-3 py-2 text-sm">
            <CheckCircle2 className="h-4 w-4" /> Inscrição atualizada!
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Sua inscrição</CardTitle>
            <Badge variant={STATUS_VARIANT[inscricao.status]}>{STATUS_LABEL[inscricao.status]}</Badge>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              <div className="pb-3">
                <p className="text-sm text-gray-500">Nome completo</p>
                <p className="text-base font-medium text-gray-900">{inscricao.nomeCompleto}</p>
              </div>
              <div className="py-3">
                <p className="text-sm text-gray-500">Como quer ser chamado</p>
                <p className="text-base font-medium text-gray-900">{inscricao.apelido}</p>
              </div>
              <div className="py-3">
                <p className="text-sm text-gray-500">Telefone (WhatsApp)</p>
                <p className="text-base font-medium text-gray-900">{inscricao.telefone}</p>
              </div>
              {inscricao.menorDeIdade && inscricao.responsavel && (
                <div className="py-3">
                  <p className="text-sm text-gray-500">Responsável (menor de idade)</p>
                  <p className="text-base font-medium text-gray-900">
                    {inscricao.responsavel.nome} · {inscricao.responsavel.telefone}
                  </p>
                </div>
              )}
              <div className="py-3">
                <p className="text-sm text-gray-500">Áreas de interesse</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {inscricao.areas.map(a => (
                    <Badge key={a} variant="outline">
                      {AREA_LABELS[a]}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="py-3">
                <p className="text-sm text-gray-500">Disponibilidade</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {diasDisponiveis(inscricao.disponibilidade.dias).map(d => (
                    <Badge key={d} variant="outline">
                      {DIA_SEMANA_LABELS[d]}
                    </Badge>
                  ))}
                </div>
                {inscricao.disponibilidade.observacao && (
                  <p className="text-sm text-muted-foreground mt-1.5">{inscricao.disponibilidade.observacao}</p>
                )}
              </div>
              {!!inscricao.indisponibilidade?.length && (
                <div className="py-3">
                  <p className="text-sm text-gray-500">Datas em que não pode</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {inscricao.indisponibilidade.map(d => (
                      <Badge key={d} variant="outline">
                        {new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {inscricao.observacoes && (
                <div className="py-3">
                  <p className="text-sm text-gray-500">Observações</p>
                  <p className="text-base">{inscricao.observacoes}</p>
                </div>
              )}
            </div>

            <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              Editar inscrição
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!inscricao && (
        <div className="rounded-2xl bg-white/15 px-4 py-3 text-white backdrop-blur-md">
          <p className="text-base font-semibold">Boas-vindas{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!</p>
          <p className="mt-0.5 text-sm text-white/85">
            Antes de começar, preencha sua inscrição. Depois de enviar, o resto do app fica liberado.
          </p>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{inscricao ? 'Editar inscrição' : 'Nova inscrição'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="nomeCompleto">Nome completo</Label>
              <Input id="nomeCompleto" autoComplete="off" {...register('nomeCompleto')} />
              {errors.nomeCompleto && <p className="text-xs text-red-600 mt-1">{errors.nomeCompleto.message}</p>}
            </div>

            <div>
              <Label htmlFor="apelido">Como quer ser chamado</Label>
              <Input id="apelido" placeholder="Apelido" {...register('apelido')} />
              {errors.apelido && <p className="text-xs text-red-600 mt-1">{errors.apelido.message}</p>}
            </div>

            <div>
              <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
              <Input
                id="telefone"
                placeholder="(00) 00000-0000"
                value={watch('telefone')}
                onChange={e => setValue('telefone', formatPhone(e.target.value), { shouldValidate: true })}
              />
              {errors.telefone && <p className="text-xs text-red-600 mt-1">{errors.telefone.message}</p>}
            </div>

            <label className="flex items-center gap-2 text-base font-medium text-gray-900">
              <input
                type="checkbox"
                checked={menorDeIdade}
                onChange={e => setValue('menorDeIdade', e.target.checked, { shouldValidate: true })}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Sou menor de idade
            </label>

            {menorDeIdade && (
              <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div>
                  <Label htmlFor="responsavelNome">Nome do responsável</Label>
                  <Input id="responsavelNome" {...register('responsavelNome')} />
                  {errors.responsavelNome && <p className="text-xs text-red-600 mt-1">{errors.responsavelNome.message}</p>}
                </div>
                <div>
                  <Label htmlFor="responsavelTelefone">Telefone do responsável (WhatsApp)</Label>
                  <Input
                    id="responsavelTelefone"
                    placeholder="(00) 00000-0000"
                    value={watch('responsavelTelefone')}
                    onChange={e => setValue('responsavelTelefone', formatPhone(e.target.value), { shouldValidate: true })}
                  />
                  {errors.responsavelTelefone && (
                    <p className="text-xs text-red-600 mt-1">{errors.responsavelTelefone.message}</p>
                  )}
                </div>
              </div>
            )}

            {!isConfirmed && (
              <>
                <div>
                  <Label>Áreas de interesse</Label>
                  <div className="grid grid-cols-2 gap-2.5 mt-2">
                    {AREAS.map(area => {
                      const Icon = AREA_ICONS[area]
                      const selected = areas.includes(area)
                      return (
                        <button
                          key={area}
                          type="button"
                          onClick={() => toggleArea(area)}
                          className={cn(
                            'flex items-center gap-2.5 rounded-xl border px-4 py-3 text-base text-left transition-colors',
                            selected ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-gray-300 bg-white text-gray-700',
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          {AREA_LABELS[area]}
                        </button>
                      )
                    })}
                  </div>
                  {errors.areas && <p className="text-xs text-red-600 mt-1">{errors.areas.message}</p>}
                </div>

                <div>
                  <Label>Disponibilidade (dias da semana{requiresMinDias ? ', mínimo 3' : ''})</Label>
                  <div className="grid grid-cols-6 gap-1.5 mt-2">
                    {DIAS.map(dia => {
                      const obrigatorio = DIAS_OBRIGATORIOS.includes(dia)
                      return (
                        <button
                          key={dia}
                          type="button"
                          disabled={obrigatorio}
                          onClick={() => toggleDia(dia)}
                          title={obrigatorio ? 'Obrigatório pra todos' : undefined}
                          className={cn(
                            'rounded-lg border py-2.5 text-sm font-medium transition-colors disabled:cursor-default',
                            obrigatorio || dias.includes(dia)
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-gray-300 bg-white text-gray-700',
                          )}
                        >
                          {DIA_SEMANA_LABELS[dia]}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {DIAS_OBRIGATORIOS.map(d => DIA_SEMANA_LABELS[d]).join(', ')} é obrigatório pra todos.
                  </p>
                  {requiresMinDias && (
                    <p className="text-sm text-gray-500 mt-1">{diasDisponiveis(dias).length} de 3 selecionados</p>
                  )}
                  {requiresMinDias && errors.dias && <p className="text-xs text-red-600 mt-1">{errors.dias.message}</p>}
                </div>

                <div>
                  <Label htmlFor="disponibilidadeObs">Observação sobre disponibilidade (opcional)</Label>
                  <Input id="disponibilidadeObs" placeholder="Ex: só à noite, depois das 19h" {...register('disponibilidadeObs')} />
                </div>

                <div>
                  <Label>Datas em que você NÃO pode (opcional)</Label>
                  <div className="mt-1.5">
                    <DateMultiSelect value={indisponibilidade} onChange={dates => setValue('indisponibilidade', dates)} />
                  </div>
                </div>

                <div>
                  <Label htmlFor="observacoes">Alguma observação? (opcional)</Label>
                  <Input id="observacoes" placeholder="Experiência anterior, restrições, etc." {...register('observacoes')} />
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              {inscricao && (
                <Button type="button" variant="outline" className="w-full" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" className="w-full" disabled={submitting || (!isConfirmed && requiresMinDias && diasDisponiveis(dias).length < 3)}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Enviando...' : inscricao ? 'Salvar alterações' : 'Enviar inscrição'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
