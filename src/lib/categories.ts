import categoriesData from '@/data/categories.json'

export type CategoryEntry = {
  key: string
  label: string
  path: string
  feeRate: number
  noticeKey: string
  filterKey: string
  alternatives: { path: string; feeRate: number }[]
}

export const categories = categoriesData as CategoryEntry[]

export function findCategory(key: string): CategoryEntry {
  return categories.find((c) => c.key === key) ?? categories[0]
}
