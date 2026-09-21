import { useEffect } from 'react'
import { useSelectionStore } from '@/stores/selectionStore'

/** Esconde o footer do AppLayout (via selectionStore) enquanto há seleção ativa na página. */
export function useSelectionVisibility(hasSelection: boolean) {
  useEffect(() => {
    useSelectionStore.setState({ hasSelection })
  }, [hasSelection])

  useEffect(() => {
    return () => useSelectionStore.setState({ hasSelection: false })
  }, [])
}
