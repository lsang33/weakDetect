import { useState, useRef } from 'react'
import { Camera, Image, X, RefreshCw, Crop } from 'lucide-react'
import ReactCrop, { type Crop as CropType, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { analyzeExamImage, type OcrResult } from '../services/ocrService'

const API_ERR = '请先在设置页填写通义千问 API Key'

/** canvas 裁切 */
function cropImage(image: HTMLImageElement, crop: CropType): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height
    canvas.width = crop.width * scaleX
    canvas.height = crop.height * scaleY
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(
      image,
      crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY,
      0, 0, canvas.width, canvas.height,
    )
    canvas.toBlob((blob) => {
      resolve(new File([blob!], 'crop.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.85)
  })
}

export function CameraCapture({ onResult }: { onResult: (result: OcrResult) => void }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'crop' | 'analyzing' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [imgSrc, setImgSrc] = useState('')
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)
  const [crop, setCrop] = useState<CropType>()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  function handlePick(ref: React.RefObject<HTMLInputElement | null>) {
    if (!localStorage.getItem('dashscope_key')) {
      setStatus('error'); setErrorMsg(API_ERR); return
    }
    ref.current?.click()
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImgSrc(url)
    setStatus('loading') // 等图片加载完再显示裁切
    setErrorMsg('')
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    setImgEl(img)
    const c = centerCrop(
      makeAspectCrop({ unit: '%', width: 85, height: 65 }, 4 / 3, img.width, img.height),
      img.width, img.height,
    )
    setCrop(c)
    setStatus('crop') // 此时 crop 已就绪，ReactCrop 能正确渲染
  }

  async function handleCrop() {
    if (!imgEl || !crop) return
    setStatus('analyzing')
    try {
      const croppedFile = await cropImage(imgEl, crop)
      const result = await analyzeExamImage(croppedFile, localStorage.getItem('dashscope_key')!)
      setStatus('done')
      onResult(result)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : '识别失败，请重试')
    }
  }

  function reset() {
    setStatus('idle'); setErrorMsg(''); setImgSrc(''); setImgEl(null); setCrop(undefined)
    if (cameraRef.current) cameraRef.current.value = ''
    if (galleryRef.current) galleryRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
      <input ref={galleryRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {/* ① 初始：拍照/相册 */}
      {status === 'idle' && (
        <div className="flex gap-2">
          <button onClick={() => handlePick(cameraRef)}
            className="flex-1 py-3 rounded-xl bg-purple-500 hover:bg-purple-600 active:scale-[0.98] text-white font-medium flex items-center justify-center gap-2 transition-all">
            <Camera size={20} /> 拍照
          </button>
          <button onClick={() => handlePick(galleryRef)}
            className="flex-1 py-3 rounded-xl bg-slate-500 hover:bg-slate-600 active:scale-[0.98] text-white font-medium flex items-center justify-center gap-2 transition-all">
            <Image size={20} /> 相册
          </button>
        </div>
      )}

      {/* ② 图片加载中（隐藏 img 用来触发 onLoad） */}
      {status === 'loading' && (
        <div className="py-8 rounded-xl bg-slate-50 border border-slate-200 text-center animate-fade-in">
          <RefreshCw size={24} className="text-slate-400 mx-auto animate-spin mb-2" />
          <p className="text-sm text-slate-500">加载图片...</p>
          <img src={imgSrc} onLoad={onImageLoad} alt="" className="hidden" />
        </div>
      )}

      {/* ③ 裁切 */}
      {status === 'crop' && imgSrc && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-fade-in">
          <div className="bg-purple-50 px-3 py-2 flex items-center gap-2 border-b border-purple-100">
            <Crop size={14} className="text-purple-500" />
            <span className="text-xs text-purple-600 font-medium">拖动边框裁切题目区域</span>
          </div>
          <ReactCrop
            crop={crop}
            onChange={c => setCrop(c)}
            aspect={undefined}
            minWidth={40}
            minHeight={30}
            keepSelection
          >
            <img src={imgSrc} onLoad={onImageLoad} alt="" className="max-h-72 w-full object-contain bg-slate-100" />
          </ReactCrop>
          <div className="p-3 flex gap-2">
            <button onClick={reset} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">重新选择</button>
            <button onClick={handleCrop}
              className="flex-1 py-2 rounded-lg bg-purple-500 text-white text-sm font-medium active:scale-[0.98] transition-all">
              确认识别
            </button>
          </div>
        </div>
      )}

      {/* ③ 识别中 */}
      {status === 'analyzing' && (
        <div className="py-4 rounded-xl bg-purple-50 border border-purple-200 text-center animate-fade-in">
          <RefreshCw size={24} className="text-purple-500 mx-auto animate-spin mb-2" />
          <p className="text-sm text-purple-600 font-medium">AI 正在识别题目...</p>
          <p className="text-xs text-purple-400 mt-0.5">大约需要 1-2 秒</p>
        </div>
      )}

      {/* ④ 完成 */}
      {status === 'done' && (
        <div className="py-3 rounded-xl bg-green-50 border border-green-200 text-center animate-fade-in">
          <p className="text-sm text-green-600 font-medium">✅ 识别完成，表单已自动填写</p>
          <p className="text-xs text-green-400 mt-0.5">请核对后选择来源和难度，点保存</p>
          <button onClick={reset} className="text-xs text-purple-500 mt-2 underline">重新拍照</button>
        </div>
      )}

      {/* ⑤ 错误 */}
      {status === 'error' && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 animate-fade-in">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-red-600">{errorMsg}</p>
            <button onClick={reset}><X size={16} className="text-red-400" /></button>
          </div>
          <button onClick={reset} className="text-xs text-red-400 underline mt-2">重试</button>
        </div>
      )}
    </div>
  )
}
