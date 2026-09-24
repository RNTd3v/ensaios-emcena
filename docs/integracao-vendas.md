# Integração com os apps de vendas (rifas e doces)

A tela **Metas e gastos** do app de ensaios mostra quanto já foi arrecadado com rifas e doces.
Cada venda acontece num app próprio, cada um no seu projeto Firebase:

| App | Pasta | Projeto Firebase |
| --- | --- | --- |
| Rifas | `../rnt-rifa` | `vendas-rifas-emcena` |
| Doces | `../doces-emcena` | `vendas-doces-emcena575` |

O app de ensaios **não tem acesso aos dados de venda** desses projetos. Ele só lê um documento de
**total público**, `stats/public`, pela API REST do Firestore, sem login. Esse documento tem só
somas, sem dado de comprador nem de pedido. A leitura fica em `src/services/externo/vendas.ts`.

## Rifas

- **`stats/public`**: `{ totalArrecadado, totalVendido, updatedAt }`. Conta só as vendas **pagas**.
- **Como fica em dia**, em `rnt-rifa/src/services/firebase/sales.ts`: cada mudança que afeta venda
  paga ajusta o total com `increment()` na mesma gravação.
  - `createSaleGroup`: quando a venda já nasce paga.
  - `markSalePaid` e `markSalesPaid`: em transação, e só pelos canhotos que realmente mudaram de
    estado. Marcar duas vezes não conta em dobro.
  - `deleteSale`: se a venda era paga.
  - `resetRaffleData`: zera o total.
- **A tela Admin da rifa** continua recalculando tudo do zero (`syncPublicStats`), o que corrige
  qualquer diferença.
- **Regra** (`rnt-rifa/firestore.rules`): o admin escreve em `stats`. Vendedores (`isMember`) só
  podem mexer em `totalArrecadado`, `totalVendido` e `updatedAt` do `stats/public`.
- **No app de ensaios:** entra automaticamente, sem configurar nada.

## Doces

- **`stats/public`**: `{ totalArrecadado, totalPedidos, porMeta: { [metaId]: { total, pedidos } }, updatedAt }`.
- **Por meta:** o app de doces também vende para outras causas. Em 24/09/2026 a meta ativa lá era
  "Viagem Missionária Piauí". Por isso o total é separado por meta, e pedidos sem meta ficam em
  `porMeta.sem_meta`.
- **Como fica em dia**, em `doces-emcena/src/firebase/stats.ts`: `syncPublicStats(pedidos)`
  recalcula tudo a partir de todos os pedidos. É chamado pela tela **Relatório**
  (`src/pages/admin/Relatorio.tsx`, que exige login) sempre que ela carrega, e ela recarrega
  depois de criar, editar ou excluir um pedido.
- **Por que não atualiza a cada pedido:** qualquer pessoa, mesmo sem login, cria pedido pela tela
  pública (`allow create: if true`). Por isso o pedido não pode mexer no total público. Um pedido
  feito pela tela pública só entra no total quando alguém abre o Relatório.
- **Regra** (`doces-emcena/firestore.rules`): `stats` com leitura pública e escrita por quem está
  logado.
- **No app de ensaios:**
  1. No app de doces, crie uma meta própria do musical, por exemplo "Musical de Natal", e use-a nas
     vendas.
  2. Em Metas e gastos → aba Arrecadação → card **Doces** → lápis, escolha essa meta. Isso fica
     salvo em `financeiro/config.docesMetaId`.
  3. Com a meta escolhida, a frente "Doces" some do lançamento manual. Se ainda houver lançamentos
     manuais de doces, o card avisa, para você excluir os que já estão no app de doces e não contar
     em dobro.

## Se quiser o total dos doces sempre em dia

Uma Cloud Function `onDocumentWritten('orders/{id}')` no projeto `vendas-doces-emcena575`, chamando
a mesma soma de `syncPublicStats`, deixaria o total em tempo real. Precisa do plano Blaze e de
publicar funções no projeto.

## Observações

- A leitura usa `https://firestore.googleapis.com/...`, já liberada no CSP do `firebase.json` do app
  de ensaios (`connect-src https://*.googleapis.com`).
- Se `stats/public` mudar de nome ou de campos num dos apps, ajuste
  `src/services/externo/vendas.ts`.
- As metas dos doces (`metas`) já eram públicas lá. É assim que o app de ensaios lista as metas para
  escolher.
