import { useState, useEffect } from 'react'
import { Download, Upload, Trash2, Info, Key, Eye, EyeOff, Save } from 'lucide-react'
import { useMistakes } from '../hooks/useMistakes'
import { db } from '../db/database'
import { cn } from '../lib/cn'

function ApiSettings() {
  const [dashScopeKey, setDashScopeKey] = useState('')
  const [deepseekKey, setDeepseekKey] = useState('')
  const [diagModel, setDiagModel] = useState('')
  const [showDash, setShowDash] = useState(false)
  const [showDS, setShowDS] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setDashScopeKey(localStorage.getItem('dashscope_key') || '')
    setDeepseekKey(localStorage.getItem('deepseek_key') || '')
    setDiagModel(localStorage.getItem('diag_model') || 'qwen')
  }, [])

  function saveKeys() {
    localStorage.setItem('dashscope_key', dashScopeKey.trim())
    localStorage.setItem('deepseek_key', deepseekKey.trim())
    localStorage.setItem('diag_model', diagModel)
    setMsg('✅ 已保存')
    setTimeout(() => setMsg(''), 2000)
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
          className="flex items-center gap-1 text-xs font-medium text-white bg-purple-500 px-3 py-1.5 rounded-lg"
        >
          <Save size={12} /> 保存
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
            <button onClick={() => setShowDash(!showDash)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
              {showDash ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
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
            <button onClick={() => setShowDS(!showDS)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
              {showDS ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* 模型选择 */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">诊断模型</label>
          <div className="flex gap-2">
            <button
              onClick={() => setDiagModel('qwen')}
              className={'flex-1 py-1.5 rounded-lg text-xs font-medium border ' + (diagModel === 'qwen' ? 'bg-purple-50 text-purple-600 border-purple-300' : 'bg-white text-slate-500 border-slate-200')}
            >
              通义千问
            </button>
            <button
              onClick={() => setDiagModel('deepseek')}
              className={'flex-1 py-1.5 rounded-lg text-xs font-medium border ' + (diagModel === 'deepseek' ? 'bg-purple-50 text-purple-600 border-purple-300' : 'bg-white text-slate-500 border-slate-200')}
            >
              DeepSeek V4
            </button>
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
        setMessage(`✅ 导入成功！${data.mistakes?.length ?? 0} 条错题`)
        window.location.reload()
      } catch {
        setMessage('❌ 文件格式错误')
      }
    }
    input.click()
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
          <span className="text-slate-300">构建时间：{__BUILD_TIME__}</span>
        </p>
      </div>
    </div>
  )
}
