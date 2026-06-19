import type { MistakeRecord } from '../models/mistake'
import type { AnalysisReport, WeaknessPattern, PerQuestionAnalysis, ImprovementPlan } from '../models/analytics'
import type { DiagnosisResult } from './diagnoseService'

const DS_URL = 'https://api.deepseek.com/v1/chat/completions'

async function callDS(prompt: string, apiKey: string): Promise<string> {
  const resp = await fetch(DS_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-reasoner',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.3,
    }),
  })
  if (!resp.ok) { const err = await resp.text(); throw new Error(`DeepSeek: ${resp.status}`) }
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
): Promise<BatchResult> {
  const questionList = mistakes.map((m, i) => {
    const diag = m.quickDiagnosis
    return `#${i + 1} [${m.module}] ${m.knowledgePoint}
题目：${m.questionStem || '(缺)'}
正确答案：${m.correctAnswer || '?'}
${m.myAnswer ? `她的答案：${m.myAnswer}` : ''}
${diag ? `单题诊断：${diag.rootCause}` : ''}`
  }).join('\n\n---\n\n')

  const prevInfo = previousReport
    ? `\n## 上次分析\n总结：${previousReport.summary}\n发现的弱点：${JSON.stringify(previousReport.weaknessPatterns)}`
    : ''

  const prompt = `你是公务员备考老师。下面是一位考生最近的所有错题，请系统分析。

## 错题列表
${questionList}
${prevInfo}

## 输出 JSON
{
  "summary": "总体评价。包括：整体状态（进步/退步/稳定）、最突出的问题、和上次相比的变化。2-4句话，有温度。",
  "weaknessPatterns": [
    {
      "pattern": "共性问题的简短命名（如：条件转换能力不足）",
      "cause": "深层原因分析——为什么会有这个模式",
      "relatedMistakeIds": ["对应的题目编号#1,#5,#8等"],
      "severity": "high/medium/low",
      "suggestion": "针对性的改进建议，要具体可执行"
    }
  ],
  "moduleChanges": [
    { "module": "模块名", "trend": "improving/stable/declining", "note": "简短说明" }
  ],
  "improvementPlan": {
    "thisWeek": ["本周重点1", "本周重点2"],
    "nextWeek": ["下周重点"],
    "confidenceTip": "一句给信心的话（她正在进步，要看到自己的变化）"
  },
  "perQuestionAnalysis": {
    "#1": { "rootCause": "这道题真正的问题", "thinkingError": "思维偏差", "fix": "具体做法", "tags": ["标签"] }
  }
}
只返回 JSON。`

  const text = await callDS(prompt, apiKey)
  return parseJson<BatchResult>(text, {
    summary: '分析异常，请重试',
    weaknessPatterns: [],
    moduleChanges: [],
    improvementPlan: { thisWeek: [], nextWeek: [], confidenceTip: '继续加油' },
    perQuestionAnalysis: {},
  })
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
