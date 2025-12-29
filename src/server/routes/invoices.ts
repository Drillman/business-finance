import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import { invoices } from '../db/schema'
import { requireAuth } from '../auth/middleware'

const createInvoiceSchema = z.object({
  client: z.string().min(1, 'Le client est requis'),
  description: z.string().optional(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)').optional(),
  amountHt: z.number().positive('Le montant HT doit être positif'),
  taxRate: z.number().min(0, 'Le taux de TVA ne peut pas être négatif').max(100, 'Le taux de TVA ne peut pas dépasser 100%'),
  invoiceNumber: z.string().optional(),
  note: z.string().optional(),
})

const updateInvoiceSchema = createInvoiceSchema.partial()

const listQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format de mois invalide (YYYY-MM)').optional(),
  year: z.coerce.number().min(2000).max(2100).optional(),
  client: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
})

function calculateTtc(amountHt: number, taxRate: number): string {
  const ttc = amountHt * (1 + taxRate / 100)
  return ttc.toFixed(2)
}

export async function invoiceRoutes(fastify: FastifyInstance) {
  // List invoices
  fastify.get(
    '/api/invoices',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = listQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { month, year, client, limit, offset } = parseResult.data
      const userId = request.authUser.userId

      // Build conditions array
      const conditions = [eq(invoices.userId, userId)]

      if (month) {
        const startDate = `${month}-01`
        const [yearNum, monthNum] = month.split('-').map(Number)
        const lastDay = new Date(yearNum, monthNum, 0).getDate()
        const endDate = `${month}-${lastDay.toString().padStart(2, '0')}`
        conditions.push(gte(invoices.invoiceDate, startDate))
        conditions.push(lte(invoices.invoiceDate, endDate))
      } else if (year) {
        const startDate = `${year}-01-01`
        const endDate = `${year}-12-31`
        conditions.push(gte(invoices.invoiceDate, startDate))
        conditions.push(lte(invoices.invoiceDate, endDate))
      }

      if (client) {
        conditions.push(sql`${invoices.client} ILIKE ${`%${client}%`}`)
      }

      const results = await db
        .select()
        .from(invoices)
        .where(and(...conditions))
        .orderBy(desc(invoices.invoiceDate))
        .limit(limit)
        .offset(offset)

      // Get total count for pagination
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .where(and(...conditions))

      return {
        data: results,
        total: Number(countResult[0].count),
        limit,
        offset,
      }
    }
  )

  // Get single invoice
  fastify.get(
    '/api/invoices/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const invoice = await db.query.invoices.findFirst({
        where: and(eq(invoices.id, id), eq(invoices.userId, userId)),
      })

      if (!invoice) {
        return reply.status(404).send({ message: 'Facture non trouvée' })
      }

      return invoice
    }
  )

  // Get unique clients
  fastify.get(
    '/api/invoices/clients',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest) => {
      const userId = request.authUser.userId

      const result = await db
        .selectDistinct({ client: invoices.client })
        .from(invoices)
        .where(eq(invoices.userId, userId))
        .orderBy(invoices.client)

      return {
        clients: result.map((r) => r.client),
      }
    }
  )

  // Get unique descriptions
  fastify.get(
    '/api/invoices/descriptions',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest) => {
      const userId = request.authUser.userId

      const result = await db
        .selectDistinct({ description: invoices.description })
        .from(invoices)
        .where(and(eq(invoices.userId, userId), sql`${invoices.description} IS NOT NULL AND ${invoices.description} != ''`))
        .orderBy(invoices.description)

      return {
        descriptions: result.map((r) => r.description).filter(Boolean) as string[],
      }
    }
  )

  // Get next invoice number
  fastify.get(
    '/api/invoices/next-number',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest) => {
      const userId = request.authUser.userId
      const now = new Date()
      const year = now.getFullYear()
      const month = (now.getMonth() + 1).toString().padStart(2, '0')
      const prefix = `FAC-${year}${month}-`

      // Find the highest invoice number with this prefix for this user
      const result = await db
        .select({ invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            sql`${invoices.invoiceNumber} LIKE ${prefix + '%'}`
          )
        )
        .orderBy(desc(invoices.invoiceNumber))
        .limit(1)

      let nextNumber = 1
      if (result.length > 0 && result[0].invoiceNumber) {
        const lastNumber = result[0].invoiceNumber.replace(prefix, '')
        const parsed = parseInt(lastNumber, 10)
        if (!isNaN(parsed)) {
          nextNumber = parsed + 1
        }
      }

      return {
        invoiceNumber: `${prefix}${nextNumber.toString().padStart(3, '0')}`,
      }
    }
  )

  // Create invoice
  fastify.post(
    '/api/invoices',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createInvoiceSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const data = parseResult.data
      const userId = request.authUser.userId
      const amountTtc = calculateTtc(data.amountHt, data.taxRate)

      const [invoice] = await db
        .insert(invoices)
        .values({
          userId,
          client: data.client,
          description: data.description,
          invoiceDate: data.invoiceDate,
          paymentDate: data.paymentDate,
          amountHt: data.amountHt.toFixed(2),
          taxRate: data.taxRate.toFixed(2),
          amountTtc,
          invoiceNumber: data.invoiceNumber,
          note: data.note,
        })
        .returning()

      return reply.status(201).send(invoice)
    }
  )

  // Update invoice
  fastify.put(
    '/api/invoices/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const parseResult = updateInvoiceSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      // Check if invoice exists and belongs to user
      const existing = await db.query.invoices.findFirst({
        where: and(eq(invoices.id, id), eq(invoices.userId, userId)),
      })

      if (!existing) {
        return reply.status(404).send({ message: 'Facture non trouvée' })
      }

      const data = parseResult.data
      const updateData: Record<string, unknown> = {}

      if (data.client !== undefined) updateData.client = data.client
      if (data.description !== undefined) updateData.description = data.description
      if (data.invoiceDate !== undefined) updateData.invoiceDate = data.invoiceDate
      if (data.paymentDate !== undefined) updateData.paymentDate = data.paymentDate
      if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber
      if (data.note !== undefined) updateData.note = data.note

      // Recalculate TTC if amounts changed
      if (data.amountHt !== undefined || data.taxRate !== undefined) {
        const amountHt = data.amountHt ?? parseFloat(existing.amountHt)
        const taxRate = data.taxRate ?? parseFloat(existing.taxRate)
        updateData.amountHt = amountHt.toFixed(2)
        updateData.taxRate = taxRate.toFixed(2)
        updateData.amountTtc = calculateTtc(amountHt, taxRate)
      }

      const [updated] = await db
        .update(invoices)
        .set(updateData)
        .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
        .returning()

      return updated
    }
  )

  // Delete invoice
  fastify.delete(
    '/api/invoices/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const existing = await db.query.invoices.findFirst({
        where: and(eq(invoices.id, id), eq(invoices.userId, userId)),
      })

      if (!existing) {
        return reply.status(404).send({ message: 'Facture non trouvée' })
      }

      await db
        .delete(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))

      return reply.status(204).send()
    }
  )

  // Get monthly summary
  fastify.get(
    '/api/invoices/summary/monthly',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        year: z.coerce.number().min(2000).max(2100),
        month: z.coerce.number().min(1).max(12),
      })

      const parseResult = querySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { year, month } = parseResult.data
      const userId = request.authUser.userId

      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

      const result = await db
        .select({
          totalHt: sql<string>`COALESCE(SUM(${invoices.amountHt}::numeric), 0)`,
          totalTtc: sql<string>`COALESCE(SUM(${invoices.amountTtc}::numeric), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            gte(invoices.invoiceDate, startDate),
            lte(invoices.invoiceDate, endDate)
          )
        )

      const totalHt = parseFloat(result[0].totalHt)
      const totalTtc = parseFloat(result[0].totalTtc)
      const taxTotal = totalTtc - totalHt

      return {
        year,
        month,
        totalHt: totalHt.toFixed(2),
        totalTtc: totalTtc.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        count: Number(result[0].count),
      }
    }
  )

  // Get yearly summary
  fastify.get(
    '/api/invoices/summary/yearly',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        year: z.coerce.number().min(2000).max(2100),
      })

      const parseResult = querySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { year } = parseResult.data
      const userId = request.authUser.userId

      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`

      const result = await db
        .select({
          totalHt: sql<string>`COALESCE(SUM(${invoices.amountHt}::numeric), 0)`,
          totalTtc: sql<string>`COALESCE(SUM(${invoices.amountTtc}::numeric), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            gte(invoices.invoiceDate, startDate),
            lte(invoices.invoiceDate, endDate)
          )
        )

      const totalHt = parseFloat(result[0].totalHt)
      const totalTtc = parseFloat(result[0].totalTtc)
      const taxTotal = totalTtc - totalHt

      return {
        year,
        totalHt: totalHt.toFixed(2),
        totalTtc: totalTtc.toFixed(2),
        taxTotal: taxTotal.toFixed(2),
        count: Number(result[0].count),
      }
    }
  )
}
