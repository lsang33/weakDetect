import { useMemo } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { MODULE_SHORT_LABELS, MODULE_COLORS } from '../../lib/constants'
import type { ModuleStats } from '../../models/analytics'

interface ModuleBarChartProps {
  moduleStats: ModuleStats[]
}

export function ModuleBarChart({ moduleStats }: ModuleBarChartProps) {
  const data = useMemo(() => {
    return moduleStats.map(ms => ({
      name: MODULE_SHORT_LABELS[ms.module],
      mistakes: ms.totalMistakes,
      mastered: ms.masteredCount,
      fill: MODULE_COLORS[ms.module],
    }))
  }, [moduleStats])

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value, name) => [
              `${value} 题`,
              name === 'mistakes' ? '错题数' : '已掌握',
            ]}
          />
          <Bar dataKey="mistakes" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
