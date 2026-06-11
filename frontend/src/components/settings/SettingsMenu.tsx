import { useNavigate } from 'react-router-dom'
import {
  User,
  Home,
  CalendarDays,
  ShoppingCart,
  BookOpen,
  Info,
  ChevronRight,
} from 'lucide-react'

interface NavRow {
  icon: React.ReactNode
  label: string
  description: string
  path: string
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
          description: 'Recipe types',
          path: '/settings/recipes',
        },
      ],
    },
    {
      heading: 'APP',
      rows: [
        {
          icon: <Info className="size-5 shrink-0 text-muted-foreground" />,
          label: 'About',
          description: 'Privacy, terms',
          path: '/settings/about',
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
          <div className="bg-card rounded-lg border divide-y">
            {group.rows.map((row) => (
              <button
                key={row.path}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors min-h-[44px]"
                onClick={() => navigate(row.path)}
              >
                {row.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.description}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
