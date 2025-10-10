import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db/schema.js'
import { sql } from 'drizzle-orm'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  })

  let lastBlockHeight = 0

  // Function to send block update
  const sendBlockUpdate = async () => {
    try {
      const result = await db.execute(sql`
        SELECT 
          data->'block'->'header'->>'height' as height,
          data->'block'->'header'->>'time' as timestamp,
          data->'block'->'header'->>'proposerAddress' as proposer,
          jsonb_array_length(COALESCE(data->'block'->'data'->'txs', '[]'::jsonb)) as tx_count,
          encode(decode(data->'block'->'header'->>'dataHash', 'base64'), 'hex') as block_hash
        FROM api.blocks_raw 
        ORDER BY (data->'block'->'header'->>'height')::bigint DESC 
        LIMIT 1
      `)

      if (result.rows.length > 0) {
        const block = result.rows[0]
        const currentHeight = parseInt(block.height as string)
        
        if (currentHeight > lastBlockHeight) {
          lastBlockHeight = currentHeight
          
          const blockData = {
            height: currentHeight,
            timestamp: block.timestamp,
            proposer: block.proposer,
            txCount: parseInt(block.tx_count as string) || 0,
            blockHash: block.block_hash,
          }
          
          res.write(`data: ${JSON.stringify({ type: 'block', data: blockData })}\n\n`)
        }
      }
    } catch (error) {
      console.error('Error fetching latest block:', error)
    }
  }

  // Send initial block data
  await sendBlockUpdate()

  // Set up polling for new blocks
  const interval = setInterval(sendBlockUpdate, 3000) // Poll every 3 seconds

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(interval)
    res.end()
  })

  req.on('end', () => {
    clearInterval(interval)
    res.end()
  })
}