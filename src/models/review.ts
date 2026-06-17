import type { ExamModule } from './exam'

/** 复习条目 */
export interface ReviewItem {
  mistakeId: string
  knowledgePoint: string
  module: ExamModule
  subCategory: string
  errorType: string
  priority: 'high' | 'medium' | 'low'
  reason: string
}

/** 每日复习计划 */
export interface ReviewPlan {
  id: string
  date: string
  items: ReviewItem[]
  completedItemIds: string[]
  completed: boolean
}

/** 间隔复习配置 */
export interface SpacedRepetitionConfig {
  intervals: number[]
  maxReviews: number
}

export const DEFAULT_SPACED_REPETITION: SpacedRepetitionConfig = {
  intervals: [1, 3, 7, 14, 30],
  maxReviews: 5,
}
