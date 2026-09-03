import { GoogleGenAI } from '@google/genai'
import { findCategory } from '@/lib/categories'
import { formatComponents, formatSize } from '@/lib/rules'
import type { ConfirmedInfo, GeneratedText } from '@/types/listing'

const MODEL = 'gemini-3.6-flash'

const responseJsonSchema = {
  type: 'object',
  properties: {
    displayNames: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', enum: ['A', 'B', 'C'] },
          text: { type: 'string' },
        },
        required: ['label', 'text'],
      },
    },
    displayNameReason: { type: 'string' },
    internalName: { type: 'string' },
    categoryPath: { type: 'string' },
    categoryReason: { type: 'string' },
    sizeLabel: { type: 'string' },
    sizeAlternatives: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    tags: { type: 'array', minItems: 20, maxItems: 20, items: { type: 'string' } },
    noticeProductName: { type: 'string' },
    noticeComponents: { type: 'string' },
    noticeSize: { type: 'string' },
    filterHints: {
      type: 'array',
      items: {
        type: 'object',
        properties: { key: { type: 'string' }, value: { type: 'string' } },
        required: ['key', 'value'],
      },
    },
  },
  required: [
    'displayNames',
    'displayNameReason',
    'internalName',
    'categoryPath',
    'categoryReason',
    'sizeLabel',
    'sizeAlternatives',
    'tags',
    'noticeProductName',
    'noticeComponents',
    'noticeSize',
    'filterHints',
  ],
}

function buildPrompt(confirmed: ConfirmedInfo, filterKeys: string[]): string {
  const category = findCategory(confirmed.categoryKey)
  const altPaths = category.alternatives.map((a) => a.path).join('\n  - ')

  return `당신은 쿠팡 상품등록 전문가입니다. 아래 확정된 상품 정보로 쿠팡 WING 등록 폼에 넣을 값을 생성하세요.

## 확정 상품 정보
- 품명: ${confirmed.name}
- 소재: ${confirmed.material}
- 크기: ${formatSize(confirmed)}
- 구성품: ${formatComponents(confirmed) || '단일 구성'}
- 색상: ${confirmed.color}
- 단위 수량: ${confirmed.qtyPerUnit}개
- 원산지: ${confirmed.origin}
- 출시년월: ${confirmed.releaseYearMonth}
- 도매 사이트: ${confirmed.sourceSite} / 상품번호: ${confirmed.sourceProductNo || '없음'}

## 카테고리 후보 (이 중에서만 고르세요)
  - ${category.path}  (기본 추천)
  - ${altPaths}

## 생성 규칙

### displayNames — 노출상품명 3개 안 (A·B·C)
- 구조: 상품 유형 + 핵심 특징 + 용도 키워드 3~5개
- 각 100자 이내 (한글 기준)
- 3개 안은 키워드 조합 자체를 다르게 한다. 같은 단어를 재배열만 하는 것은 금지.
- 금지: 타사 브랜드명(다이소·이케아·락앤락 등), 최상급 표현(최고·1위·최저가·유일), 특수문자 남발
- 소재가 플라스틱 계열(PET/PVC/PP/아크릴)이면 "식기세척기", "열탕", "내열", "전자레인지" 표현 절대 사용 금지
- "식품용", "식품 직접 접촉" 표현 금지

### internalName — 등록상품명(판매자 관리용)
- 형식: [사이트][상품번호]_[축약명]  (예: 도매꾹63790470_회전트레이2단)

### categoryPath / categoryReason
- 위 후보 중 가장 적합한 경로 하나를 그대로 복사해 넣고, 한 줄 근거를 쓴다.

### sizeLabel — 옵션 사이즈 라벨
- ⭐ 크기 형용사(소형·미니·대형·Free) 절대 금지. 구조 또는 수치 라벨을 쓴다.
- 좋은 예: "2단", "지름 23cm", "3구"
- sizeAlternatives에는 다른 라벨 후보 2개를 넣는다.

### tags — 검색어 태그 정확히 20개
- 구성 비율: 핵심 대표어 3개 / 용도별 8개 / 속성 3개 / 롱테일 6개
- 각 태그는 띄어쓰기 없는 한글 조합어로 쓴다 (예: 회전트레이, 냉장고정리용품)
- 금지: 타사 브랜드명, 상품과 무관한 인기 키워드

### noticeProductName / noticeComponents / noticeSize
- 상품정보제공고시용 표기. 품명은 간결한 정식 명칭, 구성품은 "트레이 2개, 기둥 3개" 형식, 크기는 위 크기를 그대로 표기.

### filterHints — 검색필터 추천값
- 아래 항목 각각에 대해 이 상품에 맞는 값을 추천한다. 확신이 없으면 그 항목은 생략한다.
- 항목: ${filterKeys.join(', ')}

응답은 지정된 JSON 스키마를 따르는 순수 JSON만 반환하세요.`
}

export async function generateListingText(
  confirmed: ConfirmedInfo,
  filterKeys: string[],
): Promise<GeneratedText> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY가 설정되지 않았습니다. 프로젝트 루트의 .env.local 파일에 GEMINI_API_KEY=발급받은키 를 추가하고 개발 서버를 다시 시작하세요.',
    )
  }

  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildPrompt(confirmed, filterKeys),
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema,
      temperature: 0.7,
    },
  })

  const text = response.text
  if (!text) throw new Error('Gemini 응답이 비어 있습니다. 잠시 후 다시 시도하세요.')

  return parseGenerated(text, confirmed)
}

function parseGenerated(text: string, confirmed: ConfirmedInfo): GeneratedText {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')

  let raw: Partial<GeneratedText>
  try {
    raw = JSON.parse(cleaned)
  } catch {
    throw new Error(
      'Gemini 응답을 JSON으로 읽지 못했습니다. 다시 생성해 주세요.',
    )
  }

  const category = findCategory(confirmed.categoryKey)

  return {
    displayNames: (raw.displayNames ?? []).slice(0, 3),
    displayNameReason: raw.displayNameReason ?? '',
    internalName: raw.internalName ?? '',
    categoryPath: raw.categoryPath ?? category.path,
    categoryReason: raw.categoryReason ?? '',
    sizeLabel: raw.sizeLabel ?? '',
    sizeAlternatives: raw.sizeAlternatives ?? [],
    tags: (raw.tags ?? []).slice(0, 20),
    noticeProductName: raw.noticeProductName ?? confirmed.name,
    noticeComponents: raw.noticeComponents ?? '',
    noticeSize: raw.noticeSize ?? '',
    filterHints: raw.filterHints ?? [],
  }
}
