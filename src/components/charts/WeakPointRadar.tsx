import { useMemo } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer,
} from 'recharts'
import { MODULE_SHORT_LABELS, MODULE_COLORS } from '../../lib/constants'
import type { ModuleStats } from '../../models/analytics'

interface WeakPointRadarProps {
  moduleStats: ModuleStats[]
}

export function WeakPointRadar({ moduleStats }: WeakPointRadarProps) {
  const data = useMemo(() => {
    return moduleStats.map(ms => ({
      module: MODULE_SHORT_LABELS[ms.module],
      accuracy: ms.accuracyRate || Math.max(0, 100 - (ms.totalMistakes > 0 ? Math.min(ms.totalMistakes * 10, 95) : 0)),
      fullMark: 100,
    }))
  }, [moduleStats])

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <PolarAngleAxis
            dataKey="module"
            tick={{ fontSize: 12, fill: '#64748b' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="正确率"
            dataKey="accuracy"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      {/* 图例：较小屏幕时可隐藏 */}
    </div>
  )
}
