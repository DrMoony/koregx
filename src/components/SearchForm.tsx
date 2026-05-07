'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SearchForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    router.push(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-xl">
      <Input
        type="search"
        placeholder="제품명·성분·제조사 검색 (예: 위고비)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="flex-1"
      />
      <Button type="submit">검색</Button>
    </form>
  )
}
