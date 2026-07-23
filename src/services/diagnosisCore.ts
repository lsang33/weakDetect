export interface DiagnosisResult {
  aiAnswer: string; aiCorrect: boolean; style: string; step1bCalled: boolean
  originalAiAnswer: string
  difficulty: string; examPoint: string; keyDifferentiator: string
  knowledgePoint: string; subCategory: string; module: string
  solution: string; traps: string
  userErrorStep: string; rootCause: string; fix: string
  /** STEP1 原始数据（STEP1B纠正前保留，供UI展示首次分析过程） */
  step1Solution?: string
  step1RootCause?: string
  step1AiAnswer?: string
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
  // 先尝试通用答案模式（适用于所有题型，不只是多部分判断题）
  const ans = solution.match(/答案[是为：:]\s*([A-D])/); if (ans) return ans[1]
  const pick = solution.match(/[选应]为\s*([A-D])/); if (pick) return pick[1]
  const pick2 = solution.match(/[故应]选\s*([A-D])/); if (pick2) return pick2[1]

  // 多部分判断题（①②③ + 对/错）
  const items: { num: string; correct: boolean }[] = []
  const re = /([①-⑧])\s*(对|错)/g; let m: RegExpExecArray | null
  while ((m = re.exec(solution)) !== null) items.push({ num: m[1], correct: m[2] === '对' })
  if (items.length >= 2) {
    const correctNums = items.filter(i => i.correct).map(i => i.num).join('')
    const omre = /([A-D])\s*[.、]\s*([①②③④⑤⑥⑦⑧]+)/g; let om: RegExpExecArray | null
    while ((om = omre.exec(questionStem)) !== null) if (om[2] === correctNums) return om[1]
  }

  return null
}

export const BASE_SYSTEM = `你是公务员考试解题专家。
禁止使用任何数学逻辑符号（¬∧∨⊃→←），写中文"非""且""或""推出"。
逻辑判断推导必须每步写清原因，推导链不能断。
输出必须是严格的JSON格式，solution字段按下方风格要求书写。`

/** 花生十三体系模块方法论 — 诊断时参考，帮助定位具体操作失误 */
const MODULE_METHODOLOGY: Record<string, string> = {
  '资料分析': `【资料分析花生十三方法论】
- ABRX四要素：A=现期量 B=基期量 R=增长率 X=增长量，知二求二
- 速算三法：①截位直除（选项差距大截2位/差距小截3位）②415份数法（A÷(100+R) 每份×R得X）③假设分配法
- 比重/平均数变化：分子R>分母R则上升，差值单位百分点；平均数增长率=(总量R-份数R)/(1+份数R)
- 易错：增长率vs增长量混淆、比重差值单位是百分点非%、"是几倍"vs"多几倍"差1、时间/单位陷阱`,

  '数量关系': `【数量关系花生十三方法论】
- 核心技巧：赋值法、方程法、代入排除、十字交叉法
- 工程问题：赋总量为时间的最小公倍数；效率比型直接赋值效率
- 行程问题：相遇路程和=速度和×时间；追及路程差=速度差×时间；等距离平均速度=2v1v2/(v1+v2)
- 排列组合：相邻捆绑、不相邻插空、相同元素隔板法C(n-1,m-1)
- 牛吃草：草生长量=(牛1×天1-牛2×天2)/(天1-天2)；原有草/(牛数-生长量)=天数
- 易错：利润率分母是成本非售价、1m/s=3.6km/h、容斥"只A"不含重叠、至少用1-都不`,

  '言语理解与表达': `【言语理解花生十三方法论】
- 逻辑填空核心：找上下文暗示——反义对应（但/却）、并列对应（和/与）、递进对应（甚至）、解释对应（即/冒号）
- 语素差异法：近义词辨析从不同字入手找语义差异（如"制止"=stop vs"遏制"=restrain）
- 片段阅读中心句法：转折/递进/因果/对策词后是中心，优先级：对策>结论>论点
- 细节判断：检查概念/时态/范围/语气/有无/正反六个维度偷换
- 语句排序：代词（这/其/该）和配对关联词后半不能做首句；代词回指+同词配对形成捆绑
- 易错：凭语感选不看对应、转折后是重点、成语望文生义、程度轻重不匹配`,

  '判断推理': `【判断推理花生十三方法论】
- 图形推理规律优先级："组成相同看位置，相似看样式，不同看数量，不行看属性"
- 一笔画判定：奇点数=0或2可一笔画；常见一笔画：圆、三角形、五角星
- 逻辑判断翻译公式：如果/就→前推后；只有/才→后推前；除非否则→¬A→B。仅逆否等价，肯后/否前无效
- 真假推理：找矛盾对（一真一假），矛盾外全确定
- 加强削弱力度链：削弱-否定论点>断开联系≈因果倒置>他因>举例；加强-补充论据>搭桥>排除他因>举例
- 定义判断：拆8要素（主体/客体/目的/方式/条件/原因/结果/性质），排除不合格项
- 类比推理：先找一级关系（语义/逻辑/语法），再做二级辨析（词性/感情色彩/程度）
- 易错：图形跳过位置样式直接数数、包含vs组成混淆、翻译推理肯后推肯前`,

  '常识判断': `【常识判断花生十三方法论】
- 排除法优先：找绝对化词（"一切/都/必然"）的选项大概率错
- 关键词法：从题干提取核心词，匹配选项中的对应概念
- 时政题：最近一次重大会议/讲话的选项优先`,

  '政治理论': `【政治理论花生十三方法论】
- 排除法优先：找绝对化词（"一切/都/必然"）的选项大概率错
- 关键词法：从题干提取核心词，匹配选项中的对应概念
- 时政题：最近一次重大会议/讲话的选项优先`,
}

export const STEP1_PROMPT = (m: string, q: string, myAnswer?: string) => {
  const method = MODULE_METHODOLOGY[m] || ''
  return `独立完成这道${m}题。如果是逻辑判断题，用中文写推导，每步解释原因——不是"由(2)假得"，而是完整说明为什么假。
${method ? `\n## 参考方法论\n${method}\n` : ''}
## 题目\n${q}${myAnswer ? `\n（用户选择了${myAnswer}，分析时请针对这个错误选项说明错因）` : ''}
输出JSON：
{"aiAnswer":"单个字母","questionType":"题型","difficulty":"难度+说明","examPoint":"考什么","keyDifferentiator":"关键分辨点","knowledgePoint":"具体知识点","subCategory":"细分考点","module":"言语理解与表达/数量关系/判断推理/资料分析/常识判断/政治理论","traps":"最有诱惑力的错误选项及其原因（题目设计的客观陷阱）","userErrorCause":"做错这道题最可能的思维原因（从做题者角度）","improvementMethod":"针对这个错因的改进方法（30字内）","solution":"解析内容"}
只返回JSON。`
}

export const STEP1B_PROMPT = (m: string, q: string, correctAnswer: string, myAnswer?: string) => {
  const method = MODULE_METHODOLOGY[m] || ''
  return `正确答案是${correctAnswer}。基于此推导解法。${myAnswer ? `用户选择了${myAnswer}，分析时请针对这个错误选项说明错因。` : ''}
${method ? `\n## 参考方法论\n${method}\n` : ''}
## 题目\n${q}\n输出JSON：{"aiAnswer":"${correctAnswer}","difficulty":"...","examPoint":"...","keyDifferentiator":"...","knowledgePoint":"...","subCategory":"...","module":"...","traps":"...","userErrorCause":"做错这道题最可能的思维原因（从做题者角度）","improvementMethod":"针对这个错因的改进方法（30字内）","solution":"解析内容"}`
}

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

  // 快照 STEP1 原始数据（STEP1B 覆盖前保留）
  const step1Solution = step1.solution
  const step1RootCause = step1.userErrorCause
  const step1AiAnswer = aiAnswer

  if (aiAnswer !== cleanAnswer(correctAnswer)) {
    step1bCalled = true
    s1b = await callApi([
      { role: 'system', content: sysMsg },
      { role: 'user', content: STEP1B_PROMPT(moduleName, questionStem, correctAnswer, myAnswer) },
    ], 6000)
    const fixup = parseJson<Step1Result>(s1b, { ...DEFAULT_STEP1, aiAnswer: correctAnswer })
    // Step1b 解析失败时不覆盖 Step1 原有的有效内容
    if (fixup.solution !== '解析异常') solution = fixup.solution
    if (fixup.traps !== '解析异常') traps = fixup.traps
    if (fixup.userErrorCause) userErrorCause = fixup.userErrorCause
    if (fixup.improvementMethod) improvementMethod = fixup.improvementMethod
    aiAnswer = cleanAnswer(correctAnswer)
  }

  return {
    aiAnswer, aiCorrect: step1bCalled ? false : true, style, step1bCalled, originalAiAnswer,
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
    step1Solution: step1bCalled ? step1Solution : undefined,
    step1RootCause: step1bCalled ? step1RootCause : undefined,
    step1AiAnswer: step1bCalled ? step1AiAnswer : undefined,
    rawStep1: s1,
    rawStep1b: step1bCalled ? s1b : undefined,
  }
}
