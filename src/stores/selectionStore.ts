import { create } from 'zustand'

interface SelectionState {
  hasSelection: boolean
}

/** Usado pelo AppLayout pra esconder o footer quando a barra flutuante de seleção (Admin.tsx) está visível. */
export const useSelectionStore = create<SelectionState>(() => ({
  hasSelection: false,
}))
