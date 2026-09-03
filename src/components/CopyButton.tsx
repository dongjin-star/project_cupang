'use client'

import { useEffect, useRef, useState } from 'react'

export default function CopyButton({
  value,
  label = '복사',
  className = '',
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      aria-live="polite"
      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-line-strong px-3 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {copied ? '복사됨' : label}
    </button>
  )
}
