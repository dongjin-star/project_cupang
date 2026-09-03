import filterData from '@/data/filterTemplates.json'
import noticeData from '@/data/noticeTemplates.json'
import { findCategory } from '@/lib/categories'
import { isHeatSensitive } from '@/lib/policyCheck'
import type {
  ConfirmedInfo,
  CostInfo,
  FilterDropdown,
  ListingOutput,
  NoticeField,
} from '@/types/listing'

type FilterTemplate = {
  label: string
  dropdowns: { key: string; options: string[]; default: string; needsVerify?: boolean }[]
  inputs: { key: string; source: string }[]
}

type NoticeTemplate = {
  label: string
  fields: { key: string; source: string }[]
}

const filterTemplates = filterData as unknown as Record<string, FilterTemplate> & {
  blanks: { key: string; reason: string }[]
}
const noticeTemplates = noticeData as unknown as Record<string, NoticeTemplate>

export const WARRANTY_TEXT =
  '제품 이상 시 공정거래위원회 고시 소비자분쟁해결기준에 의거 보상합니다.'

export function buildCatalogMatch(): ListingOutput['catalogMatch'] {
  return {
    value: '건너뜀',
    reason: '신규 상품은 매칭할 기존 카탈로그가 없습니다.',
  }
}

export function buildSalesMethod(
  cost: CostInfo,
  confirmed: ConfirmedInfo,
): ListingOutput['salesMethod'] {
  if (confirmed.fragile) {
    return {
      value: 'seller',
      label: '판매자배송',
      reason: '파손 위험이 높은 상품은 물류센터 이동 중 손상 위험이 커 판매자배송을 권장합니다.',
    }
  }
  if (cost.salePrice > 0 && cost.salePrice < 5000) {
    return {
      value: 'seller',
      label: '판매자배송',
      reason: '판매가 5,000원 미만은 로켓그로스 물류비가 마진을 잠식합니다.',
    }
  }
  if (cost.salePrice >= 10000) {
    return {
      value: 'rocket_growth',
      label: '로켓그로스',
      reason: '판매가 10,000원 이상이고 부피가 중간 이하라 물류비 대비 마진 확보가 가능합니다.',
    }
  }
  return {
    value: 'rocket_growth',
    label: '로켓그로스',
    reason: '판매가 5,000~10,000원 구간 — 물류비 확정 후 마진을 재확인하세요.',
  }
}

export function buildMainInfo(): ListingOutput['mainInfo'] {
  return {
    items: [
      { key: '제조사', value: '수입산', note: '제조사가 불명이면 회사명을 지어내지 않습니다.' },
      { key: '상품 구성', value: '동일한 상품으로 구성됨' },
      { key: '인증정보', value: '인증·신고 대상 아님', note: '카테고리·소재 기준 판단' },
      { key: '병행수입', value: '병행수입 아님' },
      { key: '구매 연령', value: '전체 연령' },
      { key: '인당 최대구매수량', value: '설정안함' },
      { key: '판매기간', value: '설정안함' },
      {
        key: '부가세',
        value: '과세',
        note: '판매가에 부가세 10%가 포함됩니다. 마진 계산에 반영되어 있습니다.',
      },
    ],
  }
}

export function buildImageSpec(): {
  mainImage: ListingOutput['mainImage']
  detailPage: ListingOutput['detailPage']
} {
  return {
    mainImage: {
      status: '범위 외 — 별도 준비',
      spec: '권장 1,000×1,000px / 최소 500px / 10MB 이하 / 대표 1장 + 추가 최대 9장',
      note: '로켓그로스는 물류센터에서 실물과 이미지를 대조하므로 실사 사용을 권장합니다.',
    },
    detailPage: {
      status: '범위 외 — 별도 준비',
      spec: '권장 780 × 5,000px / 10MB 이하 / JPG·PNG',
    },
  }
}

export function buildFilters(
  confirmed: ConfirmedInfo,
  hints: { key: string; value: string }[],
): ListingOutput['filters'] {
  const category = findCategory(confirmed.categoryKey)
  const template = filterTemplates[category.filterKey] ?? filterTemplates.generic
  const heatSensitive = isHeatSensitive(confirmed.material)

  const dropdowns: FilterDropdown[] = template.dropdowns.map((d) => {
    const hint = hints.find((h) => h.key === d.key)
    let value = hint && d.options.includes(hint.value) ? hint.value : d.default

    if (d.key === '세척 용이성' && heatSensitive && value.includes('식기세척기')) {
      value = '손세척'
    }
    return { key: d.key, value, needsVerify: d.needsVerify }
  })

  const { longEdge, shortEdge } = edges(confirmed)
  const dims: Record<string, number> = {
    height: confirmed.size.height,
    longEdge,
    shortEdge,
  }
  const inputs = template.inputs.map((i) => ({
    key: i.key,
    value: dims[i.source] ? String(dims[i.source]) : '',
  }))

  return {
    dropdowns,
    inputs,
    blanks: filterTemplates.blanks,
    blockedNote: heatSensitive
      ? `소재가 ${confirmed.material}이므로 '세척 용이성'에서 식기세척기 관련 값을 선택할 수 없도록 차단했습니다.`
      : null,
  }
}

function edges(confirmed: ConfirmedInfo): { longEdge: number; shortEdge: number } {
  const { diameter, width, depth } = confirmed.size
  if (diameter) return { longEdge: diameter, shortEdge: diameter }
  const w = width ?? 0
  const d = depth ?? 0
  return { longEdge: Math.max(w, d), shortEdge: Math.min(w, d) || Math.max(w, d) }
}

export function formatSize(confirmed: ConfirmedInfo): string {
  const { diameter, width, depth, height } = confirmed.size
  if (diameter) return `지름 ${diameter}cm × 높이 ${height}cm`
  const parts: string[] = []
  if (width) parts.push(`가로 ${width}cm`)
  if (depth) parts.push(`세로 ${depth}cm`)
  parts.push(`높이 ${height}cm`)
  return parts.join(' × ')
}

export function formatComponents(confirmed: ConfirmedInfo): string {
  return confirmed.components.map((c) => `${c.label} ${c.count}개`).join(', ')
}

export function buildNotice(
  confirmed: ConfirmedInfo,
  generated: { productName: string; components: string; size: string },
  asContact: string,
): ListingOutput['notice'] {
  const category = findCategory(confirmed.categoryKey)
  const template = noticeTemplates[category.noticeKey] ?? noticeTemplates.living

  const values: Record<string, string> = {
    productName: generated.productName || confirmed.name,
    material: confirmed.material,
    components: generated.components || formatComponents(confirmed),
    size: generated.size || formatSize(confirmed),
    releaseYearMonth: confirmed.releaseYearMonth,
    manufacturer: '수입산 / 판매자',
    origin: confirmed.origin,
    importDeclaration: '해당없음',
    warranty: WARRANTY_TEXT,
    caution: isHeatSensitive(confirmed.material)
      ? '고온·직사광선을 피해 보관하고, 손세척 하십시오.'
      : '제품 특성에 맞게 취급하십시오.',
  }

  const fields: NoticeField[] = template.fields.map((f) => {
    if (f.source === 'userInput') {
      return {
        key: f.key,
        value: asContact.trim(),
        requiresUserInput: true,
      }
    }
    return { key: f.key, value: values[f.source] ?? '' }
  })

  return { categoryKey: category.noticeKey, categoryLabel: template.label, fields }
}

export function buildDocuments(): ListingOutput['documents'] {
  return {
    value: '없음',
    reason: '⑧ 상품 주요 정보에서 "인증·신고 대상 아님"을 선택했으므로 제출 서류가 없습니다.',
  }
}

export function buildFulfillmentInfo(): ListingOutput['fulfillmentInfo'] {
  return {
    value: '나중에 입력',
    reason: '입고 수량·날짜가 확정된 뒤 별도 프로세스에서 입력합니다.',
  }
}

export function buildChecklist(confirmed: ConfirmedInfo): ListingOutput['inboundChecklist'] {
  const items = [
    '바코드 유무 확인 — 없으면 직접 부착',
    '개별 포장 상태 확인',
    '등록 이미지와 실물 일치 확인',
  ]

  if (confirmed.fragile) {
    items.splice(2, 0, '완충재 포함 여부 확인 (파손 위험 소재)')
  }

  for (const c of confirmed.components) {
    if (c.count > 1) items.push(`${c.label} ${c.count}개 확인`)
  }

  return items.map((item) => ({ item, checked: false }))
}

export function buildOptions(
  confirmed: ConfirmedInfo,
  cost: CostInfo,
  sizeLabel: string,
  sizeAlternatives: string[],
): ListingOutput['options'] {
  const badLabels = ['소형', '미니', '대형', 'Free', 'FREE', '프리사이즈']
  const hit = badLabels.find((b) => sizeLabel.includes(b))

  const color = `${confirmed.color}(색상)`
  const qty = `${confirmed.qtyPerUnit}개`

  return {
    size: sizeLabel,
    color,
    qty,
    combinedLabel: `${sizeLabel}, ${confirmed.color}, ${qty}`,
    listPrice: cost.listPrice,
    salePrice: cost.salePrice,
    stockHint: '10~20개 (초기 권장)',
    sizeWarning: hit
      ? `"${hit}"은 크기 형용사입니다. 같은 가격이 비싸 보여 전환율이 떨어집니다 — 구조·수치 라벨로 바꾸세요.`
      : null,
    sizeAlternatives,
  }
}

export function buildTodos(
  notice: ListingOutput['notice'],
  cost: CostInfo,
): string[] {
  const todos = ['상품이미지 준비 (대표 1장 + 추가 최대 9장)', '상세설명 이미지 준비']

  const asField = notice.fields.find((f) => f.requiresUserInput)
  if (asField && !asField.value) {
    todos.push('A/S 연락처 확정 (안심번호 050/0507 발급 권장)')
  }
  if (cost.fulfillmentFee === null) {
    todos.push('로켓그로스 물류비 확인 → 판매가 확정')
  }
  return todos
}
