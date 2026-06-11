import { Check, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const EXIT_DURATION_MS = 220

type ShoppingVariant = {
  variant: 'shopping'
  name: string
  subtitle?: string
  removing?: boolean
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => void
    onPointerLeave: (e: React.PointerEvent<HTMLButtonElement>) => void
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void
  }
  didFire: () => boolean
  onRemove: () => void
}

type InventoryVariant = {
  variant: 'inventory'
  name: string
  subtitle?: string
  onShoppingList: boolean
  onRowClick: () => void
  onToggle: () => void
}

type RecipeVariant = {
  variant: 'recipe'
  name: string
  subtitle?: string
  inList: boolean
  onToggle: () => void
}

type ItemRowProps = ShoppingVariant | InventoryVariant | RecipeVariant

export function ItemRow(props: ItemRowProps) {
  if (props.variant === 'shopping') {
    return (
      <div
        style={{
          overflow: 'hidden',
          transition: `opacity ${EXIT_DURATION_MS}ms ease, max-height ${EXIT_DURATION_MS}ms ease`,
          maxHeight: props.removing ? 0 : '80px',
          opacity: props.removing ? 0 : 1,
        }}
      >
        <button
          {...props.handlers}
          onClick={() => { if (!props.didFire()) props.onRemove() }}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-accent transition-colors select-none"
          aria-label={`Mark ${props.name} as bought`}
        >
          <div className="flex-1 min-w-0">
            <span className="block text-sm truncate">{props.name}</span>
            {props.subtitle && (
              <span className="block text-xs text-muted-foreground truncate">{props.subtitle}</span>
            )}
          </div>
          <Check className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </div>
    )
  }

  if (props.variant === 'inventory') {
    return (
      <div className="flex items-center">
        <button
          className="flex-1 px-4 py-2.5 text-left hover:bg-accent transition-colors"
          onClick={props.onRowClick}
        >
          <div className="text-sm">{props.name}</div>
          {props.subtitle && (
            <div className="text-xs text-muted-foreground">{props.subtitle}</div>
          )}
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 mr-2 text-muted-foreground"
          aria-label={props.onShoppingList
            ? `Remove ${props.name} from shopping list`
            : `Add ${props.name} to shopping list`}
          onClick={e => { e.stopPropagation(); props.onToggle() }}
        >
          {props.onShoppingList
            ? <Check className="size-4" />
            : <ShoppingCart className="size-4" />}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{props.name}</p>
        {props.subtitle && (
          <p className="text-xs text-muted-foreground">{props.subtitle}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground"
        aria-label={props.inList
          ? `Remove ${props.name} from shopping list`
          : `Add ${props.name} to shopping list`}
        onClick={props.onToggle}
      >
        {props.inList
          ? <Check className="size-4" />
          : <ShoppingCart className="size-4" />}
      </Button>
    </div>
  )
}
