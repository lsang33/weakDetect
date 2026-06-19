import compactPrompt from '../prompts/compact.txt'
import detailedPrompt from '../prompts/detailed.txt'
import freePrompt from '../prompts/free.txt'

const STYLE_SOLUTION: Record<string, string> = { compact: compactPrompt, detailed: detailedPrompt, free: freePrompt }
const URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'

export interface DiagnosisResult {
  aiAnswer: string
  aiCorrect: boolean
  difficulty: string
  examPoint: string
  keyDifferentiator: string
  solution: string
  traps: string
  userErrorStep: string
  rootCause: string
  fix: string
}

interface Step1Result {
  aiAnswer: string
  questionType: string
  difficulty: string
  examPoint: string
  keyDifferentiator: string
  solution: string
  traps: string
}

async function callQwen(prompt: string, apiKey: string): Promise<string> {
  const resp = await fetch(URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen-max',
      input: { messages: [{ role: 'user', content: prompt }] },
      parameters: { max_tokens: 3000, temperature: 0.3, enable_thinking: true },
    }),
  })
  if (!resp.ok) throw new Error(`API失败: ${resp.status}`)
  const data = await resp.json()
  return data?.output?.text || ''
}

function parseJson<T>(text: string, fallback: T): T {
  let json = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  json = json.replace(/"([^"\\]|\\.)*"/g, m => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'))
  try { return JSON.parse(json) as T } catch {
    const m = json.match(/\{[\s\S]*\}/)
    if (m) { try { return JSON.parse(m[0]) as T } catch { return fallback } }
    return fallback
  }
}

const cleanAnswer = (a: string) => a.trim().replace(/[. (（].*$/, '')

function deriveAnswer(solution: string, questionStem: string): string | null {
  const items: { num: string; correct: boolean }[] = []
  const re = /([①-⑧])\s*(对|错)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(solution)) !== null) items.push({ num: m[1], correct: m[2] === '对' })
  if (items.length < 2) return null
  const ansMatch = solution.match(/答案[是为：:]\s*([A-D])/)
  if (ansMatch) return ansMatch[1]
  const pickMatch = solution.match(/[选应]为\s*([A-D])|正确[选项答案]*[是为：:]\s*([A-D])/)
  if (pickMatch) return pickMatch[1] || pickMatch[2]
  const correctNums = items.filter(i => i.correct).map(i => i.num).join('')
  const optMapRe = /([A-D])\s*[.、]\s*([①②③④⑤⑥⑦⑧]+)/g
  let om: RegExpExecArray | null
  while ((om = optMapRe.exec(questionStem)) !== null) if (om[2] === correctNums) return om[1]
  return null
}

const STEP1_PROMPT = (m: string, q: string, style: string) =>
  `独立完成这道${m}题。

## 题目
${q}

## 风格：
${STYLE_SOLUTION[style] || STYLE_SOLUTION.compact}

## 输出（只返回 JSON）
{
  "aiAnswer": "单个字母",
  "questionType": "题型",
  "difficulty": "难度+说明",
  "examPoint": "考什么",
  "keyDifferentiator": "关键分辨点",
  "traps": "最有诱惑力的错误选项及原因",
  "solution": "按风格要求输出思考过程"
}`

const STEP1B_PROMPT = (m: string, q: string, correctAnswer: string) =>
  `正确答案是${correctAnswer}。基于此推导解法。

## 题目
${q}

输出JSON：
{"aiAnswer":"${correctAnswer}","difficulty":"...","examPoint":"...","keyDifferentiator":"...","traps":"...","solution":"思考过程"}`

const STEP2_PROMPT = (aiAnswer: string, solution: string, traps: string, correctAnswer: string, myAnswer: string | undefined) =>
  `AI解题：答案${aiAnswer}${aiAnswer === correctAnswer ? '对' : '错'}。思路：${solution}。陷阱：${traps}

正确答案=${correctAnswer}。${myAnswer ? `她的答案=${myAnswer}。` : '她没提供答案——不要猜测她的选择，分析最易选错的选项。'}

输出JSON：
{"rootCause":"${myAnswer ? '她选错的根本原因——被哪个思维误区坑了（不是复述陷阱，是说她为什么会上当）' : '最容易被选错的选项及原因（注意和陷阱内容区分——陷阱说哪个有迷惑性，错因说她为什么被迷惑）'}","fix":"针对这道题的具体解题技巧","userErrorStep":"读题理解偏差/条件转换错误/计算错误/分类遗漏/选项辨析不足"}
只返回JSON。`

const DEFAULT_STEP1: Step1Result = {
  aiAnswer: '?', questionType: '未知', difficulty: '未知', examPoint: '未知', keyDifferentiator: '未知', solution: '解析异常', traps: '解析异常',
}

export async function diagnoseMistake(
  questionStem: string, correctAnswer: string, myAnswer: string | undefined,
  moduleName: string, apiKey: string, style = 'compact',
): Promise<DiagnosisResult> {
  const s1 = await callQwen(STEP1_PROMPT(moduleName, questionStem, style), apiKey)
  const step1 = parseJson<Step1Result>(s1, DEFAULT_STEP1)

  let { solution, traps } = step1
  let aiAnswer = cleanAnswer(step1.aiAnswer)
  const derived = deriveAnswer(step1.solution, questionStem)
  if (derived && derived !== aiAnswer) aiAnswer = derived

  const aiCorrect = aiAnswer === cleanAnswer(correctAnswer)

  if (!aiCorrect) {
    const s1b = await callQwen(STEP1B_PROMPT(moduleName, questionStem, correctAnswer), apiKey)
    const fixup = parseJson<Step1Result>(s1b, { ...DEFAULT_STEP1, aiAnswer: correctAnswer })
    solution = fixup.solution
    traps = fixup.traps
    aiAnswer = cleanAnswer(correctAnswer)
  }

  const s2 = await callQwen(STEP2_PROMPT(aiAnswer, solution, traps, correctAnswer, myAnswer), apiKey)
  const step2 = parseJson<{ rootCause: string; fix: string; userErrorStep: string }>(s2, {
    rootCause: traps || '分析异常', fix: traps || '结合线索逐一排除', userErrorStep: '未知',
  })

  return {
    aiAnswer, aiCorrect,
    difficulty: step1.difficulty,
    examPoint: step1.examPoint,
    keyDifferentiator: step1.keyDifferentiator,
    solution, traps,
    ...step2,
  }
}
