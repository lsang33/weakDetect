import type { MistakeRecord } from '../models/mistake'
import type { AnalysisReport, WeaknessPattern, PerQuestionAnalysis, ImprovementPlan } from '../models/analytics'
import type { DiagnosisResult } from './diagnoseService'

const DS_URL = 'https://api.deepseek.com/v1/chat/completions'

async function callDS(prompt: string, apiKey: string, model = 'deepseek-reasoner', maxTokens = 4000): Promise<string> {
  const resp = await fetch(DS_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  })
  if (!resp.ok) {
    const status = resp.status
    if (status === 401) throw new Error('DeepSeek API Key 无效或未配置，请在设置页检查')
    throw new Error(`API 异常(${status})，请稍后重试`)
  }
  const data = await resp.json()
  return data?.choices?.[0]?.message?.content || ''
}

function parseJson<T>(text: string, fallback: T): T {
  let json = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(json) as T } catch {
    const m = json.match(/\{[\s\S]*\}/)
    if (m) { try { return JSON.parse(m[0]) as T } catch { return fallback } }
    return fallback
  }
}

interface BatchResult {
  summary: string
  weaknessPatterns: WeaknessPattern[]
  moduleChanges: { module: string; trend: 'improving' | 'stable' | 'declining'; note: string }[]
  improvementPlan: ImprovementPlan
  perQuestionAnalysis: Record<string, PerQuestionAnalysis>
}

export async function analyzeBatch(
  mistakes: MistakeRecord[],
  previousReport: { summary: string; weaknessPatterns: WeaknessPattern[] } | null,
  apiKey: string,
  model = 'deepseek-reasoner',
): Promise<BatchResult> {
  const questionList = mistakes.map((m, i) => {
    const diag = m.quickDiagnosis
    const attempts = m.improvementAttempts?.length
      ? `\n改进追踪：${m.improvementAttempts.map(a => `「${a.method}」→${a.result === 'helped' ? '有效' : a.result === 'not_sure' ? '不确定' : '无效'}`).join('；')}`
      : ''
    return `#${i + 1} [${m.module}] ${m.knowledgePoint}
题目：${m.questionStem || '(缺)'}
正确答案：${m.correctAnswer || '?'}
${m.myAnswer ? `她的答案：${m.myAnswer}` : ''}
${diag ? `单题诊断：${diag.rootCause}` : ''}${attempts}`
  }).join('\n\n---\n\n')

  const prevInfo = previousReport
    ? `\n## 上次分析\n总结：${previousReport.summary}\n发现的弱点：${JSON.stringify(previousReport.weaknessPatterns)}`
    : ''

  const prompt = `你是一位公考备考诊断专家。下面是一位考生最近的所有错题。你的任务不是给她的知识水平贴标签，而是从题目中发现「密集可修复的错误模式」——即几道看起来不同的题，其实是同一个漏洞造成的。

核心原则：
- 不要按模块分类（常识/言语/判断），而要按「错误机制」分类
- 优先找「修一个点能管多道题」的模式 — 比如3道题都是同一个公式忘了，而不是分散说"计算能力不足"
- severity 取决于：这个模式覆盖多少题（high≥5，medium≥3，low<3） + 修复难度
- cause 必须针对具体的题目写，不能写泛泛的"XX能力不足"

## 错题列表
${questionList}
${prevInfo}

## 输出 JSON
{
  "summary": "本期错题的核心发现。指出最值得优先修复的 1-2 个密集模式，以及修复后能解决多少题。2-3句话。",
  "weaknessPatterns": [
    {
      "pattern": "简短命名（指出具体错误机制，如：'充分必要条件转换方向错误'，而不是'逻辑推理能力不足'）",
      "cause": "指出哪几道题有同样的漏洞，共同点是什么。必须引用具体题号和错误内容。",
      "relatedMistakeIds": ["对应的题目编号#1,#5,#8等"],
      "severity": "high/medium/low",
      "suggestion": "针对这个具体漏洞的修复动作。要可执行：练什么、练几道、改什么习惯。"
    }
  ],
  "moduleChanges": [
    { "module": "模块名", "trend": "improving/stable/declining", "note": "简短说明" }
  ],
  "improvementPlan": {
    "thisWeek": ["本周最值得优先做的1件事", "如果有余力再做第2件事"],
    "nextWeek": ["下周重点"],
    "confidenceTip": "一句给信心的话"
  },
  "perQuestionAnalysis": {
    "#1": { "rootCause": "这道题真正的问题", "thinkingError": "思维偏差", "fix": "具体做法", "tags": ["言语理解", "选词填空"] }
  }
}
只返回 JSON。`

  // 每题需要约 200 tokens 输出；最少 4000，最多 16000
  const maxTokens = Math.min(16000, Math.max(4000, mistakes.length * 200))
  const text = await callDS(prompt, apiKey, model, maxTokens)
  const result = parseJson<BatchResult>(text, {
    summary: '',
    weaknessPatterns: [],
    moduleChanges: [],
    improvementPlan: { thisWeek: [], nextWeek: [], confidenceTip: '继续加油' },
    perQuestionAnalysis: {},
  })
  if (!result.summary) {
    throw new Error(`AI 返回解析失败。可能内容过长，建议分批分析。\n原始返回(前200字)：${text.slice(0, 200)}`)
  }
  return result
}

/** 构建完整报告（含覆盖率等元数据） */
export function buildReport(
  result: BatchResult,
  mistakes: MistakeRecord[],
  previousReport: AnalysisReport | null,
): Omit<AnalysisReport, 'id'> {
  const coveredCount = mistakes.length
  return {
    createdAt: new Date(),
    mistakeIds: mistakes.map(m => m.id),
    coveredCount,
    totalCount: coveredCount,
    summary: result.summary,
    weaknessPatterns: result.weaknessPatterns,
    improvementPlan: result.improvementPlan,
    perQuestionAnalysis: result.perQuestionAnalysis,
    moduleAnalysis: result.moduleChanges,
    changesFromLast: previousReport ? {
      improvedPatterns: [],
      persistentPatterns: [],
      newPatterns: result.weaknessPatterns.map(p => p.pattern),
    } : undefined,
  }
}
