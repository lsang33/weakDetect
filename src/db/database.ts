import Dexie, { type EntityTable } from 'dexie'
import type { MistakeRecord } from '../models/mistake'
import type { ReviewPlan } from '../models/review'
import type { AnalysisReport, ModuleAnalysis } from '../models/analytics'

export class ExamMistakeDB extends Dexie {
  mistakes!: EntityTable<MistakeRecord, 'id'>
  reviewPlans!: EntityTable<ReviewPlan, 'id'>
  analysisReports!: EntityTable<AnalysisReport, 'id'>
  moduleAnalyses!: EntityTable<ModuleAnalysis, 'id'>

  constructor() {
    super('ExamMistakeDB')

    this.version(1).stores({
      mistakes: 'id, module, errorType, knowledgePoint, createdAt, mastered',
      reviewPlans: 'id, date, completed',
      analysisReports: 'id, createdAt',
    })

    this.version(2).stores({
      mistakes: 'id, module, errorType, knowledgePoint, createdAt, mastered, entryType, questionType',
      reviewPlans: 'id, date, completed',
      analysisReports: 'id, createdAt',
    })

    this.version(3).stores({
      mistakes: 'id, module, errorType, knowledgePoint, createdAt, mastered, entryType, questionType',
      reviewPlans: 'id, date, completed',
      analysisReports: 'id, createdAt',
      moduleAnalyses: 'id, module, createdAt',
    })
  }
}

export const db = new ExamMistakeDB()
