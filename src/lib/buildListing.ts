import filterData from '@/data/filterTemplates.json'
import { findCategory } from '@/lib/categories'
import { calcMargin } from '@/lib/margin'
import { checkAsPhone, scanAll } from '@/lib/policyCheck'
import {
  buildCatalogMatch,
  buildChecklist,
  buildDocuments,
  buildFilters,
  buildFulfillmentInfo,
  buildImageSpec,
  buildMainInfo,
  buildNotice,
  buildOptions,
  buildSalesMethod,
  buildTodos,
} from '@/lib/rules'
import type {
  ConfirmedInfo,
  CostInfo,
  GeneratedText,
  Listing,
  ListingOutput,
} from '@/types/listing'

export function filterKeysFor(categoryKey: string): string[] {
  const category = findCategory(categoryKey)
  const templates = filterData as unknown as Record<
    string,
    { dropdowns?: { key: string }[] }
  >
  const template = templates[category.filterKey] ?? templates.generic
  return (template.dropdowns ?? []).map((d) => d.key)
}

export function buildListing(
  confirmed: ConfirmedInfo,
  cost: CostInfo,
  generated: GeneratedText,
  asContact: string,
): Listing {
  const category = findCategory(confirmed.categoryKey)
  const selectedPath = category.alternatives.some((a) => a.path === generated.categoryPath)
    ? generated.categoryPath
    : category.path
  const feeRate =
    category.alternatives.find((a) => a.path === selectedPath)?.feeRate ?? category.feeRate

  const alternatives = [
    { path: category.path, feeRate: category.feeRate },
    ...category.alternatives,
  ].filter((a) => a.path !== selectedPath)

  const notice = buildNotice(
    confirmed,
    {
      productName: generated.noticeProductName,
      components: generated.noticeComponents,
      size: generated.noticeSize,
    },
    asContact,
  )

  const images = buildImageSpec()

  const output: ListingOutput = {
    catalogMatch: buildCatalogMatch(),
    salesMethod: buildSalesMethod(cost, confirmed),
    displayName: {
      noBrand: true,
      candidates: generated.displayNames.map((c) => ({
        label: c.label,
        text: c.text,
        length: c.text.length,
      })),
      internalName: generated.internalName,
      reason: generated.displayNameReason,
    },
    category: {
      path: selectedPath,
      feeRate,
      alternatives,
      reason: generated.categoryReason,
    },
    options: buildOptions(confirmed, cost, generated.sizeLabel, generated.sizeAlternatives),
    mainImage: images.mainImage,
    detailPage: images.detailPage,
    mainInfo: buildMainInfo(),
    tags: {
      list: generated.tags,
      joined: generated.tags.join(', '),
      breakdown: { core: 3, usage: 8, attribute: 3, longtail: 6 },
    },
    filters: buildFilters(confirmed, generated.filterHints),
    notice,
    documents: buildDocuments(),
    fulfillmentInfo: buildFulfillmentInfo(),
    inboundChecklist: buildChecklist(confirmed),
  }

  const violations = scanAll(
    [
      ...output.displayName.candidates.map((c) => ({
        section: `③ 노출상품명 ${c.label}안`,
        text: c.text,
      })),
      { section: '⑤ 옵션 · 사이즈', text: output.options.size },
      { section: '⑨ 검색어', text: output.tags.joined },
      ...output.notice.fields.map((f) => ({
        section: `⑪ 상품정보제공고시 · ${f.key}`,
        text: f.value,
      })),
    ],
    confirmed.material,
  )

  const asViolation = checkAsPhone(asContact)
  if (asViolation) violations.push(asViolation)

  return {
    id: `listing-${Date.now()}`,
    source: {
      site: confirmed.sourceSite,
      capturedAt: new Date().toISOString(),
    },
    confirmed,
    cost,
    output,
    margin: calcMargin(cost, feeRate),
    violations,
    todos: buildTodos(notice, cost),
  }
}
