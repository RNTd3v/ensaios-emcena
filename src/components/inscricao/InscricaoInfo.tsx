import { MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { whatsappLink } from '@/lib/formatters'
import { diasDisponiveis } from '@/lib/dias'
import { AREA_LABELS, DIA_SEMANA_LABELS, type AppUser, type Cena, type Equipe, type Inscricao } from '@/types'
import { interesseRespondido, nomesInteresse } from '@/lib/interesse'

/**
 * O que a pessoa preencheu na inscrição (contato, áreas, disponibilidade, observações) e as cenas
 * em que está. Usado nos detalhes do Gerenciamento e da Disponibilidade.
 */
export function InscricaoInfo({
  inscricao,
  users,
  inscricoes,
  cenas,
  equipes = [],
}: {
  inscricao: Inscricao
  users: Record<string, AppUser>
  /** Pra achar nome e telefone dos responsáveis de um dependente. */
  inscricoes: Inscricao[]
  cenas: Cena[]
  /** Pra mostrar os nomes das equipes em que a pessoa quer ajudar. */
  equipes?: Equipe[]
}) {
  return (
    <div className="divide-y divide-gray-100">
      <div className="pb-3">
        <p className="text-sm text-muted-foreground">Como quer ser chamado</p>
        <p className="text-base">{inscricao.apelido}</p>
      </div>
      <div className="py-3">
        <p className="text-sm text-muted-foreground">Telefone (WhatsApp)</p>
        <a
          href={whatsappLink(inscricao.telefone)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-base text-primary hover:underline"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {inscricao.telefone}
        </a>
      </div>
      <div className="py-3">
        <p className="text-sm text-muted-foreground">Email</p>
        <p className="text-base">{inscricao.email}</p>
      </div>
      {inscricao.dependente ? (
        // Dependente: `responsavel` guarda só quem salvou por último — os responsáveis de
        // verdade são `responsaveisUids`, com nome/telefone vindos da inscrição de cada um.
        <div className="py-3">
          <p className="text-sm text-muted-foreground">Responsáveis</p>
          <div className="mt-1 space-y-1">
            {(inscricao.responsaveisUids ?? []).map(r => {
              const insc = inscricoes.find(x => x.uid === r)
              return (
                <p key={r} className="text-base">
                  {insc?.nomeCompleto ?? users[r]?.displayName ?? 'Sem nome'}
                  {insc?.telefone && (
                    <>
                      {' · '}
                      <a
                        href={whatsappLink(insc.telefone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {insc.telefone}
                      </a>
                    </>
                  )}
                </p>
              )
            })}
          </div>
        </div>
      ) : inscricao.menorDeIdade && inscricao.responsavel && (
        <div className="py-3">
          <p className="text-sm text-muted-foreground">Responsável (menor de idade)</p>
          <p className="text-base">
            {inscricao.responsavel.nome} ·{' '}
            <a
              href={whatsappLink(inscricao.responsavel.telefone)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {inscricao.responsavel.telefone}
            </a>
          </p>
        </div>
      )}
      <div className="py-3">
        <p className="text-sm text-muted-foreground">Áreas de interesse</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {inscricao.areas.map(a => (
            <Badge key={a} variant="outline">
              {AREA_LABELS[a]}
            </Badge>
          ))}
        </div>
      </div>
      {interesseRespondido(inscricao.equipesInteresse, inscricao.ajudaOutro) && (
        <div className="py-3">
          <p className="text-sm text-muted-foreground">Quer ajudar em</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {nomesInteresse(inscricao.equipesInteresse, equipes).map(n => (
              <Badge key={n} variant="outline" className="border-primary/40 bg-primary/5 text-primary">
                {n}
              </Badge>
            ))}
          </div>
          {inscricao.ajudaOutro && <p className="text-sm text-muted-foreground mt-1.5">{inscricao.ajudaOutro}</p>}
        </div>
      )}
      {!!cenas.length && (
        <div className="py-3">
          <p className="text-sm text-muted-foreground">Cenas</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {cenas.map(cena => (
              <Badge key={cena.id} variant="outline">
                {cena.nome}
              </Badge>
            ))}
          </div>
        </div>
      )}
      <div className="py-3">
        <p className="text-sm text-muted-foreground">Disponibilidade</p>
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
          <p className="text-sm text-muted-foreground">Datas em que não pode</p>
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
          <p className="text-sm text-muted-foreground">Observações</p>
          <p className="text-base">{inscricao.observacoes}</p>
        </div>
      )}
    </div>
  )
}
