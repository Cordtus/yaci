import Link from 'next/link'
import { Search, Menu, Github, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button.js'
import { SearchBar } from '@/components/search/search-bar.js'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">Y</span>
            </div>
            <span className="hidden font-bold sm:inline-block">
              Yaci Explorer
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/blocks" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Blocks
            </Link>
            <Link href="/transactions" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Transactions
            </Link>
            <Link href="/addresses" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Addresses
            </Link>
            <Link href="/validators" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Validators
            </Link>
            <Link href="/governance" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Governance
            </Link>
            <Link href="/tokens" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Tokens
            </Link>
          </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <SearchBar />
          </div>
          <nav className="flex items-center space-x-2">
            <Button variant="ghost" size="icon">
              <Globe className="h-4 w-4" />
              <span className="sr-only">Network selector</span>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href="https://github.com/manifest-network/yaci" target="_blank">
                <Github className="h-4 w-4" />
                <span className="sr-only">GitHub</span>
              </Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  )
}