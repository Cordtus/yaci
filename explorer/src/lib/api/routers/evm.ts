import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { db, contractVerification } from '../../db/schema.js'
import { sql, eq } from 'drizzle-orm'
import { ContractDecoder, ERC20_ABI, detectContractType } from '../../evm/contract-verification.js'

export const evmRouter = router({
  // Get contract verification info
  getContractVerification: publicProcedure
    .input(z.object({
      contractAddress: z.string(),
    }))
    .query(async ({ input }) => {
      const result = await db
        .select()
        .from(contractVerification)
        .where(eq(contractVerification.contractAddress, input.contractAddress))
        .limit(1)
      
      return result[0] || null
    }),

  // Submit contract verification
  verifyContract: publicProcedure
    .input(z.object({
      contractAddress: z.string(),
      sourceCode: z.string(),
      abi: z.any(),
      contractName: z.string(),
      compilerVersion: z.string(),
      optimizationEnabled: z.boolean().default(false),
      runs: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // Detect contract type from ABI
      const contractType = detectContractType(input.abi)
      
      const result = await db
        .insert(contractVerification)
        .values({
          contractAddress: input.contractAddress,
          sourceCode: input.sourceCode,
          abi: input.abi,
          contractName: input.contractName,
          compilerVersion: input.compilerVersion,
          optimizationEnabled: input.optimizationEnabled,
          runs: input.runs,
          verifiedBy: 'user', // In a real system, this would be the authenticated user
        })
        .returning()
      
      return result[0]
    }),

  // Decode hex data using contract ABI
  decodeHexData: publicProcedure
    .input(z.object({
      contractAddress: z.string().optional(),
      data: z.string(),
      topics: z.array(z.string()).optional(),
    }))
    .query(async ({ input }) => {
      let abi = ERC20_ABI // Default fallback
      
      if (input.contractAddress) {
        const verification = await db
          .select()
          .from(contractVerification)
          .where(eq(contractVerification.contractAddress, input.contractAddress))
          .limit(1)
        
        if (verification[0]?.abi) {
          abi = verification[0].abi as any[]
        }
      }
      
      const decoder = new ContractDecoder(abi)
      
      if (input.topics && input.topics.length > 0) {
        // This is event data
        return {
          type: 'event',
          decoded: decoder.decodeLogData(input.topics, input.data),
          contractVerified: !!input.contractAddress && abi !== ERC20_ABI,
        }
      } else {
        // This is call data
        return {
          type: 'function',
          decoded: decoder.decodeCallData(input.data),
          contractVerified: !!input.contractAddress && abi !== ERC20_ABI,
        }
      }
    }),

  // Get EVM transaction details with enhanced parsing
  getEvmTransaction: publicProcedure
    .input(z.object({
      txHash: z.string(),
    }))
    .query(async ({ input }) => {
      // Query for EVM-specific transaction data
      // This would integrate with yaci's EVM extraction once available
      const result = await db.execute(sql`
        SELECT 
          t.id,
          t.height,
          t.timestamp,
          tr.data,
          m.metadata
        FROM api.transactions_main t
        JOIN api.transactions_raw tr ON t.id = tr.id
        LEFT JOIN api.messages_main m ON t.id = m.id
        WHERE t.id = ${input.txHash}
          AND (m.type LIKE '%evm%' OR m.metadata->'data' IS NOT NULL)
      `)
      
      if (result.rows.length === 0) {
        return null
      }
      
      const tx = result.rows[0]
      
      // Try to extract EVM data from metadata
      const evmData = tx.metadata?.evmTransaction || null
      
      return {
        txHash: tx.id,
        height: parseInt(tx.height as string),
        timestamp: tx.timestamp,
        evmData,
        rawData: tx.data,
      }
    }),

  // List verified contracts
  getVerifiedContracts: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const result = await db
        .select()
        .from(contractVerification)
        .orderBy(contractVerification.verifiedAt)
        .limit(input.limit)
        .offset(input.offset)
      
      return result.map(contract => ({
        ...contract,
        contractType: detectContractType(contract.abi as any[]),
      }))
    }),
})