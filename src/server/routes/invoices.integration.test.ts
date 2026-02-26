import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import {
  isTestDbAvailable,
  getTestDb,
  pushSchema,
  truncateAll,
  closeTestDb,
  createIntegrationTestApp,
  createIntegrationTestToken,
  createTestUser,
} from '../integration-test-utils'

// Mock the db module to use the test database
vi.mock('../db', async () => {
  const { getTestDb } = await import('../integration-test-utils')
  return { db: await getTestDb() }
})

const isAvailable = await isTestDbAvailable()

describe.skipIf(!isAvailable)('Invoice routes (integration)', () => {
  let app: Awaited<ReturnType<typeof createIntegrationTestApp>>
  let token: string
  let userId: string

  beforeAll(async () => {
    await pushSchema()

    const { invoiceRoutes } = await import('./invoices')
    app = await createIntegrationTestApp(async (fastify) => {
      await fastify.register(invoiceRoutes)
    })

    const user = await createTestUser()
    userId = user.id
    token = createIntegrationTestToken(app, { userId: user.id, email: user.email })
  })

  afterEach(async () => {
    const db = await getTestDb()
    const { sql } = await import('drizzle-orm')
    await db.execute(sql`DELETE FROM invoices WHERE user_id = ${userId}`)
  })

  afterAll(async () => {
    await truncateAll()
    await app.close()
    await closeTestDb()
  })

  describe('POST /api/invoices', () => {
    it('creates an invoice and returns it with calculated TTC', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: {
          client: 'Integration Test Corp',
          invoiceDate: '2025-06-15',
          amountHt: 1000,
          taxRate: 20,
        },
        cookies: { accessToken: token },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.client).toBe('Integration Test Corp')
      expect(body.amountHt).toBe('1000.00')
      expect(body.taxRate).toBe('20.00')
      expect(body.amountTtc).toBe('1200.00')
      expect(body.userId).toBe(userId)
      expect(body.id).toBeDefined()
    })

    it('persists invoice in database', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: {
          client: 'Persisted Client',
          invoiceDate: '2025-03-01',
          amountHt: 500,
          taxRate: 10,
        },
        cookies: { accessToken: token },
      })

      const created = createResponse.json()

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/invoices/${created.id}`,
        cookies: { accessToken: token },
      })

      expect(getResponse.statusCode).toBe(200)
      expect(getResponse.json().client).toBe('Persisted Client')
    })
  })

  describe('GET /api/invoices', () => {
    it('returns empty list when no invoices', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices',
        cookies: { accessToken: token },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.data).toEqual([])
      expect(body.total).toBe(0)
    })

    it('returns created invoices', async () => {
      // Create 2 invoices
      await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: { client: 'Client A', invoiceDate: '2025-01-10', amountHt: 100, taxRate: 20 },
        cookies: { accessToken: token },
      })
      await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: { client: 'Client B', invoiceDate: '2025-01-20', amountHt: 200, taxRate: 20 },
        cookies: { accessToken: token },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices',
        cookies: { accessToken: token },
      })

      const body = response.json()
      expect(body.total).toBe(2)
      expect(body.data).toHaveLength(2)
    })

    it('filters by month', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: { client: 'Jan Client', invoiceDate: '2025-01-15', amountHt: 100, taxRate: 20 },
        cookies: { accessToken: token },
      })
      await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: { client: 'Feb Client', invoiceDate: '2025-02-15', amountHt: 200, taxRate: 20 },
        cookies: { accessToken: token },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices?month=2025-01',
        cookies: { accessToken: token },
      })

      const body = response.json()
      expect(body.total).toBe(1)
      expect(body.data[0].client).toBe('Jan Client')
    })
  })

  describe('PUT /api/invoices/:id', () => {
    it('updates an existing invoice', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: { client: 'Original', invoiceDate: '2025-05-01', amountHt: 100, taxRate: 20 },
        cookies: { accessToken: token },
      })
      const { id } = createResponse.json()

      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/invoices/${id}`,
        payload: { client: 'Updated', amountHt: 2000 },
        cookies: { accessToken: token },
      })

      expect(updateResponse.statusCode).toBe(200)
      const body = updateResponse.json()
      expect(body.client).toBe('Updated')
      expect(body.amountHt).toBe('2000.00')
      expect(body.amountTtc).toBe('2400.00')
    })

    it('returns 404 for non-existent invoice', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/invoices/00000000-0000-0000-0000-000000000000',
        payload: { client: 'Test' },
        cookies: { accessToken: token },
      })
      expect(response.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/invoices/:id', () => {
    it('deletes an invoice', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: { client: 'To Delete', invoiceDate: '2025-04-01', amountHt: 50, taxRate: 0 },
        cookies: { accessToken: token },
      })
      const { id } = createResponse.json()

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/invoices/${id}`,
        cookies: { accessToken: token },
      })
      expect(deleteResponse.statusCode).toBe(204)

      // Verify it's gone
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/invoices/${id}`,
        cookies: { accessToken: token },
      })
      expect(getResponse.statusCode).toBe(404)
    })
  })

  describe('Multi-tenant isolation', () => {
    it('user cannot see another users invoices', async () => {
      // Create invoice as main test user
      await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: { client: 'Secret Client', invoiceDate: '2025-07-01', amountHt: 9999, taxRate: 20 },
        cookies: { accessToken: token },
      })

      // Create another user
      const otherUser = await createTestUser('other@example.com')
      const otherToken = createIntegrationTestToken(app, {
        userId: otherUser.id,
        email: otherUser.email,
      })

      // Other user should see 0 invoices
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices',
        cookies: { accessToken: otherToken },
      })

      expect(response.json().total).toBe(0)
    })
  })
})
