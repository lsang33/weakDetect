export interface DiagnosisResult {
  aiAnswer: string; aiCorrect: boolean; style: string; step1bCalled: boolean
  originalAiAnswer: string
  difficulty: string; examPoint: string; keyDifferentiator: string
  knowledgePoint: string; subCategory: string; module: string
  solution: string; traps: string
  userErrorStep: string; rootCause: string; fix: string
  rawStep1?: string; rawStep1b?: string
}

export interface Step1Result {
  aiAnswer: string; questionType: string; difficulty: string; examPoint: string
  keyDifferentiator: string; knowledgePoint: string; subCategory: string; module: string
  solution: string; traps: string; userErrorCause: string; improvementMethod: string
}

export function parseJson<T>(text: string, fallback: T): T {
  let json = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  json = json.replace(/"([^"\\]|\\.)*"/g, m => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'))
  try { return JSON.parse(json) as T } catch {
    const m = json.match(/\{[\s\S]*\}/)
    if (m) { try { return JSON.parse(m[0]) as T } catch { return fallback } }
    return fallback
  }
}

export const cleanAnswer = (a: string) => a.trim().replace(/[. (（].*$/, '')

export function deriveAnswer(solution: string, questionStem: string): string | null {
  const items: { num: string; correct: boolean }[] = []
  const re = /([①-⑧])\s*(对|错)/g; let m: RegExpExecArray | null
  while ((m = re.exec(solution)) !== null) items.push({ num: m[1], correct: m[2] === '对' })
  if (items.length < 2) return null
  const ans = solution.match(/答案[是为：:]\s*([A-D])/); if (ans) return ans[1]
  const pick = solution.match(/[选应]为\s*([A-D])/); if (pick) return pick[1]
  const correctNums = items.filter(i => i.correct).map(i => i.num).join('')
  const omre = /([A-D])\s*[.、]\s*([①②③④⑤⑥⑦⑧]+)/g; let om: RegExpExecArray | null
  while ((om = omre.exec(questionStem)) !== null) if (om[2] === correctNums) return om[1]
  return null
}

export const BASE_SYSTEM = `你是公务员考试解题专家。
禁止使用任何数学逻辑符号（¬∧∨⊃→←），写中文"非""且""或""推出"。
逻辑判断推导必须每步写清原因，推导链不能断。
输出必须是严格的JSON格式，solution字段按下方风格要求书写。`

export const STEP1_PROMPT = (m: string, q: string, myAnswer?: string) =>
  `独立完成这道${m}题。如果是逻辑判断题，用中文写推导，每步解释原因——不是"由(2)假得"，而是完整说明为什么假。
## 题目\n${q}${myAnswer ? `\n（用户选择了${myAnswer}，分析时请针对这个错误选项说明错因）` : ''}
输出JSON：
{"aiAnswer":"单个字母","questionType":"题型","difficulty":"难度+说明","examPoint":"考什么","keyDifferentiator":"关键分辨点","knowledgePoint":"具体知识点","subCategory":"细分考点","module":"言语理解与表达/数量关系/判断推理/资料分析/常识判断/政治理论","traps":"最有诱惑力的错误选项及其原因（题目设计的客观陷阱）","userErrorCause":"做错这道题最可能的思维原因（从做题者角度）","improvementMethod":"针对这个错因的改进方法（30字内）","solution":"解析内容"}
只返回JSON。`

export const STEP1B_PROMPT = (m: string, q: string, correctAnswer: string, myAnswer?: string) =>
  `正确答案是${correctAnswer}。基于此推导解法。${myAnswer ? `用户选择了${myAnswer}，分析时请针对这个错误选项说明错因。` : ''}\n## 题目\n${q}\n输出JSON：{"aiAnswer":"${correctAnswer}","difficulty":"...","examPoint":"...","keyDifferentiator":"...","knowledgePoint":"...","subCategory":"...","module":"...","traps":"...","userErrorCause":"做错这道题最可能的思维原因（从做题者角度）","improvementMethod":"针对这个错因的改进方法（30字内）","solution":"解析内容"}`

export const DEFAULT_STEP1: Step1Result = {
  aiAnswer: '?', questionType: '未知', difficulty: '未知', examPoint: '未知', keyDifferentiator: '未知',
  knowledgePoint: '', subCategory: '', module: '', solution: '解析异常', traps: '解析异常',
  userErrorCause: '', improvementMethod: '',
}

export async function diagnose(
  questionStem: string, correctAnswer: string, myAnswer: string | undefined,
  moduleName: string, style: string,
  callApi: (messages: { role: string; content: string }[], maxTokens: number) => Promise<string>,
  sysMsg: string,
): Promise<DiagnosisResult> {
  const s1 = await callApi([
    { role: 'system', content: sysMsg },
    { role: 'user', content: STEP1_PROMPT(moduleName, questionStem, myAnswer) },
  ], 8000)
  const step1 = parseJson<Step1Result>(s1, DEFAULT_STEP1)

  let { solution, traps, userErrorCause, improvementMethod } = step1
  let step1bCalled = false
  let s1b = ''
  let aiAnswer = cleanAnswer(step1.aiAnswer)
  const originalAiAnswer = aiAnswer
  const derived = deriveAnswer(step1.solution, questionStem)
  if (derived && derived !== aiAnswer) aiAnswer = derived

  if (aiAnswer !== cleanAnswer(correctAnswer)) {
    step1bCalled = true
    s1b = await callApi([
      { role: 'system', content: sysMsg },
      { role: 'user', content: STEP1B_PROMPT(moduleName, questionStem, correctAnswer, myAnswer) },
    ], 3000)
    const fixup = parseJson<Step1Result>(s1b, { ...DEFAULT_STEP1, aiAnswer: correctAnswer })
    // Step1b 解析失败时不覆盖 Step1 原有的有效内容
    if (fixup.solution !== '解析异常') solution = fixup.solution
    if (fixup.traps !== '解析异常') traps = fixup.traps
    if (fixup.userErrorCause) userErrorCause = fixup.userErrorCause
    if (fixup.improvementMethod) improvementMethod = fixup.improvementMethod
    aiAnswer = cleanAnswer(correctAnswer)
  }

  return {
    aiAnswer, aiCorrect: true, style, step1bCalled, originalAiAnswer,
    difficulty: step1.difficulty,
    examPoint: step1.examPoint,
    keyDifferentiator: step1.keyDifferentiator,
    knowledgePoint: step1.knowledgePoint,
    subCategory: step1.subCategory,
    module: step1.module,
    solution, traps,
    rootCause: userErrorCause || '',
    fix: improvementMethod || '',
    userErrorStep: '未知',
    rawStep1: s1.slice(0, 500),
    rawStep1b: step1bCalled ? s1b.slice(0, 500) : undefined,
  }
}
