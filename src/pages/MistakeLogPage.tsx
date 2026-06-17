import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Camera, Edit3 } from 'lucide-react'
import { useMistakeActions, useKnowledgePoints, useSubCategories } from '../hooks/useMistakes'
import {
  ExamModule, ErrorType, EntryType, QuestionType, JudgmentSubType,
  MODULE_LABELS, ERROR_TYPE_LABELS, JUDGMENT_SUB_LABELS,
  MODULE_COLORS, ERROR_TYPE_COLORS,
  ENTRY_TYPE_LABELS, QUESTION_TYPE_LABELS,
  ALL_JUDGMENT_SUB_TYPES,
} from '../lib/constants'
import { cn } from '../lib/cn'
import type { CreateMistakeInput } from '../models/mistake'
import type { Difficulty } from '../models/exam'

const ALL_MODULES = Object.values(ExamModule) as ExamModule[]
const ALL_ERROR_TYPES = Object.values(ErrorType) as ErrorType[]
const ALL_JUDGMENT_SUB = ALL_JUDGMENT_SUB_TYPES as JudgmentSubType[]

export function MistakeLogPage() {
  const navigate = useNavigate()
  const { create } = useMistakeActions()
  const existingKPs = useKnowledgePoints()
  const existingSubs = useSubCategories()

  const [entryType, setEntryType] = useState<EntryType>(EntryType.MANUAL)
  const [questionType, setQuestionType] = useState<QuestionType>(QuestionType.MISTAKE)
  const [module, setModule] = useState<ExamModule | null>(null)
  const [subCategory, setSubCategory] = useState('')
  const [judgmentSubType, setJudgmentSubType] = useState<JudgmentSubType | undefined>()
  const [errorType, setErrorType] = useState<ErrorType | null>(null)
  const [source, setSource] = useState('')
  const [knowledgePoint, setKnowledgePoint] = useState('')
  const [questionStem, setQuestionStem] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [myAnswer, setMyAnswer] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>(3)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [showKPSuggestions, setShowKPSuggestions] = useState(false)
  const [showSubSuggestions, setShowSubSuggestions] = useState(false)

  const kpSuggestions = existingKPs.filter(kp =>
    kp.toLowerCase().includes(knowledgePoint.toLowerCase()) && kp !== knowledgePoint
  ).slice(0, 5)

  const subSuggestions = existingSubs.filter(sub =>
    sub.toLowerCase().includes(subCategory.toLowerCase()) && sub !== subCategory
  ).slice(0, 5)

  const isValid = module && errorType && subCategory.trim() && knowledgePoint.trim() && source.trim()

  async function handleSubmit() {
    if (!isValid || !module || !errorType) return
    setSaving(true)

    const input: CreateMistakeInput = {
      entryType,
      questionType,
      module,
      subCategory: subCategory.trim(),
      judgmentSubType: module === ExamModule.JUDGMENT ? judgmentSubType : undefined,
      errorType,
      source: source.trim(),
      knowledgePoint: knowledgePoint.trim(),
      questionStem: questionStem.trim() || undefined,
      correctAnswer: correctAnswer.trim() || undefined,
      myAnswer: myAnswer.trim() || undefined,
      notes: notes.trim() || undefined,
      difficulty,
    }

    await create(input)
    navigate('/', { state: { saved: true } })
  }

  return (
    <div className="animate-fade-in space-y-5 pb-4">
      {/* 返回按钮 */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      {/* 录入方式选择 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">录入方式</label>
        <div className="flex gap-2">
          <button
            onClick={() => setEntryType(EntryType.MANUAL)}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all flex items-center justify-center gap-2',
              entryType === EntryType.MANUAL
                ? 'bg-blue-50 text-blue-600 border-blue-300'
                : 'bg-white text-slate-500 border-slate-200'
            )}
          >
            <Edit3 size={16} /> 手录
          </button>
          <button
            onClick={() => setEntryType(EntryType.PHOTO)}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all flex items-center justify-center gap-2',
              entryType === EntryType.PHOTO
                ? 'bg-purple-50 text-purple-600 border-purple-300'
                : 'bg-white text-slate-400 border-slate-200'
            )}
          >
            <Camera size={16} /> 拍照识别
            <span className="text-[10px] bg-purple-100 text-purple-500 px-1.5 py-0.5 rounded-full ml-1">即将上线</span>
          </button>
        </div>
        {entryType === EntryType.PHOTO && (
          <p className="text-xs text-slate-400 mt-2">
            拍照识别功能开发中，当前可先使用手录方式记录错题。
          </p>
        )}
      </div>

      {/* 题目类型：错题 / 存疑 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">题目类型</label>
        <div className="flex gap-2">
          {([QuestionType.MISTAKE, QuestionType.DOUBTFUL] as QuestionType[]).map(qt => (
            <button
              key={qt}
              onClick={() => setQuestionType(qt)}
              className={cn(
                'flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all',
                questionType === qt
                  ? qt === QuestionType.MISTAKE
                    ? 'bg-red-50 text-red-600 border-red-300'
                    : 'bg-amber-50 text-amber-600 border-amber-300'
                  : 'bg-white text-slate-500 border-slate-200'
              )}
            >
              {QUESTION_TYPE_LABELS[qt]}
              <span className="block text-[10px] opacity-60 mt-0.5">
                {qt === QuestionType.MISTAKE ? '做错的题' : '做对了但不理解'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 模块选择 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">所属模块 *</label>
        <div className="grid grid-cols-2 gap-2">
          {ALL_MODULES.map(m => (
            <button
              key={m}
              onClick={() => setModule(m)}
              className={cn(
                'px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                module === m
                  ? 'text-white border-transparent'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              )}
              style={module === m ? { backgroundColor: MODULE_COLORS[m], borderColor: MODULE_COLORS[m] } : undefined}
            >
              {MODULE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* 判断推理子类型 */}
      {module === ExamModule.JUDGMENT && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">判断推理子类型</label>
          <div className="flex flex-wrap gap-2">
            {ALL_JUDGMENT_SUB.map(sub => (
              <button
                key={sub}
                onClick={() => setJudgmentSubType(sub === judgmentSubType ? undefined : sub)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  judgmentSubType === sub
                    ? 'text-white border-transparent'
                    : 'bg-white text-slate-500 border-slate-200'
                )}
                style={judgmentSubType === sub ? { backgroundColor: MODULE_COLORS[ExamModule.JUDGMENT] } : undefined}
              >
                {JUDGMENT_SUB_LABELS[sub]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 错误类型 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">错误类型 *</label>
        <div className="grid grid-cols-2 gap-2">
          {ALL_ERROR_TYPES.map(et => (
            <button
              key={et}
              onClick={() => setErrorType(et)}
              className={cn(
                'px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                errorType === et
                  ? 'text-white border-transparent'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              )}
              style={errorType === et ? { backgroundColor: ERROR_TYPE_COLORS[et], borderColor: ERROR_TYPE_COLORS[et] } : undefined}
            >
              {ERROR_TYPE_LABELS[et]}
            </button>
          ))}
        </div>
      </div>

      {/* 知识点 + 细分考点 */}
      <div className="relative">
        <label className="block text-sm font-medium text-slate-700 mb-2">知识点 *</label>
        <input
          type="text"
          value={knowledgePoint}
          onChange={e => { setKnowledgePoint(e.target.value); setShowKPSuggestions(true) }}
          onFocus={() => setShowKPSuggestions(true)}
          onBlur={() => setTimeout(() => setShowKPSuggestions(false), 200)}
          placeholder="例如：排列组合、主旨概括、增长率计算"
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
        />
        {showKPSuggestions && kpSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
            {kpSuggestions.map(kp => (
              <button
                key={kp}
                onMouseDown={() => { setKnowledgePoint(kp); setShowKPSuggestions(false) }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
              >
                {kp}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <label className="block text-sm font-medium text-slate-700 mb-2">细分考点 *</label>
        <input
          type="text"
          value={subCategory}
          onChange={e => { setSubCategory(e.target.value); setShowSubSuggestions(true) }}
          onFocus={() => setShowSubSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSubSuggestions(false), 200)}
          placeholder="例如：主旨概括题、工程问题"
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
        />
        {showSubSuggestions && subSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
            {subSuggestions.map(sub => (
              <button
                key={sub}
                onMouseDown={() => { setSubCategory(sub); setShowSubSuggestions(false) }}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
              >
                {sub}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 题目原文 + 答案 */}
      <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
        <p className="text-xs text-blue-600 font-medium mb-3">
          填写以下内容后，AI 可以帮你分析错因和跨题归类
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">题目原文</label>
            <textarea
              value={questionStem}
              onChange={e => setQuestionStem(e.target.value)}
              placeholder="粘贴或输入题目完整内容（拍照识别上线后可自动填充）"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">正确答案</label>
              <input
                type="text"
                value={correctAnswer}
                onChange={e => setCorrectAnswer(e.target.value)}
                placeholder="例如：B"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">我的答案</label>
              <input
                type="text"
                value={myAnswer}
                onChange={e => setMyAnswer(e.target.value)}
                placeholder="例如：C"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 题目来源 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">题目来源 *</label>
        <input
          type="text"
          value={source}
          onChange={e => setSource(e.target.value)}
          placeholder="例如：2024国考真题卷、粉笔模考第3套"
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
        />
      </div>

      {/* 难度 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">难度自评：{difficulty} 分</label>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={difficulty}
          onChange={e => setDifficulty(Number(e.target.value) as Difficulty)}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>很简单</span><span>较简单</span><span>中等</span><span>较难</span><span>很难</span>
        </div>
      </div>

      {/* 备注 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">备注（可选）</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="记录你的错误原因或反思..."
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white resize-none"
        />
      </div>

      {/* 提交按钮 */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || saving}
        className={cn(
          'w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all',
          isValid && !saving
            ? 'bg-blue-500 hover:bg-blue-600 active:scale-[0.98]'
            : 'bg-slate-300 cursor-not-allowed'
        )}
      >
        <Save size={18} />
        {saving ? '保存中...' : '记录' + QUESTION_TYPE_LABELS[questionType]}
      </button>
    </div>
  )
}
