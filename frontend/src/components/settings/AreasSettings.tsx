import { useEffect, type ReactNode } from 'react'
import { useSettingsBack } from '@/hooks/useSettingsBack'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useHouseholdSettings, useUpdateAreasConfig } from '../../api/household'
import { useMe, useUpdateTabConfig } from '../../api/me'
import { isAreaEnabled, computePinnedTabs, ALL_AREA_IDS, type AreaId } from '../../api/areas'
import { useTranslation } from 'react-i18next'

interface Props {
  setHeader: (node: ReactNode | null) => void
}

export default function AreasSettings({ setHeader }: Props) {
  const { t } = useTranslation()
  const goBack = useSettingsBack()

  const { data: householdData } = useHouseholdSettings()
  const isOwner = householdData?.role === 'owner'
  const areasConfig = householdData?.areasConfig ?? null

  const { data: me } = useMe()
  const tabConfig = me?.tabConfig ?? null

  const { mutate: updateAreasConfig } = useUpdateAreasConfig()
  const { mutate: updateTabConfig } = useUpdateTabConfig()

  const pinnedAreas = computePinnedTabs(tabConfig, areasConfig)
  const pinnedSet = new Set(pinnedAreas)

  const areaLabelKey: Record<AreaId, string> = {
    calendar: 'settings.areas.calendar',
    todos:    'settings.areas.todos',
    shopping: 'settings.areas.shopping',
    recipes:  'settings.areas.recipes',
  }

  useEffect(() => {
    setHeader(
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          className="-ml-2"
          aria-label={t('common.back')}
        >
          <ArrowLeft />
        </Button>
        <h1 className="flex-1 text-lg font-bold">{t('settings.areas.title')}</h1>
      </>
    )
    return () => setHeader(null)
  }, [goBack, setHeader, t])

  function handleAreaToggle(areaId: AreaId) {
    updateAreasConfig({ ...areasConfig, [areaId]: { enabled: !isAreaEnabled(areasConfig, areaId) } })
  }

  function handleTabPinToggle(areaId: AreaId) {
    let newPinned: AreaId[]
    if (pinnedSet.has(areaId)) {
      newPinned = pinnedAreas.filter((id) => id !== areaId)
    } else {
      newPinned = [...pinnedAreas, areaId].slice(0, 3)
    }
    updateTabConfig({ pinned: newPinned })
  }

  const enabledAreas = ALL_AREA_IDS.filter((id) => isAreaEnabled(areasConfig, id))

  return (
    <div className="p-4 space-y-6">
      {/* ── Household areas (visible to all, editable by owner only) ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          {t('settings.areas.ownerSection')}
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          {t('settings.areas.ownerSectionDescription')}
        </p>
        <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
          {ALL_AREA_IDS.map((areaId) => (
            <div key={areaId} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 text-sm font-medium">{t(areaLabelKey[areaId])}</span>
              <Switch
                data-testid={`areas-settings-${areaId}-toggle`}
                checked={isAreaEnabled(areasConfig, areaId)}
                onCheckedChange={() => handleAreaToggle(areaId)}
                disabled={!isOwner}
              />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* ── Per-user tab pins ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          {t('settings.areas.userSection')}
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          {t('settings.areas.userSectionDescription')}
        </p>
        {enabledAreas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('settings.areas.noAreasEnabled')}</p>
        ) : (
          <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
            {enabledAreas.map((areaId) => {
              const isPinned = pinnedSet.has(areaId)
              const atMax = pinnedAreas.length >= 3
              return (
                <div key={areaId} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 text-sm font-medium">{t(areaLabelKey[areaId])}</span>
                  <Switch
                    data-testid={`areas-settings-tab-pin-${areaId}`}
                    checked={isPinned}
                    onCheckedChange={() => handleTabPinToggle(areaId)}
                    disabled={!isPinned && atMax}
                  />
                </div>
              )
            })}
          </div>
        )}
        {pinnedAreas.length >= 3 && (
          <p className="text-xs text-muted-foreground mt-2">{t('settings.areas.maxTabsNote')}</p>
        )}
      </div>
    </div>
  )
}
