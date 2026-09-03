import { NextResponse } from 'next/server'
import { buildListing, filterKeysFor } from '@/lib/buildListing'
import { generateListingText } from '@/lib/gemini'
import type { ConfirmedInfo, CostInfo } from '@/types/listing'

export const runtime = 'nodejs'

type RequestBody = {
  confirmed: ConfirmedInfo
  cost: CostInfo
  asContact: string
}

export async function POST(request: Request) {
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { confirmed, cost, asContact } = body
  if (!confirmed?.name || !confirmed?.material) {
    return NextResponse.json(
      { error: '품명과 소재는 필수 입력입니다.' },
      { status: 400 },
    )
  }

  try {
    const generated = await generateListingText(confirmed, filterKeysFor(confirmed.categoryKey))
    const listing = buildListing(confirmed, cost, generated, asContact ?? '')
    return NextResponse.json({ listing })
  } catch (error) {
    const message = error instanceof Error ? error.message : '생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
