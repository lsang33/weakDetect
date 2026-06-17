import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { mistakeRepository } from '../db/repositories/mistakeRepository'
import type { MistakeRecord, CreateMistakeInput, UpdateMistakeInput, ImprovementAttempt } from '../models/mistake'
import type { AnalysisCoverage } from '../models/analytics'

export function useMistakes() {
  return useLiveQuery(() => mistakeRepository.getAll(), []) ?? []
}

export function useMistake(id: string | undefined) {
  return useLiveQuery(
    () => id ? mistakeRepository.getById(id) : undefined,
    [id]
  )
}

export function useActiveMistakes() {
  return useLiveQuery(() => mistakeRepository.getActive(), []) ?? []
}

export function useKnowledgePoints() {
  return useLiveQuery(() => mistakeRepository.getAllKnowledgePoints(), []) ?? []
}

export function useSubCategories() {
  return useLiveQuery(() => mistakeRepository.getAllSubCategories(), []) ?? []
}

export function useSources() {
  return useLiveQuery(() => mistakeRepository.getAllSources(), []) ?? []
}

/** 分析覆盖率 */
export function useCoverage(): AnalysisCoverage | undefined {
  return useLiveQuery(() => mistakeRepository.getCoverage(), [])
}

/** 有题目原文的错题 */
export function useMistakesWithStems() {
  return useLiveQuery(() => mistakeRepository.getWithStems(), []) ?? []
}

export function useMistakeActions() {
  return {
    create: async (input: CreateMistakeInput) => mistakeRepository.create(input),
    update: async (id: string, input: UpdateMistakeInput) => mistakeRepository.update(id, input),
    remove: async (id: string) => mistakeRepository.delete(id),
    markReviewed: async (id: string) => mistakeRepository.markReviewed(id),
    markMastered: async (id: string) => mistakeRepository.markMastered(id),
    unmarkMastered: async (id: string) => mistakeRepository.unmarkMastered(id),
    addImprovementAttempt: async (id: string, attempt: ImprovementAttempt) =>
      mistakeRepository.addImprovementAttempt(id, attempt),
  }
}
