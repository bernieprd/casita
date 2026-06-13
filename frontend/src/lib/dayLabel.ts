/**
 * Returns a function that formats a YYYY-MM-DD (or ISO datetime) string as a
 * localised day label, substituting today/tomorrow strings for those two dates.
 *
 * format:
 *   'weekday'      → "Mon"            (Home widget — event rows)
 *   'date'         → "15 Jun"         (Home widget — todo due dates)
 *   'weekday-date' → "Mon, 15 Jun"    (Calendar section headers)
 */
export type DayLabelFormat = 'weekday' | 'date' | 'weekday-date'

export function makeDayLabel(
  locale: string,
  today: string,
  tomorrow: string,
  format: DayLabelFormat = 'weekday-date',
) {
  return (dateStr: string): string => {
    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
    const [y, m, d] = datePart.split('-').map(Number)
    const date = new Date(y, m - 1, d)

    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
    const tomorrowDate = new Date(todayDate); tomorrowDate.setDate(todayDate.getDate() + 1)
    if (date.toDateString() === todayDate.toDateString()) return today
    if (date.toDateString() === tomorrowDate.toDateString()) return tomorrow

    const weekday = date.toLocaleDateString(locale, { weekday: 'short' })
    const day     = date.getDate()
    const month   = date.toLocaleDateString(locale, { month: 'short' })

    if (format === 'weekday') return weekday
    if (format === 'date')    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    return `${weekday}, ${day} ${month}`
  }
}
