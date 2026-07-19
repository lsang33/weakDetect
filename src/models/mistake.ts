import type { ExamModule, ErrorType, JudgmentSubType, Difficulty, EntryType, QuestionType, ImprovementResult } from './exam'

/** AI 实时诊断（拍照后即时生成） */
export interface QuickDiagnosis {
  aiAnswer: string
  aiCorrect: boolean
  difficulty: string
  examPoint: string
  keyDifferentiator: string
  solution: string
  traps: string
  userErrorStep: string
  rootCause: string
  fix: string
  analyzedAt: Date
}

/** AI 批量分析后的归类信息 */
export interface BatchAnalysis {
  patternGroupId: string
  thinkingError: string
  analyzedAt: Date
}

/** 改进尝试记录 */
export interface ImprovementAttempt {
  attemptedAt: Date
  method: string
  result: ImprovementResult
  notes?: string
}

/** 错题记录 — 核心实体 */
export interface MistakeRecord {
  id: string
  module: ExamModule
  subCategory: string
  judgmentSubType?: JudgmentSubType
  errorType: ErrorType
  source?: string
  knowledgePoint: string

  // === 新增：录入相关 ===
  entryType: EntryType
  questionType: QuestionType

  // === 新增：题目内容 ===
  questionStem?: string
  correctAnswer?: string
  myAnswer?: string
  photoThumbnail?: string

  // === 原有 ===
  notes?: string
  difficulty?: Difficulty
  timeSpent?: number
  createdAt: Date
  reviewedAt?: Date
  reviewCount: number
  mastered: boolean

  // === 新增：AI 分析 ===
  quickDiagnosis?: QuickDiagnosis
  batchAnalysis?: BatchAnalysis

  // === 新增：改进追踪 ===
  improvementAttempts?: ImprovementAttempt[]

  // === 练习相关 ===
  /** 练习累计答错次数 */
  practiceWrongCount?: number
  /** 收藏标记（独立于掌握状态） */
  starred?: boolean
}

/** 创建错题的输入类型 */
export type CreateMistakeInput = Omit<MistakeRecord, 'id' | 'createdAt' | 'reviewCount' | 'mastered' | 'reviewedAt'>

/** 更新错题的输入类型 */
export type UpdateMistakeInput = Partial<Omit<MistakeRecord, 'id' | 'createdAt'>>
