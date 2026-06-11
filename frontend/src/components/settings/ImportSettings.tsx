import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import GuidedImport from '../GuidedImport'

interface Props {
  setHeader: (node: ReactNode | null) => void
}

export default function ImportSettings({ setHeader }: Props) {
  const navigate = useNavigate()

  useEffect(() => {
    setHeader(
      <>
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="-ml-2" aria-label="Back to Settings">
          <ArrowLeft />
        </Button>
        <span className="font-semibold text-sm">Import data</span>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader])

  return (
    <div className="px-4 py-6">
      <GuidedImport
        onDone={() => navigate('/settings')}
        onSkip={() => navigate('/settings')}
      />
    </div>
  )
}
