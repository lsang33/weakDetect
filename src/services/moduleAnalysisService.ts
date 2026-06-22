import type { MistakeRecord } from '../models/mistake'

const DS_URL = 'https://api.deepseek.com/v1/chat/completions'

async function callDS(prompt: string, apiKey: string, model: string): Promise<string> {
  const resp = await fetch(DS_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 8000, temperature: 0.3 }),
  })
  if (!resp.ok) {
    if (resp.status === 401) throw new Error('DeepSeek API Key 无效')
    throw new Error(`API 错误(${resp.status})`)
  }
  const data = await resp.json()
  return data?.choices?.[0]?.message?.content || ''
}

interface ModuleAnalysisResult {
  summary: string
  patterns: { pattern: string; cause: string; relatedMistakeIds: string[]; suggestion: string }[]
  perQuestionAnalysis: Record<string, string>
}

export async function analyzeModule(
  mistakes: MistakeRecord[],
  moduleName: string,
  apiKey: string,
  model: string,
): Promise<ModuleAnalysisResult> {
  const questionDetails = mistakes.map((m, i) => {
    const idx = `#${i + 1}`
    const stem = (m.questionStem || '').slice(0, 200)
    return `${idx} [${m.module}] ${m.knowledgePoint}
题干摘要：${stem}${stem.length >= 200 ? '...' : ''}
正确答案：${m.correctAnswer || '?'}${m.myAnswer ? ` 她选了：${m.myAnswer}` : ''}
${m.quickDiagnosis?.rootCause ? `单题诊断：${m.quickDiagnosis.rootCause}` : ''}`
  }).join('\n---\n')

  const prompt = `你是一位公考诊断老师。下面是考生在《${moduleName}》模块的 ${mistakes.length} 道错题。

## 你的任务
请逐道分析每道题做错的具体操作失误（不是笼统的"XX能力不足"），然后找出重复出现的错误机制，合并成2-4个模式。

## 分析步骤（请按这个顺序思考）：
1. 看每道题：她在这道题上具体做了什么错误操作
2. 找共性：哪些题犯了同一种错误（不是同模块，而是同操作）
3. 给模式：每个模式必须是一个具体的动作描述

## 错题列表
${questionDetails}

## 输出 JSON
{
  "summary": "一句话总结：这个模块最突出的问题是什么。",
  "patterns": [
    {
      "pattern": "模式名称，写具体的操作描述，如'没判断感情色彩就选了近义词'，不要写'近义词辨析能力不足'",
      "cause": "结合具体题号写为什么出现这个错误（2-3句话）",
      "relatedMistakeIds": ["#1","#3"],
      "suggestion": "一个可执行的做题步骤，如'做选词填空先标语境褒贬，再找对应选项'"
    }
  ],
  "perQuestionAnalysis": {
    "#1": "一句话说清楚这道题为什么做错，如'把贬义词当褒义用了'",
    "#2": "..."
  }
}
只返回 JSON。`

  const text = await callDS(prompt, apiKey, model)
  const parsed = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim())
  return { ...parsed, perQuestionAnalysis: parsed.perQuestionAnalysis || parsed.perQuestion || {} }
}

/** 根据弱点模式生成练习题 */
export async function generatePractice(
  moduleName: string, pattern: { pattern: string; cause: string }, apiKey: string, model: string,
): Promise<{ stem: string; options: string[]; correctAnswer: string; explanation: string }[]> {
  const prompt = `你是公考出题老师。有一个弱点模式需要出题练习：

模块：${moduleName}
模式：${pattern.pattern}
说明：${pattern.cause}

请针对这个弱点模式出 5 道公务员考试行测选择题（与模块类型一致），难度递进：前2道简单、中间2道中等、最后1道较难。
只输出 JSON 数组，每道题格式：
{"stem":"题干","options":["A. xxx","B. xxx","C. xxx","D. xxx"],"correctAnswer":"A","explanation":"解析（说明为什么选这个，以及干扰项错在哪）"}`

  const text = await callDS(prompt, apiKey, model)
  const result = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim())
  return Array.isArray(result) ? result : []
}
