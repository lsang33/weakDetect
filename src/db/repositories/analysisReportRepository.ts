import { db } from '../database'
import type { AnalysisReport } from '../../models/analytics'
import { generateId } from '../../lib/idGenerator'

export const analysisReportRepository = {
  async create(report: Omit<AnalysisReport, 'id'>): Promise<AnalysisReport> {
    const record: AnalysisReport = {
      ...report,
      id: generateId(),
    }
    await db.analysisReports.add(record)
    return record
  },

  async getAll(): Promise<AnalysisReport[]> {
    return db.analysisReports.orderBy('createdAt').reverse().toArray()
  },

  async getLatest(): Promise<AnalysisReport | undefined> {
    return db.analysisReports.orderBy('createdAt').reverse().first()
  },

  async getById(id: string): Promise<AnalysisReport | undefined> {
    return db.analysisReports.get(id)
  },

  async delete(id: string): Promise<void> {
    await db.analysisReports.delete(id)
  },
}
