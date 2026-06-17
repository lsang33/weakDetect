import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { mistakeRepository } from '../db/repositories/mistakeRepository'
import { reviewPlanRepository } from '../db/repositories/reviewPlanRepository'
import { generateReviewPlan } from '../services/reviewPlanner'
import { formatDate } from '../lib/dateUtils'
import type { ReviewPlan, ReviewItem } from '../models/review'

export function useTodayReviewPlan(): {
  plan: ReviewPlan | undefined
  items: ReviewItem[]
  loading: boolean
} {
  const mistakes = useLiveQuery(() => mistakeRepository.getAll(), []) ?? []
  const today = formatDate(new Date())
  const plan = useLiveQuery(() => reviewPlanRepository.getByDate(today), [today])

  const items = useMemo(() => {
    return generateReviewPlan(mistakes)
  }, [mistakes])

  return { plan, items, loading: mistakes === undefined }
}

export function useReviewPlanActions() {
  return {
    markCompleted: async (planId: string, mistakeId: string) => {
      await reviewPlanRepository.markItemCompleted(planId, mistakeId)
      await mistakeRepository.markReviewed(mistakeId)
    },
    savePlan: async (date: string, items: ReviewItem[]) => {
      return reviewPlanRepository.getOrCreate(date, items)
    },
  }
}
