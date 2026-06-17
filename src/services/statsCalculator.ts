import type { MistakeRecord } from '../models/mistake'
import type { WeeklyTrendPoint } from '../models/analytics'
import type { ExamModule, ErrorType } from '../models/exam'
import { ALL_MODULES, ALL_ERROR_TYPES } from '../lib/constants'
import { getWeekRange, isWithinLastNDays } from '../lib/dateUtils'

/** 统计每个模块的错误数量 */
export function countByModule(mistakes: MistakeRecord[]): Record<ExamModule, number> {
  const counts: Record<string, number> = {}
  for (const m of ALL_MODULES) {
    counts[m] = 0
  }
  for (const m of mistakes) {
    counts[m.module] = (counts[m.module] || 0) + 1
  }
  return counts as Record<ExamModule, number>
}

/** 统计每个错误类型的数量 */
export function countByErrorType(mistakes: MistakeRecord[]): Record<ErrorType, number> {
  const counts: Record<string, number> = {}
  for (const e of ALL_ERROR_TYPES) {
    counts[e] = 0
  }
  for (const m of mistakes) {
    counts[m.errorType] = (counts[m.errorType] || 0) + 1
  }
  return counts as Record<ErrorType, number>
}

/** 计算总体正确率，需要传入总答题数 */
export function calculateAccuracy(mistakes: MistakeRecord[], totalAnswered: number): number {
  if (totalAnswered === 0) return 100
  const errorCount = mistakes.length
  return Math.round(((totalAnswered - errorCount) / totalAnswered) * 100)
}

/** 计算各模块正确率 */
export function moduleAccuracyRates(
  mistakes: MistakeRecord[],
  totalAnsweredPerModule: Partial<Record<ExamModule, number>>
): Record<ExamModule, number> {
  const moduleCounts = countByModule(mistakes)
  const rates: Record<string, number> = {}

  for (const module of ALL_MODULES) {
    const total = totalAnsweredPerModule[module] || 0
    const errors = moduleCounts[module] || 0
    rates[module] = total === 0 ? 100 : Math.round(((total - errors) / total) * 100)
  }
  return rates as Record<ExamModule, number>
}

/** 生成周趋势数据 */
export function generateWeeklyTrend(mistakes: MistakeRecord[], weeks: number = 8): WeeklyTrendPoint[] {
  const trend: WeeklyTrendPoint[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const { start, end } = getWeekRange(i)
    const weekMistakes = mistakes.filter(m => {
      const d = new Date(m.createdAt)
      return d >= start && d <= end
    })

    const reviewed = weekMistakes.filter(m => m.reviewCount > 0).length

    trend.push({
      weekStart: start,
      mistakesLogged: weekMistakes.length,
      mistakesReviewed: reviewed,
      accuracyRate: 0,
    })
  }

  return trend
}

/** 趋势判断：比较最近两周的变化 */
export function calculateTrend(currentCount: number, previousCount: number): 'improving' | 'stable' | 'worsening' {
  if (previousCount === 0) return 'stable'
  const change = ((currentCount - previousCount) / previousCount) * 100
  if (change < -20) return 'improving'
  if (change > 20) return 'worsening'
  return 'stable'
}
