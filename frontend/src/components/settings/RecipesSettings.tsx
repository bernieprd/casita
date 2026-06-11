import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHouseholdSettings } from '../../api/household'
import ConceptManager from './ConceptManager'

interface RecipesSettingsProps {
  setHeader: (node: ReactNode | null) => void
}

export default function RecipesSettings({ setHeader }: RecipesSettingsProps) {
  const navigate = useNavigate()

  const { data: householdData } = useHouseholdSettings()
  const isOwner = householdData?.role === 'owner'

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
        <h1 className="flex-1 text-lg font-bold">Recipes</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader])

  return (
    <div className="p-4">
      <p className="text-sm text-muted-foreground mb-4">
        Types help you filter and browse your recipe collection.
      </p>

      <ConceptManager
        type="recipe-types"
        label="Recipe Types"
        addPlaceholder="Add a type"
        ownerOnly={isOwner}
      />
    </div>
  )
}
