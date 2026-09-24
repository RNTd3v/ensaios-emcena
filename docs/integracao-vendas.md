# Integração com os apps de vendas (rifas e doces)

A tela **Metas e gastos** do app de ensaios mostra quanto já foi arrecadado com rifas e doces.
Cada venda acontece num app próprio, cada um no seu projeto Firebase:

| App | Pasta | Projeto Firebase |
|---|---|---|
| Rifas | `../rnt-rifa` | `vendas-rifas-emcena` |
| Doces | `../doces-emcena` | `vendas-doces-emcena575` |

O app de ensaios **não tem acesso aos dados de venda** desses projetos. Ele só lê um documento
de **total público** em cada um, `stats/public`, pela API REST do Firestore, sem login. Esse
documento não tem dado de comprador nem de pedido, só a soma. A leitura fica em
`src/services/externo/vendas.ts`.

## Como está hoje (24/09/2026)

| | Rifas | Doces |
|---|---|---|
| Existe `stats/public`? | Sim: `{ totalArrecadado, totalVendido, updatedAt }` | **Não** (a leitura dá 403) |
| Quem atualiza | O próprio app de rifas, quando o **admin da rifa abre a tela Admin** (`src/pages/Admin.tsx`, chama `syncPublicStats`) | — |
| No app de ensaios | Lido automaticamente | Lançado **à mão** na aba Arrecadação (frente "Doces") |

## 1. Rifas: deixar o total sempre em dia

**O problema:** o total só é recalculado quando o admin da rifa abre a tela Admin. Se ninguém abre,
o app de ensaios mostra um valor velho. Em 24/09 o valor era de 18/09: R$ 180 e 18 números.

O total conta só as **vendas pagas** (`sales` com `paid == true`, somando `amount`).

**Proposta:** atualizar `stats/public` com `increment()` sempre que uma venda paga muda. Todas as
mudanças passam por `src/services/firebase/sales.ts`:

| Função | Efeito no total |
|---|---|
| `createSaleGroup` | se já nasce `paid: true`: `+amount` e `+1` por número |
| `markSalePaid(id, true/false)` | `+amount`/`+1` ao pagar; `-amount`/`-1` ao desmarcar (só se o estado mudou) |
| `markSalesPaid(ids, paid)` | o mesmo, para cada venda que realmente mudou de estado |
| `deleteSale` | se a venda era paga: `-amount`/`-1` |
| `resetRaffleData` | zerar o `stats/public` |

Exemplo, dentro de um `writeBatch` ou `runTransaction` junto com a mudança da venda:

```ts
import { doc, increment, serverTimestamp } from 'firebase/firestore'

batch.set(
  doc(db, 'stats', 'public'),
  { totalArrecadado: increment(valor), totalVendido: increment(qtd), updatedAt: serverTimestamp() },
  { merge: true },
)
```

**Regra (`rnt-rifa/firestore.rules`):** hoje só o admin escreve em `stats`. Os vendedores também
marcam vendas como pagas, então precisam poder atualizar o total, mas só esses campos:

```
match /stats/{id} {
  allow read: if true;
  allow write: if isAdmin()
    || (isMember() && id == 'public'
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['totalArrecadado', 'totalVendido', 'updatedAt']));
}
```

**Mantenha o `syncPublicStats` na tela Admin.** Ele recalcula tudo a partir das vendas e corrige
qualquer diferença que o incremento tenha deixado.

**Para publicar:** `firebase deploy --only firestore:rules` e o deploy do app, no projeto
`vendas-rifas-emcena`.

## 2. Doces: criar o total público

**O problema:** não existe total público, e os pedidos (`orders`) só podem ser lidos por quem está
logado no app de doces.

**Cuidado:** qualquer pessoa, mesmo sem login, cria pedido (`allow create: if true`). Então **não
dá** para deixar o próprio pedido atualizar o total público, porque qualquer um poderia mexer no
número. As duas opções seguras:

### Opção A: recalcular na tela de admin (simples, igual à rifa)

Na tela de gestão de pedidos do app de doces, que exige login, somar os pedidos e gravar:

```ts
// doces-emcena/src/firebase/stats.ts (novo)
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './config'

export async function syncPublicStats(totalArrecadado: number, totalPedidos: number) {
  await setDoc(doc(db, 'stats', 'public'), { totalArrecadado, totalPedidos, updatedAt: serverTimestamp() }, { merge: true })
}
```

Chame depois de carregar os pedidos (`getTodosPedidos()`), com `total` somado e a quantidade de
pedidos. Chame também depois de `gravarPedido`, `updatePedido` e `deletePedido`, quando feitos por
alguém logado.

**Regra (`doces-emcena/firestore.rules`):**

```
match /stats/{id} {
  allow read: if true;
  allow write: if request.auth != null;
}
```

Limite da opção A: o total só atualiza quando alguém logado usa o app de doces, igual à rifa hoje.

### Opção B: Cloud Function (sempre em dia)

Uma função `onDocumentWritten('orders/{id}')` no projeto `vendas-doces-emcena575` que recalcula ou
incrementa o `stats/public`. É em tempo real e não depende de ninguém abrir nada. Precisa do plano
Blaze e de publicar funções no projeto.

## 3. Depois de integrar os doces: ligar no app de ensaios

1. Em `src/services/externo/vendas.ts`, mude `DOCES_INTEGRADO` para `true`. A leitura espera
   `stats/public` com `totalArrecadado` e `totalPedidos`.
2. **Evite contar em dobro:** os lançamentos manuais com a frente "Doces" continuam somando. Antes de
   ligar, exclua esses lançamentos na aba Arrecadação, ou deixe só os que não passaram pelo app de
   doces. Com `DOCES_INTEGRADO = true`, a frente "Doces" some do formulário de lançamento.
3. Publique o app de ensaios.

## Observações

- A leitura usa `https://firestore.googleapis.com/...`, que já está liberada no CSP do `firebase.json`
  (`connect-src https://*.googleapis.com`).
- Se `stats/public` for renomeado ou mudar de campos num dos apps, ajuste
  `src/services/externo/vendas.ts`.
- Nada disso expõe dados pessoais. Os documentos públicos têm só somas.
