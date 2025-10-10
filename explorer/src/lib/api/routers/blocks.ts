import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { db } from '../../db/schema.js'
import { sql } from 'drizzle-orm'

export const blocksRouter = router({
  // Get latest blocks with optional limit
  getLatest: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const result = await db.execute(sql`
        SELECT 
          id,
          data->'block'->'header'->>'height' as height,
          data->'block'->'header'->>'time' as timestamp,
          data->'block'->'header'->>'proposerAddress' as proposer,
          jsonb_array_length(COALESCE(data->'block'->'data'->'txs', '[]'::jsonb)) as tx_count,
          encode(decode(data->'block'->'header'->>'dataHash', 'base64'), 'hex') as block_hash
        FROM api.blocks_raw 
        ORDER BY (data->'block'->'header'->>'height')::bigint DESC 
        LIMIT ${input.limit} OFFSET ${input.offset}
      `)
      
      return result.rows.map(row => ({
        id: row.id,
        height: parseInt(row.height as string),
        timestamp: row.timestamp,
        proposer: row.proposer,
        txCount: parseInt(row.tx_count as string) || 0,
        blockHash: row.block_hash,
      }))
    }),

  // Get block by height or hash
  getByHeightOrHash: publicProcedure
    .input(z.object({
      identifier: z.string(),
    }))
    .query(async ({ input }) => {
      const isHeight = /^\d+$/.test(input.identifier)
      
      const condition = isHeight 
        ? sql`data->'block'->'header'->>'height' = ${input.identifier}`
        : sql`encode(decode(data->'block'->'header'->>'dataHash', 'base64'), 'hex') = ${input.identifier}`
      
      const result = await db.execute(sql`
        SELECT 
          id,
          data,
          data->'block'->'header'->>'height' as height,
          data->'block'->'header'->>'time' as timestamp,
          data->'block'->'header'->>'proposerAddress' as proposer,
          jsonb_array_length(COALESCE(data->'block'->'data'->'txs', '[]'::jsonb)) as tx_count,
          encode(decode(data->'block'->'header'->>'dataHash', 'base64'), 'hex') as block_hash,
          data->'block'->'header'->>'chainId' as chain_id,
          data->'block'->'header'->>'appHash' as app_hash
        FROM api.blocks_raw 
        WHERE ${condition}
        LIMIT 1
      `)
      
      if (result.rows.length === 0) {
        throw new Error('Block not found')
      }
      
      const block = result.rows[0]
      return {
        id: block.id,
        height: parseInt(block.height as string),
        timestamp: block.timestamp,
        proposer: block.proposer,
        txCount: parseInt(block.tx_count as string) || 0,
        blockHash: block.block_hash,
        chainId: block.chain_id,
        appHash: block.app_hash,
        rawData: block.data,
      }
    }),

  // Get block statistics
  getStats: publicProcedure
    .query(async () => {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_blocks,
          MAX((data->'block'->'header'->>'height')::bigint) as latest_height,
          MIN((data->'block'->'header'->>'height')::bigint) as earliest_height,
          AVG(
            EXTRACT(EPOCH FROM 
              (data->'block'->'header'->>'time')::timestamptz - 
              LAG((data->'block'->'header'->>'time')::timestamptz) 
              OVER (ORDER BY (data->'block'->'header'->>'height')::bigint)
            )
          ) * 1000 as avg_block_time_ms
        FROM api.blocks_raw
      `)
      
      const stats = result.rows[0]
      return {
        totalBlocks: parseInt(stats.total_blocks as string),
        latestHeight: parseInt(stats.latest_height as string),
        earliestHeight: parseInt(stats.earliest_height as string),
        avgBlockTimeMs: Math.round(parseFloat(stats.avg_block_time_ms as string) || 0),
      }
    }),
})