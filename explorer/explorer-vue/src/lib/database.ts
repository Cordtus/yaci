import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const connectionString = import.meta.env.VITE_DATABASE_URL || 'postgres://postgres:foobar@localhost:5432/postgres'

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false })
export const db = drizzle(client)

export { client }