import type { DiagnosisResult } from './diagnoseService'
import compactPrompt from '../prompts/compact.txt'
import detailedPrompt from '../prompts/detailed.txt'
import freePrompt from '../prompts/free.txt'

const STYLE_INSTRUCTIONS: Record<string, string> = { compact: compactPrompt, detailed: detailedPrompt, free: freePrompt }
const DS_URL = 'https://api.deepseek.com/v1/chat/completions'

interface Step1Result { aiAnswer: string; questionType: string; difficulty: string; examPoint: string; keyDifferentiator: string; solution: string; traps: string }

async function callDS(messages: { role: string; content: string }[], apiKey: string, maxTokens = 3000): Promise<string> {
  const resp = await fetch(DS_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-reasoner', messages, max_tokens: maxTokens, temperature: 0.3 }),
  })
  if (!resp.ok) { const err = await resp.text(); throw new Error(`DeepSeek API失败: ${resp.status} ${err}`) }
  const data = await resp.json()
  return data?.choices?.[0]?.message?.content || ''
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

const BASE_SYSTEM = `你是公务员考试解题专家。

常识政策多选题：'① 错 替换：原文X→题目写成了Y' 或 '② 对 无信号'
数量关系/资料分析：条件提取→分类→计算→答案
片段阅读/判断推理：逐项辨析`

const SYSTEM_STYLES: Record<string, string> = {
  compact: BASE_SYSTEM + `\n\n选词填空：展示做题思路，用自然语气像讲题一样。不要列结构，直接写。`,

  detailed: BASE_SYSTEM + `\n\n选词填空：逐空详析。
第一空：题干线索→逐个揣摩→排除原因→选定原因
第二空：（同上）
结论：故选X。`,

  free: BASE_SYSTEM + `\n\n选词填空：没有格式要求，没有模板。用最自然的方式写你的做题过程。` + `\n\n不用1.2.3编号，不用"线索/揣摩/排除/选定"标签，不用"题感""结论"这些套话。就像你自言自语——读到哪想到哪、哪里犹豫了、怎么绕出来的。`,
}

const STEP1_PROMPT = (m: string, q: string) =>
  `独立完成这道${m}题。

## 题目
${q}

输出JSON（只返回JSON）：
{"aiAnswer":"单个字母","questionType":"题型","difficulty":"难度+说明","examPoint":"考什么","keyDifferentiator":"关键分辨点","traps":"最有诱惑力的错误选项及原因","solution":"按系统指令的格式输出思考过程"}`

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
{"rootCause":"${myAnswer ? '她选错的根本原因——被哪个思维误区坑了（不是复述陷阱内容，是说她为什么会上当）' : '最容易被选错的选项及原因'}。不编造她的选择。注意：rootCause和题解陷阱内容不能相同——陷阱说哪个选项有迷惑性，错因说她为什么被迷惑。","fix":"针对这道题的具体解题技巧（不要泛泛的'注意辨析'）","userErrorStep":"读题理解偏差/条件转换错误/计算错误/分类遗漏/选项辨析不足"}
只返回JSON。`

const DEFAULT_STEP1: Step1Result = {
  aiAnswer: '?', questionType: '未知', difficulty: '未知', examPoint: '未知', keyDifferentiator: '未知', solution: '解析异常', traps: '解析异常',
}

export async function deepseekDiagnose(
  questionStem: string, correctAnswer: string, myAnswer: string | undefined,
  moduleName: string, apiKey: string, style = 'compact',
): Promise<DiagnosisResult> {
  const sysMsg = SYSTEM_STYLES[style] || SYSTEM_STYLES.compact
  const s1 = await callDS([
    { role: 'system', content: sysMsg },
    { role: 'user', content: STEP1_PROMPT(moduleName, questionStem) },
  ], apiKey)
  const step1 = parseJson<Step1Result>(s1, DEFAULT_STEP1)

  let { solution, traps } = step1
  let aiAnswer = cleanAnswer(step1.aiAnswer)
  const derived = deriveAnswer(step1.solution, questionStem)
  if (derived && derived !== aiAnswer) aiAnswer = derived

  const aiCorrect = aiAnswer === cleanAnswer(correctAnswer)

  if (!aiCorrect) {
    const s1b = await callDS([
      { role: 'system', content: sysMsg },
      { role: 'user', content: STEP1B_PROMPT(moduleName, questionStem, correctAnswer) },
    ], apiKey)
    const fixup = parseJson<Step1Result>(s1b, { ...DEFAULT_STEP1, aiAnswer: correctAnswer })
    solution = fixup.solution
    traps = fixup.traps
    aiAnswer = cleanAnswer(correctAnswer)
  }

  const s2 = await callDS([{ role: 'user', content: STEP2_PROMPT(aiAnswer, solution, traps, correctAnswer, myAnswer) }], apiKey, 500)
  let step2: { rootCause: string; fix: string; userErrorStep: string }
  try {
    step2 = parseJson<{ rootCause: string; fix: string; userErrorStep: string }>(s2, {
      rootCause: '', fix: '', userErrorStep: '未知',
    })
  } catch {
    step2 = { rootCause: traps || '分析异常', fix: '请尝试重新诊断', userErrorStep: '未知' }
  }
  if (!step2.rootCause) step2.rootCause = traps || '分析异常'
  if (!step2.fix || step2.fix === '请重试') step2.fix = traps || '结合题干线索逐一排除干扰项'

  return {
    aiAnswer, aiCorrect,
    difficulty: step1.difficulty,
    examPoint: step1.examPoint,
    keyDifferentiator: step1.keyDifferentiator,
    solution, traps,
    ...step2,
  }
}
