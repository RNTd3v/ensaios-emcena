import { create } from 'zustand'

/**
 * Se a pessoa logada já fez a inscrição. `null` = ainda verificando; `undefined` = não deu pra
 * saber (erro) — nesse caso não se bloqueia nada. Preenchido pelo `InscricaoGuard`.
 */
export const useInscricaoStore = create<{ existe: boolean | null | undefined }>(() => ({ existe: null }))
