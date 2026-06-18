import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, CheckCircle2, RotateCcw, Brain, Lightbulb, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useMistake, useMistakeActions } from '../hooks/useMistakes'
import {
  MODULE_LABELS, MODULE_COLORS, ERROR_TYPE_LABELS, ERROR_TYPE_COLORS,
  JUDGMENT_SUB_LABELS, QUESTION_TYPE_LABELS, IMPROVEMENT_RESULT_LABELS,
} from '../lib/constants'
import { formatDate } from '../lib/dateUtils'
import { ExamModule, QuestionType } from '../models/exam'
import type { ImprovementResult } from '../models/exam'
import type { ImprovementAttempt } from '../models/mistake'
import { cn } from '../lib/cn'

const IMPROVEMENT_RESULTS = ['helped', 'not_sure', 'no_effect'] as ImprovementResult[]

export function MistakeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const mistake = useMistake(id)
  const { remove, markMastered, unmarkMastered, addImprovementAttempt } = useMistakeActions()
  const [showAddAttempt, setShowAddAttempt] = useState(false)
  const [attemptMethod, setAttemptMethod] = useState('')
  const [attemptResult, setAttemptResult] = useState<ImprovementResult>('helped')
  const [attemptNotes, setAttemptNotes] = useState('')
  const [expandAi, setExpandAi] = useState(true)

  if (!mistake) {
    return <div className="text-center py-16 text-slate-400">加载中或错题不存在</div>
  }

  async function handleDelete() {
    if (window.confirm('确定删除这道错题吗？')) {
      await remove(mistake!.id)
      navigate('/mistakes')
    }
  }

  async function handleAddAttempt() {
    if (!attemptMethod.trim()) return
    const attempt: ImprovementAttempt = {
      attemptedAt: new Date(),
      method: attemptMethod.trim(),
      result: attemptResult,
      notes: attemptNotes.trim() || undefined,
    }
    await addImprovementAttempt(mistake!.id, attempt)
    setAttemptMethod('')
    setAttemptResult('helped')
    setAttemptNotes('')
    setShowAddAttempt(false)
  }

  const hasAiAnalysis = !!mistake.quickDiagnosis
  const attempts = mistake.improvementAttempts ?? []

  return (
    <div className="animate-fade-in space-y-4 pb-4">
      {/* 返回 */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      {/* 主卡片 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        {/* 标签行 */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-sm font-medium px-3 py-1 rounded-full text-white"
            style={{ backgroundColor: MODULE_COLORS[mistake.module] }}>
            {MODULE_LABELS[mistake.module]}
          </span>
          <span className="text-sm px-3 py-1 rounded-full text-white"
            style={{ backgroundColor: ERROR_TYPE_COLORS[mistake.errorType] }}>
            {ERROR_TYPE_LABELS[mistake.errorType]}
          </span>
          {mistake.questionType === QuestionType.DOUBTFUL && (
            <span className="text-sm px-3 py-1 rounded-full bg-amber-100 text-amber-700">
              {QUESTION_TYPE_LABELS[QuestionType.DOUBTFUL]}
            </span>
          )}
          {mistake.mastered && (
            <span className="text-sm px-3 py-1 rounded-full bg-green-100 text-green-700">已掌握</span>
          )}
        </div>

        {/* 录入方式 */}
        <p className="text-xs text-slate-400 mb-3">
          {mistake.entryType === 'photo' ? '📷 拍照录入' : '✏️ 手录'}
          {mistake.entryType === 'manual' && !mistake.questionStem && (
            <span className="ml-2 text-amber-500">（缺少题目原文，将无法参与 AI 深度分析）</span>
          )}
        </p>

        {mistake.module === ExamModule.JUDGMENT && mistake.judgmentSubType && (
          <p className="text-sm text-slate-500 mb-2">子类型：{JUDGMENT_SUB_LABELS[mistake.judgmentSubType]}</p>
        )}

        <h2 className="text-lg font-semibold text-slate-900 mb-1">{mistake.knowledgePoint}</h2>
        <p className="text-sm text-slate-500 mb-3">{mistake.subCategory}</p>

        {mistake.source && (
          <p className="text-sm text-slate-600 mb-1">
            <span className="text-slate-400">题目来源：</span>{mistake.source}
          </p>
        )}

        {mistake.difficulty && (
          <p className="text-sm text-slate-600 mb-1">
            <span className="text-slate-400">难度：</span>
            {'★'.repeat(mistake.difficulty)}{'☆'.repeat(5 - mistake.difficulty)}
          </p>
        )}

        <p className="text-xs text-slate-400 mt-2">
          记录于 {formatDate(mistake.createdAt)}
          {mistake.reviewedAt && ` · 上次复习 ${formatDate(mistake.reviewedAt)}`}
          {` · 复习 ${mistake.reviewCount} 次`}
        </p>
      </div>

      {/* 题目内容卡片 */}
      {(mistake.questionStem || mistake.correctAnswer || mistake.myAnswer) && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">题目内容</h3>
          {mistake.questionStem && (
            <div className="mb-3">
              <p className="text-xs text-slate-400 mb-1">题目原文</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{mistake.questionStem}</p>
            </div>
          )}
          <div className="flex gap-4">
            {mistake.correctAnswer && (
              <div>
                <span className="text-xs text-slate-400">正确答案</span>
                <p className="text-sm font-semibold text-green-600">{mistake.correctAnswer}</p>
              </div>
            )}
            {mistake.myAnswer && (
              <div>
                <span className="text-xs text-slate-400">我的答案</span>
                <p className="text-sm font-semibold text-red-500">{mistake.myAnswer}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI 诊断 */}
      {hasAiAnalysis && (
        <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100">
          <button
            onClick={() => setExpandAi(!expandAi)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Brain size={18} className="text-purple-500" />
              <span className="text-sm font-semibold text-purple-700">AI 诊断</span>
            </div>
            {expandAi ? <ChevronUp size={16} className="text-purple-400" /> : <ChevronDown size={16} className="text-purple-400" />}
          </button>
          {expandAi && (
            <div className="mt-3 space-y-3">
              {mistake.quickDiagnosis && (
                <>
                  {(mistake.quickDiagnosis.difficulty || mistake.quickDiagnosis.examPoint) && (
                    <div className="bg-purple-100/50 rounded-lg p-3 space-y-1.5 mb-3">
                      {mistake.quickDiagnosis.difficulty && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] text-purple-400 shrink-0 mt-0.5 w-8">难度</span>
                          <p className="text-xs text-purple-800">{mistake.quickDiagnosis.difficulty}</p>
                        </div>
                      )}
                      {mistake.quickDiagnosis.examPoint && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] text-purple-400 shrink-0 mt-0.5 w-8">考点</span>
                          <p className="text-xs text-purple-800">{mistake.quickDiagnosis.examPoint}</p>
                        </div>
                      )}
                      {mistake.quickDiagnosis.keyDifferentiator && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] text-purple-400 shrink-0 mt-0.5 w-8">关键</span>
                          <p className="text-xs text-purple-800">{mistake.quickDiagnosis.keyDifferentiator}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full',
                      mistake.correctAnswer && mistake.quickDiagnosis.aiAnswer === mistake.correctAnswer.trim()
                        ? 'bg-green-100 text-green-600'
                        : 'bg-red-100 text-red-600'
                    )}>
                      AI 答案：{mistake.quickDiagnosis.aiAnswer}
                      {mistake.correctAnswer && mistake.quickDiagnosis.aiAnswer === mistake.correctAnswer.trim() ? ' ✅' : ' ❌'}
                    </span>
                  </div>
                  {mistake.quickDiagnosis.solution && (
                    <div>
                      <p className="text-xs text-purple-400 font-medium mb-1">逐项解析</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{mistake.quickDiagnosis.solution}</p>
                    </div>
                  )}
                  {mistake.quickDiagnosis.traps && (
                    <div>
                      <p className="text-xs text-purple-400 font-medium mb-1">陷阱</p>
                      <p className="text-sm text-slate-700">{mistake.quickDiagnosis.traps}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-purple-400 font-medium mb-1">错因</p>
                    <p className="text-sm text-slate-700">{mistake.quickDiagnosis.rootCause}</p>
                  </div>
                  <div>
                    <p className="text-xs text-purple-400 font-medium mb-1">方法</p>
                    <p className="text-sm text-slate-700">{mistake.quickDiagnosis.fix}</p>
                  </div>
                </>
              )}
              {mistake.batchAnalysis && (
                <div>
                  <p className="text-xs text-purple-400 font-medium mb-1">思维错误</p>
                  <p className="text-sm text-purple-800">{mistake.batchAnalysis.thinkingError}</p>
                </div>
              )}
              <p className="text-[10px] text-purple-300">
                此分析由 AI 生成，仅供参考
              </p>
            </div>
          )}
        </div>
      )}

      {/* 改进追踪 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-700">改进追踪</h3>
          </div>
          <button
            onClick={() => setShowAddAttempt(!showAddAttempt)}
            className="flex items-center gap-1 text-xs font-medium text-amber-600"
          >
            <PlusCircle size={14} /> 记录练习
          </button>
        </div>

        {/* 历史记录 */}
        {attempts.length > 0 ? (
          <div className="space-y-2">
            {attempts.map((a, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full shrink-0 mt-0.5',
                  a.result === 'helped' ? 'bg-green-100 text-green-600' :
                  a.result === 'no_effect' ? 'bg-red-100 text-red-600' :
                  'bg-slate-100 text-slate-500'
                )}>
                  {IMPROVEMENT_RESULT_LABELS[a.result]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{a.method}</p>
                  {a.notes && <p className="text-xs text-slate-400 mt-0.5">{a.notes}</p>}
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(a.attemptedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-3">
            暂无改进记录，点击"记录练习"开始追踪
          </p>
        )}

        {/* 添加新记录 */}
        {showAddAttempt && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-fade-in">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">改进方法</label>
              <input
                type="text"
                value={attemptMethod}
                onChange={e => setAttemptMethod(e.target.value)}
                placeholder="例如：先画图再做题、把'至少'转换成'1-都不'"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">效果</label>
              <div className="flex gap-2">
                {IMPROVEMENT_RESULTS.map(r => (
                  <button
                    key={r}
                    onClick={() => setAttemptResult(r)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      attemptResult === r
                        ? r === 'helped' ? 'bg-green-500 text-white' :
                          r === 'no_effect' ? 'bg-red-500 text-white' :
                          'bg-slate-500 text-white'
                        : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {IMPROVEMENT_RESULT_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">备注（可选）</label>
              <input
                type="text"
                value={attemptNotes}
                onChange={e => setAttemptNotes(e.target.value)}
                placeholder="补充说明..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddAttempt}
                disabled={!attemptMethod.trim()}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium text-white',
                  attemptMethod.trim() ? 'bg-amber-500' : 'bg-slate-300'
                )}
              >
                保存
              </button>
              <button
                onClick={() => setShowAddAttempt(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-500 bg-slate-100"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 备注 */}
      {mistake.notes && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">备注</h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{mistake.notes}</p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          onClick={() => mistake.mastered ? unmarkMastered(mistake.id) : markMastered(mistake.id)}
          className={cn(
            'flex-1 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-1.5 transition-colors',
            mistake.mastered
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-green-50 text-green-600 hover:bg-green-100'
          )}
        >
          {mistake.mastered ? (
            <><RotateCcw size={16} /> 取消掌握</>
          ) : (
            <><CheckCircle2 size={16} /> 标记已掌握</>
          )}
        </button>
        <button
          onClick={handleDelete}
          className="py-2.5 px-4 rounded-xl font-medium text-sm bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex items-center gap-1.5"
        >
          <Trash2 size={16} /> 删除
        </button>
      </div>
    </div>
  )
}
