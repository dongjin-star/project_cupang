import { categories, findCategory } from '@/lib/categories'
import { fetchProductPage } from '@/lib/fetchProductPage'
import { generateWithRetry } from '@/lib/geminiClient'
import type { ExtractSource, ExtractedInfo } from '@/types/listing'

const FIELD_KEYS = [
  'name',
  'material',
  'color',
  'origin',
  'componentsRaw',
  'categoryKey',
  'sourceSite',
  'sourceProductNo',
  'qtyPerUnit',
  'diameter',
  'width',
  'depth',
  'height',
  'unitPrice',
  'fragile',
] as const

const responseJsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    material: { type: 'string' },
    color: { type: 'string' },
    origin: { type: 'string' },
    componentsRaw: { type: 'string' },
    categoryKey: { type: 'string', enum: categories.map((c) => c.key) },
    sourceSite: { type: 'string' },
    sourceProductNo: { type: 'string' },
    qtyPerUnit: { type: 'number' },
    diameter: { type: 'number' },
    width: { type: 'number' },
    depth: { type: 'number' },
    height: { type: 'number' },
    unitPrice: { type: 'number' },
    fragile: { type: 'boolean' },
    lowConfidence: { type: 'array', items: { type: 'string', enum: [...FIELD_KEYS] } },
    notes: { type: 'string' },
  },
  required: [
    'name',
    'material',
    'color',
    'origin',
    'componentsRaw',
    'categoryKey',
    'sourceSite',
    'sourceProductNo',
    'lowConfidence',
    'notes',
  ],
}

function buildPrompt(url: string, page: { title: string; text: string } | null): string {
  const categoryList = categories.map((c) => `- ${c.key}: ${c.label} (${c.path})`).join('\n')

  const sourceBlock = page
    ? `## 상품 페이지 내용 (${url})
제목: ${page.title}

${page.text}`
    : url
      ? `## 상품 URL
${url}
(페이지 본문은 읽지 못했습니다. 이미지와 URL만 보고 판단하세요.)`
      : '## 입력\n첨부된 상품 이미지만 있습니다.'

  return `당신은 국내 도매 상품을 쿠팡에 등록하는 셀러의 보조입니다.
첨부된 상품 이미지와 아래 자료를 보고, 쿠팡 등록 폼에 넣을 상품 기본 정보를 추출하세요.

${sourceBlock}

## 카테고리 후보 (categoryKey는 반드시 이 key 중 하나)
${categoryList}

## 추출 규칙
- **추측하지 말 것.** 자료에서 확인되지 않는 값은 문자열이면 빈 문자열 "", 숫자면 아예 생략한다.
- name: 브랜드명·수식어를 뺀 상품 자체의 이름. 예) "회전형 투명 2단 트레이"
- material: 소재를 쉼표로 나열. 예) "PET, PVC, 스테인리스". 불명확하면 "".
- color: 대표 색상 하나. 예) "투명", "화이트"
- origin: 원산지. 표기가 없으면 ""로 두고 추측하지 않는다.
- componentsRaw: 구성품을 "이름 개수" 형태로 쉼표 구분. 예) "트레이 2, 기둥 3, 중앙 고정캡 1". 단일 구성이면 "".
- qtyPerUnit: 1개 주문 시 들어있는 낱개 수량. 명시가 없으면 1.
- diameter/width/depth/height: **cm 단위 숫자만**. mm로 적혀 있으면 cm로 환산한다. 원형 상품은 diameter+height, 사각형은 width+depth+height를 채운다. 자료에 없으면 생략.
- unitPrice: 도매 판매가(원). 숫자만. 소비자가·정가가 아니라 이 페이지의 도매 단가.
- sourceSite: 도매 사이트명. 예) "도매꾹", "도매매", "오너클랜". URL로 판단 가능하면 그것을 쓴다.
- sourceProductNo: 도매 사이트의 상품번호. URL의 숫자 ID를 쓸 수 있다.
- fragile: 유리·도자기 등 파손 위험이 큰 소재면 true.
- categoryKey: 위 목록에서 가장 가까운 하나.
- lowConfidence: 위 항목 중 **추측이 섞여 확인이 필요한 항목의 키 이름** 배열. 확실한 값만 넣었다면 빈 배열.
- notes: 사용자가 직접 확인해야 할 점을 한국어 한두 문장으로. 특이사항이 없으면 "".

응답은 지정된 JSON 스키마를 따르는 순수 JSON만 반환하세요.`
}

export async function extractProductInfo(source: ExtractSource): Promise<ExtractedInfo> {
  const url = source.url.trim()
  const images = [...source.images]
  let page: { title: string; text: string } | null = null

  if (url) {
    try {
      const fetched = await fetchProductPage(url)
      page = { title: fetched.title, text: fetched.text }
      if (fetched.image) images.push(fetched.image)
    } catch (error) {
      // 이미지가 있으면 페이지를 못 읽어도 계속 진행한다.
      if (images.length === 0) throw error
    }
  }

  if (images.length === 0 && !page) {
    throw new Error('상품 이미지 또는 읽을 수 있는 상품 URL이 필요합니다.')
  }

  const response = await generateWithRetry({
    contents: [
      {
        role: 'user',
        parts: [
          ...images.map((img) => ({
            inlineData: { mimeType: img.mimeType, data: img.data },
          })),
          { text: buildPrompt(url, page) },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema,
      temperature: 0.2,
    },
  })

  const text = response.text
  if (!text) throw new Error('Gemini 응답이 비어 있습니다. 잠시 후 다시 시도하세요.')

  return normalize(text, url)
}

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function normalize(text: string, url: string): ExtractedInfo {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')

  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(cleaned)
  } catch {
    throw new Error('Gemini 응답을 JSON으로 읽지 못했습니다. 다시 시도해 주세요.')
  }

  const str = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string).trim() : '')
  const categoryKey = findCategory(str('categoryKey')).key

  const lowConfidence = Array.isArray(raw.lowConfidence)
    ? (raw.lowConfidence as unknown[]).filter(
        (k): k is string => typeof k === 'string' && (FIELD_KEYS as readonly string[]).includes(k),
      )
    : []

  // 알 수 없는 key가 오면 findCategory가 첫 카테고리로 떨어뜨리므로 확인 대상으로 표시한다.
  if (categoryKey !== str('categoryKey') && !lowConfidence.includes('categoryKey')) {
    lowConfidence.push('categoryKey')
  }

  return {
    name: str('name'),
    material: str('material'),
    color: str('color'),
    origin: str('origin'),
    componentsRaw: str('componentsRaw'),
    categoryKey,
    sourceSite: str('sourceSite'),
    sourceProductNo: str('sourceProductNo') || url.match(/\/(\d{5,})(?:[/?#]|$)/)?.[1] || '',
    qtyPerUnit: positive(raw.qtyPerUnit),
    diameter: positive(raw.diameter),
    width: positive(raw.width),
    depth: positive(raw.depth),
    height: positive(raw.height),
    unitPrice: positive(raw.unitPrice),
    fragile: raw.fragile === true,
    lowConfidence,
    notes: str('notes'),
  }
}
