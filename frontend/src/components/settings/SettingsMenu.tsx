import { useNavigate } from 'react-router-dom'
import { useHouseholdSettings } from '@/api/household'
import { useCommsPreferences } from '@/api/account'
import { isAreaEnabled, type AreaId } from '@/api/areas'
import {
  User,
  Bell,
  Home,
  CalendarDays,
  ShoppingCart,
  BookOpen,
  CheckSquare,
  LayoutGrid,
  Sparkles,
  MessageSquare,
  Upload,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

interface NavRow {
  icon: React.ReactNode
  label: string
  description: string
  path?: string
  href?: string
  area?: AreaId
  badge?: boolean
}

interface NavGroup {
  heading: string
  rows: NavRow[]
}

export default function SettingsMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: householdSettings } = useHouseholdSettings()
  const areasConfig = householdSettings?.areasConfig
  const { data: commsPrefs } = useCommsPreferences()

  const groups: NavGroup[] = [
    {
      heading: t('settings.menu.personal'),
      rows: [
        {
          icon: <User className="size-5 shrink-0 text-muted-foreground" />,
          label: t('settings.menu.account'),
          description: t('settings.menu.accountDescription'),
          path: '/settings/account',
        },
        {
          icon: <Bell className="size-5 shrink-0 text-muted-foreground" />,
          label: t('settings.menu.notifications'),
          description: t('settings.menu.notificationsDescription'),
          path: '/settings/notifications',
          badge: commsPrefs?.email_notifications_enabled === false,
        },
      ],
    },
    {
      heading: t('settings.menu.yourHousehold'),
      rows: [
        {
          icon: <Home className="size-5 shrink-0 text-muted-foreground" />,
          label: t('settings.menu.household'),
          description: t('settings.menu.householdDescription'),
          path: '/settings/household',
        },
        {
          icon: <LayoutGrid className="size-5 shrink-0 text-muted-foreground" />,
          label: t('settings.menu.areasAndTabs'),
          description: t('settings.menu.areasAndTabsDescription'),
          path: '/settings/areas',
        },
        {
          icon: <CalendarDays className="size-5 shrink-0 text-muted-foreground" />,
          label: t('settings.menu.calendar'),
          description: t('settings.menu.calendarDescription'),
          path: '/settings/calendar',
          area: 'calendar' as AreaId,
        },
        {
          icon: <CheckSquare className="size-5 shrink-0 text-muted-foreground" />,
          label: t('settings.menu.todos'),
          description: t('settings.menu.todosDescription'),
          path: '/settings/todos',
          area: 'todos' as AreaId,
        },
        {
          icon: <ShoppingCart className="size-5 shrink-0 text-muted-foreground" />,
          label: t('settings.menu.shopping'),
          description: t('settings.menu.shoppingDescription'),
          path: '/settings/shopping',
          area: 'shopping' as AreaId,
        },
        {
          icon: <BookOpen className="size-5 shrink-0 text-muted-foreground" />,
          label: t('settings.menu.recipes'),
          description: t('settings.menu.recipesDescription'),
          path: '/settings/recipes',
          area: 'recipes' as AreaId,
        },
      ],
    },
    {
      heading: t('settings.menu.app'),
      rows: [
        {
          icon: <Upload className="size-5 shrink-0 text-muted-foreground" />,
          label: t('settings.menu.importData'),
          description: t('settings.menu.importDataDescription'),
          path: '/settings/import',
        },
        {
          icon: <Sparkles className="size-5 shrink-0 text-muted-foreground" />,
          label: t('settings.menu.whatsNew'),
          description: t('settings.menu.whatsNewDescription'),
          path: '/settings/changelog',
        },
        {
          icon: <MessageSquare className="size-5 shrink-0 text-muted-foreground" />,
          label: t('settings.menu.feedback'),
          description: t('settings.menu.feedbackDescription'),
          href: 'https://form.typeform.com/to/Hb0utMfi',
        },
      ],
    },
  ]

  return (
    <div className="py-2 space-y-5">
      {groups.map((group) => (
        <div key={group.heading}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
            {group.heading}
          </p>
          <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
            {group.rows.filter((row) => !row.area || isAreaEnabled(areasConfig, row.area)).map((row) =>
              row.href ? (
                <a
                  key={row.href}
                  href={row.href}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors min-h-[44px] first:rounded-t-lg last:rounded-b-lg"
                >
                  {row.icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.description}</p>
                  </div>
                  {row.badge && <span className="size-2 rounded-full bg-primary shrink-0" />}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </a>
              ) : (
                <button
                  key={row.path}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors min-h-[44px] first:rounded-t-lg last:rounded-b-lg"
                  onClick={() => navigate(row.path!)}
                >
                  {row.icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.description}</p>
                  </div>
                  {row.badge && <span className="size-2 rounded-full bg-primary shrink-0" />}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              )
            )}
          </div>
        </div>
      ))}

{/* Legal */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
          {t('settings.menu.legal')}
        </p>
        <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
          <a
            href="https://mycasita.app/privacy"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors min-h-[44px] first:rounded-t-lg last:rounded-b-lg"
          >
            <span className="flex-1 text-sm font-medium">{t('settings.menu.privacyPolicy')}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </a>
          <a
            href="https://mycasita.app/terms"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors min-h-[44px] first:rounded-t-lg last:rounded-b-lg"
          >
            <span className="flex-1 text-sm font-medium">{t('settings.menu.termsOfService')}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </a>
        </div>
      </div>

      {/* Support Casita */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
          {t('settings.menu.supportCasita')}
        </p>
        <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {t('settings.menu.supportText')}
          </p>
          <Button asChild className="w-full">
            <a href="https://buy.stripe.com/eVq14hd4bgafdZzfoZcV200" target="_blank" rel="noreferrer">
              {t('settings.menu.buyACoffee')}
            </a>
          </Button>
        </div>
      </div>


    </div>
  )
}
