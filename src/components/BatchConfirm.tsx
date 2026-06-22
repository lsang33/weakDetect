import { useState } from 'react'
import { ArrowLeft, Save, Brain, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react'
import { useMistakeActions } from '../hooks/useMistakes'
import {
  ExamModule, ErrorType, EntryType, QuestionType,
  JUDGMENT_SUB_LABELS, ALL_JUDGMENT_SUB_TYPES,
  MODULE_LABELS, MODULE_COLORS,
  ERROR_TYPE_LABELS, ERROR_TYPE_COLORS,
} from '../lib/constants'
import { cn } from '../lib/cn'
import type { OcrResult } from '../services/ocrService'
import type { CreateMistakeInput } from '../models/mistake'

const ALL_MODULES = Object.values(ExamModule) as ExamModule[]
const ALL_ERROR_TYPES = Object.values(ErrorType) as ErrorType[]

export function BatchConfirm({ results, onBack }: { results: OcrResult[]; onBack: () => void }) {
  const { create } = useMistakeActions()
  const [saving, setSaving] = useState(false)
  const [saveDone, setSaveDone] = useState(false)
  const [questions, setQuestions] = useState(
    results.map(r => ({
      ...r,
      myAnswer: '',
      selected: true,
      needDiag: false,
      expanded: false,
    }))
  )

  function toggleSelect(i: number) {
    setQuestions(prev => { const n = [...prev]; n[i] = { ...n[i], selected: !n[i].selected }; return n })
  }

  function toggleExpand(i: number) {
    setQuestions(prev => { const n = [...prev]; n[i] = { ...n[i], expanded: !n[i].expanded }; return n })
  }

  function updateField(i: number, field: string, value: string) {
    setQuestions(prev => { const n = [...prev]; (n[i] as any)[field] = value; return n })
  }

  const selectedCount = questions.filter(q => q.selected).length

  async function handleSave() {
    setSaving(true)
    const selected = questions.filter(q => q.selected)
    for (const q of selected) {
      const input: CreateMistakeInput = {
        entryType: EntryType.PHOTO,
        questionType: QuestionType.MISTAKE,
        module: mapModule(q.module),
        errorType: ErrorType.KNOWLEDGE_GAP,
        knowledgePoint: q.knowledgePoint || '',
        subCategory: q.subCategory || '',
        questionStem: q.questionStem || undefined,
        correctAnswer: q.correctAnswer || undefined,
        difficulty: (q.difficulty >= 1 && q.difficulty <= 5 ? q.difficulty : 3) as 1|2|3|4|5,
        myAnswer: q.myAnswer || undefined,
        judgmentSubType: undefined,
        notes: undefined,
        source: undefined,
      }
      await create(input)
    }
    setSaving(false)
    setSaveDone(true)
  }

  function mapModule(m: string): ExamModule {
    if (m.includes('言语')) return ExamModule.VERBAL
    if (m.includes('数量')) return ExamModule.QUANTITATIVE
    if (m.includes('判断')) return ExamModule.JUDGMENT
    if (m.includes('资料')) return ExamModule.DATA_ANALYSIS
    if (m.includes('常识')) return ExamModule.COMMON_KNOWLEDGE
    if (m.includes('政治')) return ExamModule.POLITICAL
    return ExamModule.JUDGMENT
  }

  if (saveDone) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
          <Save size={32} className="text-green-500" />
        </div>
        <p className="text-lg font-semibold text-slate-800 mb-1">已保存 {selectedCount} 道题</p>
        <p className="text-sm text-slate-400">可以返回错题本查看或进行 AI 诊断</p>
        <div className="flex gap-2 mt-6 justify-center">
          <button onClick={onBack}
            className="px-5 py-2 rounded-xl bg-purple-50 text-purple-600 text-sm font-medium">继续拍照</button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500">
          <ArrowLeft size={16} /> 返回
        </button>
        <span className="text-xs text-slate-400">识别到 {results.length} 道题</span>
      </div>

      {/* 批量操作 */}
      <div className="flex gap-2">
        <button onClick={() => {
          const allSel = questions.every(q => q.selected)
          setQuestions(prev => prev.map(q => ({ ...q, selected: !allSel })))
        }} className="text-xs text-purple-500 underline">
          {questions.every(q => q.selected) ? '取消全选' : '全选'}
        </button>
        <button onClick={() => {
          setQuestions(prev => prev.map(q => ({ ...q, needDiag: q.selected })))
        }} className="text-xs text-purple-500 underline">
          勾选的标记诊断
        </button>
      </div>

      {/* 题目列表 */}
      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* 摘要行 */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button onClick={() => toggleSelect(i)}>
                {q.selected ? <CheckSquare size={18} className="text-purple-500" /> : <Square size={18} className="text-slate-300" />}
              </button>
              <span className="text-xs font-medium text-slate-400 shrink-0">#{i + 1}</span>
              <span className="text-xs font-medium px-1.5 py-0.5 rounded text-white shrink-0"
                style={{ backgroundColor: MODULE_COLORS[mapModule(q.module)] }}>
                {MODULE_LABELS[mapModule(q.module)]}
              </span>
              <p className="text-xs text-slate-600 truncate flex-1">{q.knowledgePoint || q.questionStem?.slice(0, 30)}</p>
              {q.needDiag && <span className="text-[10px] text-purple-400 shrink-0">需诊断</span>}
              <button onClick={() => toggleExpand(i)} className="shrink-0">
                {q.expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>
            </div>

            {/* 展开编辑区 */}
            {q.expanded && (
              <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2">
                <div>
                  <label className="text-[10px] text-slate-400">题目原文</label>
                  <textarea value={q.questionStem} rows={1}
                    ref={el => { if (el) requestAnimationFrame(() => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }) }}
                    onInput={e => { updateField(i, 'questionStem', e.currentTarget.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px' }}
                    className="w-full mt-0.5 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white resize-none overflow-hidden" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">正确答案</label>
                    <input value={q.correctAnswer} onChange={e => updateField(i, 'correctAnswer', e.target.value)}
                      className="w-full mt-0.5 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">我的答案</label>
                    <input value={q.myAnswer || ''} onChange={e => updateField(i, 'myAnswer', e.target.value)}
                      placeholder="选填"
                      className="w-full mt-0.5 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">难度</label>
                    <input value={q.difficulty} onChange={e => updateField(i, 'difficulty', e.target.value)}
                      className="w-full mt-0.5 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">所属模块</label>
                  <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                    {ALL_MODULES.map(m => (
                      <button key={m} onClick={() => updateField(i, 'module', MODULE_LABELS[m])}
                        className={cn('px-2 py-2 rounded text-xs font-medium border text-center',
                          mapModule(q.module) === m ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200')}
                        style={mapModule(q.module) === m ? { backgroundColor: MODULE_COLORS[m] } : undefined}>
                        {MODULE_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">知识点</label>
                  <input value={q.knowledgePoint} onChange={e => updateField(i, 'knowledgePoint', e.target.value)}
                    className="w-full mt-0.5 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { const n = [...questions]; n[i] = { ...n[i], needDiag: !n[i].needDiag }; setQuestions(n) }}
                    className={cn('text-xs px-2 py-1 rounded-lg border',
                      q.needDiag ? 'bg-purple-50 text-purple-600 border-purple-300' : 'bg-white text-slate-400 border-slate-200')}>
                    {q.needDiag ? '需诊断 ✓' : '需诊断'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 底部保存 */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur rounded-xl p-3 border border-slate-200 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">已选 {selectedCount} / {results.length} 道</span>
          <span className="text-[10px] text-purple-400">{questions.filter(q => q.selected && q.needDiag).length} 道需诊断</span>
        </div>
        <button onClick={handleSave} disabled={selectedCount === 0 || saving}
          className={cn('w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2',
            selectedCount && !saving ? 'bg-purple-500 text-white active:scale-[0.98]' : 'bg-slate-200 text-slate-400')}>
          <Save size={16} /> {saving ? '保存中...' : `保存所选（${selectedCount} 道）`}
        </button>
        <p className="text-[10px] text-slate-400 text-center mt-1">保存后可在错题本中查看并逐道 AI 诊断</p>
      </div>
    </div>
  )
}
