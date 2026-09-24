import type { VersiculoInput } from '@/services/firebase/versiculos'

/**
 * Versículos de incentivo sugeridos pra carga inicial (tradução NVI) — o admin adiciona pelo
 * botão "Adicionar sugeridos" na tela de versículos. Os que já existem (mesma referência) são
 * ignorados. Também é o fallback da Home enquanto não há nenhum cadastrado.
 */
export const VERSICULOS_SUGERIDOS: VersiculoInput[] = [
  { referencia: 'Colossenses 3:23', texto: 'Tudo o que fizerem, façam de coração, como para o Senhor, e não para os homens.' },
  { referencia: 'Filipenses 4:13', texto: 'Tudo posso naquele que me fortalece.' },
  {
    referencia: 'Josué 1:9',
    texto: 'Seja forte e corajoso! Não se apavore nem desanime, pois o Senhor, o seu Deus, estará com você por onde você andar.',
  },
  {
    referencia: 'Isaías 41:10',
    texto: 'Por isso não tema, pois estou com você; não tenha medo, pois sou o seu Deus. Eu o fortalecerei e o ajudarei.',
  },
  { referencia: 'Salmos 37:5', texto: 'Entregue o seu caminho ao Senhor; confie nele, e ele agirá.' },
  { referencia: 'Provérbios 16:3', texto: 'Consagre ao Senhor tudo o que você faz, e os seus planos serão bem-sucedidos.' },
  { referencia: 'Gálatas 6:9', texto: 'E não nos cansemos de fazer o bem, pois no tempo próprio colheremos, se não desanimarmos.' },
  {
    referencia: '1 Coríntios 15:58',
    texto:
      'Portanto, meus amados irmãos, mantenham-se firmes, e que nada os abale. Sejam sempre dedicados à obra do Senhor, pois vocês sabem que, no Senhor, o trabalho de vocês não será inútil.',
  },
  {
    referencia: 'Mateus 5:16',
    texto: 'Assim brilhe a luz de vocês diante dos homens, para que vejam as suas boas obras e glorifiquem ao Pai de vocês, que está nos céus.',
  },
  { referencia: 'Salmos 100:2', texto: 'Prestem culto ao Senhor com alegria; entrem na sua presença com cânticos alegres.' },
  { referencia: 'Romanos 12:11', texto: 'Nunca lhes falte o zelo, sejam fervorosos no espírito, sirvam ao Senhor.' },
  {
    referencia: '1 Pedro 4:10',
    texto: 'Cada um exerça o dom que recebeu para servir os outros, administrando fielmente a graça de Deus em suas múltiplas formas.',
  },
  { referencia: 'Salmos 96:1', texto: 'Cantem ao Senhor um novo cântico; cantem ao Senhor, todos os habitantes da terra!' },
  {
    referencia: 'Isaías 9:6',
    texto:
      'Porque um menino nos nasceu, um filho nos foi dado, e o governo está sobre os seus ombros. E ele será chamado Maravilhoso Conselheiro, Deus Poderoso, Pai Eterno, Príncipe da Paz.',
  },
  {
    referencia: 'Lucas 2:10-11',
    texto:
      'Não tenham medo. Estou lhes trazendo boas-novas de grande alegria, que são para todo o povo: Hoje, na cidade de Davi, lhes nasceu o Salvador, que é Cristo, o Senhor.',
  },
]
