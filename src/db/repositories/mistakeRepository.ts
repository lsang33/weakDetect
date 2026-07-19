import { db } from '../database'
import type { MistakeRecord, CreateMistakeInput, UpdateMistakeInput, QuickDiagnosis, BatchAnalysis, ImprovementAttempt } from '../../models/mistake'
import type { ExamModule, ErrorType } from '../../models/exam'
import type { AnalysisCoverage } from '../../models/analytics'
import { generateId } from '../../lib/idGenerator'

export const mistakeRepository = {
  async create(input: CreateMistakeInput): Promise<MistakeRecord> {
    const record: MistakeRecord = {
      ...input,
      id: generateId(),
      reviewCount: 0,
      mastered: false,
      createdAt: new Date(),
    }
    await db.mistakes.add(record)
    return record
  },

  async getById(id: string): Promise<MistakeRecord | undefined> {
    return db.mistakes.get(id)
  },

  async update(id: string, input: UpdateMistakeInput): Promise<void> {
    await db.mistakes.update(id, { ...input })
  },

  async delete(id: string): Promise<void> {
    await db.mistakes.delete(id)
  },

  async getAll(): Promise<MistakeRecord[]> {
    return db.mistakes.orderBy('createdAt').reverse().toArray()
  },

  async getByModule(module: ExamModule): Promise<MistakeRecord[]> {
    return db.mistakes.where('module').equals(module).toArray()
  },

  async getByErrorType(errorType: ErrorType): Promise<MistakeRecord[]> {
    return db.mistakes.where('errorType').equals(errorType).toArray()
  },

  async getByKnowledgePoint(knowledgePoint: string): Promise<MistakeRecord[]> {
    return db.mistakes.where('knowledgePoint').equals(knowledgePoint).toArray()
  },

  async getActive(): Promise<MistakeRecord[]> {
    return db.mistakes.where('mastered').equals(0 as never).toArray()
  },

  async getMastered(): Promise<MistakeRecord[]> {
    return db.mistakes.where('mastered').equals(1 as never).toArray()
  },

  // === 新增：AI 分析相关 ===

  /** 获取有题目原文的错题（可用于 AI 分析） */
  async getWithStems(): Promise<MistakeRecord[]> {
    const all = await db.mistakes.toArray()
    return all.filter(m => m.questionStem && m.questionStem.trim().length > 0)
  },

  /** 分析覆盖率统计 */
  async getCoverage(): Promise<AnalysisCoverage> {
    const all = await db.mistakes.toArray()
    const covered = all.filter(m => m.questionStem && m.questionStem.trim().length > 0)
    return {
      covered: covered.length,
      total: all.length,
      uncoveredIds: all.filter(m => !m.questionStem).map(m => m.id),
    }
  },

  /** 添加实时诊断 */
  async setQuickDiagnosis(id: string, diagnosis: QuickDiagnosis): Promise<void> {
    await db.mistakes.update(id, { quickDiagnosis: diagnosis })
  },

  /** 添加批量分析结果 */
  async setBatchAnalysis(id: string, analysis: BatchAnalysis): Promise<void> {
    await db.mistakes.update(id, { batchAnalysis: analysis })
  },

  /** 添加改进尝试记录 */
  async addImprovementAttempt(id: string, attempt: ImprovementAttempt): Promise<void> {
    const record = await db.mistakes.get(id)
    if (record) {
      const existing = record.improvementAttempts ?? []
      await db.mistakes.update(id, { improvementAttempts: [...existing, attempt] })
    }
  },

  async markReviewed(id: string): Promise<void> {
    const record = await db.mistakes.get(id)
    if (record) {
      await db.mistakes.update(id, {
        reviewedAt: new Date(),
        reviewCount: record.reviewCount + 1,
      })
    }
  },

  async markMastered(id: string): Promise<void> {
    await db.mistakes.update(id, { mastered: true })
  },

  async unmarkMastered(id: string): Promise<void> {
    await db.mistakes.update(id, { mastered: false })
  },

  async getCount(): Promise<number> {
    return db.mistakes.count()
  },

  async getActiveGroupedByKnowledgePoint(): Promise<Map<string, MistakeRecord[]>> {
    const all = await db.mistakes.where('mastered').equals(0 as never).toArray()
    const map = new Map<string, MistakeRecord[]>()
    for (const m of all) {
      const existing = map.get(m.knowledgePoint) ?? []
      existing.push(m)
      map.set(m.knowledgePoint, existing)
    }
    return map
  },

  async getAllKnowledgePoints(): Promise<string[]> {
    const all = await db.mistakes.toArray()
    const kps = new Set(all.map(m => m.knowledgePoint))
    return Array.from(kps).sort()
  },

  async getAllSubCategories(): Promise<string[]> {
    const all = await db.mistakes.toArray()
    const subs = new Set(all.map(m => m.subCategory))
    return Array.from(subs).sort()
  },

  async getAllSources(): Promise<string[]> {
    const all = await db.mistakes.toArray()
    const sources = new Set(all.map(m => m.source).filter(Boolean) as string[])
    return Array.from(sources).sort()
  },

  /** 记录练习结果：更新 reviewCount、reviewedAt、practiceWrongCount */
  async recordPracticeResult(id: string, correct: boolean): Promise<void> {
    const record = await db.mistakes.get(id)
    if (record) {
      const update: any = {
        reviewedAt: new Date(),
        reviewCount: (record.reviewCount || 0) + 1,
      }
      if (!correct) {
        update.practiceWrongCount = (record.practiceWrongCount || 0) + 1
      }
      await db.mistakes.update(id, update)
    }
  },

  /** 切换收藏标记 */
  async toggleStar(id: string): Promise<void> {
    const record = await db.mistakes.get(id)
    if (record) {
      await db.mistakes.update(id, { starred: !record.starred })
    }
  },
}
