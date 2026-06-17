import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ERROR_TYPE_LABELS, ERROR_TYPE_COLORS } from '../../lib/constants'
import type { ErrorType } from '../../models/exam'

interface ErrorTypePieProps {
  data: Record<ErrorType, number>
}

export function ErrorTypePie({ data }: ErrorTypePieProps) {
  const chartData = useMemo(() => {
    const entries = Object.entries(data) as [ErrorType, number][]
    return entries
      .filter(([, count]) => count > 0)
      .map(([errorType, count]) => ({
        name: ERROR_TYPE_LABELS[errorType],
        value: count,
        color: ERROR_TYPE_COLORS[errorType],
      }))
  }, [data])

  if (chartData.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">暂无数据</div>
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${value} 次`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* 图例 */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
        {chartData.map(entry => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-slate-500">{entry.name} {entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
