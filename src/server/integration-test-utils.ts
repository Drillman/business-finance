import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import * as schema from './db/schema'

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5434/business_finance_test'
const TEST_JWT_SECRET = 'integration-test-jwt-secret'

let testClient: ReturnType<typeof postgres> | null = null
let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null

export async function getTestDb() {
  if (!testDb) {
    testClient = postgres(TEST_DB_URL)
    testDb = drizzle(testClient, { schema })
  }
  return testDb
}

export async function isTestDbAvailable(): Promise<boolean> {
  try {
    const client = postgres(TEST_DB_URL, { connect_timeout: 3 })
    await client`SELECT 1`
    await client.end()
    return true
  } catch {
    return false
  }
}

export async function pushSchema() {
  const db = await getTestDb()
  // Create tables using raw SQL from schema definitions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client VARCHAR(255) NOT NULL,
      description TEXT,
      invoice_date DATE NOT NULL,
      payment_date DATE,
      amount_ht DECIMAL(12,2) NOT NULL,
      tax_rate DECIMAL(5,2) NOT NULL,
      amount_ttc DECIMAL(12,2) NOT NULL,
      invoice_number VARCHAR(50),
      note TEXT,
      is_canceled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invoice_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invoice_descriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `)
}

export async function truncateAll() {
  const db = await getTestDb()
  await db.execute(sql`TRUNCATE invoices, invoice_clients, invoice_descriptions, refresh_tokens CASCADE`)
  await db.execute(sql`TRUNCATE users CASCADE`)
}

export async function closeTestDb() {
  if (testClient) {
    await testClient.end()
    testClient = null
    testDb = null
  }
}

export async function createIntegrationTestApp(
  registerRoutes: (fastify: FastifyInstance) => Promise<void>
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(cookie, { secret: 'test-cookie-secret' })
  await app.register(jwt, {
    secret: TEST_JWT_SECRET,
    sign: { expiresIn: '15m' },
    cookie: { cookieName: 'accessToken', signed: false },
  })

  await registerRoutes(app)
  await app.ready()
  return app
}

export function createIntegrationTestToken(
  app: FastifyInstance,
  payload: { userId: string; email: string }
): string {
  return app.jwt.sign(payload)
}

export async function createTestUser(email = 'test@example.com'): Promise<{ id: string; email: string }> {
  const db = await getTestDb()
  const [user] = await db.insert(schema.users).values({
    email,
    passwordHash: '$2b$10$dummyhashfortesting',
  }).returning()
  return { id: user.id, email: user.email }
}
