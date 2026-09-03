'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { FieldBadge } from '@/components/Field'
import { FormSection, NumberField, SelectField, TextField } from '@/components/Field'
import MarginPanel from '@/components/MarginPanel'
import SourceIntake from '@/components/SourceIntake'
import { categories, findCategory } from '@/lib/categories'
import { saveListing } from '@/lib/storage'
import type { ConfirmedInfo, CostInfo, ExtractedInfo, Listing } from '@/types/listing'

const SAMPLE = {
  name: '회전형 투명 2단 트레이',
  material: 'PET, PVC, 스테인리스',
  color: '투명',
  origin: '중국',
  components: '트레이 2, 기둥 3, 중앙 고정캡 1',
  sourceSite: '도매꾹',
  sourceProductNo: '63790470',
}

function thisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function parseComponents(raw: string) {
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^(.*?)\s*(\d+)\s*개?$/)
      return m ? { label: m[1].trim(), count: Number(m[2]) } : { label: p, count: 1 }
    })
}

export default function InputPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [material, setMaterial] = useState('')
  const [color, setColor] = useState('')
  const [origin, setOrigin] = useState('중국')
  const [componentsRaw, setComponentsRaw] = useState('')
  const [qtyPerUnit, setQtyPerUnit] = useState<number | null>(1)
  const [fragile, setFragile] = useState(false)
  const [categoryKey, setCategoryKey] = useState(categories[0].key)
  const [sourceSite, setSourceSite] = useState('도매꾹')
  const [sourceProductNo, setSourceProductNo] = useState('')
  const [releaseYearMonth, setReleaseYearMonth] = useState(thisMonth())

  const [diameter, setDiameter] = useState<number | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [depth, setDepth] = useState<number | null>(null)
  const [height, setHeight] = useState<number | null>(null)

  const [unitPrice, setUnitPrice] = useState<number | null>(null)
  const [inboundShipping, setInboundShipping] = useState<number | null>(null)
  const [inboundQty, setInboundQty] = useState<number | null>(20)
  const [fulfillmentFee, setFulfillmentFee] = useState<number | null>(null)
  const [taxpayerType, setTaxpayerType] = useState<'general' | 'simplified'>('general')
  const [listPrice, setListPrice] = useState<number | null>(null)
  const [salePrice, setSalePrice] = useState<number | null>(null)

  const [asContact, setAsContact] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** AI가 채운 항목. 사용자가 직접 고치면 그 항목만 지워진다. */
  const [aiFields, setAiFields] = useState<Record<string, FieldBadge>>({})

  const category = findCategory(categoryKey)

  const cost: CostInfo = useMemo(
    () => ({
      unitPrice: unitPrice ?? 0,
      inboundShipping: inboundShipping ?? 0,
      inboundQty: inboundQty ?? 0,
      fulfillmentFee,
      taxpayerType,
      listPrice: listPrice ?? 0,
      salePrice: salePrice ?? 0,
    }),
    [unitPrice, inboundShipping, inboundQty, fulfillmentFee, taxpayerType, listPrice, salePrice],
  )

  /** 사용자가 손댄 항목은 더 이상 AI 값이 아니므로 배지를 뗀다. */
  function edited<T>(key: string, set: (v: T) => void) {
    return (value: T) => {
      setAiFields((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
      set(value)
    }
  }

  function applyExtracted(info: ExtractedInfo) {
    const marks: Record<string, FieldBadge> = {}
    const mark = (key: string) => {
      marks[key] = info.lowConfidence.includes(key) ? 'check' : 'ai'
    }

    const text = (key: string, value: string, set: (v: string) => void) => {
      if (!value) return
      set(value)
      mark(key)
    }
    const num = (key: string, value: number | undefined, set: (v: number | null) => void) => {
      if (value === undefined) return
      set(value)
      mark(key)
    }

    text('name', info.name, setName)
    text('material', info.material, setMaterial)
    text('color', info.color, setColor)
    text('origin', info.origin, setOrigin)
    text('componentsRaw', info.componentsRaw, setComponentsRaw)
    text('sourceSite', info.sourceSite, setSourceSite)
    text('sourceProductNo', info.sourceProductNo, setSourceProductNo)
    text('categoryKey', info.categoryKey, setCategoryKey)

    num('qtyPerUnit', info.qtyPerUnit, setQtyPerUnit)
    num('diameter', info.diameter, setDiameter)
    num('width', info.width, setWidth)
    num('depth', info.depth, setDepth)
    num('height', info.height, setHeight)
    num('unitPrice', info.unitPrice, setUnitPrice)

    if (info.fragile) {
      setFragile(true)
      mark('fragile')
    }

    setAiFields(marks)
    setError(null)
  }

  function fillSample() {
    setAiFields({})
    setName(SAMPLE.name)
    setMaterial(SAMPLE.material)
    setColor(SAMPLE.color)
    setOrigin(SAMPLE.origin)
    setComponentsRaw(SAMPLE.components)
    setSourceSite(SAMPLE.sourceSite)
    setSourceProductNo(SAMPLE.sourceProductNo)
    setDiameter(23)
    setHeight(22)
    setUnitPrice(7600)
    setInboundShipping(3000)
    setInboundQty(20)
    setListPrice(16900)
    setSalePrice(12900)
    setFulfillmentFee(2500)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!height) {
      setError('높이는 필수입니다. 검색필터 치수 계산에 사용됩니다.')
      return
    }

    const confirmed: ConfirmedInfo = {
      name,
      material,
      size: {
        diameter: diameter ?? undefined,
        width: width ?? undefined,
        depth: depth ?? undefined,
        height,
      },
      components: parseComponents(componentsRaw),
      origin,
      color: color || '투명',
      qtyPerUnit: qtyPerUnit ?? 1,
      fragile,
      categoryKey,
      sourceSite,
      sourceProductNo,
      releaseYearMonth,
    }

    setLoading(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed, cost, asContact }),
      })
      const data = (await res.json()) as { listing?: Listing; error?: string }

      if (!res.ok || !data.listing) {
        setError(data.error ?? '생성에 실패했습니다.')
        return
      }
      saveListing(data.listing)
      router.push('/result')
    } catch {
      setError('네트워크 오류로 생성하지 못했습니다. 다시 시도하세요.')
    } finally {
      setLoading(false)
    }
  }

  const needsCheck = Object.values(aiFields).filter((b) => b === 'check').length
  const filledCount = Object.keys(aiFields).length

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6 lg:pb-10">
      <header className="mb-6">
        <p className="text-sm font-medium text-accent">쿠팡 WING 상품등록</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">상품등록 어시스턴트</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          상품 이미지나 도매 URL을 넣으면 AI가 기본 정보를 채워 줍니다. 값을 확인·수정한 뒤 분석을
          시작하면 WING 폼 순서 그대로 14개 섹션의 입력값을 만들어 드립니다. 마진이 음수인 가격과
          정책 위반 문구는 등록 전에 걸러집니다.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <SourceIntake onExtracted={applyExtracted} disabled={loading} />

          <form onSubmit={submit} className="space-y-4">
            <FormSection
              title="2단계 · 상품 정보"
              description={
                filledCount > 0
                  ? `AI가 ${filledCount}개 항목을 채웠습니다.${
                      needsCheck > 0 ? ` 그중 ${needsCheck}개는 확인이 필요합니다.` : ''
                    } 잘못된 값은 직접 고치세요.`
                  : 'AI가 잘못 읽을 여지가 없도록, 실제 상품 그대로 입력하세요.'
              }
            >
              <div className="sm:col-span-2">
                <TextField
                  label="품명"
                  value={name}
                  onChange={edited('name', setName)}
                  badge={aiFields.name}
                  placeholder="회전형 투명 2단 트레이"
                  required
                />
              </div>
              <TextField
                label="소재"
                value={material}
                onChange={edited('material', setMaterial)}
                badge={aiFields.material}
                placeholder="PET, PVC, 스테인리스"
                hint="PET·PVC·PP면 내열·식기세척기 표현이 자동 차단됩니다."
                required
              />
              <TextField
                label="색상"
                value={color}
                onChange={edited('color', setColor)}
                badge={aiFields.color}
                placeholder="투명"
              />
              <TextField
                label="원산지"
                value={origin}
                onChange={edited('origin', setOrigin)}
                badge={aiFields.origin}
                placeholder="중국"
              />
              <NumberField
                label="단위 수량"
                value={qtyPerUnit}
                onChange={edited('qtyPerUnit', setQtyPerUnit)}
                badge={aiFields.qtyPerUnit}
                suffix="개"
              />
              <div className="sm:col-span-2">
                <TextField
                  label="구성품"
                  value={componentsRaw}
                  onChange={edited('componentsRaw', setComponentsRaw)}
                  badge={aiFields.componentsRaw}
                  placeholder="트레이 2, 기둥 3, 중앙 고정캡 1"
                  hint="쉼표로 구분. 입고 검수 체크리스트에 개수까지 그대로 표시됩니다."
                />
              </div>
              <div className="sm:col-span-2">
                <SelectField
                  label="카테고리"
                  value={categoryKey}
                  onChange={edited('categoryKey', setCategoryKey)}
                  badge={aiFields.categoryKey}
                  options={categories.map((c) => ({
                    value: c.key,
                    label: `${c.label} — 수수료 ${c.feeRate}%`,
                  }))}
                  hint={`${category.path} · 판매수수료 ${category.feeRate}% (VAT 별도, 정률)`}
                />
              </div>
              <label className="flex min-h-11 items-center gap-2.5 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={fragile}
                  onChange={(e) => edited('fragile', setFragile)(e.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                <span className="text-sm">파손 위험이 높은 상품 (유리·도자기 등)</span>
              </label>
            </FormSection>

            <FormSection title="크기" description="검색필터 치수와 고시정보 크기에 그대로 쓰입니다.">
              <NumberField
                label="지름"
                value={diameter}
                onChange={edited('diameter', setDiameter)}
                badge={aiFields.diameter}
                suffix="cm"
                hint="원형 상품만"
              />
              <NumberField
                label="높이"
                value={height}
                onChange={edited('height', setHeight)}
                badge={aiFields.height}
                suffix="cm"
                hint="필수"
              />
              <NumberField
                label="가로"
                value={width}
                onChange={edited('width', setWidth)}
                badge={aiFields.width}
                suffix="cm"
                hint="사각형 상품"
              />
              <NumberField
                label="세로"
                value={depth}
                onChange={edited('depth', setDepth)}
                badge={aiFields.depth}
                suffix="cm"
                hint="사각형 상품"
              />
            </FormSection>

            <FormSection
              title="원가·가격"
              description="마진 계산기가 우측(모바일은 하단)에서 즉시 재계산합니다."
            >
              <NumberField
                label="도매 단가"
                value={unitPrice}
                onChange={edited('unitPrice', setUnitPrice)}
                badge={aiFields.unitPrice}
                suffix="원"
              />
              <NumberField
                label="입고 배송비"
                value={inboundShipping}
                onChange={setInboundShipping}
                suffix="원"
              />
              <NumberField
                label="예상 입고 수량"
                value={inboundQty}
                onChange={setInboundQty}
                suffix="개"
              />
              <NumberField
                label="로켓그로스 물류비"
                value={fulfillmentFee}
                onChange={setFulfillmentFee}
                suffix="원"
                placeholder="미입력"
                hint="부피·무게로 결정되므로 추정하지 않습니다. 비우면 마진이 '확정 불가'로 표시됩니다."
              />
              <NumberField label="정상가" value={listPrice} onChange={setListPrice} suffix="원" />
              <NumberField label="판매가" value={salePrice} onChange={setSalePrice} suffix="원" />
              <div className="sm:col-span-2">
                <SelectField
                  label="사업자 유형"
                  value={taxpayerType}
                  onChange={(v) => setTaxpayerType(v as 'general' | 'simplified')}
                  options={[
                    { value: 'general', label: '일반과세자' },
                    { value: 'simplified', label: '간이과세자' },
                  ]}
                  hint="일반과세자만 매입세액 환급이 계산됩니다."
                />
              </div>
            </FormSection>

            <FormSection
              title="출처·A/S"
              description="A/S 번호에 도매 공급사 번호를 넣으면 자동으로 차단됩니다."
            >
              <TextField
                label="도매 사이트"
                value={sourceSite}
                onChange={edited('sourceSite', setSourceSite)}
                badge={aiFields.sourceSite}
              />
              <TextField
                label="도매 상품번호"
                value={sourceProductNo}
                onChange={edited('sourceProductNo', setSourceProductNo)}
                badge={aiFields.sourceProductNo}
                placeholder="63790470"
              />
              <TextField
                label="출시년월"
                value={releaseYearMonth}
                onChange={setReleaseYearMonth}
                placeholder="2026-08"
              />
              <TextField
                label="A/S 연락처"
                value={asContact}
                onChange={setAsContact}
                placeholder="0507-0000-0000"
                hint="안심번호(050·0507) 권장. 비워두면 미완료 항목으로 남습니다."
              />
            </FormSection>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-danger-soft px-4 py-3 text-sm leading-relaxed text-danger"
              >
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
              <button
                type="submit"
                disabled={loading}
                className="h-12 flex-1 rounded-lg bg-accent px-6 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:flex-none sm:px-8"
              >
                {loading ? '생성 중…' : '분석 시작'}
              </button>
              <button
                type="button"
                onClick={fillSample}
                className="h-12 rounded-lg border border-line-strong px-5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent"
              >
                예시 값 채우기
              </button>
            </div>
          </form>
        </div>

        <MarginPanel cost={cost} feeRate={category.feeRate} />
      </div>
    </div>
  )
}
