import { db } from '../database'
import type { ModuleAnalysis } from '../../models/analytics'

export const moduleAnalysisRepository = {
  async create(data: Omit<ModuleAnalysis, 'id'>): Promise<string> {
    const id = crypto.randomUUID()
    await db.moduleAnalyses.add({ id, ...data })
    return id
  },

  async getByModule(module: string): Promise<ModuleAnalysis | undefined> {
    return db.moduleAnalyses.orderBy('createdAt').reverse().filter(m => m.module === module).first()
  },

  getAll(): Promise<ModuleAnalysis[]> {
    return db.moduleAnalyses.orderBy('createdAt').reverse().toArray()
  },
}
