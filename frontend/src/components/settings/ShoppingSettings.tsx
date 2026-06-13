import { useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBackfillConcepts } from '../../api/concepts'
import { useHouseholdSettings } from '../../api/household'
import ConceptManager from './ConceptManager'
import { useTranslation } from 'react-i18next'

interface ShoppingSettingsProps {
  setHeader: (node: ReactNode | null) => void
}

export default function ShoppingSettings({ setHeader }: ShoppingSettingsProps) {
  const { t } = useTranslation()
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
          aria-label={t('common.back')}
        >
          <ArrowLeft />
        </Button>
        <h1 className="flex-1 text-lg font-bold">{t('settings.shopping.title')}</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader, t])

  return (
    <div className="p-4">
      <p className="text-sm text-muted-foreground mb-4">
        {t('settings.shopping.help')}
      </p>

      <ConceptManager
        type="categories"
        label={t('settings.shopping.categories')}
        addPlaceholder={t('settings.shopping.addCategory')}
        ownerOnly={isOwner}
      />

      <ConceptManager
        type="supermarkets"
        label={t('settings.shopping.supermarkets')}
        addPlaceholder={t('settings.shopping.addSupermarket')}
        ownerOnly={isOwner}
      />
    </div>
  )
}
