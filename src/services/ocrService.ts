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

/** 调用通义千问 VL 提取题目信息 */
export async function analyzeExamImage(imageFile: File, apiKey: string): Promise<OcrResult> {
  const base64 = await fileToBase64(imageFile)
  // 去掉 data:image/jpeg;base64, 前缀
  const imageData = base64.split(',')[1]

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

  const response = await fetch(DASHSCOPE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-vl-max',
      input: {
        messages: [
          {
            role: 'user',
            content: [
              { image: `data:image/jpeg;base64,${imageData}` },
              { text: prompt },
            ],
          },
        ],
      },
      parameters: {
        max_tokens: 2000,
      },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`API 调用失败: ${response.status} ${err}`)
  }

  const data = await response.json()
  const text = data?.output?.choices?.[0]?.message?.content?.[0]?.text

  if (!text) {
    throw new Error(`API 返回为空: ${JSON.stringify(data)}`)
  }

  // 提取 JSON（去掉 markdown 代码块标记）
  let json = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

  // 修复 JSON 字符串内未转义的控制字符
  json = json.replace(/"([^"\\]|\\.)*"/g, (match) => {
    return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
  })

  try {
    return JSON.parse(json) as OcrResult
  } catch {
    const match = json.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as OcrResult
    throw new Error(`AI 返回格式异常: ${json}`)
  }
}
