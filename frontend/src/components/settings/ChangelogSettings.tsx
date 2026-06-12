import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  setHeader: (node: ReactNode | null) => void
}

interface ChangelogEntry {
  date: string
  title: string
  description: string
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: 'June 2026',
    title: 'To-Do settings',
    description:
      'Configure your workflow style (Simple or Board) and manage to-do categories from Settings → To-Dos.',
  },
  {
    date: 'June 2026',
    title: 'Shopping home widget',
    description:
      'The home screen shopping card now gives smart trip guidance — recommending your best store, handling tied stores, and surfacing items clearly whether or not you use supermarkets.',
  },
  {
    date: 'June 2026',
    title: 'Guided import & onboarding',
    description:
      'A new import wizard lets you paste a grocery list, recipes, or to-dos and have them automatically structured and brought into Casita. New households are also walked through an optional import step right after setup.',
  },
  {
    date: 'June 2026',
    title: 'Support & Changelog',
    description: "You can now support Casita and see what's new directly from Settings.",
  },
  {
    date: 'June 2026',
    title: 'Concept delete with undo',
    description: 'Deleting a concept now cascades to clear references and shows an undo toast.',
  },
  {
    date: 'June 2026',
    title: 'Settings reorganised',
    description:
      'Settings has been reordered and each section now has a cleaner, more consistent layout.',
  },
  {
    date: 'June 2026',
    title: 'Privacy & data controls',
    description:
      'You can now delete your account, export your data, and manage privacy settings from the new Privacy section in Settings.',
  },
  {
    date: 'June 2026',
    title: 'Household member profiles',
    description: 'Each household member now has a profile with their own colour theme.',
  },
  {
    date: 'June 2026',
    title: 'PWA install prompt',
    description: 'You can install Casita on your home screen directly from the app.',
  },
  {
    date: 'June 2026',
    title: 'Recipe editor improvements',
    description:
      'Recipe instructions now support markdown formatting, and you can remove images from recipes.',
  },
  {
    date: 'June 2026',
    title: 'Household colour themes',
    description: 'Each household can now set its own colour theme from Settings.',
  },
  {
    date: 'June 2026',
    title: 'New design system',
    description: 'The app has been rebuilt with a refreshed look using a consistent design system.',
  },
  {
    date: 'June 2026',
    title: 'Shopping list improvements',
    description: 'Added quantity controls and other UX improvements to the shopping list.',
  },
  {
    date: 'June 2026',
    title: 'Household invites',
    description: 'You can now invite people to your household via a shared invite link.',
  },
  {
    date: 'June 2026',
    title: 'Google Calendar sync',
    description: 'Connect your Google Calendar to see events alongside your household tasks.',
  },
  {
    date: 'May 2026',
    title: 'Settings redesign',
    description: 'Settings pages have been reorganised with a cleaner layout.',
  },
]

export default function ChangelogSettings({ setHeader }: Props) {
  const navigate = useNavigate()

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
        <h1 className="flex-1 text-lg font-bold">What's New</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader])

  const groups = CHANGELOG.reduce<{ month: string; entries: ChangelogEntry[] }[]>((acc, entry) => {
    const existing = acc.find((g) => g.month === entry.date)
    if (existing) {
      existing.entries.push(entry)
    } else {
      acc.push({ month: entry.date, entries: [entry] })
    }
    return acc
  }, [])

  return (
    <div className="py-2 space-y-5">
      {groups.map((group) => (
        <div key={group.month} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground px-1">{group.month}</p>
          <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
            {group.entries.map((entry) => (
              <div key={entry.title} className="px-4 py-4">
                <p className="text-sm font-medium">{entry.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
