import { useState, useEffect, useRef } from 'react'
import { Download, Upload, Trash2, Info, Key, Eye, EyeOff, Save, CheckCircle, XCircle, Loader2, FileText, Share2, RefreshCw } from 'lucide-react'
import { useMistakes } from '../hooks/useMistakes'
import { db } from '../db/database'
import { cn } from '../lib/cn'
import { MODULE_LABELS } from '../lib/constants'
import { validateQwenKey } from '../services/diagnoseService'
import { validateDeepseekKey, getDsModelName } from '../services/deepseekService'
import type { MistakeRecord } from '../models/mistake'
import type { ReviewPlan } from '../models/review'
import type { AnalysisReport, ModuleAnalysis, PracticeSession, PracticeRecord } from '../models/analytics'

function ApiSettings() {
  const [dashScopeKey, setDashScopeKey] = useState('')
  const [deepseekKey, setDeepseekKey] = useState('')
  const [diagModel, setDiagModel] = useState('')
  const [diagStyle, setDiagStyle] = useState('')
  const [dsModel, setDsModel] = useState(() => getDsModelName())
  const [showDash, setShowDash] = useState(false)
  const [showDS, setShowDS] = useState(false)
  const [msg, setMsg] = useState('')
  const [validating, setValidating] = useState(false)
  const [dashValid, setDashValid] = useState<boolean | null>(null)
  const [dsValid, setDSValid] = useState<boolean | null>(null)

  useEffect(() => {
    setDashScopeKey(localStorage.getItem('dashscope_key') || '')
    setDeepseekKey(localStorage.getItem('deepseek_key') || '')
    setDiagModel(localStorage.getItem('diag_model') || 'qwen')
    setDiagStyle(localStorage.getItem('diag_style') || 'compact')
    setDsModel(getDsModelName())
  }, [])

  async function saveKeys() {
    setValidating(true)
    setMsg('')
    setDashValid(null)
    setDSValid(null)

    const dk = dashScopeKey.trim()
    const dsk = deepseekKey.trim()

    const results = await Promise.all([
      dk ? validateQwenKey(dk).then(ok => { setDashValid(ok); return ok }).catch(() => { setDashValid(false); return false }) : Promise.resolve(null),
      dsk ? validateDeepseekKey(dsk).then(ok => { setDSValid(ok); return ok }).catch(() => { setDSValid(false); return false }) : Promise.resolve(null),
    ])

    localStorage.setItem('dashscope_key', dk)
    localStorage.setItem('deepseek_key', dsk)
    localStorage.setItem('diag_model', diagModel)
    localStorage.setItem('diag_style', diagStyle)
    localStorage.setItem('ds_model', dsModel)

    setValidating(false)
    const dashOk = !dk || results[0] !== false
    const dsOk = !dsk || results[1] !== false
    if (dashOk && dsOk) {
      setMsg('✅ 已保存')
      setTimeout(() => setMsg(''), 2000)
    }
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Key size={16} className="text-purple-500" />
          <h2 className="text-sm font-semibold text-slate-800">AI 服务设置</h2>
        </div>
        <button
          onClick={saveKeys}
          disabled={validating}
          className="flex items-center gap-1 text-xs font-medium text-white bg-purple-500 px-3 py-1.5 rounded-lg disabled:opacity-60"
        >
          {validating ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {validating ? '验证中...' : '保存'}
        </button>
      </div>

      <div className="space-y-3">
        {/* DashScope Key (拍照 OCR) */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            通义千问 API Key（拍照识题）
            <span className="text-slate-400 ml-1">dashscope.aliyun.com</span>
          </label>
          <div className="relative">
            <input
              type={showDash ? 'text' : 'password'}
              value={dashScopeKey}
              onChange={e => setDashScopeKey(e.target.value)}
              placeholder="sk-xxxxxxxx"
              className="w-full pr-10 pl-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {dashValid === true && <CheckCircle size={14} className="text-green-500" />}
              {dashValid === false && <XCircle size={14} className="text-red-500" />}
              <button onClick={() => setShowDash(!showDash)} className="text-slate-400">
                {showDash ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* DeepSeek Key */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            DeepSeek API Key（AI 诊断）
            <span className="text-slate-400 ml-1">platform.deepseek.com</span>
          </label>
          <div className="relative">
            <input
              type={showDS ? 'text' : 'password'}
              value={deepseekKey}
              onChange={e => setDeepseekKey(e.target.value)}
              placeholder="sk-xxxxxxxx"
              className="w-full pr-10 pl-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {dsValid === true && <CheckCircle size={14} className="text-green-500" />}
              {dsValid === false && <XCircle size={14} className="text-red-500" />}
              <button onClick={() => setShowDS(!showDS)} className="text-slate-400">
                {showDS ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* 模型选择 */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">诊断模型</label>
          <div className="flex gap-2">
            <button onClick={() => setDiagModel('qwen')}
              className={'flex-1 py-1.5 rounded-lg text-xs font-medium border ' + (diagModel === 'qwen' ? 'bg-purple-50 text-purple-600 border-purple-300' : 'bg-white text-slate-500 border-slate-200')}>通义千问</button>
            <button onClick={() => setDiagModel('deepseek')}
              className={'flex-1 py-1.5 rounded-lg text-xs font-medium border ' + (diagModel === 'deepseek' ? 'bg-purple-50 text-purple-600 border-purple-300' : 'bg-white text-slate-500 border-slate-200')}>DeepSeek</button>
          </div>
          {diagModel === 'deepseek' && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => setDsModel('deepseek-v4-flash')}
                className={'flex-1 py-1 rounded text-[11px] font-medium border ' + (dsModel === 'deepseek-v4-flash' ? 'bg-blue-50 text-blue-600 border-blue-300' : 'bg-white text-slate-400 border-slate-200')}>
                ⚡ Flash
              </button>
              <button onClick={() => setDsModel('deepseek-v4-pro')}
                className={'flex-1 py-1 rounded text-[11px] font-medium border ' + (dsModel === 'deepseek-v4-pro' ? 'bg-purple-50 text-purple-600 border-purple-300' : 'bg-white text-slate-400 border-slate-200')}>
                🧠 Pro（思考）
              </button>
            </div>
          )}
        </div>

        {/* 风格选择 */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">诊断风格</label>
          <div className="flex gap-2">
            {[
              { k: 'compact', label: '精炼', desc: '只写关键决策点' },
              { k: 'detailed', label: '详细', desc: '逐空逐项辨析' },
              { k: 'free', label: '自由', desc: 'AI 自主决定' },
            ].map(s => (
              <button key={s.k} onClick={() => setDiagStyle(s.k)}
                className={'flex-1 py-1.5 rounded-lg border text-xs ' + (diagStyle === s.k ? 'bg-purple-50 text-purple-600 border-purple-300 font-medium' : 'bg-white text-slate-500 border-slate-200')}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {msg && <p className="text-xs text-center text-purple-600 mt-3">{msg}</p>}
    </div>
  )
}

export function SettingsPage() {
  const mistakes = useMistakes()
  const [message, setMessage] = useState('')
  const [sharing, setSharing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [importPreview, setImportPreview] = useState<null | {
    exportedAt: string
    mistakes: { total: number; added: number; updated: number; skipped: number }
    practiceRecords: { total: number; added: number }
    moduleAnalyses: { total: number; added: number }
    localMistakeCount: number
    localRecordCount: number
  }>(null)
  const importDataRef = useRef<Record<string, unknown> | null>(null)

  async function handleCheckUpdate() {
    setChecking(true)
    setMessage('')
    try {
      if (!navigator.serviceWorker) {
        setMessage('⚠️ 当前浏览器不支持 Service Worker')
        return
      }
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        setMessage('⚠️ 当前未安装 PWA，无需更新')
        return
      }
      // 监听新 SW 出现
      const found = new Promise<boolean>(resolve => {
        if (reg.waiting) { resolve(true); return }
        if (reg.installing) { resolve(true); return }
        reg.addEventListener('updatefound', () => resolve(true), { once: true })
        // 3 秒超时
        setTimeout(() => resolve(false), 3000)
      })
      await reg.update()
      const hasUpdate = await found
      if (hasUpdate) {
        reg.waiting?.postMessage({ type: 'SKIP_WAITING' })
        setMessage('✅ 发现新版本，即将刷新...')
        setTimeout(() => window.location.reload(), 500)
      } else {
        setMessage('✅ 已是最新版本')
      }
    } catch {
      setMessage('❌ 检查更新失败')
    } finally {
      setChecking(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  // 预缓存导出数据 — 确保分享时 navigator.share() 能立即调用，不因异步查询丢失用户手势
  const exportCache = useRef<{ blob: Blob; fileName: string; summary: string } | null>(null)

  async function buildExportData() {
    const [mistakesData, plansData, reportsData, moduleAnalysesData, sessionsData, recordsData] =
      await Promise.all([
        db.mistakes.toArray(),
        db.reviewPlans.toArray(),
        db.analysisReports.toArray(),
        db.moduleAnalyses.toArray(),
        db.practiceSessions.toArray(),
        db.practiceRecords.toArray(),
      ])
    const json = JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      mistakes: mistakesData,
      reviewPlans: plansData,
      analysisReports: reportsData,
      moduleAnalyses: moduleAnalysesData,
      practiceSessions: sessionsData,
      practiceRecords: recordsData,
    }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const fileName = `错题分析备份_${new Date().toISOString().slice(0, 10)}.json`
    const parts = [`${mistakesData.length} 条错题`]
    if (recordsData.length) parts.push(`${recordsData.length} 条练习记录`)
    if (moduleAnalysesData.length) parts.push(`${moduleAnalysesData.length} 条分析`)
    return { blob, fileName, summary: parts.join('，') }
  }

  useEffect(() => {
    buildExportData().then(data => { exportCache.current = data })
  }, [])

  async function handleShare() {
    setSharing(true)
    setMessage('')
    try {
      const data = exportCache.current!
      const { blob, fileName, summary } = data

      if (!navigator.share) {
        setMessage('❌ 浏览器不支持分享')
        return
      }

      // 诊断：查询 web-share 权限状态
      if (navigator.permissions) {
        try {
          const perm = await navigator.permissions.query({ name: 'web-share' as PermissionName })
          alert(`web-share 权限状态: ${perm.state}`)
          if (perm.state === 'denied') {
            setMessage('❌ 系统已禁用分享权限，请使用「下载到本地」')
            return
          }
        } catch(e: any) {
          alert(`permissions.query 异常: ${e?.name}: ${e?.message}`)
        }
      } else {
        alert('navigator.permissions 不存在')
      }

      const file = new File([blob], fileName, { type: 'application/json' })
      await navigator.share({ files: [file], title: '错题数据备份' })
      setMessage(`✅ 已分享（${summary}）`)
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setMessage(`❌ 分享失败 [${err?.name || 'unknown'}]: ${err?.message || String(err)}`)
    } finally {
      setSharing(false)
    }
  }

  async function handleDownload() {
    try {
      const data = exportCache.current ?? await buildExportData()
      const url = URL.createObjectURL(data.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.fileName
      a.click()
      URL.revokeObjectURL(url)
      setMessage(`✅ 已下载到本地（${data.summary}）`)
    } catch {
      setMessage('❌ 下载失败')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  /** 递归将日期字符串转为 Date 对象 */
  function reviveDates(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj
    if (typeof obj === 'string') {
      // ISO 日期字符串 → Date
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
        return new Date(obj)
      }
      return obj
    }
    if (Array.isArray(obj)) return obj.map(reviveDates)
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        // 已知的日期字段名
        if (['createdAt', 'reviewedAt', 'analyzedAt', 'attemptedAt', 'completedAt', 'date', 'lastMistakeDate', 'weekStart', 'updatedAt'].includes(key) && typeof value === 'string') {
          result[key] = new Date(value)
        } else {
          result[key] = reviveDates(value)
        }
      }
      return result
    }
    return obj
  }

  /** 按 ID 合并表：只新增，已存在则跳过（用于练习记录等只增不改的表） */
  async function mergeAddOnly<T extends { id: string }>(
    table: { get(id: string): Promise<unknown>; add(item: T): Promise<unknown> },
    items: T[],
  ): Promise<{ added: number; skipped: number }> {
    let added = 0, skipped = 0
    for (const item of items) {
      const exists = await table.get(item.id)
      if (!exists) { await table.add(item); added++ }
      else { skipped++ }
    }
    return { added, skipped }
  }

  /** 计算导入差异（不写入数据库） */
  async function computeImportDiff(data: Record<string, unknown>) {
    const mistakesResult = { total: 0, added: 0, updated: 0, skipped: 0 }
    const recordsResult = { total: 0, added: 0 }
    const analysesResult = { total: 0, added: 0 }

    if (data.mistakes && Array.isArray(data.mistakes)) {
      const imported = data.mistakes as MistakeRecord[]
      mistakesResult.total = imported.length
      for (const imp of imported) {
        const local = await db.mistakes.get(imp.id)
        if (!local) {
          mistakesResult.added++
        } else {
          const localTime = (local.updatedAt?.getTime() ?? local.createdAt?.getTime?.() ?? 0) as number
          const impTime = (imp.updatedAt?.getTime() ?? imp.createdAt?.getTime?.() ?? 0) as number
          if (impTime > localTime) { mistakesResult.updated++ }
          else { mistakesResult.skipped++ }
        }
      }
    }

    if (data.practiceRecords && Array.isArray(data.practiceRecords)) {
      const items = data.practiceRecords as PracticeRecord[]
      recordsResult.total = items.length
      for (const item of items) {
        const exists = await db.practiceRecords.get(item.id)
        if (!exists) recordsResult.added++
      }
    }

    if (data.moduleAnalyses && Array.isArray(data.moduleAnalyses)) {
      const items = data.moduleAnalyses as ModuleAnalysis[]
      analysesResult.total = items.length
      for (const item of items) {
        const exists = await db.moduleAnalyses.get(item.id)
        if (!exists) analysesResult.added++
      }
    }

    const localMistakeCount = await db.mistakes.count()
    const localRecordCount = await db.practiceRecords.count()

    return { mistakes: mistakesResult, practiceRecords: recordsResult, moduleAnalyses: analysesResult, localMistakeCount, localRecordCount }
  }

  /** 执行实际导入 */
  async function doImport(data: Record<string, unknown>) {
    const counts: string[] = []
    if (data.mistakes && Array.isArray(data.mistakes)) {
      const imported = data.mistakes as MistakeRecord[]
      let added = 0, updated = 0, skipped = 0
      for (const imp of imported) {
        const local = await db.mistakes.get(imp.id)
        if (!local) { await db.mistakes.add(imp); added++ }
        else {
          const localTime = (local.updatedAt?.getTime() ?? local.createdAt?.getTime?.() ?? 0) as number
          const impTime = (imp.updatedAt?.getTime() ?? imp.createdAt?.getTime?.() ?? 0) as number
          if (impTime > localTime) { await db.mistakes.put(imp); updated++ }
          else { skipped++ }
        }
      }
      if (added || updated) counts.push(`错题 +${added}` + (updated ? ` 更新${updated}` : ''))
    }
    if (data.reviewPlans && Array.isArray(data.reviewPlans)) {
      await mergeAddOnly(db.reviewPlans as any, data.reviewPlans as ReviewPlan[])
    }
    if (data.analysisReports && Array.isArray(data.analysisReports)) {
      await mergeAddOnly(db.analysisReports as any, data.analysisReports as AnalysisReport[])
    }
    if (data.moduleAnalyses && Array.isArray(data.moduleAnalyses)) {
      const r = await mergeAddOnly(db.moduleAnalyses as any, data.moduleAnalyses as ModuleAnalysis[])
      if (r.added) counts.push(`分析 +${r.added}`)
    }
    if (data.practiceSessions && Array.isArray(data.practiceSessions)) {
      await mergeAddOnly(db.practiceSessions as any, data.practiceSessions as PracticeSession[])
    }
    if (data.practiceRecords && Array.isArray(data.practiceRecords)) {
      const r = await mergeAddOnly(db.practiceRecords as any, data.practiceRecords as PracticeRecord[])
      if (r.added) counts.push(`练习记录 +${r.added}`)
    }
    setMessage(counts.length ? `✅ ${counts.join('，')}` : '✅ 数据已是最新，无需合并')
    if (counts.length) setTimeout(() => window.location.reload(), 1000)
  }

  async function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const raw = JSON.parse(text)
        const data = reviveDates(raw) as Record<string, unknown>
        importDataRef.current = data
        const diff = await computeImportDiff(data)
        setImportPreview({
          exportedAt: (data as any).exportedAt || '未知',
          ...diff,
        })
      } catch {
        setMessage('❌ 文件格式错误')
        setTimeout(() => setMessage(''), 3000)
      }
    }
    input.click()
  }

  async function handleExportPrint() {
    const all = await db.mistakes.toArray()
    const withStem = all.filter(m => m.questionStem)
    if (withStem.length === 0) { setMessage('❌ 没有有原文的题目可导出'); setTimeout(() => setMessage(''), 2000); return }

    const lines: string[] = []
    lines.push('='.repeat(48))
    lines.push('错题练习卷')
    lines.push(`导出时间：${new Date().toLocaleDateString('zh-CN')}`)
    lines.push(`共 ${withStem.length} 道题${all.length !== withStem.length ? `（另有 ${all.length - withStem.length} 道缺少原文未导出）` : ''}`)
    lines.push('='.repeat(48))
    lines.push('')

    withStem.forEach((m, i) => {
      const stem = m.questionStem || ''
      lines.push(`${i + 1}. [${MODULE_LABELS[m.module]}] ${stem.replace(/\n{3,}/g, '\n\n').trim()}`)
      lines.push('')
    })

    lines.push('='.repeat(48))
    lines.push('（不含答案，仅供练习）')

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `错题练习卷_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setMessage(`✅ 已导出 ${withStem.length} 道题`)
    setTimeout(() => setMessage(''), 2000)
  }

  async function handleClearAll() {
    if (window.confirm('确定要删除所有数据吗？此操作不可撤销！')) {
      if (window.confirm('再次确认：真的要删除全部数据吗？建议先导出备份。')) {
        await db.mistakes.clear()
        await db.reviewPlans.clear()
        setMessage('已清空所有数据')
        window.location.reload()
      }
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 数据统计 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <Info size={16} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-800">数据统计</h2>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">总错题数</span>
            <span className="font-medium">{mistakes.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">待攻克</span>
            <span className="font-medium text-orange-500">{mistakes.filter(m => !m.mastered).length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">已掌握</span>
            <span className="font-medium text-green-500">{mistakes.filter(m => m.mastered).length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">存储大小（估算）</span>
            <span className="font-medium">{Math.round(JSON.stringify(mistakes).length / 1024)} KB</span>
          </div>
        </div>
      </div>

      {/* 数据管理 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <h2 className="text-sm font-semibold text-slate-800 px-4 pt-4 pb-2">数据管理</h2>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-50 disabled:opacity-60"
        >
          {sharing ? <Loader2 size={18} className="text-blue-500 animate-spin" /> : <Share2 size={18} className="text-blue-500" />}
          分享
        </button>
        <button
          onClick={handleDownload}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-50"
        >
          <Download size={18} className="text-slate-400" />
          下载到本地
        </button>
        <button
          onClick={handleImport}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-50"
        >
          <Upload size={18} className="text-green-500" />
          导入数据（JSON）
        </button>
        <button
          onClick={handleCheckUpdate}
          disabled={checking}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-50 disabled:opacity-60"
        >
          {checking ? <Loader2 size={18} className="text-purple-500 animate-spin" /> : <RefreshCw size={18} className="text-purple-500" />}
          检查更新
        </button>
        <button
          onClick={handleExportPrint}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-50"
        >
          <FileText size={18} className="text-orange-500" />
          导出错题（打印版）
        </button>
        <button
          onClick={handleClearAll}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50"
        >
          <Trash2 size={18} />
          清空所有数据
        </button>
      </div>

      {/* 导入预览弹窗 */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in" onClick={() => { setImportPreview(null); importDataRef.current = null }}>
          <div className="bg-white rounded-t-2xl p-5 max-w-lg w-full shadow-xl animate-fade-in max-h-[85vh] overflow-auto" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }} onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800 mb-1">导入预览</p>
            <p className="text-xs text-slate-400 mb-4">
              备份时间：{importPreview.exportedAt ? new Date(importPreview.exportedAt).toLocaleString('zh-CN') : '未知'}
            </p>

            {/* 错题 */}
            <div className="mb-3">
              <p className="text-xs font-medium text-slate-600 mb-1">📝 错题（共 {importPreview.mistakes.total} 条）</p>
              <div className="flex gap-2 text-xs">
                {importPreview.mistakes.added > 0 && <span className="text-green-600">新增 {importPreview.mistakes.added}</span>}
                {importPreview.mistakes.updated > 0 && <span className="text-blue-600">更新 {importPreview.mistakes.updated}</span>}
                {importPreview.mistakes.skipped > 0 && <span className="text-slate-400">跳过 {importPreview.mistakes.skipped}</span>}
                {importPreview.mistakes.added === 0 && importPreview.mistakes.updated === 0 && <span className="text-slate-400">无变化</span>}
              </div>
            </div>

            {/* 练习记录 */}
            {importPreview.practiceRecords.total > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-600 mb-1">🏋️ 练习记录（共 {importPreview.practiceRecords.total} 条）</p>
                <div className="flex gap-2 text-xs">
                  {importPreview.practiceRecords.added > 0 ? <span className="text-green-600">新增 {importPreview.practiceRecords.added}</span> : <span className="text-slate-400">无新增</span>}
                </div>
              </div>
            )}

            {/* 模块分析 */}
            {importPreview.moduleAnalyses.total > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-600 mb-1">🧠 模块分析（共 {importPreview.moduleAnalyses.total} 条）</p>
                <div className="flex gap-2 text-xs">
                  {importPreview.moduleAnalyses.added > 0 ? <span className="text-green-600">新增 {importPreview.moduleAnalyses.added}</span> : <span className="text-slate-400">无新增</span>}
                </div>
              </div>
            )}

            {/* 导入后本地数据量 */}
            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-500 space-y-0.5">
              <p>导入后本地将有：</p>
              <p>· 错题 {importPreview.localMistakeCount} → {importPreview.localMistakeCount + importPreview.mistakes.added} 条</p>
              <p>· 练习记录 {importPreview.localRecordCount} → {importPreview.localRecordCount + importPreview.practiceRecords.added} 条</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setImportPreview(null); importDataRef.current = null }}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 bg-white"
              >取消</button>
              <button
                onClick={async () => {
                  const data = importDataRef.current
                  setImportPreview(null)
                  importDataRef.current = null
                  if (data) await doImport(data)
                }}
                className="flex-1 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium"
              >确认导入</button>
            </div>
          </div>
        </div>
      )}

      {/* 备份说明 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-2">
          <Info size={16} className="text-green-500" />
          <h2 className="text-sm font-semibold text-slate-800">备份说明</h2>
        </div>
        <div className="space-y-1.5 text-xs text-slate-500 leading-relaxed">
          <p>📥 <strong>上次备份：</strong>{localStorage.getItem('lastAutoBackup') || '从未备份'}</p>
          <p>🔄 <strong>自动备份：</strong>每天首次打开首页时，自动下载备份文件到手机/电脑的下载目录</p>
          <p>📁 <strong>备份文件位置：</strong></p>
          <ul className="pl-4 space-y-0.5">
            <li>• iPhone：文件 App → Downloads / 下载</li>
            <li>• Android：文件管理器 → Downloads</li>
            <li>• 电脑：浏览器设置 → 下载内容（默认 Downloads）</li>
          </ul>
          <p className="mt-1">💡 <strong>建议：</strong>定期将下载目录的备份文件复制到 iCloud、网盘或其他安全位置。</p>
          <p className="text-amber-500">⚠️ 清除浏览器数据会丢失本地错题，请务必保留备份文件。</p>
        </div>
      </div>

      {/* API 设置 */}
      <ApiSettings />

      {/* 提示消息 */}
      {message && (
        <div className="text-center text-sm font-medium py-3 bg-white rounded-xl border border-slate-100 animate-fade-in">
          {message}
        </div>
      )}

      {/* 关于 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800 mb-2">关于</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          上岸 v1.0 — 公务员备考助手<br />
          所有数据存储在本地浏览器，不上传服务器。<br />
          PWA 支持离线使用，可添加到手机主屏幕。<br />
          建议定期导出数据备份。
          <br /><br />
          <span className="text-slate-300">构建时间：{typeof __BUILD_TIME__ === 'string' && __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
        </p>
      </div>
    </div>
  )
}
