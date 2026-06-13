import { Check } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSwipeAction } from '@/hooks/useSwipeAction'

interface SwipeActionProps {
  onAction: () => void
  children: React.ReactNode
}

export function SwipeAction({ onAction, children }: SwipeActionProps) {
  const isMobile = useIsMobile()
  const { offset, isAnimating, handlers } = useSwipeAction(onAction)

  if (!isMobile) return <>{children}</>

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Action revealed on right as content slides left */}
      <div className="absolute inset-0 flex items-center justify-end pr-4 bg-green-500" aria-hidden>
        <Check className="size-5 text-white" />
      </div>
      {/* bg-card covers the green at rest; slides left on swipe */}
      <div
        {...handlers}
        onClickCapture={(e) => e.stopPropagation()}
        className="bg-card"
        style={{
          position: 'relative',
          transform: `translateX(${offset}px)`,
          transition: isAnimating ? 'transform 300ms ease' : 'none',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  )
}
