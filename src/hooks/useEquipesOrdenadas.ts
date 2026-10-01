import { useEffect, useState } from 'react'
import { subscribeToEquipes } from '@/services/firebase/equipes'
import type { Equipe } from '@/types'

/** Equipes em ordem alfabética, em tempo real (a lista da pergunta acompanha as equipes criadas). */
export function useEquipesOrdenadas(ativo = true): Equipe[] {
  const [equipes, setEquipes] = useState<Equipe[]>([])
  useEffect(() => {
    if (!ativo) return
    return subscribeToEquipes(l => setEquipes([...l].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))))
  }, [ativo])
  return equipes
}
