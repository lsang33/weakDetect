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
    const stem = (m.questionStem || '').length > 300 ? (m.questionStem || '').slice(0, 300) + '...' : (m.questionStem || '(缺)')
    return `#${i + 1} [${m.module}] ${m.knowledgePoint}
题干摘要：${stem}
正确答案：${m.correctAnswer || '?'}
${m.myAnswer ? `她的答案：${m.myAnswer}` : ''}
${diag ? `单题诊断：${diag.rootCause}` : ''}${attempts}`
  }).join('\n\n---\n\n')

  const prevInfo = previousReport
    ? `\n## 上次分析\n总结：${previousReport.summary}\n发现的弱点：${JSON.stringify(previousReport.weaknessPatterns)}`
    : ''

  const prompt = `你是一位公考备考诊断专家。下面是一位考生最近的所有错题。

## 关键规则（必须遵守）

1. ❌ 禁止把不同错误机制的题归为同一个模式。比如"逻辑基础不扎实"包含了充分必要转换、类比关系判断、定义要件提取三种完全不同的错误——必须拆成三个模式。
2. ❌ 禁止用"XX能力不足""XX知识不牢"这类标签。每个模式必须指出具体的错误操作（如："把'有些'当成了'所有'"，而不是"量词理解不到位"）。
3. ✅ 一个模式 = N道题犯了同一个具体的错误。如果错误机制不同，就拆成不同的模式。
4. ✅ 优先找出「修一个点能管最多题」的模式。
5. ✅ severity 只看该模式覆盖的题数：high≥5，medium≥3，low<3，不看难度。

## 不当示例
  × "逻辑基础规则不扎实"→包含10道题，但错误机制各不相同 → 这是错的

## 正确示例
  ✓ "充分必要条件转换方向错误"→#8把'有些→可能所有'判错、#56直言命题换位错误 → 同一个具体漏洞

## 错题列表
${questionList}
${prevInfo}

## 输出 JSON
{
  "summary": "本期错题的核心发现。指出最值得优先修复的 1-2 个密集模式，以及修复后能解决多少题。2-3句话。",
  "weaknessPatterns": [
    {
      "pattern": "具体错误机制命名（如：'充分必要条件转换方向错误'），不能是'XX能力不足'",
      "cause": "指出哪几道题有同样的具体错误，共同的操作失误是什么。必须引用题号。",
      "relatedMistakeIds": ["对应的题目编号#1,#5,#8等"],
      "severity": "high/medium/low",
      "suggestion": "针对这个具体漏洞的修复动作：练什么、练几道、改什么做题步骤。"
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

  // 每题需要约 150 tokens 输出；最少 8000，最多 16000
  const maxTokens = Math.min(16000, Math.max(8000, mistakes.length * 150))
  const text = await callDS(prompt, apiKey, model, maxTokens)
  let result = parseJson<BatchResult>(text, {
    summary: '',
    weaknessPatterns: [],
    moduleChanges: [],
    improvementPlan: { thisWeek: [], nextWeek: [], confidenceTip: '继续加油' },
    perQuestionAnalysis: {},
  })
  // 解析失败时尝试从文本中捞 summary
  if (!result.summary) {
    const m = text.match(/"summary"\s*:\s*"([^"]+)"/)
    if (m) {
      result = { ...result, summary: m[1] }
    } else {
      throw new Error(`AI 返回解析失败。可能内容过长，建议分批分析。\n原始返回(前200字)：${text.slice(0, 200)}`)
    }
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
