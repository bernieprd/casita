import { useNavigate } from 'react-router-dom'
import {
  User,
  Home,
  CalendarDays,
  ShoppingCart,
  BookOpen,
  Sparkles,
  MessageSquare,
  Upload,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NavRow {
  icon: React.ReactNode
  label: string
  description: string
  path?: string
  href?: string
}

interface NavGroup {
  heading: string
  rows: NavRow[]
}

export default function SettingsMenu() {
  const navigate = useNavigate()

  const groups: NavGroup[] = [
    {
      heading: 'PERSONAL',
      rows: [
        {
          icon: <User className="size-5 shrink-0 text-muted-foreground" />,
          label: 'Account',
          description: 'Profile, sign out',
          path: '/settings/account',
        },
      ],
    },
    {
      heading: 'YOUR HOUSEHOLD',
      rows: [
        {
          icon: <Home className="size-5 shrink-0 text-muted-foreground" />,
          label: 'Household',
          description: 'Members, invite code',
          path: '/settings/household',
        },
        {
          icon: <CalendarDays className="size-5 shrink-0 text-muted-foreground" />,
          label: 'Calendar',
          description: 'Google Calendar sync',
          path: '/settings/calendar',
        },
        {
          icon: <ShoppingCart className="size-5 shrink-0 text-muted-foreground" />,
          label: 'Shopping',
          description: 'Categories, stores',
          path: '/settings/shopping',
        },
        {
          icon: <BookOpen className="size-5 shrink-0 text-muted-foreground" />,
          label: 'Recipes',
          description: 'Types of recipe',
          path: '/settings/recipes',
        },
      ],
    },
    {
      heading: 'APP',
      rows: [
        {
          icon: <Upload className="size-5 shrink-0 text-muted-foreground" />,
          label: 'Import data',
          description: 'Bring in your existing data',
          path: '/settings/import',
        },
        {
          icon: <Sparkles className="size-5 shrink-0 text-muted-foreground" />,
          label: "What's New",
          description: 'Recent updates & releases',
          path: '/settings/changelog',
        },
        {
          icon: <MessageSquare className="size-5 shrink-0 text-muted-foreground" />,
          label: 'Share feedback or report a bug',
          description: 'Feature suggestions, issues',
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
            {group.rows.map((row) =>
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
          Legal
        </p>
        <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
          <a
            href="https://casita.bernardoprd.com/privacy"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors min-h-[44px] first:rounded-t-lg last:rounded-b-lg"
          >
            <span className="flex-1 text-sm font-medium">Privacy Policy</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </a>
          <a
            href="https://casita.bernardoprd.com/terms"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors min-h-[44px] first:rounded-t-lg last:rounded-b-lg"
          >
            <span className="flex-1 text-sm font-medium">Terms of Service</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </a>
        </div>
      </div>

      {/* Support Casita */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Support Casita
        </p>
        <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Support Casita's development with a coffee! Have a feature request or feedback? Send it our way — we'd love to hear from you and will take it into account.
          </p>
          <Button asChild className="w-full">
            <a href="https://buy.stripe.com/eVq14hd4bgafdZzfoZcV200" target="_blank" rel="noreferrer">
              Buy us a coffee ☕
            </a>
          </Button>
        </div>
      </div>


    </div>
  )
}
