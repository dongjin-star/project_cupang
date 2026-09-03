'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExtractedInfo } from '@/types/listing'

const MAX_IMAGES = 5
const MAX_EDGE = 1280

type Shot = { id: string; preview: string; mimeType: string; data: string }

/** 캔버스로 긴 변 1280px까지 줄여 전송량을 줄인다. GIF는 애니메이션이 깨지므로 원본을 쓴다. */
async function toPayload(file: File): Promise<Shot> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'))
    reader.readAsDataURL(file)
  })

  const id = crypto.randomUUID()
  const raw = { id, preview: dataUrl, mimeType: file.type, data: dataUrl.split(',')[1] ?? '' }
  if (file.type === 'image/gif') return raw

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('이미지를 열지 못했습니다.'))
    el.src = dataUrl
  })

  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
  if (scale === 1 && dataUrl.length < 2_000_000) return raw

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return raw
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const resized = canvas.toDataURL('image/jpeg', 0.85)
  return { id, preview: resized, mimeType: 'image/jpeg', data: resized.split(',')[1] ?? '' }
}

export default function SourceIntake({
  onExtracted,
  disabled,
}: {
  onExtracted: (info: ExtractedInfo) => void
  disabled?: boolean
}) {
  const [shots, setShots] = useState<Shot[]>([])
  const [url, setUrl] = useState('')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const addFiles = useCallback(async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) return

    setError(null)
    try {
      const added = await Promise.all(images.map(toPayload))
      setShots((prev) => [...prev, ...added].slice(0, MAX_IMAGES))
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지를 불러오지 못했습니다.')
    }
  }, [])

  // 어디서든 Ctrl+V로 캡처 이미지를 붙여넣을 수 있게 한다.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? [])
      if (files.some((f) => f.type.startsWith('image/'))) {
        e.preventDefault()
        void addFiles(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addFiles])

  async function analyze() {
    setError(null)
    setNotes(null)

    if (shots.length === 0 && !url.trim()) {
      setError('상품 이미지를 올리거나 상품 URL을 입력하세요.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          images: shots.map((s) => ({ mimeType: s.mimeType, data: s.data })),
        }),
      })
      const data = (await res.json()) as { extracted?: ExtractedInfo; error?: string }

      if (!res.ok || !data.extracted) {
        setError(data.error ?? '상품 정보를 읽지 못했습니다.')
        return
      }
      onExtracted(data.extracted)
      setNotes(data.extracted.notes || null)
    } catch {
      setError('네트워크 오류로 분석하지 못했습니다. 다시 시도하세요.')
    } finally {
      setLoading(false)
    }
  }

  const busy = loading || disabled

  return (
    <section className="rounded-xl border border-accent bg-accent-soft p-4 sm:p-5">
      <h2 className="text-base font-semibold">1단계 · 상품 소스 넣기</h2>
      <p className="mt-1 text-sm text-muted">
        상품 이미지나 도매 상품 URL을 넣으면 AI가 아래 항목을 대신 채웁니다. 채워진 값은 그대로
        수정할 수 있습니다.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void addFiles(Array.from(e.dataTransfer.files))
        }}
        className={`mt-4 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
          dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface'
        }`}
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="sr-only"
          onChange={(e) => {
            void addFiles(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy || shots.length >= MAX_IMAGES}
          className="h-11 rounded-lg border border-line-strong bg-surface px-5 text-sm font-medium transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          상품 이미지 선택
        </button>
        <p className="mt-2 text-xs text-faint">
          끌어다 놓거나 Ctrl+V로 붙여넣어도 됩니다 · 최대 {MAX_IMAGES}장
        </p>

        {shots.length > 0 && (
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {shots.map((shot) => (
              <li key={shot.id} className="relative">
                {/* 로컬 data URL 미리보기라 next/image 최적화 대상이 아니다. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.preview}
                  alt="업로드한 상품 이미지"
                  className="size-20 rounded-md border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => setShots((prev) => prev.filter((s) => s.id !== shot.id))}
                  aria-label="이미지 제거"
                  className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border border-line-strong bg-surface text-xs text-muted transition-colors hover:border-danger hover:text-danger"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium">도매 상품 URL</span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://domeggook.com/63790470"
          className="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none transition-colors focus:border-accent"
        />
        <span className="mt-1 block text-xs text-faint">
          로그인이 필요한 페이지는 읽지 못합니다. 그럴 땐 상품 이미지를 함께 올려 주세요.
        </span>
      </label>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-danger-soft px-4 py-3 text-sm leading-relaxed text-danger"
        >
          {error}
        </p>
      )}

      {notes && (
        <p className="mt-3 rounded-lg bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn">
          {notes}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={analyze}
          disabled={busy}
          className="h-12 rounded-lg bg-accent px-6 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:px-8"
        >
          {loading ? '읽는 중…' : 'AI로 자동 채우기'}
        </button>
        {loading && (
          <span aria-live="polite" className="text-xs text-muted">
            이미지가 많거나 Gemini가 혼잡하면 1분까지 걸릴 수 있습니다. 자동으로 재시도합니다.
          </span>
        )}
      </div>
    </section>
  )
}
