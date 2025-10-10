import { createTRPCNext } from '@trpc/next'
import type { AppRouter } from '../api/root.js'
import superjson from 'superjson'

function getBaseUrl() {
  if (typeof window !== 'undefined')
    return '' // browser should use relative url
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}` // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3004}` // dev SSR should use localhost
}

export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      transformer: superjson,
      links: [
        {
          type: 'http',
          url: `${getBaseUrl()}/api/trpc`,
        },
      ],
    }
  },
  ssr: false,
})