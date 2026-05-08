'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SearchInput({
  initial = '',
  action,
  placeholder,
  extraParams,
}: {
  initial?: string
  action: string
  placeholder?: string
  extraParams?: Record<string, string>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(initial || searchParams.get('q') || '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (extraParams) for (const [k, v] of Object.entries(extraParams)) params.set(k, v)
    router.push(`${action}?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-xl">
      <Input
        type="search"
        placeholder={placeholder ?? '검색'}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="flex-1"
      />
      <Button type="submit">검색</Button>
    </form>
  )
}
