import { Baby, Brush, Castle, Crown, Footprints, Gem, Lightbulb, Mars, Package, Scissors, Shirt, ShoppingCart, User, Venus, type LucideIcon } from 'lucide-react'

/** Categorias dos links de compra — lista fixa pra o filtro não se perder em variações do mesmo nome. */
export const CATEGORIAS_COMPRA: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'roupas', label: 'Roupas', icon: Shirt },
  { value: 'calcados', label: 'Calçados', icon: Footprints },
  { value: 'acessorios', label: 'Acessórios', icon: Gem },
  { value: 'tecidos', label: 'Tecidos e aviamentos', icon: Scissors },
  { value: 'maquiagem', label: 'Maquiagem e cabelo', icon: Brush },
  { value: 'aderecos', label: 'Adereços de cena', icon: Crown },
  { value: 'cenario', label: 'Cenário', icon: Castle },
  { value: 'som_luz', label: 'Som e luz', icon: Lightbulb },
  { value: 'outros', label: 'Outros', icon: Package },
]

export const GENEROS_COMPRA = [
  { value: 'feminino', label: 'Feminino', icon: Venus },
  { value: 'masculino', label: 'Masculino', icon: Mars },
] as const

export const FAIXAS_COMPRA = [
  { value: 'adulto', label: 'Adulto', icon: User },
  { value: 'crianca', label: 'Criança', icon: Baby },
] as const

export type GeneroCompra = (typeof GENEROS_COMPRA)[number]['value']
export type FaixaCompra = (typeof FAIXAS_COMPRA)[number]['value']

export function categoriaCompraLabel(value: string | undefined): string | undefined {
  return value ? (CATEGORIAS_COMPRA.find(c => c.value === value)?.label ?? value) : undefined
}

/** Ícone da categoria (sem categoria = carrinho). */
export function categoriaCompraIcon(value: string | undefined): LucideIcon {
  return CATEGORIAS_COMPRA.find(c => c.value === value)?.icon ?? ShoppingCart
}
