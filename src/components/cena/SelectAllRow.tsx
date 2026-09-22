interface Props {
  totalCount: number
  hasSelection: boolean
  onSelectAll: () => void
  onClear: () => void
}

export function SelectAllRow({ totalCount, hasSelection, onSelectAll, onClear }: Props) {
  return (
    <div className="flex items-center justify-between text-xs px-0.5">
      <button type="button" onClick={onSelectAll} className="font-medium text-white/90 hover:text-white">
        Selecionar todos{totalCount > 0 ? ` (${totalCount})` : ''}
      </button>
      {hasSelection && (
        <button type="button" onClick={onClear} className="text-white/70 hover:text-white">
          Limpar
        </button>
      )}
    </div>
  )
}
