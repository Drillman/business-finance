import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import { taxPayments, invoices, expenses } from '../db/schema'
import { requireAuth } from '../auth/middleware'

const createTaxPaymentSchema = z.object({
  amount: z.number().positive('Le montant doit être positif'),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
  status: z.enum(['pending', 'paid']).default('pending'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)').optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
})

const updateTaxPaymentSchema = createTaxPaymentSchema.partial()

const listQuerySchema = z.object({
  year: z.coerce.number().min(2000).max(2100).optional(),
  status: z.enum(['pending', 'paid']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

export async function tvaRoutes(fastify: FastifyInstance) {
  // List tax payments
  fastify.get(
    '/api/tva/payments',
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

      const conditions = [eq(taxPayments.userId, userId)]

      if (year) {
        const startDate = `${year}-01-01`
        const endDate = `${year}-12-31`
        conditions.push(gte(taxPayments.periodStart, startDate))
        conditions.push(lte(taxPayments.periodEnd, endDate))
      }

      if (status) {
        conditions.push(eq(taxPayments.status, status))
      }

      const results = await db
        .select()
        .from(taxPayments)
        .where(and(...conditions))
        .orderBy(desc(taxPayments.periodEnd))
        .limit(limit)
        .offset(offset)

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(taxPayments)
        .where(and(...conditions))

      return {
        data: results,
        total: Number(countResult[0].count),
        limit,
        offset,
      }
    }
  )

  // Get single tax payment
  fastify.get(
    '/api/tva/payments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const payment = await db.query.taxPayments.findFirst({
        where: and(eq(taxPayments.id, id), eq(taxPayments.userId, userId)),
      })

      if (!payment) {
        return reply.status(404).send({ message: 'Paiement TVA non trouvé' })
      }

      return payment
    }
  )

  // Create tax payment
  fastify.post(
    '/api/tva/payments',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createTaxPaymentSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const data = parseResult.data
      const userId = request.authUser.userId

      // Validate dates
      if (data.periodEnd < data.periodStart) {
        return reply.status(400).send({
          message: 'La date de fin doit être après la date de début',
        })
      }

      const [payment] = await db
        .insert(taxPayments)
        .values({
          userId,
          amount: data.amount.toFixed(2),
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          status: data.status,
          paymentDate: data.paymentDate,
          reference: data.reference,
          note: data.note,
        })
        .returning()

      return reply.status(201).send(payment)
    }
  )

  // Update tax payment
  fastify.put(
    '/api/tva/payments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const parseResult = updateTaxPaymentSchema.safeParse(request.body)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const existing = await db.query.taxPayments.findFirst({
        where: and(eq(taxPayments.id, id), eq(taxPayments.userId, userId)),
      })

      if (!existing) {
        return reply.status(404).send({ message: 'Paiement TVA non trouvé' })
      }

      const data = parseResult.data
      const updateData: Record<string, unknown> = {}

      if (data.amount !== undefined) updateData.amount = data.amount.toFixed(2)
      if (data.periodStart !== undefined) updateData.periodStart = data.periodStart
      if (data.periodEnd !== undefined) updateData.periodEnd = data.periodEnd
      if (data.status !== undefined) updateData.status = data.status
      if (data.paymentDate !== undefined) updateData.paymentDate = data.paymentDate
      if (data.reference !== undefined) updateData.reference = data.reference
      if (data.note !== undefined) updateData.note = data.note

      // Validate dates if both are present
      const finalStart = data.periodStart ?? existing.periodStart
      const finalEnd = data.periodEnd ?? existing.periodEnd
      if (finalEnd < finalStart) {
        return reply.status(400).send({
          message: 'La date de fin doit être après la date de début',
        })
      }

      const [updated] = await db
        .update(taxPayments)
        .set(updateData)
        .where(and(eq(taxPayments.id, id), eq(taxPayments.userId, userId)))
        .returning()

      return updated
    }
  )

  // Delete tax payment
  fastify.delete(
    '/api/tva/payments/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const userId = request.authUser.userId

      const existing = await db.query.taxPayments.findFirst({
        where: and(eq(taxPayments.id, id), eq(taxPayments.userId, userId)),
      })

      if (!existing) {
        return reply.status(404).send({ message: 'Paiement TVA non trouvé' })
      }

      await db
        .delete(taxPayments)
        .where(and(eq(taxPayments.id, id), eq(taxPayments.userId, userId)))

      return reply.status(204).send()
    }
  )

  // Get TVA summary for a period
  fastify.get(
    '/api/tva/summary',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
      })

      const parseResult = querySchema.safeParse(request.query)
      if (!parseResult.success) {
        return reply.status(400).send({
          message: parseResult.error.issues[0].message,
        })
      }

      const { startDate, endDate } = parseResult.data
      const userId = request.authUser.userId

      // Get TVA collected from invoices (based on payment date)
      const invoiceResult = await db
        .select({
          totalHt: sql<string>`COALESCE(SUM(${invoices.amountHt}::numeric), 0)`,
          totalTtc: sql<string>`COALESCE(SUM(${invoices.amountTtc}::numeric), 0)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            gte(invoices.paymentDate, startDate),
            lte(invoices.paymentDate, endDate)
          )
        )

      const totalHt = parseFloat(invoiceResult[0].totalHt)
      const totalTtc = parseFloat(invoiceResult[0].totalTtc)
      const tvaCollected = totalTtc - totalHt

      // Get TVA recoverable from expenses
      const expenseResult = await db
        .select({
          totalTax: sql<string>`COALESCE(SUM(${expenses.taxAmount}::numeric), 0)`,
          recoverableTax: sql<string>`COALESCE(SUM(${expenses.taxAmount}::numeric * ${expenses.taxRecoveryRate}::numeric / 100), 0)`,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.userId, userId),
            gte(expenses.date, startDate),
            lte(expenses.date, endDate)
          )
        )

      const tvaRecoverable = parseFloat(expenseResult[0].recoverableTax)
      const netTva = tvaCollected - tvaRecoverable

      // Get payments made in this period
      const paymentsResult = await db
        .select({
          totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${taxPayments.status} = 'paid' THEN ${taxPayments.amount}::numeric ELSE 0 END), 0)`,
          totalPending: sql<string>`COALESCE(SUM(CASE WHEN ${taxPayments.status} = 'pending' THEN ${taxPayments.amount}::numeric ELSE 0 END), 0)`,
        })
        .from(taxPayments)
        .where(
          and(
            eq(taxPayments.userId, userId),
            gte(taxPayments.periodStart, startDate),
            lte(taxPayments.periodEnd, endDate)
          )
        )

      return {
        startDate,
        endDate,
        tvaCollected: tvaCollected.toFixed(2),
        tvaRecoverable: tvaRecoverable.toFixed(2),
        netTva: netTva.toFixed(2),
        totalPaid: parseFloat(paymentsResult[0].totalPaid).toFixed(2),
        totalPending: parseFloat(paymentsResult[0].totalPending).toFixed(2),
        balance: (netTva - parseFloat(paymentsResult[0].totalPaid)).toFixed(2),
      }
    }
  )

  // Get monthly TVA breakdown
  fastify.get(
    '/api/tva/monthly',
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

      const monthlyData = []

      for (let month = 1; month <= 12; month++) {
        const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

        // TVA collected from invoices
        const invoiceResult = await db
          .select({
            totalHt: sql<string>`COALESCE(SUM(${invoices.amountHt}::numeric), 0)`,
            totalTtc: sql<string>`COALESCE(SUM(${invoices.amountTtc}::numeric), 0)`,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.userId, userId),
              gte(invoices.paymentDate, startDate),
              lte(invoices.paymentDate, endDate)
            )
          )

        const totalHt = parseFloat(invoiceResult[0].totalHt)
        const totalTtc = parseFloat(invoiceResult[0].totalTtc)
        const collected = totalTtc - totalHt

        // TVA recoverable from expenses
        const expenseResult = await db
          .select({
            recoverableTax: sql<string>`COALESCE(SUM(${expenses.taxAmount}::numeric * ${expenses.taxRecoveryRate}::numeric / 100), 0)`,
          })
          .from(expenses)
          .where(
            and(
              eq(expenses.userId, userId),
              gte(expenses.date, startDate),
              lte(expenses.date, endDate)
            )
          )

        const recoverable = parseFloat(expenseResult[0].recoverableTax)

        monthlyData.push({
          month,
          year,
          tvaCollected: collected.toFixed(2),
          tvaRecoverable: recoverable.toFixed(2),
          netTva: (collected - recoverable).toFixed(2),
        })
      }

      return { year, months: monthlyData }
    }
  )
}
