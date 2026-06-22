import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, BookOpen, Target, Award } from 'lucide-react'
import { useMistakes, useActiveMistakes } from '../hooks/useMistakes'
import { useAnalytics } from '../hooks/useAnalytics'
import { MODULE_LABELS, MODULE_COLORS, ERROR_TYPE_SHORT_LABELS } from '../lib/constants'
import { formatRelative } from '../lib/dateUtils'
import { db } from '../db/database'
import type { ExamModule } from '../models/exam'
import type { MistakeRecord } from '../models/mistake'

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof TrendingUp
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon size={20} style={{ color }} />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

function RecentMistakeCard({ mistake }: { mistake: MistakeRecord }) {
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: MODULE_COLORS[mistake.module] }}
            >
              {MODULE_LABELS[mistake.module]}
            </span>
            <span className="text-xs text-slate-400">
              {ERROR_TYPE_SHORT_LABELS[mistake.errorType]}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-800 truncate">{mistake.knowledgePoint}</p>
          {mistake.source && <p className="text-xs text-slate-400 mt-0.5">来源：{mistake.source}</p>}
        </div>
        <span className="text-xs text-slate-400 shrink-0 ml-2">
          {formatRelative(mistake.createdAt)}
        </span>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const mistakes = useMistakes()
  const activeMistakes = useActiveMistakes()
  const analytics = useAnalytics()

  const [autoMsg, setAutoMsg] = useState('')

  // 自动备份：每天首次打开时触发
  useEffect(() => {
    const lastBackup = localStorage.getItem('lastAutoBackup')
    const today = new Date().toISOString().slice(0, 10)
    if (lastBackup !== today && mistakes.length >= 3) {
      // 延迟 1 秒执行，不阻塞渲染
      const timer = setTimeout(async () => {
        try {
          const data = await db.mistakes.toArray()
          const plans = await db.reviewPlans.toArray()
          const json = JSON.stringify({ mistakes: data, reviewPlans: plans }, null, 2)
          const blob = new Blob([json], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `上岸_自动备份_${today}.json`
          a.click()
          URL.revokeObjectURL(url)
          localStorage.setItem('lastAutoBackup', today)
          setAutoMsg(`已自动备份 ${data.length} 道错题到下载目录`)
          setTimeout(() => setAutoMsg(''), 4000)
        } catch { /* 静默失败，不影响使用 */ }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [mistakes.length])

  const totalMistakes = mistakes.length
  const masteredCount = mistakes.filter(m => m.mastered).length
  const masteredRate = totalMistakes > 0 ? Math.round((masteredCount / totalMistakes) * 100) : 0

  // 模块分布
  const moduleDistribution: Partial<Record<ExamModule, number>> = {}
  for (const m of activeMistakes) {
    moduleDistribution[m.module] = (moduleDistribution[m.module] || 0) + 1
  }

  const recentMistakes = mistakes  // 显示全部，不做限制

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={BookOpen} label="总错题数" value={totalMistakes} color="#6366F1" />
        <StatCard icon={Award} label="已掌握率" value={`${masteredRate}%`} color="#10B981" />
        <StatCard icon={Target} label="待攻克" value={activeMistakes.length} color="#F59E0B" />
        <StatCard icon={TrendingUp} label="薄弱知识点" value={analytics?.topWeakPoints.length ?? 0} color="#EF4444" />
      </div>

      {/* 模块分布 */}
      {activeMistakes.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">各模块待攻克错题</h2>
          <div className="space-y-2">
            {Object.entries(moduleDistribution).map(([module, count]) => (
              <div key={module} className="flex items-center gap-3">
                <span className="text-xs font-medium w-16 text-slate-600">
                  {MODULE_LABELS[module as ExamModule]}
                </span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((count / Math.max(...Object.values(moduleDistribution) as number[])) * 100, 100)}%`,
                      backgroundColor: MODULE_COLORS[module as ExamModule],
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-500 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 自动备份提示 */}
      {autoMsg && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-fade-in">
          {autoMsg}
        </div>
      )}

      {/* 最近错题 */}
      {recentMistakes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-800">最近错题</h2>
            <button
              onClick={() => navigate('/mistakes')}
              className="text-xs text-blue-500 font-medium"
            >
              查看全部
            </button>
          </div>
          <div className="space-y-2">
            {recentMistakes.map(m => (
              <div key={m.id} onClick={() => navigate(`/mistakes/${m.id}`)} className="cursor-pointer">
                <RecentMistakeCard mistake={m} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {totalMistakes === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
            <BookOpen size={36} className="text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700 mb-1">还没有错题记录</h2>
          <p className="text-sm text-slate-400 mb-6">点击右下角 + 按钮开始记录吧</p>
          <button
            onClick={() => navigate('/log')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium"
          >
            记录第一道错题
          </button>
        </div>
      )}
    </div>
  )
}
