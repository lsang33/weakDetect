import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, AlertCircle, BookOpen } from 'lucide-react'
import { useTodayReviewPlan, useReviewPlanActions } from '../hooks/useReviewPlan'
import { MODULE_LABELS, MODULE_COLORS, ERROR_TYPE_LABELS } from '../lib/constants'
import { formatDate } from '../lib/dateUtils'
import { cn } from '../lib/cn'
import type { ReviewItem } from '../models/review'
import type { ExamModule, ErrorType } from '../models/exam'

function ReviewItemCard({
  item,
  completed,
  onToggle,
}: {
  item: ReviewItem
  completed: boolean
  onToggle: () => void
}) {
  return (
    <div className={cn(
      'bg-white rounded-xl p-4 border transition-all',
      completed ? 'border-green-200 bg-green-50/30' : 'border-slate-100 shadow-sm'
    )}>
      <div className="flex items-start gap-3">
        <button onClick={onToggle} className="shrink-0 mt-0.5">
          {completed ? (
            <CheckCircle2 size={22} className="text-green-500" />
          ) : (
            <Circle size={22} className="text-slate-300" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: MODULE_COLORS[item.module as ExamModule] }}
            >
              {MODULE_LABELS[item.module as ExamModule]}
            </span>
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full font-medium',
              item.priority === 'high' ? 'bg-red-100 text-red-600' :
              item.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
              'bg-slate-100 text-slate-500'
            )}>
              {item.priority === 'high' ? '高优先' : item.priority === 'medium' ? '中优先' : '低优先'}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-800">{item.knowledgePoint}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{item.subCategory}</p>
          <p className="text-xs text-slate-400 mt-1">
            {ERROR_TYPE_LABELS[item.errorType as ErrorType]} · {item.reason}
          </p>
        </div>
      </div>
    </div>
  )
}

export function ReviewPlanPage() {
  const navigate = useNavigate()
  const { plan, items, loading } = useTodayReviewPlan()
  const { savePlan, markCompleted } = useReviewPlanActions()
  const [completedIds, setCompletedIds] = useState<string[]>(plan?.completedItemIds ?? [])

  const today = formatDate(new Date())

  async function handleToggle(mistakeId: string) {
    const isCompleted = completedIds.includes(mistakeId)
    let newCompleted: string[]

    if (isCompleted) {
      newCompleted = completedIds.filter(id => id !== mistakeId)
    } else {
      newCompleted = [...completedIds, mistakeId]
    }
    setCompletedIds(newCompleted)

    // 确保计划已保存
    const currentPlan = plan ?? await savePlan(today, items)
    await markCompleted(currentPlan.id, mistakeId)
  }

  const completedCount = completedIds.length
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0

  if (items.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
          <BookOpen size={36} className="text-green-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-700 mb-1">暂无待复习错题</h2>
        <p className="text-sm text-slate-400">所有错题已掌握或暂无需要复习的内容</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* 进度条 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-800">今日复习进度</h2>
          <span className="text-sm font-bold text-blue-500">{progress}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">{completedCount}/{items.length} 已完成</p>
      </div>

      {/* 复习列表 */}
      <div className="space-y-2">
        {items.map(item => (
          <ReviewItemCard
            key={item.mistakeId}
            item={item}
            completed={completedIds.includes(item.mistakeId)}
            onToggle={() => handleToggle(item.mistakeId)}
          />
        ))}
      </div>

      {/* 完成提示 */}
      {progress === 100 && (
        <div className="text-center py-6 bg-green-50 rounded-xl border border-green-200">
          <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
          <p className="text-green-700 font-medium">今日复习已完成！</p>
          <p className="text-xs text-green-500 mt-1">继续保持，加油！</p>
        </div>
      )}
    </div>
  )
}
