import compactPrompt from '../prompts/compact.txt'
import detailedPrompt from '../prompts/detailed.txt'
import freePrompt from '../prompts/free.txt'
import { diagnose, diagnoseStep1b, BASE_SYSTEM, type DiagnosisResult } from './diagnosisCore'

export type { DiagnosisResult }

const SYSTEM_PROMPTS: Record<string, string> = {
  compact: BASE_SYSTEM + '\n\n' + compactPrompt,
  detailed: BASE_SYSTEM + '\n\n' + detailedPrompt,
  free: BASE_SYSTEM + '\n\n' + freePrompt,
}

const URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'

async function callQwen(messages: { role: string; content: string }[], apiKey: string, maxTokens = 3000): Promise<string> {
  const resp = await fetch(URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'qwen-max', input: { messages }, parameters: { max_tokens: maxTokens, temperature: 0.3, enable_thinking: true } }),
  })
  if (!resp.ok) throw new Error(`API失败: ${resp.status}`)
  const data = await resp.json()
  return data?.output?.text || ''
}

export async function validateQwenKey(apiKey: string): Promise<boolean> {
  try {
    await callQwen([{ role: 'user', content: 'hi' }], apiKey, 1)
    return true
  } catch {
    return false
  }
}

export async function diagnoseMistake(
  questionStem: string, correctAnswer: string, myAnswer: string | undefined,
  moduleName: string, apiKey: string, style = 'compact',
): Promise<DiagnosisResult> {
  return diagnose(
    questionStem, correctAnswer, myAnswer, moduleName, style,
    (messages, maxTokens) => callQwen(messages, apiKey, maxTokens),
    SYSTEM_PROMPTS[style] || SYSTEM_PROMPTS.compact,
  )
}

export async function diagnoseMistakeStep1b(
  questionStem: string, correctAnswer: string, myAnswer: string | undefined,
  moduleName: string, apiKey: string, style = 'compact',
): Promise<DiagnosisResult> {
  return diagnoseStep1b(
    questionStem, correctAnswer, myAnswer, moduleName, style,
    (messages, maxTokens) => callQwen(messages, apiKey, maxTokens),
    SYSTEM_PROMPTS[style] || SYSTEM_PROMPTS.compact,
  )
}
