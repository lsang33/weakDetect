import { format, formatDistanceToNow, startOfWeek, endOfWeek, subWeeks, isWithinInterval, differenceInDays, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy-MM-dd')
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy-MM-dd HH:mm')
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: zhCN })
}

export function getWeekRange(weeksAgo: number = 0): { start: Date; end: Date } {
  const now = new Date()
  const target = subWeeks(now, weeksAgo)
  return {
    start: startOfWeek(target, { weekStartsOn: 1 }),
    end: endOfWeek(target, { weekStartsOn: 1 }),
  }
}

export function isWithinLastNDays(date: Date, days: number): boolean {
  const now = new Date()
  const daysDiff = differenceInDays(now, date)
  return daysDiff <= days
}

export function daysSince(date: Date): number {
  return differenceInDays(new Date(), date)
}

export { format, parseISO, differenceInDays }
