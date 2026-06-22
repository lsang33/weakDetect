import { useState } from 'react'
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

function PatternCard({ p, index }: { p: WeaknessPattern; index: number }) {
  const [open, setOpen] = useState(index === 0)
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={cn('w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center',
            p.severity === 'high' ? 'bg-red-500 text-white' :
            p.severity === 'medium' ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-600'
          )}>{index + 1}</span>
          <span className="text-sm font-medium text-slate-800 text-left">{p.pattern}</span>
          <span className="text-xs text-slate-400">{p.relatedMistakeIds?.length || 0}道</span>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-100 pt-3">
          <p className="text-sm text-slate-600">{p.cause}</p>
          <p className="text-sm text-purple-600">{p.suggestion}</p>
        </div>
      )}
    </div>
  )
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

  const stemCount = stemMistakes.length
  const canAnalyze = stemCount >= MIN_STEMS

  async function handleAnalyze() {
    const apiKey = localStorage.getItem('deepseek_key')
    if (!apiKey) { setError('综合分析需要使用 DeepSeek API，请先在设置页填写 DeepSeek API Key'); return }
    setError('')
    setLoading(true)
    try {
      const dsModel = localStorage.getItem('ds_model') || 'reasoner'
      const dsModelName = dsModel === 'chat' ? 'deepseek-chat' : 'deepseek-reasoner'
      const result = await analyzeBatch(stemMistakes, latestReport ? {
        summary: latestReport.summary,
        weaknessPatterns: latestReport.weaknessPatterns,
      } : null, apiKey, dsModelName)
      const report = buildReport(result, stemMistakes, latestReport)
      await analysisReportRepository.create(report)
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析失败')
      setLoading(false)
    }
  }

  return (
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
                  <PatternCard key={i} p={p} index={i} />
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
    </div>
  )
}
