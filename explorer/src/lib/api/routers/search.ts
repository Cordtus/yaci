import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { db } from '../../db/schema.js'
import { sql } from 'drizzle-orm'

export const searchRouter = router({
  // Universal search endpoint
  search: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const results = {
        blocks: [] as any[],
        transactions: [] as any[],
        addresses: [] as any[],
        contracts: [] as any[],
      }

      // Search blocks by height
      if (/^\d+$/.test(input.query)) {
        const blockResult = await db.execute(sql`
          SELECT 
            data->'block'->'header'->>'height' as height,
            data->'block'->'header'->>'time' as timestamp,
            jsonb_array_length(COALESCE(data->'block'->'data'->'txs', '[]'::jsonb)) as tx_count
          FROM api.blocks_raw 
          WHERE data->'block'->'header'->>'height' = ${input.query}
          LIMIT 1
        `)
        
        if (blockResult.rows.length > 0) {
          const block = blockResult.rows[0]
          results.blocks.push({
            type: 'block',
            height: parseInt(block.height as string),
            timestamp: block.timestamp,
            txCount: parseInt(block.tx_count as string),
          })
        }
      }

      // Search transactions by hash (full or partial)
      if (input.query.length >= 6) {
        const txResult = await db.execute(sql`
          SELECT 
            t.id,
            t.height,
            t.timestamp,
            t.memo,
            t.error,
            COUNT(m.id) as message_count
          FROM api.transactions_main t
          LEFT JOIN api.messages_main m ON t.id = m.id
          WHERE t.id LIKE ${`%${input.query}%`}
          GROUP BY t.id, t.height, t.timestamp, t.memo, t.error
          ORDER BY t.height DESC
          LIMIT ${Math.min(input.limit, 10)}
        `)
        
        results.transactions = txResult.rows.map(tx => ({
          type: 'transaction',
          hash: tx.id,
          height: parseInt(tx.height as string),
          timestamp: tx.timestamp,
          memo: tx.memo,
          success: !tx.error,
          messageCount: parseInt(tx.message_count as string),
        }))
      }

      // Search addresses (bech32 or hex)
      if (input.query.length >= 10) {
        const addressResult = await db.execute(sql`
          WITH address_search AS (
            SELECT DISTINCT 
              sender as address,
              COUNT(*) as tx_count,
              MAX(height) as last_height
            FROM api.messages_main m
            JOIN api.transactions_main t ON m.id = t.id
            WHERE sender LIKE ${`%${input.query}%`}
            GROUP BY sender
            
            UNION
            
            SELECT DISTINCT 
              unnest(mentions) as address,
              COUNT(*) as tx_count,
              MAX(height) as last_height
            FROM api.messages_main m
            JOIN api.transactions_main t ON m.id = t.id
            WHERE ${input.query} = ANY(mentions)
               OR array_to_string(mentions, ',') LIKE ${`%${input.query}%`}
            GROUP BY unnest(mentions)
          )
          SELECT 
            address,
            SUM(tx_count) as total_transactions,
            MAX(last_height) as last_activity
          FROM address_search
          GROUP BY address
          ORDER BY total_transactions DESC
          LIMIT ${Math.min(input.limit, 10)}
        `)
        
        results.addresses = addressResult.rows.map(addr => ({
          type: 'address',
          address: addr.address,
          totalTransactions: parseInt(addr.total_transactions as string),
          lastActivity: parseInt(addr.last_activity as string),
        }))
      }

      // Search for contracts (if we have EVM data)
      if (input.query.length >= 10 && input.query.startsWith('0x')) {
        // This would search verified contracts
        const contractResult = await db.execute(sql`
          SELECT 
            contract_address,
            contract_name,
            verified_at,
            abi IS NOT NULL as has_abi
          FROM explorer_contract_verification
          WHERE contract_address LIKE ${`%${input.query}%`}
             OR contract_name ILIKE ${`%${input.query}%`}
          ORDER BY verified_at DESC
          LIMIT ${Math.min(input.limit, 5)}
        `)
        
        results.contracts = contractResult.rows.map(contract => ({
          type: 'contract',
          address: contract.contract_address,
          name: contract.contract_name,
          verified: contract.has_abi,
          verifiedAt: contract.verified_at,
        }))
      }

      return results
    }),

  // Get search suggestions for autocomplete
  getSuggestions: publicProcedure
    .input(z.object({
      query: z.string().min(2),
      limit: z.number().min(1).max(10).default(5),
    }))
    .query(async ({ input }) => {
      const suggestions: Array<{
        type: string
        value: string
        label: string
      }> = []

      // Block height suggestions
      if (/^\d+$/.test(input.query)) {
        const blockSuggestions = await db.execute(sql`
          SELECT DISTINCT data->'block'->'header'->>'height' as height
          FROM api.blocks_raw 
          WHERE data->'block'->'header'->>'height'::text LIKE ${`${input.query}%`}
          ORDER BY (data->'block'->'header'->>'height')::bigint DESC
          LIMIT ${input.limit}
        `)
        
        suggestions.push(...blockSuggestions.rows.map(row => ({
          type: 'block',
          value: row.height as string,
          label: `Block #${row.height}`,
        })))
      }

      // Transaction hash suggestions
      if (input.query.length >= 4) {
        const txSuggestions = await db.execute(sql`
          SELECT id, memo
          FROM api.transactions_main
          WHERE id LIKE ${`${input.query}%`}
          ORDER BY height DESC
          LIMIT ${Math.min(input.limit, 3)}
        `)
        
        suggestions.push(...txSuggestions.rows.map(row => ({
          type: 'transaction',
          value: row.id as string,
          label: `Tx: ${(row.id as string).slice(0, 16)}...${row.memo ? ` (${row.memo})` : ''}`,
        })))
      }

      // Address suggestions
      if (input.query.length >= 6) {
        const addressSuggestions = await db.execute(sql`
          SELECT DISTINCT sender as address, COUNT(*) as tx_count
          FROM api.messages_main
          WHERE sender LIKE ${`${input.query}%`}
          GROUP BY sender
          ORDER BY tx_count DESC
          LIMIT ${Math.min(input.limit, 3)}
        `)
        
        suggestions.push(...addressSuggestions.rows.map(row => ({
          type: 'address',
          value: row.address as string,
          label: `Address: ${(row.address as string).slice(0, 20)}... (${row.tx_count} txs)`,
        })))
      }

      return suggestions.slice(0, input.limit)
    }),
})