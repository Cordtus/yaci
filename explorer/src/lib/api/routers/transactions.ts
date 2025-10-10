import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { db } from '../../db/schema.js'
import { sql } from 'drizzle-orm'

export const transactionsRouter = router({
  // Get latest transactions with optional limit
  getLatest: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const result = await db.execute(sql`
        SELECT 
          t.id,
          t.height,
          t.timestamp,
          t.fee,
          t.memo,
          t.error,
          t.proposal_ids,
          encode(decode(split_part(t.id, '', 1), 'hex'), 'hex') as tx_hash,
          COUNT(m.id) as message_count,
          array_agg(DISTINCT m.type) as message_types
        FROM api.transactions_main t
        LEFT JOIN api.messages_main m ON t.id = m.id
        GROUP BY t.id, t.height, t.timestamp, t.fee, t.memo, t.error, t.proposal_ids
        ORDER BY t.height DESC, t.timestamp DESC
        LIMIT ${input.limit} OFFSET ${input.offset}
      `)
      
      return result.rows.map(row => ({
        id: row.id,
        txHash: row.id, // The ID is the transaction hash
        height: parseInt(row.height as string),
        timestamp: row.timestamp,
        fee: row.fee,
        memo: row.memo,
        success: !row.error,
        error: row.error,
        proposalIds: row.proposal_ids,
        messageCount: parseInt(row.message_count as string),
        messageTypes: row.message_types as string[],
      }))
    }),

  // Get transaction by hash
  getByHash: publicProcedure
    .input(z.object({
      hash: z.string(),
    }))
    .query(async ({ input }) => {
      // Get transaction details
      const txResult = await db.execute(sql`
        SELECT 
          t.id,
          t.height,
          t.timestamp,
          t.fee,
          t.memo,
          t.error,
          t.proposal_ids,
          tr.data as raw_data
        FROM api.transactions_main t
        JOIN api.transactions_raw tr ON t.id = tr.id
        WHERE t.id = ${input.hash}
      `)
      
      if (txResult.rows.length === 0) {
        throw new Error('Transaction not found')
      }
      
      // Get messages for this transaction
      const messagesResult = await db.execute(sql`
        SELECT 
          m.message_index,
          m.type,
          m.sender,
          m.mentions,
          m.metadata,
          mr.data as raw_data
        FROM api.messages_main m
        JOIN api.messages_raw mr ON m.id = mr.id AND m.message_index = mr.message_index
        WHERE m.id = ${input.hash}
        ORDER BY m.message_index
      `)
      
      const transaction = txResult.rows[0]
      const messages = messagesResult.rows
      
      return {
        id: transaction.id,
        txHash: transaction.id,
        height: parseInt(transaction.height as string),
        timestamp: transaction.timestamp,
        fee: transaction.fee,
        memo: transaction.memo,
        success: !transaction.error,
        error: transaction.error,
        proposalIds: transaction.proposal_ids,
        rawData: transaction.raw_data,
        messages: messages.map(msg => ({
          index: parseInt(msg.message_index as string),
          type: msg.type,
          sender: msg.sender,
          mentions: msg.mentions as string[],
          metadata: msg.metadata,
          rawData: msg.raw_data,
        })),
      }
    }),

  // Get transactions by address
  getByAddress: publicProcedure
    .input(z.object({
      address: z.string(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const result = await db.execute(sql`
        SELECT DISTINCT
          t.id,
          t.height,
          t.timestamp,
          t.fee,
          t.memo,
          t.error,
          m.type,
          m.sender,
          m.metadata
        FROM api.transactions_main t
        JOIN api.messages_main m ON t.id = m.id
        WHERE m.sender = ${input.address} 
           OR m.mentions @> ARRAY[${input.address}]::text[]
        ORDER BY t.height DESC, t.timestamp DESC
        LIMIT ${input.limit} OFFSET ${input.offset}
      `)
      
      return result.rows.map(row => ({
        id: row.id,
        txHash: row.id,
        height: parseInt(row.height as string),
        timestamp: row.timestamp,
        fee: row.fee,
        memo: row.memo,
        success: !row.error,
        error: row.error,
        messageType: row.type,
        sender: row.sender,
        metadata: row.metadata,
      }))
    }),

  // Get transaction statistics
  getStats: publicProcedure
    .query(async () => {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(DISTINCT height) as blocks_with_transactions,
          SUM(CASE WHEN error IS NULL THEN 1 ELSE 0 END) as successful_transactions,
          COUNT(DISTINCT 
            CASE WHEN memo IS NOT NULL AND memo != '' 
            THEN memo END
          ) as unique_memos,
          array_agg(DISTINCT m.type) as transaction_types
        FROM api.transactions_main t
        LEFT JOIN api.messages_main m ON t.id = m.id
      `)
      
      const stats = result.rows[0]
      return {
        totalTransactions: parseInt(stats.total_transactions as string),
        blocksWithTransactions: parseInt(stats.blocks_with_transactions as string),
        successfulTransactions: parseInt(stats.successful_transactions as string),
        uniqueMemos: parseInt(stats.unique_memos as string),
        transactionTypes: stats.transaction_types as string[],
      }
    }),
})