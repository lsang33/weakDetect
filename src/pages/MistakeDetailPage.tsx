import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, CheckCircle2, RotateCcw, Lightbulb, PlusCircle, ChevronDown, ChevronUp, Camera, Edit3, RefreshCw, Save } from 'lucide-react'
import { useMistake, useMistakeActions } from '../hooks/useMistakes'
import {
  MODULE_LABELS, MODULE_COLORS, ERROR_TYPE_LABELS, ERROR_TYPE_COLORS,
  JUDGMENT_SUB_LABELS, QUESTION_TYPE_LABELS, IMPROVEMENT_RESULT_LABELS,
} from '../lib/constants'
import { formatDate } from '../lib/dateUtils'
import { ExamModule, ErrorType, QuestionType, EntryType } from '../models/exam'
import type { ImprovementResult } from '../models/exam'
import type { ImprovementAttempt, UpdateMistakeInput, QuickDiagnosis } from '../models/mistake'
import { CameraCapture } from '../components/CameraCapture'
import type { OcrResult } from '../services/ocrService'
import { diagnoseMistake as qwenDiagnose } from '../services/diagnoseService'
import { deepseekDiagnose } from '../services/deepseekService'
import { cn } from '../lib/cn'

const ALL_MODULES = Object.values(ExamModule) as ExamModule[]
const ALL_ERROR_TYPES = Object.values(ErrorType) as ErrorType[]
const IMPROVEMENT_RESULTS = ['helped', 'not_sure', 'no_effect'] as ImprovementResult[]

export function MistakeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const mistake = useMistake(id)
  const { remove, update, markMastered, unmarkMastered, addImprovementAttempt } = useMistakeActions()
  const [showCamera, setShowCamera] = useState(false)
  const [showAddAttempt, setShowAddAttempt] = useState(false)
  const [editField, setEditField] = useState<'module' | 'errorType' | null>(null)
  const [editingStem, setEditingStem] = useState(false)
  const [localStem, setLocalStem] = useState(mistake?.questionStem || '')
  const [localCorrect, setLocalCorrect] = useState(mistake?.correctAnswer || '')
  const [localMy, setLocalMy] = useState(mistake?.myAnswer || '')
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [diagStyle, setDiagStyle] = useState(localStorage.getItem('diag_style') || 'compact')
  const [attemptMethod, setAttemptMethod] = useState('')
  const [attemptResult, setAttemptResult] = useState<ImprovementResult>('helped')
  const [attemptNotes, setAttemptNotes] = useState('')
  const [expandAi, setExpandAi] = useState(true)
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagError, setDiagError] = useState('')
  const [diagResults, setDiagResults] = useState<QuickDiagnosis[]>(mistake?.quickDiagnosis ? [mistake.quickDiagnosis] : [])
  const [selectedDiag, setSelectedDiag] = useState(0)

  // 离开确认 — 必须在 early return 之前
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (isDirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // 同步本地状态 — 必须在 early return 之前
  useEffect(() => {
    if (mistake) {
      setLocalStem(mistake.questionStem || '')
      setLocalCorrect(mistake.correctAnswer || '')
      setLocalMy(mistake.myAnswer || '')
      setIsDirty(false)
    }
  }, [mistake?.id])

  /** 把 DiagnosisResult 转为 QuickDiagnosis */
  function toQuickDiag(result: any): QuickDiagnosis {
    return {
      aiAnswer: result.aiAnswer,
      aiCorrect: result.aiCorrect,
      difficulty: result.difficulty,
      examPoint: result.examPoint,
      keyDifferentiator: result.keyDifferentiator,
      solution: result.solution,
      traps: result.traps,
      userErrorStep: result.userErrorStep,
      rootCause: result.rootCause,
      fix: result.fix,
      analyzedAt: new Date(),
    }
  }

  async function handleDiagnose() {
    if (!mistake || !mistake.questionStem || !mistake.correctAnswer) return
    const diagModel = localStorage.getItem('diag_model') || 'qwen'
    const apiKey = localStorage.getItem(diagModel === 'deepseek' ? 'deepseek_key' : 'dashscope_key')
    if (!apiKey) { setDiagError('请先在设置页填写 API Key'); return }
    setDiagnosing(true)
    setDiagError('')
    try {
      const modName = MODULE_LABELS[mistake.module]
      const dsModel = localStorage.getItem('ds_model') || 'reasoner'
      const dsModelName = dsModel === 'chat' ? 'deepseek-chat' : 'deepseek-reasoner'
      const result = diagModel === 'deepseek'
        ? await deepseekDiagnose(mistake.questionStem, mistake.correctAnswer, mistake.myAnswer, modName, apiKey, diagStyle, dsModelName)
        : await qwenDiagnose(mistake.questionStem, mistake.correctAnswer, mistake.myAnswer, modName, apiKey, diagStyle)
      const diag = toQuickDiag(result)
      await update(mistake!.id, { quickDiagnosis: diag })
      setDiagResults(prev => [...prev, diag])
      setSelectedDiag(diagResults.length)
      setExpandAi(true)
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : '诊断失败')
    }
    setDiagnosing(false)
  }

  function selectDiagnosis(idx: number) {
    setSelectedDiag(idx)
    if (mistake && diagResults[idx]) {
      update(mistake.id, { quickDiagnosis: diagResults[idx] })
    }
  }

  if (!mistake) {
    return <div className="text-center py-16 text-slate-400">加载中或错题不存在</div>
  }

  async function handleSave() {
    if (!mistake || !isDirty) return
    setSaving(true)
    await update(mistake.id, {
      questionStem: localStem || undefined,
      correctAnswer: localCorrect || undefined,
      myAnswer: localMy || undefined,
    })
    setIsDirty(false)
    setSaving(false)
    setSavedMsg('已保存')
    setTimeout(() => setSavedMsg(''), 1500)
  }

  function markDirty() { if (!isDirty) setIsDirty(true) }

  function handleBack() {
    if (isDirty) {
      if (!window.confirm('有未保存的修改，确定离开吗？')) return
    }
    navigate(-1)
  }

  async function handleDelete() {
    if (window.confirm('确定删除这道错题吗？')) {
      await remove(mistake!.id)
      navigate('/mistakes')
    }
  }

  async function handleOcrResult(result: OcrResult) {
    const input: UpdateMistakeInput = {
      entryType: EntryType.PHOTO,
      questionStem: result.questionStem || undefined,
      correctAnswer: result.correctAnswer || undefined,
      knowledgePoint: result.knowledgePoint || undefined,
      subCategory: result.subCategory || undefined,
    }
    await update(mistake!.id, input)
    setShowCamera(false)
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

  const hasAiAnalysis = diagResults.length > 0
  const canDiagnose = !!mistake.questionStem && !!mistake.correctAnswer
  const attempts = mistake.improvementAttempts ?? []

  return (
    <div className="animate-fade-in space-y-4 pb-4">
      {/* 返回 */}
      <button
        onClick={handleBack}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} /> 返回
        {savedMsg && <span className="text-green-500 text-xs ml-2">{savedMsg}</span>}
      </button>

      {/* 主卡片 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        {/* 标签行 */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button onClick={() => setEditField(editField === 'module' ? null : 'module')}
            className="relative group text-sm font-medium px-3 py-1 rounded-full text-white border-2 border-transparent hover:border-white/50 transition-all"
            style={{ backgroundColor: MODULE_COLORS[mistake.module] }}>
            {MODULE_LABELS[mistake.module]}
            <Edit3 size={10} className="inline ml-1 opacity-60 group-hover:opacity-100" />
          </button>
          <button onClick={() => setEditField(editField === 'errorType' ? null : 'errorType')}
            className="relative group text-sm px-3 py-1 rounded-full text-white border-2 border-transparent hover:border-white/50 transition-all"
            style={{ backgroundColor: ERROR_TYPE_COLORS[mistake.errorType] }}>
            {ERROR_TYPE_LABELS[mistake.errorType]}
            <Edit3 size={10} className="inline ml-1 opacity-60 group-hover:opacity-100" />
          </button>
          {mistake.questionType === QuestionType.DOUBTFUL && (
            <span className="text-sm px-3 py-1 rounded-full bg-amber-100 text-amber-700">
              {QUESTION_TYPE_LABELS[QuestionType.DOUBTFUL]}
            </span>
          )}
          {mistake.mastered && (
            <span className="text-sm px-3 py-1 rounded-full bg-green-100 text-green-700">已掌握</span>
          )}
        </div>

        {/* 模块选择器 */}
        {editField === 'module' && (
          <div className="grid grid-cols-3 gap-1.5 mb-4 p-3 bg-slate-50 rounded-xl animate-fade-in">
            {ALL_MODULES.map(m => (
              <button key={m}
                onClick={() => { update(mistake!.id, { module: m }); setEditField(null) }}
                className={cn(
                  'px-1 py-2 rounded-xl text-xs font-medium border-2 transition-all truncate',
                  mistake.module === m
                    ? 'text-white border-transparent ring-2 ring-offset-1'
                    : 'bg-white text-slate-600 border-slate-200'
                )}
                style={mistake.module === m ? { backgroundColor: MODULE_COLORS[m] } : undefined}
              >
                {MODULE_LABELS[m]}
              </button>
            ))}
          </div>
        )}

        {/* 错误类型选择器 */}
        {editField === 'errorType' && (
          <div className="grid grid-cols-4 gap-1.5 mb-4 p-3 bg-slate-50 rounded-xl animate-fade-in">
            {ALL_ERROR_TYPES.map(et => (
              <button key={et}
                onClick={() => { update(mistake!.id, { errorType: et }); setEditField(null) }}
                className={cn(
                  'px-1 py-1.5 rounded-lg text-xs font-medium border-2 transition-all truncate',
                  mistake.errorType === et
                    ? 'text-white border-transparent ring-2 ring-offset-1'
                    : 'bg-white text-slate-500 border-slate-200'
                )}
                style={mistake.errorType === et ? { backgroundColor: ERROR_TYPE_COLORS[et] } : undefined}
              >
                {ERROR_TYPE_LABELS[et]}
              </button>
            ))}
          </div>
        )}

        {/* 录入方式 */}
        <p className="text-xs text-slate-400 mb-3">
          {mistake.entryType === 'photo' ? '📷 拍照录入' : '✏️ 手录'}
          {mistake.entryType === 'manual' && !mistake.questionStem && (
            <>
              <span className="ml-2 text-amber-500">（缺少题目原文，将无法参与 AI 深度分析）</span>
              {!showCamera && (
                <button onClick={() => setShowCamera(true)}
                  className="ml-2 text-purple-500 underline">补拍</button>
              )}
            </>
          )}
        </p>
        {showCamera && (
          <div className="mb-3">
            <CameraCapture onResult={handleOcrResult} />
            <button onClick={() => setShowCamera(false)}
              className="mt-1 text-xs text-slate-400 underline">取消</button>
          </div>
        )}

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
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">题目内容</h3>
        <div className="mb-3">
          <label className="text-xs text-slate-400 mb-1 block">题目原文</label>
          {editingStem || !localStem ? (
            <textarea value={localStem} rows={1}
              ref={el => { if (el) requestAnimationFrame(() => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }) }}
              onInput={e => { setLocalStem(e.currentTarget.value); markDirty(); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px' }}
              onBlur={() => setEditingStem(false)}
              onFocus={() => setEditingStem(true)}
              placeholder="点击输入题目原文"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white resize-none overflow-hidden" />
          ) : (
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed cursor-pointer hover:bg-slate-50 rounded p-1 -m-1"
              onClick={() => setEditingStem(true)}>{localStem}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-0.5">正确答案</label>
            <input value={localCorrect}
              onChange={e => { setLocalCorrect(e.target.value.toUpperCase()); markDirty() }}
              placeholder="如：C"
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-green-600 focus:outline-none focus:ring-2 focus:ring-green-500/20" />
            <div className="flex gap-1 mt-1 flex-wrap">
              {['A','B','C','D','E','对','错'].map(ch => (
                <button key={ch} onClick={() => { setLocalCorrect(ch); markDirty() }}
                  className={'px-1.5 py-0.5 rounded text-[10px] border ' + (localCorrect === ch ? 'bg-green-500 text-white border-green-500' : 'text-slate-500 border-slate-200')}>{ch}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-0.5">我的答案</label>
            <input value={localMy}
              onChange={e => { setLocalMy(e.target.value.toUpperCase()); markDirty() }}
              placeholder="如：B"
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20" />
            <div className="flex gap-1 mt-1 flex-wrap">
              {['A','B','C','D','E','对','错'].map(ch => (
                <button key={ch} onClick={() => { setLocalMy(ch); markDirty() }}
                  className={'px-1.5 py-0.5 rounded text-[10px] border ' + (localMy === ch ? 'bg-red-500 text-white border-red-500' : 'text-slate-500 border-slate-200')}>{ch}</button>
              ))}
            </div>
          </div>
        </div>
        {isDirty && (
          <button onClick={handleSave} disabled={saving}
            className="mt-2 w-full py-2 rounded-lg text-sm font-medium text-white bg-blue-500 active:scale-[0.98] flex items-center justify-center gap-1.5">
            <Save size={14} /> {saving ? '保存中...' : '保存修改'}
          </button>
        )}
      </div>

      {/* AI 诊断 */}
      <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100">
        {hasAiAnalysis && (
          <>
            <button onClick={() => setExpandAi(!expandAi)}
              className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-purple-700">AI 诊断</span>
              </div>
              {expandAi ? <ChevronUp size={16} className="text-purple-400" /> : <ChevronDown size={16} className="text-purple-400" />}
            </button>
            {expandAi && (
              <div className="mt-3 space-y-3">
                {/* 多诊断切换 */}
                {diagResults.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {diagResults.map((d, i) => {
                      const time = d.analyzedAt ? new Date(d.analyzedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''
                      return (
                        <button key={i} onClick={() => selectDiagnosis(i)}
                          className={cn('text-xs px-2 py-1 rounded-lg border flex items-center gap-1',
                            i === selectedDiag
                              ? 'bg-purple-500 text-white border-transparent'
                              : 'bg-white text-slate-500 border-slate-200')}>
                          #{i + 1} {time}
                          {i === selectedDiag && <span className="text-[9px] opacity-80">已选用</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
                {diagResults[selectedDiag] && (
                  <>
                    {(diagResults[selectedDiag].difficulty || diagResults[selectedDiag].examPoint) && (
                      <div className="bg-purple-100/50 rounded-lg p-3 space-y-1.5 mb-3">
                        {diagResults[selectedDiag].difficulty && (
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-purple-400 shrink-0 mt-0.5 w-8">难度</span>
                            <p className="text-xs text-purple-800">{diagResults[selectedDiag].difficulty}</p>
                          </div>
                        )}
                        {diagResults[selectedDiag].examPoint && (
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-purple-400 shrink-0 mt-0.5 w-8">考点</span>
                            <p className="text-xs text-purple-800">{diagResults[selectedDiag].examPoint}</p>
                          </div>
                        )}
                        {diagResults[selectedDiag].keyDifferentiator && (
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-purple-400 shrink-0 mt-0.5 w-8">关键</span>
                            <p className="text-xs text-purple-800">{diagResults[selectedDiag].keyDifferentiator}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full',
                        mistake.correctAnswer && diagResults[selectedDiag].aiAnswer === mistake.correctAnswer.trim()
                          ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')}>
                        AI 答案：{diagResults[selectedDiag].aiAnswer}
                        {mistake.correctAnswer && diagResults[selectedDiag].aiAnswer === mistake.correctAnswer.trim() ? ' ✅' : ' ❌'}
                      </span>
                    </div>
                    {diagResults[selectedDiag].solution && (
                      <div><p className="text-xs text-purple-400 font-medium mb-1">逐项解析</p><p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{diagResults[selectedDiag].solution}</p></div>
                    )}
                    {diagResults[selectedDiag].traps && (
                      <div><p className="text-xs text-purple-400 font-medium mb-1">陷阱</p><p className="text-sm text-slate-700">{diagResults[selectedDiag].traps}</p></div>
                    )}
                    <div><p className="text-xs text-purple-400 font-medium mb-1">错因</p><p className="text-sm text-slate-700">{diagResults[selectedDiag].rootCause}</p></div>
                    <div><p className="text-xs text-purple-400 font-medium mb-1">方法</p><p className="text-sm text-slate-700">{diagResults[selectedDiag].fix}</p></div>
                  </>
                )}
                <p className="text-[10px] text-purple-300">此分析由 AI 生成，仅供参考</p>
                {hasAiAnalysis && (
                  <button onClick={async () => {
                    await update(mistake!.id, { quickDiagnosis: diagResults[selectedDiag] })
                    setSavedMsg('诊断已保存')
                    setTimeout(() => setSavedMsg(''), 1500)
                  }}
                    className="w-full py-1.5 rounded-lg border border-purple-300 text-xs text-purple-600 font-medium bg-white active:bg-purple-50">
                    保存诊断结果
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {/* 诊断按钮：没有诊断时不展开，已有诊断时在底部重新诊断 */}
        <div className={hasAiAnalysis ? 'mt-3 pt-3 border-t border-purple-200' : ''}>
          {!mistake.questionStem ? (
            <p className="text-xs text-purple-500 text-center">缺少题目原文，无法 AI 分析</p>
          ) : (
            <div className="space-y-2">
              {/* 风格选择 */}
              <div className="flex gap-1">
                {[
                  { k: 'compact', label: '精炼' },
                  { k: 'detailed', label: '详细' },
                  { k: 'free', label: '自由' },
                ].map(s => (
                  <button key={s.k} onClick={() => { setDiagStyle(s.k); localStorage.setItem('diag_style', s.k) }}
                    className={`flex-1 py-1 rounded text-[10px] border ${diagStyle === s.k ? 'bg-purple-50 text-purple-600 border-purple-300' : 'bg-white text-slate-400 border-slate-200'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
              <button onClick={handleDiagnose} disabled={diagnosing}
                className="w-full py-2 rounded-lg bg-purple-500 text-white text-sm font-medium disabled:opacity-60">
                {diagnosing ? <RefreshCw size={14} className="inline animate-spin mr-1" /> : null}
                {diagnosing ? '分析中...' : (hasAiAnalysis ? '重新诊断' : 'AI 诊断这道题')}
              </button>
            </div>
          )}
          {diagError && <p className="text-xs text-red-500 mt-2">{diagError}</p>}
        </div>
      </div>

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
