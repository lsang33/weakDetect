import { useState, useEffect } from 'react'
import { Download, Upload, Trash2, Info, Key, Eye, EyeOff, Save, CheckCircle, XCircle, Loader2, FileText } from 'lucide-react'
import { useMistakes } from '../hooks/useMistakes'
import { db } from '../db/database'
import { cn } from '../lib/cn'
import { MODULE_LABELS } from '../lib/constants'
import { validateQwenKey } from '../services/diagnoseService'
import { validateDeepseekKey } from '../services/deepseekService'

function ApiSettings() {
  const [dashScopeKey, setDashScopeKey] = useState('')
  const [deepseekKey, setDeepseekKey] = useState('')
  const [diagModel, setDiagModel] = useState('')
  const [diagStyle, setDiagStyle] = useState('')
  const [dsModel, setDsModel] = useState('reasoner')
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
    setDsModel(localStorage.getItem('ds_model') || 'reasoner')
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
              <button onClick={() => setDsModel('chat')}
                className={'flex-1 py-1 rounded text-[11px] font-medium border ' + (dsModel === 'chat' ? 'bg-blue-50 text-blue-600 border-blue-300' : 'bg-white text-slate-400 border-slate-200')}>
                ⚡ Flash
              </button>
              <button onClick={() => setDsModel('reasoner')}
                className={'flex-1 py-1 rounded text-[11px] font-medium border ' + (dsModel === 'reasoner' ? 'bg-purple-50 text-purple-600 border-purple-300' : 'bg-white text-slate-400 border-slate-200')}>
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

  async function handleExport() {
    try {
      const mistakesData = await db.mistakes.toArray()
      const plansData = await db.reviewPlans.toArray()
      const json = JSON.stringify({ mistakes: mistakesData, reviewPlans: plansData }, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `错题分析备份_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage('✅ 数据导出成功')
    } catch {
      setMessage('❌ 导出失败')
    }
    setTimeout(() => setMessage(''), 3000)
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
        const data = JSON.parse(text)

        if (data.mistakes && Array.isArray(data.mistakes)) {
          await db.mistakes.clear()
          for (const m of data.mistakes) {
            await db.mistakes.add({
              ...m,
              createdAt: new Date(m.createdAt),
              reviewedAt: m.reviewedAt ? new Date(m.reviewedAt) : undefined,
            })
          }
        }
        if (data.reviewPlans && Array.isArray(data.reviewPlans)) {
          await db.reviewPlans.clear()
          for (const p of data.reviewPlans) {
            await db.reviewPlans.add(p)
          }
        }
        setMessage(`✅ 导入成功！${data.mistakes?.length ?? 0} 条错题，即将刷新`)
        setTimeout(() => window.location.reload(), 800)
      } catch {
        setMessage('❌ 文件格式错误')
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
          onClick={handleExport}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-50"
        >
          <Download size={18} className="text-blue-500" />
          导出数据（JSON）
        </button>
        <button
          onClick={handleImport}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-50"
        >
          <Upload size={18} className="text-green-500" />
          导入数据（JSON）
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
