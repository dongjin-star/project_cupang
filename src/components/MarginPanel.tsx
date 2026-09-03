'use client'

import { useState } from 'react'
import { calcMargin, formatWon } from '@/lib/margin'
import type { CostInfo, MarginLevel } from '@/types/listing'

const LEVEL_STYLE: Record<MarginLevel, string> = {
  ok: 'bg-ok-soft text-ok',
  thin: 'bg-warn-soft text-warn',
  risky: 'bg-warn-soft text-warn',
  loss: 'bg-danger-soft text-danger',
  unknown: 'bg-surface-2 text-muted',
}

function MarginBody({
  cost,
  feeRate,
  onSalePriceChange,
}: {
  cost: CostInfo
  feeRate: number
  onSalePriceChange?: (v: number) => void
}) {
  const margin = calcMargin(cost, feeRate)

  return (
    <div className="space-y-3">
      {onSalePriceChange && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">판매가 조정</span>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={cost.salePrice || ''}
              onChange={(e) => onSalePriceChange(Number(e.target.value))}
              className="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 pr-10 text-sm outline-none focus:border-accent"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">
              원
            </span>
          </div>
        </label>
      )}

      <dl className="text-sm">
        {margin.breakdown.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 border-b border-line py-1.5"
          >
            <dt className="text-muted">{row.label}</dt>
            <dd className="shrink-0 tabular-nums">
              {row.label === '로켓그로스 물류비' && cost.fulfillmentFee === null
                ? '미입력'
                : formatWon(row.amount)}
            </dd>
          </div>
        ))}
      </dl>

      <div className={`rounded-lg px-3 py-3 ${LEVEL_STYLE[margin.level]}`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">순마진</span>
          <span className="text-lg font-bold tabular-nums">
            {margin.net === null
              ? '확정 불가'
              : `${formatWon(margin.net)} (${margin.rate!.toFixed(1)}%)`}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed">{margin.message}</p>
        {margin.level === 'unknown' && cost.fulfillmentFee === null && (
          <a
            href="https://wing.coupang.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs font-medium underline underline-offset-2"
          >
            WING 요금 계산기에서 물류비 확인 →
          </a>
        )}
      </div>

      {cost.taxpayerType === 'general' && margin.refund > 0 && (
        <p className="text-xs text-faint">
          일반과세자 매입세액 환급 예상: {formatWon(margin.refund)} (참고용)
        </p>
      )}

      <p className="text-xs leading-relaxed text-faint">
        부가세 계산은 참고용입니다. 사업자 유형별 정확한 처리는 세무 전문가 확인이 필요합니다.
      </p>
    </div>
  )
}

export default function MarginPanel({
  cost,
  feeRate,
  onSalePriceChange,
}: {
  cost: CostInfo
  feeRate: number
  onSalePriceChange?: (v: number) => void
}) {
  const [open, setOpen] = useState(false)
  const margin = calcMargin(cost, feeRate)

  return (
    <>
      {/* 데스크탑: 우측 고정 패널 */}
      <aside className="hidden lg:block">
        <div className="sticky top-6 rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-base font-semibold">마진 계산기</h2>
          <MarginBody cost={cost} feeRate={feeRate} onSalePriceChange={onSalePriceChange} />
        </div>
      </aside>

      {/* 모바일·태블릿: 하단 고정 요약바 + 펼치기 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden">
        {open && (
          <div className="max-h-[55vh] overflow-y-auto px-4 pb-3 pt-4">
            <MarginBody cost={cost} feeRate={feeRate} onSalePriceChange={onSalePriceChange} />
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="text-sm text-muted">순마진</span>
          <span className="flex items-center gap-2">
            <span
              className={`rounded-md px-2.5 py-1 text-sm font-bold tabular-nums ${LEVEL_STYLE[margin.level]}`}
            >
              {margin.net === null
                ? '확정 불가'
                : `${formatWon(margin.net)} (${margin.rate!.toFixed(1)}%)`}
            </span>
            <span aria-hidden className="text-faint">
              {open ? '▾' : '▴'}
            </span>
          </span>
        </button>
      </div>
    </>
  )
}
