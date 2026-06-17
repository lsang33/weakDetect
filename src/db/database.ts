import Dexie, { type EntityTable } from 'dexie'
import type { MistakeRecord } from '../models/mistake'
import type { ReviewPlan } from '../models/review'
import type { AnalysisReport } from '../models/analytics'

export class ExamMistakeDB extends Dexie {
  mistakes!: EntityTable<MistakeRecord, 'id'>
  reviewPlans!: EntityTable<ReviewPlan, 'id'>
  analysisReports!: EntityTable<AnalysisReport, 'id'>

  constructor() {
    super('ExamMistakeDB')

    this.version(2).stores({
      mistakes: 'id, module, errorType, knowledgePoint, createdAt, mastered, entryType, questionType',
      reviewPlans: 'id, date, completed',
      analysisReports: 'id, createdAt',
    })
  }
}

export const db = new ExamMistakeDB()
