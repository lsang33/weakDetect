import type { MistakeRecord } from '../models/mistake'
import type { ReviewItem } from '../models/review'
import type { ExamModule, ErrorType } from '../models/exam'
import { isWithinLastNDays, daysSince } from '../lib/dateUtils'
import { DEFAULT_SPACED_REPETITION } from '../models/review'

const DAILY_LIMIT = 20
const MAX_MODULE_RATIO = 0.6

/** 计算薄弱分数（与 analyticsService 保持一致） */
function weaknessScore(records: MistakeRecord[]): number {
  if (records.length === 0) return 0
  let score = records.length * 2
  const hasRecent = records.some(r => isWithinLastNDays(new Date(r.createdAt), 7))
  if (hasRecent) score += 3
  if (records.length >= 3) score += 5
  const totalReviews = records.reduce((s, r) => s + r.reviewCount, 0)
  score -= totalReviews * 0.5
  const masteredCount = records.filter(r => r.mastered).length
  score -= masteredCount * 1
  return Math.max(0, score)
}

/** 生成今日复习计划 */
export function generateReviewPlan(mistakes: MistakeRecord[]): ReviewItem[] {
  const active = mistakes.filter(m => !m.mastered)
  if (active.length === 0) return []

  // 按知识点分组计算薄弱分数
  const kpMap = new Map<string, MistakeRecord[]>()
  for (const m of active) {
    const existing = kpMap.get(m.knowledgePoint) || []
    existing.push(m)
    kpMap.set(m.knowledgePoint, existing)
  }

  const kpScores = new Map<string, number>()
  for (const [kp, records] of kpMap) {
    kpScores.set(kp, weaknessScore(records))
  }

  // 为每条错题计算优先级
  const scored = active.map(m => {
    const kpScore = kpScores.get(m.knowledgePoint) || 0
    const priority: ReviewItem['priority'] =
      kpScore >= 10 ? 'high' :
      kpScore >= 5 ? 'medium' : 'low'

    const reasonParts: string[] = []
    const errorCount = kpMap.get(m.knowledgePoint)?.length || 0
    if (errorCount >= 3) reasonParts.push(`该考点已错${errorCount}次`)
    if (m.reviewCount === 0) reasonParts.push('尚未复习过')
    else {
      const daysSinceReview = m.reviewedAt ? daysSince(new Date(m.reviewedAt)) : 999
      reasonParts.push(`上次复习${daysSinceReview}天前`)
    }
    if (isWithinLastNDays(new Date(m.createdAt), 7)) reasonParts.push('最近一周新增')

    return {
      mistakeId: m.id,
      knowledgePoint: m.knowledgePoint,
      module: m.module,
      subCategory: m.subCategory,
      errorType: m.errorType as string,
      priority,
      reason: reasonParts.join('，'),
    }
  })

  // 排序：薄弱分数 DESC → 距上次复习时间 DESC → 错误次数 DESC
  scored.sort((a, b) => {
    const scoreDiff = (kpScores.get(b.knowledgePoint) || 0) - (kpScores.get(a.knowledgePoint) || 0)
    if (scoreDiff !== 0) return scoreDiff

    const aMistake = active.find(m => m.id === a.mistakeId)
    const bMistake = active.find(m => m.id === b.mistakeId)
    const aDays = aMistake?.reviewedAt ? daysSince(new Date(aMistake.reviewedAt)) : 999
    const bDays = bMistake?.reviewedAt ? daysSince(new Date(bMistake.reviewedAt)) : 999
    return bDays - aDays
  })

  // 确保模块多样性
  const selected: ReviewItem[] = []
  const moduleCounts: Record<string, number> = {}

  for (const item of scored) {
    if (selected.length >= DAILY_LIMIT) break
    const modCount = moduleCounts[item.module] || 0
    const maxForModule = Math.ceil(DAILY_LIMIT * MAX_MODULE_RATIO)
    if (modCount >= maxForModule) continue
    selected.push(item)
    moduleCounts[item.module] = (moduleCounts[item.module] || 0) + 1
  }

  return selected
}

/** 检查间隔复习到期 */
export function getDueForSpacedRepetition(
  mistakes: MistakeRecord[],
  config = DEFAULT_SPACED_REPETITION
): MistakeRecord[] {
  return mistakes.filter(m => {
    if (m.mastered) return false
    if (m.reviewCount >= config.maxReviews) return false
    if (!m.reviewedAt) return true // 从未复习过

    const lastReview = new Date(m.reviewedAt)
    const daysSinceReview = daysSince(lastReview)
    const targetInterval = config.intervals[Math.min(m.reviewCount, config.intervals.length - 1)]
    return daysSinceReview >= targetInterval
  })
}
