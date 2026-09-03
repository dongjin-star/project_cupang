import { NextResponse } from 'next/server'
import { extractProductInfo } from '@/lib/extract'
import type { ExtractSource } from '@/types/listing'

export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_IMAGES = 5
const MAX_IMAGE_BYTES = 6 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request: Request) {
  let body: Partial<ExtractSource>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : []

  if (images.length === 0 && !url) {
    return NextResponse.json(
      { error: '상품 이미지를 올리거나 상품 URL을 입력하세요.' },
      { status: 400 },
    )
  }

  for (const image of images) {
    if (!ALLOWED_MIME.includes(image?.mimeType)) {
      return NextResponse.json(
        { error: 'JPG·PNG·WEBP·GIF 이미지만 올릴 수 있습니다.' },
        { status: 400 },
      )
    }
    if (typeof image.data !== 'string' || image.data.length * 0.75 > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: '이미지 한 장이 너무 큽니다 (6MB 초과).' }, { status: 400 })
    }
  }

  try {
    const extracted = await extractProductInfo({ images, url })
    return NextResponse.json({ extracted })
  } catch (error) {
    const message = error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
