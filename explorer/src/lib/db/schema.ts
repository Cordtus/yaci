import { drizzle } from 'drizzle-orm/postgres-js'
import { pgTable, varchar, bigint, jsonb, text, timestamp, serial, boolean, index } from 'drizzle-orm/pg-core'
import postgres from 'postgres'

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:foobar@localhost:5432/postgres'
const client = postgres(connectionString)
export const db = drizzle(client)

// Extend yaci's existing schema with additional explorer-specific tables

// Network statistics and chain info
export const networkStats = pgTable('explorer_network_stats', {
  id: serial('id').primaryKey(),
  chainId: text('chain_id').notNull(),
  latestHeight: bigint('latest_height', { mode: 'number' }).notNull(),
  totalTransactions: bigint('total_transactions', { mode: 'number' }).notNull(),
  totalAddresses: bigint('total_addresses', { mode: 'number' }).notNull(),
  avgBlockTime: bigint('avg_block_time', { mode: 'number' }).notNull(), // in milliseconds
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Contract verification and ABI storage
export const contractVerification = pgTable('explorer_contract_verification', {
  id: serial('id').primaryKey(),
  contractAddress: varchar('contract_address', { length: 42 }).notNull().unique(),
  sourceCode: text('source_code'),
  abi: jsonb('abi'),
  contractName: text('contract_name'),
  compilerVersion: text('compiler_version'),
  optimizationEnabled: boolean('optimization_enabled').default(false),
  runs: bigint('runs', { mode: 'number' }),
  verifiedAt: timestamp('verified_at').defaultNow(),
  verifiedBy: text('verified_by'),
  isProxy: boolean('is_proxy').default(false),
  implementationAddress: varchar('implementation_address', { length: 42 }),
}, (table) => ({
  contractAddressIdx: index('contract_address_idx').on(table.contractAddress),
}))

// Token information and metadata
export const tokenInfo = pgTable('explorer_token_info', {
  id: serial('id').primaryKey(),
  denom: text('denom').notNull().unique(),
  name: text('name'),
  symbol: text('symbol'),
  decimals: bigint('decimals', { mode: 'number' }).default(6),
  totalSupply: text('total_supply'), // Use text to handle large numbers
  contractAddress: varchar('contract_address', { length: 42 }),
  tokenType: text('token_type').notNull(), // 'native', 'tokenfactory', 'erc20', 'erc721', 'erc1155'
  logo: text('logo_url'),
  description: text('description'),
  website: text('website'),
  createdAt: timestamp('created_at').defaultNow(),
  lastUpdated: timestamp('last_updated').defaultNow(),
}, (table) => ({
  denomIdx: index('token_denom_idx').on(table.denom),
  contractAddressIdx: index('token_contract_address_idx').on(table.contractAddress),
}))

// Address labels and tags
export const addressLabels = pgTable('explorer_address_labels', {
  id: serial('id').primaryKey(),
  address: text('address').notNull(),
  label: text('label').notNull(),
  category: text('category'), // 'exchange', 'validator', 'contract', 'multisig', 'treasury', etc.
  description: text('description'),
  website: text('website'),
  verified: boolean('verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  addressIdx: index('address_labels_address_idx').on(table.address),
  categoryIdx: index('address_labels_category_idx').on(table.category),
}))

// Validator information
export const validators = pgTable('explorer_validators', {
  id: serial('id').primaryKey(),
  operatorAddress: text('operator_address').notNull().unique(),
  consensusAddress: text('consensus_address'),
  moniker: text('moniker').notNull(),
  website: text('website'),
  description: text('description'),
  commission: text('commission_rate'),
  votingPower: bigint('voting_power', { mode: 'number' }),
  jailed: boolean('jailed').default(false),
  status: text('status'), // 'bonded', 'unbonding', 'unbonded'
  avatar: text('avatar_url'),
  lastUpdated: timestamp('last_updated').defaultNow(),
}, (table) => ({
  operatorAddressIdx: index('validator_operator_address_idx').on(table.operatorAddress),
  consensusAddressIdx: index('validator_consensus_address_idx').on(table.consensusAddress),
}))

// Governance proposals
export const proposals = pgTable('explorer_proposals', {
  id: serial('id').primaryKey(),
  proposalId: bigint('proposal_id', { mode: 'number' }).notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  proposer: text('proposer'),
  status: text('status'), // 'voting', 'passed', 'rejected', 'failed', 'deposit_period'
  submitTime: timestamp('submit_time'),
  depositEndTime: timestamp('deposit_end_time'),
  votingStartTime: timestamp('voting_start_time'),
  votingEndTime: timestamp('voting_end_time'),
  totalDeposit: jsonb('total_deposit'),
  finalTallyResult: jsonb('final_tally_result'),
  proposalType: text('proposal_type'),
  lastUpdated: timestamp('last_updated').defaultNow(),
}, (table) => ({
  proposalIdIdx: index('proposal_id_idx').on(table.proposalId),
  statusIdx: index('proposal_status_idx').on(table.status),
}))

// Search index for full-text search
export const searchIndex = pgTable('explorer_search_index', {
  id: serial('id').primaryKey(),
  entityType: text('entity_type').notNull(), // 'block', 'transaction', 'address', 'contract'
  entityId: text('entity_id').notNull(),
  searchVector: text('search_vector').notNull(), // tsvector as text
  title: text('title'),
  description: text('description'),
  height: bigint('height', { mode: 'number' }),
  lastUpdated: timestamp('last_updated').defaultNow(),
}, (table) => ({
  entityTypeIdx: index('search_entity_type_idx').on(table.entityType),
  entityIdIdx: index('search_entity_id_idx').on(table.entityId),
}))

// Export types for TypeScript
export type NetworkStats = typeof networkStats.$inferSelect
export type ContractVerification = typeof contractVerification.$inferSelect
export type TokenInfo = typeof tokenInfo.$inferSelect
export type AddressLabel = typeof addressLabels.$inferSelect
export type Validator = typeof validators.$inferSelect
export type Proposal = typeof proposals.$inferSelect
export type SearchIndex = typeof searchIndex.$inferSelect