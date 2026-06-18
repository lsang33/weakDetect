import type { MistakeRecord } from '../models/mistake'
import type { AnalyticsSummary, ModuleStats, WeakPoint, StatsConfig } from '../models/analytics'
import type { ExamModule, ErrorType } from '../models/exam'
import { ALL_MODULES, ALL_ERROR_TYPES } from '../lib/constants'
import { isWithinLastNDays, daysSince } from '../lib/dateUtils'
import { countByModule, countByErrorType, generateWeeklyTrend } from './statsCalculator'

const RECENT_DAYS = 7
const REPEAT_THRESHOLD = 3

/** 计算单个知识点的薄弱分数 */
function calculateWeaknessScore(records: MistakeRecord[]): number {
  if (records.length === 0) return 0

  let score = records.length * 2

  // 近期性加分
  const hasRecent = records.some(r => isWithinLastNDays(new Date(r.createdAt), RECENT_DAYS))
  if (hasRecent) score += 3

  // 重复性加分
  if (records.length >= REPEAT_THRESHOLD) score += 5

  // 复习次数惩罚（说明已经在努力）
  const totalReviews = records.reduce((sum, r) => sum + r.reviewCount, 0)
  score -= totalReviews * 0.5

  // 有掌握的减少
  const masteredCount = records.filter(r => r.mastered).length
  score -= masteredCount * 1

  return Math.max(0, score)
}

/** 判断薄弱点趋势 */
function getTrend(records: MistakeRecord[]): 'improving' | 'stable' | 'worsening' {
  const now = new Date()
  const recent14 = records.filter(r => isWithinLastNDays(new Date(r.createdAt), 14)).length
  const older14to28 = records.filter(r => {
    const d = new Date(r.createdAt)
    const days = daysSince(d)
    return days > 14 && days <= 28
  }).length

  if (recent14 === 0 && older14to28 === 0) return 'stable'
  if (older14to28 === 0) return recent14 > 0 ? 'worsening' : 'stable'

  const ratio = recent14 / older14to28
  if (ratio < 0.5) return 'improving'
  if (ratio > 1.5) return 'worsening'
  return 'stable'
}

/** 提取薄弱知识点列表 */
function extractWeakPoints(recordsMap: Map<string, MistakeRecord[]>): WeakPoint[] {
  const weakPoints: WeakPoint[] = []

  for (const [knowledgePoint, records] of recordsMap) {
    const activeRecords = records.filter(r => !r.mastered)
    if (activeRecords.length === 0) continue

    const errorTypes = [...new Set(activeRecords.map(r => r.errorType))]
    const sortedByDate = [...activeRecords].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    weakPoints.push({
      knowledgePoint,
      module: sortedByDate[0].module,
      mistakeCount: activeRecords.length,
      errorTypes,
      lastMistakeDate: new Date(sortedByDate[0].createdAt),
      trend: getTrend(activeRecords),
      score: calculateWeaknessScore(activeRecords),
    })
  }

  return weakPoints.sort((a, b) => b.score - a.score)
}

/** 构建单个模块的统计数据 */
function buildModuleStats(
  module: ExamModule,
  mistakes: MistakeRecord[],
  allWeakPoints: WeakPoint[]
): ModuleStats {
  const moduleMistakes = mistakes.filter(m => m.module === module)

  const errorTypeBreakdown: Record<string, number> = {}
  for (const et of ALL_ERROR_TYPES) {
    errorTypeBreakdown[et] = moduleMistakes.filter(m => m.errorType === et).length
  }

  const totalAnswered = moduleMistakes.length
  const masteredCount = moduleMistakes.filter(m => m.mastered).length

  return {
    module,
    totalMistakes: moduleMistakes.length,
    masteredCount,
    accuracyRate: 0, // 需要总答题数才能算，这里记为0，外部覆盖
    weakPoints: allWeakPoints.filter(wp => wp.module === module),
    errorTypeBreakdown: errorTypeBreakdown as Record<ErrorType, number>,
  }
}

/** 计算完整分析总览 */
export function computeSummary(mistakes: MistakeRecord[], config?: StatsConfig): AnalyticsSummary {
  const activeMistakes = mistakes.filter(m => !m.mastered)
  const totalMistakes = mistakes.length
  const masteredMistakes = totalMistakes - activeMistakes.length

  // 按知识点分组
  const kpMap = new Map<string, MistakeRecord[]>()
  for (const m of activeMistakes) {
    const existing = kpMap.get(m.knowledgePoint) || []
    existing.push(m)
    kpMap.set(m.knowledgePoint, existing)
  }

  // 提取薄弱点
  const allWeakPoints = extractWeakPoints(kpMap)

  // 总体错误类型分布
  const errorTypeBreakdown = countByErrorType(mistakes)

  // 各模块统计
  const moduleStats = ALL_MODULES.map(mod =>
    buildModuleStats(mod, activeMistakes, allWeakPoints)
  )

  // 各模块正确率（如果有总答题数）
  if (config) {
    const moduleCounts = countByModule(mistakes)
    for (const ms of moduleStats) {
      const totalForModule = Math.max(moduleCounts[ms.module], ms.totalMistakes)
      // 简化方案：如果没有传入各模块总答题数，使用错题数来估算
      // 实际使用时前端可以传入准确数据
      ms.accuracyRate = Math.max(0, 100 - Math.round((ms.totalMistakes / Math.max(totalForModule, 1)) * 100))
    }
  }

  return {
    totalMistakes,
    masteredMistakes,
    activeMistakes: activeMistakes.length,
    overallAccuracy: config
      ? Math.round(((config.totalQuestionsAnswered - totalMistakes) / Math.max(config.totalQuestionsAnswered, 1)) * 100)
      : 0,
    moduleStats,
    topWeakPoints: allWeakPoints.slice(0, 10),
    weeklyTrend: generateWeeklyTrend(mistakes),
    errorTypeBreakdown,
  }
}

/** 搜索错题 */
export function searchMistakes(
  mistakes: MistakeRecord[],
  query: string
): MistakeRecord[] {
  const q = query.toLowerCase()
  return mistakes.filter(m =>
    m.knowledgePoint.toLowerCase().includes(q) ||
    m.subCategory.toLowerCase().includes(q) ||
    m.source?.toLowerCase().includes(q) ||
    (m.questionStem?.toLowerCase().includes(q)) ||
    (m.notes?.toLowerCase().includes(q))
  )
}

/** 筛选错题 */
export function filterMistakes(
  mistakes: MistakeRecord[],
  filters: {
    module?: ExamModule
    errorType?: ErrorType
    mastered?: boolean
    dateFrom?: Date
    dateTo?: Date
  }
): MistakeRecord[] {
  return mistakes.filter(m => {
    if (filters.module && m.module !== filters.module) return false
    if (filters.errorType && m.errorType !== filters.errorType) return false
    if (filters.mastered !== undefined && m.mastered !== filters.mastered) return false
    if (filters.dateFrom && new Date(m.createdAt) < filters.dateFrom) return false
    if (filters.dateTo && new Date(m.createdAt) > filters.dateTo) return false
    return true
  })
}
