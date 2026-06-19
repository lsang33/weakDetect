import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, X, CheckCircle2, FileText, AlertCircle } from 'lucide-react'
import { useMistakes, useCoverage } from '../hooks/useMistakes'
import { ExamModule, ErrorType, MODULE_LABELS, ERROR_TYPE_SHORT_LABELS, MODULE_COLORS } from '../lib/constants'
import { formatDate } from '../lib/dateUtils'
import { searchMistakes, filterMistakes } from '../services/analyticsService'
import { cn } from '../lib/cn'
import type { MistakeRecord } from '../models/mistake'

const ALL_MODULES = Object.values(ExamModule)
const ALL_ERROR_TYPES = Object.values(ErrorType)

function MistakeCard({ mistake }: { mistake: MistakeRecord }) {
  const navigate = useNavigate()
  const hasAiDiagnosis = !!mistake.quickDiagnosis

  return (
    <div
      onClick={() => navigate(`/mistakes/${mistake.id}`)}
      className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full text-white shrink-0"
              style={{ backgroundColor: MODULE_COLORS[mistake.module] }}
            >
              {MODULE_LABELS[mistake.module]}
            </span>
            <span className="text-xs text-slate-400">
              {ERROR_TYPE_SHORT_LABELS[mistake.errorType]}
            </span>
            {!hasAiDiagnosis && (
              <span className="text-xs text-purple-400">待诊断</span>
            )}
            {mistake.mastered && (
              <span className="flex items-center gap-0.5 text-xs text-green-500">
                <CheckCircle2 size={12} /> 已掌握
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-800">{mistake.knowledgePoint}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {mistake.subCategory}
            {!mistake.questionStem && (
              <span className="ml-2 text-amber-500">（缺原文）</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {mistake.questionStem && <FileText size={14} className="text-blue-300" />}
          <span className="text-xs text-slate-400 shrink-0">{formatDate(mistake.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

export function MistakeListPage() {
  const mistakes = useMistakes()
  const coverage = useCoverage()
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterModule, setFilterModule] = useState<ExamModule | undefined>()
  const [filterErrorType, setFilterErrorType] = useState<ErrorType | undefined>()
  const [showMastered, setShowMastered] = useState<boolean | undefined>(undefined)
  const [filterNoDiagnosis, setFilterNoDiagnosis] = useState(false)

  const filtered = useMemo(() => {
    let result = filterMistakes(mistakes, {
      module: filterModule,
      errorType: filterErrorType,
      mastered: showMastered,
    })

    if (filterNoDiagnosis) {
      result = result.filter(m => !m.quickDiagnosis)
    }

    if (search.trim()) {
      result = searchMistakes(result, search.trim())
    }

    return result
  }, [mistakes, search, filterModule, filterErrorType, showMastered, filterNoDiagnosis])

  const activeFilterCount = [filterModule, filterErrorType, showMastered !== undefined, filterNoDiagnosis].filter(Boolean).length

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
            'p-2.5 rounded-xl border border-slate-200 bg-white transition-colors',
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
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 animate-fade-in">
          <AlertCircle size={14} className="shrink-0" />
          <span>
            有 {coverage.total - coverage.covered} 道错题缺少题目原文，将无法参与 AI 分析。
            {coverage.uncoveredIds.length > 0 && (
              <span className="ml-1 text-amber-500">点击查看详情补充原文。</span>
            )}
          </span>
        </div>
      )}

      {/* 错题列表 */}
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map(m => (
            <MistakeCard key={m.id} mistake={m} />
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
    </div>
  )
}
