const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

export interface OcrResult {
  questionStem: string
  module: string
  knowledgePoint: string
  subCategory: string
  correctAnswer: string
  difficulty: 1 | 2 | 3 | 4 | 5
  judgmentSubType?: string
  errorType?: string
  explanation?: string
}

/** 将图片 File 转为 base64（做压缩） */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // 用 canvas 压缩到最长边 1024px 以内，减少上传时间和 token 消耗
      const img = new Image()
      img.onload = () => {
        const maxSize = 1024
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** 调用通义千问 VL API（通用内部函数） */
async function callVL(imageFile: File, apiKey: string, prompt: string): Promise<string> {
  const base64 = await fileToBase64(imageFile)
  const imageData = base64.split(',')[1]

  const response = await fetch(DASHSCOPE_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen-vl-max',
      input: {
        messages: [{
          role: 'user',
          content: [
            { image: `data:image/jpeg;base64,${imageData}` },
            { text: prompt },
          ],
        }],
      },
      parameters: { max_tokens: 4000 },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`API 调用失败: ${response.status} ${err}`)
  }

  const data = await response.json()
  const text = data?.output?.choices?.[0]?.message?.content?.[0]?.text
  if (!text) throw new Error(`API 返回为空: ${JSON.stringify(data)}`)
  return text
}

/** 从 JSON 字符串中提取并解析第一个对象/数组 */
function extractJsonArray<T>(text: string): T[] {
  let json = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  json = json.replace(/"([^"\\]|\\.)*"/g, (match: string) =>
    match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'))
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    const m = json.match(/\[[\s\S]*\]/)
    if (m) { try { return JSON.parse(m[0]) as T[] } catch { /* fall */ } }
    const o = json.match(/\{[\s\S]*\}/)
    if (o) { try { return [JSON.parse(o[0]) as T] } catch { /* fall */ } }
    throw new Error(`AI 返回格式异常: ${json.slice(0, 300)}`)
  }
}

/** 调用通义千问 VL 提取题目信息（单题） */
export async function analyzeExamImage(imageFile: File, apiKey: string): Promise<OcrResult> {
  const prompt = `你是一位公务员考试辅导专家。请分析这道题目的图片，返回 JSON 格式（只返回 JSON，不要其他任何文字）：

{
  "questionStem": "题目完整原文，包括所有选项",
  "module": "言语理解与表达/数量关系/判断推理/资料分析/常识判断",
  "knowledgePoint": "具体知识点，如：排列组合-分类讨论/主旨概括-转折关系/增长率计算-基期比重",
  "subCategory": "细分考点，如：容斥原理/工程问题/细节理解题",
  "correctAnswer": "正确答案（单个选项字母或数值）",
  "difficulty": 1-5的整数,
  "judgmentSubType": "仅判断推理模块填写：图形推理/定义判断/类比推理/逻辑判断，其他模块不填",
  "explanation": "简短解题思路（100字以内）"
}

注意：
- module 必须是五个选项之一，不要加其他文字
- 如果图片中有打钩、划线等标记，正确答案是标记的选项
- 如果有"答案：C"等标识，以标识为准
- knowledgePoint 要具体到题型特征，不要笼统
- 保持题目原文完整，包括选项内容`

  const text = await callVL(imageFile, apiKey, prompt)
  let json = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  json = json.replace(/"([^"\\]|\\.)*"/g, (match: string) =>
    match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'))
  try {
    const result = JSON.parse(json) as OcrResult
    result.questionStem = formatQuestionStem(result.questionStem)
    return result
  } catch {
    const match = json.match(/\{[\s\S]*\}/)
    if (match) {
      const result = JSON.parse(match[0]) as OcrResult
      result.questionStem = formatQuestionStem(result.questionStem)
      return result
    }
    throw new Error(`AI 返回格式异常: ${json}`)
  }
}

/** 调用通义千问 VL 提取图片中所有题目（批量） */
export async function analyzeExamImageBatch(imageFile: File, apiKey: string): Promise<OcrResult[]> {
  const prompt = `你是一位公务员考试辅导专家。这张图片可能包含多道考试题目。请逐道提取每道题的完整信息，返回 JSON 数组（只返回 JSON，不要其他任何文字）：

{
  "questionStem": "题目完整原文，包括所有选项",
  "module": "言语理解与表达/数量关系/判断推理/资料分析/常识判断",
  "knowledgePoint": "具体知识点，如：排列组合-分类讨论/主旨概括-转折关系/增长率计算-基期比重",
  "subCategory": "细分考点，如：容斥原理/工程问题/细节理解题",
  "correctAnswer": "正确答案（单个选项字母或数值）",
  "difficulty": 1-5的整数,
  "judgmentSubType": "仅判断推理模块填写：图形推理/定义判断/类比推理/逻辑判断，其他模块不填",
  "explanation": "简短解题思路（100字以内）"
}

注意：
- 尽可能识别图片中所有题目，按顺序排列
- 如果某道题不完整或无法识别，跳过它
- 如果图片中只有一道题，仍然返回数组格式 [{...}]
- 保持题干原文完整，包括所有选项
- 如果图片有多个位置标注了答案，一一对应`

  const text = await callVL(imageFile, apiKey, prompt)
  const results = extractJsonArray<OcrResult>(text)
  results.forEach(r => { r.questionStem = formatQuestionStem(r.questionStem) })
  return results
}

/** 修复选项换行：确保每个 A. B. C. D. 前有换行 */
function formatQuestionStem(stem: string): string {
  // 中文顿号选项：A、B、C、D
  let fixed = stem.replace(/([^、\n])([A-E]、)/g, '$1\n$2')
  // 英文点号选项：A. B. C. D.
  fixed = fixed.replace(/([^.\n])([A-E]\.)\s*/g, '$1\n$2')
  // 括号选项：(A) (B) (C) (D)
  fixed = fixed.replace(/([^)\n])(\([A-E]\))/g, '$1\n$2')
  return fixed
}
