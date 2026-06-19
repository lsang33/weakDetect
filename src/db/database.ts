import Dexie, { type EntityTable } from 'dexie'
import type { MistakeRecord } from '../models/mistake'
import type { ReviewPlan } from '../models/review'
import type { AnalysisReport } from '../models/analytics'

/** 当前数据库版本。修改 schema 时递增，并在下方添加对应的 version().stores().upgrade() */
const DB_VERSION = 2

export class ExamMistakeDB extends Dexie {
  mistakes!: EntityTable<MistakeRecord, 'id'>
  reviewPlans!: EntityTable<ReviewPlan, 'id'>
  analysisReports!: EntityTable<AnalysisReport, 'id'>

  constructor() {
    super('ExamMistakeDB')

    // v1 — 初始版本
    this.version(1).stores({
      mistakes: 'id, module, errorType, knowledgePoint, createdAt, mastered',
      reviewPlans: 'id, date, completed',
      analysisReports: 'id, createdAt',
    })

    // v2 — 新增 entryType / questionType 索引
    this.version(2).stores({
      mistakes: 'id, module, errorType, knowledgePoint, createdAt, mastered, entryType, questionType',
      reviewPlans: 'id, date, completed',
      analysisReports: 'id, createdAt',
    })

    /*
      添加 v3 的模板（新字段/新索引时使用）：
      this.version(3).stores({
        mistakes: 'id, ..., 新索引字段',
        reviewPlans: 'id, date, completed',
        analysisReports: 'id, createdAt',
      }).upgrade(tx => {
        // 可选：为已有数据填充新字段的默认值
        return tx.table('mistakes').toCollection().modify(m => {
          if (m.newField === undefined) m.newField = defaultValue
        })
      })
    */
  }
}

export const db = new ExamMistakeDB()
