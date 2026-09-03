'use client'

import type { ReactNode } from 'react'

const inputClass =
  'h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none transition-colors focus:border-accent'

/** AI가 채운 값인지, 그중에서도 사람이 확인해야 하는 값인지 표시한다. */
export type FieldBadge = 'ai' | 'check'

function Badge({ kind }: { kind: FieldBadge }) {
  const style =
    kind === 'check'
      ? 'bg-warn-soft text-warn'
      : 'bg-accent-soft text-accent'
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${style}`}>
      {kind === 'check' ? 'AI · 확인 필요' : 'AI 입력'}
    </span>
  )
}

function Label({
  label,
  required,
  badge,
}: {
  label: string
  required?: boolean
  badge?: FieldBadge
}) {
  return (
    <span className="mb-1.5 flex flex-wrap items-center gap-1 text-sm font-medium">
      {label}
      {required && <span className="text-danger">*</span>}
      {badge && <Badge kind={badge} />}
    </span>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  badge,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  required?: boolean
  badge?: FieldBadge
  type?: string
}) {
  return (
    <label className="block">
      <Label label={label} required={required} badge={badge} />
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  hint,
  placeholder,
  badge,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  suffix?: string
  hint?: string
  placeholder?: string
  badge?: FieldBadge
}) {
  return (
    <label className="block">
      <Label label={label} badge={badge} />
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value === null ? '' : value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className={`${inputClass} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">
            {suffix}
          </span>
        )}
      </div>
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  badge,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  hint?: string
  badge?: FieldBadge
}) {
  return (
    <label className="block">
      <Label label={label} badge={badge} />
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}
