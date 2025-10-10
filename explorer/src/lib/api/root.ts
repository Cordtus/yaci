import { router } from './trpc.js'
import { blocksRouter } from './routers/blocks.js'
import { transactionsRouter } from './routers/transactions.js'
import { addressesRouter } from './routers/addresses.js'
import { evmRouter } from './routers/evm.js'
import { searchRouter } from './routers/search.js'

export const appRouter = router({
  blocks: blocksRouter,
  transactions: transactionsRouter,
  addresses: addressesRouter,
  evm: evmRouter,
  search: searchRouter,
})

export type AppRouter = typeof appRouter