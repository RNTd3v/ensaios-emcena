import type { PlataformaAnimacao } from '@/components/apresentacao/AnimacaoInstalacao'

/**
 * Qual passo da lista cada quadro da animação ilustra (mesma ordem de QUADROS_IPHONE/ANDROID em
 * AnimacaoInstalacao) — usado no modo "clique pra avançar" pra revelar os passos aos poucos.
 */
export const PASSO_POR_QUADRO: Record<PlataformaAnimacao, number[]> = {
  iphone: [0, 1, 2, 2, 3, 4],
  android: [0, 1, 1, 3, 4],
}
