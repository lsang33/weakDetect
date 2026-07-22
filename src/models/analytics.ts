import type { ExamModule, ErrorType } from './exam'

/** 单个模块的统计数据 */
export interface ModuleStats {
  module: ExamModule
  totalMistakes: number
  masteredCount: number
  accuracyRate: number
  weakPoints: WeakPoint[]
  errorTypeBreakdown: Record<ErrorType, number>
}

/** 薄弱知识点 */
export interface WeakPoint {
  knowledgePoint: string
  module: ExamModule
  mistakeCount: number
  errorTypes: ErrorType[]
  lastMistakeDate: Date
  trend: 'improving' | 'stable' | 'worsening'
  score: number
}

/** 每周趋势数据点 */
export interface WeeklyTrendPoint {
  weekStart: Date
  mistakesLogged: number
  mistakesReviewed: number
  accuracyRate: number
}

/** 分析总览 */
export interface AnalyticsSummary {
  totalMistakes: number
  masteredMistakes: number
  activeMistakes: number
  overallAccuracy: number
  moduleStats: ModuleStats[]
  topWeakPoints: WeakPoint[]
  weeklyTrend: WeeklyTrendPoint[]
  errorTypeBreakdown: Record<ErrorType, number>
}

/** AI 诊断报告 */
export interface AnalysisReport {
  id: string
  createdAt: Date
  mistakeIds: string[]
  coveredCount: number
  totalCount: number
  summary: string
  weaknessPatterns: WeaknessPattern[]
  perQuestionAnalysis: Record<string, PerQuestionAnalysis>
  improvementPlan: ImprovementPlan
  changesFromLast?: {
    improvedPatterns: string[]
    persistentPatterns: string[]
    newPatterns: string[]
  }
  moduleAnalysis?: { module: string; trend: 'improving' | 'stable' | 'declining'; note: string }[]
}

export interface WeaknessPattern {
  pattern: string
  cause: string
  relatedMistakeIds: string[]
  severity: 'high' | 'medium' | 'low'
  suggestion: string
}

export interface PerQuestionAnalysis {
  rootCause: string
  thinkingError: string
  fix: string
  tags: string[]
}

export interface ImprovementPlan {
  thisWeek: string[]
  nextWeek: string[]
  confidenceTip: string
}

/** 错题的总答题数（用于计算正确率时参考） */
export interface StatsConfig {
  totalQuestionsAnswered: number
}

/** 单模块分析报告 */
export interface ModuleAnalysis {
  id: string
  module: string
  createdAt: Date
  summary: string
  patterns: { pattern: string; cause: string; relatedMistakeIds: string[]; suggestion: string; severity?: 'high' | 'medium' | 'low' }[]
  perQuestionAnalysis: Record<string, string>
}

/** 练习题 */
export interface PracticeQuestion {
  stem: string
  options: string[]
  correctAnswer: string
  explanation: string
}

/** 练习会话 */
export interface PracticeSession {
  id: string
  module: string
  pattern: string
  questions: PracticeQuestion[]
  createdAt: Date
  completedAt?: Date
  results?: { questionIndex: number; userAnswer: string; correct: boolean }[]
}

/** 分析覆盖统计 */
export interface AnalysisCoverage {
  covered: number
  total: number
  uncoveredIds: string[]
}

/** 练习记录 — 每次练习完成后保存 */
export interface PracticeRecord {
  id: string
  questionIds: string[]
  results: { userAnswer: string; correct: boolean; timeMs: number }[]
  mode: 'practice' | 'exam'
  createdAt: Date
}
