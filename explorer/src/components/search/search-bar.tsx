import { useState } from 'react'
import { useRouter } from 'next/router'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button.js'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    // Determine search type based on query pattern
    if (/^\d+$/.test(query)) {
      // Block height
      router.push(`/blocks/${query}`)
    } else if (/^[0-9a-fA-F]{64}$/.test(query)) {
      // Transaction hash
      router.push(`/transactions/${query}`)
    } else if (/^[0-9a-fA-F]{40,}$/.test(query)) {
      // Address or contract
      router.push(`/addresses/${query}`)
    } else if (query.includes('1') && query.length > 30) {
      // Bech32 address
      router.push(`/addresses/${query}`)
    } else {
      // General search
      router.push(`/search?q=${encodeURIComponent(query)}`)
    }
  }

  return (
    <form onSubmit={handleSearch} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search blocks, transactions, addresses..."
          className="h-9 w-full rounded-md border border-input bg-background px-8 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          className="absolute right-1 top-1 h-7 w-7 p-0"
          variant="ghost"
        >
          <Search className="h-3 w-3" />
          <span className="sr-only">Search</span>
        </Button>
      </div>
    </form>
  )
}