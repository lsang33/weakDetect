import { useState } from 'react'
import { RefreshCw, Brain, CheckCircle2, XCircle } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { moduleAnalysisRepository, practiceRepository } from '../db'
import { generatePractice } from '../services/moduleAnalysisService'
import { useMistakes } from '../hooks/useMistakes'
import { MODULE_LABELS, MODULE_COLORS, ExamModule } from '../lib/constants'
import { formatDate } from '../lib/dateUtils'
import { cn } from '../lib/cn'

type Phase = 'list' | 'chooseMode' | 'practice' | 'result'

export function ReviewPlanPage() {
  const analyses = (useLiveQuery(() => moduleAnalysisRepository.getAll(), []) ?? []) as any[]
  const sessions = (useLiveQuery(() => practiceRepository.getAll(), []) ?? []) as any[]
  const allMistakes = useMistakes()
  const [phase, setPhase] = useState<Phase>('list')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  // practice state
  const [questions, setQuestions] = useState<any[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState('')
  const [answered, setAnswered] = useState(false)
  const [results, setResults] = useState<{ correct: boolean; userAnswer: string; isMisMatch?: boolean }[]>([])
  const [generating, setGenerating] = useState('')

  // 从分析结果中提取可用练习，按 severity 排序
  const practiceItems = analyses.filter((a: any) => a.patterns?.length > 0).flatMap((a: any) => {
    const existing = (sessions as any[]).filter((s: any) => s.module === a.module)
    return (a.patterns || []).map((p: any) => {
      const prev = existing.find((s: any) => s.pattern === (p as any).pattern)
      // 该模式关联的错题
      const relatedMistakes = (p.relatedMistakeIds || []).map((qid: string) => {
        const idx = parseInt(qid.replace('#', '')) - 1
        // 需要找到对应模块的错题列表...简化：用 allMistakes 按 module 过滤
        return null
      }).filter(Boolean)
      const sev = (p as any).severity || 'low'
      return { module: a.module, pattern: p, severity: sev, prevSession: prev, relatedMistakeIds: p.relatedMistakeIds || [] }
    })
  }).sort((a: any, b: any) => {
    const w: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return (w[a.severity] ?? 2) - (w[b.severity] ?? 2)
  })

  // 该模块的错题（有原文的）
  function getModuleMistakes(module: string) {
    return allMistakes.filter(m => m.module === module && m.questionStem)
  }

  async function startPractice(item: any, mode: 'existing' | 'mistakes' | 'mixed' | 'new') {
    setGenerating(item.pattern.pattern)
    const apiKey = localStorage.getItem('deepseek_key')
    if (!apiKey) { setGenerating(''); return }

    let qs: any[] = []

    if (mode === 'mistakes' || mode === 'mixed') {
      // 从错题中取相关题（按索引取该模块的错题）
      const moduleMistakes = getModuleMistakes(item.module)
      const related = item.relatedMistakeIds
        .map((qid: string) => {
          const idx = parseInt(qid.replace('#', '')) - 1
          return moduleMistakes[idx]
        })
        .filter(Boolean)
      qs = related.map((m: any) => ({
        stem: m.questionStem,
        options: [],
        correctAnswer: m.correctAnswer || '?',
        explanation: m.quickDiagnosis?.rootCause || '重做错题',
        isMistake: true,
        mistakeId: m.id,
      }))
    }

    if (mode === 'existing') {
      const prevSession = item.prevSession
      if (prevSession?.questions) qs = prevSession.questions.map((q: any) => ({ ...q }))
    }

    if (mode === 'new' || (mode === 'mixed' && qs.length < 5)) {
      try {
        const dsModel = localStorage.getItem('ds_model') || 'reasoner'
        const dsModelName = dsModel === 'chat' ? 'deepseek-chat' : 'deepseek-reasoner'
        const label = MODULE_LABELS[item.module as unknown as ExamModule] || item.module
        // 获取参考错题原文
        const moduleMistakes = getModuleMistakes(item.module)
        const stems = item.relatedMistakeIds
          .map((qid: string) => { const m = moduleMistakes[parseInt(qid.replace('#', '')) - 1]; return m?.questionStem || '' })
          .filter(Boolean)
        const newQs = await generatePractice(label, item.pattern, stems, apiKey, dsModelName)
        qs = qs.concat(newQs.map((q: any) => ({ ...q, isAi: true })))
        // 保存到数据库
        if (newQs.length > 0) {
          await practiceRepository.create({
            module: item.module, pattern: item.pattern.pattern, questions: newQs, createdAt: new Date(),
          })
        }
      } catch (e) { console.error('出题失败', e) }
    }

    if (qs.length === 0) { setGenerating(''); return }
    // 确保每道题有 options 数组
    qs = qs.map(q => ({ ...q, options: q.options || [] }))
    setQuestions(qs)
    setCurrentIdx(0); setSelected(''); setAnswered(false); setResults([])
    setSelectedItem(item)
    setPhase('practice')
  }

  function submitAnswer() {
    if (!selected || !questions[currentIdx]) return
    const q = questions[currentIdx]
    const correct = q.isMistake ? selected === q.correctAnswer : selected === (q as any).correctAnswer
    setResults(prev => [...prev, { correct, userAnswer: selected }])
    setAnswered(true)
  }

  function nextQuestion() {
    if (currentIdx + 1 >= questions.length) { setPhase('result'); return }
    setCurrentIdx(i => i + 1)
    setSelected('')
    setAnswered(false)
  }

  // 列表
  if (phase === 'list') {
    return (
      <div className="space-y-3 animate-fade-in pb-4">
        {practiceItems.length === 0 ? (
          <div className="text-center py-16">
            <Brain size={36} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">暂无弱点分析，先去「分析」页跑一次综合分析</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {practiceItems.map((item: any, i: number) => {
              const label = MODULE_LABELS[item.module as unknown as ExamModule] || item.module
              return (
                <div key={i} className="bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm flex items-center gap-3">
                  <span className="text-xs font-medium px-2 py-0.5 rounded text-white shrink-0" style={{ backgroundColor: MODULE_COLORS[item.module as unknown as ExamModule] || '#6B7280' }}>
                    {label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 line-clamp-2">{item.pattern.pattern}</p>
                    {item.prevSession?.completedAt && (
                      <p className="text-xs text-slate-400">
                        上次 {formatDate(item.prevSession.completedAt)}
                        {item.prevSession.results?.length > 0 && ` · ${Math.round(item.prevSession.results.filter((r: any) => r.correct).length / item.prevSession.results.length * 100)}%`}
                      </p>
                    )}
                  </div>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full shrink-0',
                    item.severity === 'high' ? 'bg-red-100 text-red-600' :
                    item.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500')}>
                    {item.severity === 'high' ? '重点' : item.severity === 'medium' ? '中等' : '一般'}
                  </span>
                  <button onClick={() => { setSelectedItem(item); setPhase('chooseMode') }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-purple-500 text-white font-medium shrink-0">练习</button>
                </div>
              )
            })}
          </div>
        )}
        {/* 历史记录 */}
        {sessions.length > 0 && (
          <details className="bg-white rounded-xl border border-slate-200 mt-4">
            <summary className="px-4 py-2.5 text-xs text-slate-500 cursor-pointer">练习记录 ({sessions.length})</summary>
            <div className="px-4 pb-3 space-y-1">
              {sessions.slice(0, 10).map((s: any) => (
                <p key={s.id} className="text-[10px] text-slate-400">{formatDate(s.createdAt)} · {s.pattern?.slice(0, 30)} · {s.questions?.length}道</p>
              ))}
            </div>
          </details>
        )}
      </div>
    )
  }

  // 选择模式
  if (phase === 'chooseMode' && selectedItem) {
    const moduleMistakes = getModuleMistakes(selectedItem.module)
    const related = selectedItem.relatedMistakeIds.map((qid: string) => moduleMistakes[parseInt(qid.replace('#', '')) - 1]).filter(Boolean)
    const prevQs = selectedItem.prevSession?.questions?.length || 0
    return (
      <div className="space-y-3 animate-fade-in">
        <button onClick={() => setPhase('list')} className="text-xs text-purple-500 underline">← 返回列表</button>
        <p className="text-sm font-medium text-slate-800">{selectedItem.pattern.pattern}</p>
        <div className="space-y-2">
          {[
            { key: 'existing', label: '已有 AI 出题', desc: `${prevQs} 道题`, disabled: prevQs === 0 },
            { key: 'mistakes', label: '重做相关错题', desc: `${related.length} 道题`, disabled: related.length === 0 },
            { key: 'mixed', label: '混合练习', desc: '错题 + AI 题', disabled: related.length === 0 },
            { key: 'new', label: '全新出题', desc: 'AI 生成 5 道新题',
              loading: generating === selectedItem.pattern.pattern },
          ].map(opt => (
            <button key={opt.key} disabled={(opt as any).disabled || generating === selectedItem.pattern.pattern}
              onClick={() => startPractice(selectedItem, opt.key as any)}
              className={cn('w-full bg-white rounded-xl p-4 border border-slate-200 text-left transition-all',
                (opt as any).disabled ? 'opacity-40' : 'hover:border-purple-300')}>
              <p className="text-sm font-medium text-slate-800">{opt.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // 练习
  if (phase === 'practice' && questions.length > 0) {
    const q = questions[currentIdx]
    const isLast = currentIdx + 1 >= questions.length
    return (
      <div className="space-y-4 animate-fade-in pb-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{selectedItem?.pattern.pattern}</span>
          <span>{currentIdx + 1}/{questions.length}</span>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap mb-4">{q.stem}</p>
          {q.options?.length > 0 ? (
            <div className="space-y-2">
              {q.options.map((opt: string, i: number) => {
                const letter = String.fromCharCode(65 + i)
                const isSelected = selected === letter
                const isCorrect = answered && letter === q.correctAnswer
                const isWrong = answered && isSelected && !isCorrect
                return (
                  <button key={i} onClick={() => !answered && setSelected(letter)} disabled={answered}
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
          ) : (
            <div className="flex gap-3">
              {['A','B','C','D'].map(ch => (
                <button key={ch} onClick={() => !answered && setSelected(ch)} disabled={answered}
                  className={cn('px-4 py-2 rounded-lg border text-sm font-medium',
                    answered && ch === q.correctAnswer ? 'bg-green-50 border-green-300 text-green-700' :
                    answered && selected === ch ? 'bg-red-50 border-red-300 text-red-700' :
                    selected === ch ? 'bg-purple-50 border-purple-300 text-purple-700' :
                    'bg-white border-slate-200 text-slate-500')}>{ch}</button>
              ))}
            </div>
          )}
          {answered && (
            <div className={cn('mt-4 p-3 rounded-lg', results[results.length-1]?.correct ? 'bg-green-50' : 'bg-red-50')}>
              <div className="flex items-center gap-2 mb-1">
                {results[results.length-1]?.correct ? <CheckCircle2 size={16} className="text-green-500" /> : <XCircle size={16} className="text-red-500" />}
                <span className={results[results.length-1]?.correct ? 'text-green-600 text-xs font-medium' : 'text-red-600 text-xs font-medium'}>
                  正确答案 {q.correctAnswer}
                </span>
              </div>
              <p className="text-xs text-slate-600">{q.explanation}</p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setPhase('list'); setSelectedItem(null); setQuestions([]) }}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500">退出</button>
          {answered ? (
            <button onClick={nextQuestion}
              className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-medium">
              {isLast ? '完成' : '下一题'}
            </button>
          ) : (
            <button onClick={submitAnswer} disabled={!selected}
              className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-medium disabled:opacity-40">确认</button>
          )}
        </div>
      </div>
    )
  }

  // 结果
  if (phase === 'result') {
    const correctCount = results.filter(r => r.correct).length
    return (
      <div className="text-center py-8 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-50 flex items-center justify-center">
          <Brain size={32} className="text-purple-500" />
        </div>
        <p className="text-lg font-semibold text-slate-800 mb-1">练习完成</p>
        <p className="text-sm text-slate-500 mb-2">{selectedItem?.pattern.pattern}</p>
        <p className="text-3xl font-bold text-purple-600 mb-1">{correctCount}/{results.length}</p>
        <p className="text-sm text-slate-500 mb-6">{results.length > 0 ? `${Math.round(correctCount / results.length * 100)}% 正确率` : ''}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => { setPhase('chooseMode'); setQuestions([]) }}
            className="px-5 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium">继续练习</button>
          <button onClick={() => { setPhase('list'); setSelectedItem(null); setQuestions([]); setResults([]) }}
            className="px-5 py-2 rounded-xl border border-slate-200 text-sm text-slate-500">返回列表</button>
        </div>
      </div>
    )
  }

  return null
}
