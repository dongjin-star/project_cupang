import type { CostInfo, MarginResult } from '@/types/listing'

export const VAT_RATE = 0.1

export function calcMargin(cost: CostInfo, feeRate: number): MarginResult {
  const salePrice = cost.salePrice
  // 판매가는 부가세 포함가이므로 매출세액은 판매가 × 10/110
  const vat = (salePrice * VAT_RATE) / (1 + VAT_RATE)
  const commission = salePrice * (feeRate / 100)
  const inboundPerUnit = cost.inboundQty > 0 ? cost.inboundShipping / cost.inboundQty : 0

  const breakdown = [
    { label: '판매가', amount: salePrice },
    { label: '부가세 (판매가 포함 10%)', amount: -vat },
    { label: `쿠팡 수수료 (${feeRate}%)`, amount: -commission },
    { label: '도매 단가', amount: -cost.unitPrice },
    {
      label: `입고 배송비 (÷${cost.inboundQty || 1})`,
      amount: -inboundPerUnit,
    },
    {
      label: '로켓그로스 물류비',
      amount: cost.fulfillmentFee === null ? 0 : -cost.fulfillmentFee,
    },
  ]

  const refund =
    cost.taxpayerType === 'general'
      ? (cost.unitPrice * VAT_RATE) / (1 + VAT_RATE) + commission * VAT_RATE
      : 0

  if (cost.fulfillmentFee === null || salePrice <= 0) {
    return {
      breakdown,
      net: null,
      rate: null,
      level: 'unknown',
      refund,
      message:
        salePrice <= 0
          ? '판매가를 입력하면 마진이 계산됩니다.'
          : '로켓그로스 물류비가 미입력되어 마진을 확정할 수 없습니다. 부피·무게로 결정되므로 추정하지 않습니다 — WING 요금 계산기에서 확인 후 입력하세요.',
    }
  }

  const net = salePrice - vat - commission - cost.unitPrice - inboundPerUnit - cost.fulfillmentFee
  const rate = (net / salePrice) * 100

  return { breakdown, net, rate, refund, ...marginLevel(rate) }
}

function marginLevel(rate: number): { level: MarginResult['level']; message: string } {
  if (rate < 0) return { level: 'loss', message: '적자입니다. 이 가격으로 등록하지 마세요.' }
  if (rate < 10) return { level: 'risky', message: '광고 집행 시 적자로 전환됩니다.' }
  if (rate < 15) return { level: 'thin', message: '얇습니다. 가격 재검토를 권장합니다.' }
  return { level: 'ok', message: '마진이 확보되었습니다.' }
}

export function formatWon(n: number): string {
  const rounded = Math.round(n)
  return `${rounded < 0 ? '-' : ''}${Math.abs(rounded).toLocaleString('ko-KR')}원`
}
