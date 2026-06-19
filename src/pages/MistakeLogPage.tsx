import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Camera, Edit3, RefreshCw, Brain, ChevronUp, ChevronDown } from 'lucide-react'
import { useMistakeActions, useKnowledgePoints, useSubCategories } from '../hooks/useMistakes'
import {
  ExamModule, ErrorType, EntryType, QuestionType, JudgmentSubType,
  MODULE_LABELS, ERROR_TYPE_LABELS, JUDGMENT_SUB_LABELS,
  MODULE_COLORS, ERROR_TYPE_COLORS,
  ENTRY_TYPE_LABELS, QUESTION_TYPE_LABELS,
  ALL_JUDGMENT_SUB_TYPES,
} from '../lib/constants'
import { cn } from '../lib/cn'
import { CameraCapture } from '../components/CameraCapture'
import type { CreateMistakeInput } from '../models/mistake'
import type { Difficulty } from '../models/exam'
import type { OcrResult } from '../services/ocrService'
import { diagnoseMistake as qwenDiagnose, type DiagnosisResult } from '../services/diagnoseService'
import { deepseekDiagnose } from '../services/deepseekService'
import type { QuickDiagnosis } from '../models/mistake'
import { MODULE_LABELS as ML } from '../lib/constants'

/** 把 OCR 返回的模块中文名映射到枚举 */
function mapModule(ocrModule: string): ExamModule {
  const m = ocrModule.trim()
  if (m.includes('言语')) return ExamModule.VERBAL
  if (m.includes('数量')) return ExamModule.QUANTITATIVE
  if (m.includes('判断')) return ExamModule.JUDGMENT
  if (m.includes('资料')) return ExamModule.DATA_ANALYSIS
  if (m.includes('常识')) return ExamModule.COMMON_KNOWLEDGE
  if (m.includes('政治')) return ExamModule.POLITICAL
  return ExamModule.JUDGMENT
}

/** 把 OCR 返回的难度映射到 1-5 */
function mapDifficulty(d: unknown): Difficulty {
  const n = Number(d)
  if (n >= 1 && n <= 5) return n as Difficulty
  return 3
}

const ANSWER_CHIPS = ['A', 'B', 'C', 'D', 'E', '对', '错']

function QuickChips({ onPick, selected, color }: { onPick: (v: string) => void; selected: string; color: 'green' | 'red' }) {
  const activeClass = color === 'green' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
  return (
    <div className="flex gap-1 flex-wrap">
      {ANSWER_CHIPS.map(ch => (
        <button
          key={ch}
          onClick={() => onPick(selected === ch ? '' : ch)}
          className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
            selected === ch ? activeClass : 'bg-white text-slate-500 border-slate-200 active:bg-slate-50'
          }`}
        >
          {ch}
        </button>
      ))}
    </div>
  )
}

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
  const [errorType, setErrorType] = useState<ErrorType>(ErrorType.KNOWLEDGE_GAP)
  const [source, setSource] = useState('')
  const [knowledgePoint, setKnowledgePoint] = useState('')
  const [questionStem, setQuestionStem] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [myAnswer, setMyAnswer] = useState('')
  const stemRef = useRef<HTMLTextAreaElement>(null)

  const autoResize = useCallback(() => {
    const el = stemRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  useEffect(() => { autoResize() }, [questionStem, autoResize])
  const [difficulty, setDifficulty] = useState<Difficulty>(3)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [diagnoses, setDiagnoses] = useState<DiagnosisResult[]>([])
  const [selectedDiag, setSelectedDiag] = useState(0)
  const [expandedDiags, setExpandedDiags] = useState<Set<number>>(new Set([0]))
  const [diagStyle, setDiagStyle] = useState(localStorage.getItem('diag_style') || 'compact')
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagError, setDiagError] = useState('')
  // 调试日志
  const [debugLogs, setDebugLogs] = useState<{ time: string; msg: string; type: 'info' | 'error' | 'success' }[]>([])
  const [showDebug, setShowDebug] = useState(false)

  function addLog(msg: string, type: 'info' | 'error' | 'success' = 'info') {
    const time = new Date().toLocaleTimeString('zh-CN')
    setDebugLogs(prev => [...prev.slice(-19), { time, msg, type }])
  }

  function toggleExpand(i: number) {
    setExpandedDiags(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  /** OCR 识别完成后自动填表 */
  function handleOcrResult(result: OcrResult) {
    setEntryType(EntryType.PHOTO)
    setModule(mapModule(result.module))
    setKnowledgePoint(result.knowledgePoint || '')
    setSubCategory(result.subCategory || '')
    setQuestionStem(result.questionStem || '')
    setCorrectAnswer(result.correctAnswer || '')
    setDifficulty(mapDifficulty(result.difficulty))
    if (result.errorType) {
      const et = Object.values(ErrorType).find(
        e => ERROR_TYPE_LABELS[e] === result.errorType || e === result.errorType
      )
      if (et) setErrorType(et)
    }
    if (result.judgmentSubType) {
      const jst = Object.values(JudgmentSubType).find(
        j => JUDGMENT_SUB_LABELS[j] === result.judgmentSubType || j === result.judgmentSubType
      )
      if (jst) setJudgmentSubType(jst)
    }
    // 备注不由AI填写
  }

  const [showKPSuggestions, setShowKPSuggestions] = useState(false)
  const [showSubSuggestions, setShowSubSuggestions] = useState(false)

  const kpSuggestions = existingKPs.filter(kp =>
    kp.toLowerCase().includes(knowledgePoint.toLowerCase()) && kp !== knowledgePoint
  ).slice(0, 5)

  const subSuggestions = existingSubs.filter(sub =>
    sub.toLowerCase().includes(subCategory.toLowerCase()) && sub !== subCategory
  ).slice(0, 5)

  const isValid = module

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
      source: source.trim() || undefined,
      knowledgePoint: knowledgePoint.trim(),
      questionStem: questionStem.trim() || undefined,
      correctAnswer: correctAnswer.trim() || undefined,
      myAnswer: myAnswer.trim() || undefined,
      notes: notes.trim() || undefined,
      difficulty,
      quickDiagnosis: diagnoses.length > 0 ? {
        aiAnswer: diagnoses[selectedDiag].aiAnswer,
        aiCorrect: diagnoses[selectedDiag].aiCorrect,
        difficulty: diagnoses[selectedDiag].difficulty,
        examPoint: diagnoses[selectedDiag].examPoint,
        keyDifferentiator: diagnoses[selectedDiag].keyDifferentiator,
        solution: diagnoses[selectedDiag].solution,
        traps: diagnoses[selectedDiag].traps,
        userErrorStep: diagnoses[selectedDiag].userErrorStep,
        rootCause: diagnoses[selectedDiag].rootCause,
        fix: diagnoses[selectedDiag].fix,
        analyzedAt: new Date(),
      } : undefined,
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
          </button>
        </div>
        {entryType === EntryType.PHOTO && (
          <div className="mt-2">
            <CameraCapture onResult={handleOcrResult} />
          </div>
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
        <label className="block text-sm font-medium text-slate-700 mb-2">所属模块 <span className="text-xs text-slate-400 font-normal">（AI 识别）</span></label>
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
        <label className="block text-sm font-medium text-slate-700 mb-2">错误类型 <span className="text-xs text-slate-400 font-normal">（默认知识点盲区）</span></label>
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
        <label className="block text-sm font-medium text-slate-700 mb-2">知识点 <span className="text-xs text-slate-400 font-normal">（AI 自动填充）</span></label>
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
        <label className="block text-sm font-medium text-slate-700 mb-2">细分考点 <span className="text-xs text-slate-400 font-normal">（AI 自动填充）</span></label>
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
              ref={stemRef}
              value={questionStem}
              onChange={e => { setQuestionStem(e.target.value); autoResize() }}
              placeholder="拍照后自动填充，也可手动粘贴题目原文"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white resize-none overflow-hidden"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">正确答案</label>
              <input
                type="text"
                value={correctAnswer}
                onChange={e => setCorrectAnswer(e.target.value)}
                placeholder="例如：B"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 bg-white"
              />
              <QuickChips onPick={setCorrectAnswer} selected={correctAnswer} color="green" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">我的答案</label>
              <input
                type="text"
                value={myAnswer}
                onChange={e => setMyAnswer(e.target.value)}
                placeholder="例如：C"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 bg-white"
              />
              <QuickChips onPick={setMyAnswer} selected={myAnswer} color="red" />
            </div>
          </div>
        </div>
      </div>

      {/* 诊断中 loading */}
      {diagnosing && (
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 animate-fade-in">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-purple-500 animate-spin" />
            <span className="text-sm text-purple-600">AI 正在分析错因...</span>
          </div>
        </div>
      )}

      {/* 诊断结果列表 */}
      {diagnoses.map((d, i) => {
        const expanded = expandedDiags.has(i)
        return (
        <div key={i} className={cn(
          'rounded-xl border animate-fade-in overflow-hidden',
          selectedDiag === i ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200' : 'bg-white border-slate-200'
        )}>
          {/* 摘要行：始终可见 */}
          <button
            onClick={() => toggleExpand(i)}
            className={cn('w-full flex items-center justify-between px-4 py-3')}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-purple-500">🤖 AI 诊断 #{i + 1}</span>
              <span className="text-[10px] text-purple-300">· {({ compact: '精炼', detailed: '详细', free: '自由' })[diagStyle]}</span>
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                d.aiCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              )}>
                答案 {d.aiAnswer} {d.aiCorrect ? '对' : '错'}
              </span>
              <span className="text-xs text-slate-400 truncate max-w-32">
                {d.difficulty?.replace(/★+/g, '').trim() || d.rootCause?.slice(0, 20)}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedDiag(i) }}
                className={cn(
                  'text-xs px-3 py-1 rounded-lg font-medium transition-colors',
                  selectedDiag === i
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-purple-100'
                )}
              >
                {selectedDiag === i ? '已选用 ✓' : '选用'}
              </button>
              {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </div>
          </button>

          {/* 展开内容 */}
          {expanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
              {/* 整体分析 */}
              <div className="bg-purple-100/50 rounded-lg p-3 space-y-1.5">
                {d.difficulty && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-purple-400 shrink-0 mt-0.5 w-8">难度</span>
                    <p className="text-xs text-purple-800">{d.difficulty}</p>
                  </div>
                )}
                {d.examPoint && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-purple-400 shrink-0 mt-0.5 w-8">考点</span>
                    <p className="text-xs text-purple-800">{d.examPoint}</p>
                  </div>
                )}
                {d.keyDifferentiator && (
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-purple-400 shrink-0 mt-0.5 w-8">关键</span>
                    <p className="text-xs text-purple-800">{d.keyDifferentiator}</p>
                  </div>
                )}
              </div>

              {/* 题目回顾 */}
              <details className="bg-slate-50 rounded-lg p-3 group">
                <summary className="text-xs text-slate-500 cursor-pointer">题目回顾</summary>
                <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap leading-relaxed">{questionStem}</p>
              </details>

              {/* 逐项解析 */}
              {d.solution && (
                <div>
                  <p className="text-xs text-purple-400 mb-1">逐项解析</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{d.solution}</p>
                </div>
              )}
              {d.traps && (
                <div>
                  <p className="text-xs text-purple-400 mb-1">陷阱</p>
                  <p className="text-sm text-slate-700">{d.traps}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-purple-200">
                <div>
                  <p className="text-xs text-purple-400 mb-1">错因</p>
                  <p className="text-sm text-slate-700">{d.rootCause}</p>
                </div>
                <div>
                  <p className="text-xs text-purple-400 mb-1">方法</p>
                  <p className="text-sm text-slate-700">{d.fix}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )})}

      {/* 诊断错误提示 */}
      {diagError && (
        <div className="bg-red-50 rounded-xl p-3 border border-red-200 animate-fade-in">
          <p className="text-sm text-red-600">{diagError}</p>
        </div>
      )}

      {/* 调试日志开关 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="text-[10px] text-slate-400 underline"
        >
          {showDebug ? '隐藏' : '调试日志'} ({debugLogs.length})
        </button>
      </div>

      {/* 调试日志面板 */}
      {showDebug && debugLogs.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1 animate-fade-in">
          {debugLogs.map((log, i) => (
            <p key={i} className={cn(
              'text-[10px] font-mono',
              log.type === 'error' ? 'text-red-400' :
              log.type === 'success' ? 'text-green-400' : 'text-slate-400'
            )}>
              [{log.time}] {log.msg}
            </p>
          ))}
        </div>
      )}

      {/* 手动诊断按钮 */}
      {questionStem.trim() && correctAnswer.trim() && !diagnosing && (
        <div className="space-y-2">
        {/* 风格选择 */}
        <div className="flex gap-1 justify-end">
          {[
            { k: 'compact', label: '精炼' },
            { k: 'detailed', label: '详细' },
            { k: 'free', label: '自由' },
          ].map(s => (
            <button key={s.k} onClick={() => { setDiagStyle(s.k); localStorage.setItem('diag_style', s.k) }}
              className={`px-2 py-0.5 rounded text-[10px] border ${diagStyle === s.k ? 'bg-purple-50 text-purple-600 border-purple-300' : 'bg-white text-slate-400 border-slate-200'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            const modName = module ? ML[module] : '公务员考试'
            const diagModel = localStorage.getItem('diag_model') || 'qwen'
            const apiKey = localStorage.getItem(diagModel === 'deepseek' ? 'deepseek_key' : 'dashscope_key')
            if (!apiKey) {
              setDiagError(`未配置${diagModel === 'deepseek' ? 'DeepSeek' : '通义千问'} API Key，请先去设置页填写`)
              return
            }
            setDiagError('')
            setDiagnosing(true)
            const modelLabel = diagModel === 'deepseek' ? 'deepseek-reasoner(思考)' : 'qwen-max(思考)'
            const styleLabel = { compact: '精炼', detailed: '详细', free: '自由' }[diagStyle] || diagStyle
            addLog(`开始诊断 #${diagnoses.length + 1} [${modelLabel}/${styleLabel}] ${modName}`, 'info')
            const diagnose = diagModel === 'deepseek' ? deepseekDiagnose : qwenDiagnose
            diagnose(questionStem, correctAnswer, myAnswer || undefined, modName, apiKey, diagStyle)
              .then(d => {
                setDiagnoses(prev => {
                  setExpandedDiags(ex => new Set([...ex, prev.length]))
                  return [...prev, d]
                })
                setDiagnosing(false)
                addLog(`诊断 #${diagnoses.length + 1} 完成 [${modelLabel}/${styleLabel}] AI答案=${d.aiAnswer} ${d.aiCorrect ? '✓' : '✗'}`, d.aiCorrect ? 'success' : 'error')
              })
              .catch(err => {
                setDiagnosing(false)
                const msg = err instanceof Error ? err.message : String(err)
                setDiagError(msg)
                addLog(`诊断失败: ${msg}`, 'error')
              })
          }}
          className="w-full py-2 rounded-xl bg-purple-100 text-purple-600 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Brain size={16} /> AI 诊断这道题
        </button>
        </div>
      )}

      {/* 题目来源 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">题目来源</label>
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
