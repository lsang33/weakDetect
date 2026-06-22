import { useState } from 'react'
import { RefreshCw, Brain, CheckCircle2, XCircle } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { moduleAnalysisRepository, practiceRepository } from '../db'
import { generatePractice } from '../services/moduleAnalysisService'
import { MODULE_LABELS, MODULE_COLORS, ExamModule } from '../lib/constants'
import type { PracticeSession } from '../models/analytics'
import { formatDate } from '../lib/dateUtils'
import { cn } from '../lib/cn'

type Phase = 'list' | 'practice' | 'result'

export function ReviewPlanPage() {
  const analyses = useLiveQuery(() => moduleAnalysisRepository.getAll(), []) ?? []
  const sessions = useLiveQuery(() => practiceRepository.getAll(), []) ?? []
  const [phase, setPhase] = useState<Phase>('list')
  const [currentSession, setCurrentSession] = useState<{
    module: string; pattern: string; questions: any[]; sessionId?: string
  } | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState('')
  const [answered, setAnswered] = useState(false)
  const [results, setResults] = useState<{ correct: boolean; userAnswer: string }[]>([])
  const [generating, setGenerating] = useState('')

  // 从分析结果中提取可用练习
  const practiceItems = analyses.filter(a => a.patterns?.length > 0).flatMap(a => {
    const existing = sessions.filter((s: any) => s.module === a.module)
    return (a.patterns || []).map((p: any) => {
      const prev = existing.find((s: any) => s.pattern === p.pattern)
      return {
        module: a.module,
        pattern: p.pattern,
        questions: p.relatedMistakeIds?.length || 0,
        prevSession: prev,
      }
    })
  })

  async function startPractice(item: typeof practiceItems[0]) {
    setGenerating(item.pattern)
    const apiKey = localStorage.getItem('deepseek_key')
    if (!apiKey || item.questions < 3) { setGenerating(''); return }
    try {
      const dsModel = localStorage.getItem('ds_model') || 'reasoner'
      const dsModelName = dsModel === 'chat' ? 'deepseek-chat' : 'deepseek-reasoner'
      const label = MODULE_LABELS[item.module as unknown as ExamModule] || item.module
      const questions = await generatePractice(label, { pattern: item.pattern, cause: item.pattern }, apiKey, dsModelName)
      if (questions.length === 0) { setGenerating(''); return }
      const id = await practiceRepository.create({
        module: item.module, pattern: item.pattern, questions, createdAt: new Date(),
      })
      setCurrentSession({ module: item.module, pattern: item.pattern, questions, sessionId: id })
      setCurrentIdx(0); setSelected(''); setAnswered(false); setResults([])
      setPhase('practice')
    } catch { /* fallback: 使用旧数据 */ }
    setGenerating('')
  }

  function submitAnswer() {
    if (!selected || !currentSession) return
    const correct = selected === currentSession.questions[currentIdx].correctAnswer
    setResults(prev => [...prev, { correct, userAnswer: selected }])
    setAnswered(true)
  }

  async function nextQuestion() {
    if (!currentSession) return
    if (currentIdx + 1 >= currentSession.questions.length) {
      // 练习完成
      if (currentSession.sessionId) {
        await practiceRepository.update(currentSession.sessionId, {
          completedAt: new Date(),
          results: results.map((r, i) => ({
            questionIndex: i, userAnswer: r.userAnswer,
            correct: r.correct,
          })),
        })
      }
      setPhase('result')
      return
    }
    setCurrentIdx(i => i + 1)
    setSelected('')
    setAnswered(false)
  }

  // 列表模式
  if (phase === 'list') {
    return (
      <div className="space-y-4 animate-fade-in pb-4">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">复习</h2>
        {practiceItems.length === 0 ? (
          <div className="text-center py-16">
            <Brain size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">暂无弱点分析，先去「分析」页跑一次综合分析</p>
          </div>
        ) : (
          <div className="space-y-2">
            {practiceItems.map((item, i) => {
              const label = MODULE_LABELS[item.module as unknown as ExamModule] || item.module
              return (
                <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded text-white" style={{ backgroundColor: MODULE_COLORS[item.module as unknown as ExamModule] || '#6B7280' }}>
                      {label}
                    </span>
                    <span className="text-xs text-slate-400">{item.questions}道相关题</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{item.pattern}</p>
                  {item.prevSession?.completedAt && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      上次练习：{formatDate(item.prevSession.completedAt)}
                      {item.prevSession.results && item.prevSession.results.length > 0 && (
                        <> · 正确率 {Math.round(item.prevSession.results.filter((r: any) => r.correct).length / item.prevSession.results.length * 100)}%</>
                      )}
                    </p>
                  )}
                  <button onClick={() => startPractice(item)} disabled={generating === item.pattern}
                    className="mt-2 px-4 py-1.5 rounded-lg bg-purple-500 text-white text-xs font-medium disabled:opacity-50">
                    {generating === item.pattern ? <RefreshCw size={12} className="inline animate-spin mr-1" /> : null}
                    {generating === item.pattern ? '生成中...' : '开始练习'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // 练习模式
  if (phase === 'practice' && currentSession) {
    const q = currentSession.questions[currentIdx]
    return (
      <div className="space-y-4 animate-fade-in pb-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{currentSession.pattern}</span>
          <span>{currentIdx + 1}/{currentSession.questions.length}</span>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-800 leading-relaxed mb-4">{q.stem}</p>
          <div className="space-y-2">
            {q.options.map((opt: string, i: number) => {
              const letter = String.fromCharCode(65 + i)
              const isSelected = selected === letter
              const isCorrect = answered && letter === q.correctAnswer
              const isWrong = answered && isSelected && !isCorrect
              return (
                <button key={i} onClick={() => !answered && setSelected(letter)}
                  disabled={answered}
                  className={cn('w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all',
                    answered && letter === q.correctAnswer ? 'bg-green-50 border-green-300 text-green-700' :
                    isWrong ? 'bg-red-50 border-red-300 text-red-700' :
                    isSelected ? 'bg-purple-50 border-purple-300 text-purple-700' :
                    'bg-white border-slate-200 text-slate-600 hover:border-slate-300')}>
                  {opt}
                </button>
              )
            })}
          </div>
          {answered && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-600">{q.explanation}</p>
              <div className="flex items-center gap-2 mt-2">
                {results[results.length - 1]?.correct ? (
                  <CheckCircle2 size={16} className="text-green-500" />
                ) : (
                  <XCircle size={16} className="text-red-500" />
                )}
                <span className={results[results.length - 1]?.correct ? 'text-green-600' : 'text-red-600'}>
                  {results[results.length - 1]?.correct ? '正确！' : `错误，正确答案是 ${q.correctAnswer}`}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setPhase('list'); setCurrentSession(null) }}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500">返回</button>
          {answered ? (
            <button onClick={nextQuestion}
              className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-medium">
              {currentIdx + 1 >= currentSession.questions.length ? '完成' : '下一题'}
            </button>
          ) : (
            <button onClick={submitAnswer} disabled={!selected}
              className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-medium disabled:opacity-40">确认</button>
          )}
        </div>
      </div>
    )
  }

  // 结果页
  if (phase === 'result') {
    const correctCount = results.filter(r => r.correct).length
    return (
      <div className="text-center py-8 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-50 flex items-center justify-center">
          <Brain size={32} className="text-purple-500" />
        </div>
        <p className="text-lg font-semibold text-slate-800 mb-1">练习完成</p>
        <p className="text-sm text-slate-500 mb-2">{currentSession?.pattern}</p>
        <p className="text-3xl font-bold text-purple-600 mb-1">{correctCount}/{results.length}</p>
        <p className="text-sm text-slate-500 mb-6">
          {results.length > 0 ? `${Math.round(correctCount / results.length * 100)}% 正确率` : ''}
        </p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => {
            if (currentSession) startPractice({ module: currentSession.module, pattern: currentSession.pattern, questions: 5, prevSession: undefined })
          }} className="px-5 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium">重新练习</button>
          <button onClick={() => { setPhase('list'); setCurrentSession(null) }}
            className="px-5 py-2 rounded-xl border border-slate-200 text-sm text-slate-500">返回列表</button>
        </div>
      </div>
    )
  }

  return null
}
