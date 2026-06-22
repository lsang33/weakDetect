import { db } from '../database'
import type { PracticeSession } from '../../models/analytics'

export const practiceRepository = {
  async create(data: Omit<PracticeSession, 'id'>): Promise<string> {
    const id = crypto.randomUUID()
    await db.practiceSessions.add({ id, ...data })
    return id
  },

  async update(id: string, data: Partial<PracticeSession>): Promise<void> {
    await db.practiceSessions.update(id, data)
  },

  async getLatest(module: string, pattern: string): Promise<PracticeSession | undefined> {
    return db.practiceSessions
      .where({ module })
      .filter(s => s.pattern === pattern)
      .reverse()
      .first()
  },

  getAll(): Promise<PracticeSession[]> {
    return db.practiceSessions.orderBy('createdAt').reverse().toArray()
  },

  getUncompleted(): Promise<PracticeSession[]> {
    return db.practiceSessions.filter(s => !s.completedAt).toArray()
  },
}
