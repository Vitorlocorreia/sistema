'use client'

import React, { useState, useEffect, useRef } from 'react'

export function normalizeDateYear(value: string): string {
  if (!value) return ''
  const match = value.match(/^(\d{4})-(\d{2}-\d{2})$/)
  if (!match) return value
  const year = Number(match[1])
  if (year >= 1 && year < 100) {
    return `20${String(year).padStart(2, '0')}-${match[2]}`
  }
  return value
}

function isValidFullYearDate(value: string): boolean {
  if (!value) return true
  const match = value.match(/^(\d{4})-(\d{2}-\d{2})$/)
  if (!match) return false
  const year = Number(match[1])
  return year >= 1900 && year <= 2100
}

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
}

export function DateInput({
  value,
  onChange,
  onBlur,
  min = '1900-01-01',
  max = '2100-12-31',
  ...rest
}: DateInputProps) {
  const normalizedProp = normalizeDateYear(value || '')
  const [draft, setDraft] = useState(normalizedProp)
  const lastCommittedRef = useRef(normalizedProp)

  useEffect(() => {
    const norm = normalizeDateYear(value || '')
    setDraft(norm)
    lastCommittedRef.current = norm
  }, [value])

  const commitValue = (next: string) => {
    const normalized = normalizeDateYear(next)
    setDraft(normalized)
    if (normalized !== lastCommittedRef.current) {
      lastCommittedRef.current = normalized
      onChange(normalized)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setDraft(raw)

    if (!raw) {
      commitValue('')
      return
    }

    if (isValidFullYearDate(raw)) {
      commitValue(raw)
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const normalized = normalizeDateYear(draft)
    if (normalized !== lastCommittedRef.current && (!normalized || isValidFullYearDate(normalized))) {
      commitValue(normalized)
    } else if (normalized !== draft && (!normalized || isValidFullYearDate(normalized))) {
      setDraft(normalized)
    }
    onBlur?.(e)
  }

  return (
    <input
      {...rest}
      type="date"
      min={min}
      max={max}
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  )
}
