import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import { useAnalytics } from '../hooks/useAnalytics'
import { WeakPointRadar } from '../components/charts/WeakPointRadar'
import { ErrorTypePie } from '../components/charts/ErrorTypePie'
import { ModuleBarChart } from '../components/charts/ModuleBarChart'
import { TrendLineChart } from '../components/charts/TrendLineChart'
import { MODULE_LABELS, MODULE_COLORS, ERROR_TYPE_LABELS } from '../lib/constants'
import { cn } from '../lib/cn'
import type { WeakPoint } from '../models/analytics'
import type { ExamModule, ErrorType } from '../models/exam'

function TrendIcon({ trend }: { trend: WeakPoint['trend'] }) {
  switch (trend) {
    case 'improving': return <TrendingUp size={14} className="text-green-500" />
    case 'worsening': return <TrendingDown size={14} className="text-red-500" />
    default: return <Minus size={14} className="text-slate-400" />
  }
}

export function AnalyticsPage() {
  const analytics = useAnalytics()

  if (!analytics) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
          <AlertTriangle size={36} className="text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-700 mb-1">暂无分析数据</h2>
        <p className="text-sm text-slate-400">添加错题后这里会生成统计分析</p>
      </div>
    )
  }

  const { moduleStats, topWeakPoints, errorTypeBreakdown, weeklyTrend, totalMistakes, activeMistakes, masteredMistakes } = analytics

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* 概览 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">数据概览</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalMistakes}</p>
            <p className="text-xs text-slate-400">总错题</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-500">{activeMistakes}</p>
            <p className="text-xs text-slate-400">待攻克</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-500">{masteredMistakes}</p>
            <p className="text-xs text-slate-400">已掌握</p>
          </div>
        </div>
      </div>

      {/* 各模块正确率雷达图 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">各模块正确率</h2>
        <WeakPointRadar moduleStats={moduleStats} />
      </div>

      {/* 各模块错题分布 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">各模块错题分布</h2>
        <ModuleBarChart moduleStats={moduleStats} />
      </div>

      {/* 错误类型分布 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">错误类型分布</h2>
        <ErrorTypePie data={errorTypeBreakdown} />
      </div>

      {/* 每周趋势 */}
      {weeklyTrend.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">每周趋势</h2>
          <TrendLineChart data={weeklyTrend} />
        </div>
      )}

      {/* 薄弱知识点 Top 10 */}
      {topWeakPoints.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">薄弱知识点 Top {Math.min(topWeakPoints.length, 10)}</h2>
          <div className="space-y-2">
            {topWeakPoints.slice(0, 10).map((wp, index) => (
              <div key={wp.knowledgePoint} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <span className={cn(
                  'w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0',
                  index < 3 ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'
                )}>
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white shrink-0"
                      style={{ backgroundColor: MODULE_COLORS[wp.module] }}
                    >
                      {MODULE_LABELS[wp.module]}
                    </span>
                    <p className="text-sm font-medium text-slate-800 truncate">{wp.knowledgePoint}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    错误 {wp.mistakeCount} 次
                    {wp.errorTypes.map(et => ERROR_TYPE_LABELS[et as ErrorType]).join('、')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <TrendIcon trend={wp.trend} />
                  <span className="text-xs font-mono font-medium text-slate-500">{wp.score}分</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
