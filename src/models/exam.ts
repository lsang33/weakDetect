/** 五大考试模块 */
export enum ExamModule {
  VERBAL = 'verbal',
  QUANTITATIVE = 'quantitative',
  JUDGMENT = 'judgment',
  DATA_ANALYSIS = 'data_analysis',
  COMMON_KNOWLEDGE = 'common_knowledge',
}

/** 判断推理子类型 */
export enum JudgmentSubType {
  GRAPHIC = 'graphic',
  DEFINITION = 'definition',
  ANALOGY = 'analogy',
  LOGIC = 'logic',
}

/** 错误类型 */
export enum ErrorType {
  KNOWLEDGE_GAP = 'knowledge_gap',
  CARELESSNESS = 'carelessness',
  TIME_PRESSURE = 'time_pressure',
  MISREADING = 'misreading',
}

/** 录入方式 */
export enum EntryType {
  MANUAL = 'manual',
  PHOTO = 'photo',
}

/** 题目类型 */
export enum QuestionType {
  MISTAKE = 'mistake',
  DOUBTFUL = 'doubtful',
}

/** 难度 */
export type Difficulty = 1 | 2 | 3 | 4 | 5

/** 模块中文标签 */
export const MODULE_LABELS: Record<ExamModule, string> = {
  [ExamModule.VERBAL]: '言语理解与表达',
  [ExamModule.QUANTITATIVE]: '数量关系',
  [ExamModule.JUDGMENT]: '判断推理',
  [ExamModule.DATA_ANALYSIS]: '资料分析',
  [ExamModule.COMMON_KNOWLEDGE]: '常识判断',
}

/** 模块短标签（用于图表等空间有限的场景） */
export const MODULE_SHORT_LABELS: Record<ExamModule, string> = {
  [ExamModule.VERBAL]: '言语',
  [ExamModule.QUANTITATIVE]: '数量',
  [ExamModule.JUDGMENT]: '判断',
  [ExamModule.DATA_ANALYSIS]: '资料',
  [ExamModule.COMMON_KNOWLEDGE]: '常识',
}

/** 判断推理子类型中文标签 */
export const JUDGMENT_SUB_LABELS: Record<JudgmentSubType, string> = {
  [JudgmentSubType.GRAPHIC]: '图形推理',
  [JudgmentSubType.DEFINITION]: '定义判断',
  [JudgmentSubType.ANALOGY]: '类比推理',
  [JudgmentSubType.LOGIC]: '逻辑判断',
}

/** 错误类型中文标签 */
export const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  [ErrorType.KNOWLEDGE_GAP]: '知识点盲区',
  [ErrorType.CARELESSNESS]: '粗心大意',
  [ErrorType.TIME_PRESSURE]: '时间不足',
  [ErrorType.MISREADING]: '审题偏差',
}

/** 错误类型短标签 */
export const ERROR_TYPE_SHORT_LABELS: Record<ErrorType, string> = {
  [ErrorType.KNOWLEDGE_GAP]: '盲区',
  [ErrorType.CARELESSNESS]: '粗心',
  [ErrorType.TIME_PRESSURE]: '时间',
  [ErrorType.MISREADING]: '审题',
}

/** 模块颜色映射 */
export const MODULE_COLORS: Record<ExamModule, string> = {
  [ExamModule.VERBAL]: '#3B82F6',
  [ExamModule.QUANTITATIVE]: '#EF4444',
  [ExamModule.JUDGMENT]: '#8B5CF6',
  [ExamModule.DATA_ANALYSIS]: '#F59E0B',
  [ExamModule.COMMON_KNOWLEDGE]: '#10B981',
}

/** 错误类型颜色映射 */
export const ERROR_TYPE_COLORS: Record<ErrorType, string> = {
  [ErrorType.KNOWLEDGE_GAP]: '#EF4444',
  [ErrorType.CARELESSNESS]: '#F59E0B',
  [ErrorType.TIME_PRESSURE]: '#3B82F6',
  [ErrorType.MISREADING]: '#8B5CF6',
}

/** 录入方式标签 */
export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  [EntryType.MANUAL]: '手录',
  [EntryType.PHOTO]: '拍照',
}

/** 题目类型标签 */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  [QuestionType.MISTAKE]: '错题',
  [QuestionType.DOUBTFUL]: '存疑',
}

/** 改进结果 */
export type ImprovementResult = 'helped' | 'not_sure' | 'no_effect'

export const IMPROVEMENT_RESULT_LABELS: Record<ImprovementResult, string> = {
  helped: '有帮助',
  not_sure: '不确定',
  no_effect: '没帮助',
}

/** 难度标签 */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: '很简单',
  2: '较简单',
  3: '中等',
  4: '较难',
  5: '很难',
}
