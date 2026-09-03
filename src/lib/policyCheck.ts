import policyData from '@/data/policyWords.json'
import type { Violation } from '@/types/listing'

type PolicyRule = {
  id: string
  patterns: string[]
  level: 'block' | 'warn'
  reason: string
  fix: string
  materials?: string[]
}

const rules = policyData.rules as PolicyRule[]

function ruleApplies(rule: PolicyRule, material: string): boolean {
  if (!rule.materials) return true
  const upper = material.toUpperCase()
  return rule.materials.some((m) => upper.includes(m.toUpperCase()))
}

export function scanText(
  section: string,
  text: string,
  material: string,
): Violation[] {
  if (!text) return []
  const found: Violation[] = []

  for (const rule of rules) {
    if (!ruleApplies(rule, material)) continue
    for (const pattern of rule.patterns) {
      if (text.includes(pattern)) {
        found.push({
          section,
          text: pattern,
          level: rule.level,
          reason: rule.reason,
          fix: rule.fix,
        })
        break
      }
    }
  }
  return found
}

export function scanAll(
  entries: { section: string; text: string }[],
  material: string,
): Violation[] {
  return entries.flatMap((e) => scanText(e.section, e.text, material))
}

export function isHeatSensitive(material: string): boolean {
  const upper = material.toUpperCase()
  return ['PET', 'PVC', 'PP', 'PS', '아크릴', '플라스틱'].some((m) =>
    upper.includes(m.toUpperCase()),
  )
}

export function checkAsPhone(phone: string): Violation | null {
  const trimmed = phone.trim()
  if (!trimmed) return null

  const digits = trimmed.replace(/[^0-9]/g, '')
  if (policyData.safePhonePrefixes.some((p) => digits.startsWith(p))) return null

  if (new RegExp(policyData.supplierPhonePattern).test(trimmed)) {
    return {
      section: '⑪ 상품정보제공고시 · A/S 책임자',
      text: trimmed,
      level: 'block',
      reason:
        '도매 공급사 번호를 넣으면 고객이 공급사에 직접 연락하게 되어 거래에 문제가 생깁니다.',
      fix: '개인번호 노출을 피하려면 안심번호(050/0507)를 발급해 사용하세요.',
    }
  }
  return null
}
