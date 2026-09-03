import { ApiError, GoogleGenAI } from '@google/genai'
import type { GenerateContentParameters, GenerateContentResponse } from '@google/genai'

export const PRIMARY_MODEL = 'gemini-3.6-flash'
/** 기본 모델이 과부하(503)일 때만 쓰는 대체 모델. */
export const FALLBACK_MODEL = 'gemini-3.5-flash'

/** 일시적 장애로 판단해 재시도하는 HTTP 코드. */
const TRANSIENT = [429, 500, 502, 503, 504]
const RETRY_DELAYS_MS = [1200, 3500, 8000]

export function createClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY가 설정되지 않았습니다. 프로젝트 루트의 .env.local 파일에 GEMINI_API_KEY=발급받은키 를 추가하고 개발 서버를 다시 시작하세요.',
    )
  }
  return new GoogleGenAI({ apiKey })
}

function statusOf(error: unknown): number | null {
  if (error instanceof ApiError) return error.status
  // SDK 버전에 따라 상태 코드가 메시지 안의 JSON으로만 오는 경우가 있다.
  if (error instanceof Error) {
    const code = error.message.match(/"code"\s*:\s*(\d{3})/)?.[1]
    if (code) return Number(code)
  }
  return null
}

/** Gemini의 원본 JSON 에러 대신 사용자에게 보여줄 한국어 문구로 바꾼다. */
function friendlyMessage(status: number | null, error: unknown): string {
  switch (status) {
    case 429:
      return 'Gemini API 사용량 한도를 넘었습니다. 잠시 후 다시 시도하거나 API 키의 할당량을 확인하세요.'
    case 400:
      return '요청이 Gemini에 거부되었습니다. 이미지 형식이나 크기를 확인해 주세요.'
    case 401:
    case 403:
      return 'GEMINI_API_KEY가 유효하지 않거나 권한이 없습니다. .env.local의 키를 확인하세요.'
    case 404:
      return `모델 ${PRIMARY_MODEL}을(를) 찾을 수 없습니다. 모델명이 바뀌었는지 확인하세요.`
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Gemini 서버가 지금 혼잡합니다. 자동으로 몇 차례 재시도했지만 실패했습니다. 1~2분 뒤 다시 눌러 주세요.'
    default:
      return error instanceof Error && error.message.length < 200
        ? error.message
        : '생성 중 오류가 발생했습니다. 잠시 후 다시 시도하세요.'
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * generateContent를 재시도와 함께 호출한다.
 * 일시적 장애면 백오프를 두고 다시 시도하고, 기본 모델이 계속 과부하면 대체 모델로 한 번 더 시도한다.
 */
export async function generateWithRetry(
  params: Omit<GenerateContentParameters, 'model'>,
): Promise<GenerateContentResponse> {
  const ai = createClient()
  let lastError: unknown

  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await ai.models.generateContent({ ...params, model })
      } catch (error) {
        lastError = error
        const status = statusOf(error)

        if (status === null || !TRANSIENT.includes(status)) {
          throw new Error(friendlyMessage(status, error))
        }
        if (attempt < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[attempt] + Math.floor(Math.random() * 500)
          console.warn(`[gemini] ${model} ${status} — ${delay}ms 후 재시도 (${attempt + 1})`)
          await sleep(delay)
        }
      }
    }
    console.warn(`[gemini] ${model} 재시도 실패 — 다음 모델로 전환`)
  }

  throw new Error(friendlyMessage(statusOf(lastError), lastError))
}
