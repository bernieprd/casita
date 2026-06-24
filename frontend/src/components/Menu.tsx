import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, CheckSquare, ShoppingCart, BookOpen, ChevronRight } from 'lucide-react'
import { useMe } from '@/api/me'
import { useHouseholdSettings } from '@/api/household'
import { isAreaEnabled, computePinnedTabs, type AreaId } from '@/api/areas'
import SettingsMenu from './settings/SettingsMenu'

const ALL_AREA_IDS: AreaId[] = ['calendar', 'todos', 'shopping', 'recipes']

export default function Menu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: householdSettings } = useHouseholdSettings()
  const areasConfig = householdSettings?.areasConfig ?? null

  const pinnedSet = new Set(computePinnedTabs(me?.tabConfig, areasConfig))
  const unpinnedEnabledAreas = ALL_AREA_IDS.filter(
    (id) => isAreaEnabled(areasConfig, id) && !pinnedSet.has(id),
  )

  const AREA_META: Record<AreaId, { label: string; icon: React.ReactNode; path: string }> = {
    calendar: { label: t('nav.calendar'), icon: <CalendarDays className="size-5 shrink-0 text-muted-foreground" />, path: '/calendar' },
    todos:    { label: t('nav.todos'),    icon: <CheckSquare  className="size-5 shrink-0 text-muted-foreground" />, path: '/todos' },
    shopping: { label: t('nav.shopping'), icon: <ShoppingCart className="size-5 shrink-0 text-muted-foreground" />, path: '/shopping' },
    recipes:  { label: t('nav.recipes'),  icon: <BookOpen     className="size-5 shrink-0 text-muted-foreground" />, path: '/recipes' },
  }

  return (
    <div className="py-2 space-y-5">
      {unpinnedEnabledAreas.length > 0 && (
        <div>
          <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
            {unpinnedEnabledAreas.map((id) => {
              const { label, icon, path } = AREA_META[id]
              return (
                <button
                  key={id}
                  data-testid={`menu-area-card-${id}`}
                  onClick={() => navigate(path)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors min-h-[44px] first:rounded-t-lg last:rounded-b-lg"
                >
                  {icon}
                  <span className="flex-1 text-sm font-medium">{label}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              )
            })}
          </div>
        </div>
      )}
      <SettingsMenu />
    </div>
  )
}
