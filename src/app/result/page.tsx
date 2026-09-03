'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import CopyButton from '@/components/CopyButton'
import MarginPanel from '@/components/MarginPanel'
import { FieldRow, SectionCard } from '@/components/SectionCard'
import { formatWon } from '@/lib/margin'
import { loadListing, saveListing } from '@/lib/storage'
import type { Listing, Violation } from '@/types/listing'

function violationsFor(listing: Listing, prefix: string): Violation[] {
  return listing.violations.filter((v) => v.section.startsWith(prefix))
}

export default function ResultPage() {
  const [listing, setListing] = useState<Listing | null>(null)
  const [ready, setReady] = useState(false)
  const [salePrice, setSalePrice] = useState(0)

  useEffect(() => {
    const stored = loadListing()
    setListing(stored)
    setSalePrice(stored?.cost.salePrice ?? 0)
    setReady(true)
  }, [])

  if (!ready) return null

  if (!listing) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">생성된 결과가 없습니다</h1>
        <p className="mt-2 text-sm text-muted">먼저 상품 정보를 입력하고 분석을 실행하세요.</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-12 items-center rounded-lg bg-accent px-6 font-semibold text-white"
        >
          입력 화면으로
        </Link>
      </div>
    )
  }

  const { output } = listing
  const liveCost = { ...listing.cost, salePrice }
  const blocked = listing.violations.filter((v) => v.level === 'block')
  const warned = listing.violations.filter((v) => v.level === 'warn')

  function updateChecklist(index: number) {
    setListing((prev) => {
      if (!prev) return prev
      const inboundChecklist = prev.output.inboundChecklist.map((c, i) =>
        i === index ? { ...c, checked: !c.checked } : c,
      )
      const next = { ...prev, output: { ...prev.output, inboundChecklist } }
      saveListing(next)
      return next
    })
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:pb-10">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-accent">WING 폼 순서 · 14개 섹션</p>
          <h1 className="mt-1 truncate text-2xl font-bold sm:text-3xl">{listing.confirmed.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {listing.confirmed.material} · {output.category.path.split(' > ').at(-1)}
          </p>
        </div>
        <Link
          href="/"
          className="h-11 shrink-0 rounded-lg border border-line-strong px-4 text-sm font-medium leading-[2.75rem] text-muted transition-colors hover:border-accent hover:text-accent"
        >
          새로 입력
        </Link>
      </header>

      {(blocked.length > 0 || warned.length > 0) && (
        <div
          role="alert"
          className={`mb-5 rounded-xl px-4 py-3.5 ${
            blocked.length > 0 ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'
          }`}
        >
          <p className="text-sm font-semibold">
            정책 검사 — 차단 {blocked.length}건 · 경고 {warned.length}건
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {[...blocked, ...warned].map((v, i) => (
              <li key={`${v.section}-${i}`}>
                <span className="font-medium">{v.section}</span> · &ldquo;{v.text}&rdquo; — {v.fix}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <SectionCard index="①" title="카탈로그 매칭하기" reason={output.catalogMatch.reason}>
            <p className="text-lg font-semibold">{output.catalogMatch.value}</p>
          </SectionCard>

          <SectionCard
            index="②"
            title="판매방식 선택"
            copyValue={output.salesMethod.label}
            reason={output.salesMethod.reason}
          >
            <p className="text-lg font-semibold">{output.salesMethod.label}</p>
          </SectionCard>

          <SectionCard
            index="③"
            title="노출상품명"
            reason={output.displayName.reason}
            violations={violationsFor(listing, '③')}
          >
            <div className="space-y-3">
              {output.displayName.candidates.map((c) => (
                <div key={c.label} className="rounded-lg border border-line bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm leading-relaxed break-words">
                      <span className="mr-1.5 font-semibold text-accent">{c.label}.</span>
                      {c.text}
                    </p>
                    <CopyButton value={c.text} className="h-8 px-2 text-xs" />
                  </div>
                  <p
                    className={`mt-1.5 text-xs tabular-nums ${
                      c.length > 100 ? 'text-danger' : 'text-faint'
                    }`}
                  >
                    {c.length} / 100자
                  </p>
                </div>
              ))}
              <dl>
                <FieldRow
                  label="브랜드"
                  value={output.displayName.noBrand ? '브랜드 없음(또는 자체제작) 체크' : '브랜드 입력'}
                />
                <FieldRow
                  label="등록상품명 (관리용)"
                  value={<span className="font-mono text-sm">{output.displayName.internalName}</span>}
                  copyable={output.displayName.internalName}
                />
              </dl>
            </div>
          </SectionCard>

          <SectionCard
            index="④"
            title="카테고리"
            copyValue={output.category.path}
            reason={output.category.reason}
          >
            <p className="text-sm leading-relaxed break-words">{output.category.path}</p>
            <p className="mt-2 text-sm font-semibold text-accent">
              판매수수료 {output.category.feeRate}% (VAT 별도, 정률)
            </p>
            {output.category.alternatives.length > 0 && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="mb-1.5 text-xs font-medium text-faint">대안 카테고리</p>
                <ul className="space-y-1.5 text-sm text-muted">
                  {output.category.alternatives.map((a) => (
                    <li key={a.path} className="break-words">
                      {a.path} — {a.feeRate}%
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          <SectionCard
            index="⑤"
            title="옵션"
            copyValue={output.options.combinedLabel}
            warnings={[output.options.sizeWarning]}
            violations={violationsFor(listing, '⑤')}
          >
            <dl>
              <FieldRow label="사이즈" value={output.options.size} />
              <FieldRow label="색상" value={output.options.color} />
              <FieldRow label="수량" value={output.options.qty} />
              <FieldRow
                label="옵션명 결과"
                value={<span className="font-semibold">{output.options.combinedLabel}</span>}
              />
              <FieldRow label="정상가" value={formatWon(output.options.listPrice)} />
              <FieldRow label="판매가" value={formatWon(output.options.salePrice)} />
              <FieldRow label="재고수량" value={output.options.stockHint} />
            </dl>
            {output.options.sizeAlternatives.length > 0 && (
              <p className="mt-3 text-sm text-muted">
                <span className="text-faint">사이즈 라벨 대안 </span>
                {output.options.sizeAlternatives.join(' · ')}
              </p>
            )}
          </SectionCard>

          <SectionCard index="⑥" title="상품이미지" reason={output.mainImage.note}>
            <p className="font-semibold">{output.mainImage.status}</p>
            <p className="mt-1.5 text-sm text-muted">{output.mainImage.spec}</p>
          </SectionCard>

          <SectionCard index="⑦" title="상세설명">
            <p className="font-semibold">{output.detailPage.status}</p>
            <p className="mt-1.5 text-sm text-muted">{output.detailPage.spec}</p>
          </SectionCard>

          <SectionCard index="⑧" title="상품 주요 정보">
            <dl>
              {output.mainInfo.items.map((item) => (
                <FieldRow key={item.key} label={item.key} value={item.value} note={item.note} />
              ))}
            </dl>
          </SectionCard>

          <SectionCard
            index="⑨"
            title="검색어 (태그 20개)"
            copyValue={output.tags.joined}
            violations={violationsFor(listing, '⑨')}
          >
            <div className="flex flex-wrap gap-1.5">
              {output.tags.list.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-accent-soft px-2 py-1 text-xs text-accent"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-faint">
              구성 — 핵심 대표어 {output.tags.breakdown.core} · 용도별 {output.tags.breakdown.usage} ·
              속성 {output.tags.breakdown.attribute} · 롱테일 {output.tags.breakdown.longtail} (총{' '}
              {output.tags.list.length}개)
            </p>
          </SectionCard>

          <SectionCard index="⑩" title="검색필터" warnings={[output.filters.blockedNote]}>
            <p className="mb-2 text-xs font-medium text-faint">드롭다운형</p>
            <dl>
              {output.filters.dropdowns.map((d) => (
                <FieldRow
                  key={d.key}
                  label={d.key}
                  value={
                    <span className="flex flex-wrap items-center gap-2">
                      {d.value}
                      {d.needsVerify && (
                        <span className="rounded bg-warn-soft px-1.5 py-0.5 text-xs text-warn">
                          확인 필요
                        </span>
                      )}
                    </span>
                  }
                />
              ))}
            </dl>

            <p className="mb-2 mt-5 text-xs font-medium text-faint">직접입력형 (cm)</p>
            <dl>
              {output.filters.inputs.map((i) => (
                <FieldRow key={i.key} label={i.key} value={i.value || '—'} copyable={i.value} />
              ))}
            </dl>

            <p className="mb-2 mt-5 text-xs font-medium text-faint">공란 처리</p>
            <dl>
              {output.filters.blanks.map((b) => (
                <FieldRow key={b.key} label={b.key} value={<span className="text-faint">{b.reason}</span>} />
              ))}
            </dl>
          </SectionCard>

          <SectionCard
            index="⑪"
            title={`상품정보제공고시 — ${output.notice.categoryLabel}`}
            violations={violationsFor(listing, '⑪')}
          >
            <dl>
              {output.notice.fields.map((f) => (
                <FieldRow
                  key={f.key}
                  label={f.key}
                  value={
                    f.requiresUserInput && !f.value ? (
                      <span className="text-danger">사용자 입력 필요</span>
                    ) : (
                      f.value || '—'
                    )
                  }
                  copyable={f.value || undefined}
                />
              ))}
            </dl>
            <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-muted">
              도매 공급사 번호를 넣으면 고객이 공급사에 직접 연락하게 되어 거래에 문제가 생깁니다.
              개인번호 노출을 피하려면 안심번호(050/0507)를 권장합니다.
            </p>
          </SectionCard>

          <SectionCard index="⑫" title="구비서류" reason={output.documents.reason}>
            <p className="text-lg font-semibold">{output.documents.value}</p>
          </SectionCard>

          <SectionCard
            index="⑬"
            title="로켓그로스 물류 입고 정보"
            reason={output.fulfillmentInfo.reason}
          >
            <p className="text-lg font-semibold">{output.fulfillmentInfo.value}</p>
          </SectionCard>

          <SectionCard index="⑭" title="입고 검수 기준">
            <ul className="space-y-1">
              {output.inboundChecklist.map((c, i) => (
                <li key={c.item}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={c.checked}
                      onChange={() => updateChecklist(i)}
                      className="size-4 shrink-0 accent-[var(--accent)]"
                    />
                    <span className={`text-sm ${c.checked ? 'text-faint line-through' : ''}`}>
                      {c.item}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </SectionCard>

          <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <h2 className="text-base font-semibold">남은 작업 {listing.todos.length}개</h2>
            <ol className="mt-3 space-y-2">
              {listing.todos.map((todo, i) => (
                <li key={todo} className="flex gap-2.5 text-sm">
                  <span className="shrink-0 text-faint tabular-nums">{i + 1}.</span>
                  <span>{todo}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex justify-end">
            <CopyButton value={JSON.stringify(listing, null, 2)} label="전체 JSON 복사" />
          </div>
        </div>

        <MarginPanel
          cost={liveCost}
          feeRate={output.category.feeRate}
          onSalePriceChange={setSalePrice}
        />
      </div>
    </div>
  )
}
