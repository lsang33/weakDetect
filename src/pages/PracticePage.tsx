import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, CheckCircle2, XCircle, Star, ChevronRight, ChevronDown, Clock, Target } from 'lucide-react'
import { useMistakes } from '../hooks/useMistakes'
import { mistakeRepository } from '../db'
import { MODULE_LABELS, MODULE_COLORS } from '../lib/constants'
import { cn } from '../lib/cn'
import { ExamModule } from '../models/exam'
import type { MistakeRecord } from '../models/mistake'

type Phase = 'select' | 'practice' | 'result' | 'review'

/** 回顾页缓存——挂在 window 下，确保任何情况下都不丢失 */
type ReviewCache = {
  questions: MistakeRecord[]
  results: { userAnswer: string; correct: boolean; timeMs: number }[]
  expandedSet: number[]
  reviewFilter: 'all' | 'wrong'
  timestamp: number
}
function getReviewCache(): ReviewCache | null {
  return (window as any).__practiceReviewCache || null
}
function setReviewCache(c: ReviewCache) {
  (window as any).__practiceReviewCache = c
}
function clearReviewCache() {
  delete (window as any).__practiceReviewCache
}

const ALL_MODULES = Object.values(ExamModule) as ExamModule[]
const LETTERS = ['A', 'B', 'C', 'D', 'E']

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}秒`
  const min = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${min}分${s}秒` : `${min}分钟`
}

function formatTimeShort(ms: number): string {
  if (ms <= 0) return ''
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const s = sec % 60
  return `${min}m${s}s`
}

/** 筛选可用于练习的错题 */
function filterPracticeMistakes(
  mistakes: MistakeRecord[],
  filters: {
    module: string
    questionType: string
    dateRange: string
    includeMastered: boolean
    starredOnly: boolean
  },
): MistakeRecord[] {
  return mistakes.filter(m => {
    if (!m.questionStem || !m.correctAnswer) return false
    if (filters.module && m.module !== filters.module) return false
    if (filters.questionType === 'mistake' && m.questionType !== 'mistake') return false
    if (filters.questionType === 'doubtful' && m.questionType !== 'doubtful') return false
    if (filters.dateRange === '7') {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      if (new Date(m.createdAt).getTime() < weekAgo) return false
    }
    if (filters.dateRange === '30') {
      const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      if (new Date(m.createdAt).getTime() < monthAgo) return false
    }
    if (!filters.includeMastered && m.mastered) return false
    if (filters.starredOnly && !m.starred) return false
    return true
  })
}

export function PracticePage() {
  const navigate = useNavigate()
  const allMistakes = useMistakes()

  const mistakeMap = useMemo(() => {
    const map = new Map<string, MistakeRecord>()
    for (const m of allMistakes) map.set(m.id, m)
    return map
  }, [allMistakes])

  // === 阶段状态 ===
  const [phase, setPhase] = useState<Phase>('select')
  const [mode, setMode] = useState<'practice' | 'exam'>('practice')

  // === 筛选状态 ===
  const [moduleFilter, setModuleFilter] = useState('')
  const [questionType, setQuestionType] = useState('')
  const [dateRange, setDateRange] = useState('')
  const [maxQuestions, setMaxQuestions] = useState(30)
  const [includeMastered, setIncludeMastered] = useState(false)
  const [starredOnly, setStarredOnly] = useState(false)

  // === 练习状态 ===
  const [questions, setQuestions] = useState<MistakeRecord[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [examAnswers, setExamAnswers] = useState<Record<number, string>>({})
  const [results, setResults] = useState<{ userAnswer: string; correct: boolean; timeMs: number }[]>([])

  // === 计时 ===
  const questionStartRef = useRef(Date.now())
  const timingsRef = useRef<Map<number, number>>(new Map())

  // === 确认对话框 ===
  const [confirmType, setConfirmType] = useState<'exit' | 'submit' | null>(null)

  // === 回顾阶段状态 ===
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong'>('all')
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set())

  // === 本地收藏状态（乐观更新） ===
  const [starredSet, setStarredSet] = useState<Set<string>>(new Set())
  useEffect(() => {
    const next = new Set<string>()
    for (const m of allMistakes) {
      if (m.starred) next.add(m.id)
    }
    setStarredSet(next)
  }, [allMistakes])

  // 每题开始时重置计时器
  useEffect(() => {
    questionStartRef.current = Date.now()
  }, [currentIdx, phase])

  // === 筛选结果 ===
  const filtered = useMemo(() => filterPracticeMistakes(allMistakes, {
    module: moduleFilter,
    questionType,
    dateRange,
    includeMastered,
    starredOnly,
  }), [allMistakes, moduleFilter, questionType, dateRange, includeMastered, starredOnly])

  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of filtered) {
      counts[m.module] = (counts[m.module] || 0) + 1
    }
    return counts
  }, [filtered])

  const getLatest = useCallback((id: string) => mistakeMap.get(id), [mistakeMap])

  // TODO: 暂时禁用缓存恢复，排查导航本身是否正常

  // === 处理函数 ===

  function startPractice() {
    const pool = shuffle(filtered).slice(0, maxQuestions)
    if (pool.length === 0) return
    setQuestions(pool)
    setCurrentIdx(0)
    setSelectedAnswer('')
    setShowFeedback(false)
    setExamAnswers({})
    setResults([])
    timingsRef.current = new Map()
    questionStartRef.current = Date.now()
    setConfirmType(null)
    setPhase('practice')
  }

  async function submitAnswer() {
    if (!selectedAnswer || !questions[currentIdx]) return
    const q = questions[currentIdx]
    const timeMs = Date.now() - questionStartRef.current
    timingsRef.current.set(currentIdx, timeMs)
    const correct = selectedAnswer === q.correctAnswer?.trim()
    setResults(prev => [...prev, { userAnswer: selectedAnswer, correct, timeMs }])
    setShowFeedback(true)
    try { await mistakeRepository.recordPracticeResult(q.id, correct) } catch { /* ignore */ }
  }

  function nextQuestion() {
    if (currentIdx + 1 >= questions.length) {
      setPhase('result')
      return
    }
    setCurrentIdx(i => i + 1)
    setSelectedAnswer('')
    setShowFeedback(false)
  }

  function goToQuestion(idx: number) {
    const newAnswers = { ...examAnswers }
    if (selectedAnswer) {
      newAnswers[currentIdx] = selectedAnswer
    }
    const now = Date.now()
    const prev = timingsRef.current.get(currentIdx) || 0
    timingsRef.current.set(currentIdx, prev + (now - questionStartRef.current))

    setExamAnswers(newAnswers)
    setCurrentIdx(idx)
    setSelectedAnswer(newAnswers[idx] || '')
  }

  function submitExam() {
    const finalAnswers = { ...examAnswers }
    if (selectedAnswer) {
      finalAnswers[currentIdx] = selectedAnswer
    }

    const now = Date.now()
    const prev = timingsRef.current.get(currentIdx) || 0
    timingsRef.current.set(currentIdx, prev + (now - questionStartRef.current))

    const allResults: { userAnswer: string; correct: boolean; timeMs: number }[] = []
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const userAnswer = finalAnswers[i] || ''
      const timeMs = timingsRef.current.get(i) || 0
      const correct = userAnswer === q.correctAnswer?.trim()
      allResults.push({ userAnswer, correct, timeMs })
      if (userAnswer) {
        try { mistakeRepository.recordPracticeResult(q.id, correct) } catch { /* ignore */ }
      }
    }
    setResults(allResults)
    setExamAnswers(finalAnswers)
    setConfirmType(null)
    setPhase('result')
  }

  function exitPractice() {
    setPhase('select')
    setQuestions([])
    setConfirmType(null)
  }

  async function toggleStar(id: string) {
    setStarredSet(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    try { await mistakeRepository.toggleStar(id) } catch { /* ignore */ }
  }

  async function markMastered(id: string) {
    try { await mistakeRepository.markMastered(id) } catch { /* ignore */ }
  }

  async function markAllCorrectMastered() {
    for (let i = 0; i < questions.length; i++) {
      if (results[i]?.correct) {
        try { await mistakeRepository.markMastered(questions[i].id) } catch { /* ignore */ }
      }
    }
  }

  // 进入回顾时初始化展开状态（错题默认展开）
  function enterReview() {
    const s = new Set<number>()
    results.forEach((r, i) => { if (!r.correct) s.add(i) })
    setExpandedSet(s)
    setReviewFilter('all')
    setPhase('review')
  }

  function toggleExpand(idx: number) {
    setExpandedSet(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // === 确认对话框 ===
  const confirmDialog = confirmType ? (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center animate-fade-in">
      <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl">
        {confirmType === 'exit' ? (
          <>
            <p className="text-sm font-medium text-slate-800 mb-1">确定退出吗？</p>
            <p className="text-xs text-slate-500 mb-4">
              {mode === 'practice'
                ? `已完成 ${results.length}/${questions.length} 题`
                : `已答 ${Object.keys(examAnswers).length}/${questions.length} 题`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmType(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium">继续{mode === 'practice' ? '练习' : '考试'}</button>
              <button onClick={exitPractice}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium">退出</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-800 mb-1">确定交卷吗？</p>
            <p className="text-xs text-slate-500 mb-1">已答 {Object.keys(examAnswers).length + (selectedAnswer && !examAnswers[currentIdx] ? 1 : 0)}/{questions.length} 题</p>
            {(() => {
              const answered = Object.keys(examAnswers).length + (selectedAnswer && !examAnswers[currentIdx] ? 1 : 0)
              const unanswered = questions.length - answered
              return unanswered > 0 ? (
                <p className="text-xs text-amber-500 mb-4">还有 {unanswered} 题未答，未答的视为错误</p>
              ) : (
                <p className="text-xs text-slate-400 mb-4">全部已答</p>
              )
            })()}
            <div className="flex gap-2">
              <button onClick={() => setConfirmType(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium">继续检查</button>
              <button onClick={submitExam}
                className="flex-1 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium">确定交卷</button>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null

  // === 渲染 ===

  // ─── 阶段 1：选择 ───
  if (phase === 'select') {
    const hasStem = allMistakes.filter(m => m.questionStem && m.correctAnswer).length
    const noStemCount = allMistakes.length - hasStem

    return (
      <div className="space-y-4 animate-fade-in pb-4">
        {/* 模块筛选 */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">模块</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setModuleFilter('')}
              className={cn('px-2.5 py-1 rounded-lg text-xs font-medium',
                !moduleFilter ? 'bg-purple-500 text-white' : 'bg-white text-slate-500 border border-slate-200')}
            >全部</button>
            {ALL_MODULES.map(m => {
              const count = moduleCounts[m]
              return (
                <button
                  key={m}
                  onClick={() => setModuleFilter(moduleFilter === m ? '' : m)}
                  className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border',
                    moduleFilter === m ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200')}
                  style={moduleFilter === m ? { backgroundColor: MODULE_COLORS[m] } : undefined}
                >
                  {MODULE_LABELS[m]}{count ? ` ${count}` : ''}
                </button>
              )
            })}
          </div>
        </div>

        {/* 题目类型 */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">题目类型</p>
          <div className="flex gap-1.5">
            {[
              { v: '', label: '全部' },
              { v: 'mistake', label: '错题' },
              { v: 'doubtful', label: '存疑' },
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => setQuestionType(questionType === opt.v ? '' : opt.v)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border',
                  questionType === opt.v ? 'bg-purple-500 text-white border-transparent' : 'bg-white text-slate-500 border-slate-200')}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        {/* 时间范围 */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">时间范围</p>
          <div className="flex gap-1.5">
            {[
              { v: '', label: '全部' },
              { v: '7', label: '近7天' },
              { v: '30', label: '近30天' },
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => setDateRange(dateRange === opt.v ? '' : opt.v)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border',
                  dateRange === opt.v ? 'bg-purple-500 text-white border-transparent' : 'bg-white text-slate-500 border-slate-200')}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        {/* 模式 */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">模式</p>
          <div className="flex gap-1.5">
            {[
              { v: 'practice' as const, label: '刷题模式', desc: '做完一题立刻看对错' },
              { v: 'exam' as const, label: '考试模式', desc: '全部做完才出结果' },
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => setMode(opt.v)}
                className={cn('flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border',
                  mode === opt.v ? 'bg-purple-500 text-white border-transparent' : 'bg-white text-slate-600 border-slate-200')}
              >
                <p>{opt.label}</p>
                <p className={cn('text-xs mt-0.5', mode === opt.v ? 'text-purple-100' : 'text-slate-400')}>{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 上限 */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">题目上限</p>
          <div className="flex gap-1.5">
            {[10, 20, 30].map(n => (
              <button
                key={n}
                onClick={() => setMaxQuestions(n)}
                className={cn('px-4 py-1.5 rounded-lg text-xs font-medium border',
                  maxQuestions === n ? 'bg-purple-500 text-white border-transparent' : 'bg-white text-slate-500 border-slate-200')}
              >{n} 道</button>
            ))}
          </div>
        </div>

        {/* 选项开关 */}
        <div className="space-y-1.5">
          <label className="flex items-center justify-between bg-white rounded-xl px-4 py-1.5 border border-slate-200">
            <span className="text-sm text-slate-700">包含已掌握的题</span>
            <button
              onClick={() => setIncludeMastered(!includeMastered)}
              className={cn('w-10 h-5 rounded-full transition-colors relative overflow-hidden shrink-0',
                includeMastered ? 'bg-purple-500' : 'bg-slate-300')}
            >
              <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all',
                includeMastered ? 'left-[18px]' : 'left-0.5')} />
            </button>
          </label>
          <label className="flex items-center justify-between bg-white rounded-xl px-4 py-1.5 border border-slate-200">
            <span className="text-sm text-slate-700 flex items-center gap-1.5">
              <Star size={14} className="text-amber-400" /> 仅收藏
            </span>
            <button
              onClick={() => setStarredOnly(!starredOnly)}
              className={cn('w-10 h-5 rounded-full transition-colors relative overflow-hidden shrink-0',
                starredOnly ? 'bg-purple-500' : 'bg-slate-300')}
            >
              <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all',
                starredOnly ? 'left-[18px]' : 'left-0.5')} />
            </button>
          </label>
        </div>

        {/* 统计 + 开始按钮 */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
          <p className="text-sm text-slate-600">
            匹配 <span className="font-semibold text-purple-600">{filtered.length}</span> 道题
            {noStemCount > 0 && (
              <span className="text-xs text-slate-400 ml-2">（{noStemCount} 道缺题干或答案已排除）</span>
            )}
          </p>
          <button
            onClick={startPractice}
            disabled={filtered.length === 0}
            className="w-full py-2.5 rounded-xl text-white text-sm font-medium bg-purple-500 disabled:opacity-40 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Play size={16} />
            {filtered.length === 0 ? '没有可练习的题目' : `随机抽取 ${Math.min(maxQuestions, filtered.length)} 道，开始练习`}
          </button>
        </div>
      </div>
    )
  }

  // ─── 阶段 2：练习 ───
  if (phase === 'practice' && questions.length > 0) {
    const q = questions[currentIdx]
    const isLast = currentIdx + 1 >= questions.length
    const latest = getLatest(q.id)
    const practiceCount = latest?.reviewCount ?? q.reviewCount ?? 0
    const wrongCount = latest?.practiceWrongCount ?? q.practiceWrongCount ?? 0
    const statsText = practiceCount > 0 ? `做错 ${wrongCount}/${practiceCount} 次` : ''
    const isStarred = starredSet.has(q.id)
    const isMastered = latest?.mastered ?? q.mastered

    const answeredCount = Object.keys(examAnswers).length + (selectedAnswer && !examAnswers[currentIdx] ? 1 : 0)
    const unansweredCount = questions.length - answeredCount
    const onLastQuestion = isLast

    return (
      <div className="space-y-4 animate-fade-in pb-4">
        {confirmDialog}

        {/* 顶部信息栏 */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span style={{ color: MODULE_COLORS[q.module] }}>{MODULE_LABELS[q.module]}</span>
          <span>{currentIdx + 1} / {questions.length}</span>
        </div>

        {/* 题目卡片 */}
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap mb-4">{q.questionStem}</p>

          {/* 选项按钮 */}
          <div className="space-y-2">
            {LETTERS.map(ch => {
              const isSelected = selectedAnswer === ch
              const isCorrect = showFeedback && ch === q.correctAnswer?.trim()
              const isWrong = showFeedback && isSelected && ch !== q.correctAnswer?.trim()
              const disabled = showFeedback
              return (
                <button
                  key={ch}
                  onClick={() => !disabled && setSelectedAnswer(ch === selectedAnswer ? '' : ch)}
                  disabled={disabled}
                  className={cn('w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all',
                    isCorrect ? 'bg-green-50 border-green-300 text-green-700' :
                    isWrong ? 'bg-red-50 border-red-300 text-red-700' :
                    isSelected ? 'bg-purple-50 border-purple-300 text-purple-700' :
                    'bg-white border-slate-200 text-slate-600 active:bg-slate-50')}
                >
                  <span className="font-medium">{ch}</span>
                </button>
              )
            })}
          </div>

          {/* 刷题模式：答题反馈 */}
          {showFeedback && mode === 'practice' && (
            <div className={cn('mt-4 p-3 rounded-lg', results[results.length - 1]?.correct ? 'bg-green-50' : 'bg-red-50')}>
              <div className="flex items-center gap-2 mb-1">
                {results[results.length - 1]?.correct
                  ? <CheckCircle2 size={16} className="text-green-500" />
                  : <XCircle size={16} className="text-red-500" />
                }
                <span className={results[results.length - 1]?.correct ? 'text-green-600 text-xs font-medium' : 'text-red-600 text-xs font-medium'}>
                  {results[results.length - 1]?.correct ? '正确' : '错误'} · 正确答案 {q.correctAnswer}
                </span>
              </div>
              {q.quickDiagnosis?.rootCause && (
                <p className="text-xs text-slate-600 mt-1">{q.quickDiagnosis.rootCause}</p>
              )}
              {q.quickDiagnosis?.solution && (
                <p className="text-xs text-slate-500 mt-0.5">{q.quickDiagnosis.solution}</p>
              )}
            </div>
          )}
        </div>

        {/* 刷题模式操作 */}
        {mode === 'practice' ? (
          <>
            {showFeedback && (
              <div className="flex gap-2">
                <button
                  onClick={() => toggleStar(q.id)}
                  className={cn('flex-1 py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1',
                    isStarred ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-white border-slate-200 text-slate-500')}
                >
                  <Star size={14} fill={isStarred ? 'currentColor' : 'none'} /> {isStarred ? '已收藏' : '收藏'}
                </button>
                <button
                  onClick={() => markMastered(q.id)}
                  disabled={isMastered}
                  className={cn('flex-1 py-2 rounded-xl text-xs font-medium border',
                    isMastered ? 'bg-green-50 border-green-200 text-green-500' : 'bg-white border-slate-200 text-slate-500')}
                >
                  {isMastered ? '已掌握' : '标记已掌握'}
                </button>
              </div>
            )}
            {statsText && <p className="text-center text-xs text-slate-400">{statsText}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmType('exit')}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 bg-white"
              >退出</button>
              {showFeedback ? (
                <button onClick={nextQuestion}
                  className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-medium">
                  {isLast ? '完成' : '下一题'}
                </button>
              ) : (
                <button onClick={submitAnswer} disabled={!selectedAnswer}
                  className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-medium disabled:opacity-40">
                  确认
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* 考试模式操作 */}
            <div className="flex gap-2">
              <button
                onClick={() => goToQuestion(currentIdx - 1)}
                disabled={currentIdx === 0}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 bg-white disabled:opacity-30"
              >上一题</button>
              <button
                onClick={() => goToQuestion(currentIdx + 1)}
                disabled={onLastQuestion}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 bg-white disabled:opacity-30"
              >下一题</button>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-slate-400">已答 {answeredCount}/{questions.length}</span>
              {unansweredCount > 0 && (
                <span className="text-xs text-amber-500">{unansweredCount} 题未答</span>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setConfirmType('submit')}
                className="py-2 px-5 rounded-xl bg-purple-500 text-white text-sm font-medium"
              >交卷</button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ─── 阶段 3：结果 ───
  if (phase === 'result' && questions.length > 0) {
    const correctCount = results.filter(r => r.correct).length
    const totalMs = results.reduce((sum, r) => sum + (r.timeMs || 0), 0)
    const timesMs = results.map(r => r.timeMs || 0).filter(t => t > 0)
    const avgMs = timesMs.length > 0 ? totalMs / timesMs.length : 0
    const minMs = timesMs.length > 0 ? Math.min(...timesMs) : 0
    const maxMs = timesMs.length > 0 ? Math.max(...timesMs) : 0

    return (
      <div className="space-y-4 animate-fade-in pb-4">
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-purple-50 flex items-center justify-center">
            <Target size={32} className="text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-purple-600 mb-1">{correctCount}/{results.length}</p>
          <p className="text-sm text-slate-500">{results.length > 0 ? `${Math.round(correctCount / results.length * 100)}% 正确率` : ''}</p>
          {totalMs > 0 && (
            <div className="flex items-center justify-center gap-3 mt-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Clock size={12} /> 总耗时 {formatTime(totalMs)}</span>
              <span>平均 {formatTimeShort(avgMs)}/题</span>
            </div>
          )}
          {minMs > 0 && maxMs > 0 && (
            <p className="text-xs text-slate-400 mt-1">最快 {formatTimeShort(minMs)} · 最慢 {formatTimeShort(maxMs)}</p>
          )}
        </div>

        <button
          onClick={markAllCorrectMastered}
          className="w-full py-2.5 rounded-xl border border-green-300 text-sm font-medium text-green-600 bg-green-50 active:bg-green-100"
        >
          ✓ 将所有做对的标记为已掌握
        </button>

        <div className="flex gap-2">
          <button onClick={enterReview}
            className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-medium">
            查看回顾
          </button>
          <button onClick={() => { setPhase('select'); setQuestions([]); setResults([]) }}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 bg-white">
            再来一轮
          </button>
        </div>
        <button onClick={() => navigate('/')}
          className="w-full py-2 text-xs text-slate-400 underline">返回首页</button>
      </div>
    )
  }

  // ─── 阶段 4：回顾 ───
  if (phase === 'review' && questions.length > 0) {
    const displayItems = results.map((r, i) => {
      const q = questions[i]
      const latest = getLatest(q.id)
      return { result: r, question: q, latest, index: i }
    }).filter(item => {
      if (reviewFilter === 'wrong' && item.result.correct) return false
      return true
    })

    const correctCount = results.filter(r => r.correct).length
    const totalMs = results.reduce((s, r) => s + (r.timeMs || 0), 0)

    return (
      <div className="space-y-3 animate-fade-in pb-4">
        {/* 统计概览 */}
        <div className="flex items-center gap-3 text-xs text-slate-500 bg-white rounded-xl px-4 py-2.5 border border-slate-100">
          <span>🎯 {correctCount}/{results.length} 正确</span>
          {totalMs > 0 && (
            <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(totalMs)}</span>
          )}
        </div>

        {/* 筛选 */}
        <div className="flex gap-1.5">
          {[
            { v: 'all' as const, label: `全部(${results.length})` },
            { v: 'wrong' as const, label: `仅错题(${results.filter(r => !r.correct).length})` },
          ].map(opt => (
            <button
              key={opt.v}
              onClick={() => setReviewFilter(opt.v)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border',
                reviewFilter === opt.v ? 'bg-purple-500 text-white border-transparent' : 'bg-white text-slate-500 border-slate-200')}
            >{opt.label}</button>
          ))}
        </div>

        {/* 题目列表 */}
        <div className="space-y-2">
          {displayItems.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">没有要回顾的题目</p>
          ) : (
            displayItems.map(({ result: r, question: q, latest, index }) => {
              const isExpanded = expandedSet.has(index)
              const isStarred = starredSet.has(q.id)
              const isMastered = latest?.mastered ?? q.mastered
              const practiceCount = latest?.reviewCount ?? q.reviewCount ?? 0
              const wrongCount = latest?.practiceWrongCount ?? q.practiceWrongCount ?? 0

              return (
                <div key={index}
                  className={cn('bg-white rounded-xl border shadow-sm overflow-hidden',
                    r.correct ? 'border-slate-100' : 'border-red-200')}
                >
                  {/* 折叠行 */}
                  <button
                    onClick={() => toggleExpand(index)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
                  >
                    {r.correct
                      ? <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                      : <XCircle size={16} className="text-red-400 shrink-0" />
                    }
                    <span className="text-xs font-medium shrink-0" style={{ color: MODULE_COLORS[q.module] }}>
                      {MODULE_LABELS[q.module]}
                    </span>
                    <span className="text-xs text-slate-500 truncate flex-1">
                      {q.questionStem?.slice(0, 40)}{(q.questionStem?.length ?? 0) > 40 ? '...' : ''}
                    </span>
                    {r.timeMs > 0 && (
                      <span className="text-xs text-slate-400 shrink-0">{formatTimeShort(r.timeMs)}</span>
                    )}
                    {isExpanded
                      ? <ChevronDown size={14} className="text-slate-300 shrink-0" />
                      : <ChevronRight size={14} className="text-slate-300 shrink-0" />
                    }
                  </button>

                  {/* 展开内容 */}
                  {isExpanded && (
                    <div className="px-4 pb-3 space-y-2 border-t border-slate-50 pt-3">
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{q.questionStem}</p>
                      <div className={cn('text-xs', r.correct ? 'text-green-600' : 'text-red-600')}>
                        你的答案：{r.userAnswer || '未作答'} → 正确答案：{q.correctAnswer}
                        {r.timeMs > 0 && <span className="text-slate-400 ml-2">用时 {formatTimeShort(r.timeMs)}</span>}
                      </div>
                      {q.quickDiagnosis?.rootCause && (
                        <p className="text-xs text-slate-500">解析：{q.quickDiagnosis.rootCause}</p>
                      )}
                      {q.quickDiagnosis?.solution && (
                        <p className="text-xs text-slate-400">{q.quickDiagnosis.solution}</p>
                      )}
                      {practiceCount > 0 && (
                        <p className="text-xs text-slate-400">练习统计：做错 {wrongCount}/{practiceCount} 次</p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => toggleStar(q.id)}
                          className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1',
                            isStarred ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-white border-slate-200 text-slate-500')}
                        >
                          <Star size={12} fill={isStarred ? 'currentColor' : 'none'} /> {isStarred ? '已收藏' : '收藏'}
                        </button>
                        <button
                          onClick={() => markMastered(q.id)}
                          disabled={isMastered}
                          className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium border',
                            isMastered ? 'bg-green-50 border-green-200 text-green-500' : 'bg-white border-slate-200 text-slate-500')}
                        >{isMastered ? '已掌握' : '标记已掌握'}</button>
                        <button
                          onClick={() => {
                            navigate(`/mistakes/${q.id}`)
                          }}
                          className="py-1.5 px-3 rounded-lg text-xs font-medium border border-slate-200 text-slate-500 bg-white"
                        >详情</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* 底部 */}
        <div className="flex gap-2">
          <button onClick={() => { setPhase('select'); setQuestions([]); setResults([]) }}
            className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-medium">
            再来一轮
          </button>
        </div>
      </div>
    )
  }

  // 兜底：状态异常时显示恢复按钮而不是白屏
  return (
    <div className="text-center py-16 animate-fade-in">
      <p className="text-slate-400 text-sm mb-1">页面状态异常</p>
      <p className="text-xs text-slate-400 mb-4">phase={phase} q={questions.length} r={results.length}</p>
      <button
        onClick={() => { clearReviewCache(); setPhase('select'); setQuestions([]); setResults([]) }}
        className="px-5 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium"
      >返回练习首页</button>
    </div>
  )
}
