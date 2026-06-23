import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { centsToEuros } from '@/api/finance'

interface Props {
  source: string
  tag: string | null
  amountCents: number
  badge?: React.ReactNode
  onEdit?: () => void
  onDelete?: () => void
}

export default function EntryRow({ source, tag, amountCents, badge, onEdit, onDelete }: Props) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent transition-colors"
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onEdit?.() }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{source}</p>
        {tag && (
          <div className="flex items-center gap-1 mt-0.5">
            <Badge variant="secondary" className="text-xs capitalize">{tag}</Badge>
            {badge}
          </div>
        )}
        {!tag && badge && <div className="mt-0.5">{badge}</div>}
      </div>
      <span className="text-sm font-semibold tabular-nums shrink-0">€{centsToEuros(amountCents)}</span>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={e => { e.stopPropagation(); onDelete() }}
          aria-label="Delete"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  )
}
