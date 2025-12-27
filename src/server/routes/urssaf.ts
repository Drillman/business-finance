import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db'
import { urssafPayments, invoices, settings } from '../db/schema'
import { requireAuth } from '../auth/middleware'

const createUrssafPaymentSchema = z.object({
  trimester: z.number().min(1).max(4, 'Le trimestre doit être entre 1 et 4'),
  year: z.number().min(2000).max(2100),
  revenue: z.number().min(0, 'Le chiffre d\'affaires ne peut pas être négatif'),
  amount: z.number().min(0, 'Le montant ne peut pas être négatif'),
  status: z.enum(['pending', 'paid']).default('pending'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)').optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
})

const updateUrssafPaymentSchema = createUrssafPaymentSchema.partial()

const listQuerySchema = z.object({
  year: z.coerce.number().min(2000).max(2100).optional(),
  status: z.enum(['pending', 'paid']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

// Helper to get trimester date range
function getTrimesterDates(year: number, trimester: number) {
  const startMonth = (trimester - 1) * 3 + 1
  const endMonth = trimester * 3
  const lastDay = new Date(year, endMonth, 0).getDate()

  return {
    startDate: `${year}-${startMonth.toString().padStart(2, '0')}-01`,
    endDate: `${year}-${endMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`,
  }
}

export async function urssafRoutes(fastify: FastifyInstance) {
  // List Urssaf payments
  fastify.get(
    '/api/urssaf/payments',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = listQuerySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { year, status, limit, offset } = parseResult.data
      const userId = request.authUser.userId

      const conditions = [eq(urssafPayments.userId, userId)]

      if (year) {
        conditions.push(eq(urssafPayments.year, year))
      }

      if (status) {
        conditions.push(eq(urssafPayments.status, status))
      }

      const results = await db
        .select()
        .from(urssafPayments)
        .where(and(...conditions))
        .orderBy(desc(urssafPayments.year), desc(urssafPayments.trimester))
        .limit(limit)
        .offset(offset)

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(urssafPayments)
        .where(and(...conditions))

      return {
        data: results,
        total: Number(countResult[0].count),
        limit,
        offset,
      }
    }
  )

  // Get single Urssaf payment
  fastify.get(
    '/api/urssaf/payments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const payment = await db.query.urssafPayments.findFirst({
        where: and(eq(urssafPayments.id, id), eq(urssafPayments.userId, userId)),
      })

      if (!payment) {
        return reply.status(404).send({ message: 'Cotisation Urssaf non trouvée' })
      }

      return payment
    }
  )

  // Create Urssaf payment
  fastify.post(
    '/api/urssaf/payments',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createUrssafPaymentSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const data = parseResult.data
      const userId = request.authUser.userId

      // Check if payment for this trimester/year already exists
      const existing = await db.query.urssafPayments.findFirst({
        where: and(
          eq(urssafPayments.userId, userId),
          eq(urssafPayments.year, data.year),
          eq(urssafPayments.trimester, data.trimester)
        ),
      })

      if (existing) {
        return reply.status(409).send({
          message: `Une cotisation Urssaf existe déjà pour T${data.trimester} ${data.year}`,
        })
      }

      const [payment] = await db
        .insert(urssafPayments)
        .values({
          userId,
          trimester: data.trimester,
          year: data.year,
          revenue: data.revenue.toFixed(2),
          amount: data.amount.toFixed(2),
          status: data.status,
          paymentDate: data.paymentDate,
          reference: data.reference,
          note: data.note,
        })
        .returning()

      return reply.status(201).send(payment)
    }
  )

  // Update Urssaf payment
  fastify.put(
    '/api/urssaf/payments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const parseResult = updateUrssafPaymentSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const existing = await db.query.urssafPayments.findFirst({
        where: and(eq(urssafPayments.id, id), eq(urssafPayments.userId, userId)),
      })

      if (!existing) {
        return reply.status(404).send({ message: 'Cotisation Urssaf non trouvée' })
      }

      const data = parseResult.data
      const updateData: Record<string, unknown> = {}

      if (data.trimester !== undefined) updateData.trimester = data.trimester
      if (data.year !== undefined) updateData.year = data.year
      if (data.revenue !== undefined) updateData.revenue = data.revenue.toFixed(2)
      if (data.amount !== undefined) updateData.amount = data.amount.toFixed(2)
      if (data.status !== undefined) updateData.status = data.status
      if (data.paymentDate !== undefined) updateData.paymentDate = data.paymentDate
      if (data.reference !== undefined) updateData.reference = data.reference
      if (data.note !== undefined) updateData.note = data.note

      // If changing trimester/year, check for duplicates
      const finalTrimester = data.trimester ?? existing.trimester
      const finalYear = data.year ?? existing.year
      if (finalTrimester !== existing.trimester || finalYear !== existing.year) {
        const duplicate = await db.query.urssafPayments.findFirst({
          where: and(
            eq(urssafPayments.userId, userId),
            eq(urssafPayments.year, finalYear),
            eq(urssafPayments.trimester, finalTrimester)
          ),
        })
        if (duplicate && duplicate.id !== id) {
          return reply.status(409).send({
            message: `Une cotisation Urssaf existe déjà pour T${finalTrimester} ${finalYear}`,
          })
        }
      }

      const [updated] = await db
        .update(urssafPayments)
        .set(updateData)
        .where(and(eq(urssafPayments.id, id), eq(urssafPayments.userId, userId)))
        .returning()

      return updated
    }
  )

  // Delete Urssaf payment
  fastify.delete(
    '/api/urssaf/payments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const existing = await db.query.urssafPayments.findFirst({
        where: and(eq(urssafPayments.id, id), eq(urssafPayments.userId, userId)),
      })

      if (!existing) {
        return reply.status(404).send({ message: 'Cotisation Urssaf non trouvée' })
      }

      await db
        .delete(urssafPayments)
        .where(and(eq(urssafPayments.id, id), eq(urssafPayments.userId, userId)))

      return reply.status(204).send()
    }
  )

  // Get annual Urssaf summary
  fastify.get(
    '/api/urssaf/summary',
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

      // Get user's Urssaf rate
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userId, userId),
      })
      const urssafRate = userSettings ? parseFloat(userSettings.urssafRate) : 22

      // Get all payments for the year
      const payments = await db
        .select()
        .from(urssafPayments)
        .where(
          and(
            eq(urssafPayments.userId, userId),
            eq(urssafPayments.year, year)
          )
        )
        .orderBy(urssafPayments.trimester)

      // Calculate totals
      const totals = {
        totalRevenue: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalPending: 0,
      }

      const trimesterData = []

      for (let t = 1; t <= 4; t++) {
        const payment = payments.find(p => p.trimester === t)
        const { startDate, endDate } = getTrimesterDates(year, t)

        // Get actual revenue for this trimester from invoices
        const invoiceResult = await db
          .select({
            totalHt: sql<string>`COALESCE(SUM(${invoices.amountHt}::numeric), 0)`,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.userId, userId),
              sql`${invoices.paymentDate} >= ${startDate}`,
              sql`${invoices.paymentDate} <= ${endDate}`
            )
          )

        const actualRevenue = parseFloat(invoiceResult[0].totalHt)
        const estimatedAmount = actualRevenue * (urssafRate / 100)

        if (payment) {
          totals.totalRevenue += parseFloat(payment.revenue)
          totals.totalAmount += parseFloat(payment.amount)
          if (payment.status === 'paid') {
            totals.totalPaid += parseFloat(payment.amount)
          } else {
            totals.totalPending += parseFloat(payment.amount)
          }
        }

        trimesterData.push({
          trimester: t,
          startDate,
          endDate,
          actualRevenue: actualRevenue.toFixed(2),
          estimatedAmount: estimatedAmount.toFixed(2),
          payment: payment || null,
        })
      }

      return {
        year,
        urssafRate,
        trimesters: trimesterData,
        totals: {
          totalRevenue: totals.totalRevenue.toFixed(2),
          totalAmount: totals.totalAmount.toFixed(2),
          totalPaid: totals.totalPaid.toFixed(2),
          totalPending: totals.totalPending.toFixed(2),
        },
      }
    }
  )

  // Calculate Urssaf amount for a given revenue
  fastify.post(
    '/api/urssaf/calculate',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const bodySchema = z.object({
        revenue: z.number().min(0, 'Le chiffre d\'affaires ne peut pas être négatif'),
      })

      const parseResult = bodySchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { revenue } = parseResult.data
      const userId = request.authUser.userId

      // Get user's Urssaf rate
      const userSettings = await db.query.settings.findFirst({
        where: eq(settings.userId, userId),
      })
      const urssafRate = userSettings ? parseFloat(userSettings.urssafRate) : 22
      const amount = revenue * (urssafRate / 100)

      return {
        revenue: revenue.toFixed(2),
        rate: urssafRate,
        amount: amount.toFixed(2),
      }
    }
  )
}
