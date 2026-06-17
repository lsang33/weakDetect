import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { mistakeRepository } from '../db/repositories/mistakeRepository'
import { computeSummary } from '../services/analyticsService'
import type { AnalyticsSummary } from '../models/analytics'

export function useAnalytics(): AnalyticsSummary | undefined {
  const mistakes = useLiveQuery(() => mistakeRepository.getAll(), []) ?? []

  return useMemo(() => {
    if (mistakes.length === 0) return undefined
    return computeSummary(mistakes)
  }, [mistakes])
}
