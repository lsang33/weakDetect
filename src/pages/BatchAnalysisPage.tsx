import React, { useState, useMemo } from 'react'
import { BarChart3, RefreshCw, ChevronDown, ChevronUp, Brain, Clock } from 'lucide-react'
import { useMistakes } from '../hooks/useMistakes'
import { useLiveQuery } from 'dexie-react-hooks'
import { analyzeModule } from '../services/moduleAnalysisService'
import { moduleAnalysisRepository } from '../db'
import { ExamModule, MODULE_LABELS, MODULE_COLORS } from '../lib/constants'
import { formatDate } from '../lib/dateUtils'
import { cn } from '../lib/cn'

const ALL_MODULES = Object.values(ExamModule) as ExamModule[]

/** 题目弹窗 */
function QuestionPopup({ mistake, onClose }: { mistake: any; onClose: () => void }) {
  if (!mistake) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-h-[80vh] overflow-y-auto w-full max-w-lg p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <p className="text-xs text-slate-400 mb-2">{mistake.id?.slice(0, 8)}</p>
        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed mb-4">{mistake.questionStem}</p>
        <div className="flex gap-4 mb-3 text-sm">
          {mistake.correctAnswer && <div><span className="text-xs text-slate-400">正确答案</span><p className="font-semibold text-green-600">{mistake.correctAnswer}</p></div>}
          {mistake.myAnswer && <div><span className="text-xs text-slate-400">你的答案</span><p className="font-semibold text-red-500">{mistake.myAnswer}</p></div>}
        </div>
        {mistake.quickDiagnosis?.rootCause && <p className="text-xs text-purple-600"><span className="text-slate-400">错因：</span>{mistake.quickDiagnosis.rootCause}</p>}
        <button onClick={onClose} className="mt-4 w-full py-2 rounded-lg bg-slate-100 text-sm text-slate-600">关闭</button>
      </div>
    </div>
  )
}

function ModuleCard({ module, label, color, count, analyzed, mistakes }: {
  module: string; label: string; color: string; count: number
  analyzed: { summary: string; patterns: any[]; perQuestionAnalysis: Record<string, string> } | null
  mistakes: any[]
}) {
  const [analyzing, setAnalyzing] = useState(false)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState(analyzed)
  const [error, setError] = useState('')
  const [popupMistake, setPopupMistake] = useState<any>(null)

  function getMistake(qid: string) {
    const idx = parseInt(qid.replace('#', '')) - 1
    return mistakes[idx]
  }

  async function handleAnalyze() {
    const apiKey = localStorage.getItem('deepseek_key')
    if (!apiKey) { setError('请先设置 DeepSeek API Key'); return }
    setAnalyzing(true)
    setError('')
    try {
      const dsModel = localStorage.getItem('ds_model') || 'reasoner'
      const dsModelName = dsModel === 'chat' ? 'deepseek-chat' : 'deepseek-reasoner'
      const mistakes = useMistakesCache()
      const moduleMistakes = mistakes.filter(m => m.module === module && m.questionStem)
      const res = await analyzeModule(moduleMistakes, label, apiKey, dsModelName)
      await moduleAnalysisRepository.create({ module, createdAt: new Date(), ...res })
      setResult(res)
    } catch (e: any) { setError(e.message || '分析失败') }
    setAnalyzing(false)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium px-2 py-1 rounded text-white shrink-0" style={{ backgroundColor: color }}>{label}</span>
          <span className="text-sm text-slate-500">{count}道</span>
        </div>
        <div className="flex items-center gap-2">
          {result && <button onClick={() => setOpen(!open)} className="text-xs text-purple-500 underline">{open ? '收起' : '查看分析'}</button>}
          <button onClick={handleAnalyze} disabled={analyzing}
            className="text-xs px-3 py-1.5 rounded-lg bg-purple-500 text-white font-medium disabled:opacity-50">
            {analyzing ? <RefreshCw size={12} className="inline animate-spin" /> : result ? '重新分析' : '分析'}
          </button>
        </div>
      </div>

      {popupMistake && <QuestionPopup mistake={popupMistake} onClose={() => setPopupMistake(null)} />}
      {analyzing && <p className="px-4 pb-3 text-xs text-purple-400 animate-pulse">分析中...</p>}
      {error && <p className="px-4 pb-3 text-xs text-red-500">{error}</p>}

      {open && result && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3 animate-fade-in">
          <p className="text-sm text-slate-700">{result.summary}</p>
          {result.patterns.map((p, i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-medium text-slate-800">{i + 1}. {p.pattern}（{p.relatedMistakeIds.length}道）</p>
              <p className="text-xs text-slate-600">{p.cause}</p>
              <div className="flex flex-wrap gap-1">{p.relatedMistakeIds.map((qid: string) => {
                const m = getMistake(qid)
                return <button key={qid} onClick={() => m && setPopupMistake(m)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-500 hover:bg-purple-50 hover:text-purple-600 cursor-pointer">{qid}</button>
              })}</div>
              {p.suggestion && <p className="text-xs text-blue-600">→ {p.suggestion}</p>}
            </div>
          ))}
          {Object.keys(result.perQuestionAnalysis).length > 0 && (
            <details>
              <summary className="text-xs text-slate-400 cursor-pointer">逐题分析 ({Object.keys(result.perQuestionAnalysis).length})</summary>
              <div className="mt-2 space-y-1">
                {Object.entries(result.perQuestionAnalysis).map(([qid, txt]) => {
                  const m = getMistake(qid)
                  return <button key={qid} onClick={() => m && setPopupMistake(m)}
                    className="block w-full text-left text-xs text-slate-500 hover:bg-slate-100 rounded p-1 -mx-1">
                    <span className="text-slate-400">{qid}</span>
                    {m && <span className="text-purple-400"> [{m.knowledgePoint || m.subCategory}] </span>}
                    {txt}
                  </button>
                })}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// 缓存 mistakes 供 ModuleCard 内使用
let _cache: any[] = []
export function BatchAnalysisPage() {
  const mistakes = useMistakes()
  _cache = mistakes

  const [timeRange, setTimeRange] = useState<'all' | '7' | '30'>('all')
  const moduleAnalyses = useLiveQuery(() => moduleAnalysisRepository.getAll(), []) ?? []

  const filtered = useMemo(() => {
    if (timeRange === 'all') return mistakes
    const cutoff = new Date(Date.now() - parseInt(timeRange) * 86400000)
    return mistakes.filter(m => new Date(m.createdAt) >= cutoff)
  }, [mistakes, timeRange])

  const perModule = useMemo(() => {
    const map: Record<string, { mistakes: any[]; analyzed: any }> = {}
    for (const m of ALL_MODULES) {
      const moduleMistakes = filtered.filter(mm => mm.module === m)
      const analyzed = moduleAnalyses.find(ma => ma.module === m)
      map[m] = { mistakes: moduleMistakes, analyzed: analyzed ? analyzed : null }
    }
    return map
  }, [filtered, moduleAnalyses])

  const totalStems = filtered.filter(m => m.questionStem).length
  const totalAll = filtered.length

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* 时间范围 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">综合分析</h2>
        <div className="flex gap-2 mb-3">
          {[{ v: 'all', l: '全部' }, { v: '7', l: '近7天' }, { v: '30', l: '近30天' }].map(opt => (
            <button key={opt.v} onClick={() => setTimeRange(opt.v as typeof timeRange)}
              className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium border', timeRange === opt.v ? 'bg-purple-50 text-purple-600 border-purple-300' : 'bg-white text-slate-500 border-slate-200')}>
              {opt.l}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 space-y-1">
          <p>共 {totalAll} 道错题，有原文可分析 {totalStems} 道</p>
          <p className="text-slate-400">各模块错题数：{ALL_MODULES.filter(m => perModule[m]?.mistakes.length > 0).map(m => `${MODULE_LABELS[m]}${perModule[m]?.mistakes.length || 0}`).join(' · ')}</p>
        </div>
      </div>

      {/* 模块列表 */}
      <div className="space-y-2">
        {ALL_MODULES.map(m => {
          const data = perModule[m]
          if (!data || data.mistakes.length === 0) return null
          const stems = data.mistakes.filter((mm: any) => mm.questionStem)
          if (stems.length < 3) return null
          return (
            <ModuleCard
              key={m}
              module={m}
              label={MODULE_LABELS[m]}
              color={MODULE_COLORS[m]}
              count={stems.length}
              analyzed={data.analyzed}
              mistakes={data.mistakes}
            />
          )
        })}
      </div>

      {/* 历史报告（综合） */}
      {moduleAnalyses.length > 0 && (
        <details className="bg-white rounded-xl border border-slate-200">
          <summary className="px-4 py-3 text-sm font-medium text-slate-500 cursor-pointer flex items-center gap-2">
            <Clock size={14} /> 历史分析记录 ({moduleAnalyses.length})
          </summary>
          <div className="px-4 pb-3 space-y-1">
            {moduleAnalyses.map(r => (
              <p key={r.id} className="text-xs text-slate-400">{formatDate(r.createdAt)} · {MODULE_LABELS[r.module as ExamModule] || r.module} — {r.summary?.slice(0, 60)}</p>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// 用于 ModuleCard 内获取错题数据
export function useMistakesCache() { return _cache }
