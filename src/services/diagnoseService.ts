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

const SOLUTION_GUIDE = `如果是选词填空：每空逐一辨析四个选项（用 ✅⚠️❌ + 理由）。
如果是数量关系/资料分析：分'条件提取→分类→计算→答案'四步，每步写具体数值。
如果是片段阅读/判断推理：分析结构/逻辑链后，逐项辨析为什么对为什么错。
近义干扰项说清本质差异——"XXX侧重A，但语境需要B"。
每步用 \\n\\n 隔开。`

const STEP1_PROMPT = (m: string, q: string) =>
  `你是公务员考生，独立完成这道${m}题并给出完整解析。

## 题目
${q}

## 输出（只返回 JSON）
{
  "aiAnswer": "你的答案（单个字母或数值）",
  "difficulty": "难度评价（如：★★★☆☆ 中等偏难）+ 一句话说明难在哪",
  "examPoint": "这道题本质上在考什么——不是泛泛的'选词填空'，而是具体的考查维度，如'并列语境下近义动词细微差异辨析+政策文件固定搭配'",
  "keyDifferentiator": "正确答案和其他选项差距最小的那个维度是什么——即这道题最关键的分辨点。如'联动强调层级互动vs联结强调静态连接，一个'动'字决定了匹配'县城带动乡镇'的场景'",
  "traps": "哪个错误选项最有诱惑力，为什么",
  "solution": "${SOLUTION_GUIDE}"
}`

const STEP1B_PROMPT = (m: string, q: string, correctAnswer: string) =>
  `你是公务员考生，完成这道${m}题并解析。正确答案是 ${correctAnswer}，基于此推导解法。

## 题目
${q}

## 输出（只返回 JSON）
{
  "aiAnswer": "${correctAnswer}",
  "difficulty": "难度评价+一句话说明",
  "examPoint": "这道题本质上在考什么",
  "keyDifferentiator": "最关键的分辨点是什么",
  "traps": "最有诱惑力的错误选项及原因",
  "solution": "${SOLUTION_GUIDE}"
}`

const STEP2_PROMPT = (aiAnswer: string, solution: string, traps: string, correctAnswer: string, myAnswer: string | undefined) =>
  `AI解题结果：
- AI答案：${aiAnswer} ${aiAnswer === correctAnswer ? '(正确)' : '(错误)'}
- 解题思路：${solution}
- 陷阱：${traps}

实际：正确答案=${correctAnswer}${myAnswer ? `，她的答案=${myAnswer}（错）` : ''}

输出JSON：
{
  "rootCause": "诊断她的错因——她若选了错误选项，说明她被哪个维度迷惑了、本质差在哪",
  "fix": "针对这道题最有效的解题技巧一句话",
  "userErrorStep": "读题理解偏差/条件转换错误/计算错误/分类遗漏/选项辨析不足"
}
只返回JSON。`

const DEFAULT_STEP1: Step1Result = {
  aiAnswer: '?', difficulty: '未知', examPoint: '未知', keyDifferentiator: '未知', solution: '解析异常', traps: '解析异常',
}

export async function diagnoseMistake(
  questionStem: string, correctAnswer: string, myAnswer: string | undefined,
  moduleName: string, apiKey: string,
): Promise<DiagnosisResult> {
  const s1 = await callQwen(STEP1_PROMPT(moduleName, questionStem), apiKey)
  const step1 = parseJson<Step1Result>(s1, DEFAULT_STEP1)

  const aiCorrect = step1.aiAnswer.trim() === correctAnswer.trim()
  let { solution, traps } = step1
  const aiAnswer = step1.aiAnswer.trim()

  if (!aiCorrect) {
    const s1b = await callQwen(STEP1B_PROMPT(moduleName, questionStem, correctAnswer), apiKey)
    const fixup = parseJson<Step1Result>(s1b, { ...DEFAULT_STEP1, aiAnswer: correctAnswer })
    solution = fixup.solution
    traps = fixup.traps
  }

  const s2 = await callQwen(STEP2_PROMPT(aiAnswer, solution, traps, correctAnswer, myAnswer), apiKey)
  const step2 = parseJson<{ rootCause: string; fix: string; userErrorStep: string }>(s2, {
    rootCause: '诊断异常', fix: '请重试', userErrorStep: '未知',
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
