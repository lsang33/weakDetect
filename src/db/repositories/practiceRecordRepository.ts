import { db } from '../database'
import type { PracticeRecord } from '../../models/analytics'

export const practiceRecordRepository = {
  async create(data: Omit<PracticeRecord, 'id'>): Promise<string> {
    const id = crypto.randomUUID()
    await db.practiceRecords.add({ id, ...data })
    return id
  },

  async getAll(): Promise<PracticeRecord[]> {
    return db.practiceRecords.orderBy('createdAt').reverse().toArray()
  },

  async getById(id: string): Promise<PracticeRecord | undefined> {
    return db.practiceRecords.get(id)
  },

  async delete(id: string): Promise<void> {
    await db.practiceRecords.delete(id)
  },

  async getCount(): Promise<number> {
    return db.practiceRecords.count()
  },
}
