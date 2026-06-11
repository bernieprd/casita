import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Coffee } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  setHeader: (node: ReactNode | null) => void
}

export default function AboutSettings({ setHeader }: Props) {
  const navigate = useNavigate()

  useEffect(() => {
    setHeader(
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings')}
          className="-ml-2"
          aria-label="Back to Settings"
        >
          <ArrowLeft />
        </Button>
        <h1 className="flex-1 text-lg font-bold">About</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader])

  return (
    <div className="py-2 space-y-5">
      {/* Legal links */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Legal
        </p>
        <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
          <a
            href="https://casita.bernardoprd.com/privacy"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors min-h-[44px]"
          >
            <span className="flex-1 text-sm font-medium">Privacy Policy</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </a>
          <a
            href="https://casita.bernardoprd.com/terms"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors min-h-[44px]"
          >
            <span className="flex-1 text-sm font-medium">Terms of Service</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </a>
        </div>
      </div>

      {/* Tipping jar */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Support Casita
        </p>
        <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] px-4 py-4 flex items-center gap-3">
          <Coffee className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Tipping jar</p>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  )
}
