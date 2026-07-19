import type { MistakeRecord } from '../models/mistake'
import { MODULE_LABELS, ERROR_TYPE_LABELS } from '../lib/constants'

/** 生成导出文本 */
function generateText(mistakes: MistakeRecord[], mode: 'full' | 'exam'): string {
  const date = new Date().toLocaleDateString('zh-CN')
  const count = mistakes.length
  let text = `错题导出 - ${date}\n共 ${count} 道题\n\n`

  mistakes.forEach((m, i) => {
    const moduleLabel = MODULE_LABELS[m.module] || m.module
    const errorLabel = ERROR_TYPE_LABELS[m.errorType] || m.errorType
    const header = mode === 'exam'
      ? `${i + 1}.【${moduleLabel}】${m.knowledgePoint}`
      : `【${moduleLabel}】${m.knowledgePoint}  ${errorLabel}${m.starred ? '  ⭐' : ''}`

    text += `──────────────\n${header}\n题目：${m.questionStem || '(无原文)'}\n`

    if (mode === 'full') {
      text += `正确答案：${m.correctAnswer || '?'}`
      if (m.myAnswer) text += `    我的答案：${m.myAnswer}`
      text += '\n'
      if (m.quickDiagnosis?.rootCause) {
        text += `解析：${m.quickDiagnosis.rootCause}\n`
      }
      if (m.quickDiagnosis?.solution) {
        text += `方法：${m.quickDiagnosis.solution}\n`
      }
    } else {
      text += `答案：[    ]\n`
    }
    text += '\n'
  })

  return text
}

/** 生成打印用 HTML */
function generateHtml(mistakes: MistakeRecord[], mode: 'full' | 'exam'): string {
  const date = new Date().toLocaleDateString('zh-CN')
  const count = mistakes.length
  const title = mode === 'exam' ? `错题练习 - ${date}` : `错题导出 - ${date}`

  const items = mistakes.map((m, i) => {
    const moduleLabel = MODULE_LABELS[m.module] || m.module
    const errorLabel = ERROR_TYPE_LABELS[m.errorType] || m.errorType

    let body = ''
    if (mode === 'full') {
      body = `
        <div class="meta">
          <span class="module">${moduleLabel}</span>
          <span class="knowledge">${m.knowledgePoint}</span>
          <span class="error">${errorLabel}</span>
          ${m.starred ? '<span class="star">⭐</span>' : ''}
        </div>
        <div class="stem">${esc(m.questionStem || '(无原文)')}</div>
        <div class="answer">
          <span class="correct">正确答案：${m.correctAnswer || '?'}</span>
          ${m.myAnswer ? `<span class="my">我的答案：${m.myAnswer}</span>` : ''}
        </div>
        ${m.quickDiagnosis?.rootCause ? `<div class="analysis">解析：${esc(m.quickDiagnosis.rootCause)}</div>` : ''}
        ${m.quickDiagnosis?.solution ? `<div class="analysis">方法：${esc(m.quickDiagnosis.solution)}</div>` : ''}
      `
    } else {
      body = `
        <div class="meta">
          <span class="module">${moduleLabel}</span>
          <span class="knowledge">${m.knowledgePoint}</span>
        </div>
        <div class="stem">${esc(m.questionStem || '(无原文)')}</div>
        <div class="answer exam-answer">答案：[　　　　]</div>
      `
    }

    return `<div class="item"><div class="num">${i + 1}.</div><div class="content">${body}</div></div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 14px; color: #1e293b; padding: 20px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .count { font-size: 12px; color: #94a3b8; margin-bottom: 16px; }
  .item { display: flex; gap: 8px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed #e2e8f0; page-break-inside: avoid; }
  .num { font-weight: 700; color: #8b5cf6; min-width: 24px; }
  .content { flex: 1; }
  .meta { font-size: 12px; color: #64748b; margin-bottom: 4px; display: flex; gap: 6px; flex-wrap: wrap; }
  .module { background: #ede9fe; color: #6d28d9; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
  .knowledge { font-weight: 600; }
  .error { background: #f1f5f9; padding: 1px 4px; border-radius: 4px; }
  .star { font-size: 12px; }
  .stem { line-height: 1.7; margin: 6px 0; white-space: pre-wrap; }
  .answer { font-size: 12px; margin-top: 4px; }
  .correct { color: #16a34a; font-weight: 600; }
  .my { color: #dc2626; margin-left: 12px; }
  .analysis { font-size: 12px; color: #64748b; margin-top: 2px; line-height: 1.6; }
  .exam-answer { color: #94a3b8; }
  @media print {
    body { padding: 0; }
    .item { border-bottom-color: #cbd5e1; }
  }
</style>
</head>
<body>
  <h1>${title}</h1>
  <p class="count">共 ${count} 道题</p>
  ${items}
  <script>window.onload=function(){window.print()}</script>
</body>
</html>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 下载 TXT */
export function downloadTxt(mistakes: MistakeRecord[], mode: 'full' | 'exam') {
  const text = generateText(mistakes, mode)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const suffix = mode === 'exam' ? '练习' : '导出'
  a.href = url
  a.download = `错题${suffix}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 打印 PDF（打开新窗口 → 渲染 HTML → 触发打印） */
export function printPdf(mistakes: MistakeRecord[], mode: 'full' | 'exam') {
  const html = generateHtml(mistakes, mode)
  const w = window.open('', '_blank', 'width=800,height=600')
  if (!w) return
  w.document.write(html)
  w.document.close()
}

/** 复制到剪贴板 */
export async function copyText(mistakes: MistakeRecord[]) {
  const text = generateText(mistakes, 'full')
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}
