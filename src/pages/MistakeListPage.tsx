import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Filter, X, CheckCircle2, AlertCircle, Star, Download, Clock } from 'lucide-react'
import { useMistakes, useCoverage } from '../hooks/useMistakes'
import { ExamModule, ErrorType, MODULE_LABELS, ERROR_TYPE_SHORT_LABELS, MODULE_COLORS } from '../lib/constants'
import { formatDate } from '../lib/dateUtils'
import { searchMistakes, filterMistakes } from '../services/analyticsService'
import { cn } from '../lib/cn'
import { mistakeRepository, practiceRecordRepository } from '../db'
import { downloadTxt, printPdf, copyText } from '../services/exportService'
import type { MistakeRecord } from '../models/mistake'

function formatPracticeTime(ms: number): string {
  if (ms < 1000) return '<1秒'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}秒`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return sec > 0 ? `${m}分${sec}秒` : `${m}分`
}

const ALL_MODULES = Object.values(ExamModule)
const ALL_ERROR_TYPES = Object.values(ErrorType)

function MistakeCard({ mistake, stats }: { mistake: MistakeRecord; stats?: { correct: number; total: number; avgMs: number } }) {
  const navigate = useNavigate()
  const hasAiDiagnosis = !!mistake.quickDiagnosis
  const statusParts: string[] = []

  async function handleStar(e: React.MouseEvent) {
    e.stopPropagation()
    try { await mistakeRepository.toggleStar(mistake.id) } catch { /* ignore */ }
  }

  // 第二行标签
  statusParts.push(ERROR_TYPE_SHORT_LABELS[mistake.errorType])
  if (!hasAiDiagnosis) statusParts.push('待诊断')
  statusParts.push(mistake.mastered ? '已掌握' : '未掌握')

  return (
    <div
      onClick={() => navigate(`/mistakes/${mistake.id}`)}
      className="bg-white rounded-xl px-3 py-2.5 shadow-sm border border-slate-100 cursor-pointer active:scale-[0.98] transition-transform"
    >
      {/* 第一行：模块 + 知识点 + 收藏 + 日期 */}
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] font-medium px-1.5 py-0.5 rounded-full text-white shrink-0"
          style={{ backgroundColor: MODULE_COLORS[mistake.module] }}
        >
          {MODULE_LABELS[mistake.module]}
        </span>
        <span className="text-sm text-slate-800 truncate flex-1 min-w-0">{mistake.knowledgePoint}</span>
        <button onClick={handleStar} className="shrink-0">
          <Star size={14} fill={mistake.starred ? '#F59E0B' : 'none'}
            className={mistake.starred ? 'text-amber-400' : 'text-slate-300'} />
        </button>
        <span className="text-[11px] text-slate-400 shrink-0">{formatDate(mistake.createdAt)}</span>
      </div>

      {/* 第二行：练习情况 + 错误类型 + 状态 */}
      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
        {stats ? (
          <span className={stats.correct === stats.total ? 'text-green-600' : 'text-amber-600'}>
            ✅ {stats.correct}/{stats.total} · {formatPracticeTime(Math.round(stats.avgMs))}/题
          </span>
        ) : (
          <span className="text-slate-400">未练习</span>
        )}
        <span className="text-slate-300">·</span>
        <span className={cn(
          !hasAiDiagnosis && 'text-purple-400',
          mistake.mastered && 'text-green-500',
          !mistake.mastered && hasAiDiagnosis && 'text-slate-500'
        )}>
          {statusParts.join(' · ')}
        </span>
      </div>

      {/* 第三行：子分类（仅在有特殊标记时显示） */}
      {mistake.subCategory && mistake.subCategory !== mistake.knowledgePoint && (
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{mistake.subCategory}{!mistake.questionStem && ' · 缺原文'}</p>
      )}
    </div>
  )
}

export function MistakeListPage() {
  const navigate = useNavigate()
  const mistakes = useMistakes()
  const coverage = useCoverage()
  const practiceRecords = useLiveQuery(() => practiceRecordRepository.getAll(), []) ?? []

  const practiceStats = useMemo(() => {
    const map = new Map<string, { correct: number; total: number; totalMs: number }>()
    for (const record of practiceRecords) {
      for (let i = 0; i < record.questionIds.length; i++) {
        const qid = record.questionIds[i]
        const result = record.results[i]
        if (!result) continue
        const entry = map.get(qid) || { correct: 0, total: 0, totalMs: 0 }
        entry.total++
        if (result.correct) entry.correct++
        entry.totalMs += result.timeMs || 0
        map.set(qid, entry)
      }
    }
    const resultMap = new Map<string, { correct: number; total: number; avgMs: number }>()
    for (const [id, entry] of map) {
      resultMap.set(id, { correct: entry.correct, total: entry.total, avgMs: entry.totalMs / entry.total })
    }
    return resultMap
  }, [practiceRecords])

  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterModule, setFilterModule] = useState<ExamModule | undefined>()
  const [filterErrorType, setFilterErrorType] = useState<ErrorType | undefined>()
  const [showMastered, setShowMastered] = useState<boolean | undefined>(undefined)
  const [filterNoDiagnosis, setFilterNoDiagnosis] = useState(false)
  const [filterStarred, setFilterStarred] = useState(false)
  const [filterHasNotes, setFilterHasNotes] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')

  const filtered = useMemo(() => {
    let result = filterMistakes(mistakes, {
      module: filterModule,
      errorType: filterErrorType,
      mastered: showMastered,
    })

    if (filterNoDiagnosis) {
      result = result.filter(m => !m.quickDiagnosis)
    }

    if (filterStarred) {
      result = result.filter(m => m.starred)
    }

    if (filterHasNotes) {
      result = result.filter(m => m.notes && m.notes.trim().length > 0)
    }

    // 日期筛选
    if (datePreset !== 'all') {
      const now = new Date()
      let start: Date
      if (datePreset === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (datePreset === 'week') {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      } else if (datePreset === 'month') {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      } else {
        // custom
        start = dateStart ? new Date(dateStart) : new Date(0)
        const end = dateEnd ? new Date(dateEnd + 'T23:59:59') : new Date(8640000000000000)
        result = result.filter(m => {
          const d = new Date(m.createdAt)
          return d >= start && d <= end
        })
        return result
      }
      result = result.filter(m => new Date(m.createdAt) >= start)
    }

    if (search.trim()) {
      result = searchMistakes(result, search.trim())
    }

    return result
  }, [mistakes, search, filterModule, filterErrorType, showMastered, filterNoDiagnosis, filterStarred, filterHasNotes, datePreset, dateStart, dateEnd])

  const activeFilterCount = [filterModule, filterErrorType, showMastered !== undefined, filterNoDiagnosis, filterStarred, filterHasNotes, datePreset !== 'all'].filter(Boolean).length

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 搜索栏 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索知识点、考点、来源..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-slate-400" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'p-2.5 rounded-xl border border-slate-200 bg-white transition-colors relative',
            showFilters || activeFilterCount > 0 ? 'text-blue-500 border-blue-200 bg-blue-50' : 'text-slate-400'
          )}
        >
          <Filter size={18} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowExport(true)}
          className={cn(
            'p-2.5 rounded-xl border border-slate-200 bg-white transition-colors',
            showExport ? 'text-purple-500 border-purple-200 bg-purple-50' : 'text-slate-400'
          )}
        >
          <Download size={18} />
        </button>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3 animate-fade-in">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">模块筛选</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterModule(undefined)}
                className={cn('px-2.5 py-1 rounded-lg text-xs', !filterModule ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500')}
              >全部</button>
              {ALL_MODULES.map(m => (
                <button
                  key={m}
                  onClick={() => setFilterModule(filterModule === m ? undefined : m)}
                  className={cn('px-2.5 py-1 rounded-lg text-xs', filterModule === m ? 'text-white' : 'bg-slate-100 text-slate-500')}
                  style={filterModule === m ? { backgroundColor: MODULE_COLORS[m] } : undefined}
                >
                  {MODULE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">错误类型</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterErrorType(undefined)}
                className={cn('px-2.5 py-1 rounded-lg text-xs', !filterErrorType ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500')}
              >全部</button>
              {ALL_ERROR_TYPES.map(et => (
                <button
                  key={et}
                  onClick={() => setFilterErrorType(filterErrorType === et ? undefined : et)}
                  className={cn('px-2.5 py-1 rounded-lg text-xs', filterErrorType === et ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500')}
                >
                  {ERROR_TYPE_SHORT_LABELS[et]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">录入时间</p>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { label: '全部', value: 'all' },
                { label: '今天', value: 'today' },
                { label: '本周', value: 'week' },
                { label: '本月', value: 'month' },
                { label: '自定义', value: 'custom' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setDatePreset(opt.value as typeof datePreset); if (opt.value !== 'custom') { setDateStart(''); setDateEnd('') } }}
                  className={cn('px-2.5 py-1 rounded-lg text-xs', datePreset === opt.value ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div className="flex gap-2 mt-2">
                <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
                  className="flex-1 px-2 py-1 rounded-lg border border-slate-200 text-xs" />
                <span className="text-xs text-slate-400 self-center">~</span>
                <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)}
                  className="flex-1 px-2 py-1 rounded-lg border border-slate-200 text-xs" />
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">状态</p>
            <div className="flex gap-1.5">
              {[
                { label: '全部', value: undefined },
                { label: '未掌握', value: false },
                { label: '已掌握', value: true },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => setShowMastered(opt.value)}
                  className={cn('px-2.5 py-1 rounded-lg text-xs', showMastered === opt.value ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500')}
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setFilterNoDiagnosis(!filterNoDiagnosis)}
                className={cn('px-2.5 py-1 rounded-lg text-xs', filterNoDiagnosis ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500')}
              >
                待诊断
              </button>
              <button
                onClick={() => setFilterStarred(!filterStarred)}
                className={cn('px-2.5 py-1 rounded-lg text-xs flex items-center gap-0.5', filterStarred ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500')}
              >
                <Star size={10} fill={filterStarred ? 'currentColor' : 'none'} /> 收藏
              </button>
              <button
                onClick={() => setFilterHasNotes(!filterHasNotes)}
                className={cn('px-2.5 py-1 rounded-lg text-xs', filterHasNotes ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500')}
              >
                有笔记
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 筛选结果统计 */}
      <p className="text-xs text-slate-400">
        {filtered.length === mistakes.length
          ? `共 ${mistakes.length} 道错题`
          : `筛选到 ${filtered.length} / ${mistakes.length} 道错题`
        }
      </p>

      {/* AI 分析覆盖率 */}
      {coverage && coverage.total > 0 && coverage.covered < coverage.total && (
        <button
          onClick={() => {
            if (coverage.uncoveredIds.length > 0) {
              navigate(`/mistakes/${coverage.uncoveredIds[0]}`)
            }
          }}
          className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 animate-fade-in w-full text-left active:bg-amber-100"
        >
          <AlertCircle size={14} className="shrink-0" />
          <span>
            有 {coverage.total - coverage.covered} 道错题缺少题目原文，将无法参与 AI 分析。
            <span className="ml-1 text-amber-500 underline">点击跳转补录原文。</span>
          </span>
        </button>
      )}

      {/* 错题列表 */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map(m => (
            <MistakeCard key={m.id} mistake={m} stats={practiceStats.get(m.id)} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-1">{mistakes.length === 0 ? '还没有错题' : '没有匹配的错题'}</p>
          <p className="text-sm">
            {mistakes.length === 0 ? '点击右下角 + 记录第一道错题' : '试试调整筛选条件'}
          </p>
        </div>
      )}

      {/* 导出面板 */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in" onClick={() => setShowExport(false)}>
          <div className="bg-white rounded-t-2xl p-5 pb-8 max-w-lg w-full shadow-xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800 mb-1">导出题目</p>
            <p className="text-xs text-slate-400 mb-4">当前筛选到 {filtered.length} 道题</p>

            {/* 完整模式 */}
            <p className="text-xs font-medium text-slate-500 mb-2">📋 完整模式（含答案和解析）</p>
            <div className="flex gap-2 mb-4">
              <button
                onClick={async () => { downloadTxt(filtered, 'full'); setShowExport(false) }}
                disabled={filtered.length === 0}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 bg-white disabled:opacity-30"
              >下载 TXT</button>
              <button
                onClick={() => { printPdf(filtered, 'full'); setShowExport(false) }}
                disabled={filtered.length === 0}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 bg-white disabled:opacity-30"
              >打印 PDF</button>
            </div>

            {/* 考试模式 */}
            <p className="text-xs font-medium text-slate-500 mb-2">📝 考试模式（仅题目，无答案）</p>
            <div className="flex gap-2 mb-4">
              <button
                onClick={async () => { downloadTxt(filtered, 'exam'); setShowExport(false) }}
                disabled={filtered.length === 0}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 bg-white disabled:opacity-30"
              >下载 TXT</button>
              <button
                onClick={() => { printPdf(filtered, 'exam'); setShowExport(false) }}
                disabled={filtered.length === 0}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 bg-white disabled:opacity-30"
              >打印 PDF</button>
            </div>

            {/* 复制 */}
            <button
              onClick={async () => {
                await copyText(filtered)
                setShowExport(false)
              }}
              disabled={filtered.length === 0}
              className="w-full py-2 rounded-xl bg-purple-500 text-white text-sm font-medium disabled:opacity-30"
            >复制到剪贴板（完整模式）</button>

            <button onClick={() => setShowExport(false)}
              className="w-full py-2 mt-2 text-xs text-slate-400">取消</button>
          </div>
        </div>
      )}
    </div>
  )
}
