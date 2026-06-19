import compactPrompt from '../prompts/compact.txt'
import detailedPrompt from '../prompts/detailed.txt'
import freePrompt from '../prompts/free.txt'
import { diagnose, BASE_SYSTEM, type DiagnosisResult } from './diagnosisCore'

const DS_URL = 'https://api.deepseek.com/v1/chat/completions'

const SYSTEM_STYLES: Record<string, string> = {
  compact: BASE_SYSTEM + '\n\n' + compactPrompt,
  detailed: BASE_SYSTEM + '\n\n' + detailedPrompt,
  free: BASE_SYSTEM + '\n\n' + freePrompt,
}

async function callDS(messages: { role: string; content: string }[], apiKey: string, maxTokens = 3000, model = 'deepseek-reasoner'): Promise<string> {
  const resp = await fetch(DS_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.3 }),
  })
  if (!resp.ok) { const err = await resp.text(); throw new Error(`DeepSeek API失败: ${resp.status}`) }
  const data = await resp.json()
  return (data?.choices?.[0]?.message?.content || '').trim()
}

export async function validateDeepseekKey(apiKey: string): Promise<boolean> {
  try {
    await callDS([{ role: 'user', content: 'hi' }], apiKey, 1)
    return true
  } catch {
    return false
  }
}

export async function deepseekDiagnose(
  questionStem: string, correctAnswer: string, myAnswer: string | undefined,
  moduleName: string, apiKey: string, style = 'compact', dsModel = 'deepseek-reasoner',
): Promise<DiagnosisResult> {
  return diagnose(
    questionStem, correctAnswer, myAnswer, moduleName, style,
    (messages, maxTokens) => callDS(messages, apiKey, maxTokens, dsModel),
    SYSTEM_STYLES[style] || SYSTEM_STYLES.compact,
  )
}
