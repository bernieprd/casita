import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHouseholdSettings } from '../../api/household'
import ConceptManager from './ConceptManager'
import { useTranslation } from 'react-i18next'

interface RecipesSettingsProps {
  setHeader: (node: ReactNode | null) => void
}

export default function RecipesSettings({ setHeader }: RecipesSettingsProps) {
  const { t } = useTranslation()
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
          aria-label={t('common.back')}
        >
          <ArrowLeft />
        </Button>
        <h1 className="flex-1 text-lg font-bold">{t('settings.recipes.title')}</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader, t])

  return (
    <div className="p-4">
      <p className="text-sm text-muted-foreground mb-4">
        {t('settings.recipes.help')}
      </p>

      <ConceptManager
        type="recipe-types"
        label={t('settings.recipes.types')}
        addPlaceholder={t('settings.recipes.addType')}
        ownerOnly={isOwner}
      />
    </div>
  )
}
