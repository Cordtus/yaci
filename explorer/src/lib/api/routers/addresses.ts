import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { db } from '../../db/schema.js'
import { sql } from 'drizzle-orm'

export const addressesRouter = router({
  // Get address details and transaction summary
  getDetails: publicProcedure
    .input(z.object({
      address: z.string(),
    }))
    .query(async ({ input }) => {
      // Get transaction statistics for this address
      const statsResult = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT t.id) as total_transactions,
          COUNT(DISTINCT CASE WHEN m.sender = ${input.address} THEN t.id END) as sent_transactions,
          COUNT(DISTINCT CASE WHEN m.mentions @> ARRAY[${input.address}]::text[] AND m.sender != ${input.address} THEN t.id END) as received_transactions,
          MIN(t.height) as first_seen_block,
          MAX(t.height) as last_seen_block,
          MAX(t.timestamp) as last_activity,
          array_agg(DISTINCT m.type) as transaction_types
        FROM api.transactions_main t
        JOIN api.messages_main m ON t.id = m.id
        WHERE m.sender = ${input.address} 
           OR m.mentions @> ARRAY[${input.address}]::text[]
      `)
      
      // Get token balances from recent transactions
      const balanceResult = await db.execute(sql`
        WITH address_transfers AS (
          SELECT 
            m.metadata,
            t.height,
            ROW_NUMBER() OVER (PARTITION BY 
              CASE 
                WHEN m.metadata->'amount' IS NOT NULL THEN m.metadata->'amount'->0->>'denom'
                WHEN m.metadata->'inputs' IS NOT NULL THEN m.metadata->'inputs'->0->'coins'->0->>'denom'
                ELSE 'unknown'
              END 
              ORDER BY t.height DESC
            ) as rn
          FROM api.messages_main m
          JOIN api.transactions_main t ON m.id = t.id
          WHERE (m.sender = ${input.address} OR m.mentions @> ARRAY[${input.address}]::text[])
            AND m.type IN ('/cosmos.bank.v1beta1.MsgSend', '/cosmos.bank.v1beta1.MsgMultiSend')
            AND t.error IS NULL
        )
        SELECT 
          metadata,
          height
        FROM address_transfers 
        WHERE rn <= 5
        ORDER BY height DESC
      `)
      
      const stats = statsResult.rows[0]
      return {
        address: input.address,
        totalTransactions: parseInt(stats.total_transactions as string) || 0,
        sentTransactions: parseInt(stats.sent_transactions as string) || 0,
        receivedTransactions: parseInt(stats.received_transactions as string) || 0,
        firstSeenBlock: parseInt(stats.first_seen_block as string) || null,
        lastSeenBlock: parseInt(stats.last_seen_block as string) || null,
        lastActivity: stats.last_activity,
        transactionTypes: (stats.transaction_types as string[]) || [],
        recentTransfers: balanceResult.rows.map(row => ({
          metadata: row.metadata,
          height: parseInt(row.height as string),
        })),
      }
    }),

  // Get transactions for an address using yaci's optimized function
  getTransactions: publicProcedure
    .input(z.object({
      address: z.string(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const result = await db.execute(sql`
        SELECT * FROM api.get_messages_for_address(${input.address})
        ORDER BY height DESC, message_index
        LIMIT ${input.limit} OFFSET ${input.offset}
      `)
      
      return result.rows.map(row => ({
        id: row.id,
        messageIndex: parseInt(row.message_index as string),
        type: row.type,
        sender: row.sender,
        mentions: row.mentions as string[],
        metadata: row.metadata,
        fee: row.fee,
        memo: row.memo,
        height: parseInt(row.height as string),
        timestamp: row.timestamp,
        success: !row.error,
        error: row.error,
        proposalIds: row.proposal_ids as string[],
      }))
    }),

  // Search addresses by partial match
  search: publicProcedure
    .input(z.object({
      query: z.string().min(3),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ input }) => {
      const result = await db.execute(sql`
        WITH address_matches AS (
          SELECT DISTINCT 
            unnest(mentions) as address,
            COUNT(*) as transaction_count,
            MAX(height) as last_height
          FROM api.messages_main m
          JOIN api.transactions_main t ON m.id = t.id
          WHERE unnest(mentions) LIKE ${`%${input.query}%`}
          GROUP BY unnest(mentions)
          
          UNION
          
          SELECT DISTINCT 
            sender as address,
            COUNT(*) as transaction_count,
            MAX(height) as last_height
          FROM api.messages_main m
          JOIN api.transactions_main t ON m.id = t.id
          WHERE sender LIKE ${`%${input.query}%`}
          GROUP BY sender
        )
        SELECT 
          address,
          SUM(transaction_count) as total_transactions,
          MAX(last_height) as last_activity_height
        FROM address_matches
        GROUP BY address
        ORDER BY total_transactions DESC, last_activity_height DESC
        LIMIT ${input.limit}
      `)
      
      return result.rows.map(row => ({
        address: row.address,
        totalTransactions: parseInt(row.total_transactions as string),
        lastActivityHeight: parseInt(row.last_activity_height as string),
      }))
    }),
})