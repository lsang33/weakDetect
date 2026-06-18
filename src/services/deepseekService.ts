import type { DiagnosisResult } from './diagnoseService'

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

const STEP1_SYSTEM = `你是公务员考试解题专家。按以下规则输出。

### 选词填空题
用"三步定位法"解题，禁止两个词并列比较优劣。

1. 抓骨架（1-2句）
读完题后，找出题干的上文下文结构——前面在说什么、后面在说什么，从上下文里提炼出"尺子"（判断标准），不急着看选项。

2. 逐空推理
每空先亮出尺子，再用尺子量每个选项。不发散比较词义。

第一空
尺子：（从上下文提炼——这个空要求什么语义方向？）
量A：（这个词的语义重心是什么？用尺子量——匹配还是偏离？）
量B：（同上）
量C：
量D：
排除：（哪些被尺子排除了？为什么偏了？）
选定：（哪个匹配尺子？引用上下文原文验证）
（空一行）
第二空
（同上）

3. 结论
两空尺子互相验证→故选X。

禁止写法: 禁止骑墙结论, 禁止脱离上下文单独解释词义, 禁止说固定搭配常用表述。

其他题型按原有格式输出。`

const STEP1_PROMPT = (m: string, q: string) =>
  `独立完成这道${m}题。

## 题目
${q}

输出JSON（只返回JSON）：
{"aiAnswer":"单个字母","questionType":"题型","difficulty":"难度+说明","examPoint":"考什么","keyDifferentiator":"关键分辨点","traps":"最有诱惑力的错误选项及原因","solution":"按系统指令格式输出完整思考过程"}`

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
{"rootCause":"${myAnswer ? '她选错的根本原因' : '最容易被选错的选项及原因'}。不编造她的选择","fix":"一个具体解题技巧","userErrorStep":"读题理解偏差/条件转换错误/计算错误/分类遗漏/选项辨析不足"}
只返回JSON。`

const DEFAULT_STEP1: Step1Result = {
  aiAnswer: '?', questionType: '未知', difficulty: '未知', examPoint: '未知', keyDifferentiator: '未知', solution: '解析异常', traps: '解析异常',
}

export async function deepseekDiagnose(
  questionStem: string, correctAnswer: string, myAnswer: string | undefined,
  moduleName: string, apiKey: string,
): Promise<DiagnosisResult> {
  const s1 = await callDS([
    { role: 'system', content: STEP1_SYSTEM },
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
      { role: 'system', content: STEP1_SYSTEM },
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
  if (!step2.fix || step2.fix === '请重试') step2.fix = '注意辨析近义词语境差异'

  return {
    aiAnswer, aiCorrect,
    difficulty: step1.difficulty,
    examPoint: step1.examPoint,
    keyDifferentiator: step1.keyDifferentiator,
    solution, traps,
    ...step2,
  }
}
