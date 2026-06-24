import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsBack } from '@/hooks/useSettingsBack'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  setHeader: (node: ReactNode | null) => void
}

interface ChangelogEntry {
  monthKey: string
  entryKey: string
}

const CHANGELOG: ChangelogEntry[] = [
  { monthKey: 'month_june_2026', entryKey: 'e0' },
  { monthKey: 'month_june_2026', entryKey: 'e1' },
  { monthKey: 'month_june_2026', entryKey: 'e2' },
  { monthKey: 'month_june_2026', entryKey: 'e3' },
  { monthKey: 'month_june_2026', entryKey: 'e4' },
  { monthKey: 'month_june_2026', entryKey: 'e5' },
  { monthKey: 'month_june_2026', entryKey: 'e6' },
  { monthKey: 'month_june_2026', entryKey: 'e7' },
  { monthKey: 'month_june_2026', entryKey: 'e8' },
  { monthKey: 'month_june_2026', entryKey: 'e9' },
  { monthKey: 'month_june_2026', entryKey: 'e10' },
  { monthKey: 'month_june_2026', entryKey: 'e11' },
  { monthKey: 'month_june_2026', entryKey: 'e12' },
  { monthKey: 'month_june_2026', entryKey: 'e13' },
  { monthKey: 'month_june_2026', entryKey: 'e14' },
  { monthKey: 'month_june_2026', entryKey: 'e15' },
  { monthKey: 'month_june_2026', entryKey: 'e16' },
  { monthKey: 'month_june_2026', entryKey: 'e18' },
  { monthKey: 'month_may_2026', entryKey: 'e17' },
]

export default function ChangelogSettings({ setHeader }: Props) {
  const { t } = useTranslation()
  const goBack = useSettingsBack()

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
        <h1 className="flex-1 text-lg font-bold">{t('settings.menu.whatsNew')}</h1>
      </>
    )
    return () => setHeader(null)
  }, [goBack, setHeader, t])

  const groups = CHANGELOG.reduce<{ monthKey: string; entries: ChangelogEntry[] }[]>(
    (acc, entry) => {
      const existing = acc.find((g) => g.monthKey === entry.monthKey)
      if (existing) {
        existing.entries.push(entry)
      } else {
        acc.push({ monthKey: entry.monthKey, entries: [entry] })
      }
      return acc
    },
    [],
  )

  return (
    <div className="py-2 space-y-5">
      {groups.map((group) => (
        <div key={group.monthKey} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground px-1">
            {t(`changelog.${group.monthKey}`)}
          </p>
          <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
            {group.entries.map((entry) => (
              <div key={entry.entryKey} className="px-4 py-4">
                <p className="text-sm font-medium">{t(`changelog.${entry.entryKey}_title`)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t(`changelog.${entry.entryKey}_desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
