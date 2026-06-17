import {
  ExamModule, ErrorType, JudgmentSubType, EntryType, QuestionType,
  MODULE_LABELS, MODULE_SHORT_LABELS, MODULE_COLORS,
  ERROR_TYPE_LABELS, ERROR_TYPE_SHORT_LABELS, ERROR_TYPE_COLORS,
  JUDGMENT_SUB_LABELS, DIFFICULTY_LABELS,
  ENTRY_TYPE_LABELS, QUESTION_TYPE_LABELS,
  IMPROVEMENT_RESULT_LABELS,
} from '../models/exam'
import type { Difficulty, ImprovementResult } from '../models/exam'

export const ALL_MODULES = Object.values(ExamModule)
export const ALL_ERROR_TYPES = Object.values(ErrorType)
export const ALL_JUDGMENT_SUB_TYPES = Object.values(JudgmentSubType)
export const ALL_ENTRY_TYPES = Object.values(EntryType)
export const ALL_QUESTION_TYPES = Object.values(QuestionType)

export type { Difficulty, ImprovementResult }

export {
  ExamModule,
  ErrorType,
  JudgmentSubType,
  EntryType,
  QuestionType,
  MODULE_LABELS,
  MODULE_SHORT_LABELS,
  MODULE_COLORS,
  ERROR_TYPE_LABELS,
  ERROR_TYPE_SHORT_LABELS,
  ERROR_TYPE_COLORS,
  JUDGMENT_SUB_LABELS,
  DIFFICULTY_LABELS,
  ENTRY_TYPE_LABELS,
  QUESTION_TYPE_LABELS,
  IMPROVEMENT_RESULT_LABELS,
}
