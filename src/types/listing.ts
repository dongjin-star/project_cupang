export type Confidence = 'high' | 'low'
export type TaxpayerType = 'general' | 'simplified'
export type MarginLevel = 'ok' | 'thin' | 'risky' | 'loss' | 'unknown'
export type ViolationLevel = 'block' | 'warn'

export type ComponentItem = {
  label: string
  count: number
}

export type ConfirmedInfo = {
  name: string
  material: string
  size: {
    diameter?: number
    width?: number
    depth?: number
    height: number
  }
  components: ComponentItem[]
  origin: string
  color: string
  qtyPerUnit: number
  fragile: boolean
  categoryKey: string
  sourceSite: string
  sourceProductNo: string
  releaseYearMonth: string
}

export type CostInfo = {
  unitPrice: number
  inboundShipping: number
  inboundQty: number
  fulfillmentFee: number | null
  taxpayerType: TaxpayerType
  listPrice: number
  salePrice: number
}

export type NameCandidate = {
  label: 'A' | 'B' | 'C'
  text: string
  length: number
}

export type CategoryOption = {
  path: string
  feeRate: number
}

export type FilterDropdown = {
  key: string
  value: string
  needsVerify?: boolean
}

export type NoticeField = {
  key: string
  value: string
  requiresUserInput?: boolean
}

export type ListingOutput = {
  catalogMatch: { value: string; reason: string }
  salesMethod: { value: 'rocket_growth' | 'seller'; label: string; reason: string }
  displayName: {
    noBrand: boolean
    candidates: NameCandidate[]
    internalName: string
    reason: string
  }
  category: {
    path: string
    feeRate: number
    alternatives: CategoryOption[]
    reason: string
  }
  options: {
    size: string
    color: string
    qty: string
    combinedLabel: string
    listPrice: number
    salePrice: number
    stockHint: string
    sizeWarning: string | null
    sizeAlternatives: string[]
  }
  mainImage: { status: string; spec: string; note: string }
  detailPage: { status: string; spec: string }
  mainInfo: {
    items: { key: string; value: string; note?: string }[]
  }
  tags: {
    list: string[]
    joined: string
    breakdown: { core: number; usage: number; attribute: number; longtail: number }
  }
  filters: {
    dropdowns: FilterDropdown[]
    inputs: { key: string; value: string }[]
    blanks: { key: string; reason: string }[]
    blockedNote: string | null
  }
  notice: {
    categoryKey: string
    categoryLabel: string
    fields: NoticeField[]
  }
  documents: { value: string; reason: string }
  fulfillmentInfo: { value: string; reason: string }
  inboundChecklist: { item: string; checked: boolean }[]
}

export type MarginResult = {
  breakdown: { label: string; amount: number }[]
  net: number | null
  rate: number | null
  level: MarginLevel
  refund: number
  message: string
}

export type Violation = {
  section: string
  text: string
  level: ViolationLevel
  reason: string
  fix: string
}

export type Listing = {
  id: string
  source: { site: string; url?: string; capturedAt: string }
  confirmed: ConfirmedInfo
  cost: CostInfo
  output: ListingOutput
  margin: MarginResult
  violations: Violation[]
  todos: string[]
}

export type GeneratedText = {
  displayNames: { label: 'A' | 'B' | 'C'; text: string }[]
  displayNameReason: string
  internalName: string
  categoryPath: string
  categoryReason: string
  sizeLabel: string
  sizeAlternatives: string[]
  tags: string[]
  noticeProductName: string
  noticeComponents: string
  noticeSize: string
  filterHints: { key: string; value: string }[]
}
