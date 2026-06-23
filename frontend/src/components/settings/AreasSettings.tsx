import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useHouseholdSettings, useUpdateAreasConfig } from '../../api/household'
import { isAreaEnabled, type AreaId } from '../../api/areas'
import { useTranslation } from 'react-i18next'

interface AreasSettingsProps {
  setHeader: (node: ReactNode | null) => void
}

const AREA_IDS: AreaId[] = ['calendar', 'todos', 'shopping', 'recipes']

export default function AreasSettings({ setHeader }: AreasSettingsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: householdData } = useHouseholdSettings()
  const role = householdData?.role
  const areasConfig = householdData?.areasConfig ?? null
  const isOwner = role === 'owner'

  const { mutate: updateAreasConfig } = useUpdateAreasConfig()

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
        <h1 className="flex-1 text-lg font-bold">{t('settings.areas.title')}</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader, t])

  function handleToggle(areaId: AreaId) {
    const currentEnabled = isAreaEnabled(areasConfig, areaId)
    const updated = {
      ...areasConfig,
      [areaId]: { enabled: !currentEnabled },
    }
    updateAreasConfig(updated)
  }

  const areaLabelKey: Record<AreaId, string> = {
    calendar: 'settings.areas.calendar',
    todos: 'settings.areas.todos',
    shopping: 'settings.areas.shopping',
    recipes: 'settings.areas.recipes',
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">{t('settings.areas.ownerSection')}</h2>
        <p className="text-xs text-muted-foreground mb-3">
          {t('settings.areas.ownerSectionDescription')}
        </p>
        {isOwner ? (
          <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
            {AREA_IDS.map(areaId => (
              <div key={areaId} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 text-sm font-medium">{t(areaLabelKey[areaId])}</span>
                <Switch
                  data-testid={`areas-settings-${areaId}-toggle`}
                  checked={isAreaEnabled(areasConfig, areaId)}
                  onCheckedChange={() => handleToggle(areaId)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
            {AREA_IDS.map(areaId => (
              <div key={areaId} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 text-sm font-medium">{t(areaLabelKey[areaId])}</span>
                <Switch
                  data-testid={`areas-settings-${areaId}-toggle`}
                  checked={isAreaEnabled(areasConfig, areaId)}
                  disabled
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
