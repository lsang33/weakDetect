import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Clock } from 'lucide-react'
import { useMistakes, useMistakesWithStems } from '../hooks/useMistakes'
import { useLiveQuery } from 'dexie-react-hooks'
import { analysisReportRepository } from '../db/repositories/analysisReportRepository'
import { analyzeBatch, buildReport } from '../services/batchAnalysisService'
import { MODULE_LABELS, MODULE_COLORS } from '../lib/constants'
import { formatDate } from '../lib/dateUtils'
import { cn } from '../lib/cn'
import type { AnalysisReport, WeaknessPattern } from '../models/analytics'
import type { ExamModule } from '../models/exam'

const MIN_STEMS = 10

function PatternCard({ p, index, questions }: { p: WeaknessPattern; index: number; questions: Record<string, { rootCause: string; fix: string; tags?: string[] }> }) {
  const [open, setOpen] = useState(index === 0)
  const [expandedQ, setExpandedQ] = useState<Set<string>>(new Set())
  const qIds = p.relatedMistakeIds || []
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={cn('w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center',
            p.severity === 'high' ? 'bg-red-500 text-white' :
            p.severity === 'medium' ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-600'
          )}>{index + 1}</span>
          <span className="text-sm font-medium text-slate-800 text-left">{p.pattern}</span>
          <span className="text-xs text-slate-400">{qIds.length}道</span>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3 animate-fade-in">
          <p className="text-sm text-slate-600 leading-relaxed">{p.cause}</p>
          {/* 关联题目列表 */}
          {qIds.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium">关联题目：</p>
              {qIds.map(qid => {
                const q = questions[qid]
                const isExpanded = expandedQ.has(qid)
                return (
                  <div key={qid} className="bg-slate-50 rounded-lg overflow-hidden">
                    <button onClick={() => {
                      const next = new Set(expandedQ)
                      isExpanded ? next.delete(qid) : next.add(qid)
                      setExpandedQ(next)
                    }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-left">
                      <span>
                        <span className="text-slate-500">{qid}</span>
                        {q?.tags?.length ? <span className="ml-1.5 text-purple-500">[{q.tags.join('·')}]</span> : null}
                      </span>
                      {isExpanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
                    </button>
                    {isExpanded && q && (
                      <div className="px-3 pb-2 space-y-1 border-t border-slate-100 pt-1.5 text-xs text-slate-600">
                        {q.rootCause && <p><span className="text-slate-400">错因：</span>{q.rootCause}</p>}
                        {q.fix && <p><span className="text-slate-400">做法：</span>{q.fix}</p>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {p.suggestion && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium mb-1">改进建议</p>
              <p className="text-sm text-slate-700">{p.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string | null}> {
  state = { error: null as string | null }
  static getDerivedStateFromError(e: any) { return { error: e?.message || String(e) } }
  render() {
    if (this.state.error) return <div className="bg-red-50 rounded-xl p-4 border border-red-200 text-sm text-red-600 m-4">
      <p className="font-semibold mb-1">页面异常</p>
      <p>{this.state.error}</p>
      <button onClick={() => window.location.reload()} className="mt-2 underline">刷新页面</button>
    </div>
    return this.props.children
  }
}

export function BatchAnalysisPage() {
  const navigate = useNavigate()
  const mistakes = useMistakes()
  const stemMistakes = useMistakesWithStems()
  const reports = useLiveQuery(() => analysisReportRepository.getAll(), []) ?? []
  const latestReport = reports[0]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openModules, setOpenModules] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])

  function addLog(msg: string) {
    setDebugLog(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()} ${msg}`])
  }

  const stemCount = stemMistakes.length
  const canAnalyze = stemCount >= MIN_STEMS

  async function handleAnalyze() {
    addLog('开始分析...')
    const apiKey = localStorage.getItem('deepseek_key')
    if (!apiKey) { addLog('失败: 无API Key'); setError('综合分析需要使用 DeepSeek API，请先在设置页填写 DeepSeek API Key'); return }
    setError('')
    setLoading(true)
    try {
      const dsModel = localStorage.getItem('ds_model') || 'reasoner'
      const dsModelName = dsModel === 'chat' ? 'deepseek-chat' : 'deepseek-reasoner'
      addLog('调用API...')
      const result = await analyzeBatch(stemMistakes, latestReport ? {
        summary: latestReport.summary,
        weaknessPatterns: latestReport.weaknessPatterns,
      } : null, apiKey, dsModelName)
      addLog(`API返回成功，summary: ${result.summary?.slice(0, 50)}`)
      const report = buildReport(result, stemMistakes, latestReport)
      await analysisReportRepository.create(report)
      addLog('报告已保存')
      setLoading(false)
      setError('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '分析失败'
      addLog(`错误: ${msg}`)
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <ErrorBoundary>
    <div className="space-y-4 animate-fade-in pb-4">
      {/* 状态区 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={18} className="text-purple-500" />
          <h2 className="text-sm font-semibold text-slate-800">综合分析</h2>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">总错题</span>
            <span className="font-medium">{mistakes.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">有题目原文（可分析）</span>
            <span className={cn('font-medium', stemCount >= MIN_STEMS ? 'text-green-500' : 'text-amber-500')}>
              {stemCount} / {MIN_STEMS} 起
            </span>
          </div>
          {latestReport && (
            <div className="flex justify-between">
              <span className="text-slate-500">上次分析</span>
              <span className="font-medium text-slate-400">{formatDate(latestReport.createdAt)}</span>
            </div>
          )}
        </div>

        {!canAnalyze && (
          <div className="flex items-center gap-2 mt-3 bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700">
            <AlertCircle size={14} />
            还需 {MIN_STEMS - stemCount} 道有原文的错题才能分析
          </div>
        )}
      </div>

      {/* 分析按钮 */}
      {canAnalyze && (
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-purple-500 text-white font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? <><RefreshCw size={18} className="animate-spin" /> 分析中...约需 10-20 秒</> : <><BarChart3 size={18} /> 开始综合分析</>}
        </button>
      )}
      {error && <div className="bg-red-50 rounded-xl p-3 border border-red-200 text-sm text-red-600">{error}</div>}

      {/* 最新报告 */}
      {latestReport && !loading && (
        <div className="space-y-3">
          {/* 总览 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-800">最新报告</h3>
              <span className="text-xs text-slate-400">{formatDate(latestReport.createdAt)}</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{latestReport.summary}</p>
          </div>

          {/* 共性弱点 */}
          {latestReport.weaknessPatterns.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">共性弱点</h3>
              <div className="space-y-2">
                {latestReport.weaknessPatterns.map((p, i) => (
                  <PatternCard key={i} p={p} index={i} questions={latestReport.perQuestionAnalysis || {}} />
                ))}
              </div>
            </div>
          )}

          {/* 模块变化 */}
          {latestReport.moduleAnalysis && latestReport.moduleAnalysis.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button onClick={() => setOpenModules(!openModules)} className="w-full flex items-center justify-between px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">各模块变化</h3>
                {openModules ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {openModules && (
                <div className="px-4 pb-3 space-y-2">
                  {latestReport.moduleAnalysis.map((ma, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <span className="text-sm" style={{ color: MODULE_COLORS[ma.module as ExamModule] || '#64748b' }}>
                        {MODULE_LABELS[ma.module as ExamModule] || ma.module}
                      </span>
                      <span className={cn('text-xs font-medium',
                        ma.trend === 'improving' ? 'text-green-500' :
                        ma.trend === 'declining' ? 'text-red-500' : 'text-slate-400'
                      )}>
                        {ma.trend === 'improving' ? '↓ 改善' : ma.trend === 'declining' ? '↑ 恶化' : '→ 持平'} {ma.note}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 本周建议 */}
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
            <h3 className="text-sm font-semibold text-purple-700 mb-2">本周建议</h3>
            <ul className="space-y-1">
              {latestReport.improvementPlan.thisWeek.map((item, i) => (
                <li key={i} className="text-sm text-purple-800 flex items-start gap-2">
                  <span className="text-purple-400 mt-1.5">•</span> {item}
                </li>
              ))}
            </ul>
            {latestReport.improvementPlan.confidenceTip && (
              <p className="text-xs text-purple-500 mt-3 italic">{latestReport.improvementPlan.confidenceTip}</p>
            )}
          </div>

          {/* 历史报告 */}
          {reports.length > 1 && (
            <details className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <summary className="px-4 py-3 text-sm font-medium text-slate-500 cursor-pointer flex items-center gap-2">
                <Clock size={14} /> 历史报告 ({reports.length - 1})
              </summary>
              <div className="px-4 pb-3 space-y-2">
                {reports.slice(1).map(r => (
                  <div key={r.id} className="py-2 border-b border-slate-50 last:border-0">
                    <p className="text-xs text-slate-400">{formatDate(r.createdAt)}</p>
                    <p className="text-sm text-slate-600">{r.summary.slice(0, 100)}...</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* 调试日志 */}
      {debugLog.length > 0 && (
        <details className="bg-slate-900 rounded-xl p-3">
          <summary className="text-xs text-slate-400 cursor-pointer">调试日志 ({debugLog.length})</summary>
          <div className="mt-2 space-y-0.5">
            {debugLog.map((l, i) => (
              <p key={i} className="text-[10px] font-mono text-slate-400">{l}</p>
            ))}
          </div>
        </details>
      )}
    </div>
    </ErrorBoundary>
  )
}
