import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { createTestApp, createTestToken } from '../test-utils'
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  listQuerySchema,
  calculateTtc,
  invoiceRoutes,
} from './invoices'

// ─── Pure unit tests: calculateTtc ──────────────────────────────────

describe('calculateTtc', () => {
  it('calculates TTC with 20% tax', () => {
    expect(calculateTtc(1000, 20)).toBe('1200.00')
  })

  it('calculates TTC with 0% tax', () => {
    expect(calculateTtc(500, 0)).toBe('500.00')
  })

  it('calculates TTC with 5.5% tax', () => {
    expect(calculateTtc(100, 5.5)).toBe('105.50')
  })

  it('handles decimal amounts', () => {
    expect(calculateTtc(99.99, 20)).toBe('119.99')
  })

  it('handles 100% tax', () => {
    expect(calculateTtc(50, 100)).toBe('100.00')
  })

  it('handles small amounts with precision', () => {
    expect(calculateTtc(0.01, 20)).toBe('0.01')
  })
})

// ─── Pure unit tests: Zod schemas ───────────────────────────────────

describe('createInvoiceSchema', () => {
  const validInvoice = {
    client: 'Acme Corp',
    invoiceDate: '2025-01-15',
    amountHt: 1000,
    taxRate: 20,
  }

  it('accepts a valid invoice', () => {
    const result = createInvoiceSchema.safeParse(validInvoice)
    expect(result.success).toBe(true)
  })

  it('accepts all optional fields', () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      description: 'Web development',
      paymentDate: '2025-02-15',
      invoiceNumber: '20250101',
      note: 'First invoice',
      isCanceled: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty client', () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, client: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format', () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceDate: '15-01-2025',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative amount', () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      amountHt: -100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero amount', () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      amountHt: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative tax rate', () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      taxRate: -5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects tax rate above 100', () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      taxRate: 101,
    })
    expect(result.success).toBe(false)
  })

  it('accepts tax rate of 0', () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      taxRate: 0,
    })
    expect(result.success).toBe(true)
  })
})

describe('updateInvoiceSchema', () => {
  it('accepts partial updates', () => {
    const result = updateInvoiceSchema.safeParse({ client: 'New Client' })
    expect(result.success).toBe(true)
  })

  it('accepts empty object', () => {
    const result = updateInvoiceSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('still validates field constraints', () => {
    const result = updateInvoiceSchema.safeParse({ amountHt: -10 })
    expect(result.success).toBe(false)
  })
})

describe('listQuerySchema', () => {
  it('accepts empty query (uses defaults)', () => {
    const result = listQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(100)
      expect(result.data.offset).toBe(0)
    }
  })

  it('accepts valid month filter', () => {
    const result = listQuerySchema.safeParse({ month: '2025-01' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid month format', () => {
    const result = listQuerySchema.safeParse({ month: '01-2025' })
    expect(result.success).toBe(false)
  })

  it('coerces string limit to number', () => {
    const result = listQuerySchema.safeParse({ limit: '50' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
    }
  })

  it('rejects limit above max', () => {
    const result = listQuerySchema.safeParse({ limit: '501' })
    expect(result.success).toBe(false)
  })

  it('accepts year filter', () => {
    const result = listQuerySchema.safeParse({ year: '2025' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.year).toBe(2025)
    }
  })
})

// ─── Route tests with fastify.inject() ─────────────────────────────

vi.mock('../db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    }),
    query: {
      invoices: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'test-id', client: 'Test' }]),
      }),
    }),
  },
}))

describe('invoice routes', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>
  let token: string

  beforeAll(async () => {
    app = await createTestApp(async (fastify) => {
      await fastify.register(invoiceRoutes)
    })
    token = createTestToken(app)
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /api/invoices', () => {
    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices',
      })
      expect(response.statusCode).toBe(401)
    })

    it('returns 200 with valid auth', async () => {
      // Need to also mock the count query
      const { db } = await import('../db')
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      } as any)

      // For count query (second call to db.select)
      let callCount = 0
      vi.mocked(db.select).mockImplementation((...args: any[]) => {
        callCount++
        if (callCount % 2 === 0) {
          // count query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          } as any
        }
        // data query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        } as any
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices',
        cookies: { accessToken: token },
      })
      expect(response.statusCode).toBe(200)
    })

    it('returns 400 for invalid query params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices?month=invalid',
        cookies: { accessToken: token },
      })
      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /api/invoices', () => {
    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: { client: 'Test', invoiceDate: '2025-01-01', amountHt: 100, taxRate: 20 },
      })
      expect(response.statusCode).toBe(401)
    })

    it('returns 400 for invalid body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: { client: '' },
        cookies: { accessToken: token },
      })
      expect(response.statusCode).toBe(400)
    })

    it('returns 201 for valid invoice', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: {
          client: 'Acme Corp',
          invoiceDate: '2025-01-15',
          amountHt: 1000,
          taxRate: 20,
        },
        cookies: { accessToken: token },
      })
      expect(response.statusCode).toBe(201)
    })
  })

  describe('GET /api/invoices/:id', () => {
    it('returns 404 when invoice not found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices/nonexistent-id',
        cookies: { accessToken: token },
      })
      expect(response.statusCode).toBe(404)
    })
  })
})
