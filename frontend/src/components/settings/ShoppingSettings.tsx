import { useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBackfillConcepts } from '../../api/concepts'
import { useHouseholdSettings } from '../../api/household'
import ConceptManager from './ConceptManager'

interface ShoppingSettingsProps {
  setHeader: (node: ReactNode | null) => void
}

export default function ShoppingSettings({ setHeader }: ShoppingSettingsProps) {
  const navigate = useNavigate()

  const { data: householdData } = useHouseholdSettings()
  const isOwner = householdData?.role === 'owner'

  // Backfill concepts when the user lands on this subpage (more targeted than
  // the old behaviour that fired on every Settings open).
  const { mutate: backfill } = useBackfillConcepts()
  const backfillRan = useRef(false)
  useEffect(() => {
    if (backfillRan.current) return
    backfillRan.current = true
    backfill()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        <h1 className="flex-1 text-lg font-bold">Shopping</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader])

  return (
    <div className="p-4">
      <p className="text-sm text-muted-foreground mb-4">
        These labels help you organize your shopping list and group items by store.
      </p>

      <ConceptManager
        type="categories"
        label="Categories"
        addPlaceholder="Add a category"
        ownerOnly={isOwner}
      />

      <ConceptManager
        type="supermarkets"
        label="Supermarkets"
        addPlaceholder="Add a supermarket"
        ownerOnly={isOwner}
      />
    </div>
  )
}
