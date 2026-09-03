import type { ReactNode } from 'react'
import CopyButton from '@/components/CopyButton'
import type { Violation } from '@/types/listing'

export function SectionCard({
  index,
  title,
  copyValue,
  reason,
  warnings,
  violations,
  children,
}: {
  index: string
  title: string
  copyValue?: string
  reason?: string
  warnings?: (string | null)[]
  violations?: Violation[]
  children: ReactNode
}) {
  const notes = (warnings ?? []).filter(Boolean) as string[]

  return (
    <section
      id={`section-${index}`}
      className="scroll-mt-20 rounded-xl border border-line bg-surface"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <h2 className="flex min-w-0 items-baseline gap-2 text-base font-semibold">
          <span className="text-accent tabular-nums">{index}</span>
          <span className="truncate">{title}</span>
        </h2>
        {copyValue !== undefined && <CopyButton value={copyValue} />}
      </header>

      <div className="px-4 py-4 sm:px-5">{children}</div>

      {(reason || notes.length > 0 || (violations && violations.length > 0)) && (
        <footer className="space-y-2 border-t border-line px-4 py-3 sm:px-5">
          {reason && (
            <p className="text-sm text-muted">
              <span className="font-medium text-faint">근거 </span>
              {reason}
            </p>
          )}
          {notes.map((n) => (
            <p
              key={n}
              className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn"
            >
              ⚠ {n}
            </p>
          ))}
          {violations?.map((v, i) => (
            <p
              key={`${v.text}-${i}`}
              className={`rounded-md px-3 py-2 text-sm ${
                v.level === 'block'
                  ? 'bg-danger-soft text-danger'
                  : 'bg-warn-soft text-warn'
              }`}
            >
              <strong>
                {v.level === 'block' ? '차단' : '경고'} · &ldquo;{v.text}&rdquo;
              </strong>{' '}
              {v.reason} <span className="opacity-80">→ {v.fix}</span>
            </p>
          ))}
        </footer>
      )}
    </section>
  )
}

export function FieldRow({
  label,
  value,
  note,
  copyable,
}: {
  label: string
  value: ReactNode
  note?: string
  copyable?: string
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-2.5 last:border-0 sm:flex-row sm:items-start sm:gap-4">
      <dt className="shrink-0 text-sm text-faint sm:w-44 sm:pt-0.5">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm break-words">{value}</div>
          {note && <p className="mt-1 text-xs text-faint">{note}</p>}
        </div>
        {copyable !== undefined && (
          <CopyButton value={copyable} className="h-8 px-2 text-xs" />
        )}
      </dd>
    </div>
  )
}
