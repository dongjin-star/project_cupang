import type { Listing } from '@/types/listing'

const KEY = 'cupang-listing-current'

export function saveListing(listing: Listing) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listing))
  } catch {
    // 저장 실패(용량 초과·프라이빗 모드)는 무시한다 — 화면 표시가 우선
  }
}

export function loadListing(): Listing | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Listing) : null
  } catch {
    return null
  }
}

export function clearListing() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 무시
  }
}
