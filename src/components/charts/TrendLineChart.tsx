import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import type { WeeklyTrendPoint } from '../../models/analytics'

interface TrendLineChartProps {
  data: WeeklyTrendPoint[]
}

export function TrendLineChart({ data }: TrendLineChartProps) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      week: format(d.weekStart, 'M/d'),
      logged: d.mistakesLogged,
      reviewed: d.mistakesReviewed,
    }))
  }, [data])

  if (chartData.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">暂无趋势数据</div>
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="logged"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ r: 3, fill: '#EF4444' }}
            name="新增错题"
          />
          <Line
            type="monotone"
            dataKey="reviewed"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 3, fill: '#10B981' }}
            name="已复习"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
