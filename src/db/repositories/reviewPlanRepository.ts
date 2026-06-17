import { db } from '../database'
import type { ReviewPlan } from '../../models/review'
import { generateId } from '../../lib/idGenerator'

export const reviewPlanRepository = {
  async create(plan: Omit<ReviewPlan, 'id'>): Promise<ReviewPlan> {
    const record: ReviewPlan = {
      ...plan,
      id: generateId(),
    }
    await db.reviewPlans.add(record)
    return record
  },

  async getByDate(date: string): Promise<ReviewPlan | undefined> {
    return db.reviewPlans.where('date').equals(date).first()
  },

  async getOrCreate(date: string, items: ReviewPlan['items']): Promise<ReviewPlan> {
    const existing = await db.reviewPlans.where('date').equals(date).first()
    if (existing) return existing

    const record: ReviewPlan = {
      id: generateId(),
      date,
      items,
      completedItemIds: [],
      completed: false,
    }
    await db.reviewPlans.add(record)
    return record
  },

  async markItemCompleted(planId: string, mistakeId: string): Promise<void> {
    const plan = await db.reviewPlans.get(planId)
    if (plan && !plan.completedItemIds.includes(mistakeId)) {
      const completedItemIds = [...plan.completedItemIds, mistakeId]
      const completed = completedItemIds.length >= plan.items.length
      await db.reviewPlans.update(planId, { completedItemIds, completed })
    }
  },

  async delete(id: string): Promise<void> {
    await db.reviewPlans.delete(id)
  },

  async getAll(): Promise<ReviewPlan[]> {
    return db.reviewPlans.orderBy('date').reverse().toArray()
  },
}
