import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Clapperboard,
  Crown,
  ExternalLink,
  FileText,
  HandHelping,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { LiderAssistentesDialog } from '@/components/equipe/LiderAssistentesDialog'
import { useUsersMap } from '@/components/oracao/OrandoAgora'
import { useFinanceiro } from '@/hooks/useFinanceiro'
import { subscribeToCenas } from '@/services/firebase/cenas'
import {
  createEntrada,
  createGasto,
  deleteEntrada,
  deleteGasto,
  importarFinanceiroLegado,
  removerComprovante,
  saveDocesMeta,
  saveFinanceiroEquipe,
  saveMetaTotal,
  subscribeToFinanceiroLegado,
  trocarComprovante,
  updateEntrada,
  updateGasto,
  type EntradaInput,
  type GastoInput,
} from '@/services/firebase/financeiro'
import { APP_DOCES_URL, APP_RIFAS_URL, listarMetasDoces, type MetaDoces } from '@/services/externo/vendas'
import { useAuthStore } from '@/stores/authStore'
import {
  CATEGORIAS_GASTO,
  FRENTES,
  FRENTES_MANUAIS,
  GASTO_STATUS_LABEL,
  REEMBOLSO_LABEL,
  categoriaLabel,
} from '@/lib/financeiro'
import { toDateKey } from '@/lib/agenda'
import { formatBRL } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { AppUser, Cena, Entrada, Financeiro, Gasto, GastoReembolso, GastoStatus } from '@/types'

type Aba = 'resumo' | 'arrecadacao' | 'gastos'

const COMPROVANTE_MAX_BYTES = 10 * 1024 * 1024

function formatData(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function parseValor(v: string): number {
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

/**
 * Metas e gastos: a meta da peça, o que entrou (rifas automático do app de rifas + lançamentos
 * manuais de doces/ofertas/outros) e o que saiu (gastos gerais ou por cena). Todos veem; admin,
 * líder e assistentes (definidos pelo admin) lançam e editam.
 */
export function MetasGastos() {
  const currentUser = useAuthStore(s => s.user)
  const users = useUsersMap()
  const fin = useFinanceiro()
  const [aba, setAba] = useState<Aba>('resumo')
  const [equipeOpen, setEquipeOpen] = useState(false)
  const [legado, setLegado] = useState<Financeiro | null>(null)

  const isAdmin = currentUser?.role === 'admin'
  useEffect(() => {
    if (!isAdmin) return
    return subscribeToFinanceiroLegado(setLegado)
  }, [isAdmin])

  const uid = currentUser?.uid
  const podeEditar = isAdmin || (!!uid && (fin.config?.liderUid === uid || !!fin.config?.assistentes?.includes(uid)))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-white">Metas e gastos</h1>
      </div>

      <div className="flex rounded-full border border-white/30 bg-white/10 p-1">
        {(
          [
            ['resumo', 'Resumo'],
            ['arrecadacao', 'Arrecadação'],
            ['gastos', 'Gastos'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setAba(v)}
            className={cn(
              'flex-1 rounded-full py-1.5 text-sm font-medium transition-colors',
              aba === v ? 'bg-white text-gray-900' : 'text-white',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {!fin.carregado ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <>
          {aba === 'resumo' && (
            <>
              {isAdmin && legado && currentUser && (
                <ImportarLegado legado={legado} byUid={currentUser.uid} />
              )}
              <ResumoAba fin={fin} podeEditar={podeEditar} />
              <EquipeLinha
                liderUid={fin.config?.liderUid}
                assistentes={fin.config?.assistentes ?? []}
                users={users}
                isAdmin={isAdmin}
                onEditar={() => setEquipeOpen(true)}
              />
            </>
          )}
          {aba === 'arrecadacao' && currentUser && <ArrecadacaoAba fin={fin} podeEditar={podeEditar} byUid={currentUser.uid} />}
          {aba === 'gastos' && currentUser && <GastosAba gastos={fin.gastos ?? []} podeEditar={podeEditar} byUid={currentUser.uid} />}
        </>
      )}

      {equipeOpen && (
        <LiderAssistentesDialog
          titulo="Quem cuida de metas e gastos"
          liderUid={fin.config?.liderUid}
          assistentes={fin.config?.assistentes}
          users={users}
          onSave={saveFinanceiroEquipe}
          onClose={() => setEquipeOpen(false)}
        />
      )}
    </div>
  )
}

type Fin = ReturnType<typeof useFinanceiro>

// ---------- Resumo ----------

/** Barra horizontal com valor escrito — todas na mesma escala (reais), comparáveis entre si. */
function Barra({ label, valor, max, tom = 'forte', detalhe }: { label: string; valor: number; max: number; tom?: 'forte' | 'claro'; detalhe?: string }) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0
  return (
    <div className="space-y-1" title={`${label}: ${formatBRL(valor)}`}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-semibold text-gray-900">
          {formatBRL(valor)}
          {detalhe && <span className="ml-1 text-xs font-normal text-muted-foreground">{detalhe}</span>}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded bg-gray-100">
        <div className={cn('h-full rounded', tom === 'forte' ? 'bg-primary' : 'bg-primary/35')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ResumoAba({ fin, podeEditar }: { fin: Fin; podeEditar: boolean }) {
  const r = fin.resumo
  const [editandoMeta, setEditandoMeta] = useState(false)
  const pctMeta = r.meta > 0 ? Math.round((r.arrecadado / r.meta) * 100) : null
  const maxComparativo = Math.max(r.meta, r.arrecadado, r.gastoPago + r.gastoPrevisto, 1)

  return (
    <>
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">Meta</p>
            {podeEditar && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditandoMeta(true)} title="Editar meta">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">{formatBRL(r.arrecadado)}</p>
            <p className="text-sm text-muted-foreground">
              arrecadado{r.meta > 0 ? ` de ${formatBRL(r.meta)}` : ' — sem meta definida'}
              {pctMeta !== null && <span className="ml-1 font-semibold text-gray-900">· {pctMeta}%</span>}
            </p>
          </div>
          {r.meta > 0 && (
            <div className="h-3 w-full overflow-hidden rounded bg-gray-100" title={`${pctMeta}% da meta`}>
              <div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, pctMeta ?? 0)}%` }} />
            </div>
          )}
          {r.meta > 0 && r.arrecadado < r.meta && (
            <p className="text-xs text-muted-foreground">Faltam {formatBRL(r.meta - r.arrecadado)}.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">De onde veio</p>
          {FRENTES.map(f => (
            <Barra
              key={f.value}
              label={f.label}
              valor={r.porFrente[f.value]}
              max={Math.max(r.arrecadado, 1)}
              detalhe={
                f.value === 'rifas' && fin.rifas
                  ? `· ${fin.rifas.quantidade} números`
                  : f.value === 'doces' && fin.doces
                    ? `· ${fin.doces.quantidade} pedidos`
                    : undefined
              }
            />
          ))}
          <p className="text-[11px] text-muted-foreground">
            Rifas vêm do app de rifas
            {fin.rifas?.atualizadoEm && ` (atualizado em ${new Date(fin.rifas.atualizadoEm).toLocaleDateString('pt-BR')})`}
            {fin.rifas === null && ' — não foi possível ler agora'}.{' '}
            {fin.docesIntegrado
              ? `Doces vêm do app de doces (meta "${fin.config?.docesMetaTitulo ?? '...'}"). Ofertas e outros são lançados na aba Arrecadação.`
              : 'Doces, ofertas e outros são lançados na aba Arrecadação.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Arrecadação × gastos</p>
          {r.meta > 0 && <Barra label="Meta" valor={r.meta} max={maxComparativo} tom="claro" />}
          <Barra label="Arrecadado" valor={r.arrecadado} max={maxComparativo} />
          <Barra label="Gasto (pago)" valor={r.gastoPago} max={maxComparativo} />
          {r.gastoPrevisto > 0 && <Barra label="Gasto previsto (a pagar)" valor={r.gastoPrevisto} max={maxComparativo} tom="claro" />}
          <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
            <div>
              <p className="text-xs text-muted-foreground">Saldo hoje</p>
              <p className={cn('text-lg font-bold', r.saldo < 0 ? 'text-red-600' : 'text-emerald-700')}>{formatBRL(r.saldo)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Se pagar o previsto</p>
              <p className={cn('text-lg font-bold', r.saldoProjetado < 0 ? 'text-red-600' : 'text-emerald-700')}>
                {formatBRL(r.saldoProjetado)}
              </p>
            </div>
          </div>
          {r.reembolsoPendente > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {formatBRL(r.reembolsoPendente)} em reembolsos pendentes.
            </p>
          )}
        </CardContent>
      </Card>

      {r.porCategoria.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">Gastos por categoria</p>
            {r.porCategoria.map(c => (
              <Barra key={c.categoria} label={c.label} valor={c.total} max={r.porCategoria[0].total} />
            ))}
          </CardContent>
        </Card>
      )}

      {r.porCena.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">Gastos por cena</p>
            {r.porCena.map(c => (
              <Barra key={c.chave} label={c.nome} valor={c.total} max={r.porCena[0].total} />
            ))}
          </CardContent>
        </Card>
      )}

      {editandoMeta && <MetaDialog meta={fin.config?.metaTotal} onClose={() => setEditandoMeta(false)} />}
    </>
  )
}

function MetaDialog({ meta, onClose }: { meta?: number; onClose: () => void }) {
  const [valor, setValor] = useState(meta ? String(meta) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const n = valor.trim() ? parseValor(valor) : undefined
    if (n !== undefined && (Number.isNaN(n) || n < 0)) return setError('Valor inválido.')
    setSaving(true)
    try {
      await saveMetaTotal(n)
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title="Meta de arrecadação">
      <div className="space-y-4">
        <div>
          <Label htmlFor="meta-valor">Valor a atingir (R$)</Label>
          <Input id="meta-valor" type="number" inputMode="decimal" min={0} step={0.01} value={valor} onChange={e => setValor(e.target.value)} autoFocus />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Salvar
        </Button>
      </div>
    </Dialog>
  )
}

function EquipeLinha({
  liderUid,
  assistentes,
  users,
  isAdmin,
  onEditar,
}: {
  liderUid?: string
  assistentes: string[]
  users: Record<string, AppUser>
  isAdmin: boolean
  onEditar: () => void
}) {
  if (!liderUid && !assistentes.length && !isAdmin) return null
  const nome = (u: string) => users[u]?.displayName ?? '...'
  return (
    <Card>
      <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="flex items-center gap-1">
            <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="truncate">{liderUid ? nome(liderUid) : 'Sem líder'}</span>
          </p>
          {assistentes.length > 0 && (
            <p className="flex items-center gap-1">
              <HandHelping className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{assistentes.map(nome).join(', ')}</span>
            </p>
          )}
        </div>
        {isAdmin && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onEditar} title="Quem cuida de metas e gastos">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function ImportarLegado({ legado, byUid }: { legado: Financeiro; byUid: string }) {
  const [saving, setSaving] = useState(false)
  const temValores = !!(legado.metaTotal || legado.docesValor || legado.ofertasValor || legado.gastosTotal)
  if (!temValores) return null
  return (
    <Card className="border-2 border-amber-300">
      <CardContent className="space-y-2">
        <p className="text-sm font-semibold">Valores antigos de Configurações</p>
        <p className="text-xs text-muted-foreground">
          Existem números digitados na tela antiga (meta{legado.docesValor ? ', doces' : ''}
          {legado.ofertasValor ? ', ofertas' : ''}
          {legado.gastosTotal ? ', total gasto' : ''}). Importar cria lançamentos com esses totais aqui. Rifas não entram — elas já vêm do
          app de rifas.
        </p>
        <Button
          size="sm"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await importarFinanceiroLegado(legado, byUid, toDateKey(new Date()))
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Importar
        </Button>
      </CardContent>
    </Card>
  )
}

// ---------- Arrecadação ----------

function ArrecadacaoAba({ fin, podeEditar, byUid }: { fin: Fin; podeEditar: boolean; byUid: string }) {
  const [editando, setEditando] = useState<Entrada | 'nova' | null>(null)
  const entradas = fin.entradas ?? []

  return (
    <>
      <Card>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Rifas</p>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fin.atualizarVendas} title="Atualizar">
              <RefreshCw className={cn('h-4 w-4', fin.rifas === undefined && 'animate-spin')} />
            </Button>
          </div>
          {fin.rifas === undefined ? (
            <Spinner size="sm" />
          ) : fin.rifas === null ? (
            <p className="text-xs text-muted-foreground">Não foi possível ler o total do app de rifas agora.</p>
          ) : fin.rifas.naoGerado ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              O app de rifas ainda não gerou o total. Abra a tela Admin de lá uma vez.
            </p>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">{formatBRL(fin.rifas.arrecadado)}</p>
              <p className="text-xs text-muted-foreground">
                {fin.rifas.quantidade} números vendidos
                {fin.rifas.atualizadoEm && ` · total atualizado em ${new Date(fin.rifas.atualizadoEm).toLocaleDateString('pt-BR')}`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Automático, do app de rifas — atualiza a cada venda paga.
              </p>
            </>
          )}
          <AbrirApp href={APP_RIFAS_URL} label="Abrir app de rifas" />
        </CardContent>
      </Card>

      <DocesCard fin={fin} podeEditar={podeEditar} />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Lançamentos</p>
              <p className="text-xs text-muted-foreground">
                {fin.docesIntegrado ? 'Ofertas e outras entradas' : 'Doces, ofertas e outras entradas'}
              </p>
            </div>
            {podeEditar && (
              <Button size="sm" className="gap-1" onClick={() => setEditando('nova')}>
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            )}
          </div>
          {entradas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum lançamento ainda.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {entradas.map(e => (
                <button
                  key={e.id}
                  type="button"
                  disabled={!podeEditar}
                  onClick={() => setEditando(e)}
                  className="flex w-full items-center gap-3 py-2.5 text-left disabled:cursor-default"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.descricao || FRENTES.find(f => f.value === e.frente)?.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {FRENTES.find(f => f.value === e.frente)?.label} · {formatData(e.data)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-gray-900">{formatBRL(e.valor)}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editando && (
        <EntradaDialog
          entrada={editando === 'nova' ? undefined : editando}
          docesIntegrado={fin.docesIntegrado}
          byUid={byUid}
          onClose={() => setEditando(null)}
        />
      )}
    </>
  )
}

function AbrirApp({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
      <ExternalLink className="h-3.5 w-3.5" />
      {label}
    </a>
  )
}

/**
 * Doces: escolher qual meta do app de doces conta pro musical (o app de doces também vende pra
 * outras causas). Com meta escolhida, o total vem automático; sem, doces são lançados à mão.
 */
function DocesCard({ fin, podeEditar }: { fin: Fin; podeEditar: boolean }) {
  const [metas, setMetas] = useState<MetaDoces[] | null | undefined>(undefined)
  const [escolhendo, setEscolhendo] = useState(false)
  const [saving, setSaving] = useState(false)
  const docesManuais = (fin.entradas ?? []).filter(e => e.frente === 'doces')

  useEffect(() => {
    if (!escolhendo) return
    listarMetasDoces().then(setMetas)
  }, [escolhendo])

  async function escolher(meta: MetaDoces | undefined) {
    setSaving(true)
    try {
      await saveDocesMeta(meta && { id: meta.id, titulo: meta.titulo })
      setEscolhendo(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Doces</p>
          <div className="flex items-center gap-0.5">
            {fin.docesIntegrado && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fin.atualizarVendas} title="Atualizar">
                <RefreshCw className={cn('h-4 w-4', fin.doces === undefined && 'animate-spin')} />
              </Button>
            )}
            {podeEditar && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEscolhendo(true)} title="Escolher a meta dos doces">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {!fin.docesIntegrado ? (
          <p className="text-xs text-muted-foreground">
            Ainda não ligado ao app de doces — lance as vendas de doces à mão em Lançamentos.
            {podeEditar && ' Pelo lápis, escolha a meta dos doces que é do musical pra o total vir automático.'}
          </p>
        ) : fin.doces === undefined ? (
          <Spinner size="sm" />
        ) : fin.doces === null ? (
          <p className="text-xs text-muted-foreground">Não foi possível ler o total do app de doces agora.</p>
        ) : fin.doces.naoGerado ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            O app de doces ainda não gerou o total. Abra o Relatório lá (com login) uma vez — depois disso o valor aparece aqui.
          </p>
        ) : (
          <>
            <p className="text-2xl font-bold text-gray-900">{formatBRL(fin.doces.arrecadado)}</p>
            <p className="text-xs text-muted-foreground">
              {fin.doces.quantidade} pedidos na meta "{fin.config?.docesMetaTitulo}"
              {fin.doces.atualizadoEm && ` · atualizado em ${new Date(fin.doces.atualizadoEm).toLocaleDateString('pt-BR')}`}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Automático, do app de doces. O total de lá é recalculado quando alguém abre o Relatório (tela de admin dos doces).
            </p>
          </>
        )}
        <AbrirApp href={APP_DOCES_URL} label="Abrir app de doces" />

        {fin.docesIntegrado && docesManuais.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Ainda há {docesManuais.length} lançamento(s) manual(is) de doces somando junto. Se eles já estão no app de doces, exclua-os
            em Lançamentos pra não contar em dobro.
          </p>
        )}
      </CardContent>

      {escolhendo && (
        <Dialog open onClose={() => setEscolhendo(false)} title="Meta dos doces">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O app de doces também vende pra outras causas. Escolha a meta de lá cujas vendas contam pro musical.
            </p>
            {metas === undefined ? (
              <Spinner size="sm" />
            ) : metas === null ? (
              <p className="text-sm text-red-600">Não foi possível ler as metas do app de doces.</p>
            ) : (
              <div className="space-y-1.5">
                {metas.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={saving}
                    onClick={() => escolher(m)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm',
                      fin.config?.docesMetaId === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 hover:bg-gray-50',
                    )}
                  >
                    <span className="truncate font-medium">{m.titulo}</span>
                    {m.ativo && <span className="shrink-0 text-[11px] text-muted-foreground">ativa lá</span>}
                  </button>
                ))}
                {metas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada no app de doces.</p>}
              </div>
            )}
            {fin.docesIntegrado && (
              <Button variant="outline" className="w-full" disabled={saving} onClick={() => escolher(undefined)}>
                Desligar (lançar doces à mão)
              </Button>
            )}
          </div>
        </Dialog>
      )}
    </Card>
  )
}

function EntradaDialog({
  entrada,
  docesIntegrado,
  byUid,
  onClose,
}: {
  entrada?: Entrada
  docesIntegrado: boolean
  byUid: string
  onClose: () => void
}) {
  // Doces integrados: não dá pra lançar doces à mão (contaria em dobro) — só editar um antigo.
  const frentes = FRENTES_MANUAIS.filter(f => !docesIntegrado || f.value !== 'doces' || entrada?.frente === 'doces')
  const [frente, setFrente] = useState<Entrada['frente']>(entrada?.frente ?? frentes[0].value)
  const [valor, setValor] = useState(entrada ? String(entrada.valor) : '')
  const [data, setData] = useState(entrada?.data ?? toDateKey(new Date()))
  const [descricao, setDescricao] = useState(entrada?.descricao ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  async function run(fn: () => Promise<void>) {
    setSaving(true)
    setError('')
    try {
      await fn()
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  function handleSave() {
    const n = parseValor(valor)
    if (Number.isNaN(n) || n <= 0) return setError('Informe um valor maior que zero.')
    if (!data) return setError('Informe a data.')
    const input: EntradaInput = { frente, valor: n, data, descricao }
    run(() => (entrada ? updateEntrada(entrada.id, input) : createEntrada(input, byUid)))
  }

  return (
    <Dialog open onClose={onClose} title={entrada ? 'Editar lançamento' : 'Novo lançamento'}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="entrada-frente">Frente</Label>
          <Select id="entrada-frente" value={frente} onChange={e => setFrente(e.target.value as Entrada['frente'])}>
            {frentes.map(f => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="entrada-valor">Valor (R$)</Label>
            <Input id="entrada-valor" type="number" inputMode="decimal" min={0} step={0.01} value={valor} onChange={e => setValor(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="entrada-data">Data</Label>
            <Input id="entrada-data" type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="entrada-descricao">Descrição (opcional)</Label>
          <Input id="entrada-descricao" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: oferta do culto de domingo" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Salvar
        </Button>
        {entrada &&
          (confirmDelete ? (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">Excluir esse lançamento?</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => run(() => deleteEntrada(entrada.id))} disabled={saving}>
                  Excluir
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-1.5 text-red-600" onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2 className="h-4 w-4" />
              Excluir lançamento
            </Button>
          ))}
      </div>
    </Dialog>
  )
}

// ---------- Gastos ----------

function GastosAba({ gastos, podeEditar, byUid }: { gastos: Gasto[]; podeEditar: boolean; byUid: string }) {
  const [editando, setEditando] = useState<Gasto | 'novo' | null>(null)
  const [busca, setBusca] = useState('')
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [fStatus, setFStatus] = useState<'todos' | GastoStatus>('todos')
  const [fCategoria, setFCategoria] = useState('todas')
  const [fCena, setFCena] = useState('todas')
  const [fReembolso, setFReembolso] = useState<'todos' | GastoReembolso>('todos')

  const cenasDosGastos = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of gastos) if (g.cenaId) m.set(g.cenaId, g.cenaNome ?? 'Cena')
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [gastos])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return gastos.filter(g => {
      if (termo && !g.descricao.toLowerCase().includes(termo) && !(g.pagoPor ?? '').toLowerCase().includes(termo)) return false
      if (fStatus !== 'todos' && g.status !== fStatus) return false
      if (fCategoria !== 'todas' && g.categoria !== fCategoria) return false
      if (fCena === 'geral' && g.cenaId) return false
      if (fCena !== 'todas' && fCena !== 'geral' && g.cenaId !== fCena) return false
      if (fReembolso !== 'todos' && g.reembolso !== fReembolso) return false
      return true
    })
  }, [gastos, busca, fStatus, fCategoria, fCena, fReembolso])

  const filtrosAtivos = fStatus !== 'todos' || fCategoria !== 'todas' || fCena !== 'todas' || fReembolso !== 'todos'
  const total = filtrados.reduce((a, g) => a + g.valor, 0)

  function limpar() {
    setFStatus('todos')
    setFCategoria('todas')
    setFCena('todas')
    setFReembolso('todos')
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Gastos</p>
            {podeEditar && (
              <Button size="sm" className="gap-1" onClick={() => setEditando('novo')}>
                <Plus className="h-4 w-4" />
                Novo
              </Button>
            )}
          </div>

          {gastos.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar gasto" className="pl-9 pr-9" aria-label="Buscar gasto" />
                  {busca && (
                    <button
                      type="button"
                      onClick={() => setBusca('')}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-gray-100"
                      aria-label="Limpar busca"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Button variant="outline" size="icon" className="relative h-11 w-11 shrink-0" onClick={() => setFiltrosOpen(true)} title="Filtros" aria-label="Filtros">
                  <SlidersHorizontal className="h-4 w-4" />
                  {filtrosAtivos && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />}
                </Button>
              </div>
              <p className="px-1 text-xs text-muted-foreground">
                {filtrados.length} {filtrados.length === 1 ? 'gasto' : 'gastos'} · {formatBRL(total)}
                {filtrosAtivos && (
                  <button type="button" onClick={limpar} className="ml-2 font-medium text-primary hover:underline">
                    Limpar filtros
                  </button>
                )}
              </p>
            </div>
          )}

          {gastos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum gasto lançado ainda.</p>
          ) : filtrados.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum gasto com esses filtros.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtrados.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setEditando(g)}
                  className="flex w-full items-start gap-3 py-2.5 text-left"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{g.descricao}</span>
                      {g.comprovanteUrl && <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Tem comprovante" />}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatData(g.data)} · {categoriaLabel(g.categoria)}
                      {g.pagoPor && ` · pago por ${g.pagoPor}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        className={cn(
                          'rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                          g.status === 'pago' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-600',
                        )}
                      >
                        {GASTO_STATUS_LABEL[g.status]}
                      </span>
                      {g.reembolso !== 'nao_precisa' && (
                        <span
                          className={cn(
                            'rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                            g.reembolso === 'pendente' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                          )}
                        >
                          {REEMBOLSO_LABEL[g.reembolso]}
                        </span>
                      )}
                      {g.cenaNome && (
                        <span className="flex items-center gap-1 rounded-full border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">
                          <Clapperboard className="h-2.5 w-2.5" />
                          {g.cenaNome}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-gray-900">{formatBRL(g.valor)}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={filtrosOpen} onClose={() => setFiltrosOpen(false)} title="Filtrar gastos">
        <div className="space-y-4">
          <div>
            <Label htmlFor="fg-status">Status</Label>
            <Select id="fg-status" value={fStatus} onChange={e => setFStatus(e.target.value as typeof fStatus)}>
              <option value="todos">Todos</option>
              <option value="pago">Pago</option>
              <option value="previsto">Previsto</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="fg-categoria">Categoria</Label>
            <Select id="fg-categoria" value={fCategoria} onChange={e => setFCategoria(e.target.value)}>
              <option value="todas">Todas</option>
              {CATEGORIAS_GASTO.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="fg-cena">Cena</Label>
            <Select id="fg-cena" value={fCena} onChange={e => setFCena(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="geral">Geral (sem cena)</option>
              {cenasDosGastos.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="fg-reembolso">Reembolso</Label>
            <Select id="fg-reembolso" value={fReembolso} onChange={e => setFReembolso(e.target.value as typeof fReembolso)}>
              <option value="todos">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="reembolsado">Reembolsado</option>
              <option value="nao_precisa">Não precisa</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={limpar} disabled={!filtrosAtivos}>
              Limpar
            </Button>
            <Button className="flex-1" onClick={() => setFiltrosOpen(false)}>
              Ver {filtrados.length} {filtrados.length === 1 ? 'gasto' : 'gastos'}
            </Button>
          </div>
        </div>
      </Dialog>

      {editando && (
        <GastoDialog gasto={editando === 'novo' ? undefined : editando} podeEditar={podeEditar} byUid={byUid} onClose={() => setEditando(null)} />
      )}
    </>
  )
}

function GastoDialog({ gasto, podeEditar, byUid, onClose }: { gasto?: Gasto; podeEditar: boolean; byUid: string; onClose: () => void }) {
  const currentUser = useAuthStore(s => s.user)
  const [cenas, setCenas] = useState<Cena[]>([])
  const [descricao, setDescricao] = useState(gasto?.descricao ?? '')
  const [valor, setValor] = useState(gasto ? String(gasto.valor) : '')
  const [data, setData] = useState(gasto?.data ?? toDateKey(new Date()))
  const [categoria, setCategoria] = useState(gasto?.categoria ?? 'outros')
  const [status, setStatus] = useState<GastoStatus>(gasto?.status ?? 'pago')
  const [cenaId, setCenaId] = useState(gasto?.cenaId ?? '')
  const [pagoPor, setPagoPor] = useState(gasto?.pagoPor ?? '')
  const [reembolso, setReembolso] = useState<GastoReembolso>(gasto?.reembolso ?? 'nao_precisa')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!currentUser || !podeEditar) return
    return subscribeToCenas(currentUser.role, currentUser.uid, lista => setCenas(lista.filter(c => c.ativo)))
  }, [currentUser, podeEditar])

  const cenaForaDaLista = !!gasto?.cenaId && !cenas.some(c => c.id === gasto.cenaId)

  async function run(fn: () => Promise<void>) {
    setSaving(true)
    setError('')
    try {
      await fn()
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  function escolherArquivo(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return setError('O comprovante precisa ser imagem ou PDF.')
    if (file.size > COMPROVANTE_MAX_BYTES) return setError('O comprovante precisa ter até 10MB.')
    setError('')
    setArquivo(file)
  }

  function handleSave() {
    const n = parseValor(valor)
    if (!descricao.trim()) return setError('Descreva o gasto.')
    if (Number.isNaN(n) || n <= 0) return setError('Informe um valor maior que zero.')
    if (!data) return setError('Informe a data.')
    const cenaNome = cenas.find(c => c.id === cenaId)?.nome ?? (cenaId === gasto?.cenaId ? gasto?.cenaNome : undefined)
    const input: GastoInput = {
      descricao,
      valor: n,
      data,
      categoria,
      status,
      cenaId: cenaId || undefined,
      cenaNome,
      pagoPor,
      reembolso,
    }
    run(async () => {
      if (gasto) {
        await updateGasto(gasto.id, input)
        if (arquivo) await trocarComprovante(gasto.id, gasto.comprovantePath, arquivo)
      } else {
        await createGasto(input, arquivo ?? undefined, byUid)
      }
    })
  }

  // Só leitura (quem não é da equipe): detalhes + comprovante.
  if (!podeEditar && gasto) {
    return (
      <Dialog open onClose={onClose} title="Gasto">
        <div className="space-y-2 text-sm">
          <p className="text-base font-semibold">{gasto.descricao}</p>
          <p className="text-2xl font-bold">{formatBRL(gasto.valor)}</p>
          <p className="text-muted-foreground">
            {formatData(gasto.data)} · {categoriaLabel(gasto.categoria)} · {GASTO_STATUS_LABEL[gasto.status]}
          </p>
          {gasto.cenaNome && <p className="text-muted-foreground">Cena: {gasto.cenaNome}</p>}
          {gasto.pagoPor && <p className="text-muted-foreground">Pago por {gasto.pagoPor} · {REEMBOLSO_LABEL[gasto.reembolso]}</p>}
          {gasto.comprovanteUrl && (
            <a href={gasto.comprovanteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
              <FileText className="h-4 w-4" />
              Ver comprovante
            </a>
          )}
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog open onClose={onClose} title={gasto ? 'Editar gasto' : 'Novo gasto'}>
      <div className="space-y-4">
        <div>
          <Label htmlFor="gasto-descricao">Descrição</Label>
          <Input id="gasto-descricao" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: tecido pro figurino do rei" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="gasto-valor">Valor (R$)</Label>
            <Input id="gasto-valor" type="number" inputMode="decimal" min={0} step={0.01} value={valor} onChange={e => setValor(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="gasto-data">Data</Label>
            <Input id="gasto-data" type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="gasto-categoria">Categoria</Label>
            <Select id="gasto-categoria" value={categoria} onChange={e => setCategoria(e.target.value)}>
              {CATEGORIAS_GASTO.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="gasto-status">Status</Label>
            <Select id="gasto-status" value={status} onChange={e => setStatus(e.target.value as GastoStatus)}>
              <option value="pago">Pago</option>
              <option value="previsto">Previsto</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="gasto-cena">Cena (opcional)</Label>
          <Select id="gasto-cena" value={cenaId} onChange={e => setCenaId(e.target.value)}>
            <option value="">Geral — vale pra peça toda</option>
            {cenaForaDaLista && <option value={gasto!.cenaId}>{gasto!.cenaNome ?? 'Cena'}</option>}
            {cenas.map(c => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="gasto-pagopor">Quem pagou (opcional)</Label>
            <Input id="gasto-pagopor" value={pagoPor} onChange={e => setPagoPor(e.target.value)} placeholder="Ex.: Ana" />
          </div>
          <div>
            <Label htmlFor="gasto-reembolso">Reembolso</Label>
            <Select id="gasto-reembolso" value={reembolso} onChange={e => setReembolso(e.target.value as GastoReembolso)}>
              <option value="nao_precisa">Não precisa</option>
              <option value="pendente">Pendente</option>
              <option value="reembolsado">Reembolsado</option>
            </Select>
          </div>
        </div>

        <div>
          <Label>Comprovante (opcional)</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={e => {
              escolherArquivo(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {gasto?.comprovanteUrl && !arquivo && (
              <a href={gasto.comprovanteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                <FileText className="h-4 w-4" />
                Ver atual
              </a>
            )}
            {arquivo && <span className="max-w-full truncate text-sm text-gray-700">{arquivo.name}</span>}
            <Button variant="outline" size="sm" className="gap-1" onClick={() => fileRef.current?.click()} disabled={saving}>
              <Paperclip className="h-3.5 w-3.5" />
              {gasto?.comprovanteUrl || arquivo ? 'Trocar' : 'Anexar'}
            </Button>
            {gasto?.comprovanteUrl && !arquivo && (
              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => run(() => removerComprovante(gasto))} disabled={saving}>
                Remover
              </Button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Salvar
        </Button>
        {gasto &&
          (confirmDelete ? (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">Excluir esse gasto{gasto.comprovanteUrl ? ' e o comprovante' : ''}?</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => run(() => deleteGasto(gasto))} disabled={saving}>
                  Excluir
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-1.5 text-red-600" onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2 className="h-4 w-4" />
              Excluir gasto
            </Button>
          ))}
      </div>
    </Dialog>
  )
}
